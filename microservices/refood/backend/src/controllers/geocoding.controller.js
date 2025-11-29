const geocodingService = require('../services/geocodingService');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

/**
 * Effettua il geocoding di un indirizzo
 */
const geocodeAddress = async (req, res, next) => {
  try {
    const { indirizzo, options = {} } = req.body;
    
    if (!indirizzo || typeof indirizzo !== 'string' || indirizzo.trim().length === 0) {
      throw new ApiError(400, 'Indirizzo richiesto');
    }
    
    if (!geocodingService.isConfigured()) {
      throw new ApiError(503, 'Servizio di geocoding non configurato');
    }
    
    logger.info(`Richiesta geocoding per: ${indirizzo}`);
    
    const result = await geocodingService.geocodeAddress(indirizzo, options);
    
    if (!result) {
      throw new ApiError(404, 'Nessun risultato trovato per l\'indirizzo specificato');
    }
    
    res.json({
      success: true,
      data: {
        input_address: indirizzo,
        formatted_address: result.formatted_address,
        coordinates: {
          lat: result.lat,
          lng: result.lng,
          latitudine: result.lat,  // Alias per compatibilità
          longitudine: result.lng  // Alias per compatibilità
        },
        confidence: result.confidence,
        provider: result.provider,
        place_id: result.place_id || null
      }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error(`Errore durante geocoding: ${error.message}`);
      next(new ApiError(500, `Errore del servizio di geocoding: ${error.message}`));
    }
  }
};

/**
 * Effettua il geocoding di più indirizzi in batch
 */
const geocodeMultipleAddresses = async (req, res, next) => {
  try {
    const { indirizzi, options = {} } = req.body;
    
    if (!Array.isArray(indirizzi) || indirizzi.length === 0) {
      throw new ApiError(400, 'Array di indirizzi richiesto');
    }
    
    if (indirizzi.length > 10) {
      throw new ApiError(400, 'Massimo 10 indirizzi per richiesta');
    }
    
    if (!geocodingService.isConfigured()) {
      throw new ApiError(503, 'Servizio di geocoding non configurato');
    }
    
    logger.info(`Richiesta geocoding batch per ${indirizzi.length} indirizzi`);
    
    const results = [];
    
    // Processa ogni indirizzo con un piccolo delay per rispettare i rate limits
    for (let i = 0; i < indirizzi.length; i++) {
      const indirizzo = indirizzi[i];
      
      if (!indirizzo || typeof indirizzo !== 'string') {
        results.push({
          input_address: indirizzo,
          success: false,
          error: 'Indirizzo non valido'
        });
        continue;
      }
      
      try {
        // Piccolo delay tra le richieste per evitare rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const result = await geocodingService.geocodeAddress(indirizzo, options);
        
        if (result) {
          results.push({
            input_address: indirizzo,
            success: true,
            formatted_address: result.formatted_address,
            coordinates: {
              lat: result.lat,
              lng: result.lng,
              latitudine: result.lat,
              longitudine: result.lng
            },
            confidence: result.confidence,
            provider: result.provider
          });
        } else {
          results.push({
            input_address: indirizzo,
            success: false,
            error: 'Nessun risultato trovato'
          });
        }
        
      } catch (error) {
        logger.warn(`Errore geocoding per "${indirizzo}": ${error.message}`);
        results.push({
          input_address: indirizzo,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      data: {
        total_addresses: indirizzi.length,
        successful_geocoding: successCount,
        failed_geocoding: indirizzi.length - successCount,
        results: results
      }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error(`Errore durante geocoding batch: ${error.message}`);
      next(new ApiError(500, `Errore del servizio di geocoding: ${error.message}`));
    }
  }
};

/**
 * Ottiene informazioni sul servizio di geocoding
 */
const getServiceInfo = async (req, res, next) => {
  try {
    const info = geocodingService.getServiceInfo();
    
    res.json({
      success: true,
      data: {
        ...info,
        status: info.configured ? 'available' : 'not_configured',
        endpoints: {
          single: '/api/v1/geocoding/address',
          batch: '/api/v1/geocoding/addresses',
          info: '/api/v1/geocoding/info'
        }
      }
    });
    
  } catch (error) {
    logger.error(`Errore durante il recupero info servizio: ${error.message}`);
    next(new ApiError(500, 'Errore durante il recupero delle informazioni del servizio'));
  }
};

/**
 * Aggiorna le coordinate di un Tipo_Utente esistente
 */
const updateTipoUtenteCoordinates = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { force_geocoding = false } = req.body;
    
    const db = require('../config/database');
    
    // Verifica che il tipo utente esista
    const tipoUtente = await db.get(
      'SELECT id, indirizzo, latitudine, longitudine FROM Tipo_Utente WHERE id = ?',
      [id]
    );
    
    if (!tipoUtente) {
      throw new ApiError(404, 'Tipo utente non trovato');
    }
    
    // Se ha già le coordinate e non è forzato, non fare nulla
    if (tipoUtente.latitudine && tipoUtente.longitudine && !force_geocoding) {
      return res.json({
        success: true,
        message: 'Coordinate già presenti',
        data: {
          id: tipoUtente.id,
          coordinates: {
            lat: tipoUtente.latitudine,
            lng: tipoUtente.longitudine
          },
          geocoding_performed: false
        }
      });
    }
    
    if (!tipoUtente.indirizzo) {
      throw new ApiError(400, 'Indirizzo non disponibile per il geocoding');
    }
    
    if (!geocodingService.isConfigured()) {
      throw new ApiError(503, 'Servizio di geocoding non configurato');
    }
    
    logger.info(`Aggiornamento coordinate per Tipo_Utente ID ${id}, indirizzo: ${tipoUtente.indirizzo}`);
    
    const result = await geocodingService.geocodeAddress(tipoUtente.indirizzo);
    
    if (!result) {
      throw new ApiError(404, 'Impossibile geocodificare l\'indirizzo');
    }
    
    // Aggiorna nel database
    await db.run(
      'UPDATE Tipo_Utente SET latitudine = ?, longitudine = ? WHERE id = ?',
      [result.lat, result.lng, id]
    );
    
    logger.info(`Coordinate aggiornate per Tipo_Utente ID ${id}: lat=${result.lat}, lng=${result.lng}`);
    
    res.json({
      success: true,
      message: 'Coordinate aggiornate con successo',
      data: {
        id: parseInt(id),
        input_address: tipoUtente.indirizzo,
        formatted_address: result.formatted_address,
        coordinates: {
          lat: result.lat,
          lng: result.lng,
          latitudine: result.lat,
          longitudine: result.lng
        },
        confidence: result.confidence,
        provider: result.provider,
        geocoding_performed: true
      }
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      logger.error(`Errore durante aggiornamento coordinate: ${error.message}`);
      next(new ApiError(500, `Errore durante l'aggiornamento: ${error.message}`));
    }
  }
};

module.exports = {
  geocodeAddress,
  geocodeMultipleAddresses,
  getServiceInfo,
  updateTipoUtenteCoordinates
};