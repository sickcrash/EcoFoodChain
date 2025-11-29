// tests/performance/k6/lib/config.js
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const LOGIN_ENDPOINT = __ENV.LOGIN_ENDPOINT || '/api/v1/auth/login';
export const PROFILE_ENDPOINT = __ENV.PROFILE_ENDPOINT || '/api/v1/attori/profile';
export const NOTIF_COUNT_ENDPOINT = __ENV.NOTIF_COUNT_ENDPOINT || '/api/v1/notifiche/conteggio';
export const LOTTI_ENDPOINT = __ENV.LOTTI_ENDPOINT || '/api/v1/lotti';
export const WRITE_ENDPOINT = __ENV.WRITE_ENDPOINT || '/api/v1/segnalazioni';

export const USERNAME = __ENV.K6_EMAIL || __ENV.TEST_USER_EMAIL || __ENV.USERNAME || 'adminBartolo@gmail.com';
export const PASSWORD = __ENV.K6_PASSWORD || __ENV.TEST_USER_PASSWORD || __ENV.PASSWORD || 'adminBartolo';
export const CENTER_USERNAME = __ENV.CENTER_USERNAME || USERNAME;
export const CENTER_PASSWORD = __ENV.CENTER_PASSWORD || PASSWORD;

export const RAMPING_TARGET_RPS = Number(__ENV.RAMPING_TARGET_RPS || 60);
export const SOAK_RPS = Number(__ENV.SOAK_RPS || 20);
export const SOAK_DURATION = __ENV.SOAK_DURATION || '2h';
