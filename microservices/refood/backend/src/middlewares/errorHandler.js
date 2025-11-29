const logger = require('../utils/logger');

/**
 * Classe per gli errori dell'API
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Middleware per la gestione degli errori
 */
const errorHandler = (err, req, res, _next) => {
  // Valori predefiniti dell'errore
  let { statusCode, message, isOperational } = err;
  
  if (!statusCode) {
    statusCode = 500;
  }

  // Log diverso per errori operazionali vs errori di programmazione
  if (!isOperational) {
    logger.error(`Errore non operazionale: ${message}`, { 
      error: err.stack,
      path: req.path, 
      method: req.method 
    });
  } else {
    logger.warn(`Errore: ${message}`, { 
      statusCode,
      path: req.path, 
      method: req.method 
    });
  }

  // Risposta in base all'ambiente
  const response = {
    status: 'error',
    message,
  };

  // In ambiente di sviluppo, invia dettagli stack
  if (process.env.NODE_ENV === 'development' && !isOperational) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  ApiError,
  errorHandler,
}; 
