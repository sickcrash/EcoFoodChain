const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const attoreRoutes = require('./attore.routes');
const tipoUtenteRoutes = require('./tipo_utente.routes');
const centriCompatRoutes = require('./centri_compat.routes');
const lottiRoutes = require('./lotti.routes');
const prenotazioniRoutes = require('./prenotazioni.routes');
const notificheRoutes = require('./notifiche.routes');
const statisticheRoutes = require('./statistiche.routes');
const reportRoutes = require('./report.routes');
const mappaRoutes = require('./mappa.routes');
const geocodingRoutes = require('./geocoding.routes');
const segnalazioniRoutes = require('./segnalazioni.routes');
const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check
 *     description: Verifica che l'API sia attiva
 *     responses:
 *       200:
 *         description: L'API è attiva e funzionante
 */
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'ReFood API v1',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /health-check:
 *   get:
 *     summary: Verifica lo stato dell'API
 *     description: Endpoint per verificare che il backend risponda
 *     responses:
 *       200:
 *         description: API funzionante
 */
router.get('/health-check', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const enableDebugRoutes = process.env.ENABLE_DEBUG_ROUTES === 'true' || (process.env.NODE_ENV !== 'production');
if (enableDebugRoutes) {
  /**
   * @swagger
   * /debug/database:
   *   get:
   *     summary: Verifica lo stato della connessione al database
   *     description: Disponibile solo in ambienti non production o con ENABLE_DEBUG_ROUTES=true
   *     responses:
   *       200:
   *         description: Informazioni sul database
   */
  router.get('/debug/database', async (req, res) => {
    try {
      const connectionTest = await db.testConnection();
      const tables = await db.all("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
      const lottiCount = await db.get("SELECT COUNT(*) as count FROM Lotti");

      res.json({
        status: connectionTest ? 'ok' : 'error',
        dbClient: db.client,
        tables: tables.map((t) => t.name),
        lottiCount: lottiCount ? lottiCount.count : 0,
        timestamp: new Date()
      });
    } catch (err) {
      logger.error(`Errore nella verifica del database: ${err.message}`);
      res.status(500).json({
        status: 'error',
        message: 'Errore nella verifica del database',
        timestamp: new Date()
      });
    }
  });
}

/**
 * @swagger
 * /healthcheck:
 *   get:
 *     summary: Alias health check
 *     responses:
 *       200:
 *         description: API funzionante
 */
router.get('/healthcheck', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

router.use('/auth', authRoutes);
router.use('/attori', attoreRoutes);

router.get('/users/profile', (req, res) => {
  logger.debug('Richiesta a /users/profile, reindirizzamento a /attori/profile');
  req.url = '/profile';
  attoreRoutes(req, res);
});

router.use('/tipi-utente', tipoUtenteRoutes);
router.use('/centri', centriCompatRoutes);
router.use('/lotti', lottiRoutes);
router.use('/segnalazioni', segnalazioniRoutes);
router.use('/prenotazioni', prenotazioniRoutes);
router.use('/notifiche', notificheRoutes);
router.use('/statistiche', statisticheRoutes);
router.use('/report', reportRoutes);
router.use('/mappa', mappaRoutes);
router.use('/geocoding', geocodingRoutes);

router.use((req, res, next) => {
  next(new ApiError(404, 'Risorsa non trovata'));
});

router.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Errore interno del server';

  logger.error(`API error ${statusCode} ${req.method} ${req.originalUrl}: ${message}`);
  if (err.stack) {
    logger.debug(err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    message
  });
});

module.exports = router;