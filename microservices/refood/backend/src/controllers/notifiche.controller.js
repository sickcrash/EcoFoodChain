const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Funzione di utilit� per trovare automaticamente un centro valido e gli amministratori associati
 * Pu� essere usata per test automatici o per implementare logiche che non dipendono da ID specifici
 * @returns {Promise<{centro: Object, amministratori: Array}>} Un oggetto con il centro e i suoi amministratori
 */
async function trovaTipoUtenteConAmministratori() {
  try {
    // Prima troviamo tutti i centri
    const centri = await db.all(`
      SELECT c.id, c.tipo, c.indirizzo,
        (SELECT COUNT(*) FROM AttoriTipoUtente uc 
         JOIN Attori u ON uc.attore_id = u.id 
         WHERE uc.tipo_utente_id = c.id AND u.ruolo = 'Amministratore') AS num_amministratori
      FROM Tipo_Utente c
      ORDER BY num_amministratori DESC
    `);
    
    if (!centri || centri.length === 0) {
      logger.warn('Nessun centro trovato nel database');
      return null;
    }
    
    // Prendiamo il primo centro che ha amministratori associati
    const centro = centri.find(c => c.num_amministratori > 0) || centri[0];
    
    // Troviamo gli amministratori associati a questo centro
    const amministratori = await db.all(`
      SELECT u.id, u.nome, u.cognome, u.email
      FROM Attori u
      JOIN AttoriTipoUtente uc ON u.id = uc.attore_id
      WHERE uc.tipo_utente_id = ? AND u.ruolo = 'Amministratore'
    `, [centro.id]);
    
    logger.info(`Trovato centro ID ${centro.id} con ${amministratori.length} amministratori associati`);
    
    return {
      centro,
      amministratori
    };
  } catch (error) {
    logger.error(`Errore nella ricerca di un centro con amministratori: ${error.message}`);
    return null;
  }
}

/**
 * Ottiene tutte le notifiche per l'attore corrente
 * con supporto per paginazione e filtri
 */
exports.getNotifiche = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, tipo, priorita, letta, sort = 'creato_il', order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;
    
    logger.info(`Richiesta notifiche per attore ${userId} con filtri: ${JSON.stringify(req.query)}`);
    
    // Costruzione filtri per ruolo
    const ruolo = req.user.ruolo;
    const tipoUtente = (req.user.tipo_utente || '').toUpperCase();
    const where = [];
    const params = [];
    let join = '';

    if (ruolo === 'Amministratore') {
      // Admin vede tutto
      where.push('n.eliminato = false');
    } else if (ruolo === 'Operatore') {
      // Operatore: solo notifiche relative ai lotti o indirizzate direttamente
      // Importante: in Postgres le stringhe vanno tra apici singoli, non doppi
      where.push("(n.destinatario_id = ? OR UPPER(n.riferimento_tipo) = 'LOTTO')");
      params.push(userId);
      where.push('n.eliminato = false');
    } else if (ruolo === 'OperatoreCentro') {
      // Centro associato: solo notifiche di segnalazioni e relative ai centri associati
      const righe = await db.all('SELECT tipo_utente_id FROM AttoriTipoUtente WHERE attore_id = ?', [userId]);
      const ids = righe.map(r => r.tipo_utente_id);
      if (ids.length > 0) {
        where.push("UPPER(n.riferimento_tipo) = 'SEGNALAZIONE'");
        where.push(`(n.tipo_utente_id IN (${ids.map(_=>'?').join(',')}))`);
        params.push(...ids);
        where.push('n.eliminato = false');
      } else {
        // Nessun centro associato: nessun risultato
        where.push('1=0');
      }
    } else {
      // Utente finale: solo notifiche sui lotti del proprio stato e prenotazioni/ritiri
      where.push("UPPER(n.riferimento_tipo) = 'LOTTO'");
      // Unisci a Lotti per filtrare per stato
      join = ' LEFT JOIN Lotti l ON l.id = n.riferimento_id ';
      if (tipoUtente === 'PRIVATO') where.push("UPPER(l.stato) = 'VERDE'");
      else if (tipoUtente === 'CANALE SOCIALE') where.push("UPPER(l.stato) = 'ARANCIONE'");
      else if (tipoUtente === 'CENTRO RICICLO') where.push("UPPER(l.stato) = 'ROSSO'");
      // E include notifiche di tipo Prenotazione/CambioStato per ritiro/conferma
      where.push("n.tipo IN ('Prenotazione','CambioStato','Alert')");
      where.push('n.eliminato = false');
      // Mantieni anche notifiche indirizzate direttamente all'utente
      where.push('(n.destinatario_id = ? OR n.destinatario_id IS NULL)');
      params.push(userId);
    }

    // Filtri aggiuntivi opzionali
    if (tipo) { where.push('n.tipo = ?'); params.push(tipo); }
    if (priorita) { where.push('n.priorita = ?'); params.push(priorita); }
    if (letta === 'true') where.push('n.letto = true');
    if (letta === 'false') where.push('n.letto = false');

    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    const baseFrom = `FROM Notifiche n ${join} LEFT JOIN Attori u ON n.origine_id = u.id LEFT JOIN Tipo_Utente c ON n.tipo_utente_id = c.id`;

    const totale = await db.get(`SELECT COUNT(*) as total ${baseFrom} ${whereSql}`, params);

    const notifiche = await db.all(`
      SELECT n.*, u.nome AS origine_nome, u.cognome AS origine_cognome, c.tipo AS centro_nome
      ${baseFrom}
      ${whereSql}
      ORDER BY n.${sort} ${order} LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    // Formattazione della risposta
    const formattedNotifiche = notifiche.map(n => ({
      id: n.id,
      titolo: n.titolo,
      messaggio: n.messaggio,
      tipo: n.tipo,
      priorita: n.priorita,
      letta: !!n.letto,
      data: n.creato_il,
      dataCreazione: n.creato_il,
      dataLettura: n.data_lettura,
      origine: n.origine_id ? {
        id: n.origine_id,
        nome: `${n.origine_nome || ''} ${n.origine_cognome || ''}`.trim()
      } : null,
      centro: n.tipo_utente_id ? {
        id: n.tipo_utente_id,
        nome: n.centro_nome
      } : null,
      riferimento: n.riferimento_id ? {
        id: n.riferimento_id,
        tipo: n.riferimento_tipo
      } : null
    }));
    
    logger.info(`Restituite ${formattedNotifiche.length} notifiche per l'attore ${userId}`);
    
    res.json({
      data: formattedNotifiche,
      pagination: {
        total: totale.total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totale.total / limit)
      }
    });
  } catch (error) {
    logger.error(`Errore nel recupero delle notifiche: ${error.message}`);
    next(new ApiError(500, 'Errore nel recupero delle notifiche'));
  }
};

/**
 * Ottiene il dettaglio di una notifica specifica
 */
exports.getNotificaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.ruolo === 'Amministratore';

    logger.info(`Richiesta dettaglio notifica ${id} per attore ${userId}`);
    
    // Controllo dei permessi: un attore pu� vedere solo le proprie notifiche
    let query = `
      SELECT 
        n.*,
        u.nome AS origine_nome,
        u.cognome AS origine_cognome,
        c.tipo AS centro_nome
      FROM Notifiche n
      LEFT JOIN Attori u ON n.origine_id = u.id
      LEFT JOIN Tipo_Utente c ON n.tipo_utente_id = c.id
      WHERE n.id = ? AND n.eliminato = false
    `;

    const params = [id];

    if (!isAdmin) {
      query += ' AND n.destinatario_id = ?';
      params.push(userId);
    }
    
    const notifica = await db.get(query, params);
    
    if (!notifica) {
      logger.warn(`Notifica ${id} non trovata o non accessibile per l'attore ${userId}`);
      return next(new ApiError(404, 'Notifica non trovata'));
    }
    
    // Formattazione della notifica
    const formattedNotifica = {
      id: notifica.id,
      titolo: notifica.titolo,
      messaggio: notifica.messaggio,
      tipo: notifica.tipo,
      priorita: notifica.priorita,
      letta: !!notifica.letto,
      data: notifica.creato_il,
      dataCreazione: notifica.creato_il,
      dataLettura: notifica.data_lettura,
      origine: notifica.origine_id ? {
        id: notifica.origine_id,
        nome: `${notifica.origine_nome || ''} ${notifica.origine_cognome || ''}`.trim()
      } : null,
      centro: notifica.tipo_utente_id ? {
        id: notifica.tipo_utente_id,
        nome: notifica.centro_nome
      } : null,
      riferimento: notifica.riferimento_id ? {
        id: notifica.riferimento_id,
        tipo: notifica.riferimento_tipo
      } : null
    };
    
    res.json({ data: formattedNotifica });
    
  } catch (error) {
    logger.error(`Errore nel recupero della notifica ${req.params.id}: ${error.message}`);
    next(new ApiError(500, 'Errore nel recupero della notifica'));
  }
};

/**
 * Crea una nuova notifica per un attore
 * @param {number} destinatario_id - ID dell'attore destinatario
 * @param {string} tipo - Tipo di notifica (deve essere uno dei valori consentiti: 'CambioStato', 'Prenotazione', 'Alert')
 * @param {string} titolo - Titolo della notifica
 * @param {string} messaggio - Testo del messaggio
 * @param {string} [link=null] - Link opzionale associato alla notifica
 * @param {object} [datiExtra=null] - Dati aggiuntivi opzionali
 * @returns {Promise<object|null>} Notifica creata o null in caso di errore
 */
exports.creaNotifica = async function(destinatario_id, tipo, titolo, messaggio, link = null, datiExtra = null) {
  try {
    logger.info(`[NOTIFICA] Creazione notifica per attore ${destinatario_id}: ${titolo}`);
    logger.debug(`[NOTIFICA] Dettagli: tipo=${tipo}, destinatario=${destinatario_id}, titolo=${titolo}`);
    
    if (!destinatario_id || !tipo || !titolo || !messaggio) {
      logger.error('[NOTIFICA] ? Parametri mancanti nella creazione della notifica');
      logger.error(`[NOTIFICA] ? Parametri ricevuti: destinatario=${destinatario_id}, tipo=${tipo}, titolo=${Boolean(titolo)}, messaggio=${Boolean(messaggio)}`);
      return null;
    }
    
    // Verifica che l'attore esista
    logger.debug(`[NOTIFICA] Verifica esistenza attore ID ${destinatario_id}...`);
    const userResult = await db.get(`SELECT id FROM Attori WHERE id = ?`, [destinatario_id]);
    
    if (!userResult) {
      logger.error(`[NOTIFICA] ? Impossibile creare notifica: destinatario con ID ${destinatario_id} non trovato`);
      return null;
    }
    
    logger.debug(`[NOTIFICA] ? Attore ID ${destinatario_id} trovato`);
    
    // Mappa il tipo a un valore consentito per il vincolo CHECK
    let tipoEffettivo = tipo;
    
    // Verifica se il tipo � tra quelli consentiti
    const tipiConsentiti = ['CambioStato', 'Prenotazione', 'Alert'];
    if (!tipiConsentiti.includes(tipo)) {
      logger.warn(`[NOTIFICA] ?? Tipo di notifica '${tipo}' non valido. Utilizzando 'Alert' come fallback.`);
      // Mappa i nuovi tipi a 'Alert' per compatibilit� 
      if (tipo === 'LottoCreato' || tipo === 'LottoModificato' || tipo === 'info' || tipo === 'warning' || tipo === 'success' || tipo === 'error') {
        tipoEffettivo = 'Alert';
      } else {
        tipoEffettivo = 'Alert'; // Valore di default per tutti i tipi non riconosciuti
      }
    }
    
    // Crea notifica nel DB
    
    // Normalizza datiExtra: accetta stringhe o oggetti
    let datiExtraObj = datiExtra;
    if (typeof datiExtraObj === 'string') {
      try {
        datiExtraObj = JSON.parse(datiExtraObj);
      } catch (_) {
        datiExtraObj = null;
      }
    }

    if (link) {
      const linkValue = String(link);
      if (datiExtraObj && typeof datiExtraObj === 'object') {
        datiExtraObj.link = datiExtraObj.link || linkValue;
      } else {
        datiExtraObj = { link: linkValue };
      }
    }

    const datiExtraJson = datiExtraObj ? JSON.stringify(datiExtraObj) : null;

    let rifId = null;
    let rifTipo = null;
    if (datiExtraObj && typeof datiExtraObj === 'object') {
      const pren = Number(datiExtraObj.prenotazioneId);
      const lotto = Number(datiExtraObj.lottoId ?? datiExtraObj.lotto_id);
      if (Number.isInteger(pren)) {
        rifId = pren;
        rifTipo = 'prenotazione';
      } else if (Number.isInteger(lotto)) {
        rifId = lotto;
        rifTipo = 'lotto';
      }
    }

    try {
      logger.debug(`[NOTIFICA] Inserimento notifica nel database: destinatario=${destinatario_id}, tipo=${tipoEffettivo}`);
      
      // Assicura la presenza del campo JSON per dati extra
      await db.run(`ALTER TABLE Notifiche ADD COLUMN IF NOT EXISTS dati_extra JSONB`);
      // Inserimento notifica (PostgreSQL)
      const insertQuery = `
        INSERT INTO Notifiche (destinatario_id, tipo, titolo, messaggio, riferimento_id, riferimento_tipo, dati_extra, creato_il)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW()) RETURNING id
      `;
      const result = await db.run(
        insertQuery, 
        [destinatario_id, tipoEffettivo, titolo, messaggio, rifId, rifTipo, datiExtraJson]
      );
      
      if (!result || !result.lastID) {
        logger.error(`[NOTIFICA] ? Errore nell'inserimento della notifica nel database per l'attore ${destinatario_id}`);
        logger.error(`[NOTIFICA] ? Risultato query: ${JSON.stringify(result)}`);
        return null;
      }
      
      logger.info(`[NOTIFICA] ? Notifica creata nel DB per attore ${destinatario_id}, ID: ${result.lastID}`);
      
      // Recupera la notifica appena creata
      logger.debug(`[NOTIFICA] Recupero la notifica appena creata (ID: ${result.lastID})...`);
      
      const notifica = await db.get(
        `SELECT * FROM Notifiche WHERE id = ?`,
        [result.lastID]
      );
      
      if (!notifica) {
        logger.error(`[NOTIFICA] ? Notifica creata ma non recuperata dal DB, ID: ${result.lastID}`);
        return null;
      }
      
      logger.debug(`[NOTIFICA] ? Notifica recuperata dal DB: ID=${notifica.id}`);
      
      // Invia la notifica tramite WebSocket se disponibile
      try {
        logger.debug(`[NOTIFICA] Tentativo di invio WebSocket per notifica ID: ${notifica.id}`);
        const webSocketService = require('../utils/websocket');
        
        if (webSocketService && typeof webSocketService.inviaNotifica === 'function') {
          await webSocketService.inviaNotifica(destinatario_id, notifica);
          logger.info(`[NOTIFICA] ? Notifica inviata via WebSocket all'attore ${destinatario_id}`);
        } else {
          logger.warn(`[NOTIFICA] ?? Servizio WebSocket non disponibile per l'invio della notifica ID: ${notifica.id}`);
          logger.warn(`[NOTIFICA] ?? WebSocket Service: ${typeof webSocketService}`);
          if (webSocketService) {
            logger.warn(`[NOTIFICA] ?? Metodi disponibili: ${Object.keys(webSocketService).join(', ')}`);
          }
        }
      } catch (wsError) {
        logger.error(`[NOTIFICA] ? Errore nell'invio della notifica via WebSocket: ${wsError.message}`);
        logger.error(`[NOTIFICA] ? WebSocket error stack: ${wsError.stack}`);
        // Continuiamo comunque dato che la notifica � stata salvata nel DB
      }
      
      return notifica;
    } catch (queryError) {
      logger.error(`[NOTIFICA] ? Errore SQL nella creazione della notifica: ${queryError.message}`);
      logger.error(`[NOTIFICA] ? SQL error stack: ${queryError.stack}`);
      return null;
    }
  } catch (error) {
    logger.error(`[NOTIFICA] ? Errore generale nella creazione della notifica: ${error.message}`);
    logger.error(`[NOTIFICA] ? Stack trace: ${error.stack}`);
    return null;
  }
};

/**
 * Segna una notifica come letta
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    logger.info(`Richiesta di segnare come letta la notifica ${id} per l'attore ${userId}`);
    
    // Verifica che la notifica esista e appartenga all'attore
    const selectQuery = isAdmin
      ? 'SELECT id, letto FROM Notifiche WHERE id = ? AND eliminato = 0'
      : 'SELECT id, letto FROM Notifiche WHERE id = ? AND destinatario_id = ? AND eliminato = 0';

    const notifica = await db.get(
      selectQuery,
      isAdmin ? [id] : [id, userId]
    );
    
    if (!notifica) {
      return next(new ApiError(404, 'Notifica non trovata'));
    }
    
    // Se la notifica � gi� stata letta, non fare nulla
    if (notifica.letto) {
      return res.json({
        success: true,
        message: 'La notifica era gi� stata segnata come letta'
      });
    }
    
    // Aggiorna lo stato della notifica
    await db.run(
      'UPDATE Notifiche SET letto = 1, data_lettura = datetime("now") WHERE id = ?',
      [id]
    );
    
    logger.info(`Notifica ${id} segnata come letta`);
    
    res.json({
      success: true,
      message: 'Notifica segnata come letta'
    });
    
  } catch (error) {
    logger.error(`Errore nel segnare come letta la notifica ${req.params.id}: ${error.message}`);
    next(new ApiError(500, 'Errore nel segnare la notifica come letta'));
  }
};

/**
 * Segna tutte le notifiche come lette
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    logger.info(`Richiesta di segnare tutte le notifiche come lette per l'attore ${userId}`);
    
    // Aggiorna tutte le notifiche non lette dell'attore
    const result = await db.run(
      'UPDATE Notifiche SET letto = 1, data_lettura = datetime("now") WHERE destinatario_id = ? AND letto = 0 AND eliminato = 0',
      [userId]
    );
    
    logger.info(`${result.changes || 0} notifiche segnate come lette per l'attore ${userId}`);
    
    res.json({
      success: true,
      message: `${result.changes || 0} notifiche segnate come lette`
    });
    
  } catch (error) {
    logger.error(`Errore nel segnare tutte le notifiche come lette: ${error.message}`);
    next(new ApiError(500, 'Errore nel segnare tutte le notifiche come lette'));
  }
};

/**
 * Elimina una notifica (soft delete)
 */
exports.deleteNotifica = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.ruolo === 'Amministratore';
    
    logger.info(`Richiesta di eliminazione della notifica ${id} per l'attore ${userId}`);
    
    // Verifica che la notifica esista e appartenga all'attore
    const selectQuery = isAdmin
      ? 'SELECT id, eliminato FROM Notifiche WHERE id = ?'
      : 'SELECT id, eliminato FROM Notifiche WHERE id = ? AND destinatario_id = ?';

    const notifica = await db.get(
      selectQuery,
      isAdmin ? [id] : [id, userId]
    );
    
    if (!notifica) {
      return next(new ApiError(404, 'Notifica non trovata'));
    }
    
    // Se la notifica � gi� stata eliminata, non fare nulla
    if (notifica.eliminato) {
      return res.json({
        success: true,
        message: 'La notifica era gi� stata eliminata'
      });
    }
    
    // Soft delete della notifica
    await db.run(
      'UPDATE Notifiche SET eliminato = 1 WHERE id = ?',
      [id]
    );
    
    logger.info(`Notifica ${id} eliminata (soft delete)`);
    
    res.json({
      success: true,
      message: 'Notifica eliminata con successo'
    });
    
  } catch (error) {
    logger.error(`Errore nell'eliminazione della notifica ${req.params.id}: ${error.message}`);
    next(new ApiError(500, 'Errore nell\'eliminazione della notifica'));
  }
};

/**
 * Invia una notifica a tutti gli amministratori di un centro
 * @param {number} centroId - ID del centro
 * @param {string} tipo - Tipo di notifica (verr� mappato a uno dei valori consentiti: 'CambioStato', 'Prenotazione', 'Alert')
 * @param {string} titolo - Titolo della notifica
 * @param {string} messaggio - Testo della notifica
 * @param {string} [link] - Link opzionale associato alla notifica
 * @param {object} [datiExtra] - Dati aggiuntivi in formato JSON
 * @param {number} [operatoreId] - ID dell'operatore che ha effettuato l'azione (per includerlo tra i destinatari)
 * @returns {Promise<number[]>} Array di ID delle notifiche create
 */
exports.notificaAdminTipoUtente = async (centroId, tipo, titolo, messaggio, link = null, datiExtra = null, operatoreId = null) => {
  try {
    // Mappa il tipo di notifica a un valore consentito
    let tipoEffettivo = tipo;
    // Verifica se il tipo � tra quelli consentiti dal database
    const tipiConsentiti = ['CambioStato', 'Prenotazione', 'Alert'];
    if (!tipiConsentiti.includes(tipo)) {
      logger.info(`Mappatura tipo notifica: '${tipo}' -> 'Alert' per conformit� con vincolo database`);
      // Per compatibilit� con il codice esistente, mappiamo i tipi vecchi su 'Alert'
      if (tipo === 'LottoCreato' || tipo === 'LottoModificato' || tipo === 'info' || tipo === 'warning' || tipo === 'success' || tipo === 'error') {
        tipoEffettivo = 'Alert';
      } else {
        tipoEffettivo = 'Alert'; // Valore di default per tutti i tipi non riconosciuti
      }
    }
    
    // Trova gli amministratori del centro
    const amministratori = await db.all(`
      SELECT u.id
      FROM Attori u
      JOIN AttoriTipoUtente uc ON u.id = uc.attore_id
      WHERE uc.tipo_utente_id = ? AND u.ruolo = 'Amministratore'
    `, [centroId]);
    
    if (!amministratori || amministratori.length === 0) {
      logger.warn(`Nessun amministratore trovato per il centro ID ${centroId}`);
      
      // Se non ci sono amministratori ma c'� un operatore, invia comunque la notifica all'operatore
      if (operatoreId) {
        const notificaId = await exports.creaNotifica(operatoreId, tipo, titolo, messaggio, link, datiExtra);
        logger.info(`Inviata notifica ID ${notificaId} all'operatore ${operatoreId} (nessun amministratore trovato)`);
        return [notificaId];
      }
      return [];
    }
    
    // Crea una notifica per ogni amministratore
    const idNotifiche = [];
    const destinatariUnici = new Set();
    
    // Aggiungi gli amministratori come destinatari
    for (const admin of amministratori) {
      // Evita duplicati nel caso l'operatore sia anche amministratore
      if (!destinatariUnici.has(admin.id)) {
        destinatariUnici.add(admin.id);
        const notificaId = await exports.creaNotifica(admin.id, tipoEffettivo, titolo, messaggio, link, datiExtra);
        if (notificaId) {
          idNotifiche.push(notificaId);
        }
      }
    }
    
    // Se � stato specificato un operatore, invia anche a lui la notifica
    if (operatoreId && !destinatariUnici.has(operatoreId)) {
      destinatariUnici.add(operatoreId);
      
      // Personalizza il messaggio per l'operatore (opzionale)
      const messaggioOperatore = messaggio.replace(/L'operatore .* ha /, 'Hai ');
      
      const notificaId = await exports.creaNotifica(operatoreId, tipoEffettivo, titolo, messaggioOperatore, link, datiExtra);
      if (notificaId) {
        idNotifiche.push(notificaId);
        logger.info(`Inviata notifica ID ${notificaId} all'operatore ${operatoreId}`);
      }
    }
    
    logger.info(`Inviate ${idNotifiche.length} notifiche: ${idNotifiche.length - (operatoreId ? 1 : 0)} amministratori del centro ID ${centroId} e ${operatoreId ? 1 : 0} operatori`);
    return idNotifiche;
  } catch (error) {
    logger.error(`Errore nell'invio notifiche agli amministratori/operatori del centro ID ${centroId}: ${error.message}`);
    throw error;
  }
};

/**
 * Conta le notifiche non lette per l'attore corrente
 */
exports.countUnread = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    logger.info(`Richiesta conteggio notifiche non lette per l'attore ${userId}`);
    
    const result = await db.get(
      'SELECT COUNT(*) as count FROM Notifiche WHERE destinatario_id = ? AND letto = 0 AND eliminato = 0',
      [userId]
    );
    
    const count = result ? result.count : 0;
    
    logger.info(`${count} notifiche non lette per l'attore ${userId}`);
    
    res.json({ count });
    
  } catch (error) {
    logger.error(`Errore nel conteggio delle notifiche non lette: ${error.message}`);
    next(new ApiError(500, 'Errore nel conteggio delle notifiche non lette'));
  }
};

/**
 * Sincronizza una notifica locale con il server
 */
exports.syncLocalNotifica = async (req, res, next) => {
  try {
    const { 
      titolo, 
      messaggio, 
      tipo = 'Alert', 
      priorita = 'Media',
      letta = false,
      dataCreazione
    } = req.body;
    
    const userId = req.user.id;
    
    logger.info(`Richiesta di sincronizzazione notifica locale per l'attore ${userId}`);
    
    // Validazione dei dati
    if (!titolo || !messaggio) {
      return next(new ApiError(400, 'Titolo e messaggio sono campi obbligatori'));
    }
    
    // Inserimento della notifica nel database
    const insertQuery = `
      INSERT INTO Notifiche (
        titolo, 
        messaggio, 
        tipo, 
        priorita, 
        destinatario_id,
        origine_id,
        letto,
        data_lettura,
        creato_il
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const lettoValue = !!letta;
    const dataLetturaValue = letta ? new Date().toISOString() : null;
    const dataCreataValue = dataCreazione || new Date().toISOString();
    
    const result = await db.run(
      insertQuery, 
      [
        titolo, 
        messaggio, 
        tipo, 
        priorita, 
        userId, 
        userId,
        lettoValue,
        dataLetturaValue,
        dataCreataValue
      ]
    );
    
    if (!result || !result.lastID) {
      return next(new ApiError(500, 'Errore nella sincronizzazione della notifica'));
    }
    
    logger.info(`Sincronizzata notifica locale con ID ${result.lastID} per l'attore ${userId}`);
    
    // Recupero della notifica completa
    const notifica = await db.get(
      'SELECT * FROM Notifiche WHERE id = ?',
      [result.lastID]
    );
    
    // Formattazione della risposta
    const formattedNotifica = {
      id: notifica.id,
      titolo: notifica.titolo,
      messaggio: notifica.messaggio,
      tipo: notifica.tipo,
      priorita: notifica.priorita,
      letta: !!notifica.letto,
      dataCreazione: notifica.creato_il,
      dataLettura: notifica.data_lettura
    };
    
    res.status(201).json({
      success: true,
      message: 'Notifica sincronizzata con successo',
      data: formattedNotifica
    });
    
  } catch (error) {
    logger.error(`Errore nella sincronizzazione della notifica: ${error.message}`);
    logger.error('Stack errore:', error.stack);
    logger.error('Dettagli errore:', JSON.stringify(error));
    
    return res.status(500).json({
      status: 'error',
      message: 'Errore nella sincronizzazione della notifica',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Restituisce un centro valido per i test di notifica
 * Utile per il client mobile per ottenere un tipo_utente_id valido
 * per testare l'invio di notifiche agli amministratori
 */
exports.getTipoUtenteTestNotifiche = async (req, res, next) => {
  try {
    const risultato = await trovaTipoUtenteConAmministratori();
    
    if (!risultato) {
      return next(new ApiError(404, 'Nessun centro con amministratori trovato'));
    }
    
    // Formatta la risposta includendo solo le informazioni essenziali
    const response = {
      centro: {
        id: risultato.centro.id,
        nome: risultato.centro.nome,
        tipo: risultato.centro.tipo,
        num_amministratori: risultato.amministratori.length
      },
      amministratori: risultato.amministratori.map(admin => ({
        id: admin.id,
        nome: `${admin.nome} ${admin.cognome}`.trim(),
        email: admin.email
      }))
    };
    
    logger.info(`Restituito centro di test ID ${risultato.centro.id} con ${risultato.amministratori.length} amministratori`);
    
    res.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    logger.error(`Errore nel recupero del centro di test: ${error.message}`);
    next(new ApiError(500, 'Errore nel recupero del centro di test'));
  }
};

/**
 * Invia una notifica a tutti gli amministratori di un centro
 */
exports.notifyAdmins = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const { tipo_utente_id } = req.params;
    const { 
      titolo, 
      messaggio, 
      tipo = 'LottoModificato', 
      priorita = 'Media',
      riferimento_id,
      riferimento_tipo
    } = req.body;
    
    logger.info(`Richiesta di invio notifica agli amministratori del centro ${tipo_utente_id}`);
    
    // Validazione dei dati obbligatori
    if (!titolo || !messaggio) {
      await connection.rollback();
      return next(new ApiError(400, 'Titolo e messaggio sono campi obbligatori'));
    }
    
    // Verifica che il centro esista
    const centro = await connection.get('SELECT id FROM Tipo_Utente WHERE id = ?', [tipo_utente_id]);
    if (!centro) {
      await connection.rollback();
      return next(new ApiError(404, 'TipoUtente non trovato'));
    }
    
    // Trova gli amministratori del centro
    const query = `
      SELECT u.id 
      FROM Attori u
      JOIN AttoriTipoUtente uc ON u.id = uc.attore_id
      WHERE uc.tipo_utente_id = ? 
      AND u.ruolo = 'Amministratore'
    `;
    
    const amministratori = await connection.all(query, [tipo_utente_id]);
    
    if (!amministratori || amministratori.length === 0) {
      logger.warn(`Nessun amministratore trovato per il centro ${tipo_utente_id}`);
      await connection.rollback();
      return res.status(200).json({
        success: true,
        message: 'Nessun amministratore trovato per questo centro',
        notifiche_inviate: 0
      });
    }
    
    // L'attore corrente � l'origine della notifica
    const origine_id = req.user.id;
    
    // Inserisci una notifica per ogni amministratore
    const insertQuery = `
      INSERT INTO Notifiche (
        titolo, 
        messaggio, 
        tipo, 
        priorita, 
        destinatario_id,
        origine_id,
        riferimento_id,
        riferimento_tipo,
        tipo_utente_id,
        creato_il
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    
    let notificheInviate = 0;
    
    for (const admin of amministratori) {
      try {
        // Salta l'invio se l'amministratore � l'attore stesso che sta creando la notifica
        if (admin.id === origine_id) {
          logger.info(`Saltato invio a se stessi (admin ${admin.id})`);
          continue;
        }
        
        const result = await connection.run(
          insertQuery, 
          [
            titolo, 
            messaggio, 
            tipo, 
            priorita, 
            admin.id, // destinatario
            origine_id, // origine
            riferimento_id || null,
            riferimento_tipo || null,
            tipo_utente_id
          ]
        );
        
        if (result && result.lastID) {
          notificheInviate++;
          logger.info(`Notifica inviata all'amministratore ${admin.id}`);
        }
      } catch (insertError) {
        logger.error(`Errore nell'invio della notifica all'amministratore ${admin.id}: ${insertError.message}`);
        // Continua con gli altri amministratori
      }
    }
    
    // Commit della transazione
    await connection.commit();
    
    logger.info(`Inviate ${notificheInviate} notifiche agli amministratori del centro ${tipo_utente_id}`);
    
    res.status(200).json({
      success: true,
      message: `Inviate ${notificheInviate} notifiche agli amministratori`,
      notifiche_inviate: notificheInviate
    });
    
  } catch (error) {
    await connection.rollback();
    logger.error(`Errore nell'invio delle notifiche agli amministratori: ${error.message}`);
    next(new ApiError(500, 'Errore nell\'invio delle notifiche agli amministratori'));
  } finally {
    connection.release();
  }
};

/**
 * Crea una nuova notifica
 */
exports.createNotifica = async (req, res, next) => {
  try {
    const {
      titolo,
      messaggio,
      tipo = 'Alert',
      priorita = 'Media',
      destinatario_id,
      riferimento_id,
      riferimento_tipo,
      tipo_utente_id
    } = req.body;

    // Se destinatario_id manca, usa l'utente autenticato come destinatario di default
    const destinatarioEffettivo = destinatario_id || (req.user && req.user.id);

    // Validazione dei dati obbligatori
    if (!titolo || !messaggio || !destinatarioEffettivo) {
      return next(new ApiError(400, 'Titolo, messaggio e destinatario_id sono campi obbligatori'));
    }
    
    // Verifica che il destinatario esista
    const destinatario = await db.get('SELECT id FROM Attori WHERE id = ?', [destinatarioEffettivo]);
    if (!destinatario) {
      return next(new ApiError(404, 'Destinatario non trovato'));
    }
    
    // L'attore corrente � l'origine della notifica
    const origine_id = req.user.id;
    
    // Inserimento della notifica nel database
    const insertQuery = `
      INSERT INTO Notifiche (
        titolo, 
        messaggio, 
        tipo, 
        priorita, 
        destinatario_id,
        origine_id,
        riferimento_id,
        riferimento_tipo,
        tipo_utente_id,
        creato_il
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    
    const result = await db.run(
      insertQuery, 
      [
        titolo,
        messaggio,
        tipo,
        priorita,
        destinatarioEffettivo,
        origine_id,
        riferimento_id || null,
        riferimento_tipo || null,
        tipo_utente_id || null
      ]
    );
    
    if (!result || !result.lastID) {
      return next(new ApiError(500, 'Errore nella creazione della notifica'));
    }
    
    logger.info(`Creata notifica con ID ${result.lastID} per l'attore ${destinatario_id}`);
    
    // Recupero della notifica completa
    const notifica = await db.get(
      'SELECT * FROM Notifiche WHERE id = ?',
      [result.lastID]
    );
    
    // Formattazione della risposta
    const formattedNotifica = {
      id: notifica.id,
      titolo: notifica.titolo,
      messaggio: notifica.messaggio,
      tipo: notifica.tipo,
      priorita: notifica.priorita,
      letta: !!notifica.letto,
      dataCreazione: notifica.creato_il
    };
    
    res.status(201).json({
      success: true,
      message: 'Notifica creata con successo',
      data: formattedNotifica
    });
    
  } catch (error) {
    logger.error(`Errore nella creazione della notifica: ${error.message}`);
    next(new ApiError(500, 'Errore nella creazione della notifica'));
  }
};

module.exports.trovaTipoUtenteConAmministratori = trovaTipoUtenteConAmministratori; 






