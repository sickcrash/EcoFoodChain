// Environment bootstrap for Jest
// Load env from backend/.env and repo root .env first, then set sane defaults only if missing.
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';
// Avoid port conflicts
process.env.PORT = process.env.PORT || '0';
// Prevent server.js from starting HTTP listener during tests
process.env.DISABLE_HTTP_SERVER = 'true';
// Disable geocoding in tests to prevent external HTTP calls
process.env.GOOGLE_MAPS_API_KEY = '';
process.env.GOOGLE_GEOCODING_API_KEY = '';

// DB connection defaults for tests (do not override if already provided)
if (!process.env.PGHOST) process.env.PGHOST = 'localhost';
if (!process.env.PGPORT) process.env.PGPORT = '5432';
if (!process.env.PGDATABASE) process.env.PGDATABASE = 'refood';
if (!process.env.PGUSER) process.env.PGUSER = 'postgres';
if (!process.env.PGPASSWORD) process.env.PGPASSWORD = 'postgres';
