const express = require('express');
const { body, param, query } = require('express-validator');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');
const lottiController = require('../controllers/lotti.controller');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Lotti
 *   description: Endpoints per la gestione dei lotti alimentari
 */

/**
 * @swagger
 * /lotti/test:
 *   get:
 *     summary: Test di connessione
 *     tags: [Lotti]
 *     responses:
 *       200:
 *         description: Test riuscito
 */
router.get('/test', (req, res) => {
  logger.debug('Endpoint /lotti/test chiamato');
  res.json({ message: 'Test endpoint funzionante', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /lotti/disponibili:
 *   get:
 *     summary: Ottieni lotti disponibili per prenotazione
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stato
 *         schema:
 *           type: string
 *           enum: [Verde, Arancione, Rosso]
 *         description: Filtra per stato
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
 *     responses:
 *       200:
 *         description: Lista di lotti disponibili
 */
router.get('/disponibili', [
  authenticate,
  authorize(['Utente', 'Operatore', 'Amministratore']),
  query('stato').optional().isString().isIn(['Verde', 'Arancione', 'Rosso']).withMessage('Stato non valido'),
  query('raggio').optional().isFloat({ min: 0.1 }).withMessage('Raggio deve essere un numero positivo'),
  query('lat').optional().isFloat().withMessage('Latitudine non valida'),
  query('lng').optional().isFloat().withMessage('Longitudine non valida'),
  validator.validate
], lottiController.getLottiDisponibili);

/**
 * @swagger
 * /lotti/test-create:
 *   post:
 *     summary: Test di creazione lotto semplificato
 *     tags: [Lotti]
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
 *               - quantita
 *             properties:
 *               nome:
 *                 type: string
 *               quantita:
 *                 type: number
 *               categoria:
 *                 type: string
 *               tipo_utente_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Lotto creato con successo
 *       401:
 *         description: Autenticazione richiesta
 *       500:
 *         description: Errore interno del server
 */
router.post('/test-create', authenticate, (req, res) => {
  res.status(410).json({ status: 'error', message: 'Endpoint di test disabilitato' });
});


/**
 * @swagger
 * /lotti/simple-test:
 *   post:
 *     summary: Endpoint semplificato per test
 *     tags: [Lotti]
 *     responses:
 *       200:
 *         description: Test eseguito con successo
 */
router.post("/simple-test", (req, res) => { 
  logger.debug('Body ricevuto dal test-create:', req.body); 
  res.json({ success: true, message: "Test eseguito con successo" }); 
});

/**
 * @swagger
 * /lotti/centri:
 *   get:
 *     summary: (DEPRECATA) Ottieni centri disponibili
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       410:
 *         description: API deprecata
 *       500:
 *         description: Errore interno del server
 */
router.get('/centri', [
  authenticate,
], (req, res) => {
  // Funzione di risposta che indica che l'API è deprecata
  res.status(410).json({
    message: "Questa API è deprecata. Non è più necessario selezionare il centro per la creazione o la gestione dei lotti. Il sistema è ora centralizzato."
  });
});

/**
 * @swagger
 * /lotti:
 *   get:
 *     summary: Ottieni elenco lotti
 *     description: Restituisce l'elenco dei lotti filtrato in base ai parametri
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stato
 *         schema:
 *           type: string
 *           enum: [Verde, Arancione, Rosso]
 *         description: Filtra per stato
 *       - in: query
 *         name: centro
 *         schema:
 *           type: integer
 *         description: Filtra per ID del centro origine
 *       - in: query
 *         name: scadenza_entro
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtra per scadenza entro una data
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
 *         description: Lista di lotti
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
router.get('/', authenticate, lottiController.getLotti);

/**
 * @swagger
 * /lotti:
 *   post:
 *     summary: Crea un nuovo lotto
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prodotto
 *               - quantita
 *               - unita_misura
 *               - data_scadenza
 *               - giorni_permanenza
 *             properties:
 *               prodotto:
 *                 type: string
 *               quantita:
 *                 type: number
 *               unita_misura:
 *                 type: string
 *               data_scadenza:
 *                 type: string
 *                 format: date
 *               giorni_permanenza:
 *                 type: integer
 *               categorie_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               prezzo:
 *                 type: number
 *                 description: Prezzo del lotto (solo per lotti verdi)
 *     responses:
 *       201:
 *         description: Lotto creato con successo
 *       400:
 *         description: Dati non validi
 */
router.post('/', [
  authenticate,
  authorize(['Operatore', 'Amministratore']),
  body('prodotto').isString().isLength({ min: 2 }).withMessage('Prodotto deve essere una stringa di almeno 2 caratteri'),
  body('quantita').isFloat({ min: 0.1 }).withMessage('Quantità deve essere un numero positivo'),
  body('unita_misura').isString().isIn(['kg', 'g', 'l', 'ml', 'pz']).withMessage('Unità di misura non valida'),
  body('data_scadenza').isDate().withMessage('Data di scadenza non valida'),
  body('giorni_permanenza').isInt({ min: 1 }).withMessage('Giorni di permanenza deve essere un numero intero positivo'),
  body('categorie_ids').optional().isArray().withMessage('Categorie deve essere un array di ID'),
  body('categorie_ids.*').optional().isInt().withMessage('ID categoria deve essere un numero intero'),
  body('prezzo').optional().isFloat({ min: 0 }).withMessage('Prezzo deve essere un numero positivo o zero'),
  validator.validate
], lottiController.createLotto);

/**
 * @swagger
 * /lotti/{id}:
 *   get:
 *     summary: Ottieni dettagli di un lotto
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del lotto
 *     responses:
 *       200:
 *         description: Dettagli del lotto
 *       404:
 *         description: Lotto non trovato
 */
router.get('/:id', [
  authenticate,
  param('id').isInt().withMessage('ID lotto deve essere un numero intero')
], lottiController.getLottoById);

/**
 * @swagger
 * /lotti/{id}/origini:
 *   get:
 *     summary: Ottieni informazioni sulla filiera di origine
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del lotto
 *     responses:
 *       200:
 *         description: Informazioni sulla filiera
 *       404:
 *         description: Lotto non trovato
 */
router.get('/:id/origini', [
  authenticate,
  param('id').isInt().withMessage('ID lotto deve essere un numero intero'),
  validator.validate
], lottiController.getOriginiLotto);

/**
 * @swagger
 * /lotti/{id}/impatto:
 *   get:
 *     summary: Ottieni informazioni sull'impatto ambientale ed economico
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del lotto
 *     responses:
 *       200:
 *         description: Informazioni sull'impatto
 *       404:
 *         description: Lotto non trovato
 */
router.get('/:id/impatto', [
  authenticate,
  param('id').isInt().withMessage('ID lotto deve essere un numero intero'),
  validator.validate
], lottiController.getImpattoLotto);

/**
 * @swagger
 * /lotti/{id}:
 *   put:
 *     summary: Aggiorna un lotto esistente
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prodotto:
 *                 type: string
 *               quantita:
 *                 type: number
 *               unita_misura:
 *                 type: string
 *               data_scadenza:
 *                 type: string
 *                 format: date
 *               giorni_permanenza:
 *                 type: integer
 *               stato:
 *                 type: string
 *                 enum: [Verde, Arancione, Rosso]
 *               prezzo:
 *                 type: number
 *                 description: Prezzo del lotto (solo per lotti verdi)
 *     responses:
 *       200:
 *         description: Lotto aggiornato con successo
 *       404:
 *         description: Lotto non trovato
 */
router.put('/:id', [
  authenticate,
  authorize(['Operatore', 'Amministratore']),
  param('id').isInt().withMessage('ID lotto deve essere un numero intero'),
  body('prodotto').optional().isString().isLength({ min: 2 }).withMessage('Prodotto deve essere una stringa di almeno 2 caratteri'),
  body('quantita').optional().isFloat({ min: 0.1 }).withMessage('Quantità deve essere un numero positivo'),
  body('unita_misura').optional().isString().isIn(['kg', 'g', 'l', 'ml', 'pz']).withMessage('Unità di misura non valida'),
  body('data_scadenza').optional().isDate().withMessage('Data di scadenza non valida'),
  body('giorni_permanenza').optional().isInt({ min: 1 }).withMessage('Giorni di permanenza deve essere un numero intero positivo'),
  body('stato').optional().isString().isIn(['Verde', 'Arancione', 'Rosso']).withMessage('Stato non valido'),
  body('prezzo').optional().isFloat({ min: 0 }).withMessage('Prezzo deve essere un numero positivo o zero'),
  validator.validate
], lottiController.updateLotto);

/**
 * @swagger
 * /lotti/{id}:
 *   delete:
 *     summary: Elimina un lotto
 *     tags: [Lotti]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del lotto
 *     responses:
 *       200:
 *         description: Lotto eliminato con successo
 *       404:
 *         description: Lotto non trovato
 */
router.delete('/:id', [
  authenticate,
  authorize(['Utente', 'Operatore', 'Amministratore']),
  param('id').isInt().withMessage('ID lotto deve essere un numero intero'),
  validator.validate
], lottiController.deleteLotto);

// Endpoint temporaneo per aggiornare direttamente il prezzo di un lotto
router.put('/:id/prezzo', [
  authenticate,
  authorize(['Operatore', 'Amministratore']),
  param('id').isInt().withMessage('ID lotto deve essere un numero intero'),
  body('prezzo').isFloat({ min: 0 }).withMessage('Prezzo deve essere un numero positivo o zero'),
  validator.validate
], async (req, res, next) => {
  try {
    const lottoId = req.params.id;
    const { prezzo } = req.body;
    
    // Verifica che il lotto esista
    const lotto = await db.get('SELECT * FROM Lotti WHERE id = ?', [lottoId]);
    if (!lotto) {
      return res.status(404).json({ status: 'error', message: 'Lotto non trovato' });
    }
    
    // Verifica che il lotto sia verde (solo i lotti verdi possono avere un prezzo diverso da 0)
    if (lotto.stato !== 'Verde' && prezzo > 0) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Solo i lotti verdi possono avere un prezzo. I lotti arancioni o rossi hanno automaticamente prezzo 0.'
      });
    }
    
    // Il prezzo effettivo da impostare
    const prezzoEffettivo = lotto.stato === 'Verde' ? prezzo : 0;
    
    // Aggiorna direttamente solo il prezzo
    await db.run('UPDATE Lotti SET prezzo = ? WHERE id = ?', [prezzoEffettivo, lottoId]);
    
    // Ottieni il lotto aggiornato
    const lottoAggiornato = await db.get('SELECT * FROM Lotti WHERE id = ?', [lottoId]);
    
    return res.json({
      status: 'success',
      message: 'Prezzo del lotto aggiornato con successo',
      data: lottoAggiornato
    });
  } catch (error) {
    logger.error('Errore nell\'aggiornamento del prezzo del lotto:', error);
    return next(error);
  }
});

// Middleware di autenticazione per le rotte successive
router.use(authenticate);

module.exports = router;
