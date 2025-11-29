#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');

const isProd = process.env.NODE_ENV === 'production';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: !isProd });

const db = require('../config/database');
const logger = require('../utils/logger');

async function invalidateRefreshTokens() {
  logger.info('Starting refresh token invalidation...');

  try {
    await db.run('DELETE FROM TokenRevocati');
    const result = await db.run('DELETE FROM TokenAutenticazione');

    logger.info(`Refresh tokens invalidated. Sessions removed: ${result?.changes ?? 0}`);
    logger.info('Done. All users must log in again.');
  } catch (error) {
    logger.error(`Failed to invalidate refresh tokens: ${error.message}`);
    logger.error(error.stack || error);
    process.exitCode = 1;
    return;
  }
}

invalidateRefreshTokens().finally(() => {
  if (typeof db.closeDatabase === 'function') {
    db.closeDatabase().catch(() => {});
  }
});