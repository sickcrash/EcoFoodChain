import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { b64decode } from 'k6/encoding';
import { BASE_URL, loginOrRegister } from '../k6/common.js';

const SAMPLE_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wwAArgB9YkNv24AAAAASUVORK5CYII=';
const SAMPLE_IMAGE = b64decode(SAMPLE_IMAGE_BASE64, 'std');

const uploadDuration = new Trend('segnalazioni_upload_duration');
const uploadBytes = new Trend('segnalazioni_upload_response_bytes');
const uploadSuccessRate = new Rate('segnalazioni_upload_success_rate');
const uploadFailures = new Counter('segnalazioni_upload_failures');

const VUS = Number(__ENV.K6_UPLOAD_VUS || 5);
const DURATION = __ENV.K6_UPLOAD_DURATION || '1m';

export const options = {
  scenarios: {
    segnalazioni_upload: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      exec: 'uploadScenario',
      gracefulStop: '10s',
      tags: { component: 'segnalazioni', feature: 'file-upload' }
    }
  },
  thresholds: {
    segnalazioni_upload_duration: ['p(90)<1500'],
    segnalazioni_upload_success_rate: ['rate>0.95']
  }
};

export function setup() {
  if (__ENV.K6_UPLOAD_TOKEN) {
    return { token: __ENV.K6_UPLOAD_TOKEN };
  }
  const auth = loginOrRegister();
  return { token: auth.token };
}

function futureDate(daysAhead = 3) {
  const date = new Date(Date.now() + daysAhead * 86400000);
  return date.toISOString().slice(0, 10);
}

export function uploadScenario(data) {
  const token = data?.token;
  if (!token) {
    throw new Error('Missing auth token: set K6_UPLOAD_TOKEN or provide K6_EMAIL/K6_PASSWORD for login.');
  }

  const suffix = `${__VU}-${Date.now()}`;
  const formData = {
    nome: `Segnalazione load test ${suffix}`,
    descrizione: 'Scenario di carico automatico su endpoint /segnalazioni',
    quantita: String(1 + (__ITER % 5)),
    unita_misura: 'kg',
    indirizzo_centro: 'Via Test Load 123, Bari',
    shelflife: futureDate(3 + (__ITER % 5)),
    images: http.file(SAMPLE_IMAGE, `load-${suffix}.jpg`, 'image/jpeg')
  };

  const headers = { Authorization: `Bearer ${token}` };
  const started = Date.now();
  const res = http.post(`${BASE_URL}/segnalazioni`, formData, { headers });
  const elapsed = Date.now() - started;

  uploadDuration.add(elapsed);
  uploadBytes.add(res.body ? res.body.length : 0);

  const ok = check(res, {
    'status 201': (r) => r.status === 201,
    'payload includes id': (r) => {
      try {
        const json = JSON.parse(r.body);
        return Boolean(json?.id || json?.segnalazione?.id);
      } catch (_) {
        return false;
      }
    }
  });

  if (!ok) {
    uploadFailures.add(1);
  }
  uploadSuccessRate.add(ok);
}
