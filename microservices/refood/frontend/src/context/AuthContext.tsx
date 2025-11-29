import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken as getStoredAccessToken, setAccessToken as storeAccessToken, removeAccessToken, getRefreshToken as getStoredRefreshToken, setRefreshToken as storeRefreshToken, removeRefreshToken } from '../services/tokenStorage';
import axios, { isAxiosError } from 'axios';
import { STORAGE_KEYS, API_URL } from '../config/constants';
import { setAuthToken } from '../services/api';
import { checkUserAuth, loginUser, logoutUser, getRefreshToken, registerUser, getActiveToken } from '../services/authService';
import { Utente } from '../types/user';
import logger from '../utils/logger';
import { listenEvent, emitEvent, APP_EVENTS } from '../utils/events';
import Toast from 'react-native-toast-message';

// Definisci il tipo di resetAuthState nel global namespace
declare global {
  var resetAuthState: (() => void) | undefined;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: Utente | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    nome: string, 
    cognome: string, 
    email: string, 
    password: string, 
    tipologia: 'organizzazione' | 'utente' | null,
    ruoloOrganizzazione: string | null,
    tipoUtente: string | null,
    indirizzo?: string,
    telefono?: string,
    via?: string | null,
    civico?: string | null,
    citta?: string | null,
    provincia?: string | null,
    cap?: string | null,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUserStatus: () => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<Utente | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState<boolean>(false);
  const [appState, setAppState] = useState<string>(AppState.currentState);
  // Aggiungiamo un flag per tracciare se è in corso un logout
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  
  // Log di stato per aiutare il debug
  useEffect(() => {
    logger.log('AuthProvider - Stato autenticazione:', isAuthenticated ? 'autenticato' : 'non autenticato');
    logger.log('AuthProvider - User:', user ? `${user.email} (${user.ruolo})` : 'null');
    
    // Verifica rapida che lo stato sia coerente
    const checkState = async () => {
      const token = await getStoredAccessToken();
      const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      
      logger.log('AuthProvider - Token in storage:', token ? 'presente' : 'assente');
      logger.log('AuthProvider - UserData in storage:', userDataString ? 'presente' : 'assente');
      
      // Se abbiamo token e dati utente in storage ma isAuthenticated è false, ripristiniamo
      if (token && userDataString && !isAuthenticated) {
        logger.log('CORREZIONE STATO: trovati dati in storage ma stato non autenticato');
        try {
          const userData = JSON.parse(userDataString);
          setUser({ ...userData, token });
          setIsAuthenticated(true);
          setAuthToken(token);
        } catch (error) {
          logger.error('Errore durante la correzione dello stato:', error);
        }
      }
      
      // Se non abbiamo né token né dati utente ma isAuthenticated è true, correggiamo
      if (!token && !userDataString && isAuthenticated) {
        logger.log('CORREZIONE STATO: nessun dato in storage ma stato autenticato');
        setUser(null);
        setIsAuthenticated(false);
      }
    };
    
    checkState();
  }, [isAuthenticated, user]);
  
  // Funzione per resettare lo stato di autenticazione
  const resetAuthentication = useCallback(() => {
    logger.warn('Esecuzione reset autenticazione');
    setUser(null);
    setIsAuthenticated(false);
    setAuthToken(null);
  }, []);
  
  // Assegna la funzione al global object per permettere l’accesso da api.ts
  useEffect(() => {
    if (typeof global !== 'undefined') {
      global.resetAuthState = resetAuthentication;
    }
    
    return () => {
      if (typeof global !== 'undefined') {
        global.resetAuthState = undefined;
      }
    };
  }, [resetAuthentication]);
  
  // Listener per eventi jwt_expired usando EventEmitter invece di window
  useEffect(() => {
    const handleJwtExpiredEvent = () => {
      logger.warn('Evento JWT scaduto ricevuto');
      resetAuthentication();
    };
    
    // Usa il nostro sistema di eventi personalizzato
    const removeListener = listenEvent(APP_EVENTS.JWT_EXPIRED, handleJwtExpiredEvent);
    
    // Cleanup: rimuove il listener quando il componente si smonta
    return () => {
      removeListener();
    };
  }, [resetAuthentication]);

  // Aggiungiamo un listener per i cambiamenti di stato dell'app (app in primo piano, in background, etc.)
  useEffect(() => {
    // Funzione per gestire i cambiamenti di stato dell'app
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      logger.log(`App stato precedente: ${appState}, nuovo stato: ${nextAppState}`);
      
      // Se l’app passa da background a foreground (attiva)
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        logger.log('App tornata in primo piano, verifico la sessione utente');
        
        // Non eseguire controlli se è in corso un logout
        if (isLoggingOut) {
          logger.log('Ignorata verifica sessione al ritorno in primo piano durante logout');
          setAppState(nextAppState);
          return;
        }
        
        // Verifica se c'è un token salvato nel localStorage
        const token = await getStoredAccessToken();
        
        if (token) {
          logger.log('Token trovato in storage, verifico validità');
          // Imposta il token per le chiamate API
          setAuthToken(token);
          
          try {
            // Tentativo di refresh dello stato utente
            const userData = await checkUserAuth();
            if (!userData) {
              // Se checkUserAuth ritorna null, il token potrebbe essere scaduto
              const refreshSuccessful = await refreshToken();
              if (!refreshSuccessful) {
                // Se il refresh fallisce, notifica l’utente della sessione scaduta
                setUser(null);
                setIsAuthenticated(false);
                // Notifica all'utente
                Toast.show({
                  type: 'info',
                  text1: 'Sessione scaduta',
                  text2: 'Effettua nuovamente il login per continuare',
                  visibilityTime: 4000,
                });
                // Rimuovi i dati di sessione
                await removeAccessToken();
                await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
                await removeRefreshToken();
                // Emetti l’evento di JWT scaduto
                emitEvent(APP_EVENTS.JWT_EXPIRED);
              }
            }
          } catch (error) {
            logger.error('Errore nel refresh dello stato utente:', error);
            // Notifica all'utente
            Toast.show({
              type: 'error',
              text1: 'Errore di autenticazione',
              text2: 'Si è verificato un problema con la tua sessione',
              visibilityTime: 4000,
            });
          }
        } else {
          logger.log('Nessun token trovato in storage, utente non autenticato');
        }
      }
      
      setAppState(nextAppState);
    };
    
    // Aggiungi il listener per i cambiamenti di stato dell'app
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Cleanup: rimuovi il listener quando il componente si smonta
    return () => {
      subscription.remove();
    };
  }, [appState, isLoggingOut]);

  // Funzione per aggiornare lo stato dell'autenticazione
  const refreshUserStatus = useCallback(async () => {
    try {
      // Se stiamo facendo logout, non eseguire il refresh
      if (isLoggingOut) {
        logger.log('Ignorata richiesta di refreshUserStatus durante logout');
        return;
      }
      
      setIsLoading(true);
      logger.log('AuthProvider - Inizio refresh dello stato utente');
      
      // Ottieni il token in modo sicuro
      const token = await getActiveToken();
      logger.log('AuthProvider - Token trovato:', token ? 'presente' : 'assente');
      
      // Prima prova a ripristinare i dati utente locali, poi verifica con il server
      let localDataRestored = false;
      
      if (!Platform.isTV && typeof window !== 'undefined') {
        try {
          const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          if (userDataString && token) {
            const userData = JSON.parse(userDataString);
            logger.log('Dati utente trovati in storage locale:', userData.email);
            // Imposta immediatamente lo stato con i dati locali e il token
            setUser({ ...userData, token });
            setIsAuthenticated(true);
            localDataRestored = true;
            
            // Configura l’header con il token
            setAuthToken(token);
          }
        } catch (storageError) {
          logger.error('Errore nel ripristino dei dati locali:', storageError);
        }
      }
      
      // Se abbiamo un token, verifica l’autenticazione con il server
      if (token) {
        setAuthToken(token);
        logger.log('Token esistente trovato, verifico autenticazione con il server...');
        try {
          const userData = await checkUserAuth();
          
          if (userData) {
            logger.log('Utente autenticato confermato dal server:', userData.email);
            setUser({ ...userData, token });
            setIsAuthenticated(true);
            
            // Aggiorna i dati utente in AsyncStorage
            if (!Platform.isTV && typeof window !== 'undefined') {
              await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
              logger.log('Dati utente aggiornati in AsyncStorage dopo verifica server');
            }
          } else {
            logger.log('Server non ha confermato l\'autenticazione');
            
            // Solo se non abbiamo ripristinato dati locali, considera l’utente non autenticato
            if (!localDataRestored) {
              logger.log('Server non conferma autenticazione e nessun dato locale valido');
              setUser(null);
              setIsAuthenticated(false);
              
              // Pulisci lo storage solo se non ci sono dati locali validi
              if (!Platform.isTV && typeof window !== 'undefined') {
                await removeAccessToken();
                await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
                await removeRefreshToken();
                // Notifica all'utente che la sessione è scaduta
                Toast.show({
                  type: 'info',
                  text1: 'Sessione scaduta',
                  text2: 'Effettua nuovamente il login per continuare',
                  visibilityTime: 4000,
                });
            }
            } else {
              logger.log('Server non conferma autenticazione ma manteniamo i dati locali');
              
              // Tentativo di refresh del token se abbiamo un refresh token
              const refreshTokenVal = await getStoredRefreshToken();
              if (refreshTokenVal) {
                try {
                  logger.log('Tentativo di refresh del token...');
                  const refreshSuccess = await refreshToken();
                  
                  if (!refreshSuccess) {
                    // Se il refresh fallisce, notifica l’utente
                    setUser(null);
                    setIsAuthenticated(false);
                    await removeAccessToken();
                    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
                    await removeRefreshToken();
                    Toast.show({
                      type: 'info',
                      text1: 'Sessione scaduta',
                      text2: 'Effettua nuovamente il login per continuare',
                      visibilityTime: 4000,
                    });
                    // Emetti l’evento di JWT scaduto
                    emitEvent(APP_EVENTS.JWT_EXPIRED);
                  }
                } catch (refreshError) {
                  logger.error('Errore durante il refresh del token:', refreshError);
                  // Notifica all'utente
                  Toast.show({
                    type: 'error',
                    text1: 'Errore di autenticazione',
                    text2: 'Si è verificato un problema con il refresh della sessione',
                    visibilityTime: 4000,
                  });
                }
              }
            }
          }
        } catch (serverError) {
          logger.error('Errore nella verifica col server:', serverError);
          
          // Non tentare refresh o altre operazioni se è in corso un logout
          if (isLoggingOut) {
            logger.log('Ignorato tentativo di refresh dopo errore server durante logout');
            return;
          }
          
          // Se c'è un errore 401, prova a fare il refresh del token
          if (isAxiosError(serverError) && serverError.response?.status === 401) {
            const refreshToken = await getStoredRefreshToken();
            if (refreshToken) {
              try {
                logger.log('Errore 401, tentativo di refresh del token...');
                const response = await axios.post(`${API_URL}/auth/refresh-token`, { refresh_token: refreshToken });
                
                if (response.status === 200 && response.data.access_token) {
                  logger.log('Token refreshato con successo dopo 401');
                  
                  // Salva il nuovo token
                  await storeAccessToken(response.data.access_token);
                  setAuthToken(response.data.access_token);
                  
                  // Se c'è un nuovo refresh token, salvalo
                  if (response.data.refresh_token) {
                    await storeRefreshToken(response.data.refresh_token);
                  }
                  
                  // Riprova la verifica dell'autenticazione
                  const userData = await checkUserAuth();
                  if (userData) {
                    logger.log('Autenticazione confermata dopo refresh token');
                    setUser(userData);
                    setIsAuthenticated(true);
                    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
                  }
                }
              } catch (refreshError) {
                logger.error('Errore durante il refresh del token dopo 401:', refreshError);
                
                // Se il refresh fallisce, considera l’utente non autenticato
                if (!localDataRestored) {
                  setUser(null);
                  setIsAuthenticated(false);
                  
                  await removeAccessToken();
                  await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
                  await removeRefreshToken();
                }
              }
            }
          }
        }
      } else {
        // Se non abbiamo un token, l’utente non è autenticato
        if (!localDataRestored) {
          logger.log('Nessun token trovato e nessun dato locale, utente non autenticato');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    } catch (error) {
      logger.error('Errore durante il refresh dello stato utente:', error);
      
      // Se è in corso un logout, non eseguire altre operazioni
      if (isLoggingOut) {
        logger.log('Ignorato tentativo di ripristino dati dopo errore generico durante logout');
        return;
      }
      
      // In caso di errore non gestito, manteniamo i dati locali se disponibili
      if (!user) {
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      setIsLoading(false);
      setInitialCheckDone(true);
    }
  }, [isLoggingOut, user]);

  // Verifica iniziale dell'autenticazione quando l’app viene caricata
  useEffect(() => {
    // Evita controlli multipli o durante il logout
    if (initialCheckDone || isLoggingOut) return;
    
    logger.log('Avvio controllo autenticazione iniziale...');
    
    // Aggiungi un timeout per prevenire il blocco del check
    const checkAuthWithTimeout = async () => {
      try {
        // Crea un timeout di 8 secondi (aumentato per consentire tempo per il refresh)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout during auth check')), 8000)
        );
        
        // Esegui il check con timeout
        await Promise.race([refreshUserStatus(), timeoutPromise]);
      } catch (error) {
        logger.error('Errore o timeout durante il check iniziale:', error);
        // In caso di timeout, tenta comunque di ripristinare i dati locali
        try {
          const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          const token = await getStoredAccessToken();
          if (userData && token) {
            logger.log('Ripristino dati utente da storage dopo timeout');
            setUser({ ...JSON.parse(userData), token });
            setIsAuthenticated(true);
            setAuthToken(token);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (localErr) {
          logger.error('Errore ripristino dati locali dopo timeout:', localErr);
          setUser(null);
          setIsAuthenticated(false);
        } finally {
          setIsLoading(false);
          setInitialCheckDone(true);
        }
      }
    };
    
    checkAuthWithTimeout();
  }, [refreshUserStatus, initialCheckDone, isLoggingOut]);

  // Effetto per ripristinare dall'AsyncStorage
  useEffect(() => {
    const restoreUserFromStorage = async () => {
      try {
        // Solo se l’utente non è già caricato e non siamo in SSR
        if (!user && !isLoading && !Platform.isTV && typeof window !== 'undefined') {
          // Non tentare di ripristinare se è in corso un logout
          if (isLoggingOut) {
            logger.log('Ignorato tentativo di ripristino utente durante logout');
            return;
          }
          // Prima ottieni il token
          const token = await getStoredAccessToken();
          if (token) {
            logger.log('Token trovato in storage, tentativo di ripristino sessione...');
            setAuthToken(token);
            
            // Poi prova a caricare i dati utente dal localStorage
            const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
            if (userData) {
              // Se abbiamo sia token che utente, ripristiniamo temporaneamente
              const parsedUserData = JSON.parse(userData);
              logger.log('Dati utente trovati in storage:', parsedUserData.email);
              setUser({ ...parsedUserData, token });
              setIsAuthenticated(true);
              
              // Poi verifichiamo in background col server
              refreshUserStatus().catch(err => {
                logger.error('Errore durante il refresh in background:', err);
              });
            } else {
              // Abbiamo un token ma non dati utente, verifica col server
              refreshUserStatus().catch(err => {
                logger.error('Errore durante il refresh dopo token trovato:', err);
              });
            }
          }
        }
      } catch (error) {
        logger.error('Errore durante il ripristino dei dati utente:', error);
      }
    };
    
    restoreUserFromStorage();
  }, [user, isLoading, refreshUserStatus, isLoggingOut]);
  
  // Funzione di login
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      logger.log(`Tentativo di login per: ${email}`);
      const result = await loginUser(email, password);
      
      if (result && result.token) {
        setUser({ ...result.utente, token: result.token });
        setIsAuthenticated(true);
        
        // Assicuriamoci di salvare correttamente tutti i dati in AsyncStorage
        try {
          if (result.token) {
            await storeAccessToken(result.token);
            logger.log('Token salvato nello storage sicuro');
            
            // Imposta il token per le chiamate API
            setAuthToken(result.token);
          }
          
          if (result.utente) {
            await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(result.utente));
            logger.log('Dati utente salvati in AsyncStorage');
          }
          
          if (result.refreshToken) {
            await storeRefreshToken(result.refreshToken);
            logger.log('Refresh token salvato nello storage sicuro');
          }
        } catch (storageError) {
          logger.error('Errore nel salvataggio dei dati in AsyncStorage:', storageError);
        }
        
        return true;
      } else {
        setError(result?.error || 'Credenziali non valide');
        return false;
      }
    } catch (error: any) {
      logger.error('Errore durante il login:', error);
      setError(error.message || 'Errore durante il login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Effettua direttamente il login con credenziali
   * Utile per il login automatico dopo la registrazione
   */
  const loginWithCredentials = async (email: string, password: string): Promise<boolean> => {
    try {
      logger.log('Tentativo di login diretto con:', email);
      setIsLoading(true);
      clearError();
      
      // Esegui la richiesta di login
      const response = await loginUser(email, password);
      
      if (response && response.token && response.utente) {
        // Aggiorna lo stato dell'autenticazione
        setUser({ ...response.utente, token: response.token });
        setIsAuthenticated(true);
        
        logger.log('Login diretto completato con successo');
        
        // Mostra un toast di successo
        Toast.show({
          type: 'success',
          text1: 'Accesso effettuato',
          text2: `Benvenuto, ${response.utente.nome}!`,
          visibilityTime: 3000,
        });
        
        return true;
      } else {
        throw new Error('Dati di autenticazione non validi.');
      }
    } catch (error: any) {
      logger.error('Errore durante il login diretto:', error);
      
      // Non mostrare errori all'utente per il login automatico
      // ma registra l’errore nei log
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione di logout
  const logout = useCallback(async () => {
    // Imposta il flag di logout immediatamente e prima di qualsiasi altra operazione
    setIsLoggingOut(true);
    
    try {
      setIsLoading(true);
      logger.log('Esecuzione logout...');
      
      // Cancella tutti i listener o abboni attivi che potrebbero scatenare chiamate API
      // (ad esempio, qui potresti annullare eventuali polling o interval)
      
      // Pulisci prima lo stato interno per evitare refresh dello stato
      setUser(null);
      setIsAuthenticated(false);
      setAuthToken(null);
      
      // Pulisci AsyncStorage
      if (!Platform.isTV && typeof window !== 'undefined') {
        logger.log('Rimozione dati utente da AsyncStorage');
        await removeAccessToken();
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
        await removeRefreshToken();
        await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      }
      
      // Chiamata API per il logout (deregistrazione sul backend)
      // Esegui questa chiamata dopo aver rimosso i dati per evitare race conditions
      try {
        await logoutUser();
        logger.log('Logout API completato con successo');
      } catch (apiError) {
        // Se fallisce la chiamata API, log ma continua
        logger.log('Errore nella chiamata API di logout, ma continuiamo:', apiError);
      }
      
      // Notifica utente del logout avvenuto con successo
      Toast.show({
        type: 'success',
        text1: 'Logout completato',
        text2: 'Hai effettuato il logout con successo',
        visibilityTime: 3000,
      });
      
      logger.log('Logout completato con successo');
    } catch (error) {
      logger.error('Errore durante il logout:', error);
      
      // Anche in caso di errore, assicurati che l’utente sia considerato disconnesso
      setUser(null);
      setIsAuthenticated(false);
      setAuthToken(null);
      
      // Pulisci comunque AsyncStorage anche in caso di errore
      try {
        if (!Platform.isTV && typeof window !== 'undefined') {
          await removeAccessToken();
          await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
          await removeRefreshToken();
          await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        }
      } catch (storageError) {
        logger.error('Errore nella pulizia AsyncStorage durante logout fallito:', storageError);
      }
      
      // Notifica utente che il logout è stato completato nonostante errori
      Toast.show({
        type: 'info',
        text1: 'Logout completato',
        text2: 'Sei stato disconnesso dal sistema',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      // Rimuovi il flag di logout solo dopo che tutto è completato
      // Aumentiamo il ritardo per essere ancora più sicuri
      setTimeout(() => {
        setIsLoggingOut(false);
        logger.log('Flag di logout rimosso');
      }, 2000); // Ritardo più lungo per assicurarsi che eventuali operazioni pendenti siano terminate
    }
  }, []);

  // Funzione per registrare un nuovo utente
  const register = async (
    nome: string, 
    cognome: string | null, 
    email: string, 
    password: string,
    tipologia: 'organizzazione' | 'utente' | null,
    ruoloOrganizzazione: string | null,
    tipoUtente: string | null,
    indirizzo?: string,
    telefono?: string,
    via?: string | null,
    civico?: string | null,
    citta?: string | null,
    provincia?: string | null,
    cap?: string | null,
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      clearError();
      
      // Log per debug
      logger.log('DATI REGISTRAZIONE:');
      logger.log('- nome:', nome);
      logger.log('- cognome:', cognome, typeof cognome);
      logger.log('- tipologia:', tipologia);
      logger.log('- tipoUtente:', tipoUtente);
      
      // Gestione speciale per cognome in base al tipo utente
      let cognomeToSend = cognome;
      
      // Se il cognome è una stringa vuota o il tipoUtente è Canale sociale/centro riciclo, invialo come null
      if (!cognome || cognome === '' || 
          (tipologia === 'utente' && (tipoUtente === 'Canale sociale' || tipoUtente === 'centro riciclo'))) {
        cognomeToSend = null;
        logger.log('Impostato cognome a null per tipo:', tipoUtente);
      }
      
      // Chiama il servizio di registrazione con i dati correttamente formattati
      const userData: any = {
        nome,
        cognome: cognomeToSend, // Usa il valore appropriato
        email,
        password,
        ruolo: tipologia === 'organizzazione' 
              ? (ruoloOrganizzazione || 'Operatore')  // Fallback a Operatore se non specificato
              : 'Utente'
      };
      
      // Aggiungi i dati specifici del tipo utente se sono disponibili
      if (tipologia === 'utente' && tipoUtente) {
        userData.tipoUtente = {
          tipo: tipoUtente,
          indirizzo: indirizzo || '',
          telefono: telefono || '',
          email: email,
          // Aggiungi i campi dell'indirizzo separati per il backend
          via: via || '',
          civico: civico || '',
          citta: citta || '',
          provincia: provincia || '',
          cap: cap || ''
        };
      }
      
      logger.log('Invio dati registrazione:', userData);
      
      // Passa l’oggetto userData alla funzione registerUser
      const response = await registerUser(userData);
      
      if (response && response.success) {
        logger.log('Registrazione completata con successo per:', email);
        
        // Mostra un messaggio di successo
        Toast.show({
          type: 'success',
          text1: 'Registrazione completata',
          text2: 'Puoi accedere con le tue credenziali',
          visibilityTime: 4000,
        });
        
        return true;
      } else {
        throw new Error('Errore durante la registrazione. Riprova più tardi.');
      }
    } catch (error: any) {
      logger.error('Errore durante la registrazione:', error);
      
      // Gestione migliorata degli errori
      if (error.response) {
        // Errori basati sullo status HTTP
        switch (error.response.status) {
          case 409:
            setError('Email già in uso. Prova con un altro indirizzo email.');
            break;
          case 400:
            // Estrai il messaggio dal server se disponibile
            const serverMessage = error.response.data?.message;
            if (serverMessage && typeof serverMessage === 'string') {
              setError(`Errore di validazione: ${serverMessage}`);
            } else {
              setError('I dati inseriti non sono validi. Verifica tutti i campi.');
            }
            break;
          case 404:
            setError('Servizio di registrazione non disponibile. Contatta l\'amministratore.');
            break;
          case 500:
            setError('Errore sul server. Riprova più tardi o contatta l\'assistenza.');
            break;
          default:
            setError(`Errore durante la registrazione (Codice: ${error.response.status}).`);
        }
      } else if (error.request) {
        // Errori di rete
        setError('Impossibile connettersi al server. Verifica la tua connessione internet.');
      } else if (error.message) {
        // Usa il messaggio dell'errore se disponibile
        setError(error.message);
      } else {
        // Errore generico
        setError('Si è verificato un errore durante la registrazione. Riprova più tardi.');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Funzione per pulire gli errori
  const clearError = () => {
    setError(null);
  };

  // Aggiungiamo una funzione per refresh del token
  const refreshToken = async (): Promise<boolean> => {
    try {
      // Ottieni il refresh token
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        logger.log('Nessun refresh token disponibile');
        return false;
      }
      
      logger.log('Tentativo di refresh del token...');
      
      // Prima prova con il nuovo endpoint
      try {
        const response = await axios.post(`${API_URL}/auth/refresh-token`, { refresh_token: refreshToken });
        
        if (response.status === 200 && (response.data.access_token || response.data.token)) {
          logger.log('Token rinnovato con successo');
          const newToken = response.data.access_token || response.data.token;
          
          // Salva il nuovo token
          await storeAccessToken(newToken);
          setAuthToken(newToken);
          
          // Se c'è un nuovo refresh token, salvalo
          if (response.data.refresh_token) {
            await storeRefreshToken(response.data.refresh_token);
          }
          
          // Verifica lo stato dell'utente dopo il refresh
          const userData = await checkUserAuth();
          if (userData) {
            setUser({ ...userData, token: newToken });
            setIsAuthenticated(true);
            await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
            // Notifica che la sessione è stata ripristinata
            Toast.show({
              type: 'success',
              text1: 'Sessione ripristinata',
              text2: 'La tua sessione è stata aggiornata con successo',
              visibilityTime: 3000,
            });
          }
          
          return true;
        }
      } catch (error) {
        logger.log('Errore con nuovo endpoint, provo con /auth/refresh', error);
        
        // Se fallisce, prova con il vecchio endpoint
        try {
          const fallbackResponse = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
          
          if (fallbackResponse.status === 200 && (fallbackResponse.data.access_token || fallbackResponse.data.token)) {
            logger.log('Token rinnovato con successo (endpoint fallback)');
            const newToken = fallbackResponse.data.access_token || fallbackResponse.data.token;
            
            // Salva il nuovo token
            await storeAccessToken(newToken);
            setAuthToken(newToken);
            
            // Se c'è un nuovo refresh token, salvalo
            if (fallbackResponse.data.refresh_token) {
              await storeRefreshToken(fallbackResponse.data.refresh_token);
            }
            
            // Verifica lo stato dell'utente dopo il refresh
            const userData = await checkUserAuth();
            if (userData) {
              setUser({ ...userData, token: newToken });
              setIsAuthenticated(true);
              await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
              // Notifica che la sessione è stata ripristinata
              Toast.show({
                type: 'success',
                text1: 'Sessione ripristinata',
                text2: 'La tua sessione è stata aggiornata con successo',
                visibilityTime: 3000,
              });
            }
            
            return true;
          }
        } catch (fallbackErr) {
          logger.error('Errore anche con endpoint fallback:', fallbackErr);
        }
      }
      
      // Se arriviamo qui, entrambi i tentativi sono falliti
      logger.log('Tutti i tentativi di refresh del token sono falliti');
      return false;
    } catch (error) {
      logger.error('Errore durante il refresh del token:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        error,
        login,
        logout,
        clearError,
        refreshUserStatus,
        register,
        loginWithCredentials,
        refreshToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizzato per utilizzare l’AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere utilizzato all\'interno di un AuthProvider');
  }
  
  // Verifica che le funzioni esistano e siano valide
  if (typeof context.logout !== 'function') {
    logger.error('ERRORE CRITICO: context.logout non è una funzione valida!');
  }
  
  if (typeof context.refreshUserStatus !== 'function') {
    logger.error('ERRORE CRITICO: context.refreshUserStatus non è una funzione valida!');
  }
  
  // Aggiungere una funzione di forceAuthUpdate per forzare l’aggiornamento dell'interfaccia
  const forceAuthUpdate = () => {
    logger.log('useAuth - forceAuthUpdate chiamata');
    // Usa direttamente il refresh per forzare un aggiornamento dello stato
    if (typeof context.refreshUserStatus === 'function') {
      context.refreshUserStatus();
    } else {
      logger.error('Impossibile forzare aggiornamento: refreshUserStatus non disponibile');
    }
  };
  
  // Estendi il context con le funzioni utili aggiuntive
  return {
    ...context,
    forceAuthUpdate
  };
};
