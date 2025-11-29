const https = require('https');
const logger = require('../utils/logger');

/**
 * Service per il geocoding degli indirizzi utilizzando Google Maps Geocoding API
 * Converte indirizzi in coordinate geografiche (latitudine e longitudine)
 */
class GeocodingService {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;
    this.googleUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    
    if (!this.googleApiKey) {
      logger.warn('Google Maps API key non configurata. Il geocoding non sarà disponibile.');
    }
  }

  /**
   * Effettua il geocoding di un indirizzo utilizzando Google Maps API
   * @param {string} indirizzo - Indirizzo da geocodificare
   * @param {Object} options - Opzioni aggiuntive
   * @returns {Promise<{lat: number, lng: number, formatted_address: string}>}
   */
  async geocodeAddress(indirizzo, options = {}) {
    if (!indirizzo || typeof indirizzo !== 'string') {
      throw new Error('Indirizzo non valido');
    }

    if (!this.googleApiKey) {
      throw new Error('Google Maps API key non configurata');
    }

    // Pulisci e normalizza l'indirizzo
    const addressCleaned = this.cleanAddress(indirizzo);
    
    try {
      logger.info(`Geocoding con Google Maps per: ${addressCleaned}`);
      
      const result = await this.geocodeWithGoogle(addressCleaned, options);
      
      if (result) {
        logger.info(`Geocoding riuscito: lat=${result.lat}, lng=${result.lng}`);
        return result;
      }
      
      throw new Error('Nessun risultato di geocoding trovato');
    } catch (error) {
      logger.error(`Errore durante il geocoding di "${addressCleaned}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Geocoding con Google Maps API
   */
  async geocodeWithGoogle(address, options = {}) {
    const params = new URLSearchParams({
      address: address,
      key: this.googleApiKey,
      language: 'it',
      region: options.region || 'it',
      components: options.components || 'country:IT' // Limita i risultati all'Italia
    });

    const url = `${this.googleUrl}?${params}`;
    
    try {
      const response = await this.makeHttpsRequest(url);
      const data = JSON.parse(response);
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        
        return {
          lat: location.lat,
          lng: location.lng,
          latitudine: location.lat, // Alias per compatibilità con DB
          longitudine: location.lng, // Alias per compatibilità con DB
          formatted_address: result.formatted_address,
          address_components: result.address_components,
          place_id: result.place_id,
          confidence: this.calculateGoogleConfidence(result),
          provider: 'google_maps'
        };
      }
      
      // Gestisci errori specifici di Google Maps API
      if (data.status !== 'OK') {
        const errorMessages = {
          'ZERO_RESULTS': 'Nessun risultato trovato per questo indirizzo',
          'OVER_QUERY_LIMIT': 'Limite di query giornaliere superato',
          'REQUEST_DENIED': 'Richiesta negata - verifica API key',
          'INVALID_REQUEST': 'Richiesta non valida',
          'UNKNOWN_ERROR': 'Errore temporaneo del server'
        };
        
        const errorMessage = errorMessages[data.status] || `Errore Google API: ${data.status}`;
        logger.warn(`${errorMessage}${data.error_message ? ` - ${data.error_message}` : ''}`);
        throw new Error(errorMessage);
      }
      
      return null;
    } catch (error) {
      if (error.message.includes('Errore Google API') || error.message.includes('Nessun risultato')) {
        throw error; // Rilancia errori specifici
      }
      logger.error(`Errore nella chiamata a Google Geocoding API: ${error.message}`);
      throw new Error('Errore di connessione al servizio di geocoding');
    }
  }

  /**
   * Pulisce e normalizza un indirizzo
   */
  cleanAddress(address) {
    if (!address) return '';
    
    return address
      .trim()
      .replace(/\s+/g, ' ') // Rimuovi spazi multipli
      .replace(/[^\w\s,.-]/g, '') // Rimuovi caratteri speciali eccetto virgole, punti e trattini
      .replace(/\b(via|v\.?le|viale|piazza|p\.?za|corso|c\.?so|str|strada)\b/gi, (match) => {
        // Normalizza abbreviazioni comuni italiane
        const normalized = {
          'v.le': 'viale',
          'vle': 'viale',
          'p.za': 'piazza', 
          'pza': 'piazza',
          'c.so': 'corso',
          'cso': 'corso',
          'str': 'strada'
        };
        return normalized[match.toLowerCase()] || match.toLowerCase();
      });
  }

  /**
   * Calcola un punteggio di confidenza per Google Maps
   */
  calculateGoogleConfidence(result) {
    const locationType = result.geometry.location_type;
    const typeMapping = {
      'ROOFTOP': 95,           // Indirizzo esatto
      'RANGE_INTERPOLATED': 80, // Approssimazione tra due punti
      'GEOMETRIC_CENTER': 70,   // Centro geometrico
      'APPROXIMATE': 50         // Approssimativo
    };
    
    let confidence = typeMapping[locationType] || 50;
    
    // Bonus per tipi di luoghi specifici
    const types = result.types || [];
    if (types.includes('street_address')) confidence += 5;
    if (types.includes('premise')) confidence += 5;
    if (types.includes('subpremise')) confidence += 3;
    
    // Penalità per luoghi generici
    if (types.includes('locality') || types.includes('administrative_area')) {
      confidence -= 10;
    }
    
    return Math.min(Math.max(confidence, 0), 100);
  }

  /**
   * Effettua una richiesta HTTPS
   */
  makeHttpsRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const defaultHeaders = {
        'User-Agent': 'ReFood/1.0',
        'Accept': 'application/json',
        ...headers
      };

      const req = https.get(url, { headers: defaultHeaders }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Errore di rete: ${error.message}`));
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Timeout della richiesta'));
      });
    });
  }

  /**
   * Verifica se il servizio è configurato correttamente
   */
  isConfigured() {
    return !!this.googleApiKey;
  }

  /**
   * Ottiene informazioni sulla configurazione del servizio
   */
  getServiceInfo() {
    return {
      provider: 'Google Maps Geocoding API',
      configured: this.isConfigured(),
      api_key_present: !!this.googleApiKey,
      api_key_prefix: this.googleApiKey ? `${this.googleApiKey.substring(0, 8)}...` : null
    };
  }
}

module.exports = new GeocodingService();