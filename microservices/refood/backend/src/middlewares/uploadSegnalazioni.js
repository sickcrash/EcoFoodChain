/**
 * Middleware di upload per le Segnalazioni
 * - Accetta massimo 6 file
 * - Solo immagini (mimetype che inizia con "image/")
 * - Salva su: backend/uploads/segnalazioni/
 * - Genera filename univoci con estensione originale
 */

const multer = require('multer');
const path = require('path');
const { SEGNALAZIONI_DIR } = require('../utils/files');

/** Configurazione dello storage su disco */
const storage = multer.diskStorage({
  /**
   * Imposta la cartella di destinazione dei file
   * NOTE: la cartella viene creata all'avvio del server in server.js
   */
  destination: (req, file, cb) => {
    cb(null, SEGNALAZIONI_DIR);
  },


  /**
   * Genera un nome file univoco preservando l'estensione
   * Esempio: segnalazione-1692450999999-123456789.jpg
   */
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `segnalazione-${uniqueSuffix}${ext}`);
  },
});

/** Filtra i file accettando SOLO i formati supportati */
function fileFilter(req, file, cb) {
  const mime = (file?.mimetype || '').toLowerCase();
  const ext = (path.extname(file?.originalname || '') || '').toLowerCase();

  const ALLOWED_MIME = new Set([
    'image/jpeg', 'image/jpg', 'image/pjpeg',
    'image/png', 'image/x-png',
    'image/webp',
  ]);
  const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

  if (ALLOWED_MIME.has(mime) || ALLOWED_EXT.has(ext)) {
    return cb(null, true);
  }

  const err = new Error('Formato non supportato. Usa JPEG/PNG/WEBP.');
  err.statusCode = 415;
  err.isOperational = true;
  return cb(err, false);
}

/** Istanza di Multer con limiti e filtri */
const uploadSegnalazioni = multer({
  storage,
  limits: {
    files: 6,                // max 6 file per richiesta
    fileSize: 21 * 1024 * 1024, // max 20MB per file in upload
  },
  fileFilter,
});

module.exports = uploadSegnalazioni;
