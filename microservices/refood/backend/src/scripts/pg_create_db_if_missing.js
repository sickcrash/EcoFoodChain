try {
  require('dotenv').config();
} catch (_) {
  // setup iniziale: se dotenv non è installato, usa solo process.env
}
const { Client } = require('pg');

async function ensureDatabase() {
  const host = process.env.PGHOST || 'localhost';
  const port = Number(process.env.PGPORT || 5432);
  const dbName = process.env.PGDATABASE || 'refood';
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || '';

  // Connessione al DB "postgres" per poter creare altri database
  const adminClient = new Client({ host, port, database: 'postgres', user, password });
  try {
    await adminClient.connect();
  } catch (err) {
    console.error(`[pg_create_db_if_missing] Connessione al DB postgres fallita: ${err.message}`);
    process.exitCode = 1;
    try { await adminClient.end(); } catch (_) {}
    return;
  }

  try {
    const res = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount === 0) {
      console.log(`[pg_create_db_if_missing] Database "${dbName}" assente. Creazione in corso...`);
      await adminClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`[pg_create_db_if_missing] Database "${dbName}" creato.`);
    } else {
      console.log(`[pg_create_db_if_missing] Database "${dbName}" già esistente.`);
    }
  } catch (err) {
    console.error(`[pg_create_db_if_missing] Errore durante verifica/creazione DB: ${err.message}`);
    process.exitCode = 1;
  } finally {
    try { await adminClient.end(); } catch (_) {}
  }
}

ensureDatabase();
