// tests/performance/scenarios/main.js
import { flow_auth, flow_reads, flow_write } from '../k6/lib/flows.js';
import { RAMPING_TARGET_RPS } from '../k6/lib/config.js';

function envNumber(name, fallback) {
  const raw = __ENV[name];
  if (!raw) return fallback;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function formatSeconds(value) {
  const secs = Math.max(1, Math.round(value));
  return `${secs}s`;
}

const stageFactor = envNumber('K6_STAGE_FACTOR', 0.25);
const stagesAuth = [
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.25), duration: formatSeconds(120 * stageFactor) },
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.5),  duration: formatSeconds(180 * stageFactor) },
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.75), duration: formatSeconds(180 * stageFactor) },
  { target: RAMPING_TARGET_RPS,                    duration: formatSeconds(240 * stageFactor) },
  { target: 0,                                     duration: formatSeconds(60 * stageFactor) },
];

const stagesReads = [
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.25), duration: formatSeconds(120 * stageFactor) },
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.5),  duration: formatSeconds(180 * stageFactor) },
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.75), duration: formatSeconds(180 * stageFactor) },
  { target: RAMPING_TARGET_RPS,                    duration: formatSeconds(240 * stageFactor) },
  { target: 0,                                     duration: formatSeconds(60 * stageFactor) },
];

const stagesWrites = [
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.2), duration: formatSeconds(120 * stageFactor) },
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.4), duration: formatSeconds(180 * stageFactor) },
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.6), duration: formatSeconds(180 * stageFactor) },
  { target: Math.ceil(RAMPING_TARGET_RPS * 0.8), duration: formatSeconds(240 * stageFactor) },
  { target: 0,                                    duration: formatSeconds(60 * stageFactor) },
];

const AUTH_P95 = envNumber('K6_AUTH_P95_MS', 3000);
const AUTH_P99 = envNumber('K6_AUTH_P99_MS', 4000);
const READS_P95 = envNumber('K6_READS_P95_MS', 300);
const READS_P99 = envNumber('K6_READS_P99_MS', 800);
const WRITES_P95 = envNumber('K6_WRITES_P95_MS', 500);
const WRITES_P99 = envNumber('K6_WRITES_P99_MS', 1200);

export const options = {
  scenarios: {
    auth: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: stagesAuth,
      exec: 's_auth',
    },
    reads: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: stagesReads,
      exec: 's_reads',
    },
    writes: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: stagesWrites,
      exec: 's_writes',
    },
  },
  thresholds: {
    'http_req_failed{scenario:auth}': ['rate<0.001'],
    'http_req_failed{scenario:reads}': ['rate<0.001'],
    'http_req_failed{scenario:writes}': ['rate<0.005'],
    'http_req_duration{scenario:auth}': [`p(95)<${AUTH_P95}`, `p(99)<${AUTH_P99}`],
    'http_req_duration{scenario:reads}': [`p(95)<${READS_P95}`, `p(99)<${READS_P99}`],
    'http_req_duration{scenario:writes}': [`p(95)<${WRITES_P95}`, `p(99)<${WRITES_P99}`],
  },
  summaryTrendStats: ['avg','min','max','p(50)','p(90)','p(95)','p(99)'],
};

export function s_auth() { flow_auth(); }
export function s_reads() { flow_reads(); }
export function s_writes() { flow_write(); }