import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Metriche personalizzate
const getLottiTrend = new Trend('get_lotti_duration');
const getLottoDetailTrend = new Trend('get_lotto_detail_duration');
const createLottoTrend = new Trend('create_lotto_duration');
const updateLottoTrend = new Trend('update_lotto_duration');
const errorRate = new Rate('error_rate');
const requestCounter = new Counter('total_requests');

// Configurazione del test
export const options = {
  scenarios: {
    // Scenario 1: Carico costante basso (lettura)
    browsing_load: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      gracefulStop: '5s',
      exec: 'browseLotti',
      tags: { scenario: 'browse_lotti' }
    },
    
    // Scenario 2: Picco di carico (simulazione ore di punta)
    peak_hours: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 10 },  // ramp-up a 10 utenti in 10s
        { duration: '20s', target: 10 },  // mantieni 10 utenti per 20s
        { duration: '10s', target: 0 },   // ramp-down a 0
      ],
      gracefulStop: '5s',
      exec: 'mixedOperations',
      tags: { scenario: 'peak_hours' }
    },
    
    // Scenario 3: Operazioni di scrittura da operatori
    operator_operations: {
      executor: 'per-vu-iterations',
      vus: 2,  // Pochi operatori
      iterations: 5,
      maxDuration: '1m',
      exec: 'operatorActions',
      tags: { scenario: 'operator_actions' }
    }
  },
  thresholds: {
    'get_lotti_duration': ['p(95)<500'],      // 95% delle richieste sotto 500ms
    'get_lotto_detail_duration': ['p(95)<300'], // 95% delle richieste sotto 300ms
    'create_lotto_duration': ['avg<800'],     // Tempo medio di creazione sotto 800ms
    'update_lotto_duration': ['avg<600'],     // Tempo medio di aggiornamento sotto 600ms
    'error_rate': ['rate<0.1'],               // Tasso di errore inferiore al 10%
    'http_req_duration': ['p(95)<1000'],      // 95% di tutte le richieste sotto 1s
  },
};

// Ottieni un token di autenticazione (finto per questo esempio)
function getToken(userType = 'normal') {
  // In un test reale, questa funzione farebbe una richiesta all'endpoint di login
  // e restituirebbe un token valido
  
  // Per questo esempio, restituiamo token finti basati sul tipo di utente
  if (userType === 'operator') {
    return 'eyJhbG...OPERATOR_TOKEN';
  } else {
    return 'eyJhbG...USER_TOKEN';
  }
}

// Genera dati casuali per un nuovo lotto
function generateRandomLotto() {
  const products = ['Mele', 'Pane', 'Pasta', 'Latte', 'Verdure', 'Uova', 'Formaggio'];
  const states = ['Verde', 'Giallo', 'Arancione'];
  
  return {
    prodotto: products[randomIntBetween(0, products.length - 1)],
    quantita: randomIntBetween(1, 50),
    data_creazione: new Date().toISOString(),
    stato: states[randomIntBetween(0, states.length - 1)],
    descrizione: `Lotto di test generato automaticamente ${new Date().toISOString()}`,
    id_categoria: randomIntBetween(1, 5)
  };
}

// Scenario 1: Navigazione semplice (solo lettura)
export function browseLotti() {
  const token = getToken();
  const baseUrl = 'http://localhost:3000/api';
  
  group('Browse Lotti', () => {
    // Lista dei lotti con paginazione
    let lottiIds = [];
    const pageSize = 10;
    const page = randomIntBetween(1, 3);
    
    const startTime = new Date();
    const res = http.get(`${baseUrl}/lotti?page=${page}&limit=${pageSize}`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const duration = new Date() - startTime;
    
    getLottiTrend.add(duration);
    requestCounter.add(1);
    
    const success = check(res, {
      'Stato 200 per lista lotti': (r) => r.status === 200,
      'Formato risposta corretto': (r) => {
        try {
          const body = JSON.parse(r.body);
          // Salva gli ID dei lotti per le chiamate successive
          if (body.lotti && Array.isArray(body.lotti)) {
            lottiIds = body.lotti.map(lotto => lotto.id);
          }
          return true;
        } catch (e) {
          return false;
        }
      }
    });
    
    if (!success) {
      errorRate.add(1);
      console.error(`Errore nella chiamata GET /lotti: ${res.status}`);
    }
    
    // Se ci sono lotti, ottieni dettagli su uno casuale
    if (lottiIds.length > 0) {
      const randomLottoId = lottiIds[randomIntBetween(0, lottiIds.length - 1)];
      
      const detailStartTime = new Date();
      const detailRes = http.get(`${baseUrl}/lotti/${randomLottoId}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const detailDuration = new Date() - detailStartTime;
      
      getLottoDetailTrend.add(detailDuration);
      requestCounter.add(1);
      
      check(detailRes, {
        'Stato 200 per dettaglio lotto': (r) => r.status === 200,
        'Formato risposta dettaglio corretto': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.lotto && body.lotto.id === randomLottoId;
          } catch (e) {
            return false;
          }
        }
      });
    }
  });
  
  sleep(randomIntBetween(1, 3));
}

// Scenario 2: Operazioni miste (lettura + alcune scritture)
export function mixedOperations() {
  const userType = Math.random() > 0.3 ? 'normal' : 'operator';
  const token = getToken(userType);
  const baseUrl = 'http://localhost:3000/api';
  
  // 70% probabilità di solo navigare
  if (Math.random() < 0.7) {
    browseLotti();
    return;
  }
  
  // 30% probabilità di fare aggiornamenti (se operatore)
  if (userType === 'operator') {
    group('Operator Update', () => {
      // Prima ottieni un lotto esistente
      const res = http.get(`${baseUrl}/lotti?page=1&limit=5`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      requestCounter.add(1);
      
      let lottoToUpdate = null;
      try {
        const body = JSON.parse(res.body);
        if (body.lotti && body.lotti.length > 0) {
          lottoToUpdate = body.lotti[0];
        }
      } catch (e) {
        errorRate.add(1);
        return;
      }
      
      // Se abbiamo trovato un lotto, aggiornalo
      if (lottoToUpdate) {
        const updatePayload = {
          stato: ['Verde', 'Giallo', 'Arancione'][randomIntBetween(0, 2)],
          descrizione: `Lotto aggiornato alle ${new Date().toISOString()}`
        };
        
        const updateStartTime = new Date();
        const updateRes = http.put(`${baseUrl}/lotti/${lottoToUpdate.id}`, JSON.stringify(updatePayload), {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const updateDuration = new Date() - updateStartTime;
        
        updateLottoTrend.add(updateDuration);
        requestCounter.add(1);
        
        const success = check(updateRes, {
          'Stato 200 per aggiornamento lotto': (r) => r.status === 200
        });
        
        if (!success) {
          errorRate.add(1);
        }
      }
    });
  }
  
  sleep(randomIntBetween(1, 3));
}

// Scenario 3: Azioni specifiche degli operatori (principalmente scrittura)
export function operatorActions() {
  const token = getToken('operator');
  const baseUrl = 'http://localhost:3000/api';
  
  group('Operator Create Lotto', () => {
    const newLotto = generateRandomLotto();
    
    const createStartTime = new Date();
    const createRes = http.post(`${baseUrl}/lotti`, JSON.stringify(newLotto), {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const createDuration = new Date() - createStartTime;
    
    createLottoTrend.add(createDuration);
    requestCounter.add(1);
    
    let createdLottoId = null;
    const success = check(createRes, {
      'Stato 201 per creazione lotto': (r) => r.status === 201,
      'Risposta contiene ID lotto': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.lotto && body.lotto.id) {
            createdLottoId = body.lotto.id;
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
      console.error(`Errore nella creazione del lotto: ${createRes.status}`);
    }
    
    // Se il lotto è stato creato, aggiornalo
    if (createdLottoId) {
      sleep(1); // Piccola pausa
      
      const updatePayload = {
        stato: 'Giallo', // Aggiorna lo stato
        quantita: randomIntBetween(1, 20) // Aggiorna la quantità
      };
      
      const updateStartTime = new Date();
      const updateRes = http.put(`${baseUrl}/lotti/${createdLottoId}`, JSON.stringify(updatePayload), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const updateDuration = new Date() - updateStartTime;
      
      updateLottoTrend.add(updateDuration);
      requestCounter.add(1);
      
      check(updateRes, {
        'Stato 200 per aggiornamento lotto': (r) => r.status === 200
      });
    }
  });
  
  sleep(randomIntBetween(2, 5));
} 