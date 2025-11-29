/**
 * Redirect temporaneo dalle vecchie rotte /centri alle nuove /tipi-utente
 * Da rimuovere quando tutti i client sono stati aggiornati
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Log di redirect per tutte le richieste a /centri
router.use((req, res) => {
  const originalUrl = req.originalUrl;
  const newUrl = originalUrl.replace('/centri', '/tipi-utente');
  
  logger.info(`Redirecting deprecated route: ${originalUrl} -> ${newUrl}`);
  
  // Mantieni il metodo HTTP originale
  res.redirect(307, newUrl);
});

module.exports = router;
