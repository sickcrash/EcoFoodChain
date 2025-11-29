const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const statisticheController = require('../controllers/statistiche.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Statistiche
 *   description: Endpoints per ottenere statistiche e reportistica del sistema
 */

/**
 * @swagger
 * /statistiche/counters:
 *   get:
 *     summary: Ottieni contatori generali del sistema
 *     description: Restituisce contatori generali delle entità principali del sistema
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contatori del sistema
 */
router.get('/counters', authenticate, authorize(['Amministratore','Operatore','OperatoreCentro','Utente']), statisticheController.getCounters);

/**
 * @swagger
 * /statistiche/impatto:
 *   get:
 *     summary: Ottiene le statistiche di impatto del sistema
 *     description: Restituisce le statistiche di impatto ambientale ed economico del sistema
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiche di impatto ottenute con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 co2_risparmiata_kg:
 *                   type: number
 *                 valore_economico_risparmiato:
 *                   type: number
 *                 cibo_salvato_kg:
 *                   type: number
 *                 acqua_risparmiata_litri:
 *                   type: number
 *                 terreno_risparmiato_mq:
 *                   type: number
 *                 lotti_salvati:
 *                   type: integer
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/impatto', authenticate, authorize(['Amministratore','Operatore','OperatoreCentro','Utente']), statisticheController.getImpatto);

/**
 * @swagger
 * /statistiche/complete:
 *   get:
 *     summary: Ottiene statistiche complete per l'app mobile
 *     description: Restituisce un set completo di statistiche per visualizzazioni dashboard
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           default: ultimi_12_mesi
 *         description: Periodo per cui generare le statistiche
 *     responses:
 *       200:
 *         description: Statistiche complete ottenute con successo
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/complete', authenticate, authorize(['Amministratore','Operatore','OperatoreCentro','Utente']), statisticheController.getStatisticheComplete);

/**
 * @swagger
 * /statistiche/tipo-utente:
 *   get:
 *     summary: Ottiene statistiche relative a un tipo utente
 *     description: Restituisce i dati statistici su lotti, prenotazioni e attività di un tipo utente
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo_utente_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del tipo utente
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           default: ultimi_12_mesi
 *         description: Periodo per cui generare le statistiche
 *     responses:
 *       200:
 *         description: Statistiche del tipo utente ottenute con successo
 *       400:
 *         description: ID del tipo utente mancante
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Tipo utente non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/tipo-utente', authenticate, authorize(['Amministratore','Operatore','OperatoreCentro','Utente']), statisticheController.getStatisticheTipoUtente);

/**
 * @swagger
 * /statistiche/efficienza:
 *   get:
 *     summary: Ottiene statistiche di efficienza del sistema
 *     description: Restituisce dati sull'efficienza operativa come tempi medi e completamento
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiche di efficienza ottenute con successo
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/efficienza', authenticate, authorize(['Amministratore','Operatore','OperatoreCentro','Utente']), statisticheController.getStatisticheEfficienza);

/**
 * @swagger
 * /statistiche/giornalieri:
 *   get:
 *     summary: Serie giornaliere per grafici
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Numero di giorni da includere
 *     responses:
 *       200:
 *         description: Serie giornaliere restituite
 */
router.get('/giornalieri', authenticate, authorize(['Amministratore','Operatore','OperatoreCentro','Utente']), statisticheController.getStatisticheGiornaliere);

/**
 * @swagger
 * /statistiche/esporta:
 *   get:
 *     summary: Esporta statistiche in formato CSV
 *     description: Genera un file CSV con statistiche esportabili
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           default: ultimi_12_mesi
 *         description: Periodo per cui esportare le statistiche
 *       - in: query
 *         name: formato
 *         schema:
 *           type: string
 *           default: csv
 *         description: Formato di esportazione
 *     responses:
 *       200:
 *         description: CSV generato con successo
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/esporta', authenticate, authorize(['Amministratore','Operatore','OperatoreCentro','Utente']), statisticheController.esportaStatistiche);

/**
 * @swagger
 * /statistiche/per-mese:
 *   get:
 *     summary: Serie mensili di prenotazioni e lotti consegnati
 *     description: Restituisce due serie aggregate per mese per gli ultimi N mesi
 *     tags: [Statistiche]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *           minimum: 1
 *           maximum: 60
 *         description: Numero di mesi da includere (fino al corrente)
 *     responses:
 *       200:
 *         description: Serie mensili restituite
 */
router.get('/per-mese', authenticate, authorize(['Amministratore','Operatore','OperatoreCentro','Utente']), statisticheController.getSeriePerMese);

module.exports = router; 
