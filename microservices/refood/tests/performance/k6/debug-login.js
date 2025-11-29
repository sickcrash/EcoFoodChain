import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const res = http.post('http://localhost:3000/api/v1/auth/login', JSON.stringify({ email: 'adminBartolo@gmail.com', password: 'adminBartolo' }), { headers: { 'Content-Type': 'application/json' } });
  check(res, {
    'status 200': r => r.status === 200,
    'has token': r => !!r.json('tokens.access'),
  });
}