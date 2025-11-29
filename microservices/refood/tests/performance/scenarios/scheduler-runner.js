#!/usr/bin/env node
/*
 * Utility per eseguire manualmente (one-shot) i job dello scheduler backend.
 * Permette di verificare tempi di esecuzione e logging senza attendere i cron.
 */
const path = require('path');
const fs = require('fs');

function loadDotEnv(basePath, filename, override = false) {
  const filePath = path.resolve(basePath, filename);
  if (fs.existsSync(filePath)) {
    try {
      const dotenv = require(path.resolve(__dirname, '../../backend/node_modules/dotenv'));
      dotenv.config({ path: filePath, override });
    } catch (_) {
      try {
        const dotenv = require('dotenv');
        dotenv.config({ path: filePath, override });
      } catch (err) {
        console.warn(`Impossibile caricare dotenv da ${filePath}: ${err.message}`);
      }
    }
  }
}

async function main() {
  const rootDir = path.resolve(__dirname, '..', '..');

  loadDotEnv(rootDir, '.env');
  loadDotEnv(rootDir, path.join('backend', '.env'), true);

  // Forza ambiente a test se non definito
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'performance-test';
  }

  const logger = require(path.join(rootDir, 'backend', 'src', 'utils', 'logger'));
  const scheduler = require(path.join(rootDir, 'backend', 'src', 'utils', 'scheduler'));
  const db = require(path.join(rootDir, 'backend', 'src', 'config', 'database'));

  const args = process.argv.slice(2);
  const wantsList = args.includes('--list');
  const rawFilter = args.find((arg) => !arg.startsWith('--'));

  const filter = buildFilter(rawFilter);

  logger.info('Scheduler manual runner ➜ init scheduler');
  scheduler.init();

  if (wantsList) {
    const names = scheduler.listJobs();
    console.log('Job registrati:', names.join(', '));
    scheduler.stop();
    await safeCloseDb(db);
    return;
  }

  logger.info(filter ? `Esecuzione manuale job: ${formatFilter(filter)}` : 'Esecuzione manuale di tutti i job');
  const started = Date.now();
  let outcomes = [];
  try {
    outcomes = await scheduler.runJobsOnce(filter);
  } finally {
    scheduler.stop();
    await safeCloseDb(db);
  }

  outcomes.forEach((outcome) => {
    if (outcome.status === 'ok') {
      console.log(`✔ Job ${outcome.name} completato`);
    } else {
      console.error(`✖ Job ${outcome.name} fallito: ${outcome.error}`);
    }
  });

  const duration = Date.now() - started;
  console.log(`⏱  Durata totale: ${duration} ms`);

  const hasError = outcomes.some((outcome) => outcome.status !== 'ok');
  process.exit(hasError ? 1 : 0);
}

function buildFilter(raw) {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('/') && trimmed.endsWith('/') && trimmed.length > 2) {
    try {
      return new RegExp(trimmed.slice(1, -1));
    } catch (_) {
      console.warn(`Filtro regex non valido (${trimmed}), verrà ignorato.`);
      return null;
    }
  }
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  }
  return trimmed;
}

function formatFilter(filter) {
  if (!filter) return 'all';
  if (filter instanceof RegExp) return `/${filter.source}/`;
  if (Array.isArray(filter)) return filter.join(',');
  if (typeof filter === 'function') return 'custom function';
  return String(filter);
}

async function safeCloseDb(db) {
  try {
    if (typeof db?.closeDatabase === 'function') {
      await db.closeDatabase();
    }
  } catch (err) {
    console.warn(`Errore durante la chiusura del database: ${err.message}`);
  }
}

main().catch((err) => {
  console.error('Scheduler manual runner: errore non gestito:', err);
  process.exit(1);
});
