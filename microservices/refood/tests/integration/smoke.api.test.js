/*
  Smoke tests end-to-end per Refood backend contro un'istanza esterna al processo di test.
  Richiede backend raggiungibile su TEST_API_BASE_URL (default http://localhost:3000/api/v1).
*/

const axios = require('axios');

const BASE = process.env.TEST_API_BASE_URL || 'http://localhost:3000/api/v1';
const api = axios.create({ baseURL: BASE, validateStatus: () => true });

const unique = (prefix) => `${prefix}+${Date.now()}_${Math.floor(Math.random()*10000)}@refood.test`;

describe('Refood API smoke tests (external backend)', () => {
  const admin = { email: unique('admin'), password: 'TestPassw0rd!123', nome: 'Admin', cognome: 'Tester' };
  const adminTokens = { access: null };
  let createdLottoId = null;

  it('GET /health-check -> 200', async () => {
    const res = await api.get('/health-check');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('status');
  });

  it('GET /debug/database -> 200', async () => {
    const res = await api.get('/debug/database');
    expect(res.status).toBe(200);
  });

  it('POST /auth/register (admin) -> 201/409', async () => {
    const res = await api.post('/auth/register', {
      email: admin.email,
      password: admin.password,
      nome: admin.nome,
      cognome: admin.cognome,
      ruolo: 'Amministratore',
    });
    expect([200, 201, 409]).toContain(res.status);
  });

  it('POST /auth/login (admin) -> 200', async () => {
    const res = await api.post('/auth/login', { email: admin.email, password: admin.password });
    expect(res.status).toBe(200);
    adminTokens.access = res.data?.tokens?.access || res.data?.tokens?.accessToken;
    expect(adminTokens.access).toBeTruthy();
  });

  it('GET /attori -> 200', async () => {
    const res = await api.get('/attori', { headers: { Authorization: `Bearer ${adminTokens.access}` } });
    expect(res.status).toBe(200);
  });

  it('POST /lotti -> 201/4xx gestiti', async () => {
    const payload = {
      prodotto: 'Mele Fuji Test',
      quantita: 5,
      unita_misura: 'kg',
      data_scadenza: '2030-12-31',
      giorni_permanenza: 7,
      prezzo: 2.5,
      descrizione: 'Lotto di test',
      indirizzo: 'Via Test 123, Bari'
    };
    const res = await api.post('/lotti', payload, { headers: { Authorization: `Bearer ${adminTokens.access}` } });
    expect([201, 400, 403, 409]).toContain(res.status);
    if (res.status === 201) createdLottoId = res.data?.lotto?.id;
  });

  it('GET /lotti -> 200', async () => {
    const res = await api.get('/lotti', { headers: { Authorization: `Bearer ${adminTokens.access}` } });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('lotti');
  });
});
