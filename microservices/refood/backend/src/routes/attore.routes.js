const express = require('express');
const { body } = require('express-validator');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');
const attoreController = require('../controllers/attore.controller');
const { password: passwordConfig } = require('../config/config');

const router = express.Router();
const PASSWORD_MIN_LENGTH = passwordConfig.minLength;
const passwordLengthMessage = `La password deve contenere almeno ${PASSWORD_MIN_LENGTH} caratteri`;

/**
 * @swagger
 * tags:
 *   name: Attori
 *   description: Endpoints per la gestione degli attori
 */

/**
 * @swagger
 * /attori/profile:
 *   get:
 *     summary: Ottiene il profilo dell'attore corrente
 *     tags: [Attori]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profilo attore
 *       401:
 *         description: Non autenticato
 */
router.get('/profile', authenticate, attoreController.getProfile);

/**
 * @swagger
 * /attori/me:
 *   get:
 *     summary: Ottiene il profilo dell'attore corrente
 *     tags: [Attori]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profilo attore
 *       401:
 *         description: Non autenticato
 */
router.get('/me', authenticate, attoreController.getProfile);

/**
 * @swagger
 * /attori/profile:
 *   put:
 *     summary: Aggiorna il profilo dell'attore corrente
 *     tags: [Attori]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Profilo aggiornato con successo
 *       400:
 *         description: Errore di validazione
 *       401:
 *         description: Non autenticato
 */
router.put('/profile', [
  authenticate,
  body('email').optional().isEmail().withMessage('Email non valida'),
  body('password').optional().isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(passwordLengthMessage),
  validator.validate
], attoreController.updateProfile);

/**
 * @swagger
 * /attori:
 *   get:
 *     summary: Ottiene l'elenco degli attori
 *     tags: [Attori]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ruolo
 *         schema:
 *           type: string
 *         description: Filtra per ruolo
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numero di pagina
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Numero di risultati per pagina
 *     responses:
 *       200:
 *         description: Elenco degli attori
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 */
router.get('/', [
  authenticate,
  authorize('Amministratore')
], attoreController.getAllAttori);

/**
 * @swagger
 * /attori/{id}:
 *   get:
 *     summary: Ottiene un attore specifico
 *     tags: [Attori]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'attore
 *     responses:
 *       200:
 *         description: Dettagli dell'attore
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Attore non trovato
 */
router.get('/:id', [
  authenticate,
  authorize('Amministratore')
], attoreController.getAttoreById);

/**
 * @swagger
 * /attori:
 *   post:
 *     summary: Crea un nuovo attore
 *     tags: [Attori]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nome
 *               - cognome
 *               - ruolo
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               ruolo:
 *                 type: string
 *                 enum: [Operatore, Amministratore, CentroSociale, CentroRiciclaggio]
 *     responses:
 *       201:
 *         description: Attore creato con successo
 *       400:
 *         description: Errore di validazione
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 */
router.post('/', [
  authenticate,
  authorize('Amministratore'),
  body('email').isEmail().withMessage('Email non valida'),
  body('password').isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(passwordLengthMessage),
  body('nome').notEmpty().withMessage('Nome è richiesto'),
  body('cognome').notEmpty().withMessage('Cognome è richiesto'),
  body('ruolo').isIn(['Operatore', 'Amministratore', 'CentroSociale', 'CentroRiciclaggio']).withMessage('Ruolo non valido'),
  validator.validate
], attoreController.createAttore);

/**
 * @swagger
 * /attori/{id}:
 *   put:
 *     summary: Aggiorna un attore
 *     tags: [Attori]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID dell'attore
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               ruolo:
 *                 type: string
 *                 enum: [Operatore, Amministratore, CentroSociale, CentroRiciclaggio]
 *     responses:
 *       200:
 *         description: Attore aggiornato con successo
 *       400:
 *         description: Errore di validazione
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato
 *       404:
 *         description: Attore non trovato
 */
router.put('/:id', [
  authenticate,
  authorize('Amministratore'),
  body('email').optional().isEmail().withMessage('Email non valida'),
  body('password').optional().isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(passwordLengthMessage),
  body('ruolo').optional().isIn(['Operatore', 'Amministratore', 'CentroSociale', 'CentroRiciclaggio']).withMessage('Ruolo non valido'),
  validator.validate
], attoreController.updateAttore);

/**
 * @swagger
 * /attori/me:
 *   delete:
 *     summary: Elimina (soft-delete) il proprio account
 *     description: Disabilita e anonimizza l'account corrente, revocando tutti i token
 *     tags: [Attori]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [confirm]
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 example: true
 *               motivo:
 *                 type: string
 *                 example: "Richiesta utente"
 *     responses:
 *       200:
 *         description: Account eliminato
 *       400:
 *         description: Conferma mancante
 *       401:
 *         description: Non autenticato
 */
router.delete('/me', [
  authenticate,
  validator.validate
], attoreController.softDeleteMe);

module.exports = router;

