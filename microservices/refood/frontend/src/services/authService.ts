
import axios, { isAxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken as getStoredAccessToken, setAccessToken as storeAccessToken, removeAccessToken, getRefreshToken as getStoredRefreshToken, setRefreshToken as storeRefreshToken, removeRefreshToken } from './tokenStorage';
import { STORAGE_KEYS, API_URL, API_TIMEOUT } from '../config/constants';
import { setAuthToken } from './api';
import { Utente } from '../types/user';
import Toast from 'react-native-toast-message';

// Definiamo le interfacce per i dati utente e le risposte API
export interface LoginResponse {
  token: string;
  utente: Utente;
  refreshToken?: string;
  error?: string;
}

// Configurazione globale di axios per il timeout
axios.defaults.timeout = API_TIMEOUT ?? 15000;


const pickFirstString = (...values: any[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const deriveUserType = (data: any): string | null => {
  if (!data || typeof data !== 'object') return null;

  const primary = pickFirstString(data.tipo_utente, data.tipoUtente);
  if (primary) return primary;

  if (data.tipoUtente && typeof data.tipoUtente === 'object') {
    const nested = pickFirstString(data.tipoUtente.tipo, data.tipoUtente.nome, data.tipoUtente.descrizione);
    if (nested) return nested;
  }

  if (Array.isArray(data.tipiUtente)) {
    for (const entry of data.tipiUtente) {
      const nested = pickFirstString(entry?.tipo, entry?.nome, entry?.descrizione);
      if (nested) return nested;
    }
  }

  if (Array.isArray(data.tipologie)) {
    const nested = pickFirstString(...data.tipologie);
    if (nested) return nested;
  }

  if (Array.isArray(data.tipi)) {
    const nested = pickFirstString(...data.tipi);
    if (nested) return nested;
  }

  return null;
};

const normalizeUserData = <T extends Record<string, any>>(rawData: T): T => {
  if (!rawData || typeof rawData !== 'object') return rawData;
  const normalized = { ...rawData } as Record<string, any>;
  const resolvedType = deriveUserType(normalized);
  if (resolvedType) {
    normalized.tipo_utente = resolvedType;
  }
  return normalized as T;
};

// Funzione per salvare il token nell'AsyncStorage
export const saveToken = async (token: string): Promise<boolean> => {
  try {
    await storeAccessToken(token);
    // Aggiorna l'header di autenticazione
    setAuthToken(token);
    console.log('Token salvato nello storage sicuro');
    return true;
  } catch (error) {
    console.error('Errore durante il salvataggio del token:', error);
    return false;
  }
};

// Funzione per salvare il refresh token nell'AsyncStorage
export const saveRefreshToken = async (refreshToken: string): Promise<boolean> => {
  try {
    await storeRefreshToken(refreshToken);
    console.log('Refresh token salvato nello storage sicuro');
    return true;
  } catch (error) {
    console.error('Errore durante il salvataggio del refresh token:', error);
    return false;
  }
};

// Funzione per ottenere il token attivo dall'AsyncStorage
export const getActiveToken = async (): Promise<string | null> => {
  try {
    const token = await getStoredAccessToken();
    console.log('Token recuperato dallo storage sicuro:', token ? 'presente' : 'assente');
    return token;
  } catch (error) {
    console.error('Errore durante il recupero del token:', error);
    return null;
  }
};

// Funzione per ottenere il refresh token da AsyncStorage
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const token = await getStoredRefreshToken();
    return token;
  } catch (error) {
    console.error('Errore durante il recupero del refresh token:', error);
    return null;
  }
};

// Esporta esplicitamente checkUserAuth
export const checkUserAuth = async (): Promise<any> => {
  try {
    const token = await getActiveToken();
    if (!token) {
      console.log('Nessun token trovato durante il checkUserAuth');
      return null;
    }

    try {
      // Imposta l'header di autenticazione
      setAuthToken(token);
      
      // Effettua la richiesta al server per verificare l'autenticazione
      console.log('Controllo autenticazione con:', `${API_URL}/attori/profile`);
      
      // Prima prova con il nuovo endpoint /attori/profile
      try {
        const response = await axios.get(`${API_URL}/attori/profile`);
        
        if (response.status === 200 && response.data) {
          console.log('Autenticazione verificata con successo:', response.data.email);
          
          // Aggiorna i dati utente nel localStorage per mantenerli freschi
          await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data));
          
          return response.data;
        }
      } catch (attoreProfileErr) {
        // Log dettagliato per il debug
        if (isAxiosError(attoreProfileErr)) {
          console.error(`Errore durante il controllo con attori/profile: Status=${attoreProfileErr.response?.status}, Message=${attoreProfileErr.message}`);
        } else {
          console.error('Errore non-Axios durante il controllo con attori/profile:', attoreProfileErr);
        }
        
        // Se l'errore è 404, prova con il vecchio endpoint
        if (isAxiosError(attoreProfileErr) && attoreProfileErr.response?.status === 404) {
          console.log('Endpoint attori/profile non trovato, tentativo con users/profile...');
          try {
            const responseUsers = await axios.get(`${API_URL}/users/profile`);
            
            if (responseUsers.status === 200 && responseUsers.data) {
              console.log('Autenticazione verificata con successo (users/profile):', responseUsers.data.email);
              
              // Aggiorna i dati utente nel localStorage
              await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(responseUsers.data));
              
              return responseUsers.data;
            }
          } catch (usersProfileErr) {
            // Log dettagliato per il debug
            if (isAxiosError(usersProfileErr)) {
              console.error(`Errore durante il controllo con users/profile: Status=${usersProfileErr.response?.status}, Message=${usersProfileErr.message}`);
            } else {
              console.error('Errore non-Axios durante il controllo con users/profile:', usersProfileErr);
            }
            
            // Se anche questo endpoint fallisce con 404, dobbiamo usare dati locali
            if (isAxiosError(usersProfileErr) && usersProfileErr.response?.status === 404) {
              console.log('Entrambi gli endpoint di profilo non esistono - utilizzando dati locali');
              
              // Verifica nella cache locale se abbiamo i dati utente
              try {
                const userDataStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
                if (userDataStr) {
                  const userData = JSON.parse(userDataStr);
                  console.log('Autenticazione mantenuta usando dati locali per:', userData.email);
                  return userData;
                }
              } catch (cacheErr) {
                console.error('Errore nel recupero dati utente dalla cache:', cacheErr);
              }
            } else {
              throw usersProfileErr; // Rilancia l'errore per gestione standard
            }
          }
        } else if (isAxiosError(attoreProfileErr) && attoreProfileErr.response?.status === 401) {
          // Token scaduto, tentativo di refresh
          console.log('Token scaduto (401), tentativo di refresh...');
          const refreshSuccess = await refreshToken();
          if (refreshSuccess) {
            // Riprova la verifica con il nuovo token
            return checkUserAuth();
          } else {
            console.error('Refresh token fallito dopo 401');
            return null;
          }
        } else {
          throw attoreProfileErr; // Rilancia l'errore per gestione standard
        }
      }
      
      // Se arriviamo qui, proviamo a usare i dati locali come ultima risorsa
      console.log('Fallback: utilizzo dati utente dalla cache locale');
      const userDataStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          console.log('Autenticazione mantenuta usando dati locali per:', userData.email);
          return userData;
        } catch (error) {
        console.warn('Nessun endpoint di logout disponibile o errore server', error);
          console.error('Errore nel parsing dei dati utente locali:', error);
        }
      }
      
      // Se non abbiamo ottenuto dati validi da nessuna fonte
      console.log('Nessun dato utente valido trovato, autenticazione fallita');
      
      // Assicuriamoci che l'UI mostri lo stato corretto di sessione scaduta
      try {
        Toast.show({
          type: 'info',
          text1: 'Sessione scaduta',
          text2: 'Accedi nuovamente per continuare',
          visibilityTime: 4000,
        });
      } catch (e) {
        console.error('Impossibile mostrare toast:', e);
      }
      
      return null;
    } catch (error) {
      // Log più dettagliato dell'errore per identificare meglio il problema
      if (isAxiosError(error)) {
        console.error(`Errore critico durante checkUserAuth - Status: ${error.response?.status}, Message: ${error.message}, Config URL: ${error.config?.baseURL || 'non disponibile'}`);
        if (error.response) {
          console.error('Dettagli risposta errore:', {
            data: error.response.data,
            headers: error.response.headers,
            status: error.response.status
          });
        }
      } else {
        console.error('Errore non-Axios critico durante checkUserAuth:', error);
      }
      
      // Tentativo di usare dati locali come ultima risorsa in caso di errori generici
      console.log('Errore generico, tentativo di usare dati utente locali');
      try {
        const userDataStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          console.log('Autenticazione mantenuta usando dati locali per:', userData.email);
          return userData;
        }
      } catch (cacheErr) {
        console.error('Errore nel recupero dati utente dalla cache:', cacheErr);
      }
      
      return null;
    }
  } catch (rootError) {
    // Errore fuori da tutto il flusso (es: errore nella lettura del token)
    console.error('Errore top-level in checkUserAuth (metodo completo fallito):', rootError);
    return null;
  }
};

// Funzione per effettuare il refresh del token
export const refreshToken = async (): Promise<boolean> => {
  try {
    console.log('Tentativo di refresh del token di autenticazione');
    
    // Ottieni il refresh token
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      console.log('Nessun refresh token disponibile, impossibile effettuare il refresh');
      return false;
    }
    
    console.log('Refresh token trovato, tentativo di refresh...');
    
    // Prova il nuovo endpoint /auth/refresh-token
    try {
      const response = await axios.post(`${API_URL}/auth/refresh-token`, { 
        refresh_token: refreshToken 
      });
      
      if (response.status === 200 && (response.data.access_token || response.data.token)) {
        const newToken = response.data.access_token || response.data.token;
        console.log('Token refreshato con successo (nuovo endpoint)');
        
        // Salva il nuovo token in AsyncStorage
        await saveToken(newToken);
        
        // Imposta il token per le chiamate API future
        setAuthToken(newToken);
        
        // Se è presente un nuovo refresh token, salvalo
        if (response.data.refresh_token) {
          await storeRefreshToken(response.data.refresh_token);
        }
        
        // Mostra notifica di successo
        try {
          if (Toast) {
            Toast.show({
              type: 'success',
              text1: 'Sessione aggiornata',
              text2: 'La tua sessione è stata aggiornata con successo',
              visibilityTime: 3000,
            });
          }
        } catch (e) {
          console.error('Impossibile mostrare toast di successo refresh:', e);
        }
        
        return true;
      } else {
        console.log('Risposta di refresh non valida:', response.status);
      }
    } catch (refreshErr) {
      // Se il nuovo endpoint fallisce, proviamo con il vecchio
      if (isAxiosError(refreshErr) && refreshErr.response?.status === 404) {
        console.log('Endpoint /auth/refresh-token non trovato, provo con /auth/refresh');
        
        try {
          const oldResponse = await axios.post(`${API_URL}/auth/refresh`, { 
            refresh_token: refreshToken 
          });
          
          if (oldResponse.status === 200 && (oldResponse.data.access_token || oldResponse.data.token)) {
            const newToken = oldResponse.data.access_token || oldResponse.data.token;
            console.log('Token refreshato con successo (vecchio endpoint)');
            
            // Salva il nuovo token
            await saveToken(newToken);
            
            // Imposta il token per le chiamate API future
            setAuthToken(newToken);
            
            // Se è presente un nuovo refresh token, salvalo
            if (oldResponse.data.refresh_token) {
              await storeRefreshToken(oldResponse.data.refresh_token);
            }
            
            // Mostra notifica di successo
            try {
              if (Toast) {
                Toast.show({
                  type: 'success',
                  text1: 'Sessione aggiornata',
                  text2: 'La tua sessione è stata aggiornata con successo',
                  visibilityTime: 3000,
                });
              }
            } catch (e) {
              console.error('Impossibile mostrare toast di successo refresh:', e);
            }
            
            return true;
          }
        } catch (oldRefreshErr) {
          console.error('Errore durante il refresh con il vecchio endpoint:', oldRefreshErr);
        }
      } else {
        console.error('Errore durante il refresh del token:', refreshErr);
      }
    }
    
    console.log('Tutti i tentativi di refresh del token sono falliti');
    
    // Mostra notifica di fallimento
    try {
      if (Toast) {
        Toast.show({
          type: 'error',
          text1: 'Sessione scaduta',
          text2: 'Non è stato possibile aggiornare la tua sessione, accedi nuovamente',
          visibilityTime: 4000,
        });
      }
    } catch (e) {
      console.error('Impossibile mostrare toast di errore refresh:', e);
    }
    
    return false;
  } catch (error) {
    console.error('Errore generico durante il refresh del token:', error);
    return false;
  }
};

/**
 * Salva la sessione utente, comprensiva di token e dati utente
 * Funzione di utilità per centralizzare la logica di salvataggio
 */
export const saveUserSession = async (token: string, userData: any): Promise<boolean> => {
  const normalizedUserData = normalizeUserData(userData);
  try {
    // Salva il token e imposta l'header di autenticazione
    await saveToken(token);
    setAuthToken(token);
    
    // Salva i dati utente in AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(normalizedUserData));
    
    console.log('Sessione utente salvata con successo');
    return true;
  } catch (error) {
    console.error('Errore durante il salvataggio della sessione:', error);
    return false;
  }
};

type NormalizedLoginPayload = {
  token: string;
  utente: any;
  refreshToken?: string | null;
};

const performLoginRequest = async (email: string, password: string): Promise<NormalizedLoginPayload> => {
  console.log('Tentativo di login per:', email);

  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    
    console.log('Status risposta login:', response.status);
    console.log('Chiavi risposta:', Object.keys(response.data || {}));
    
    // Supporto per vari formati di risposta dal server
    let userData = null;
    let authToken = null;
    let refreshTokenValue = null;
    
    // Formato 1: { token, utente }
    if (response.data.token && response.data.utente) {
      console.log('Formato risposta: token + utente');
      userData = response.data.utente;
      authToken = response.data.token;
      refreshTokenValue = response.data.refreshToken;
    } 
    // Formato 2: { access_token, user }
    else if (response.data.access_token && response.data.user) {
      console.log('Formato risposta: access_token + user');
      userData = response.data.user;
      authToken = response.data.access_token;
      refreshTokenValue = response.data.refresh_token;
    } 
    // Formato 3: { tokens: { access, refresh }, user }
    else if (response.data.tokens && response.data.user) {
      console.log('Formato risposta: tokens (access,refresh) + user');
      userData = response.data.user;
      authToken = response.data.tokens.access;
      refreshTokenValue = response.data.tokens.refresh;
    }
    // Se disponibile, salva il refresh token
    if (userData && authToken) {
      console.log('Login completato con successo per:', email);
      return {
        token: authToken,
        utente: userData,
        refreshToken: refreshTokenValue,
      };
    }

    console.error('Formato risposta non riconosciuto:', response.data);
    throw new Error('Risposta dal server non valida durante il login');
  } catch (error) {
    console.error('Errore durante il login:', error);

    if (isAxiosError(error)) {
      if (error.response) {
        const status = error.response.status;
        const serverMessage = typeof error.response.data?.message === 'string'
          ? error.response.data.message
          : typeof error.response.data?.error === 'string'
            ? error.response.data.error
            : '';

        if (status === 401) {
          throw new Error('Credenziali non valide');
        }

        const normalizedMessage = serverMessage.toLowerCase();
        if (
          normalizedMessage.includes('sasl') ||
          normalizedMessage.includes('scram') ||
          normalizedMessage.includes('postgres')
        ) {
          throw new Error('Servizio autenticazione non disponibile. Contatta l\'amministratore.');
        }

        throw new Error(serverMessage || 'Errore interno del server. Riprova più tardi.');
      }

      if (error.code === 'ECONNABORTED') {
        throw new Error('Timeout di connessione. Controlla la rete e riprova.');
      }

      throw new Error('Impossibile contattare il server. Verifica la connessione a Internet.');
    }

    throw new Error('Errore inatteso durante il login.');
  }
};

export const authenticateUser = performLoginRequest;

// Funzione per effettuare il login con persistenza locale
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const { token, utente, refreshToken } = await performLoginRequest(email, password);

  if (refreshToken) {
    await storeRefreshToken(refreshToken);
    console.log('Refresh token salvato dopo login');
  }

  await saveUserSession(token, utente);

  return { token, utente };
};

// Funzione per effettuare il logout
export const logoutUser = async (): Promise<boolean> => {
  try {
    // Chiama l'endpoint di logout sul server (se esiste)
    const token = await getActiveToken();
    if (token) {
      setAuthToken(token);
      try {
        await axios.post(`${API_URL}/auth/logout`);
        console.log('Logout effettuato sul server');
      } catch (error) {
        console.warn('Nessun endpoint di logout disponibile o errore server', error);
      }
    }
    
    // Rimuovi tutti i token locali indipendentemente dalla risposta del server
    return true;
  } catch (error) {
    console.error('Errore durante il logout:', error);
    // Ritorna true comunque, permettiamo il logout anche in caso di errori
    return true;
  }
};

// Funzione per verificare se un token è valido
export const verifyToken = async (token: string): Promise<boolean> => {
  try {
    // Se il token è nullo o vuoto, ritorna false
    if (!token) return false;
    
    const response = await axios.get(`${API_URL}/auth/verifica`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.valid === true;
  } catch (error) {
    console.error('Errore durante la verifica del token:', error);
    return false;
  }
};

// Funzione per registrare un nuovo utente (se necessario)
export const registerUser = async (userData: {
  email: string;
  password: string;
  nome: string;
  cognome: string | null;
  ruolo: string;
  tipoUtente?: {
    tipo: string;
    indirizzo: string;
    telefono: string;
    email: string;
  };
}) => {
  try {
    // Se il tipoUtente è definito come Canale sociale o centro riciclo, imposta cognome a null
    if (userData.ruolo === 'Utente' && userData.tipoUtente && 
       (userData.tipoUtente.tipo === 'Canale sociale' || userData.tipoUtente.tipo === 'centro riciclo')) {
      userData.cognome = null;
      console.log('Cognome impostato esplicitamente a null per tipo:', userData.tipoUtente.tipo);
    }
    
    // Se il cognome è una stringa vuota, impostalo a null
    if (userData.cognome === '') {
      userData.cognome = null;
      console.log('Cognome (stringa vuota) convertito a null prima dell\'invio API');
    }
    
    console.log(`Invio richiesta di registrazione al backend (${API_URL}/auth/register):`, userData);
    
    // Chiama l'API reale senza meccanismi di fallback
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    
    console.log('Registrazione completata con successo tramite API:', response.data);
      
    // Restituisci i dati ricevuti dal server con flag success
    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error('Errore durante la registrazione:', error);
    
    // Gestione dettagliata degli errori
    if (error.response) {
      // Se c'è una risposta dal server, estraiamo informazioni più dettagliate
      console.error('Status errore:', error.response.status);
      console.error('Dati errore:', error.response.data);
      
      // Errori comuni
      if (error.response.status === 409) {
        throw Object.assign(new Error('Email già registrata'), { response: error.response });
      } else if (error.response.status === 400) {
        const errorMessage = error.response.data?.message || 'Dati di registrazione non validi';
        throw Object.assign(new Error(errorMessage), { response: error.response });
      } else if (error.response.status === 404) {
        throw Object.assign(new Error('Endpoint di registrazione non trovato. Verifica il server API.'), { response: error.response });
      } else if (error.response.status === 500) {
        throw Object.assign(new Error('Errore interno del server durante la registrazione.'), { response: error.response });
      }
    } else if (error.request) {
      // Richiesta effettuata ma nessuna risposta ricevuta
      console.error('Nessuna risposta ricevuta dal server');
      throw Object.assign(new Error('Nessuna risposta dal server. Verifica la connessione internet o la disponibilità del server.'), { networkError: true });
    }
    
    // Per qualsiasi altro tipo di errore
    throw error;
  }
};

/**
 * Ottiene il token di autenticazione, controllando prima AUTH_TOKEN e poi USER_TOKEN
 * Aggiunge un log per il debug
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    // Prima controlliamo il token standard di autenticazione
    let token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    
    // Se non esiste, proviamo con il token utente legacy
    if (!token) {
      token = await getStoredAccessToken();
      if (token) {
        console.log('Utilizzato token persistito come fallback');
      }
    }
    
    if (!token) {
      console.warn('Nessun token di autenticazione trovato in storage');
    }
    
    return token;
  } catch (error) {
    console.error('Errore nel recupero del token di autenticazione:', error);
    return null;
  }
}; 
