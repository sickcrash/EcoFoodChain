try {
  require('dotenv').config();
} catch (_) {
  // Procedi senza .env se il modulo non è installato durante setup iniziale
}
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

async function main() {
  if (db.client !== 'postgres') {
    logger.error('pg_init_full: DB_CLIENT non è postgres. Imposta DB_CLIENT=postgres nelle variabili d\'ambiente.');
    process.exit(1);
  }
  const schemaPath = path.join(__dirname, '..', 'database', 'postgres', 'schema_full.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  // Workaround: alcuni riferimenti FK richiedono che Lotti esista prima di tabelle che lo referenziano
  // Riordiniamo il blocco CREATE TABLE Lotti mettendolo all'inizio dell'esecuzione
  const lottiStart = sql.search(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+Lotti\s*\(/i);
  let orderedSql = sql;
  // Disabilitato: l'ordine nel file SQL è stato corretto; evitare riordini automatici
  if (false && lottiStart >= 0) {
    // Cerca la fine del blocco usando la prima occorrenza di '\);' dopo l'inizio
    const rest = sql.slice(lottiStart);
    const endIdxLocal = rest.search(/\)\s*;/);
    if (endIdxLocal > 0) {
      const lottiStmt = sql.slice(lottiStart, lottiStart + endIdxLocal + 2); // include ');'
      // Rimuovi il blocco originale (più eventuale punto e virgola successivo se presente)
      const before = sql.slice(0, lottiStart);
      const after = sql.slice(lottiStart + endIdxLocal + 2);
      orderedSql = `${lottiStmt};\n${before}${after}`;
    }
  }
  try {
    logger.info(`Esecuzione schema completo Postgres da ${schemaPath}`);
    await db.exec(orderedSql);
    logger.info('Schema completo creato/aggiornato con successo.');
    process.exit(0);
  } catch (e) {
    logger.error(`Errore inizializzazione schema completo: ${e.message}`);
    process.exit(2);
  }
}

main();
