/**
 * Service Segnalazioni
 * - Orchestrazione DB + file system per creare/leggere/listare/eliminare segnalazioni e relative foto
 *
 * Dipendenze:
 *  - backend/src/config/database.js  → wrapper SQLite con metodi async run/get/all/exec e transazioni (BEGIN/COMMIT/ROLLBACK)
 *  - backend/src/utils/files.js      → SEGNALAZIONI_DIR, buildPublicUrl, getSegnalazioniAbsolutePath, safeUnlink
 */

const db = require('../config/database');
const sharp = require('sharp');
const fsPromises = require('fs/promises');
const logger = require('../utils/logger');

const { ApiError } = require('../middlewares/errorHandler');

const {
    buildPublicUrl,
    getSegnalazioniAbsolutePath,
    safeUnlink,
} = require('../utils/files');

// Estensioni “originali” da rimuovere se esiste la versione -opt.jpg
const VARIANT_EXTS = ['.webp', '.png', '.jpg', '.jpeg'];

function isInvalidImageError(err = {}) {
    const msg = (err.message || '').toLowerCase();
    if (!msg) return false;
    return msg.includes('missing an image file header')
        || msg.includes('unsupported image format')
        || msg.includes('input buffer contains unsupported image format')
        || msg.includes('invalid or unsupported image format')
        || msg.includes('jpeg markers');
}

/** Rimuove in sicurezza i varianti non -opt a partire da un basename (senza estensione) */
async function cleanupOriginalVariants(baseNoExt) {
    for (const ext of VARIANT_EXTS) {
        const p = getSegnalazioniAbsolutePath(baseNoExt + ext);
        await safeUnlink(p); // ignora ENOENT, ritenta su EBUSY/EPERM (vedi safeUnlink)
    }
}

/** Helper interno: esegue una funzione all'interno di una transazione DB */
async function withTransaction(fn) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const result = await fn(connection);
        await connection.commit();
        return result;
    } catch (err) {
        try { await connection.rollback(); } catch (_) { /* ignore */ }
        throw err;
    } finally {
        connection.release();
    }
}

/** Helper interno: recupera l'ID dell'ultimo INSERT in modo robusto */
async function getLastInsertId(insertResult, runner = db) {
    if (insertResult && (insertResult.lastID || insertResult.lastInsertRowid)) {
        return insertResult.lastID || insertResult.lastInsertRowid;
    }
    if (runner && typeof runner.get === 'function') {
        try {
            const fallback = await runner.get('SELECT LASTVAL() AS id');
            if (fallback && fallback.id != null) {
                return fallback.id;
            }
        } catch (_) { /* ignore */ }
    }
    return null;
}

/**
 * Ottimizza/normalizza i file immagine:
 * - JPEG/JPG → resize (max 1600x1600), rotate, jpeg({quality:82, mozjpeg:true}), rimuove EXIF.
 * - PNG/WEBP/HEIC/HEIF → converte in JPEG (flatten se alpha), stessa pipeline.
 * - GIF → (opzionale) rifiutata qui con errore; se preferisci accettarla e non toccarla, rimuovi il throw.
 * - Altri → nessuna trasformazione (no-op).
 *
 * Ritorna l’oggetto file Multer **aggiornato** (filename/mimetype/size) se ha convertito.
 */
async function optimizeImageFile(f) {
    const abs = getSegnalazioniAbsolutePath(f.filename);
    if (!abs) return f;

    const mime = (f.mimetype || '').toLowerCase();
    const cleanupTargets = new Set();
    cleanupTargets.add(abs);

    // Blocca esplicitamente le GIF (evitiamo animazioni/ingombro)
    if (mime === 'image/gif') {
        throw new Error('Formato GIF non supportato');
    }

    // Helper: converte in JPEG e rinomina il file su disco (estensione .jpg)
    const convertToJpeg = async () => {
        const MAX_DIM_1 = 1600;
        const MAX_DIM_2 = 1400;
        const TARGET_MAX_BYTES = 800 * 1024;

        const input = await fsPromises.readFile(abs);

        // usa il buffer per metadata + pipeline
        const meta = await sharp(input).metadata();
        const hasAlpha = !!meta.hasAlpha;

        const baseNoExt = f.filename.replace(/\.[^.]+$/, '');
        const newName = baseNoExt + '-opt.jpg';
        const newAbs = getSegnalazioniAbsolutePath(newName);
        if (newAbs) cleanupTargets.add(newAbs);

        const before = input.length;

        let img = sharp(input).rotate().resize({
            width: MAX_DIM_1, height: MAX_DIM_1, fit: 'inside', withoutEnlargement: true
        });
        if (hasAlpha) img = img.flatten({ background: '#ffffff' });

        let buf = await img.jpeg({
            quality: 78, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0'
        }).toBuffer();

        if (buf.length > TARGET_MAX_BYTES) {
            let img2 = sharp(input).rotate().resize({
                width: MAX_DIM_2, height: MAX_DIM_2, fit: 'inside', withoutEnlargement: true
            });
            if (hasAlpha) img2 = img2.flatten({ background: '#ffffff' });

            buf = await img2.jpeg({
                quality: 68, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0'
            }).toBuffer();
        }

        await fsPromises.writeFile(newAbs, buf);
        const afterDisk = (await fsPromises.stat(newAbs)).size;

        f.filename = newName;
        f.mimetype = 'image/jpeg';
        f.size = afterDisk;

        logger.debug('[IMG][CONVERT][DISK]', newName, 'before:', before, 'buf:', buf.length, 'disk:', afterDisk);

        // ora l'originale non è più lockato → si può rimuovere
        await safeUnlink(abs);

        return f;
    };

    try {
        // JPEG → comprimi scrivendo su un NUOVO file, poi rimuovi l’originale (evita lock su Windows)
        const isJpeg = mime.includes('jpeg') || mime.includes('jpg') || mime.includes('pjpeg');
        if (isJpeg) {
            const MAX_DIM_1 = 1600;
            const MAX_DIM_2 = 1400;
            const TARGET_MAX_BYTES = 800 * 1024;

            const input = await fsPromises.readFile(abs);
            const before = input.length;

            // scrivi su nuovo file -opt.jpg (niente lock e niente overwrite)
            const baseNoExt = f.filename.replace(/\.[^.]+$/, '');
            const newName = baseNoExt + '-opt.jpg';
            const newAbs = getSegnalazioniAbsolutePath(newName);
            if (newAbs) cleanupTargets.add(newAbs);

            let buf = await sharp(input)
                .rotate()
                .resize({ width: MAX_DIM_1, height: MAX_DIM_1, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 78, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
                .toBuffer();

            if (buf.length > TARGET_MAX_BYTES) {
                buf = await sharp(input)
                    .rotate()
                    .resize({ width: MAX_DIM_2, height: MAX_DIM_2, fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 68, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
                    .toBuffer();
            }

            await fsPromises.writeFile(newAbs, buf);
            const afterDisk = (await fsPromises.stat(newAbs)).size;

            f.filename = newName;
            f.mimetype = 'image/jpeg';
            f.size = afterDisk;

            logger.debug('[IMG][JPEG][DISK]', newName, 'before:', before, 'buf:', buf.length, 'disk:', afterDisk);

            await safeUnlink(abs);

            return f;
        }

        const isPng = mime.includes('png'); // copre image/png, image/x-png
        const isWebp = mime.includes('webp');
        const isHeic = mime.includes('heic') || mime.includes('heif');

        if (isPng || isWebp || isHeic) {
            return await convertToJpeg();
        }

        // Altri formati → no-op
        return f;
    } catch (err) {
        const invalid = isInvalidImageError(err);
        if (invalid) {
            for (const target of cleanupTargets) {
                await safeUnlink(target);
            }
            err.code = 'INVALID_IMAGE_FILE';
            err.cleanupTargets = Array.from(cleanupTargets);
            throw err;
        }
        // Se la conversione fallisce tieni l’originale
        return f;
    }
}

/**
 * Crea una nuova Segnalazione con foto.
 * @param {Object} data - campi: { nome, descrizione, quantita, unita_misura|unitaMisura, prezzo, indirizzo_centro|indirizzoCentro, shelflife, stato, creato_da }
 * @param {Array} files - array di file Multer (req.files): [{ filename, originalname, mimetype, size }, ...]
 * @returns {Object} segnalazione creata con immagini [{ filename, url }]
 */
async function createSegnalazione(data, files = []) {
    // --- Validazioni base (coerenti con i CHECK dello schema) ---
    const nome = (data.nome || '').trim();
    const descrizione = (data.descrizione || '').trim();
    const quantita = Number(data.quantita);
    const unita_misura = (data.unita_misura || data.unitaMisura || '').trim();
    const prezzo = (data.prezzo === '' || data.prezzo == null) ? null : Number(data.prezzo);
    const indirizzo_centro = (data.indirizzo_centro || data.indirizzoCentro || '').trim();
    const shelflife = (data.shelflife || '').trim(); // atteso 'YYYY-MM-DD'
    const stato = (data.stato || 'inviata').trim();
    const creato_da = Number(data.creato_da); // FK Attori.id

    if (!nome) throw new Error('Campo "nome" obbligatorio.');
    if (!indirizzo_centro) throw new Error('Campo "indirizzo_centro" obbligatorio.');
    if (!shelflife) throw new Error('Campo "shelflife" obbligatorio (YYYY-MM-DD).');
    if (!['kg', 'g', 'l', 'ml', 'pz'].includes(unita_misura)) throw new Error('Valore "unita_misura" non valido.');
    if (!(quantita > 0)) throw new Error('La "quantita" deve essere > 0.');
    if (!(creato_da > 0)) throw new Error('Campo "creato_da" obbligatorio (FK Attori).');
    if (prezzo != null && !(prezzo >= 0)) throw new Error('Il "prezzo", se presente, deve essere >= 0.');

    // --- Normalizzazione/ottimizzazione file PRIMA degli insert ---
    const allowed = new Set([
        'image/jpeg', 'image/jpg', 'image/pjpeg',
        'image/png', 'image/x-png',
        'image/webp',
    ]);
    const processedFiles = [];

    for (const f of (files || [])) {
        const t = (f.mimetype || '').toLowerCase();
        const abs = getSegnalazioniAbsolutePath(f.filename);

        // Se il formato non è supportato → cancella subito il file e blocca la richiesta
        if (!allowed.has(t)) {
            await safeUnlink(abs);
            throw new ApiError(415, 'Formato immagine non supportato. Usa JPEG/PNG/WEBP.');
        }

        // Prova l’ottimizzazione: se fallisce, mantieni l’originale
        try {
            processedFiles.push(await optimizeImageFile(f));
        } catch (err) {
            if (err.code === 'INVALID_IMAGE_FILE') {
                await safeUnlink(abs);
                if (Array.isArray(err.cleanupTargets)) {
                    for (const target of err.cleanupTargets) {
                        if (target && target !== abs) {
                            await safeUnlink(target);
                        }
                    }
                }
                throw new ApiError(415, 'File immagine non valido o corrotto.');
            }
            processedFiles.push(f);
        }
    }

    // Per il cleanup in caso di errore usiamo i (potenzialmente) nuovi filename
    const uploadedFilenames = processedFiles.map(f => f.filename).filter(Boolean);

    return withTransaction(async (trx) => {
        // --- Insert Segnalazione ---
        const insertSegSql = `
      INSERT INTO Segnalazioni
        (nome, descrizione, quantita, unita_misura, prezzo, indirizzo_centro, shelflife, stato, creato_da)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const insertRes = await trx.run(insertSegSql, [
            nome,
            descrizione || null,
            quantita,
            unita_misura,
            prezzo,
            indirizzo_centro,
            shelflife,
            stato,
            creato_da,
        ]);

        const segnalazioneId = await getLastInsertId(insertRes, trx);
        if (!segnalazioneId) {
            throw new Error("Impossibile determinare l'ID della nuova segnalazione");
        }

        // --- Insert Foto collegate (se presenti) ---
        if (uploadedFilenames.length > 0) {
            const insertFotoSql = `
        INSERT INTO SegnalazioneFoto
          (segnalazione_id, filename, original_name, mime_type, size)
        VALUES (?, ?, ?, ?, ?)
      `;
            for (const f of processedFiles) {
                let sizeToInsert = f.size ?? null;
                try {
                    const absFile = getSegnalazioniAbsolutePath(f.filename);
                    const st = await fsPromises.stat(absFile);
                    sizeToInsert = st.size;
                } catch (statError) { logger.debug('Impossibile leggere dimensione file segnalazione, uso fallback: ' + (statError && statError.message ? statError.message : statError)); }

                await trx.run(insertFotoSql, [
                    segnalazioneId,
                    f.filename,
                    f.originalname || null,
                    f.mimetype || null,
                    sizeToInsert,
                ]);
            }
        }

        // --- Recupero e ritorno oggetto completo ---
        const created = await getSegnalazioneById(segnalazioneId, trx);

        // Cleanup post-commit:
        // 1) ritenta la rimozione di eventuali originali lockati (pf._leftoverOriginal)
        // 2) rimuovi tutti i "varianti" senza -opt con lo stesso basename (es. .webp/.png/.jpg)
        const doPostCleanup = async () => {
            for (const pf of processedFiles) {
                if (pf._leftoverOriginal) {
                    try { await safeUnlink(pf._leftoverOriginal); } catch (unlinkError) { logger.warn('Rimozione file originale fallita per segnalazione ' + segnalazioneId + ': ' + (unlinkError && unlinkError.message ? unlinkError.message : unlinkError)); }
                }
                if (/-opt\.jpg$/i.test(pf.filename)) {
                    const base = pf.filename.replace(/-opt\.jpg$/i, ''); // basename senza -opt né estensione
                    try { await cleanupOriginalVariants(base); } catch (cleanupError) { logger.warn('Pulizia varianti originali fallita per ' + base + ': ' + (cleanupError && cleanupError.message ? cleanupError.message : cleanupError)); }
                }
            }
        };
        setTimeout(doPostCleanup, 600);   // primo tentativo
        setTimeout(doPostCleanup, 2500);  // secondo tentativo (lock Windows testardo)

        return created;
    }).catch(async (err) => {
        // In caso di errore, rimuoviamo dal filesystem eventuali file già salvati/convertiti
        for (const fname of uploadedFilenames) {
            const abs = getSegnalazioniAbsolutePath(fname);
            await safeUnlink(abs);
        }
        throw err;
    });
}

/**
 * Restituisce una Segnalazione (con foto) per ID + info autore (JOIN Attori).
 * @param {number} id
 * @returns {Object|null}
 */
async function getSegnalazioneById(id, runner = db) {
    const seg = await runner.get(`
    SELECT
      s.id, s.nome, s.descrizione, s.quantita, s.unita_misura, s.prezzo,
      s.indirizzo_centro, s.shelflife, s.stato,
      s.esito, s.messaggio_esito,
      s.creato_da, s.creato_il, s.aggiornato_il,
      a.nome    AS creato_da_nome,
      a.cognome AS creato_da_cognome,
      a.ruolo   AS creato_da_ruolo
    FROM Segnalazioni s
    LEFT JOIN Attori a ON a.id = s.creato_da
    WHERE s.id = ?
  `, [id]);

    if (!seg) return null;

    const fotos = await runner.all(`
    SELECT id, filename, original_name, mime_type, size, creato_il
    FROM SegnalazioneFoto
    WHERE segnalazione_id = ?
    ORDER BY id ASC
  `, [id]);

    const images = (fotos || []).map(r => ({
        id: r.id,
        filename: r.filename,
        url: buildPublicUrl(r.filename),
        original_name: r.original_name,
        mime_type: r.mime_type,
        size: r.size,
        creato_il: r.creato_il,
    }));

    const { creato_da_nome, creato_da_cognome, creato_da_ruolo, ...rest } = seg;

    const creato_da_info = {
        id: seg.creato_da,
        nome: creato_da_nome || null,
        cognome: creato_da_cognome || null,
        ruolo: creato_da_ruolo || null,
    };

    return { ...rest, images, creato_da_info };
}


/**
 * Lista Segnalazioni con filtri basilari e paginazione.
 * @param {Object} params - { stato, search, limit=20, offset=0 }
 */
async function listSegnalazioni(params = {}) {
    const where = [];
    const args = [];

    if (params.stato) {
        where.push('s.stato = ?');
        args.push(params.stato);
    }
    if (params.search) {
        where.push('(s.nome LIKE ? OR s.descrizione LIKE ? OR s.indirizzo_centro LIKE ?)');
        args.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
    }

    const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(100, params.limit)) : 50;
    const offset = Number.isFinite(params.offset) ? Math.max(0, params.offset) : 0;

    const baseSql = `
    SELECT
      s.id, s.nome, s.descrizione, s.quantita, s.unita_misura, s.prezzo,
      s.indirizzo_centro, s.shelflife, s.stato,
      s.esito, s.messaggio_esito,
      s.creato_da, s.creato_il, s.aggiornato_il
    FROM Segnalazioni s
  `;
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = 'ORDER BY s.creato_il DESC';
    const limitSql = 'LIMIT ? OFFSET ?';

    const rows = await db.all(
        `${baseSql} ${whereSql} ${orderSql} ${limitSql}`,
        [...args, limit, offset]
    );

    return rows || [];
}

/**
 * Elimina una Segnalazione e le relative foto.
 * - DB: usa ON DELETE CASCADE su SegnalazioneFoto
 * - FS: rimuove fisicamente i file dopo il COMMIT
 * @param {number} id
 * @returns {boolean} true se eliminata, false se non esiste
 */
async function deleteSegnalazione(id) {
    // Recupera subito i filename (serviranno dopo il commit per unlink fisico)
    const fotos = await db.all(
        'SELECT filename FROM SegnalazioneFoto WHERE segnalazione_id = ?',
        [id]
    );
    const filenames = (fotos || []).map(r => r.filename);

    // Esegui l'eliminazione in transazione
    const deleted = await withTransaction(async (trx) => {
        const res = await trx.run('DELETE FROM Segnalazioni WHERE id = ?', [id]);
        return (res?.changes || 0) > 0;
    });

    if (!deleted) return false;

    // Dopo il COMMIT: rimuovi fisicamente i file dal filesystem (silenzioso se non esistono)
    for (const fname of filenames) {
        const abs = getSegnalazioniAbsolutePath(fname);
        await safeUnlink(abs);
        // Se era un *-opt.jpg, ripulisci anche eventuali varianti non-opt rimasti
        const baseNoOpt = fname.replace(/-opt\.jpg$/i, '').replace(/\.[^.]+$/, '');
        await cleanupOriginalVariants(baseNoOpt);
    }

    return true;
}

/**
 * Se lo stato è 'inviata', lo porta a 'in_lavorazione'.
 * Ritorna l'oggetto segnalazione aggiornato.
 * Se non esiste -> null
 */
async function markInLavorazione(id) {
    // update atomico: solo se è attualmente 'inviata'
    const sql = `
    UPDATE Segnalazioni
    SET stato = 'in_lavorazione',
        aggiornato_il = CURRENT_TIMESTAMP
    WHERE id = ? AND stato = 'inviata'`;
    await db.run(sql, [id]);

    // recupera e ritorna lo stato attuale (che sia cambiato o no)
    const seg = await getSegnalazioneById(id);
    return seg;
}

/**
 * Approva una segnalazione AGGIORNANDO i campi editabili.
 * - aggiorna: nome, descrizione, quantita, unita_misura, prezzo, indirizzo_centro, shelflife
 * - forza:    stato='chiusa', esito='approvata', messaggio_esito=NULL, aggiornato_il=CURRENT_TIMESTAMP
 * - vincoli:  se già chiusa => 409
 * - concorrenza: se ifUnmodifiedAt è passato, aggiorna solo se combacia con aggiornato_il
 */
async function approvaSegnalazioneConUpdate(id, patch = {}, ifUnmodifiedAt = null) {
    // 1) riga corrente
    const current = await db.get('SELECT id, stato, aggiornato_il FROM Segnalazioni WHERE id = ?', [id]);
    if (!current) return null;

    if ((current.stato || '').toLowerCase() === 'chiusa') {
        const err = new Error('Segnalazione già chiusa');
        err.statusCode = 409;
        err.isOperational = true;
        throw err;
    }

    // 2) merge + normalizzazione/validazione
    const nome = (patch.nome ?? current.nome ?? '').trim();
    const descrizione = (patch.descrizione ?? current.descrizione ?? null);
    const quantita = patch.quantita != null ? Number(patch.quantita) : Number(current.quantita);
    const unita_misura = (patch.unita_misura ?? patch.unitaMisura ?? current.unita_misura ?? '').trim();
    const prezzo = (patch.prezzo === '' ? null :
        (patch.prezzo != null ? Number(patch.prezzo) : current.prezzo));
    const indirizzo_centro = (patch.indirizzo_centro ?? patch.indirizzoCentro ?? current.indirizzo_centro ?? '').trim();
    const shelflife = (patch.shelflife ?? current.shelflife ?? '').trim(); // 'YYYY-MM-DD'

    if (!nome) throw new Error('Campo "nome" obbligatorio.');
    if (!indirizzo_centro) throw new Error('Campo "indirizzo_centro" obbligatorio.');
    if (!shelflife) throw new Error('Campo "shelflife" obbligatorio (YYYY-MM-DD).');
    if (!['kg', 'g', 'l', 'ml', 'pz'].includes(unita_misura)) throw new Error('Valore "unita_misura" non valido.');
    if (!(quantita > 0)) throw new Error('La "quantita" deve essere > 0.');
    if (prezzo != null && !(prezzo >= 0)) throw new Error('Il "prezzo", se presente, deve essere >= 0.');

    // 3) UPDATE condizionato su aggiornato_il se ifUnmodifiedAt è passato
    const sql = `
    UPDATE Segnalazioni
       SET nome = ?,
           descrizione = ?,
           quantita = ?,
           unita_misura = ?,
           prezzo = ?,
           indirizzo_centro = ?,
           shelflife = ?,
           stato = 'chiusa',
           esito = 'approvata',
           messaggio_esito = NULL,
           aggiornato_il = CURRENT_TIMESTAMP
     WHERE id = ?
       AND (?::timestamptz IS NULL OR aggiornato_il = ?::timestamptz)
  `;

    const params = [
        nome,
        (descrizione || null),
        quantita,
        unita_misura,
        prezzo,
        indirizzo_centro,
        shelflife,
        id,
        ifUnmodifiedAt, ifUnmodifiedAt
    ];

    const run = await db.run(sql, params);

    //ifUnmodifiedAt && run.changes === 0 è il segnale di “stato stantio” → 
    // qualcuno ha aggiornato la segnalazione dopo la tua lettura, quindi blocchiamo l’update e chiediamo di ricaricare.
    if (ifUnmodifiedAt && run.changes === 0) {
        const err = new Error('Conflitto di modifica: la segnalazione è stata aggiornata da un altro utente. Ricarica la pagina.');
        err.statusCode = 409;
        err.isOperational = true;
        throw err;
    }

    return await getSegnalazioneById(id);
}

/**
 * Rifiuta una segnalazione impostando:
 *  - stato = 'chiusa'
 *  - esito = 'rifiutata'
 *  - messaggio_esito = <motivo>
 *  - aggiornato_il = CURRENT_TIMESTAMP
 * Vincoli:
 *  - se già chiusa => 409
 *  - se if_unmodified_at è passato e non coincide => 409 (concorrenza ottimistica)
 */
async function rifiutaSegnalazioneConMotivo(id, { messaggio_esito, if_unmodified_at = null } = {}) {
    const cur = await db.get('SELECT stato, aggiornato_il FROM Segnalazioni WHERE id = ?', [id]);
    if (!cur) return null;

    if ((cur.stato || '').toLowerCase() === 'chiusa') {
        const e = new Error('Segnalazione già chiusa');
        e.statusCode = 409;
        e.isOperational = true;
        throw e;
    }

    const run = await db.run(
        `
      UPDATE Segnalazioni
         SET stato = 'chiusa',
             esito = 'rifiutata',
             messaggio_esito = ?,
             aggiornato_il = CURRENT_TIMESTAMP
       WHERE id = ?
         AND (?::timestamptz IS NULL OR aggiornato_il = ?::timestamptz)
    `,
        [messaggio_esito || 'Rifiutata', id, if_unmodified_at, if_unmodified_at]
    );

    if (if_unmodified_at && run.changes === 0) {
        const err = new Error('Conflitto: la segnalazione è stata aggiornata/chiusa da un altro utente');
        err.statusCode = 409;
        err.isOperational = true;
        throw err;
    }

    return await getSegnalazioneById(id);
}

// Pulisce le segnalazioni chiuse più vecchie di `retentionMinutes` (default 7 giorni)
async function cleanupSegnalazioniChiuse(retentionMinutes = 7 * 24 * 60, logger = console) {
  const cutoffParam = [`-${retentionMinutes} minutes`];

  // 1) Trova gli ID candidati (chiuse e con aggiornato_il abbastanza vecchio)
  const rows = await db.all(`
    SELECT id
    FROM Segnalazioni
    WHERE stato = 'chiusa'
      AND aggiornato_il IS NOT NULL
      AND aggiornato_il <= NOW() + (?::interval)
  `, cutoffParam);

  if (!rows || rows.length === 0) {
    logger.info(`[CLEANUP] Nessuna segnalazione da rimuovere (retention ${retentionMinutes} min).`);
    return { deleted: 0 };
  }

  // 2) Cancella usando la funzione esistente (gestisce DB + filesystem)
  let deleted = 0;
  for (const r of rows) {
    try {
      const ok = await deleteSegnalazione(r.id);
      if (ok) deleted++;
    } catch (e) {
      logger.warn(`[CLEANUP] Errore cancellando segnalazione #${r.id}: ${e.message}`);
    }
  }

  logger.info(`[CLEANUP] Rimosse ${deleted}/${rows.length} segnalazioni chiuse (retention ${retentionMinutes} min).`);
  return { deleted };
}

module.exports = {
    createSegnalazione,
    getSegnalazioneById,
    listSegnalazioni,
    deleteSegnalazione,
    markInLavorazione,
    approvaSegnalazioneConUpdate,
    rifiutaSegnalazioneConMotivo,
    cleanupSegnalazioniChiuse
};
