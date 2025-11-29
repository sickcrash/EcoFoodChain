const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const geocodingService = require('../services/geocodingService');
const { displayName } = require('../utils/roles');
const { hashToken } = require('../utils/tokenUtils');
const config = require('../config/config');

let tokenHashSetupPromise = null;
async function ensureTokenHashSupport() {
  if (!tokenHashSetupPromise) {
    tokenHashSetupPromise = (async () => {
      try {
        await db.run("ALTER TABLE TokenAutenticazione ADD COLUMN IF NOT EXISTS access_token_hash TEXT");
      } catch (err) {
        logger.warn(`Impossibile creare colonna access_token_hash: ${err.message}`);
      }
      try {
        await db.run("UPDATE TokenAutenticazione SET access_token_hash = access_token WHERE access_token_hash IS NULL AND access_token ~ '^[0-9a-f]{64}$'");
      } catch (err) {
        logger.warn(`Impossibile sincronizzare access_token_hash: ${err.message}`);
      }
    })();
  }
  return tokenHashSetupPromise;
}

const MAX_LOGIN_ATTEMPTS = Math.max(1, Number(config.system?.maxLoginAttempts || 5));
const LOCKOUT_TIME_MS = Number(config.system?.lockoutTime || (15 * 60 * 1000));
const ATTEMPT_MEMORY_MS = Math.max(LOCKOUT_TIME_MS, 10 * 60 * 1000);

const loginAttemptState = new Map();

function buildAttemptKey(email, ip) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedIp = typeof ip === 'string' ? ip : 'unknown';
  return `${normalizedEmail}|${normalizedIp}`;
}

function scheduleAttemptCleanup(key, entry, ttlMs) {
  if (!entry) return;
  if (entry.timeout) {
    clearTimeout(entry.timeout);
  }
  entry.timeout = setTimeout(() => {
    const current = loginAttemptState.get(key);
    if (current && current === entry) {
      loginAttemptState.delete(key);
    }
  }, ttlMs);
  if (entry.timeout && typeof entry.timeout.unref === 'function') {
    entry.timeout.unref();
  }
}

function getLockStatus(key) {
  const entry = loginAttemptState.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return entry.lockedUntil;
  }
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    loginAttemptState.delete(key);
  }
  return null;
}

function registerFailedAttempt(key) {
  const now = Date.now();
  let entry = loginAttemptState.get(key);
  if (!entry) {
    entry = { count: 0, lockedUntil: 0, timeout: null };
  }
  if (entry.lockedUntil && entry.lockedUntil > now) {
    scheduleAttemptCleanup(key, entry, entry.lockedUntil - now);
    loginAttemptState.set(key, entry);
    return entry.lockedUntil;
  }

  entry.count = (entry.count || 0) + 1;
  entry.lockedUntil = 0;

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.count = 0;
    entry.lockedUntil = now + LOCKOUT_TIME_MS;
    scheduleAttemptCleanup(key, entry, LOCKOUT_TIME_MS);
  } else {
    scheduleAttemptCleanup(key, entry, ATTEMPT_MEMORY_MS);
  }

  loginAttemptState.set(key, entry);
  return entry.lockedUntil || null;
}

function clearLoginAttempts(key) {
  const entry = loginAttemptState.get(key);
  if (entry?.timeout) {
    clearTimeout(entry.timeout);
  }
  loginAttemptState.delete(key);
}

function humanizeWait(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds} secondi`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minuti`;
}

// Verifica moduli
logger.debug('Moduli caricati:', {
  jwt: typeof jwt,
  bcrypt: typeof bcrypt,
  bcryptCompare: typeof bcrypt.compare,
  crypto: typeof crypto,
  geocoding: typeof geocodingService
});

// Helpers to handle legacy installs with different Attori id column names
function normalizeIdValue(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
}

function resolveAttoreId(row) {
  if (!row || typeof row !== 'object') return undefined;
  const directCandidates = [
    row.id,
    row.ID,
    row.attore_id,
    row.AttoreID,
    row.id_attore,
    row.ID_ATTORI,
    row.ID_ATTORE,
  ];
  for (const candidate of directCandidates) {
    if (candidate !== undefined && candidate !== null) {
      return normalizeIdValue(candidate);
    }
  }
  const keys = Object.keys(row);
  for (const key of keys) {
    if (key && key.toLowerCase() === 'id') {
      const value = row[key];
      if (value !== undefined && value !== null) {
        return normalizeIdValue(value);
      }
    }
  }
  for (const key of keys) {
    const lower = key ? key.toLowerCase() : '';
    if (lower.includes('attore') && lower.endsWith('id')) {
      const value = row[key];
      if (value !== undefined && value !== null) {
        return normalizeIdValue(value);
      }
    }
  }
  return undefined;
}

function isMissingAttoreIdColumnError(err) {
  if (!err) return false;
  if (err.code === '42703') return true;
  const message = String(err.message || '').toLowerCase();
  return (
    (message.includes('column') && message.includes('does not exist') && message.includes('id')) ||
    (message.includes('colonna') && message.includes('non esiste') && message.includes('id'))
  );
}

/**
 * Genera un JWT access token + refresh token (hash salvato)
 */
const generateTokens = async (user) => {
  const [accessTokenDuration, refreshTokenDuration] = await Promise.all([
    db.get("SELECT valore FROM ParametriSistema WHERE chiave = 'jwt_access_token_durata'"),
    db.get("SELECT valore FROM ParametriSistema WHERE chiave = 'jwt_refresh_token_durata'")
  ]);

  const accessExpires = parseInt(accessTokenDuration?.valore || 3600, 10);
  const refreshExpires = parseInt(refreshTokenDuration?.valore || 604800, 10);

  const jti = crypto.randomBytes(16).toString('hex');

  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      nome: user.nome,
      cognome: user.cognome,
      ruolo: user.ruolo,
      tipo_utente: user.tipo_utente || null,
      jti,
    },
    process.env.JWT_SECRET,
    { expiresIn: accessExpires }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const accessTokenHash = hashToken(accessToken);

  const accessTokenScadenza = new Date(Date.now() + accessExpires * 1000);
  const refreshTokenScadenza = new Date(Date.now() + refreshExpires * 1000);

  return {
    accessToken,
    accessTokenHash,       // hash del token da salvare in DB
    refreshToken,          // da restituire al client
    refreshTokenHash,      // da salvare in DB
    accessTokenScadenza,
    refreshTokenScadenza,
    expires: accessTokenScadenza,
  };
};

/**
 * Login
 */
const login = async (req, res, next) => {
  try {
    const { email, password, device_info } = req.body;
    const ip_address = req.ip;

    const attemptKey = buildAttemptKey(email, ip_address);
    const lockedUntil = getLockStatus(attemptKey);
    if (lockedUntil) {
      const waitLabel = humanizeWait(lockedUntil - Date.now());
      return next(new ApiError(429, `Troppi tentativi di accesso. Riprova tra ${waitLabel}`));
    }

    logger.info(`Tentativo di login con email: ${email}`);

    const user = await db.get(
      `SELECT id, email, password, nome, cognome, ruolo
       FROM Attori
       WHERE email = ?`,
      [email]
    );

    if (!user) {
      const lock = registerFailedAttempt(attemptKey);
      if (lock) {
        const waitLabel = humanizeWait(lock - Date.now());
        throw new ApiError(429, `Troppi tentativi di accesso. Riprova tra ${waitLabel}`);
      }
      throw new ApiError(401, 'Credenziali non valide');
    }

    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(password, user.password);
    } catch (e) {
      logger.error(`Errore bcrypt: ${e.message}`);
    }
    if (!passwordMatch) {
      const lock = registerFailedAttempt(attemptKey);
      if (lock) {
        const waitLabel = humanizeWait(lock - Date.now());
        throw new ApiError(429, `Troppi tentativi di accesso. Riprova tra ${waitLabel}`);
      }
      throw new ApiError(401, 'Credenziali non valide');
    }

    // se Utente, leggo il tipo_utente
    if (user.ruolo === 'Utente') {
      try {
        const tu = await db.get(
          `SELECT tu.tipo
           FROM Tipo_Utente tu
           JOIN AttoriTipoUtente atu ON tu.id = atu.tipo_utente_id
           WHERE atu.attore_id = ?`,
          [user.id]
        );
        if (tu) user.tipo_utente = tu.tipo;
      } catch (e) {
        logger.warn(`Impossibile leggere tipo_utente: ${e.message}`);
      }
    }

    clearLoginAttempts(attemptKey);

    const tokens = await generateTokens(user);

    const insertTokenSql = `INSERT INTO TokenAutenticazione
         (attore_id, access_token, access_token_hash, refresh_token, access_token_scadenza, refresh_token_scadenza, device_info, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertTokenParams = [
      user.id,
      tokens.accessTokenHash,
      tokens.accessTokenHash,
      tokens.refreshTokenHash, // salvo l'hash!
      tokens.accessTokenScadenza.toISOString(),
      tokens.refreshTokenScadenza.toISOString(),
      device_info || `Accesso il ${new Date().toISOString()}`,
      ip_address,
    ];

    try {
      await db.run(insertTokenSql, insertTokenParams);
    } catch (e) {
      if ((e?.message || '').includes('access_token_hash')) {
        logger.warn(`TokenAutenticazione privo di colonna access_token_hash. Provisioning in corso: ${e.message}`);
        await ensureTokenHashSupport();
        await db.run(insertTokenSql, insertTokenParams);
      } else {
        throw e;
      }
    }

    await db.run(
      `UPDATE Attori SET ultimo_accesso = CURRENT_TIMESTAMP WHERE id = ?`,
      [user.id]
    );

    delete user.password;
    user.ruolo_display = displayName(user.ruolo);

    res.json({
      user,
      tokens: {
        access: tokens.accessToken,
        refresh: tokens.refreshToken, // il client riceve il token in chiaro
        expires: tokens.expires,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Refresh token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refresh_token: refreshTokenRaw } = req.body;
    if (!refreshTokenRaw) return next(new ApiError(400, 'Refresh token mancante'));

    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');

    const refreshBaseSql = `SELECT
         t.id AS token_id,
         t.attore_id, t.refresh_token_scadenza, t.access_token,
         u.id, u.email, u.nome, u.cognome, u.ruolo
       FROM TokenAutenticazione t
       JOIN Attori u ON t.attore_id = u.id
       WHERE __CLAUSE__
         AND t.refresh_token_scadenza > NOW()
         AND t.revocato = FALSE`;

    const searchVariants = [];
    if (refreshTokenHash) {
      searchVariants.push({ clause: 't.refresh_token = ?', value: refreshTokenHash });
    }
    searchVariants.push({ clause: 't.refresh_token = ?', value: refreshTokenRaw });

    let tokenEntry = null;
    let matchedRefreshValue = null;
    for (const variant of searchVariants) {
      const sql = refreshBaseSql.replace('__CLAUSE__', variant.clause);
      tokenEntry = await db.get(sql, [variant.value]);
      if (tokenEntry) {
        matchedRefreshValue = variant.value;
        break;
      }
    }

    if (!tokenEntry) return next(new ApiError(401, 'Refresh token non valido o scaduto'));

    if (tokenEntry.ruolo === 'Utente') {
      try {
        const tu = await db.get(
          `SELECT tu.tipo
           FROM Tipo_Utente tu
           JOIN AttoriTipoUtente atu ON tu.id = atu.tipo_utente_id
           WHERE atu.attore_id = ?`,
          [tokenEntry.id]
        );
        if (tu) tokenEntry.tipo_utente = tu.tipo;
      } catch (e) {
        logger.warn(`Impossibile leggere tipo_utente durante refresh token: ${e.message}`);
      }
    }

    const tokens = await generateTokens(tokenEntry);

    const updateRefreshSql = `UPDATE TokenAutenticazione
         SET access_token = ?,
             access_token_hash = ?,
             access_token_scadenza = ?,
             refresh_token = ?,
             refresh_token_scadenza = ?
       WHERE refresh_token = ?`;
    const updateRefreshParams = [
      tokens.accessTokenHash,
      tokens.accessTokenHash,
      tokens.accessTokenScadenza.toISOString(),
      tokens.refreshTokenHash,
      tokens.refreshTokenScadenza.toISOString(),
      matchedRefreshValue,
    ];

    try {
      await db.run(updateRefreshSql, updateRefreshParams);
    } catch (e) {
      if ((e?.message || '').includes('access_token_hash')) {
        logger.warn(`TokenAutenticazione privo di colonna access_token_hash durante refresh. Provisioning in corso: ${e.message}`);
        await ensureTokenHashSupport();
        await db.run(updateRefreshSql, updateRefreshParams);
      } else {
        throw e;
      }
    }

    res.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires: tokens.expires,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout (revoca token corrente)
 */
const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next(new ApiError(400, 'Token mancante'));

    const tokenHash = hashToken(token);

    let updateResult = { changes: 0 };
    if (tokenHash) {
      updateResult = await db.run(
        `UPDATE TokenAutenticazione
           SET revocato = TRUE, revocato_il = CURRENT_TIMESTAMP
         WHERE access_token = ?`,
        [tokenHash]
      );
    }

    if (!updateResult.changes) {
      updateResult = await db.run(
        `UPDATE TokenAutenticazione
           SET revocato = TRUE, revocato_il = CURRENT_TIMESTAMP
         WHERE access_token = ?`,
        [token]
      );

      if (updateResult.changes && tokenHash) {
        await db.run(
          `UPDATE TokenAutenticazione
             SET access_token = ?, access_token_hash = ?
           WHERE access_token = ?
             AND revocato = TRUE`,
          [tokenHash, tokenHash, token]
        );
      }
    }

    const decoded = jwt.decode(token);
    const revokedUntil = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;
    const tokenIdentifier = tokenHash || decoded?.jti;

    if (tokenIdentifier) {
      await db.run(
        `INSERT INTO TokenRevocati (token_hash, revocato_da, motivo, scadenza_originale)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (token_hash) DO UPDATE
           SET revocato_da = EXCLUDED.revocato_da,
               motivo = EXCLUDED.motivo,
               scadenza_originale = EXCLUDED.scadenza_originale,
               revocato_il = NOW()`,
        [
          tokenIdentifier,
          req.user?.id || null,
          'Logout attore',
          revokedUntil,
        ]
      );
    }

    res.json({ message: 'Logout avvenuto con successo' });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout da tutti i dispositivi
 */
const logoutAll = async (req, res, next) => {
  try {
    await db.run(
      `UPDATE TokenAutenticazione
         SET revocato = TRUE, revocato_il = CURRENT_TIMESTAMP
       WHERE attore_id = ? AND revocato = FALSE`,
      [req.user.id]
    );

    const tokens = await db.all(
      `SELECT id, access_token, access_token_scadenza
       FROM TokenAutenticazione
       WHERE attore_id = ?
         AND revocato = TRUE
         AND revocato_il = CURRENT_TIMESTAMP`,
      [req.user.id]
    );

    for (const t of tokens) {
      if (!t.access_token) continue;
      const isHash = /^[0-9a-f]{64}$/i.test(t.access_token);
      const tokenIdentifier = isHash ? t.access_token : hashToken(t.access_token);

      if (!isHash) {
        await db.run(
          `UPDATE TokenAutenticazione
             SET access_token = ?, access_token_hash = ?
           WHERE id = ?`,
          [tokenIdentifier, tokenIdentifier, t.id]
        );
      }

      await db.run(
        `INSERT INTO TokenRevocati (token_hash, revocato_da, motivo, scadenza_originale)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (token_hash) DO UPDATE
           SET revocato_da = EXCLUDED.revocato_da,
               motivo = EXCLUDED.motivo,
               scadenza_originale = EXCLUDED.scadenza_originale,
               revocato_il = NOW()`,
        [tokenIdentifier, req.user.id, 'Logout da tutti i dispositivi', t.access_token_scadenza]
      );
    }

    res.json({ message: 'Logout da tutti i dispositivi avvenuto con successo' });
  } catch (err) {
    next(err);
  }
};

const resetPasswordWithPhone = async (req, res, next) => {
  const { email, telefono, nuova_password: nuovaPassword, verifica_nome: verificaNome } = req.body;
  const normalizedPhone = telefono == null ? '' : String(telefono).replace(/[^0-9+]/g, '').trim();
  const normalizedVerificationName = typeof verificaNome === 'string'
    ? verificaNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    : '';

  if (!normalizedPhone && !normalizedVerificationName) {
    return next(new ApiError(400, 'Fornisci il numero di telefono registrato o il nome completo usato in fase di registrazione.'));
  }

  if (!nuovaPassword || typeof nuovaPassword !== 'string' || nuovaPassword.length < 8) {
    return next(new ApiError(400, 'La nuova password deve contenere almeno 8 caratteri'));
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const user = await conn.get(
      'SELECT id, email, nome, cognome, ruolo FROM Attori WHERE LOWER(email) = LOWER(?)',
      [email]
    );

    if (!user) {
      await conn.rollback();
      return next(new ApiError(404, 'Utente non trovato'));
    }

    const isUtente = user.ruolo === 'Utente';
    if (isUtente && !normalizedPhone) {
      await conn.rollback();
      return next(new ApiError(400, "Per questo account e' necessario indicare il numero di telefono registrato."));
    }

    let storedPhone = '';
    if (normalizedPhone || isUtente) {
      const telefonoRecord = await conn.get(
        `SELECT tu.telefono
           FROM AttoriTipoUtente atu
           JOIN Tipo_Utente tu ON atu.tipo_utente_id = tu.id
          WHERE atu.attore_id = ?
          ORDER BY atu.data_inizio DESC
          LIMIT 1`,
        [user.id]
      );
      if (telefonoRecord?.telefono) {
        storedPhone = String(telefonoRecord.telefono).replace(/[^0-9+]/g, '').trim();
      }
    }

    let verificationPassed = false;
    let verificationMode = 'verifica_nome';

    if (isUtente) {
      if (!storedPhone) {
        await conn.rollback();
        return next(new ApiError(400, 'Numero di telefono non registrato per questo account. Contatta il supporto.'));
      }
      if (storedPhone !== normalizedPhone) {
        await conn.rollback();
        return next(new ApiError(401, 'Le informazioni inserite non corrispondono ai dati presenti a sistema.'));
      }
      verificationPassed = true;
      verificationMode = 'telefono';
    } else {
      if (storedPhone && normalizedPhone) {
        if (storedPhone !== normalizedPhone) {
          await conn.rollback();
          return next(new ApiError(401, 'Le informazioni inserite non corrispondono ai dati presenti a sistema.'));
        }
        verificationPassed = true;
        verificationMode = 'telefono';
      }

      if (!verificationPassed && normalizedVerificationName) {
        const expectedName = `${user.nome || ''} ${user.cognome || ''}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
        if (expectedName && normalizedVerificationName === expectedName) {
          verificationPassed = true;
          verificationMode = 'verifica_nome';
        }
      }

      if (!verificationPassed) {
        await conn.rollback();
        if (normalizedVerificationName) {
          return next(new ApiError(401, 'Le informazioni inserite non corrispondono ai dati presenti a sistema.'));
        }
        return next(new ApiError(400, 'Fornisci il nome completo registrato per procedere al reset della password.'));
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(nuovaPassword, salt);

    await conn.run('UPDATE Attori SET password = ? WHERE id = ?', [hashedPassword, user.id]);
    await conn.run(
      `UPDATE TokenAutenticazione
         SET revocato = TRUE,
             revocato_il = CURRENT_TIMESTAMP
       WHERE attore_id = ? AND revocato = FALSE`,
      [user.id]
    );

    await conn.commit();

    logger.info(`Password reimpostata per l'utente ${user.id} (verifica=${verificationMode})`);
    res.json({ message: 'Password aggiornata con successo. Accedi con le nuove credenziali.' });
  } catch (error) {
    logger.error(`Errore reset password con verifica: ${error.message}`);
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        logger.error(`Rollback reset password fallito: ${rollbackError.message}`);
      }
    }
    next(new ApiError(500, 'Errore durante il reset della password'));
  } finally {
    if (conn) {
      conn.release();
    }
  }
};


/**
 * Sessioni attive
 */
const getActiveSessions = async (req, res, next) => {
  try {
    const sessions = await db.all(
      `SELECT id, device_info, ip_address, creato_il, access_token_scadenza, refresh_token_scadenza
       FROM TokenAutenticazione
       WHERE attore_id = ?
         AND revocato = FALSE
         AND refresh_token_scadenza > NOW()
       ORDER BY creato_il DESC`,
      [req.user.id]
    );
    res.json(sessions);
  } catch (err) {
    next(err);
  }
};

/**
 * Revoca sessione specifica
 */
const revokeSession = async (req, res, next) => {
  try {
    const sessionId = parseInt(req.params.id, 10);

    const session = await db.get(
      `SELECT id, access_token, access_token_scadenza
       FROM TokenAutenticazione
       WHERE id = ? AND attore_id = ?`,
      [sessionId, req.user.id]
    );
    if (!session) throw new ApiError(404, 'Sessione non trovata');

    await db.run(
      `UPDATE TokenAutenticazione
         SET revocato = TRUE, revocato_il = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sessionId]
    );

    let tokenIdentifier = session.access_token;
    if (tokenIdentifier && !/^[0-9a-f]{64}$/i.test(tokenIdentifier)) {
      tokenIdentifier = hashToken(tokenIdentifier);
      await db.run(
        `UPDATE TokenAutenticazione
           SET access_token = ?, access_token_hash = ?
         WHERE id = ?`,
        [tokenIdentifier, tokenIdentifier, sessionId]
      );
    }

    if (tokenIdentifier) {
      await db.run(
        `INSERT INTO TokenRevocati (token_hash, revocato_da, motivo, scadenza_originale)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (token_hash) DO UPDATE
           SET revocato_da = EXCLUDED.revocato_da,
               motivo = EXCLUDED.motivo,
               scadenza_originale = EXCLUDED.scadenza_originale,
               revocato_il = NOW()`,
        [tokenIdentifier, req.user.id, 'Revoca sessione', session.access_token_scadenza]
      );
    }

    res.json({ message: 'Sessione revocata con successo' });
  } catch (err) {
    next(err);
  }
};

/**
 * Geocoding indirizzo (opzionale)
 */
const geocodeIndirizzo = async (indirizzo) => {
  if (!indirizzo || typeof indirizzo !== 'string' || indirizzo.trim().length === 0) return null;

  try {
    if (!geocodingService.isConfigured()) return null;

    const result = await geocodingService.geocodeAddress(indirizzo);
    if (result?.lat && result?.lng) {
      logger.info(`Geocoding completato: ${indirizzo} -> lat: ${result.lat}, lng: ${result.lng}`);
      return {
        lat: result.lat,
        lng: result.lng,
        latitudine: result.lat,
        longitudine: result.lng,
        formatted_address: result.formatted_address,
      };
    }
    return null;
  } catch (err) {
    logger.error(`Errore geocoding "${indirizzo}": ${err.message}`);
    return null;
  }
};

/**
 * Registrazione
 * - Organizzazione: ruoli Operatore/Amministratore/OperatoreCentro
 * - Utente: associazione a Tipo_Utente (Privato/Canale sociale/centro riciclo)
 */
const register = async (req, res, next) => {
  const { email, password, nome, cognome, ruolo, tipoUtente } = req.body;

  logger.info('Richiesta di registrazione ricevuta', {
    ruolo,
    hasTipoUtente: Boolean(tipoUtente),
  });

  if (!email || !password || !nome || !ruolo) {
    return next(new ApiError(400, 'I campi email, password, nome e ruolo sono obbligatori'));
  }

  const ruoliValidi = ['Operatore', 'Amministratore', 'Utente', 'OperatoreCentro'];
  if (!ruoliValidi.includes(ruolo)) {
    return next(new ApiError(400, `Ruolo non valido. Valori consentiti: ${ruoliValidi.join(', ')}`));
  }

  if (ruolo === 'Utente' && !tipoUtente) {
    return next(new ApiError(400, "E' necessario specificare il tipo utente"));
  }
  if (ruolo === 'Utente' && !tipoUtente.tipo) {
    return next(new ApiError(400, "E' necessario specificare il tipo di utente (Privato, Canale sociale, centro riciclo)"));
  }
  if (ruolo === 'Utente' && !tipoUtente.indirizzo) {
    return next(new ApiError(400, "E' necessario specificare l'indirizzo"));
  }

  const isCognomeRequired =
    ruolo === 'Operatore' ||
    ruolo === 'Amministratore' ||
    ruolo === 'OperatoreCentro' ||
    (ruolo === 'Utente' && tipoUtente?.tipo === 'Privato');

  if (isCognomeRequired && !cognome) {
    return next(new ApiError(400, "Il cognome e' obbligatorio"));
  }

  try {
    const esistente = await db.get('SELECT 1 FROM Attori WHERE LOWER(email) = LOWER(?)', [email]);
    if (esistente) {
      res.set('X-Suggest-Login', 'true');
      return res.status(409).json({
        status: 'error',
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Email gia registrata.',
        actions: { login: { method: 'POST', path: (process.env.API_PREFIX || '/api/v1') + '/auth/login' } },
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const conn = await db.getConnection();
    let nuovoAttoreId;

    try {
      await conn.beginTransaction();

      // Hardening minimo/idempotente
      await conn.run(`ALTER TABLE Attori ADD COLUMN IF NOT EXISTS cognome_old TEXT`);
      await conn.run(`ALTER TABLE Attori ALTER COLUMN cognome DROP NOT NULL`);
      await conn.run(`ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS tipo TEXT`);
      await conn.run(`ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS indirizzo TEXT`);
      await conn.run(`ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS email TEXT`);
      await conn.run(`ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS telefono TEXT`);
      await conn.run(`ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS latitudine REAL`);
      await conn.run(`ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS longitudine REAL`);
      await conn.run(`ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS creato_il TIMESTAMPTZ DEFAULT NOW()`);

      await conn.run(`CREATE TABLE IF NOT EXISTS AttoriTipoUtente (
        attore_id INTEGER NOT NULL REFERENCES Attori(id),
        tipo_utente_id INTEGER NOT NULL REFERENCES Tipo_Utente(id),
        ruolo_specifico TEXT,
        data_inizio TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (attore_id, tipo_utente_id)
      )`);

      // 1) Inserisco attore
      try {
        const insertedRow = await conn.get(
          `INSERT INTO Attori (email, password, nome, cognome, cognome_old, ruolo, creato_il)
           VALUES (?, ?, ?, ?, ?, ?, NOW())
           RETURNING id`,
          [email, hashedPassword, nome, cognome || null, cognome || '', ruolo]
        );
        nuovoAttoreId = resolveAttoreId(insertedRow);
      } catch (insertError) {
        if (!isMissingAttoreIdColumnError(insertError)) {
          throw insertError;
        }

        logger.warn('Attori table missing id column, using legacy PK lookup');
        await conn.run(
          `INSERT INTO Attori (email, password, nome, cognome, cognome_old, ruolo, creato_il)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [email, hashedPassword, nome, cognome || null, cognome || '', ruolo]
        );
        const fallbackRow = await conn.get(
          'SELECT * FROM Attori WHERE LOWER(email) = LOWER(?)',
          [email]
        );
        nuovoAttoreId = resolveAttoreId(fallbackRow);
      }

      if (nuovoAttoreId === undefined || nuovoAttoreId === null) {
        throw new Error('Impossibile determinare il nuovo ID attore');
      }

      // 2) Se Utente -> preparo Tipo_Utente e associazione
      if (ruolo === 'Utente') {
        const { tipo, indirizzo, telefono } = tipoUtente;

        const tipiValidi = ['Privato', 'Canale sociale', 'centro riciclo'];
        if (!tipiValidi.includes(tipo)) {
          await conn.rollback(); conn.release();
          return next(new ApiError(400, `Tipo non valido. Valori consentiti: ${tipiValidi.join(', ')}`));
        }

        // Geocoding opzionale
        let lat = null, lng = null;
        try {
          const geo = await geocodeIndirizzo(indirizzo);
          if (geo) { lat = geo.lat; lng = geo.lng; }
        } catch (geoError) {
          logger.debug('Geocoding fallito per indirizzo durante registrazione utente: ' + (geoError && geoError.message ? geoError.message : geoError));
        }

        // 2a) Allineo/creo riga in Tipo_Utente SENZA usare RETURNING
        //     (evitiamo l'errore "colonna id non esiste" su installazioni legacy)
        await conn.run(
          `INSERT INTO Tipo_Utente (tipo, indirizzo, telefono, email, latitudine, longitudine, creato_il)
           VALUES (?, ?, ?, ?, ?, ?, NOW())
           ON CONFLICT (tipo) DO UPDATE
             SET indirizzo   = COALESCE(EXCLUDED.indirizzo,   Tipo_Utente.indirizzo),
                 telefono    = COALESCE(EXCLUDED.telefono,    Tipo_Utente.telefono),
                 email       = COALESCE(EXCLUDED.email,       Tipo_Utente.email),
                 latitudine  = COALESCE(EXCLUDED.latitudine,  Tipo_Utente.latitudine),
                 longitudine = COALESCE(EXCLUDED.longitudine, Tipo_Utente.longitudine)`,
          [
            tipo,
            indirizzo,
            telefono || null,
            (tipoUtente && tipoUtente.email) ? tipoUtente.email : email,
            lat,
            lng,
          ]
        );

        // 2b) Creo l'associazione prendendo l'id della riga via SELECT
        await conn.run(
          `INSERT INTO AttoriTipoUtente (attore_id, tipo_utente_id, data_inizio)
           SELECT ?, tu.id, NOW()
             FROM Tipo_Utente tu
            WHERE tu.tipo = ?
           ON CONFLICT DO NOTHING`,
          [nuovoAttoreId, tipo]
        );
      }

      await conn.commit();
      conn.release();
    } catch (txErr) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        logger.error('Rollback fallito nella transazione di registrazione: ' + rollbackError.message);
      }
      conn.release();
      const short = `Errore nella transazione di registrazione: ${txErr.message} (code=${txErr.code || '-'} constraint=${txErr.constraint || '-'} table=${txErr.table || '-'} column=${txErr.column || '-'})`;
      logger.error(short);
      throw txErr;
    }

    // Token immediati post-registrazione
    const tokensPostRegister = await generateTokens({
      id: nuovoAttoreId,
      email,
      nome,
      cognome: cognome || null,
      ruolo,
      tipo_utente: ruolo === 'Utente' ? tipoUtente?.tipo : null,
    });

    const insertRegisterSql = `INSERT INTO TokenAutenticazione
         (attore_id, access_token, access_token_hash, refresh_token, access_token_scadenza, refresh_token_scadenza, device_info, ip_address, creato_il)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    const insertRegisterParams = [
      nuovoAttoreId,
      tokensPostRegister.accessTokenHash,
      tokensPostRegister.accessTokenHash,
      tokensPostRegister.refreshTokenHash, // salvo l'hash per coerenza con /login e /refresh
      tokensPostRegister.accessTokenScadenza.toISOString(),
      tokensPostRegister.refreshTokenScadenza.toISOString(),
      req.headers['user-agent'] || 'Unknown',
      req.ip || 'Unknown',
    ];

    try {
      await db.run(insertRegisterSql, insertRegisterParams);
    } catch (e) {
      if ((e?.message || '').includes('access_token_hash')) {
        logger.warn(`TokenAutenticazione privo di colonna access_token_hash durante registrazione. Provisioning in corso: ${e.message}`);
        await ensureTokenHashSupport();
        await db.run(insertRegisterSql, insertRegisterParams);
      } else {
        throw e;
      }
    }

    const attore = {
      id: nuovoAttoreId,
      email,
      nome,
      cognome: cognome || null,
      ruolo,
      ruolo_display: displayName(ruolo),
    };

    if (ruolo === 'Utente') {
      attore.tipoUtente = {
        tipo: tipoUtente.tipo,
        indirizzo: tipoUtente.indirizzo,
      };
    }

    res.status(201).json({
      success: true,
      message: 'Registrazione completata con successo',
      data: {
        attore,
        tokens: {
          accessToken: tokensPostRegister.accessToken,
          refreshToken: tokensPostRegister.refreshToken, // restituisco il token in chiaro al client
          expires: tokensPostRegister.expires,
        },
      },
    });
  } catch (err) {
    logger.error(`Errore durante la registrazione: ${err.message}`);
    next(new ApiError(500, 'Errore durante la registrazione'));
  }
};

/**
 * Parametri di sistema
 */
async function getParametroSistema(chiave, defaultValue) {
  try {
    const row = await db.get('SELECT valore FROM ParametriSistema WHERE chiave = ?', [chiave]);
    return row ? row.valore : String(defaultValue);
  } catch (e) {
    logger.error(`Errore nel recupero parametro ${chiave}: ${e.message}`);
    return String(defaultValue);
  }
}

ensureTokenHashSupport().catch((err) => logger.error(`Provisioning access_token_hash fallito: ${err.message}`));

module.exports = {
  login,
  refreshToken,
  logout,
  logoutAll,
  resetPasswordWithPhone,
  getActiveSessions,
  revokeSession,
  register,
  geocodeIndirizzo,
};




