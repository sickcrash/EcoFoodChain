const readline = require('readline');
const path = require('path');

async function promptHidden(message) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const onSIGINT = () => {
      rl.close();
      reject(new Error('Input aborted by user'));
    };

    process.once('SIGINT', onSIGINT);

    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (this.stdoutMuted) {
        this.output.write('*');
      } else {
        this.output.write(stringToWrite);
      }
    };

    rl.stdoutMuted = true;
    rl.question(message, (answer) => {
      rl.stdoutMuted = false;
      rl.close();
      process.removeListener('SIGINT', onSIGINT);
      resolve(answer);
    });
  });
}

(async () => {
  if (!process.env.PGPASSWORD) {
    if (process.stdin.isTTY) {
      console.log("Per avviare il backend e' necessaria la password del database PostgreSQL.");
      console.log("La digitazione e' nascosta: i caratteri non saranno mostrati mentre scrivi.");
      try {
        const pwd = await promptHidden('Inserisci la password del database PostgreSQL: ');
        process.env.PGPASSWORD = pwd;
        console.log('\nPassword acquisita.\n');
      } catch (err) {
        console.error('\nAvvio annullato:', err.message);
        process.exit(1);
      }
    } else {
      console.warn('[start] PGPASSWORD non impostata e input non interattivo; proseguo senza password.');
    }
  }

  require(path.join(__dirname, '..', 'src', 'server'));
})();


