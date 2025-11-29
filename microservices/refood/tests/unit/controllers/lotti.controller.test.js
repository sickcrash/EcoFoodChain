const path = require('path');
const fs = require('fs/promises');
const {
  buildPublicUrl,
  getSegnalazioniAbsolutePath,
  SEGNALAZIONI_DIR,
  safeUnlink,
} = require('../../../backend/src/utils/files');

describe('utils/files', () => {
  const tempName = 'jest-temp-file.txt';
  const tempPath = path.join(SEGNALAZIONI_DIR, tempName);

  afterEach(async () => {
    try {
      await fs.unlink(tempPath);
    } catch (_) {
      /* ignore */
    }
  });

  test('buildPublicUrl restituisce una URL relativa codificata', () => {
    expect(buildPublicUrl('foto.jpg')).toBe('/uploads/segnalazioni/foto.jpg');
    expect(buildPublicUrl('nome con spazi.png')).toBe('/uploads/segnalazioni/nome%20con%20spazi.png');
  });

  test('buildPublicUrl restituisce null per input non valido', () => {
    expect(buildPublicUrl('')).toBeNull();
    expect(buildPublicUrl(null)).toBeNull();
  });

  test('getSegnalazioniAbsolutePath punta alla cartella di upload', () => {
    const expected = path.join(SEGNALAZIONI_DIR, 'documento.pdf');
    expect(getSegnalazioniAbsolutePath('documento.pdf')).toBe(expected);
  });

  test('safeUnlink rimuove un file esistente e ritorna true', async () => {
    await fs.writeFile(tempPath, 'contenuto');
    await expect(fs.stat(tempPath)).resolves.toBeDefined();

    const removed = await safeUnlink(tempPath);

    expect(removed).toBe(true);
    await expect(fs.stat(tempPath)).rejects.toHaveProperty('code', 'ENOENT');
  });

  test('safeUnlink ritorna false se il file non esiste', async () => {
    const removed = await safeUnlink(tempPath);
    expect(removed).toBe(false);
  });
});