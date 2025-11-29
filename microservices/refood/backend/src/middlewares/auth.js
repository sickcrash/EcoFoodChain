const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const db = require('../config/database');
const logger = require('../utils/logger');
const { hashToken } = require('../utils/tokenUtils');

/**
 * Middleware per verificare il token JWT
 */
const authenticate = async (req, res, next) => {
  try {
    logger.debug(`AUTH: Inizio verifica autenticazione per la richiesta a ${req.originalUrl}`);
    // Ottiene il token dall'header della richiesta
    const authHeader = req.headers.authorization;
    logger.debug(`AUTH: Header Authorization presente=${Boolean(authHeader)}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.debug(`AUTH: Header di autorizzazione mancante o formato non valido per ${req.originalUrl}`);
      throw new ApiError(401, 'Autenticazione richiesta');
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      logger.debug(`AUTH: Token non fornito dopo lo split per ${req.originalUrl}`);
      throw new ApiError(401, 'Token non fornito');
    }
    
    logger.debug(`AUTH: Token JWT ricevuto per ${req.originalUrl}`);
    
    // Verifica il token
    logger.debug('AUTH: Verifica del token JWT in corso');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    logger.debug(`AUTH: Token JWT decodificato per attore: ${decoded.email || 'sconosciuto'}`);
    
    // Verifica nel database se il token e valido e non revocato
    logger.debug(`AUTH: Ricerca del token nel database per ${req.originalUrl}...`);
    const baseSql = `
      SELECT
        t.id AS token_id,
        t.access_token AS stored_access_token,
        t.access_token_hash,
        u.id,
        u.email, u.nome, u.cognome, u.ruolo,
        t.access_token_scadenza, t.revocato
      FROM TokenAutenticazione t
      JOIN Attori u ON t.attore_id = u.id
      WHERE __CLAUSE__
        AND t.access_token_scadenza > NOW()
        AND t.revocato = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM TokenRevocati tr
          WHERE tr.token_hash = ? OR tr.token_hash = ?
        )
    `;

    const jwtId = jwt.decode(token).jti || 'no-jti';
    logger.debug(`AUTH: JTI estratto dal token: ${jwtId}`);

    const tokenHash = hashToken(token);
    const decodedToken = jwt.decode(token);

    const searchVariants = [];
    if (tokenHash) {
      searchVariants.push({
        clause: 't.access_token_hash = ?',
        params: [tokenHash, tokenHash, jwtId],
        matchedValue: tokenHash,
      });
    }
    searchVariants.push({
      clause: 't.access_token = ?',
      params: [token, tokenHash, jwtId],
      matchedValue: token,
    });

    let row = null;
    let matchedValue = null;
    const runQuery = async (clause, params) => {
      const sqlWithSoft = baseSql.replace('__CLAUSE__', `${clause} AND COALESCE(u.disabilitato, FALSE) = FALSE`);
      const baseSqlClause = baseSql.replace('__CLAUSE__', clause);
      try {
        return await db.get(sqlWithSoft, params);
      } catch (e) {
        const msg = (e && e.message) || '';
        if (/column\s+u\.disabilitato\s+does\s+not\s+exist/i.test(msg) || /la colonna u\.disabilitato non esiste/i.test(msg)) {
          return await db.get(baseSqlClause, params);
        }
        throw e;
      }
    };

    for (const variant of searchVariants) {
      row = await runQuery(variant.clause, variant.params);
      if (row) {
        matchedValue = variant.matchedValue;
        break;
      }
    }

    if (row && tokenHash && matchedValue === token) {
      try {
        await db.run(
          `UPDATE TokenAutenticazione
             SET access_token = ?, access_token_hash = ?
           WHERE id = ?`,
          [tokenHash, tokenHash, row.token_id]
        );
        row.stored_access_token = tokenHash;
        row.access_token_hash = tokenHash;
      } catch (updateError) {
        logger.warn(`AUTH: impossibile aggiornare hash token legacy id=${row.token_id}: ${updateError.message}`);
      }
    }
    if (!row) {
      logger.debug(`AUTH: Token non trovato nel database o revocato per ${req.originalUrl}`);
      throw new ApiError(401, 'Token non valido o revocato');
    }
    
    // Salva le informazioni attore nell'oggetto request
    req.user = {
      id: row.id ?? row.user_id,
      email: row.email,
      nome: row.nome,
      cognome: row.cognome,
      ruolo: row.ruolo,
      tipo_utente: decodedToken.tipo_utente || null
    };
    
    logger.debug(`AUTH: Autenticazione riuscita per attore ${row.email} con ruolo ${row.ruolo}${req.user.tipo_utente ? `, tipo: ${req.user.tipo_utente}` : ''} per ${req.originalUrl}`);
    logger.debug('AUTH: Verifica del token JWT completata');
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      logger.error(`AUTH: Errore di validazione JWT: ${err.message}`);
      return next(new ApiError(401, 'Token JWT non valido'));
    } else if (err.name === 'TokenExpiredError') {
      logger.error(`AUTH: Token JWT scaduto per ${req.originalUrl}`);
      return next(new ApiError(401, 'Token JWT scaduto'));
    }
    
    logger.error(`AUTH: Errore generale per ${req.originalUrl}: ${err.message}`);
    next(err);
  }
};

/**
 * Middleware per verificare il ruolo dell'attore
 * @param {Array} roles - Array di ruoli autorizzati
 */
const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }
  
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Utente non autenticato'));
    }

    // Superuser: gli Amministratori hanno accesso a tutto indipendentemente dai ruoli richiesti
    if (req.user.ruolo === 'Amministratore') {
      return next();
    }

    // MIGLIORAMENTO: Verifica sia il ruolo che il tipo_utente
    // Mappatura tra tipi utente e ruoli autorizzati
    const tipoUtenteToRoles = {
      'CANALE SOCIALE': ['TipoUtenteSociale', 'CentroSociale'],
      'CENTRO RICICLO': ['TipoUtenteRiciclaggio', 'CentroRiciclaggio'],
      'PRIVATO': ['Utente'] // Aggiungo supporto per utenti privati
    };
    
    logger.debug(`AUTH: Verifica autorizzazione per ruolo=${req.user.ruolo}, tipo_utente=${req.user.tipo_utente || 'non definito'}`);
    
    // Se il ruolo dell'utente e tra quelli autorizzati, consenti l'accesso
    if (roles.includes(req.user.ruolo)) {
      logger.debug(`AUTH: Autorizzazione concessa in base al ruolo: ${req.user.ruolo}`);
      return next();
    }
    
    // Se l'utente ha un tipo_utente, verifica se corrisponde a uno dei ruoli autorizzati
    if (req.user.tipo_utente) {
      const tipoUtenteUpper = req.user.tipo_utente.toUpperCase();
      const rolesForTipoUtente = tipoUtenteToRoles[tipoUtenteUpper] || [];
      
      // Verifica se c'e una intersezione tra i ruoli associati al tipo_utente e i ruoli autorizzati
      const authorized = rolesForTipoUtente.some(role => roles.includes(role));
      
      if (authorized) {
        logger.debug(`AUTH: Autorizzazione concessa in base al tipo_utente: ${req.user.tipo_utente}`);
        return next();
      }
    }
    
    // Se non e stato autorizzato ne per ruolo ne per tipo_utente, nega l'accesso
    return next(new ApiError(403, 'Non autorizzato: ruolo e tipo utente non sufficienti'));
  };
};

/**
 * Middleware per verificare l'appartenenza a un tipo utente
 * @param {Function} getResourceTipoUtenteId - Funzione che estrae l'ID del tipo utente dalla richiesta
 */
const belongsToTipoUtente = (getResourceTipoUtenteId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, 'Utente non autenticato'));
      }
      
      // Amministratori hanno accesso a tutto
      if (req.user.ruolo === 'Amministratore') {
        return next();
      }
      
      const resourceTipoUtenteId = getResourceTipoUtenteId(req);
      
      if (!resourceTipoUtenteId) {
        return next(new ApiError(400, 'ID tipo utente non valido'));
      }
      
      // Verifica se l'attore appartiene al tipo utente
      const sql = `
        SELECT 1 FROM AttoriTipoUtente
        WHERE attore_id = ? AND tipo_utente_id = ?
      `;
      
      // Utilizzo del metodo promisified invece della callback
      const row = await db.get(sql, [req.user.id, resourceTipoUtenteId]);
      
      if (!row) {
        return next(new ApiError(403, 'Non autorizzato: non appartieni a questo tipo utente'));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  belongsToTipoUtente
};






