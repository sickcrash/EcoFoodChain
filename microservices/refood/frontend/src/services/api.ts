import axios from 'axios';
import { API_URL, API_TIMEOUT , STORAGE_KEYS } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import logger from '../utils/logger';
import { emitEvent, APP_EVENTS } from '../utils/events';
import { removeAccessToken, removeRefreshToken } from './tokenStorage';


// Configurazione di tipi per le variabili globali
declare global {
  var resetAuthState: (() => void) | undefined;
  var handleJwtExpired: (() => Promise<void>) | undefined;
}

// Configura l'istanza di axios con URL base e timeout
export const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT || 15000
});

// Configurazione di axios con intercettore per il token
export const setAuthToken = (token: string | null) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    logger.info('Token impostato negli header HTTP');
  } else {
    delete axios.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['Authorization'];
    logger.info('Token rimosso dagli header HTTP');
  }
};

// Variabile per evitare logout multipli simultanei
let isPerformingLogout = false;

// Funzione per effettuare il logout quando il token è scaduto
const handleExpiredToken = async () => {
  // Previene logout multipli
  if (isPerformingLogout) return;
  
  try {
    isPerformingLogout = true;
    logger.warn('Token JWT scaduto, esecuzione logout automatico');
    
    // Rimuovi i token
    await removeAccessToken();
    await removeRefreshToken();
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    
    // Rimuovi l'header di autorizzazione
    setAuthToken(null);
    
    // Mostra messaggio all'utente
    Toast.show({
      type: 'info',
      text1: 'Sessione scaduta',
      text2: 'La tua sessione è scaduta. Effettua nuovamente il login.',
      visibilityTime: 5000,
    });
    
    // Forza la navigazione alla schermata di login dopo un breve ritardo
    setTimeout(() => {
      // Emetti l'evento usando il nostro sistema di eventi
      emitEvent(APP_EVENTS.JWT_EXPIRED);
      
      // Esegui operazioni per resettare lo stato dell'app
      if (global.resetAuthState) {
        global.resetAuthState();
      }
    }, 1000);
  } catch (error) {
    logger.error('Errore durante il logout automatico:', error);
  } finally {
    isPerformingLogout = false;
  }
};

// Definizione globale per consentire l'accesso dal contesto dell'autenticazione
global.handleJwtExpired = handleExpiredToken;

// Intercettore per gestire errori di rete e token scaduti
api.interceptors.response.use(
  response => response,
  error => {
    // Disabilitiamo tutti i log di errore, ma gestiamo comunque l'errore internamente
    if (error.code === 'ECONNABORTED') {
      // Silenziosamente ignoriamo il timeout
      // console.error('Timeout della richiesta API');
    } else if (!error.response) {
      // Silenziosamente ignoriamo l'errore di rete
      // console.error('Errore di rete durante la richiesta API');
    } else if (error.response.status === 401) {
      // Verifica se l'errore è dovuto a un token scaduto
      const errorMessage = (error.response.data?.message || '').toLowerCase();
      const errorDesc = (error.response.data?.error || '').toLowerCase();
      
      // Amplia il controllo per catturare più varianti di messaggi di errore relativi ai token
      if (
        errorMessage.includes('expired') || 
        errorMessage.includes('scaduto') || 
        errorDesc.includes('jwt expired') || 
        errorDesc.includes('token scaduto') ||
        errorDesc.includes('invalid token') ||
        errorDesc.includes('token non valido') ||
        errorMessage.includes('token expired') ||
        errorDesc.includes('token expired') ||
        // Aggiungi controllo generico per i 401 senza dettagli specifici
        (errorMessage === '' && errorDesc === '' && error.response.status === 401)
      ) {
        // logger.warn rimosso per evitare log
        // logger.warn('Rilevato errore di token scaduto:', errorMessage || errorDesc || 'Errore 401 generico');
        handleExpiredToken();
      }
    } else if (error.response.status === 403) {
      // Gestisci errori di permessi senza generare log
      // logger.warn('Accesso non autorizzato (403):', error.response.data?.message || 'Permessi insufficienti');
      Toast.show({
        type: 'error',
        text1: 'Accesso negato',
        text2: 'Non hai i permessi necessari per questa operazione',
        visibilityTime: 3000,
      });
    }
    return Promise.reject(error);
  }
);

export default api; 
