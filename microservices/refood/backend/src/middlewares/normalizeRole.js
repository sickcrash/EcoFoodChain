const { normalizeRole } = require('../utils/roles');

// Normalizza alias di ruolo in forma canonica prima della validazione
module.exports = function normalizeRoleMiddleware(req, res, next) {
  try {
    if (req.body && typeof req.body.ruolo !== 'undefined') {
      const normalized = normalizeRole(req.body.ruolo);
      if (normalized) {
        req.body.ruolo = normalized;
      }
    }
    next();
  } catch (e) {
    next(e);
  }
};

