const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const http = require('http');

const isProd = process.env.NODE_ENV === 'production';
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const backendEnvPath = path.join(__dirname, '..', '.env');

const loadEnvIfExists = (filePath, options = {}) => {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, ...options });
  }
};

loadEnvIfExists(backendEnvPath);

if (process.env.LOAD_ROOT_ENV === 'true') {
  loadEnvIfExists(rootEnvPath);
}

const logger = require('./utils/logger');
const swaggerSetup = require('./utils/swagger');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');
const scheduler = require('./utils/scheduler');
const websocket = require('./utils/websocket');
const geocodingService = require('./services/geocodingService');
const { UPLOADS_DIR, SEGNALAZIONI_DIR } = require('./utils/files');

const app = express();

try {
  fs.mkdirSync(SEGNALAZIONI_DIR, { recursive: true });
} catch (err) {
  logger.error(`Impossibile creare la cartella di upload (${SEGNALAZIONI_DIR}): ${err.message}`);
  throw err;
}

app.use(helmet());

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.set('Content-Type', 'application/json; charset=utf-8');
    return originalJson(body);
  };
  next();
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

const requestDebug = String(process.env.HTTP_DEBUG_LOG || '').toLowerCase() === 'true';
if (requestDebug) {
  app.use((req, _res, next) => {
    logger.debug(`HTTP ${req.method} ${req.originalUrl}`);
    next();
  });
}

const API_PREFIX = process.env.API_PREFIX || '/api/v1';
app.use(API_PREFIX, routes);

swaggerSetup(app);

app.use('/static', express.static(path.join(__dirname, '../public')));

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/uploads', cors({ origin: '*' }));
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Risorsa non trovata'
  });
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const schedulerEnabled = process.env.ENABLE_SCHEDULER !== 'false';
const websocketEnabled = process.env.ENABLE_WEBSOCKET !== 'false';
let schedulerStarted = false;
let websocketStarted = false;

async function startServer() {
  try {
    server.listen(PORT, () => {
      logger.info(`Server avviato sulla porta ${PORT} in modalità ${process.env.NODE_ENV || 'development'}`);
      logger.info(`API disponibili su http://localhost:${PORT}${API_PREFIX}`);
      logger.info(`Documentazione API su http://localhost:${PORT}/api-docs`);

      try {
        if (geocodingService.isConfigured()) {
          const info = geocodingService.getServiceInfo();
          logger.info(`Geocoding Google configurato: API key attiva (prefix=${info.api_key_prefix})`);
        } else {
          logger.info('Geocoding non configurato: impostare GOOGLE_MAPS_API_KEY per abilitarlo');
        }
      } catch (err) {
        logger.warn(`Impossibile verificare la configurazione del geocoding: ${err.message}`);
      }

      if (schedulerEnabled) {
        scheduler.init();
        schedulerStarted = true;
      } else {
        logger.info('Scheduler disabilitato via variabile ENABLE_SCHEDULER');
      }

      if (websocketEnabled) {
        websocket.init(server);
        websocketStarted = true;
        logger.info(`WebSocket disponibile su ws://localhost:${PORT}${API_PREFIX}/notifications/ws`);
      } else {
        logger.info('WebSocket disabilitato via variabile ENABLE_WEBSOCKET');
      }
    });
  } catch (error) {
    logger.error(`Errore durante l'avvio del server: ${error.message}`);
    process.exit(1);
  }
}

if (process.env.DISABLE_HTTP_SERVER !== 'true' && process.env.NODE_ENV !== 'test') {
  startServer();
}

function gracefulShutdown(signal) {
  logger.info(`Ricevuto segnale ${signal}. Chiusura del server...`);

  if (schedulerStarted) {
    scheduler.stop();
  }

  if (websocketStarted) {
    websocket.stop();
  }

  server.close(() => {
    logger.info('Server chiuso correttamente');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
