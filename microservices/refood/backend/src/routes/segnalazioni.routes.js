const express = require('express');
const router = express.Router();

const uploadSegnalazioni = require('../middlewares/uploadSegnalazioni');
const { authenticate, authorize } = require('../middlewares/auth');
const segnalazioniController = require('../controllers/segnalazioni.controller');

// POST /api/segnalazioni  (campo file: "images")
// Solo centri associati possono creare segnalazioni (e admin per test)
router.post('/', authenticate, authorize(['OperatoreCentro','Amministratore']), uploadSegnalazioni.array('images', 6), segnalazioniController.create);

// Avvio revisione (solo admin)
router.post('/:id/revisione/start', authenticate, authorize(['Amministratore']), segnalazioniController.startRevisione);

// Approva (chiude la segnalazione come "approvata")
router.post('/:id/revisione/approva', authenticate, authorize(['Amministratore']), segnalazioniController.approvaSegnalazione);

// // Rifiuta (chiude la segnalazione come "rifiutata", richiede motivo)
router.post('/:id/revisione/rifiuta', authenticate, authorize(['Amministratore']), segnalazioniController.rifiutaSegnalazione);

// router.post('/cleanup', authenticate, authorize(['Amministratore']), segnalazioniController.cleanupSegnalazioniChiuse);
// router.post('/cleanup', authenticate, segnalazioniController.cleanupSegnalazioniChiuse);

// GET /api/segnalazioni/:id
router.get('/:id', authenticate, authorize(['OperatoreCentro','Amministratore']), segnalazioniController.getOne);

// GET /api/segnalazioni
router.get('/', authenticate, authorize(['OperatoreCentro','Amministratore']), segnalazioniController.list);

// DELETE /api/segnalazioni/:id
router.delete('/:id', authenticate, authorize(['Amministratore']), segnalazioniController.remove);

module.exports = router;
