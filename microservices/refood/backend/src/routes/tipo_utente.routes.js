const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const tipoUtenteController = require('../controllers/tipo_utente.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: TipiUtente
 *   description: API per la gestione dei tipi utente
 */

/**
 * @swagger
 * /api/tipi-utente:
 *   get:
 *     summary: Recupera tutti i tipi utente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Elenco dei tipi utente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       tipo:
 *                         type: string
 *                       indirizzo:
 *                         type: string
 *                       email:
 *                         type: string
 *                       telefono:
 *                         type: string
 *                       creato_il:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/', authenticate, tipoUtenteController.getTipiUtente);

/**
 * @swagger
 * /api/tipi-utente/miei:
 *   get:
 *     summary: Recupera tutti i tipi utente associati all'utente autenticato
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Elenco dei tipi utente dell'utente
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/miei', authenticate, tipoUtenteController.getMieiTipiUtente);

// Register static path '/tipi' before parameterized '/:id' to avoid matching 'tipi' as an id
router.get('/tipi', authenticate, tipoUtenteController.getTipi);

/**
 * @swagger
 * /api/tipi-utente/{id}:
 *   get:
 *     summary: Recupera un tipo utente per ID
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del tipo utente
 *     responses:
 *       200:
 *         description: Dettagli del tipo utente
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Tipo utente non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/:id', authenticate, tipoUtenteController.getTipoUtenteById);

/**
 * @swagger
 * /api/tipi-utente:
 *   post:
 *     summary: Crea un nuovo tipo utente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo
 *               - indirizzo
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [Privato, Canale sociale, centro riciclo]
 *               indirizzo:
 *                 type: string
 *               email:
 *                 type: string
 *               telefono:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tipo utente creato con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.post('/', authenticate, authorize(['Amministratore']), tipoUtenteController.createTipoUtente);

/**
 * @swagger
 * /api/tipi-utente/{id}:
 *   put:
 *     summary: Aggiorna un tipo utente esistente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del tipo utente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [Privato, Canale sociale, centro riciclo]
 *               indirizzo:
 *                 type: string
 *               email:
 *                 type: string
 *               telefono:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tipo utente aggiornato con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Accesso negato
 *       404:
 *         description: Tipo utente non trovato
 *       500:
 *         description: Errore del server
 */
router.put('/:id', authenticate, tipoUtenteController.updateTipoUtente);

/**
 * @swagger
 * /api/tipi-utente/{id}:
 *   delete:
 *     summary: Elimina un tipo utente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del tipo utente
 *     responses:
 *       200:
 *         description: Tipo utente eliminato con successo
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Accesso negato
 *       404:
 *         description: Tipo utente non trovato
 *       500:
 *         description: Errore del server
 */
router.delete('/:id', authenticate, authorize(['Amministratore']), tipoUtenteController.deleteTipoUtente);

/**
 * @swagger
 * /api/tipi-utente/tipi:
 *   get:
 *     summary: Recupera tutti i tipi disponibili (Privato, Canale sociale, centro riciclo)
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Elenco dei tipi
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/tipi', authenticate, tipoUtenteController.getTipi);

/**
 * @swagger
 * /api/tipi-utente/{id}/attori:
 *   get:
 *     summary: Recupera tutti gli attori associati a un tipo utente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del tipo utente
 *     responses:
 *       200:
 *         description: Elenco degli attori associati
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Accesso negato
 *       404:
 *         description: Tipo utente non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/:id/attori', authenticate, tipoUtenteController.getAttoriPerTipoUtente);

/**
 * @swagger
 * /api/tipi-utente/{id}/attori:
 *   post:
 *     summary: Associa un attore a un tipo utente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del tipo utente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attore_id
 *             properties:
 *               attore_id:
 *                 type: integer
 *               ruolo_specifico:
 *                 type: string
 *     responses:
 *       200:
 *         description: Attore associato con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Accesso negato
 *       404:
 *         description: Tipo utente o attore non trovato
 *       500:
 *         description: Errore del server
 */
router.post('/:id/attori', authenticate, tipoUtenteController.associaAttore);

/**
 * @swagger
 * /api/tipi-utente/{id}/attori/{attore_id}:
 *   delete:
 *     summary: Rimuove l'associazione tra un attore e un tipo utente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del tipo utente
 *       - in: path
 *         name: attore_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID dell'attore
 *     responses:
 *       200:
 *         description: Attore disassociato con successo
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Accesso negato
 *       404:
 *         description: Associazione non trovata
 *       500:
 *         description: Errore del server
 */
router.delete('/:id/attori/:attore_id', authenticate, tipoUtenteController.disassociaAttore);

/**
 * @swagger
 * /api/tipi-utente/{id}/attori/{attore_id}/ruolo:
 *   put:
 *     summary: Aggiorna il ruolo di un attore in un tipo utente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del tipo utente
 *       - in: path
 *         name: attore_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID dell'attore
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ruolo_specifico
 *             properties:
 *               ruolo_specifico:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ruolo aggiornato con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Accesso negato
 *       404:
 *         description: Associazione non trovata
 *       500:
 *         description: Errore del server
 */
router.put('/:id/attori/:attore_id/ruolo', authenticate, tipoUtenteController.aggiornaRuoloAttore);

/**
 * @swagger
 * /api/tipi-utente/attore/associazione-massiva:
 *   post:
 *     summary: Associa un attore a più tipi utente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attore_id
 *               - tipi_utente_ids
 *             properties:
 *               attore_id:
 *                 type: integer
 *               tipi_utente_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Attore associato con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Accesso negato
 *       500:
 *         description: Errore del server
 */
router.post('/attore/associazione-massiva', authenticate, authorize(['Amministratore']), tipoUtenteController.associaAttoreMassivo);

/**
 * @swagger
 * /api/tipi-utente/{id}/attori/associazione-massiva:
 *   post:
 *     summary: Associa più attori a un tipo utente
 *     tags: [TipiUtente]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del tipo utente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attori_ids
 *             properties:
 *               attori_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Attori associati con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Accesso negato
 *       404:
 *         description: Tipo utente non trovato
 *       500:
 *         description: Errore del server
 */
router.post('/:id/attori/associazione-massiva', authenticate, tipoUtenteController.associaAttoriMassivo);

module.exports = router; 
