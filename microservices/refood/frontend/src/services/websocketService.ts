import AsyncStorage from '@react-native-async-storage/async-storage';
import { Subject } from 'rxjs';
import { API_URL, STORAGE_KEYS } from '../config/constants';
import logger from '../utils/logger';
import { getActiveToken } from './authService';

// Definizione degli eventi WebSocket
export enum WebSocketEvent {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  MESSAGE = 'message',
  ERROR = 'error',
  NOTIFICATION = 'notification',
  LOTTO_UPDATE = 'lotto_update',
  PRENOTAZIONE_UPDATE = 'prenotazione_update'
}

// Definizione dell'interfaccia per i messaggi WebSocket
export interface WebSocketMessage {
  type: WebSocketEvent;
  payload: any;
  timestamp: number;
}

/**
 * Servizio per la gestione delle connessioni WebSocket
 */
class WebSocketService {
  private webSocket: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;
  private backendUrlPromise: Promise<string> | null = null;
  private lastErrorMessage: string = '';
  private endpointUnavailable: boolean = false;
  private lastEndpointCheck: number = 0;
  private endpointCheckInterval: number = 3600000;

  /**
   * Ottiene l'URL del backend WebSocket
   */
  private getBackendUrl(): Promise<string> {
    if (!this.backendUrlPromise) {
      this.backendUrlPromise = this.resolveBackendUrl();
    }
    return this.backendUrlPromise;
  }

  /**
   * Risolve l'URL del backend WebSocket
   */
  private async resolveBackendUrl(): Promise<string> {
    try {
      // Logging dell'URL API originale
      logger.log('API URL originale:', API_URL);
      
      // 1. Estrai il protocollo, l'host e il path dall'URL API
      // Esempio: http://192.168.1.162:3000/api/v1
      let protocol = 'ws';
      let host = '';
      let basePath = '';
      
      // Pattern per estrarre protocollo, host e base path
      const pattern = /^(https?):\/\/([^\/]+)\/(.+)$/;
      const match = API_URL.match(pattern);
      
      if (match) {
        // Converti http -> ws, https -> wss
        protocol = match[1] === 'https' ? 'wss' : 'ws';
        host = match[2]; // host:port
        basePath = match[3]; // e.g. api/v1
      } else {
        // Fallback se il pattern non corrisponde
        logger.error('Formato API_URL non riconosciuto, utilizzo default');
        // Costruisci un URL di fallback utilizzando l'host corrente
        host = '192.168.1.162:3000';
        basePath = 'api/v1';
      }
      
      // 2. Costruisci l'URL WebSocket includendo l'API_PREFIX (es. /api/v1)
      const normalizedBase = basePath.replace(/\/$/, '');
      const wsUrl = `${protocol}://${host}/${normalizedBase}/notifications/ws`;
      
      // Logging dell'URL WebSocket finale
      logger.log('WebSocket URL risolto:', wsUrl);
      
      return wsUrl;
    } catch (error) {
      logger.error('Errore nel determinare l\'URL WebSocket:', error);
      throw error;
    }
  }

  /**
   * Inizializza la connessione WebSocket
   */
  async connect(): Promise<void> {
    const now = Date.now();
    
    // Se l'endpoint è stato segnato come non disponibile
    if (this.endpointUnavailable) {
      // Controlliamo se è passato abbastanza tempo dall'ultimo controllo
      if (now - this.lastEndpointCheck < this.endpointCheckInterval) {
        // Non proviamo a riconnetterci troppo frequentemente se sappiamo che l'endpoint non è disponibile
        logger.log('WebSocket endpoint precedentemente non disponibile, utilizzo polling come fallback');
        
        // Notifica i client che il WebSocket non è disponibile ma stabile
        this.messageSubject.next({
          type: WebSocketEvent.ERROR,
          payload: { 
            error: 'Endpoint WebSocket non disponibile, utilizzo polling',
            permanent: true,
            usingFallback: true
          },
          timestamp: Date.now()
        });
        
        return;
      } else {
        // Proviamo a verificare nuovamente se l'endpoint è ora disponibile
        logger.log('Tentativo di verifica disponibilità  endpoint WebSocket dopo periodo di attesa');
        this.lastEndpointCheck = now;
        // Resettiamo per permettere un nuovo tentativo
        this.endpointUnavailable = false;
        this.reconnectAttempts = 0;
      }
    }

    if (this.webSocket?.readyState === WebSocket.OPEN || this.isConnecting) {
      logger.log('WebSocket già  connesso o in fase di connessione');
      return;
    }

    this.isConnecting = true;

    try {
      logger.log('Tentativo di connessione WebSocket...');
      
      const wsUrl = await this.getBackendUrl();
      logger.log('WebSocket base URL:', wsUrl);
      
      const authToken = await getActiveToken();
      
      if (!authToken) {
        logger.error('Token di autenticazione non disponibile');
        throw new Error('Token di autenticazione non disponibile');
      }
      
      // Log per il debug (senza mostrare il token completo per sicurezza)
      const tokenPreview = authToken.substring(0, 10) + '...' + authToken.substring(authToken.length - 5);
      logger.log('Token di autenticazione disponibile:', tokenPreview);

      // Aggiungi il token all'URL come query parameter per l'autenticazione
      const wsUrlWithAuth = `${wsUrl}?token=${encodeURIComponent(authToken)}`;
      
      // Log sicuro dell'URL completo (senza esporre il token completo)
      const safeLogUrl = wsUrlWithAuth.replace(authToken, tokenPreview);
      logger.log('WebSocket URL completo (sicuro):', safeLogUrl);
      
      // Crea la connessione WebSocket
      this.webSocket = new WebSocket(wsUrlWithAuth);

      // Configura gli eventi WebSocket
      this.webSocket.onopen = this.handleOpen.bind(this);
      this.webSocket.onmessage = this.handleMessage.bind(this);
      this.webSocket.onerror = this.handleError.bind(this);
      this.webSocket.onclose = this.handleClose.bind(this);

      logger.log('Connessione WebSocket inizializzata');
    } catch (error) {
      logger.error('Errore nell\'inizializzazione della connessione WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Gestisce l'evento di apertura della connessione
   */
  private handleOpen(event: Event): void {
    logger.log('WebSocket connesso');
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.startHeartbeat();

    // Invia un messaggio di connessione
    this.messageSubject.next({
      type: WebSocketEvent.CONNECT,
      payload: {},
      timestamp: Date.now()
    });
  }

  /**
   * Gestisce i messaggi in arrivo
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      logger.log('WebSocket messaggio ricevuto:', data);

      // Notifica i subscriber del messaggio ricevuto
      this.messageSubject.next({
        type: data.type || WebSocketEvent.MESSAGE,
        payload: data,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Errore nell\'elaborazione del messaggio WebSocket:', error);
    }
  }

  /**
   * Gestisce gli errori della connessione
   */
  private handleError(event: Event): void {
    logger.error('Errore WebSocket:', event);
    
    // Estrai i dettagli dell'errore
    const errorEvent = event as ErrorEvent;
    const errorMessage = errorEvent.message || '';
    this.lastErrorMessage = errorMessage;
    
    // Log dettagliato dell'errore
    logger.error('Dettagli errore WebSocket:', {
      message: errorMessage,
      type: event.type,
      timestamp: new Date().toISOString()
    });
    
    // Gestione errore 400 Bad Request
    if (errorMessage.includes('400 Bad Request')) {
      logger.warn('Rilevato errore 400 Bad Request - Probabile problema di autenticazione');
      
      // Incrementa il contatore di tentativi
      this.reconnectAttempts++;
      
      // Se riceviamo pià¹ volte errori 400, potrebbe esserci un problema con il token
      if (this.reconnectAttempts >= 2) {
        logger.warn('Multipli errori 400 Bad Request - Possibile token non valido o scaduto');
        
        // Notifica che è necessario effettuare nuovamente il login
        this.messageSubject.next({
          type: WebSocketEvent.ERROR,
          payload: {
            error: 'Autenticazione WebSocket fallita - Necessario riaccedere',
            code: 400,
            authError: true,
            permanent: false
          },
          timestamp: Date.now()
        });
        
        // Prova a pulire e ottenere un nuovo token al prossimo tentativo
        setTimeout(async () => {
          try {
            // Tentativo di refresh del token
            // Questo potrebbe richiedere una chiamata al servizio di autenticazione
            logger.log('Tentativo di refresh del token per WebSocket...');
            
            // ...implementazione della logica di refresh...
            
          } catch (refreshError) {
            logger.error('Errore nel refresh del token:', refreshError);
          }
        }, 1000);
        
        return;
      }
    }
    
    // Se è un errore 404, acceleriamo la decisione
    if (this.lastErrorMessage.includes('404 Not Found')) {
      logger.warn('Rilevato errore 404 - Endpoint WebSocket non disponibile');
      this.reconnectAttempts++; // Incrementiamo per tracciare
      
      // Controlliamo se abbiamo già  fatto almeno 2 tentativi
      if (this.reconnectAttempts >= 2) {
        logger.warn('Endpoint WebSocket confermato non disponibile dopo ripetuti errori 404');
        this.endpointUnavailable = true;
        this.lastEndpointCheck = Date.now();
        
        // Cancella eventuali riconnessioni pianificate
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        
        // Notifica dell'errore permanente con flag per usare il fallback
        this.messageSubject.next({
          type: WebSocketEvent.ERROR,
          payload: { 
            error: 'Endpoint WebSocket non disponibile, utilizzo polling',
            permanent: true,
            usingFallback: true
          },
          timestamp: Date.now()
        });
        
        // Non pianifichiamo altri tentativi di riconnessione
        return;
      }
    }
    
    // Notifica i subscriber dell'errore generico
    this.messageSubject.next({
      type: WebSocketEvent.ERROR,
      payload: { 
        error: 'Errore di connessione WebSocket',
        message: errorMessage
      },
      timestamp: Date.now()
    });
  }

  /**
   * Gestisce la chiusura della connessione
   */
  private handleClose(event: CloseEvent): void {
    logger.log(`WebSocket disconnesso. Codice: ${event.code}, Motivo: ${event.reason}`);
    this.isConnecting = false;
    this.stopHeartbeat();

    // Notifica i subscriber della disconnessione
    this.messageSubject.next({
      type: WebSocketEvent.DISCONNECT,
      payload: {
        code: event.code,
        reason: event.reason
      },
      timestamp: Date.now()
    });

    // Tenta di riconnettersi a meno che la chiusura sia stata richiesta
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Pianifica un tentativo di riconnessione
   */
  private scheduleReconnect(): void {
    // Se l'endpoint è stato marcato come non disponibile, non pianifichiamo riconnessioni
    if (this.endpointUnavailable) {
      logger.warn('Nessun tentativo di riconnessione: endpoint WebSocket non disponibile');
      return;
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('Numero massimo di tentativi di riconnessione raggiunto');
      
      // Verifica se l'ultimo errore era un 404 Not Found
      const isEndpointNotFound = this.lastErrorMessage && this.lastErrorMessage.includes('404 Not Found');
      
      if (isEndpointNotFound) {
        logger.warn('Endpoint WebSocket non trovato (404). Disabilitazione dei tentativi di riconnessione.');
        // Imposta una flag per evitare futuri tentativi di connessione
        this.endpointUnavailable = true;
        this.lastEndpointCheck = Date.now();
        
        // Notifica dell'errore permanente con flag per usare il fallback
        this.messageSubject.next({
          type: WebSocketEvent.ERROR,
          payload: { 
            error: 'Endpoint WebSocket non disponibile, utilizzo polling',
            permanent: true,
            usingFallback: true
          },
          timestamp: Date.now()
        });
      }
      
      return;
    }

    // Calcola il ritardo con backoff esponenziale (1s, 2s, 4s, ...)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    logger.log(`Tentativo di riconnessione ${this.reconnectAttempts}/${this.maxReconnectAttempts} tra ${delay}ms`);

    // Pulisci eventuali timeout precedenti
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Pianifica la riconnessione
    this.reconnectTimeout = setTimeout(() => {
      logger.log('Tentativo di riconnessione WebSocket...');
      this.connect();
    }, delay);
  }

  /**
   * Avvia l'heartbeat per mantenere la connessione attiva
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Assicurati che non ci siano altri heartbeat in esecuzione

    this.heartbeatInterval = setInterval(() => {
      if (this.webSocket?.readyState === WebSocket.OPEN) {
        // Invia un ping al server
        this.webSocket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 secondi
  }

  /**
   * Ferma l'heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Invia un messaggio al server
   */
  sendMessage(message: any): void {
    if (this.webSocket?.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify(message));
    } else {
      logger.warn('Tentativo di invio messaggio WebSocket senza connessione');
      
      // Tenta di riconnettersi e poi inviare il messaggio
      this.connect().then(() => {
        if (this.webSocket?.readyState === WebSocket.OPEN) {
          this.webSocket.send(JSON.stringify(message));
        }
      });
    }
  }

  /**
   * Chiude la connessione WebSocket
   */
  disconnect(): void {
    if (this.webSocket) {
      // Rimuovi tutti i gestori di eventi per evitare memory leak
      this.webSocket.onopen = null;
      this.webSocket.onmessage = null;
      this.webSocket.onerror = null;
      this.webSocket.onclose = null;

      // Chiudi la connessione se aperta
      if (this.webSocket.readyState === WebSocket.OPEN || 
          this.webSocket.readyState === WebSocket.CONNECTING) {
        this.webSocket.close(1000, 'Disconnessione richiesta dall\'utente');
      }

      this.webSocket = null;
    }

    // Ferma i timer
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Ottiene l'observable per i messaggi
   */
  getMessages() {
    return this.messageSubject.asObservable();
  }

  /**
   * Verifica se il WebSocket è connesso
   */
  isConnected(): boolean {
    return this.webSocket?.readyState === WebSocket.OPEN;
  }

  /**
   * Reimposta il servizio WebSocket
   */
  reset(): void {
    this.disconnect();
    this.backendUrlPromise = null;
  }
}

export default new WebSocketService(); 


