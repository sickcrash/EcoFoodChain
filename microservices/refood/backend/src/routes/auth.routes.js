const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const validator = require('../middlewares/validator');
const { authenticate } = require('../middlewares/auth');
const normalizeRole = require('../middlewares/normalizeRole');
const { password: passwordConfig } = require('../config/config');

const router = express.Router();
const PASSWORD_MIN_LENGTH = passwordConfig.minLength;
const passwordLengthMessage = `La password deve contenere almeno ${PASSWORD_MIN_LENGTH} caratteri`;

/**
 * @swagger
 * tags:
 *   name: Autenticazione
 *   description: Endpoints per la gestione dell'autenticazione
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Accedi all'applicazione
 *     tags: [Autenticazione]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               device_info:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login avvenuto con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     nome:
 *                       type: string
 *                     cognome:
 *                       type: string
 *                     ruolo:
 *                       type: string
 *                     ruolo_display:
 *                       type: string
 *                       description: Etichetta del ruolo per UI (es. "Centro associato")
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     access:
 *                       type: string
 *                     refresh:
 *                       type: string
 *                     expires:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Credenziali non valide
 */
router.post('/login', [
  body('email').isEmail().withMessage('Email non valida'),
  body('password').isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(passwordLengthMessage),
  validator.validate
], authController.login);

router.post('/reset-password', [
  body('email').isEmail().withMessage('Email non valida'),
  body('telefono').optional({ checkFalsy: true }).trim(),
  body('verifica_nome').optional({ checkFalsy: true }).trim(),
  body('nuova_password').isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(passwordLengthMessage),
  validator.validate
], authController.resetPasswordWithPhone);

/**
 * @swagger
 * /auth/verifica:
 *   get:
 *     summary: Verifica la validità del token
 *     description: Verifica se il token di accesso è ancora valido
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Token non valido o scaduto
 */
router.get('/verifica', authenticate, (req, res) => {
  res.json({ valid: true });
});

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Rinnova il token di accesso
 *     tags: [Autenticazione]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token rinnovato con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 expires:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Refresh token non valido o scaduto
 */
router.post('/refresh-token', [
  body('refresh_token').notEmpty().withMessage('Refresh token richiesto'),
  validator.validate
], authController.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout dall'applicazione
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout avvenuto con successo
 *       401:
 *         description: Non autenticato
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Logout da tutti i dispositivi
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout da tutti i dispositivi avvenuto con successo
 *       401:
 *         description: Non autenticato
 */
router.post('/logout-all', authenticate, authController.logoutAll);

/**
 * @swagger
 * /auth/active-sessions:
 *   get:
 *     summary: Ottieni tutte le sessioni attive dell'attore
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista di sessioni attive
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   device_info:
 *                     type: string
 *                   ip_address:
 *                     type: string
 *                   creato_il:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Non autenticato
 */
router.get('/active-sessions', authenticate, authController.getActiveSessions);

/**
 * @swagger
 * /auth/revoke-session/{id}:
 *   delete:
 *     summary: Revoca una sessione specifica
 *     tags: [Autenticazione]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della sessione
 *     responses:
 *       200:
 *         description: Sessione revocata con successo
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Sessione non trovata
 */
router.delete('/revoke-session/:id', authenticate, authController.revokeSession);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registra un nuovo attore nel sistema
 *     description: |
 *       Registra un nuovo attore nel sistema con diversi flussi:
 *       1. Organizzazione (ruolo = Operatore o Amministratore)
 *       2. Utente con associazione a un tipo (Privato, Canale sociale, Centro riciclo)
 *     tags: [Autenticazione]
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
 *                 minLength: 8
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               ruolo:
 *                 type: string
 *                 enum: [Operatore, Amministratore, Utente, OperatoreCentro]
 *               tipoUtente:
 *                 type: object
 *                 description: Richiesto se ruolo = Utente
 *                 properties:
 *                   tipo:
 *                     type: string
 *                     enum: [Privato, Canale sociale, centro riciclo]
 *                   indirizzo:
 *                     type: string
 *                   telefono:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *     responses:
 *       201:
 *         description: Attore registrato con successo
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
 *                     attore:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         email:
 *                           type: string
 *                         nome:
 *                           type: string
 *                         cognome:
 *                           type: string
 *                           nullable: true
 *                         ruolo:
 *                           type: string
 *                         ruolo_display:
 *                           type: string
 *                           description: Etichetta del ruolo per UI (es. "Centro associato")
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         expiresIn:
 *                           type: integer
 *       400:
 *         description: Dati non validi
 *       409:
 *         description: Email già registrata
 */
router.post('/register', [
  normalizeRole,
  body('email').isEmail().withMessage('Email non valida'),
  body('password').isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(passwordLengthMessage),
  body('nome').notEmpty().withMessage('Il nome è obbligatorio'),
  body('cognome').custom((value, { req }) => {
    const { ruolo, tipoUtente } = req.body;

    const cognomeObbligatorio =
      ruolo === 'Operatore' ||
      ruolo === 'Amministratore' ||
      ruolo === 'OperatoreCentro' ||
      (ruolo === 'Utente' && tipoUtente?.tipo === 'Privato');


    if (cognomeObbligatorio && (!value || value.trim() === '')) {
      throw new Error('Il cognome è obbligatorio');
    }

    return true;
  }),
  body('ruolo').isIn(['Operatore', 'Amministratore', 'Utente', 'OperatoreCentro']).withMessage('Ruolo non valido'),
  body('tipoUtente.tipo').optional().isIn(['Privato', 'Canale sociale', 'centro riciclo']).withMessage('Tipo utente non valido'),
  body('tipoUtente.indirizzo').optional().notEmpty().withMessage('Indirizzo obbligatorio per tipi utente'),
  validator.validate
], authController.register);

module.exports = router; 

