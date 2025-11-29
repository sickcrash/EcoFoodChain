// Utility FS per gestione immagini delle Segnalazioni

const fsPromises = require('fs/promises');
const path = require('path');

const baseUploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

const UPLOADS_DIR = baseUploadsDir;
const SEGNALAZIONI_DIR = path.join(UPLOADS_DIR, 'segnalazioni');

function buildPublicUrl(filename) {
  if (!filename || typeof filename !== 'string') return null;
  return `/uploads/segnalazioni/${encodeURIComponent(filename)}`;
}

function getSegnalazioniAbsolutePath(filename) {
  if (!filename || typeof filename !== 'string') return null;
  return path.join(SEGNALAZIONI_DIR, filename);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function safeUnlink(p, { retries = 5, baseDelay = 60 } = {}) {
  if (!p) return false;
  for (let i = 0; i <= retries; i++) {
    try {
      await fsPromises.unlink(p);
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') return false;
      const winBusy = process.platform === 'win32' && (e.code === 'EBUSY' || e.code === 'EPERM');
      if (winBusy && i < retries) {
        const wait = baseDelay * Math.pow(2, i);
        await sleep(wait);
        continue;
      }
      return false;
    }
  }
  return false;
}

module.exports = {
  UPLOADS_DIR,
  SEGNALAZIONI_DIR,
  buildPublicUrl,
  getSegnalazioniAbsolutePath,
  safeUnlink,
};