const express = require('express');
const { query } = require('express-validator');
const mappaController = require('../controllers/mappa.controller');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Mappa
 *   description: Endpoints per la gestione della mappa e visualizzazione centri
 */

/**
 * @swagger
 * /mappa/centri:
 *   get:
 *     summary: Ottiene tutti i centri per la mappa
 *     description: Restituisce tutti i centri con coordinate geografiche per la visualizzazione su mappa
 *     tags: [Mappa]
 *     responses:
 *       200:
 *         description: Lista dei centri con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     centri:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           nome:
 *                             type: string
 *                           tipologia:
 *                             type: string
 *                           categoria:
 *                             type: string
 *                           indirizzo:
 *                             type: string
 *                           lat:
 *                             type: number
 *                           lng:
 *                             type: number
 *                           colore:
 *                             type: string
 *                           num_utenti:
 *                             type: integer
 *                     statistiche:
 *                       type: object
 */
const MAPPA_ROLES = [
  'Amministratore',
  'Operatore',
  'OperatoreCentro',
  'Utente',
  'Privato',
  'Canale Sociale',
  'Centro Riciclo',
  'TipoUtenteSociale',
  'TipoUtenteRiciclaggio',
  'CentroSociale',
  'CentroRiciclaggio'
];

// Consenti a tutti i ruoli abilitati alla schermata di consultare l'intera mappa
router.get('/centri', [authenticate, authorize(MAPPA_ROLES)], mappaController.getCentriMappa);

/**
 * @swagger
 * /mappa/centri/search:
 *   get:
 *     summary: Cerca centri per nome o indirizzo
 *     tags: [Mappa]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Termine di ricerca (minimo 2 caratteri)
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [Privato, "Canale sociale", "centro riciclo", tutti]
 *         description: Filtra per tipo di centro
 *       - in: query
 *         name: solo_con_coordinate
 *         schema:
 *           type: boolean
 *         description: Mostra solo centri con coordinate geografiche
 *     responses:
 *       200:
 *         description: Risultati della ricerca
 *       400:
 *         description: Query di ricerca non valida
 */
router.get('/centri/search', [
  authenticate,
  authorize(MAPPA_ROLES),
  query('q')
    .notEmpty()
    .withMessage('Query di ricerca richiesta')
    .isLength({ min: 2 })
    .withMessage('La query deve contenere almeno 2 caratteri'),
  query('tipo')
    .optional()
    .isIn(['Privato', 'Canale sociale', 'centro riciclo', 'tutti'])
    .withMessage('Tipo non valido'),
  query('solo_con_coordinate')
    .optional()
    .isBoolean()
    .withMessage('solo_con_coordinate deve essere true o false'),
  validator.validate
], mappaController.searchCentri);

/**
 * @swagger
 * /mappa/centri/{id}:
 *   get:
 *     summary: Ottiene dettagli di un centro specifico
 *     tags: [Mappa]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *     responses:
 *       200:
 *         description: Dettagli del centro
 *       404:
 *         description: Centro non trovato
 */
router.get('/centri/:id', [authenticate, authorize(MAPPA_ROLES)], mappaController.getCentroById);

/**
 * @swagger
 * /mappa/statistiche:
 *   get:
 *     summary: Ottiene statistiche sui centri
 *     tags: [Mappa]
 *     responses:
 *       200:
 *         description: Statistiche sui centri
 */
// Statistiche mappa consultabili da tutti i ruoli autenticati
router.get('/statistiche', authenticate, mappaController.getStatisticheCentri);

module.exports = router;
