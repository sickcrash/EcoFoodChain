#!/usr/bin/env node
/**
 * Script di bonifica per popolare le colonne hash di TokenAutenticazione.
 * È possibile fornire le credenziali via env (PGPASSWORD, PGHOST, ...)
 * oppure tramite CLI: `node backfill_token_hashes.js --password=...`.
 */

const args = process.argv.slice(2);
let cliPassword;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg.startsWith('--password=')) {
    cliPassword = arg.split('=', 2)[1];
  } else if (arg === '--password' || arg === '-p') {
    cliPassword = args[i + 1];
    i += 1;
  }
}

if (cliPassword && !process.env.PGPASSWORD) {
  process.env.PGPASSWORD = String(cliPassword);
}
if (process.env.PGPASSWORD != null && typeof process.env.PGPASSWORD !== 'string') {
  process.env.PGPASSWORD = String(process.env.PGPASSWORD);
}

const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');
const { hashToken } = require('../utils/tokenUtils');

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function ensureSchema() {
  try {
    await db.run('ALTER TABLE TokenAutenticazione ADD COLUMN IF NOT EXISTS access_token_hash TEXT');
  } catch (err) {
    logger.warn(`backfill_token_hashes: impossibile aggiungere access_token_hash: ${err.message}`);
  }
}

async function processTokens() {
  const rows = await db.all(
    'SELECT id, access_token, access_token_hash, refresh_token FROM TokenAutenticazione'
  );

  let updated = 0;

  for (const row of rows) {
    const updates = [];
    const params = [];

    if (!isSha256(row.access_token_hash) && typeof row.access_token === 'string' && row.access_token.length) {
      const accessHash = isSha256(row.access_token)
        ? row.access_token.toLowerCase()
        : hashToken(row.access_token);

      if (accessHash) {
        updates.push('access_token = ?', 'access_token_hash = ?');
        params.push(accessHash, accessHash);
      }
    }

    if (typeof row.refresh_token === 'string' && row.refresh_token.length && !isSha256(row.refresh_token)) {
      const hashedRefresh = sha256Hex(row.refresh_token);
      updates.push('refresh_token = ?');
      params.push(hashedRefresh);
    }

    if (updates.length) {
      params.push(row.id);
      const setClause = updates.join(', ');
      await db.run(`UPDATE TokenAutenticazione SET ${setClause} WHERE id = ?`, params);
      updated += 1;
    }
  }

  logger.info(`backfill_token_hashes: righe aggiornate=${updated}`);
}

async function main() {
  try {
    await ensureSchema();
    await processTokens();
  } catch (err) {
    logger.error(`backfill_token_hashes: errore: ${err.message}`);
    process.exitCode = 1;
  } finally {
    try {
      await db.closeDatabase?.();
    } catch (closeErr) {
      logger.warn(`backfill_token_hashes: errore chiusura connessione: ${closeErr.message}`);
    }
  }
}

main();
