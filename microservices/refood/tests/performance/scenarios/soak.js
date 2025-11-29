// tests/performance/scenarios/soak.js
import { fail } from 'k6';
import { flow_reads, setExternalAuth } from '../k6/lib/flows.js';
import { loginOnce } from '../k6/lib/auth.js';
import { SOAK_RPS, SOAK_DURATION } from '../k6/lib/config.js';

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-arrival-rate',
      rate: SOAK_RPS,
      timeUnit: '1s',
      duration: SOAK_DURATION,
      preAllocatedVUs: 40,
      maxVUs: 120,
      exec: 's_reads',
    },
  },
  thresholds: {
    'http_req_failed{scenario:soak}': ['rate<0.002'],
    'http_req_duration{scenario:soak}': ['p(95)<350', 'p(99)<900'],
  },
  // <<-- CAMBIA QUI
  discardResponseBodies: false,
};

export function setup() {
  if (__ENV.TOKEN) return { token: __ENV.TOKEN, cookies: null };
  const { token, cookies } = loginOnce();
  if (!token && (!cookies || Object.keys(cookies).length === 0)) {
    fail('Login ok ma token/cookie assenti: controlla /auth/login');
  }
  return { token, cookies };
}

export function s_reads(data) {
  setExternalAuth(data);
  flow_reads();
}
