const express = require('express');
const { body, param } = require('express-validator');
const geocodingController = require('../controllers/geocoding.controller');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Geocoding
 *   description: Endpoints per il geocoding di indirizzi
 */

/**
 * @swagger
 * /geocoding/address:
 *   post:
 *     summary: Effettua il geocoding di un singolo indirizzo
 *     tags: [Geocoding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - indirizzo
 *             properties:
 *               indirizzo:
 *                 type: string
 *                 description: Indirizzo da geocodificare
 *                 example: "Via Roma 123, Milano, Italy"
 *               options:
 *                 type: object
 *                 properties:
 *                   region:
 *                     type: string
 *                     example: "it"
 *                   components:
 *                     type: string
 *                     example: "country:IT"
 *     responses:
 *       200:
 *         description: Geocoding completato con successo
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
 *                     input_address:
 *                       type: string
 *                     formatted_address:
 *                       type: string
 *                     coordinates:
 *                       type: object
 *                       properties:
 *                         lat:
 *                           type: number
 *                         lng:
 *                           type: number
 *                         latitudine:
 *                           type: number
 *                         longitudine:
 *                           type: number
 *                     confidence:
 *                       type: number
 *                     provider:
 *                       type: string
 *       400:
 *         description: Indirizzo non valido
 *       404:
 *         description: Nessun risultato trovato
 *       503:
 *         description: Servizio di geocoding non configurato
 */
router.post('/address', [
  authenticate,
  authorize(['Amministratore', 'Operatore']), // Solo admin e operatori possono usare il geocoding
  body('indirizzo')
    .notEmpty()
    .withMessage('Indirizzo richiesto')
    .isLength({ min: 5, max: 500 })
    .withMessage('Indirizzo deve essere tra 5 e 500 caratteri'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options deve essere un oggetto'),
  validator.validate
], geocodingController.geocodeAddress);

/**
 * @swagger
 * /geocoding/addresses:
 *   post:
 *     summary: Effettua il geocoding di più indirizzi in batch
 *     tags: [Geocoding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - indirizzi
 *             properties:
 *               indirizzi:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *                 example: ["Via Roma 123, Milano", "Corso Italia 456, Roma"]
 *               options:
 *                 type: object
 *                 properties:
 *                   region:
 *                     type: string
 *                     example: "it"
 *     responses:
 *       200:
 *         description: Geocoding batch completato
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
 *                     total_addresses:
 *                       type: integer
 *                     successful_geocoding:
 *                       type: integer
 *                     failed_geocoding:
 *                       type: integer
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           input_address:
 *                             type: string
 *                           success:
 *                             type: boolean
 *                           formatted_address:
 *                             type: string
 *                           coordinates:
 *                             type: object
 *                           error:
 *                             type: string
 *       400:
 *         description: Dati non validi
 *       503:
 *         description: Servizio di geocoding non configurato
 */
router.post('/addresses', [
  authenticate,
  authorize(['Amministratore']), // Solo admin per operazioni batch
  body('indirizzi')
    .isArray({ min: 1, max: 10 })
    .withMessage('Array di indirizzi richiesto (massimo 10)'),
  body('indirizzi.*')
    .notEmpty()
    .withMessage('Ogni indirizzo non può essere vuoto')
    .isLength({ min: 5, max: 500 })
    .withMessage('Ogni indirizzo deve essere tra 5 e 500 caratteri'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options deve essere un oggetto'),
  validator.validate
], geocodingController.geocodeMultipleAddresses);

/**
 * @swagger
 * /geocoding/info:
 *   get:
 *     summary: Ottiene informazioni sul servizio di geocoding
 *     tags: [Geocoding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informazioni del servizio
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
 *                     provider:
 *                       type: string
 *                     configured:
 *                       type: boolean
 *                     status:
 *                       type: string
 *                     api_key_present:
 *                       type: boolean
 *                     endpoints:
 *                       type: object
 */
router.get('/info', [
  authenticate,
  authorize(['Amministratore', 'Operatore'])
], geocodingController.getServiceInfo);

/**
 * @swagger
 * /geocoding/tipo-utente/{id}/coordinates:
 *   patch:
 *     summary: Aggiorna le coordinate di un Tipo_Utente esistente
 *     tags: [Geocoding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del Tipo_Utente
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force_geocoding:
 *                 type: boolean
 *                 default: false
 *                 description: Forza il geocoding anche se le coordinate sono già presenti
 *     responses:
 *       200:
 *         description: Coordinate aggiornate con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     coordinates:
 *                       type: object
 *                       properties:
 *                         lat:
 *                           type: number
 *                         lng:
 *                           type: number
 *                     geocoding_performed:
 *                       type: boolean
 *       404:
 *         description: Tipo utente non trovato
 *       503:
 *         description: Servizio di geocoding non configurato
 */
router.patch('/tipo-utente/:id/coordinates', [
  authenticate,
  authorize(['Amministratore', 'Operatore']),
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID deve essere un numero intero positivo'),
  body('force_geocoding')
    .optional()
    .isBoolean()
    .withMessage('force_geocoding deve essere un boolean'),
  validator.validate
], geocodingController.updateTipoUtenteCoordinates);

module.exports = router;