/**
 * Compat router: maps legacy /centri endpoints to the new /tipi-utente handlers.
 * This preserves frontend compatibility without requiring legacy Centri tables.
 */
const express = require('express');
const { body, param } = require('express-validator');
const validator = require('../middlewares/validator');
const { authenticate, authorize } = require('../middlewares/auth');
const tipoUtenteController = require('../controllers/tipo_utente.controller');

const router = express.Router();

// List and CRUD map 1:1 to Tipo_Utente
router.get('/', authenticate, tipoUtenteController.getTipiUtente);

router.get('/:id', [
  authenticate,
  param('id').isInt().withMessage('ID deve essere un numero intero'),
  validator.validate,
], tipoUtenteController.getTipoUtenteById);

router.post('/', [
  authenticate,
  authorize(['Amministratore']),
  body('tipo').isString().withMessage('tipo richiesto'),
  body('indirizzo').optional().isString(),
  validator.validate,
], tipoUtenteController.createTipoUtente);

router.put('/:id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID deve essere un numero intero'),
  validator.validate,
], tipoUtenteController.updateTipoUtente);

router.delete('/:id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID deve essere un numero intero'),
  validator.validate,
], tipoUtenteController.deleteTipoUtente);

// Legacy association endpoints
// GET elenco utenti (attori) associati al centro
router.get('/:id/utenti', [
  authenticate,
  param('id').isInt().withMessage('ID deve essere un numero intero'),
  validator.validate,
], tipoUtenteController.getAttoriPerTipoUtente);

// POST associa un singolo utente (attore) al centro
router.post('/:id/utenti/:attore_id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID deve essere un numero intero'),
  param('attore_id').isInt().withMessage('ID attore deve essere un numero intero'),
  validator.validate,
], (req, res, next) => {
  // Adapt legacy path param to body for the new handler
  req.body = { ...(req.body || {}), attore_id: parseInt(req.params.attore_id, 10) };
  return tipoUtenteController.associaAttore(req, res, next);
});

// DELETE disassocia un singolo utente (attore) dal centro
router.delete('/:id/utenti/:attore_id', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID deve essere un numero intero'),
  param('attore_id').isInt().withMessage('ID attore deve essere un numero intero'),
  validator.validate,
], (req, res, next) => {
  // Forward to the corresponding disassociate handler
  req.params.attore_id = String(parseInt(req.params.attore_id, 10));
  return tipoUtenteController.disassociaAttore(req, res, next);
});

// POST associa operatori/amministratori in massa (body: operatori_ids, amministratori_ids)
router.post('/:id/operatori', [
  authenticate,
  authorize(['Amministratore']),
  param('id').isInt().withMessage('ID deve essere un numero intero'),
  body('operatori_ids').optional().isArray(),
  body('amministratori_ids').optional().isArray(),
  validator.validate,
], tipoUtenteController.associaOperatori);

// Statistiche legacy
router.get('/:id/statistiche', [
  authenticate,
  param('id').isInt().withMessage('ID deve essere un numero intero'),
  validator.validate,
], tipoUtenteController.getCentroStatistiche);

module.exports = router;

