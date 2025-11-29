// tests/performance/k6/lib/auth.js
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, LOGIN_ENDPOINT, USERNAME, PASSWORD, CENTER_USERNAME, CENTER_PASSWORD } from './config.js';

const credentialCache = new Map();

function cacheKey(username, password) {
  return `${username || ''}::${password || ''}`;
}

function mapCookies(res) {
  const cookies = {};
  if (res.cookies) {
    for (const name in res.cookies) {
      const arr = res.cookies[name];
      if (arr && arr.length > 0) cookies[name] = arr[0].value;
    }
  }
  return cookies;
}

export function extractTokenFromJson(obj) {
  if (!obj) return null;
  // Formati comuni
  if (obj.tokens && (obj.tokens.access || obj.tokens.token)) return obj.tokens.access || obj.tokens.token;
  return obj.token || obj.access || obj.accessToken || obj.access_token || obj.jwt ||
         (obj.data && (obj.data.token || obj.data.access || obj.data.accessToken || obj.data.jwt)) || null;
}

export function loginWithCredentials(username, password) {
  const key = cacheKey(username, password);
  if (credentialCache.has(key)) {
    return credentialCache.get(key);
  }

  const payload = JSON.stringify({ email: username, password });
  const res = http.post(`${BASE_URL}${LOGIN_ENDPOINT}`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: LOGIN_ENDPOINT, scenario_part: 'login' },
  });
  check(res, { 'login: 200/201': r => r.status === 200 || r.status === 201 });

  let token = null;
  try { token = extractTokenFromJson(res.json()); } catch (_) {}

  // Fallback da header Authorization: Bearer ...
  const ah = res.headers && (res.headers.Authorization || res.headers.authorization);
  if (!token && ah && ah.startsWith('Bearer ')) token = ah.slice(7);

  if (__ENV.DEBUG_AUTH) {
    try { console.log('AUTH body:', JSON.stringify(res.json())); } catch (_) { console.log('AUTH body raw:', res.body); }
    console.log('AUTH headers:', JSON.stringify(res.headers));
    console.log('AUTH cookies:', JSON.stringify(res.cookies));
  }

  const auth = { token, cookies: mapCookies(res) };
  credentialCache.set(key, auth);
  return auth;
}

export function loginOnce() {
  return loginWithCredentials(USERNAME, PASSWORD);
}

export function getToken() {
  const { token } = loginWithCredentials(USERNAME, PASSWORD);
  return token || null;
}

export function getAuthForCredentials(username, password) {
  return loginWithCredentials(username, password);
}

export function getCenterAuth() {
  return loginWithCredentials(CENTER_USERNAME, CENTER_PASSWORD);
}

export function resetAuthCache() {
  credentialCache.clear();
}