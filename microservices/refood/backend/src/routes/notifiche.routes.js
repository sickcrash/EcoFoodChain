const express = require('express');
const router = express.Router();
const notificheController = require('../controllers/notifiche.controller');
const { authenticate } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Notifiche
 *   description: Endpoints per la gestione delle notifiche
 */

// Tutte le rotte delle notifiche richiedono autenticazione
router.use(authenticate);

/**
 * @swagger
 * /notifiche:
 *   get:
 *     summary: Recupera tutte le notifiche per l'attore corrente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Numero di pagina
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limite di risultati per pagina
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *         description: Filtra per tipo di notifica
 *       - in: query
 *         name: priorita
 *         schema:
 *           type: string
 *         description: Filtra per priorità
 *       - in: query
 *         name: letta
 *         schema:
 *           type: boolean
 *         description: Filtra per stato di lettura
 *     responses:
 *       200:
 *         description: Lista di notifiche
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/', notificheController.getNotifiche);

/**
 * @swagger
 * /notifiche:
 *   post:
 *     summary: Crea una nuova notifica
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titolo
 *               - messaggio
 *               - destinatario_id
 *             properties:
 *               titolo:
 *                 type: string
 *               messaggio:
 *                 type: string
 *               tipo:
 *                 type: string
 *                 default: 'Alert'
 *               priorita:
 *                 type: string
 *                 default: 'Media'
 *               destinatario_id:
 *                 type: integer
 *               riferimento_id:
 *                 type: integer
 *               riferimento_tipo:
 *                 type: string
 *               tipo_utente_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Notifica creata con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.post('/', notificheController.createNotifica);

/**
 * @swagger
 * /notifiche/conteggio:
 *   get:
 *     summary: Ottiene il conteggio delle notifiche non lette
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conteggio delle notifiche non lette
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/conteggio', notificheController.countUnread);

/**
 * @swagger
 * /notifiche/tutte-lette:
 *   put:
 *     summary: Segna tutte le notifiche come lette
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tutte le notifiche segnate come lette
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.put('/tutte-lette', notificheController.markAllAsRead);

/**
 * @swagger
 * /notifiche/sync:
 *   post:
 *     summary: Sincronizza una notifica locale con il server
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titolo
 *               - messaggio
 *             properties:
 *               titolo:
 *                 type: string
 *               messaggio:
 *                 type: string
 *               tipo:
 *                 type: string
 *                 default: 'Alert'
 *               priorita:
 *                 type: string
 *                 default: 'Media'
 *               letta:
 *                 type: boolean
 *                 default: false
 *               dataCreazione:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Notifica sincronizzata con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.post('/sync', notificheController.syncLocalNotifica);

/**
 * @swagger
 * /notifiche/centro-test:
 *   get:
 *     summary: Ottiene un centro valido per i test di notifica
 *     description: Questo endpoint restituisce un centro con amministratori associati che può essere utilizzato per testare l'invio di notifiche
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: TipoUtente di test recuperato con successo
 *       404:
 *         description: Nessun centro con amministratori trovato
 *       500:
 *         description: Errore del server
 */
router.get('/centro-test', notificheController.getTipoUtenteTestNotifiche);

/**
 * @swagger
 * /notifiche/admin-centro/{tipo_utente_id}:
 *   post:
 *     summary: Invia una notifica a tutti gli amministratori di un centro
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tipo_utente_id
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
 *             required:
 *               - titolo
 *               - messaggio
 *             properties:
 *               titolo:
 *                 type: string
 *               messaggio:
 *                 type: string
 *               tipo:
 *                 type: string
 *                 default: 'LottoModificato'
 *               priorita:
 *                 type: string
 *                 default: 'Media'
 *               riferimento_id:
 *                 type: integer
 *               riferimento_tipo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notifiche inviate con successo
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: TipoUtente non trovato
 *       500:
 *         description: Errore del server
 */
router.post('/admin-centro/:tipo_utente_id', notificheController.notifyAdmins);

/**
 * @swagger
 * /notifiche/{id}:
 *   get:
 *     summary: Recupera dettagli di una notifica specifica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della notifica
 *     responses:
 *       200:
 *         description: Dettagli della notifica
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Notifica non trovata
 *       500:
 *         description: Errore del server
 */
router.get('/:id', notificheController.getNotificaById);

/**
 * @swagger
 * /notifiche/{id}/letta:
 *   put:
 *     summary: Segna una notifica come letta
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della notifica
 *     responses:
 *       200:
 *         description: Notifica segnata come letta
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Notifica non trovata
 *       500:
 *         description: Errore del server
 */
router.put('/:id/letta', notificheController.markAsRead);

/**
 * @swagger
 * /notifiche/{id}:
 *   delete:
 *     summary: Elimina una notifica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID della notifica
 *     responses:
 *       200:
 *         description: Notifica eliminata con successo
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Notifica non trovata
 *       500:
 *         description: Errore del server
 */
router.delete('/:id', notificheController.deleteNotifica);

/**
 * Rotte alternative per la retrocompatibilità
 */
router.get('/non-lette', notificheController.countUnread);
router.patch('/:id/letta', notificheController.markAsRead);
router.patch('/lette-tutte', notificheController.markAllAsRead);

module.exports = router; 