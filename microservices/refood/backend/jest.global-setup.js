const { Client } = require('pg');

module.exports = async () => {
  const host = process.env.PGHOST || 'localhost';
  const port = Number(process.env.PGPORT || 5432);
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || 'postgres';

  // Try connecting to default 'postgres' db to avoid dependency on app DB existence
  const maxAttempts = 30;
  const delayMs = 1000;
  let lastErr;
  for (let i = 1; i <= maxAttempts; i++) {
    const client = new Client({ host, port, user, password, database: 'postgres' });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  const msg = `Impossibile connettersi a Postgres su ${host}:${port} come ${user}. Ultimo errore: ${lastErr?.message}`;
  // eslint-disable-next-line no-console
  console.error(msg);
  throw new Error(msg);
};

