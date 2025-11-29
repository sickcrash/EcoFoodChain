const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function promptPassword() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      return resolve(null);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (this.stdoutMuted) {
        this.output.write('*');
      } else {
        this.output.write(stringToWrite);
      }
    };
    rl.question('Inserisci la password del database PostgreSQL (input nascosto): ', (answer) => {
      rl.stdoutMuted = false;
      rl.close();
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });
}

(async () => {
  if (!process.env.PGPASSWORD) {
    const pwd = await promptPassword();
    if (pwd) {
      process.env.PGPASSWORD = pwd;
      console.log('\n');
    } else {
      console.warn('Attenzione: PGPASSWORD non impostata, potrebbe fallire la connessione.');
    }
  }

  const db = require('../src/config/database');

  try {
    console.log('>> Avvio migrazione access_token_hash');
    await db.run('ALTER TABLE tokenautenticazione ADD COLUMN IF NOT EXISTS access_token_hash TEXT');
    console.log('Colonna access_token_hash garantita.');
    const result = await db.run(
      "UPDATE tokenautenticazione SET access_token_hash = access_token WHERE access_token_hash IS NULL AND access_token ~ '^[0-9a-f]{64}$'"
    );
    console.log(`Righe aggiornate: ${result.changes}`);
    console.log('<< Migrazione completata con successo');
  } catch (err) {
    console.error('!! Migrazione fallita:', err.message);
    process.exitCode = 1;
  } finally {
    try {
      await db.closeDatabase?.();
    } catch (_) {}
  }
})();
