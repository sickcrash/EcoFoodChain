/**
 * Script per la migrazione da Utenti a Attori
 * Questo script:
 * 1. Aggiorna i ruoli degli utenti esistenti secondo il nuovo schema
 * 2. Crea tipi utente appropriati per utenti con ruoli CentroSociale e CentroRiciclaggio
 * 3. Crea le associazioni nella tabella AttoriTipoUtente
 * 
 * ISTRUZIONI: 
 * node migrate_utenti_to_attori.js
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// Mappa di conversione dai vecchi ruoli ai nuovi
const RUOLI_MAP = {
  'Amministratore': 'Amministratore',
  'Operatore': 'Operatore',
  'CentroSociale': 'Utente', // Diventerà un Utente con Tipo_Utente 'Canale sociale'
  'CentroRiciclaggio': 'Utente', // Diventerà un Utente con Tipo_Utente 'centro riciclo'
};

// Mappa di conversione dai vecchi ruoli ai nuovi tipi utente
const TIPO_UTENTE_MAP = {
  'CentroSociale': 'Canale sociale',
  'CentroRiciclaggio': 'centro riciclo',
};

async function migrateUtentiToAttori() {
  try {
    // Esegue in transazione sul database PostgreSQL
    // Usa una transazione per assicurare che tutto sia eseguito o niente
    await db.run('BEGIN TRANSACTION');
    
    // Step 1: Trova tutti gli utenti con ruoli che necessitano migrazione
    const utenti = await db.all('SELECT id, email, nome, cognome, ruolo FROM Attori');
    
    logger.info(`Trovati ${utenti.length} utenti da migrare`);
    
    // Step 2: Per ogni utente, esegui la migrazione
    for (const utente of utenti) {
      // Migrazione del ruolo
      const nuovoRuolo = RUOLI_MAP[utente.ruolo] || 'Utente';
      
      // Aggiorna il ruolo nella tabella Attori
      await db.run('UPDATE Attori SET ruolo = ? WHERE id = ?', [nuovoRuolo, utente.id]);
      
      // Se l'utente era un centro sociale o riciclaggio, crea un Tipo_Utente
      if (TIPO_UTENTE_MAP[utente.ruolo]) {
        // Ottieni informazioni del centro collegato all'utente, se presente
        const centroDati = await db.get(
          `SELECT c.indirizzo, c.telefono, c.email 
           FROM UtentiCentri uc 
           JOIN Centri c ON uc.centro_id = c.id 
           WHERE uc.utente_id = ?`,
          [utente.id]
        );
        
        // Crea un nuovo Tipo_Utente
        const tipoUtente = {
          tipo: TIPO_UTENTE_MAP[utente.ruolo],
          indirizzo: centroDati?.indirizzo || 'Indirizzo non specificato',
          telefono: centroDati?.telefono || null,
          email: centroDati?.email || utente.email
        };
        
        const result = await db.run(
          `INSERT INTO Tipo_Utente (tipo, indirizzo, telefono, email, creato_il) 
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [tipoUtente.tipo, tipoUtente.indirizzo, tipoUtente.telefono, tipoUtente.email]
        );
        
        const tipoUtenteId = result.lastID;
        
        // Crea l'associazione in AttoriTipoUtente
        await db.run(
          `INSERT INTO AttoriTipoUtente (attore_id, tipo_utente_id, data_inizio) 
           VALUES (?, ?, datetime('now'))`,
          [utente.id, tipoUtenteId]
        );
        
        logger.info(`Creato Tipo_Utente '${tipoUtente.tipo}' per l'attore ${utente.id} (${utente.email})`);
      } else {
        logger.info(`Aggiornato solo il ruolo per l'attore ${utente.id} (${utente.email}) a '${nuovoRuolo}'`);
      }
    }
    
    // Commit della transazione
    await db.run('COMMIT');
    
    logger.info('Migrazione completata con successo!');
    
  } catch (error) {
    // Rollback in caso di errore
    try { await db.run('ROLLBACK'); } catch (_) {}
    
    logger.error(`Errore durante la migrazione: ${error.message}`);
    console.error(error);
    
  } finally {
    // Niente da chiudere per il pool Postgres
  }
}

// Esegui la funzione di migrazione
migrateUtentiToAttori().catch(error => {
  logger.error(`Errore critico durante la migrazione: ${error.message}`);
  process.exit(1);
}); 
