const { ApiError } = require('../middlewares/errorHandler');
const segnalazioniService = require('../services/segnalazioniService');
const logger = require('../utils/logger');

const UNITA_AMMESSE = new Set(['kg', 'g', 'l', 'ml', 'pz']);

function parseAndValidateBody(req) {
    const b = req.body || {};
    const payload = {
        nome: b.nome?.trim(),
        descrizione: b.descrizione?.trim() || null,
        quantita: b.quantita != null ? Number(b.quantita) : undefined,
        unita_misura: (b.unita_misura || b.unitaMisura || '').trim(),
        prezzo: b.prezzo !== '' && b.prezzo != null ? Number(b.prezzo) : null,
        indirizzo_centro: (b.indirizzo_centro || b.indirizzoCentro || '').trim(),
        shelflife: (b.shelflife || '').trim(),
        stato: (b.stato || '').trim() || 'inviata'
    };

    if (!payload.nome) throw new ApiError(400, "Campo 'nome' obbligatorio.");
    if (!(payload.quantita > 0)) throw new ApiError(400, "Campo 'quantita' deve essere > 0.");
    if (!UNITA_AMMESSE.has(payload.unita_misura)) {
        throw new ApiError(400, "Campo 'unita_misura' non valido. Valori ammessi: kg,g,l,ml,pz.");
    }
    if (!payload.indirizzo_centro) throw new ApiError(400, "Campo 'indirizzo_centro' obbligatorio.");
    if (!payload.shelflife) throw new ApiError(400, "Campo 'shelflife' obbligatorio (YYYY-MM-DD).");
    if (payload.prezzo != null && !(payload.prezzo >= 0)) {
        throw new ApiError(400, "Campo 'prezzo' (se presente) deve essere ≥ 0.");
    }

    return payload;
}

/** POST /segnalazioni */
async function create(req, res, next) {
    try {

        logger.debug('[SEGNALAZIONI][CREATE] files:', (req.files || []).length,
            'ctype:', req.headers['content-type']);

        const actorId =
            req.user?.id || req.attore?.id || req.auth?.id ||
            (req.body.creato_da ? Number(req.body.creato_da) : null);

        if (!actorId) throw new ApiError(401, 'Utente non autenticato.');

        const data = parseAndValidateBody(req);
        data.creato_da = actorId;

        const files = Array.isArray(req.files) ? req.files : [];
        const result = await segnalazioniService.createSegnalazione(data, files);

        // Il service restituisce già images con le URL → rispondiamo direttamente
        return res.status(201).json(result);
    } catch (err) {
        next(err);
    }
}

/** GET /segnalazioni/:id */
async function getOne(req, res, next) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            throw new ApiError(400, 'ID non valido.');
        }

        const row = await segnalazioniService.getSegnalazioneById(id);
        if (!row) throw new ApiError(404, 'Segnalazione non trovata.');

        // Il service fornisce già row.images con url → rispondiamo direttamente
        return res.json(row);
    } catch (err) {
        next(err);
    }
}

/** GET /segnalazioni?stato=&q=&limit=&offset= */
async function list(req, res, next) {
    try {
        const { stato, q, limit, offset } = req.query || {};
        const opts = {
            stato: stato || undefined,
            search: q || undefined,
            limit: limit ? Number(limit) : 50,
            offset: offset ? Number(offset) : 0
        };

        const rows = await segnalazioniService.listSegnalazioni(opts);
        // La list, per performance, non arricchisce con le immagini (si possono chiedere con GET /:id)
        return res.json({ items: rows, count: rows.length });
    } catch (err) {
        next(err);
    }
}

/** DELETE /segnalazioni/:id */
async function remove(req, res, next) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            throw new ApiError(400, 'ID non valido.');
        }

        const ok = await segnalazioniService.deleteSegnalazione(id);
        if (!ok) throw new ApiError(404, 'Segnalazione non trovata.');

        return res.json({ success: true });
    } catch (err) {
        next(err);
    }
}

/** POST /segnalazioni/:id/revisione/start
 *  Porta lo stato a 'in_lavorazione' SE e solo se è attualmente 'inviata'.
 *  Accesso: solo Amministratore.
 */
async function startRevisione(req, res, next) {
    try {
        const ruolo = req.user?.ruolo || req.attore?.ruolo || null;
        if (ruolo !== 'Amministratore') {
            throw new ApiError(403, 'Operazione consentita solo agli amministratori.');
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            throw new ApiError(400, 'ID non valido.');
        }

        const seg = await segnalazioniService.markInLavorazione(id);
        if (!seg) throw new ApiError(404, 'Segnalazione non trovata.');

        return res.json(seg);
    } catch (err) {
        next(err);
    }
}

async function approvaSegnalazione(req, res, next) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return next(new ApiError(400, 'ID segnalazione non valido'));
        }

        const b = req.body || {};

        // Supporto sia snake_case che camelCase
        let ifUnmodifiedAt = b.if_unmodified_at ?? b.ifUnmodifiedAt ?? null;
        // Admin override: gli amministratori bypassano il controllo di concorrenza ottimistico
        if ((req.user?.ruolo || req.attore?.ruolo) === 'Amministratore') {
            ifUnmodifiedAt = null;
        }

        // Normalizzazione campi aggiornabili
        const patch = {
            nome: (typeof b.nome === 'string') ? b.nome : undefined,
            descrizione: (typeof b.descrizione === 'string' || b.descrizione === null) ? b.descrizione : undefined,
            quantita: (b.quantita != null) ? Number(b.quantita) : undefined,
            unita_misura: b.unita_misura ?? b.unitaMisura,
            prezzo: (b.prezzo !== undefined)
                ? (b.prezzo === null ? null : Number(b.prezzo))
                : undefined,
            indirizzo_centro: b.indirizzo_centro ?? b.indirizzoCentro,
            shelflife: (typeof b.shelflife === 'string') ? b.shelflife : undefined,
        };

        const updated = await segnalazioniService.approvaSegnalazioneConUpdate(
            id,
            patch,
            ifUnmodifiedAt
        );

        if (!updated) {
            return next(new ApiError(404, 'Segnalazione non trovata'));
        }

        return res.json({
            status: 'success',
            message: 'Segnalazione approvata, aggiornata e chiusa',
            segnalazione: updated,
        });
    } catch (err) {
        // 409 da: segnalazione già chiusa O conflitto di concorrenza
        if (err && err.statusCode === 409) {
            return next(new ApiError(409, err.message));
        }
        next(err);
    }
}

async function rifiutaSegnalazione(req, res, next) {
    try {
        const id = Number(req.params.id);
        const b = req.body || {};

        const motivo = b.messaggio_esito ?? b.messaggioEsito ?? '';
        let ifUnmodifiedAt = b.if_unmodified_at ?? null;
        // Admin override anche per rifiuto
        if ((req.user?.ruolo || req.attore?.ruolo) === 'Amministratore') {
            ifUnmodifiedAt = null;
        }

        const updated = await segnalazioniService.rifiutaSegnalazioneConMotivo(id, {
            messaggio_esito: motivo,
            if_unmodified_at: ifUnmodifiedAt,
        });
        if (!updated) {
            return next(new ApiError(404, 'Segnalazione non trovata'));
        }

        return res.json({
            status: 'success',
            message: 'Segnalazione rifiutata e chiusa',
            segnalazione: updated,
        });
    } catch (err) {
        if (err && err.statusCode === 409) {
            return next(new ApiError(409, err.message));
        }
        next(err);
    }
}

/**
 * Avvia il cleanup delle segnalazioni chiuse più vecchie di retentionMinutes.
 * retentionMinutes: da body o query (default 7 giorni).
 */
// async function cleanupSegnalazioniChiuse(req, res, next) {
//   try {
//     const retentionMinutes =
//       (req.body && Number(req.body.retentionMinutes)) ||
//       (req.query && Number(req.query.retentionMinutes)) ||
//       (7 * 24 * 60);

//     const result = await segnalazioniService.cleanupSegnalazioniChiuse(retentionMinutes, logger);
//     return res.json({
//       status: 'success',
//       retentionMinutes,
//       ...result,
//     });
//   } catch (err) {
//     next(err);
//   }
// }

module.exports = {
    create,
    getOne,
    list,
    remove,
    startRevisione,
    approvaSegnalazione,
    rifiutaSegnalazione,
    //cleanupSegnalazioniChiuse
};
