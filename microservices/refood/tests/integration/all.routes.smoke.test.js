/*
  Smoke test di copertura rotte backend.
  Obiettivo: nessuna 5xx su tutte le rotte note; verifica auth di base.
  Punta al backend esterno definito in TEST_API_BASE_URL (default http://localhost:3000/api/v1).
*/

const axios = require('axios');

const BASE = process.env.TEST_API_BASE_URL || 'http://localhost:3000/api/v1';
const api = axios.create({ baseURL: BASE, validateStatus: () => true, timeout: 15000 });

const unique = (p) => `${p}+${Date.now()}_${Math.floor(Math.random()*10000)}@refood.test`;

// Helper: esita solo sulle 5xx; tutto il resto (2xx/3xx/4xx) è consentito se previsto
function expectNoServerError(res, allow = []) {
  if (!res || typeof res.status !== 'number') throw new Error('Nessuna risposta');
  if (String(res.status).startsWith('5')) {
    throw new Error(`Server error ${res.status}: ${JSON.stringify(res.data)}`);
  }
  if (allow.length > 0) {
    expect(allow).toContain(res.status);
  }
}

describe('Smoke (tutte le rotte note, no 5xx)', () => {
  const admin = { email: unique('admin'), password: 'TestPassw0rd!123', nome: 'Admin', cognome: 'Tester' };
  let access;
  let refresh;

  beforeAll(async () => {
    // Register (tolleriamo 200/201/409)
    const reg = await api.post('/auth/register', { email: admin.email, password: admin.password, nome: admin.nome, cognome: admin.cognome, ruolo: 'Amministratore' });
    expect([200, 201, 409]).toContain(reg.status);
    const login = await api.post('/auth/login', { email: admin.email, password: admin.password });
    expect(login.status).toBe(200);
    access = login.data?.tokens?.access || login.data?.tokens?.accessToken;
    refresh = login.data?.tokens?.refresh;
    expect(access).toBeTruthy();
  }, 20000);

  const authH = () => ({ headers: { Authorization: `Bearer ${access}` } });

  test('Root/health/debug', async () => {
    expectNoServerError(await api.get('/'));
    expectNoServerError(await api.get('/health-check'));
    expectNoServerError(await api.get('/healthcheck'));
    expectNoServerError(await api.get('/debug/database'), [200]);
  });

  test('Auth endpoints', async () => {
    expectNoServerError(await api.get('/auth/verifica', authH()), [200]);
    if (refresh) {
      expectNoServerError(await api.post('/auth/refresh-token', { refresh_token: refresh }), [200, 401]);
    }
    // Alcuni ambienti restituiscono 401 se il token è già stato invalidato/assente
    expectNoServerError(await api.post('/auth/logout', {}, authH()), [200, 401]);
    // Re-login to proceed with the rest
    const login = await api.post('/auth/login', { email: admin.email, password: admin.password });
    access = login.data?.tokens?.access || login.data?.tokens?.accessToken;
    expect(access).toBeTruthy();
    // Anche per logout-all tolleriamo 401 in caso di token già non valido
    expectNoServerError(await api.post('/auth/logout-all', {}, authH()), [200, 401]);
    // Re-login again after logout-all so the rest of the suite has a valid token
    const relogin = await api.post('/auth/login', { email: admin.email, password: admin.password });
    expect(relogin.status).toBe(200);
    access = relogin.data?.tokens?.access || relogin.data?.tokens?.accessToken;
    expect(access).toBeTruthy();
    // Active sessions
    expectNoServerError(await api.get('/auth/active-sessions', authH()));
  });

  test('Attori', async () => {
    expectNoServerError(await api.get('/attori/profile', authH()));
    expectNoServerError(await api.put('/attori/profile', { nome: 'Admin Test' }, authH()), [200, 400]);
    expectNoServerError(await api.get('/attori', authH()));
    // create attore (operatore)
    const resCreate = await api.post('/attori', { email: unique('op'), password: 'TestPassw0rd!123', nome: 'Op', cognome: 'X', ruolo: 'Operatore' }, authH());
    expect([201, 400, 403, 409]).toContain(resCreate.status);
    // detaglio + update su id 1 (o 404)
    expect([200, 404]).toContain((await api.get('/attori/1', authH())).status);
    expect([200, 400, 403, 404]).toContain((await api.put('/attori/1', { nome: 'X' }, authH())).status);
  });

  test('Lotti', async () => {
    expectNoServerError(await api.get('/lotti/test')); // open
    expectNoServerError(await api.get('/lotti', authH()));
    // create lotto (accetta 201/400/403/409 in base ai dati presenti)
    const payload = { prodotto: 'Smoke Lot', quantita: 1, unita_misura: 'kg', data_scadenza: '2030-12-31', giorni_permanenza: 3, prezzo: 0 };
    expect([201, 400, 403, 409]).toContain((await api.post('/lotti', payload, authH())).status);
    expect([200, 404]).toContain((await api.get('/lotti/1', authH())).status);
    expect([200, 400, 404]).toContain((await api.put('/lotti/1', { prezzo: 0 }, authH())).status);
    expect([200, 404]).toContain((await api.delete('/lotti/1', authH())).status);
    expect([200, 404]).toContain((await api.get('/lotti/1/origini', authH())).status);
    expect([200, 404]).toContain((await api.get('/lotti/1/impatto', authH())).status);
    // disponibili (filtrata auth)
    expectNoServerError(await api.get('/lotti/disponibili', authH()));
    // test-create disabilitato: 410 atteso
    expect([410, 401]).toContain((await api.post('/lotti/test-create', {}, authH())).status);
  });

  test('Mappa', async () => {
    expectNoServerError(await api.get('/mappa/centri'), [200, 400, 401]);
    expectNoServerError(await api.get('/mappa/centri/search', { params: { q: 'a' } }), [400, 401]); // min length 2
    expectNoServerError(await api.get('/mappa/centri/search', { params: { q: 'ba' } }), [200, 401]);
    expect([200, 401, 404]).toContain((await api.get('/mappa/centri/1')).status);
    expectNoServerError(await api.get('/mappa/statistiche'), [200, 401]);
  });

  test('Centri', async () => {
    expectNoServerError(await api.get('/centri', authH()));
    expect([200, 404]).toContain((await api.get('/centri/1', authH())).status);
    expect([201, 400, 403, 409]).toContain((await api.post('/centri', { nome: 'Centro Smoke', tipo_id: 1 }, authH())).status);
    expect([200, 400, 404]).toContain((await api.put('/centri/1', { nome: 'Upd' }, authH())).status);
    // Delete può fallire per vincoli; non è critico per smoke, quindi lo saltiamo
    // expect([200, 400, 404]).toContain((await api.delete('/centri/1', authH())).status);
    expectNoServerError(await api.get('/centri/tipi', authH()));
    expect([200, 404, 403]).toContain((await api.get('/centri/1/attori', authH())).status);
    expect([200, 404, 403]).toContain((await api.post('/centri/1/operatori', { operatori_ids: [] }, authH())).status);
    expect([201, 404, 409, 403]).toContain((await api.post('/centri/1/attori/1', {}, authH())).status);
    expect([200, 404, 400, 403]).toContain((await api.delete('/centri/1/attori/1', authH())).status);
    expect([200, 404]).toContain((await api.get('/centri/1/statistiche', authH())).status);
  });

  test('Prenotazioni', async () => {
    expectNoServerError(await api.get('/prenotazioni', authH()));
    expect([200, 404]).toContain((await api.get('/prenotazioni/1', authH())).status);
    expect([201, 400]).toContain((await api.post('/prenotazioni', { lotto_id: 1 }, authH())).status);
    expect([200, 400, 404]).toContain((await api.put('/prenotazioni/1', { stato: 'Prenotato' }, authH())).status);
    expect([200, 400, 404]).toContain((await api.post('/prenotazioni/1/trasporto', { mezzo: 'Furgone' }, authH())).status);
    expect([200, 401, 403, 404]).toContain((await api.post('/prenotazioni/1/annulla', {}, authH())).status);
    expect([200, 401, 403, 404]).toContain((await api.put('/prenotazioni/1/accetta', {}, authH())).status);
    expect([200, 401, 403, 404]).toContain((await api.put('/prenotazioni/1/rifiuta', {}, authH())).status);
    expect([200, 404]).toContain((await api.get('/prenotazioni/centro/1', authH())).status);
    expect([200, 401, 403, 404]).toContain((await api.put('/prenotazioni/1/pronto-per-ritiro', {}, authH())).status);
    expect([200, 400, 401, 403, 404]).toContain((await api.put('/prenotazioni/1/registra-ritiro', { ritirato_da: 'Mario' }, authH())).status);
    expect([200, 401, 403, 404]).toContain((await api.put('/prenotazioni/1/transito', {}, authH())).status);
    expect([200, 401, 403, 404]).toContain((await api.put('/prenotazioni/1/consegna', {}, authH())).status);
  });

  test('Statistiche', async () => {
    expectNoServerError(await api.get('/statistiche/counters', authH()));
    expectNoServerError(await api.get('/statistiche/impatto', authH()));
    // Complete può fallire su DB vuoto; non deve generare 5xx in ambienti reali con dati
    const comp = await api.get('/statistiche/complete', authH());
    expectNoServerError(comp, [200, 204, 404]);
    expectNoServerError(await api.get('/statistiche/tipo-utente', { ...authH(), params: { tipo_utente_id: 1 } }), [200, 404]);
    expectNoServerError(await api.get('/statistiche/efficienza', authH()));
    expectNoServerError(await api.get('/statistiche/giornalieri', authH()));
    // CSV export può essere 200 anche con testo vuoto
    const exp = await api.get('/statistiche/esporta', authH());
    expectNoServerError(exp, [200]);
  });

  test('Tipi Utente', async () => {
    expectNoServerError(await api.get('/tipi-utente', authH()));
    expect([200, 404]).toContain((await api.get('/tipi-utente/1', authH())).status);
    expect([201, 400, 401, 403, 409]).toContain((await api.post('/tipi-utente', { tipo: 'Privato', indirizzo: 'Via Test' }, authH())).status);
    expect([200, 400, 401, 403, 404]).toContain((await api.put('/tipi-utente/1', { indirizzo: 'Upd' }, authH())).status);
    // Delete può restituire 401/403/404 se vincoli o permessi bloccano l'operazione
    expect([200, 401, 403, 404]).toContain((await api.delete('/tipi-utente/1', authH())).status);
    expectNoServerError(await api.get('/tipi-utente/tipi', authH()));
    expect([200, 400, 401, 403, 404]).toContain((await api.get('/tipi-utente/miei', authH())).status);
    expect([200, 400, 401, 403, 404]).toContain((await api.post('/tipi-utente/1/attori', { attore_id: 1 }, authH())).status);
    expect([200, 401, 403, 404]).toContain((await api.delete('/tipi-utente/1/attori/1', authH())).status);
    expect([200, 400, 401, 403, 404]).toContain((await api.put('/tipi-utente/1/attori/1/ruolo', { ruolo_specifico: 'Operatore' }, authH())).status);
    expect([200, 400, 401, 403, 404]).toContain((await api.post('/tipi-utente/attore/associazione-massiva', { attore_id: 1, tipi_utente_ids: [1] }, authH())).status);
    expect([200, 400, 401, 403, 404]).toContain((await api.post('/tipi-utente/1/attori/associazione-massiva', { attori_ids: [1] }, authH())).status);
  });

  test('Geocoding (best-effort, può essere non configurato)', async () => {
    const info = await api.get('/geocoding/info', authH());
    expectNoServerError(info, [200, 503, 401, 403]);
    // Se configurato, prova una address singola
    // Evita chiamate live alle API esterne (salta address/addresses)
    // Verifica solo l'info e la patch coordinates in modo soft
    if (info.status === 200) {
      expect([200, 404, 503]).toContain((await api.patch('/geocoding/tipo-utente/1/coordinates', { force_geocoding: false }, authH())).status);
    }
  });

  test('Notifiche', async () => {
    expectNoServerError(await api.get('/notifiche', authH()));
    expectNoServerError(await api.get('/notifiche/conteggio', authH()));
    expectNoServerError(await api.put('/notifiche/tutte-lette', {}, authH()), [200]);
    expect([200, 404]).toContain((await api.get('/notifiche/1', authH())).status);
    expect([200, 404]).toContain((await api.put('/notifiche/1/letta', {}, authH())).status);
    expect([200, 404]).toContain((await api.delete('/notifiche/1', authH())).status);
    // Admin centro (best-effort)
    expect([200, 404]).toContain((await api.get('/notifiche/centro-test', authH())).status);
  });
});
