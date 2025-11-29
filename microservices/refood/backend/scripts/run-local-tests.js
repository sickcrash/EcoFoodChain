#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const env = { ...process.env };

if (!env.TEST_API_BASE_URL) {
  env.TEST_API_BASE_URL = 'http://localhost:3000/api/v1';
}

const jestPath = require.resolve('jest/bin/jest');
const args = [jestPath, '--runInBand', '../tests/integration'];

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env,
  cwd: path.join(__dirname, '..'),
});

if (result.error) {
  console.error('Impossibile avviare jest:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);