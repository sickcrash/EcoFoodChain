const express = require('express');
const { body, param, query } = require('express-validator');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');
const centriController = require('../controllers/centri.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Centri
 *   description: Endpoints per la gestione dei centri che partecipano al sistema
 */

/**
 * @swagger
 * /centri:
 *   get:
 *     summary: Ottieni elenco centri
 *     description: Restituisce l'elenco dei centri filtrato in base ai parametri
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Filtra per tipo di centro
 *       - in: query
 *         name: nome
 *         schema:
 *           type: string
 *         description: Filtra per nome del centro
 *       - in: query
 *         name: raggio
 *         schema:
 *           type: number
 *         description: Raggio di ricerca in km
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitudine per ricerca geografica
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitudine per ricerca geografica
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Pagina dei risultati 
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Numero di risultati per pagina
 *     responses:
 *       200:
 *         description: Lista di centri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 */
router.get('/', authenticate, centriController.getCentri);

/**
 * @swagger
 * /centri/{id}:
 *   get:
 *     summary: Ottieni dettagli di un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
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
router.get('/:id', [
  authenticate,
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  validator.validate
], centriController.getCentroById);

/**
 * @swagger
 * /centri:
 *   post:
 *     summary: Crea un nuovo centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - tipo_id
 *               - indirizzo
 *             properties:
 *               nome:
 *                 type: string
 *               tipo_id:
 *                 type: integer
 *               indirizzo:
 *                 type: string
 *               telefono:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               latitudine:
 *                 type: number
 *               longitudine:
 *                 type: number
 *               descrizione:
 *                 type: string
 *               orari_apertura:
 *                 type: string
 *     responses:
 *       201:
 *         description: Centro creato con successo
 *       400:
 *         description: Dati non validi
 */
router.post('/', [
  authenticate,
  authorize(['Amministratore']),
  body('nome').isString().isLength({ min: 2 }).withMessage('Nome deve essere una stringa di almeno 2 caratteri'),
  body('tipo_id').isInt().withMessage('Tipo ID deve essere un numero intero'),
  body('indirizzo').isString().withMessage('Indirizzo deve essere una stringa'),
  body('telefono').optional().isString().withMessage('Telefono deve essere una stringa'),
  body('email').optional().isEmail().withMessage('Email non valida'),
  body('latitudine').optional().isFloat().withMessage('Latitudine deve essere un numero'),
  body('longitudine').optional().isFloat().withMessage('Longitudine deve essere un numero'),
  body('descrizione').optional().isString().withMessage('Descrizione deve essere una stringa'),
  body('orari_apertura').optional().isString().withMessage('Orari apertura deve essere una stringa'),
  validator.validate
], centriController.createCentro);

/**
 * @swagger
 * /centri/{id}:
 *   put:
 *     summary: Aggiorna un centro esistente
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               tipo_id:
 *                 type: integer
 *               indirizzo:
 *                 type: string
 *               telefono:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               latitudine:
 *                 type: number
 *               longitudine:
 *                 type: number
 *               descrizione:
 *                 type: string
 *               orari_apertura:
 *                 type: string
 *     responses:
 *       200:
 *         description: Centro aggiornato con successo
 *       400:
 *         description: Dati non validi
 *       404:
 *         description: Centro non trovato
 */
router.put('/:id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  body('nome').optional().isString().isLength({ min: 2 }).withMessage('Nome deve essere una stringa di almeno 2 caratteri'),
  body('tipo_id').optional().isInt().withMessage('Tipo ID deve essere un numero intero'),
  body('indirizzo').optional().isString().withMessage('Indirizzo deve essere una stringa'),
  body('telefono').optional().isString().withMessage('Telefono deve essere una stringa'),
  body('email').optional().isEmail().withMessage('Email non valida'),
  body('latitudine').optional().isFloat().withMessage('Latitudine deve essere un numero'),
  body('longitudine').optional().isFloat().withMessage('Longitudine deve essere un numero'),
  body('descrizione').optional().isString().withMessage('Descrizione deve essere una stringa'),
  body('orari_apertura').optional().isString().withMessage('Orari apertura deve essere una stringa'),
  validator.validate
], centriController.updateCentro);

/**
 * @swagger
 * /centri/{id}:
 *   delete:
 *     summary: Elimina un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *     responses:
 *       200:
 *         description: Centro eliminato con successo
 *       404:
 *         description: Centro non trovato
 *       400:
 *         description: Non è possibile eliminare il centro
 */
router.delete('/:id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  validator.validate
], centriController.deleteCentro);

/**
 * @swagger
 * /centri/tipi:
 *   get:
 *     summary: Ottieni tutti i tipi di centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista dei tipi di centro
 */
router.get('/tipi', authenticate, centriController.getCentriTipi);

/**
 * @swagger
 * /centri/{id}/attori:
 *   get:
 *     summary: Ottieni gli attori associati a un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *     responses:
 *       200:
 *         description: Lista degli attori del centro
 *       404:
 *         description: Centro non trovato
 */
router.get('/:id/attori', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  validator.validate
], centriController.getCentroAttori);

/**
 * @swagger
 * /centri/{id}/operatori:
 *   post:
 *     summary: Associa operatori e amministratori a un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operatori_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array di ID degli operatori da associare al centro
 *               amministratori_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array di ID degli amministratori da associare al centro (solo per SuperAdmin)
 *     responses:
 *       200:
 *         description: Attori associati con successo
 *       403:
 *         description: Non autorizzato (richiede SuperAdmin per aggiungere amministratori)
 *       404:
 *         description: Centro non trovato
 */
router.post('/:id/operatori', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  body('operatori_ids').optional().isArray().withMessage('operatori_ids deve essere un array'),
  body('operatori_ids.*').optional().isInt().withMessage('ID operatore deve essere un numero intero'),
  body('amministratori_ids').optional().isArray().withMessage('amministratori_ids deve essere un array'),
  body('amministratori_ids.*').optional().isInt().withMessage('ID amministratore deve essere un numero intero'),
  validator.validate
], centriController.associaOperatori);

/**
 * @swagger
 * /centri/{id}/attori/{attore_id}:
 *   post:
 *     summary: Associa un attore a un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *       - in: path
 *         name: attore_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'attore
 *     responses:
 *       201:
 *         description: Attore associato con successo
 *       404:
 *         description: Centro o attore non trovato
 *       409:
 *         description: Attore già associato al centro
 */
router.post('/:id/attori/:attore_id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  param('attore_id').isInt().withMessage('ID attore deve essere un numero intero'),
  validator.validate
], centriController.associaAttore);

/**
 * @swagger
 * /centri/{id}/attori/{attore_id}:
 *   delete:
 *     summary: Rimuovi un attore da un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *       - in: path
 *         name: attore_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'attore
 *     responses:
 *       200:
 *         description: Attore rimosso con successo
 *       404:
 *         description: Centro o attore non trovato
 *       400:
 *         description: Attore non associato al centro
 */
router.delete('/:id/attori/:attore_id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  param('attore_id').isInt().withMessage('ID attore deve essere un numero intero'),
  validator.validate
], centriController.rimuoviAttore);

/**
 * @swagger
 * /centri/{id}/statistiche:
 *   get:
 *     summary: Ottieni statistiche di un centro
 *     tags: [Centri]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del centro
 *       - in: query
 *         name: inizio
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inizio periodo (formato YYYY-MM-DD)
 *       - in: query
 *         name: fine
 *         schema:
 *           type: string
 *           format: date
 *         description: Data fine periodo (formato YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Statistiche del centro
 *       404:
 *         description: Centro non trovato
 */
router.get('/:id/statistiche', [
  authenticate,
  param('id').isInt().withMessage('ID centro deve essere un numero intero'),
  query('inizio').optional().isDate().withMessage('Data inizio deve essere una data valida'),
  query('fine').optional().isDate().withMessage('Data fine deve essere una data valida'),
  validator.validate
], centriController.getCentroStatistiche);

module.exports = router; 