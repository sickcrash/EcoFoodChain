const { validationResult } = require('express-validator');
/**
 * Middleware per validare le richieste usando express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Estrai solo i messaggi di errore
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg
    }));
    
    // Restituisci il primo messaggio di errore come messaggio principale
    const mainMessage = errorMessages[0].message;
    
    // Aggiungi tutti gli errori di validazione alla risposta
    return res.status(400).json({
      status: 'error',
      message: mainMessage,
      errors: errorMessages
    });
  }
  
  next();
};

module.exports = {
  validate
}; 
