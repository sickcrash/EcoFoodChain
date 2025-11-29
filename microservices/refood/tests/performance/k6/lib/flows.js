// tests/performance/k6/lib/flows.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { b64decode } from 'k6/encoding';
import { BASE_URL, PROFILE_ENDPOINT, NOTIF_COUNT_ENDPOINT, LOTTI_ENDPOINT, WRITE_ENDPOINT } from './config.js';
import { getToken, getCenterAuth } from './auth.js';

const DEFAULT_IMAGE_RELATIVE_PATH = '../payloads/sample-image.png';
const DEFAULT_IMAGE_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const DEFAULT_IMAGE_NAME = 'k6-upload.png';
const DEFAULT_IMAGE_MIME = 'image/png';

let imageBytes = null;
let imageName = DEFAULT_IMAGE_NAME;
let imageMime = DEFAULT_IMAGE_MIME;

(function initImagePayload() {
  const envPath = __ENV.SEGNALAZIONE_IMAGE;
  const tryPaths = [];
  if (envPath && envPath.trim()) {
    tryPaths.push(envPath.trim());
  }
  tryPaths.push(DEFAULT_IMAGE_RELATIVE_PATH);

  for (const p of tryPaths) {
    try {
      imageBytes = open(p, 'b');
      const baseName = p.split(/[/\\]/).pop();
      if (baseName) {
        imageName = baseName;
        if (baseName.toLowerCase().endsWith('.jpg') || baseName.toLowerCase().endsWith('.jpeg')) {
          imageMime = 'image/jpeg';
        } else if (baseName.toLowerCase().endsWith('.png')) {
          imageMime = 'image/png';
        }
      }
      return;
    } catch (err) {
      console.error('Impossibile aprire immagine segnalazione da', p, err);
    }
  }

  try {
    imageBytes = b64decode(DEFAULT_IMAGE_B64, 'rawstd');
    imageName = DEFAULT_IMAGE_NAME;
    imageMime = DEFAULT_IMAGE_MIME;
  } catch (err) {
    console.error('Fallback base64 immagine non riuscito:', err);
    imageBytes = null;
  }
})();

let externalAuth = { token: null, cookies: null };
export function setExternalAuth(auth) { externalAuth = auth || { token: null, cookies: null }; }

function applyCookiesFrom(auth) {
  if (!auth || !auth.cookies) return;
  const jar = http.cookieJar();
  for (const [k, v] of Object.entries(auth.cookies)) {
    jar.set(BASE_URL, k, v);
  }
}

function applyExternalCookies() {
  applyCookiesFrom(externalAuth);
}

function authHeaders() {
  const t = externalAuth.token || getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function parseSegnalazioneOverride() {
  if (!__ENV.SEGNALAZIONE_FORM) return {};
  try {
    return JSON.parse(__ENV.SEGNALAZIONE_FORM);
  } catch (err) {
    console.error('SEGNALAZIONE_FORM JSON parse error:', err);
    return {};
  }
}

function buildSegnalazionePayload() {
  const today = new Date();
  const defaultShelflife = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const defaults = {
    nome: 'Segnalazione k6',
    descrizione: 'Generata dal test k6',
    quantita: 5,
    unita_misura: 'kg',
    indirizzo_centro: 'Via Test 123, Bari',
    shelflife: defaultShelflife,
    prezzo: 0,
  };

  const override = parseSegnalazioneOverride();
  const payload = { ...defaults, ...override };

  const body = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    body[key] = String(value);
  });

  if (imageBytes) {
    body.images = http.file(imageBytes, imageName, imageMime);
  }

  return body;
}

export function flow_auth() {
  const t = externalAuth.token || getToken();
  check(t, { 'token acquired': v => typeof v === 'string' && v.length > 10 });
  sleep(0.2);
}

export function flow_reads() {
  applyExternalCookies();
  const headers = { ...authHeaders() };
  group('reads', () => {
    const r1 = http.get(`${BASE_URL}${PROFILE_ENDPOINT}`, { headers, tags: { endpoint: PROFILE_ENDPOINT }});
    check(r1, { 'profile 200': r => r.status === 200 });

    const r2 = http.get(`${BASE_URL}${NOTIF_COUNT_ENDPOINT}`, { headers, tags: { endpoint: NOTIF_COUNT_ENDPOINT }});
    check(r2, { 'notifiche 200': r => r.status === 200 });

    const r3 = http.get(`${BASE_URL}${LOTTI_ENDPOINT}?page=1&size=20`, { headers, tags: { endpoint: LOTTI_ENDPOINT }});
    check(r3, { 'lotti 200': r => r.status === 200 });

    sleep(0.3);
  });
}

export function flow_write() {
  const centerAuth = getCenterAuth();
  applyExternalCookies();
  applyCookiesFrom(centerAuth);

  const headers = {};
  if (centerAuth && centerAuth.token) {
    headers.Authorization = `Bearer ${centerAuth.token}`;
  } else {
    Object.assign(headers, authHeaders());
  }

  const payload = buildSegnalazionePayload();
  const res = http.post(`${BASE_URL}${WRITE_ENDPOINT}`, payload, {
    headers,
    tags: { endpoint: WRITE_ENDPOINT },
  });
  check(res, { 'write 2xx': r => r.status >= 200 && r.status < 300 });
  sleep(0.3);
}