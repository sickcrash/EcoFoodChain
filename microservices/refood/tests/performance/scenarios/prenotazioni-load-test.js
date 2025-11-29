import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Metriche personalizzate
const getPrenotazioniTrend = new Trend('get_prenotazioni_duration');
const createPrenotazioneTrend = new Trend('create_prenotazione_duration');
const updatePrenotazioneTrend = new Trend('update_prenotazione_duration');
const errorRate = new Rate('error_rate');
const requestCounter = new Counter('total_requests');

// Configurazione del test
export const options = {
  scenarios: {
    // Scenario 1: Utenti che visualizzano le proprie prenotazioni
    browse_prenotazioni: {
      executor: 'constant-vus',
      vus: 3,
      duration: '20s',
      gracefulStop: '5s',
      exec: 'browsePrenotazioni',
      tags: { scenario: 'browse_prenotazioni' }
    },
    
    // Scenario 2: Picco di prenotazioni (simulazione di rilascio lotti)
    booking_rush: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '5s', target: 8 },   // ramp-up a 8 utenti in 5s
        { duration: '15s', target: 8 },  // mantieni 8 utenti per 15s
        { duration: '5s', target: 0 },   // ramp-down a 0
      ],
      gracefulStop: '5s',
      exec: 'createBookings',
      tags: { scenario: 'booking_rush' }
    }
  },
  thresholds: {
    'get_prenotazioni_duration': ['p(95)<400'],      // 95% delle richieste sotto 400ms
    'create_prenotazione_duration': ['avg<700'],     // Tempo medio di creazione sotto 700ms
    'update_prenotazione_duration': ['avg<500'],     // Tempo medio di aggiornamento sotto 500ms
    'error_rate': ['rate<0.1'],                     // Tasso di errore inferiore al 10%
    'http_req_duration': ['p(95)<800'],             // 95% di tutte le richieste sotto 800ms
  },
};

// Ottieni un token di autenticazione
function getToken(userType = 'normal') {
  // Per questo esempio, usiamo token finti basati sul tipo di utente
  if (userType === 'beneficiary') {
    return 'eyJhbG...BENEFICIARY_TOKEN';
  } else {
    return 'eyJhbG...USER_TOKEN';
  }
}

// Funzione per ottenere ID di lotti disponibili
function getAvailableLotti(token) {
  const baseUrl = 'http://localhost:3000/api';
  
  const res = http.get(`${baseUrl}/lotti?page=1&limit=5&stato=Verde`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  requestCounter.add(1);
  
  try {
    const body = JSON.parse(res.body);
    if (body.lotti && Array.isArray(body.lotti) && body.lotti.length > 0) {
      return body.lotti.map(lotto => lotto.id);
    }
  } catch (e) {
    errorRate.add(1);
  }
  
  // Se non ci sono lotti disponibili o c'è un errore, restituisci una lista di ID fittizi
  return [1, 2, 3, 4, 5];
}

// Scenario 1: Navigazione delle proprie prenotazioni
export function browsePrenotazioni() {
  const token = getToken('beneficiary');
  const baseUrl = 'http://localhost:3000/api';
  
  group('Browse Prenotazioni', () => {
    const startTime = new Date();
    const res = http.get(`${baseUrl}/prenotazioni`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const duration = new Date() - startTime;
    
    getPrenotazioniTrend.add(duration);
    requestCounter.add(1);
    
    const success = check(res, {
      'Stato 200 per lista prenotazioni': (r) => r.status === 200,
      'Formato risposta corretto': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.prenotazioni);
        } catch (e) {
          return false;
        }
      }
    });
    
    if (!success) {
      errorRate.add(1);
      console.error(`Errore nella chiamata GET /prenotazioni: ${res.status}`);
    }
    
    // Ottieni dettagli di una prenotazione specifica se ce ne sono
    let prenotazioneId = null;
    try {
      const body = JSON.parse(res.body);
      if (body.prenotazioni && body.prenotazioni.length > 0) {
        prenotazioneId = body.prenotazioni[0].id;
      }
    } catch (e) {
      // Ignora errori di parsing
    }
    
    if (prenotazioneId) {
      const detailRes = http.get(`${baseUrl}/prenotazioni/${prenotazioneId}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      requestCounter.add(1);
      
      check(detailRes, {
        'Stato 200 per dettaglio prenotazione': (r) => r.status === 200
      });
    }
  });
  
  sleep(randomIntBetween(1, 3));
}

// Scenario 2: Creazione di prenotazioni (simulazione di corsa alle prenotazioni)
export function createBookings() {
  const token = getToken('beneficiary');
  const baseUrl = 'http://localhost:3000/api';
  
  group('Create Prenotazioni', () => {
    // Ottieni lista di lotti disponibili
    const lottiIds = getAvailableLotti(token);
    
    if (lottiIds.length === 0) {
      console.error('Nessun lotto disponibile per prenotazione');
      errorRate.add(1);
      return;
    }
    
    // Scegli un lotto casuale
    const randomLottoId = lottiIds[randomIntBetween(0, lottiIds.length - 1)];
    
    // Crea una prenotazione
    const prenotazionePayload = {
      id_lotto: randomLottoId,
      quantita: randomIntBetween(1, 3),
      note: `Prenotazione di test creata il ${new Date().toISOString()}`
    };
    
    const createStartTime = new Date();
    const createRes = http.post(`${baseUrl}/prenotazioni`, JSON.stringify(prenotazionePayload), {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const createDuration = new Date() - createStartTime;
    
    createPrenotazioneTrend.add(createDuration);
    requestCounter.add(1);
    
    let createdPrenotazioneId = null;
    const success = check(createRes, {
      'Stato 201 per creazione prenotazione': (r) => r.status === 201,
      'Risposta contiene ID prenotazione': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.prenotazione && body.prenotazione.id) {
            createdPrenotazioneId = body.prenotazione.id;
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      }
    });
    
    if (!success) {
      errorRate.add(1);
      console.error(`Errore nella creazione della prenotazione: ${createRes.status}`);
      // Se errore 409, significa che il lotto è già esaurito (conflict)
      if (createRes.status === 409) {
        console.log('Il lotto è già esaurito (error 409)');
      }
    }
    
    // Se la prenotazione è stata creata, aggiornala
    if (createdPrenotazioneId) {
      sleep(1); // Piccola pausa
      
      const updatePayload = {
        quantita: randomIntBetween(1, 3),
        note: `Prenotazione aggiornata il ${new Date().toISOString()}`
      };
      
      const updateStartTime = new Date();
      const updateRes = http.put(`${baseUrl}/prenotazioni/${createdPrenotazioneId}`, JSON.stringify(updatePayload), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const updateDuration = new Date() - updateStartTime;
      
      updatePrenotazioneTrend.add(updateDuration);
      requestCounter.add(1);
      
      check(updateRes, {
        'Stato 200 per aggiornamento prenotazione': (r) => r.status === 200
      });
    }
  });
  
  sleep(randomIntBetween(2, 4));
} 