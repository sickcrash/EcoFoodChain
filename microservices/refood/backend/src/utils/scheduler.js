const cron = require('node-cron');
const db = require('../config/database');
const logger = require('./logger');
const segnalazioniService = require('../services/segnalazioniService');

const SYSTEM_ACTOR_CACHE = { id: null };

async function resolveSystemActorId(connection) {
  if (SYSTEM_ACTOR_CACHE.id) {
    const stillValid = await connection.get(
      `SELECT id FROM Attori WHERE id = ? AND (disabilitato IS NULL OR disabilitato = FALSE) AND (eliminato_il IS NULL)`,
      [SYSTEM_ACTOR_CACHE.id]
    );
    if (stillValid) {
      return SYSTEM_ACTOR_CACHE.id;
    }
    SYSTEM_ACTOR_CACHE.id = null;
  }

  const fallback = await connection.get(`
    SELECT id
    FROM Attori
    WHERE (disabilitato IS NULL OR disabilitato = FALSE)
      AND (eliminato_il IS NULL)
    ORDER BY CASE WHEN ruolo = 'Amministratore' THEN 0 ELSE 1 END, id
    LIMIT 1
  `);

  if (!fallback) {
    throw new Error('Nessun attore attivo disponibile per registrare i cambi di stato automatici');
  }

  SYSTEM_ACTOR_CACHE.id = fallback.id;
  return SYSTEM_ACTOR_CACHE.id;
}

async function registerStatusChange(connection, lottoId, previousState, nextState, actorId) {
  await connection.run(
    `INSERT INTO LogCambioStato (lotto_id, stato_precedente, stato_nuovo, cambiato_il, cambiato_da)
     VALUES (?, ?, ?, NOW(), ?)`,
    [lottoId, previousState, nextState, actorId]
  );
}

/**
 * Configurazione delle attività pianificate
 */
class Scheduler {
  constructor() {
    this.jobs = [];
  }

  /**
   * Inizializza tutte le attività pianificate
   */
  init() {
    this.setupLottiStatusUpdate();
    this.setupExpiredLotsArchiving();
    this.setupSystemStatsCollection();
    this.setupSegnalazioniCleanup(7);

    logger.info('Scheduler inizializzato con successo');
  }

  /**
   * Configura l'aggiornamento automatico degli stati dei lotti
   * Eseguito ogni ora
   */
  setupLottiStatusUpdate() {
    // Pianifica l'aggiornamento ogni ora
    const job = cron.schedule('0 * * * *', async () => {
      logger.info('Avvio aggiornamento stato lotti');

      let connection;
      try {
        connection = await db.getConnection();
      } catch (connError) {
        logger.error(`Impossibile ottenere una connessione per lotti status update: ${connError.message}`);
        return;
      }

      try {
        await connection.beginTransaction();

        const oggi = new Date().toISOString().split('T')[0];
        const systemActorId = await resolveSystemActorId(connection);

        const lottiDaArancione = await connection.all(`
          SELECT id, stato, data_scadenza, giorni_permanenza
          FROM Lotti
          WHERE stato = 'Verde'
            AND (data_scadenza - (giorni_permanenza::text || ' days')::interval) <= ?::date
            AND data_scadenza > ?::date
        `, [oggi, oggi]);

        logger.info(`Trovati ${lottiDaArancione.length} lotti da aggiornare a stato Arancione`);

        for (const lotto of lottiDaArancione) {
          await connection.run(
            `UPDATE Lotti SET stato = 'Arancione', aggiornato_il = NOW() WHERE id = ?`,
            [lotto.id]
          );

          await registerStatusChange(connection, lotto.id, lotto.stato, 'Arancione', systemActorId);
        }

        if (lottiDaArancione.length > 0) {
          logger.info(`${lottiDaArancione.length} lotti aggiornati a stato Arancione`);
        }

        const lottiDaRosso = await connection.all(`
          SELECT id, stato
          FROM Lotti
          WHERE stato IN ('Verde', 'Arancione')
            AND data_scadenza <= ?::date
        `, [oggi]);

        logger.info(`Trovati ${lottiDaRosso.length} lotti da aggiornare a stato Rosso`);

        for (const lotto of lottiDaRosso) {
          await connection.run(
            `UPDATE Lotti SET stato = 'Rosso', aggiornato_il = NOW() WHERE id = ?`,
            [lotto.id]
          );

          await registerStatusChange(connection, lotto.id, lotto.stato, 'Rosso', systemActorId);
        }

        if (lottiDaRosso.length > 0) {
          logger.info(`${lottiDaRosso.length} lotti aggiornati a stato Rosso`);
        }

        await connection.commit();
        logger.info('Aggiornamento stato lotti completato con successo');
      } catch (error) {
        if (connection) {
          try {
            await connection.rollback();
          } catch (rollbackError) {
            logger.error(`Rollback fallito per aggiornamento lotti: ${rollbackError.message}`);
          }
        }
        logger.error(`Errore nell'aggiornamento dello stato dei lotti: ${error.message}`);
      } finally {
        if (connection) {
          connection.release();
        }
      }
    });

    this.jobs.push(job);
    logger.info('Scheduler per aggiornamento stato lotti configurato');
  }

  /**
   * Configura l'archiviazione dei lotti scaduti da più di 30 giorni
   * Eseguito ogni giorno a mezzanotte
   */
  setupExpiredLotsArchiving() {
    // Pianifica l'archiviazione ogni giorno a mezzanotte
    const job = cron.schedule('0 0 * * *', async () => {
      logger.info('Avvio archiviazione lotti scaduti');

      // Disabilitato finché lo schema di archivio non è presente e l'adapter non è compatibile
      try {
        const hasLottiArchivio = await db.get("SELECT 1 as ok FROM information_schema.tables WHERE table_schema='public' AND table_name='lottiarchivio'");
        const hasPrenotazioniArchivio = await db.get("SELECT 1 as ok FROM information_schema.tables WHERE table_schema='public' AND table_name='prenotazioniarchivio'");
        const hasStatusArchivio = await db.get("SELECT 1 as ok FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('statuschangelogarchivio','logcambiostatoarchivio')");
        if (!hasLottiArchivio || !hasPrenotazioniArchivio || !hasStatusArchivio) {
          logger.info('Archiviazione lotti: tabelle di archivio non presenti. Job saltato.');
          return;
        }
      } catch (e) {
        logger.warn(`Archiviazione lotti: impossibile verificare lo schema (${e.message}). Job saltato.`);
        return;
      }

      if (process.env.ENABLE_ARCHIVE_JOB !== 'true') {
        logger.info('Archiviazione lotti: job disabilitato (impostare ENABLE_ARCHIVE_JOB="true" per attivarlo).');
        return;
      }

      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        // Data 30 giorni fa
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 30);

        // Trova lotti da archiviare (scaduti da più di 30 giorni)
        const lottiDaArchiviare = await connection.all(`
          SELECT id 
          FROM Lotti 
          WHERE stato = 'Rosso' 
          AND data_scadenza < ?::date
        `, [dataLimite.toISOString().substring(0,10)]);

        if (lottiDaArchiviare.length === 0) {
          logger.info('Nessun lotto da archiviare');
          await connection.commit();
          return;
        }

        // IDs dei lotti da archiviare
        const lottiIds = lottiDaArchiviare.map(l => l.id);

        // Archivia i lotti (copia nella tabella di archivio)
        await connection.run(`
          INSERT INTO LottiArchivio 
          SELECT *, NOW() as data_archiviazione 
          FROM Lotti 
          WHERE id = ANY($1::int[])
        `, [lottiIds]);

        // Archivia i log di stato
        await connection.run(`
          INSERT INTO LogCambioStatoArchivio 
          SELECT *, NOW() as data_archiviazione 
          FROM LogCambioStato 
          WHERE lotto_id = ANY($1::int[])
        `, [lottiIds]);

        // Archivia le prenotazioni
        await connection.run(`
          INSERT INTO PrenotazioniArchivio 
          SELECT *, NOW() as data_archiviazione 
          FROM Prenotazioni 
          WHERE lotto_id = ANY($1::int[])
        `, [lottiIds]);

        // Elimina i dati originali dopo l'archiviazione
        await connection.run(`DELETE FROM Prenotazioni WHERE lotto_id = ANY($1::int[])`, [lottiIds]);
        await connection.run(`DELETE FROM LogCambioStato WHERE lotto_id = ANY($1::int[])`, [lottiIds]);
        await connection.run(`DELETE FROM LottiCategorie WHERE lotto_id = ANY($1::int[])`, [lottiIds]);
        await connection.run(`DELETE FROM Lotti WHERE id = ANY($1::int[])`, [lottiIds]);

        await connection.commit();
        logger.info(`${lottiIds.length} lotti archiviati con successo`);
      } catch (error) {
        await connection.rollback();
        logger.error(`Errore nell'archiviazione dei lotti: ${error.message}`);
      } finally {
        connection.release();
      }
    });

    this.jobs.push(job);
  }

  /**
   * Configura la raccolta di statistiche di sistema
   * Eseguito ogni giorno alle 23:30
   */
  setupSystemStatsCollection() {
    const job = cron.schedule('30 23 * * *', async () => {
      logger.info('Avvio raccolta statistiche giornaliere');

      // Disabilita se la tabella target non esiste o l'adapter non supporta le query usate
      try {
        const hasStatsTable = await db.get("SELECT 1 as ok FROM information_schema.tables WHERE table_schema='public' AND table_name='statistichegiornaliere'");
        if (!hasStatsTable) {
          logger.info('Statistiche: tabella StatisticheGiornaliere non presente. Job saltato.');
          return;
        }
      } catch (e) {
        logger.warn(`Statistiche: impossibile verificare lo schema (${e.message}). Job saltato.`);
        return;
      }

      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const oggi = new Date().toISOString().split('T')[0];

        // Statistiche lotti
        const statsLotti = await connection.get(`
          SELECT 
            COUNT(*) as totale_lotti,
            COUNT(CASE WHEN stato = 'Verde' THEN 1 END) as lotti_verdi,
            COUNT(CASE WHEN stato = 'Arancione' THEN 1 END) as lotti_arancioni,
            COUNT(CASE WHEN stato = 'Rosso' THEN 1 END) as lotti_rossi,
            SUM(quantita) as quantita_totale
          FROM Lotti
        `);

        // Statistiche prenotazioni
        const statsPrenotazioni = await connection.get(`
          SELECT 
            COUNT(*) as totale_prenotazioni,
            COUNT(CASE WHEN stato IN ('Prenotato','InAttesa','Confermato','ProntoPerRitiro','InTransito') THEN 1 END) as prenotazioni_attive,
            COUNT(CASE WHEN stato = 'Consegnato' THEN 1 END) as prenotazioni_consegnate,
            COUNT(CASE WHEN stato = 'Annullato' THEN 1 END) as prenotazioni_annullate
          FROM Prenotazioni
        `);

        // Statistiche utenti
        const statsAttori = await connection.get(`
          SELECT 
            COUNT(*) as totale_utenti,
            COUNT(CASE WHEN ruolo = 'Operatore' THEN 1 END) as utenti_operatori,
            COUNT(CASE WHEN ruolo = 'Amministratore' THEN 1 END) as utenti_amministratori,
            COUNT(CASE WHEN ruolo = 'Utente' THEN 1 END) as utenti_utenti
          FROM Attori
        `);

        // Impatto ambientale ed economico
        const impatto = await connection.get(`
          SELECT 
            COALESCE(SUM(co2_risparmiata_kg),0) as co2_totale,
            COALESCE(SUM(valore_economico),0) as valore_totale
          FROM ImpattoCO2
        `);

        // Stima acqua risparmiata (500 L per kg di cibo salvato)
        const kgRes = await connection.get(`
          SELECT COALESCE(SUM(CASE 
                   WHEN unita_misura = 'kg' THEN quantita
                   WHEN unita_misura = 'g' THEN quantita/1000.0
                   WHEN unita_misura = 'l' THEN quantita*1.0
                   WHEN unita_misura = 'ml' THEN quantita/1000.0
                   WHEN unita_misura = 'pz' THEN quantita*0.5
                   ELSE quantita END),0) as kg
          FROM Lotti
        `);
        const acquaStimata = (kgRes?.kg || 0) * 500.0;

        // Inserisci statistiche
        await connection.run(`
          INSERT INTO StatisticheGiornaliere (
            data_statistica,
            totale_lotti,
            lotti_verdi,
            lotti_arancioni,
            lotti_rossi,
            quantita_totale,
            totale_prenotazioni,
            prenotazioni_attive,
            prenotazioni_consegnate,
            prenotazioni_annullate,
            totale_utenti,
            utenti_operatori,
            utenti_amministratori,
            utenti_utenti,
            co2_risparmiata_kg,
            acqua_risparmiata_l,
            valore_economico
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (data_statistica) DO UPDATE SET
            totale_lotti = EXCLUDED.totale_lotti,
            lotti_verdi = EXCLUDED.lotti_verdi,
            lotti_arancioni = EXCLUDED.lotti_arancioni,
            lotti_rossi = EXCLUDED.lotti_rossi,
            quantita_totale = EXCLUDED.quantita_totale,
            totale_prenotazioni = EXCLUDED.totale_prenotazioni,
            prenotazioni_attive = EXCLUDED.prenotazioni_attive,
            prenotazioni_consegnate = EXCLUDED.prenotazioni_consegnate,
            prenotazioni_annullate = EXCLUDED.prenotazioni_annullate,
            totale_utenti = EXCLUDED.totale_utenti,
            utenti_operatori = EXCLUDED.utenti_operatori,
            utenti_amministratori = EXCLUDED.utenti_amministratori,
            utenti_utenti = EXCLUDED.utenti_utenti,
            co2_risparmiata_kg = EXCLUDED.co2_risparmiata_kg,
            acqua_risparmiata_l = EXCLUDED.acqua_risparmiata_l,
            valore_economico = EXCLUDED.valore_economico
        `, [
          oggi,
          statsLotti?.totale_lotti || 0,
          statsLotti?.lotti_verdi || 0,
          statsLotti?.lotti_arancioni || 0,
          statsLotti?.lotti_rossi || 0,
          statsLotti?.quantita_totale || 0,
          statsPrenotazioni?.totale_prenotazioni || 0,
          statsPrenotazioni?.prenotazioni_attive || 0,
          statsPrenotazioni?.prenotazioni_consegnate || 0,
          statsPrenotazioni?.prenotazioni_annullate || 0,
          statsAttori?.totale_utenti || 0,
          statsAttori?.utenti_operatori || 0,
          statsAttori?.utenti_amministratori || 0,
          statsAttori?.utenti_utenti || 0,
          impatto?.co2_totale || 0,
          acquaStimata || 0,
          impatto?.valore_totale || 0
        ]);

        await connection.commit();
        logger.info('Statistiche giornaliere raccolte con successo');
      } catch (error) {
        await connection.rollback();
        logger.error(`Errore nella raccolta delle statistiche: ${error.message}`);
      } finally {
        connection.release();
      }
    });

    this.jobs.push(job);
  }

  /**
   * Cleanup segnalazioni CHIUSE con aggiornato_il <= now - retentionDays
   * Default: tutti i giorni alle 03:00, retention 7 giorni
   */
  setupSegnalazioniCleanup(retentionDays = 7) {
    const schedule = process.env.SEGNALAZIONI_CLEANUP_CRON || '0 3 * * *';
    const days = Number(process.env.SEGNALAZIONI_RETENTION_DAYS || retentionDays);

    let running = false;

    const job = cron.schedule(schedule, async () => {
      if (running) {
        logger.warn('Cleanup segnalazioni: job già in esecuzione, salto questo giro');
        return;
      }
      running = true;

      try {
        const { deleted } = await segnalazioniService.cleanupSegnalazioniChiuse(days * 24 * 60);
        logger.info(`Cleanup segnalazioni: eliminate ${deleted} segnalazioni chiuse da >= ${days} giorni`);
      } catch (err) {
        logger.error(`Cleanup segnalazioni: errore durante il cleanup - ${err.message}`);
      } finally {
        running = false;
      }
    });

    this.jobs.push(job);
    logger.info(`Scheduler cleanup segnalazioni configurato (cron="${schedule}", retention=${days} giorni)`);
  }

  /**
   * Arresta tutti i job pianificati
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    logger.info('Scheduler arrestato');
  }
}

module.exports = new Scheduler(); 
