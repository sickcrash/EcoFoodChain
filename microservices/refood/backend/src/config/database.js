const logger = require('../utils/logger');

// PostgreSQL only configuration
const adapter = require('./db/postgres');
logger.info('Database adapter selezionato: PostgreSQL');

module.exports = {
  client: 'postgres',
  run: adapter.run,
  get: adapter.get,
  all: adapter.all,
  exec: adapter.exec,
  testConnection: adapter.testConnection,
  getConnection: adapter.getConnection,
  closeDatabase: adapter.closeDatabase,
  query: adapter.query, // compat
  prepare: adapter.prepare,
};
