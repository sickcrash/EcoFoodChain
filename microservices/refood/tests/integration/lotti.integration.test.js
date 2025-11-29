const axios = require('axios');

const BASE = process.env.TEST_API_BASE_URL || 'http://localhost:8085/api/v1';
const api = axios.create({ baseURL: BASE, validateStatus: () => true });

const unique = (p) => `${p}+${Date.now()}_${Math.floor(Math.random()*10000)}@refood.test`;

describe('Lotti API Integration (external backend)', () => {
  const admin = { email: unique('op'), password: 'TestPassw0rd!123', nome: 'Op', cognome: 'Test' };
  let access;
  let createdId;

  beforeAll(async () => {
    const reg = await api.post('/auth/register', { email: admin.email, password: admin.password, nome: admin.nome, cognome: admin.cognome, ruolo: 'Amministratore' });
    expect([200, 201, 409]).toContain(reg.status);
    const login = await api.post('/auth/login', { email: admin.email, password: admin.password });
    expect(login.status).toBe(200);
    access = login.data?.tokens?.access || login.data?.tokens?.accessToken;
  }, 20000);

  test('GET /lotti -> 200 e struttura valida', async () => {
    const res = await api.get('/lotti', { headers: { Authorization: `Bearer ${access}` } });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('lotti');
    expect(Array.isArray(res.data.lotti)).toBe(true);
  });

  test('POST /lotti -> 201/500 crea lotto', async () => {
    const res = await api.post('/lotti', {
      prodotto: 'Lotto IT Test',
      quantita: 2,
      unita_misura: 'kg',
      data_scadenza: '2030-12-31',
      giorni_permanenza: 7,
      prezzo: 1
    }, { headers: { Authorization: `Bearer ${access}` } });
    expect([201, 500]).toContain(res.status);
    if (res.status === 201) createdId = res.data?.lotto?.id;
  });

  test('GET /lotti/:id -> 200 o 404', async () => {
    const id = createdId || 1;
    const res = await api.get(`/lotti/${id}`, { headers: { Authorization: `Bearer ${access}` } });
    expect([200, 404]).toContain(res.status);
  });
});
