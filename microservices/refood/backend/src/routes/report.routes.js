const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { query } = require('express-validator');
const validator = require('../middlewares/validator');
const reportController = require('../controllers/report.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Report
 *   description: Endpoints per reportistica ed export dati
 */

/**
 * @swagger
 * /report/lotti-completati:
 *   get:
 *     summary: Esporta lotti completati (prenotazioni consegnate)
 *     tags: [Report]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inizio (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Data fine (YYYY-MM-DD)
 *       - in: query
 *         name: formato
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: csv
 *       - in: query
 *         name: download
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: false
 *     responses:
 *       200:
 *         description: Report generato
 */
router.get('/lotti-completati', [
  authenticate,
  authorize(['Amministratore']),
  query('from').optional().isISO8601().withMessage('from non è una data valida'),
  query('to').optional().isISO8601().withMessage('to non è una data valida'),
  query('formato').optional().isIn(['csv','json']).withMessage('formato non valido'),
  validator.validate,
], reportController.lottiCompletati);

module.exports = router;

