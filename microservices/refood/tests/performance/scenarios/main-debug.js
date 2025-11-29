import { flow_auth, flow_reads, flow_write } from '../k6/lib/flows.js';
import { RAMPING_TARGET_RPS } from '../k6/lib/config.js';

const baseStageSeconds = Number(__ENV.K6_STAGE_SECONDS || 20);
const settleSeconds = Number(__ENV.K6_STAGE_COOLDOWN || Math.max(10, Math.floor(baseStageSeconds / 2)));

function duration(seconds) {
  return `${Math.max(1, Math.floor(seconds))}s`;
}

export const options = {
  scenarios: {
    auth: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 50,
      stages: [
        { target: Math.ceil(RAMPING_TARGET_RPS * 0.5), duration: duration(baseStageSeconds) },
        { target: RAMPING_TARGET_RPS, duration: duration(baseStageSeconds) },
        { target: 0, duration: duration(settleSeconds) },
      ],
      exec: 's_auth',
      gracefulStop: duration(settleSeconds),
    },
    reads: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 80,
      stages: [
        { target: Math.ceil(RAMPING_TARGET_RPS * 0.5), duration: duration(baseStageSeconds) },
        { target: RAMPING_TARGET_RPS, duration: duration(baseStageSeconds) },
        { target: 0, duration: duration(settleSeconds) },
      ],
      exec: 's_reads',
      gracefulStop: duration(settleSeconds),
    },
    writes: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 40,
      stages: [
        { target: Math.ceil(RAMPING_TARGET_RPS * 0.5), duration: duration(baseStageSeconds) },
        { target: Math.ceil(RAMPING_TARGET_RPS * 0.8), duration: duration(baseStageSeconds) },
        { target: 0, duration: duration(settleSeconds) },
      ],
      exec: 's_writes',
      gracefulStop: duration(settleSeconds),
    },
  },
  thresholds: {
    'http_req_failed{scenario:auth}': ['rate<0.01'],
    'http_req_failed{scenario:reads}': ['rate<0.01'],
    'http_req_failed{scenario:writes}': ['rate<0.02'],
  },
  summaryTrendStats: ['avg','min','max','p(50)','p(90)','p(95)','p(99)'],
};

export function s_auth() { flow_auth(); }
export function s_reads() { flow_reads(); }
export function s_writes() { flow_write(); }