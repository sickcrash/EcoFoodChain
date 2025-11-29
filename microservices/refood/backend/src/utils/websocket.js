const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const db = require('../config/database');
const { hashToken } = require('./tokenUtils');

/**
 * Enum per i tipi di eventi WebSocket
 */
const WebSocketEvent = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  ERROR: 'error',
  NOTIFICATION: 'notification',
  LOTTO_UPDATE: 'lotto_update',
  PRENOTAZIONE_UPDATE: 'prenotazione_update',
  RECONNECT: 'reconnect',
  PONG: 'pong'
};

class WebSocketService {
  constructor() {
    this.clients = new Map(); // Map<userId, WebSocket[]>
    this.pendingReconnections = new Map(); // Map<sessionId, {userId, expires}>
    this.server = null;
    this.pingInterval = null;
    this.heartbeatInterval = null;
    this.cleanupInterval = null;
    this.isActive = false;
    this.connectionRetries = 0;
    this.maxConnectionRetries = 5;
  }

  /**
   * Inizializza il server WebSocket
   * @param {import('http').Server} httpServer - Il server HTTP di Express
   */
  init(httpServer) {
    try {
      logger.info('WebSocket: Inizializzazione del servizio...');
      this.isActive = true;
      
      // Crea un server WebSocket collegato al server HTTP
      const API_PREFIX = process.env.API_PREFIX || '/api/v1';
      const WS_PATH = `${API_PREFIX.replace(/\/$/, '')}/notifications/ws`;
      this.server = new WebSocket.Server({
        server: httpServer,
        path: WS_PATH,
        // Aumenta il timeout per mantenere le connessioni più a lungo
        clientTracking: true,
        perMessageDeflate: {
          zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3
          },
          zlibInflateOptions: {
            chunkSize: 10 * 1024
          },
          // Soglia sotto la quale i messaggi non vengono compressi
          threshold: 1024,
          // Disabilita il context takeover per client e server
          serverNoContextTakeover: true,
          clientNoContextTakeover: true
        }
      });

      // Gestione delle connessioni
      this.server.on('connection', (ws, req) => this.handleConnection(ws, req));
      
      // Gestione degli errori del server WebSocket
      this.server.on('error', (error) => {
        logger.error(`WebSocket: Errore del server: ${error.message}`);
        this.restartServer(httpServer);
      });
      
      // Avvia il ping dei client per mantenere attive le connessioni (ogni 30 secondi)
      this.pingInterval = setInterval(() => this.pingClients(), 30000);
      
      // Controllo dello stato delle connessioni (ogni 60 secondi)
      this.heartbeatInterval = setInterval(() => this.checkConnections(), 60000);
      
      // Pulizia delle sessioni scadute di riconnessione (ogni 5 minuti)
      this.cleanupInterval = setInterval(() => this.cleanupPendingReconnections(), 300000);
      
      logger.info('WebSocket: Servizio inizializzato con successo');
    } catch (error) {
      logger.error(`WebSocket: Errore durante l'inizializzazione: ${error.message}`);
      this.isActive = false;
      
      // Riprova a inizializzare il server dopo un breve ritardo
      if (this.connectionRetries < this.maxConnectionRetries) {
        this.connectionRetries++;
        logger.info(`WebSocket: Tentativo di riconnessione ${this.connectionRetries}/${this.maxConnectionRetries} in 5 secondi...`);
        setTimeout(() => this.init(httpServer), 5000);
      } else {
        logger.error(`WebSocket: Numero massimo di tentativi di riconnessione raggiunto. Servizio non disponibile.`);
      }
    }
    
    return this;
  }

  /**
   * Riavvia il server WebSocket in caso di errore critico
   * @param {import('http').Server} httpServer - Il server HTTP di Express
   */
  restartServer(httpServer) {
    logger.info('WebSocket: Tentativo di riavvio del servizio...');
    
    // Chiudi il server esistente
    this.stop();
    
    // Attendi un breve periodo prima di riavviare
    setTimeout(() => {
      this.connectionRetries = 0;
      this.init(httpServer);
    }, 3000);
  }

  /**
   * Genera un ID di sessione univoco per le riconnessioni
   * @param {number} userId - ID dell'utente
   * @returns {string} ID di sessione univoco
   */
  generateSessionId(userId) {
    return `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Gestisce una nuova connessione WebSocket
   * @param {WebSocket} ws - Oggetto WebSocket
   * @param {import('http').IncomingMessage} req - Richiesta HTTP
   */
  async handleConnection(ws, req) {
    try {
      // Genera un ID temporaneo per la connessione in attesa di autenticazione
      ws.tempId = Date.now().toString();
      ws.isAlive = true;
      ws.isAuthenticated = false;
      ws.connectedAt = new Date();
      
      // Ottiene statistiche connessioni
      const stats = this.getStatistiche();
      logger.info(`Nuova connessione WebSocket ricevuta (ID temporaneo: ${ws.tempId}) - Utenti: ${stats.utenti_connessi}, Connessioni: ${stats.connessioni_totali}`);
      
      // Estrae il token JWT o session_id dal query parameter
      const params = url.parse(req.url, true).query;
      const token = params.token;
      const sessionId = params.session_id;
      
      // Gestione riconnessione usando session_id
      if (sessionId && !token) {
        return this.handleReconnection(ws, sessionId);
      }
      
      if (!token) {
        logger.warn(`Connessione WebSocket rifiutata: Token non fornito - Utenti: ${stats.utenti_connessi}, Connessioni: ${stats.connessioni_totali}`);
        this.sendErrorAndClose(ws, 'Token non fornito');
        return;
      }
      
      // Verifica il token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Log del payload decodificato (omettendo informazioni sensibili)
        const safePayload = { ...decoded };
        delete safePayload.iat;
        delete safePayload.exp;
        delete safePayload.jti;
        
        logger.debug(`Token JWT decodificato: ${JSON.stringify(safePayload)}`);
      } catch (error) {
        logger.warn(`Connessione WebSocket rifiutata: Token non valido - ${error.message} - Utenti: ${stats.utenti_connessi}, Connessioni: ${stats.connessioni_totali}`);
        this.sendErrorAndClose(ws, 'Token non valido');
        return;
      }
      
      // Estrae l'ID utente dal token (può essere nel campo 'id' o 'sub')
      const userId = decoded.id || decoded.sub;

      // Verifica che il payload contenga l'ID utente (id o sub)
      if (!userId) {
        logger.warn(`Connessione WebSocket rifiutata: Token mancante di ID utente (nessun campo 'id' o 'sub' trovato) - Utenti: ${stats.utenti_connessi}, Connessioni: ${stats.connessioni_totali}`);
        this.sendErrorAndClose(ws, 'Token non valido: manca ID utente');
        return;
      }
      
      // Verifica che il token non sia revocato
      const tokenValido = await this.verificaToken(token);
      if (!tokenValido) {
        logger.warn(`Connessione WebSocket rifiutata: Token revocato o scaduto per utente ID: ${userId} - Utenti: ${stats.utenti_connessi}, Connessioni: ${stats.connessioni_totali}`);
        this.sendErrorAndClose(ws, 'Token revocato o scaduto');
        return;
      }
      
      // Salva il client nella mappa
      if (!this.clients.has(userId)) {
        this.clients.set(userId, []);
      }
      this.clients.get(userId).push(ws);
      
      // Salva l'ID attore e altre informazioni nel WebSocket per riferimento futuro
      ws.userId = userId;
      ws.isAuthenticated = true;
      
      // Genera un ID di sessione per future riconnessioni
      ws.sessionId = this.generateSessionId(userId);
      
      // Salva la sessione per la riconnessione (valida per 24 ore)
      const reconnectExpires = new Date();
      reconnectExpires.setHours(reconnectExpires.getHours() + 24);
      this.pendingReconnections.set(ws.sessionId, {
        userId: userId,
        expires: reconnectExpires
      });
      
      // Aggiorna statistiche dopo connessione
      const statsUpdated = this.getStatistiche();
      const numConUtente = this.clients.get(userId).length;
      logger.info(`Nuova connessione WebSocket stabilita per l'attore ID: ${userId} (Sessione: ${ws.sessionId}) - Utenti: ${statsUpdated.utenti_connessi}, Connessioni: ${statsUpdated.connessioni_totali}, Connessioni per questo utente: ${numConUtente}`);
      
      // Invia un messaggio di conferma connessione con sessionId per riconnessione
      this.sendMessage(ws, {
        type: WebSocketEvent.CONNECT,
        payload: { 
          message: 'Connessione stabilita',
          session_id: ws.sessionId 
        },
        timestamp: Date.now()
      });
      
      // Gestione messaggi dal client
      ws.on('message', (message) => this.handleMessage(ws, message));
      
      // Gestione chiusura connessione
      ws.on('close', (code, reason) => this.handleClose(ws, code, reason));
      
      // Gestione errori
      ws.on('error', (error) => {
        logger.error(`Errore WebSocket per l'attore ${userId}: ${error.message}`);
      });
      
      // Gestione pong (risposta al ping)
      ws.on('pong', () => {
        ws.isAlive = true;
        logger.debug(`Pong ricevuto da attore ID: ${userId}`);
      });
      
    } catch (error) {
      logger.error(`Errore nella gestione della connessione WebSocket: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
      this.sendErrorAndClose(ws, 'Errore interno del server');
    }
  }

  /**
   * Gestisce la riconnessione di un client usando un ID di sessione
   * @param {WebSocket} ws - WebSocket client
   * @param {string} sessionId - ID della sessione per la riconnessione
   */
  handleReconnection(ws, sessionId) {
    try {
      const stats = this.getStatistiche();
      // Verifica se l'ID di sessione è valido
      if (!this.pendingReconnections.has(sessionId)) {
        logger.warn(`Tentativo di riconnessione fallito: Session ID non valido: ${sessionId} - Utenti: ${stats.utenti_connessi}, Connessioni: ${stats.connessioni_totali}`);
        this.sendErrorAndClose(ws, 'Session ID non valido o scaduto');
        return;
      }
      
      const reconnInfo = this.pendingReconnections.get(sessionId);
      
      // Verifica se la sessione è scaduta
      if (new Date() > reconnInfo.expires) {
        logger.warn(`Tentativo di riconnessione fallito: Session ID scaduto: ${sessionId} - Utenti: ${stats.utenti_connessi}, Connessioni: ${stats.connessioni_totali}`);
        this.pendingReconnections.delete(sessionId);
        this.sendErrorAndClose(ws, 'Session ID scaduto');
        return;
      }
      
      const userId = reconnInfo.userId;
      
      // Salva il client nella mappa
      if (!this.clients.has(userId)) {
        this.clients.set(userId, []);
      }
      this.clients.get(userId).push(ws);
      
      // Aggiorna le informazioni della connessione
      ws.userId = userId;
      ws.isAuthenticated = true;
      ws.sessionId = sessionId;
      
      // Aggiorna statistiche dopo riconnessione
      const statsUpdated = this.getStatistiche();
      const numConUtente = this.clients.get(userId).length;
      logger.info(`Riconnessione WebSocket per l'attore ID: ${userId} (Sessione: ${sessionId}) - Utenti: ${statsUpdated.utenti_connessi}, Connessioni: ${statsUpdated.connessioni_totali}, Connessioni per questo utente: ${numConUtente}`);
      
      // Invia un messaggio di conferma riconnessione
      this.sendMessage(ws, {
        type: WebSocketEvent.RECONNECT,
        payload: { 
          message: 'Riconnessione riuscita',
          session_id: sessionId 
        },
        timestamp: Date.now()
      });
      
      // Gestione messaggi dal client
      ws.on('message', (message) => this.handleMessage(ws, message));
      
      // Gestione chiusura connessione
      ws.on('close', (code, reason) => this.handleClose(ws, code, reason));
      
      // Gestione errori
      ws.on('error', (error) => {
        logger.error(`Errore WebSocket per l'attore ${userId}: ${error.message}`);
      });
      
      // Gestione pong (risposta al ping)
      ws.on('pong', () => {
        ws.isAlive = true;
        logger.debug(`Pong ricevuto da attore ID: ${userId}`);
      });
      
    } catch (error) {
      logger.error(`Errore nella gestione della riconnessione WebSocket: ${error.message}`);
      this.sendErrorAndClose(ws, 'Errore interno del server durante la riconnessione');
    }
  }

  /**
   * Verifica che il token non sia stato revocato
   * @param {string} token - Token JWT da verificare
   * @returns {Promise<boolean>} True se il token è valido
   */
  async verificaToken(token) {
    try {
      const tokenHash = hashToken(token);
      let row = null;
      if (tokenHash) {
        row = await db.get(`
          SELECT id
          FROM TokenAutenticazione
          WHERE access_token = ?
            AND access_token_scadenza > NOW()
            AND revocato = FALSE
        `, [tokenHash]);
      }
      if (!row) {
        row = await db.get(`
          SELECT id, access_token
          FROM TokenAutenticazione
          WHERE access_token = ?
            AND access_token_scadenza > NOW()
            AND revocato = FALSE
        `, [token]);
        if (row && tokenHash) {
          await db.run(`
            UPDATE TokenAutenticazione
               SET access_token = ?, access_token_hash = ?
             WHERE id = ?
          `, [tokenHash, tokenHash, row.id]);
        }
      }
      return !!row;
    } catch (error) {
      logger.error(`Errore nella verifica del token: ${error.message}`);
      return false;
    }
  }

  /**
   * Controlla lo stato di tutte le connessioni
   */
  checkConnections() {
    try {
      const statsIniziali = this.getStatistiche();
      logger.debug(`WebSocket: Controllo stato connessioni - Utenti: ${statsIniziali.utenti_connessi}, Connessioni: ${statsIniziali.connessioni_totali}`);
      let connessioniAttive = 0;
      let connessioniInattive = 0;
      
      // Controllo tutte le connessioni
      for (const [userId, clients] of this.clients.entries()) {
        for (let i = 0; i < clients.length; i++) {
          const ws = clients[i];
          
          if (!ws.isAlive) {
            // Connessione non risponde al ping, termina
            logger.warn(`Connessione inattiva rilevata per attore ID: ${userId}, chiusura forzata - Connessioni rimaste per utente: ${clients.length - 1}`);
            ws.terminate();
            connessioniInattive++;
            continue;
          }
          
          // Imposta come inattivo, il prossimo pong lo riporterà attivo
          ws.isAlive = false;
          connessioniAttive++;
          
          // Invia ping per verificare lo stato
          try {
            ws.ping();
          } catch (error) {
            logger.error(`Errore nell'invio ping a client ${userId}: ${error.message}`);
          }
        }
      }
      
      const statsDopo = this.getStatistiche();
      logger.info(`WebSocket: Stato connessioni - Attive: ${connessioniAttive}, Terminate: ${connessioniInattive} - Utenti: ${statsDopo.utenti_connessi}, Totale connessioni: ${statsDopo.connessioni_totali}`);
    } catch (error) {
      logger.error(`Errore nel controllo delle connessioni: ${error.message}`);
    }
  }

  /**
   * Pulisce le sessioni di riconnessione scadute
   */
  cleanupPendingReconnections() {
    try {
      const now = new Date();
      let sessioniEliminate = 0;
      
      for (const [sessionId, info] of this.pendingReconnections.entries()) {
        if (now > info.expires) {
          this.pendingReconnections.delete(sessionId);
          sessioniEliminate++;
        }
      }
      
      if (sessioniEliminate > 0) {
        logger.info(`WebSocket: Pulite ${sessioniEliminate} sessioni di riconnessione scadute`);
      }
    } catch (error) {
      logger.error(`Errore nella pulizia delle sessioni: ${error.message}`);
    }
  }

  /**
   * Invia un messaggio di errore e chiude la connessione
   * @param {WebSocket} ws - WebSocket client
   * @param {string} message - Messaggio di errore
   */
  sendErrorAndClose(ws, message) {
    try {
      this.sendMessage(ws, {
        type: WebSocketEvent.ERROR,
        payload: { message },
        timestamp: Date.now()
      });
      
      // Chiudi la connessione in modo corretto
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, message);
      } else {
        ws.terminate();
      }
    } catch (error) {
      logger.error(`Errore nell'invio del messaggio di errore: ${error.message}`);
      // Tenta comunque di chiudere
      try {
        ws.terminate();
      } catch (e) {
        // Ignora ulteriori errori
      }
    }
  }

  /**
   * Gestisce i messaggi in arrivo dai client
   * @param {WebSocket} ws - WebSocket client
   * @param {string} message - Messaggio ricevuto
   */
  handleMessage(ws, message) {
    try {
      // Controlla autenticazione
      if (!ws.isAuthenticated) {
        logger.warn(`Messaggio ricevuto da client non autenticato`);
        return;
      }
      
      // Analizza il messaggio
      const data = JSON.parse(message);
      
      // Aggiorna stato connessione
      ws.isAlive = true;
      
      if (data.type === 'ping') {
        this.sendMessage(ws, {
          type: WebSocketEvent.PONG,
          timestamp: Date.now()
        });
        return;
      }
      
      // Altri tipi di messaggi possono essere implementati qui
      logger.debug(`Messaggio ricevuto da attore ID ${ws.userId}: ${JSON.stringify(data)}`);
      
    } catch (error) {
      logger.error(`Errore nel parsing del messaggio WebSocket: ${error.message}`);
    }
  }

  /**
   * Gestisce la chiusura di una connessione
   * @param {WebSocket} ws - WebSocket client
   * @param {number} code - Codice di chiusura
   * @param {string} reason - Motivo della chiusura
   */
  handleClose(ws, code = 1000, reason = 'Chiusura normale') {
    try {
      const userId = ws.userId;
      const tempId = ws.tempId;
      
      if (!userId) {
        const stats = this.getStatistiche();
        logger.info(`Chiusura connessione WebSocket non autenticata (ID temporaneo: ${tempId || 'sconosciuto'}) - Utenti: ${stats.utenti_connessi}, Connessioni: ${stats.connessioni_totali}`);
        return;
      }
      
      // Rimuove il client dalla mappa
      let numConUtente = 0;
      if (this.clients.has(userId)) {
        const userClients = this.clients.get(userId);
        const index = userClients.indexOf(ws);
        
        if (index !== -1) {
          userClients.splice(index, 1);
        }
        
        numConUtente = userClients.length;
        
        // Se non ci sono più client per questo attore, rimuove l'attore dalla mappa
        if (userClients.length === 0) {
          this.clients.delete(userId);
        }
        
        // Il sessionId rimane valido per la riconnessione
        logger.info(`Sessione ${ws.sessionId} disponibile per riconnessione fino a ${this.pendingReconnections.get(ws.sessionId)?.expires}`);
      }
      
      const stats = this.getStatistiche();
      logger.info(`Chiusura connessione WebSocket per l'attore ID: ${userId}, Codice: ${code}, Motivo: ${reason} - Utenti: ${stats.utenti_connessi}, Connessioni: ${stats.connessioni_totali}, Connessioni rimaste per questo utente: ${numConUtente}`);
      
      // Rimuovi i listener per evitare memory leaks
      ws.removeAllListeners();
    } catch (error) {
      logger.error(`Errore nella gestione della chiusura connessione: ${error.message}`);
    }
  }

  /**
   * Invia un messaggio ping a tutti i client per mantenere attive le connessioni
   */
  pingClients() {
    try {
      let clientTotali = 0;
      let pingInviati = 0;
      
      for (const [userId, clients] of this.clients.entries()) {
        for (const client of clients) {
          clientTotali++;
          if (client.readyState === WebSocket.OPEN) {
            try {
              this.sendMessage(client, {
                type: 'ping',
                timestamp: Date.now()
              });
              pingInviati++;
            } catch (error) {
              logger.error(`Errore nell'invio ping al client ${userId}: ${error.message}`);
            }
          }
        }
      }
      
      logger.debug(`WebSocket: Ping inviato a ${pingInviati}/${clientTotali} client connessi`);
    } catch (error) {
      logger.error(`Errore generale nell'invio ping ai client: ${error.message}`);
    }
  }

  /**
   * Invia un messaggio a un client
   * @param {WebSocket} ws - WebSocket client
   * @param {object} data - Dati da inviare
   * @returns {boolean} true se il messaggio è stato inviato con successo
   */
  sendMessage(ws, data) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Errore nell'invio del messaggio WebSocket: ${error.message}`);
      return false;
    }
  }

  /**
   * Invia una notifica a un attore specifico tramite WebSocket
   * @param {number} userId - ID dell'attore destinatario
   * @param {object} notifica - Oggetto con i dati della notifica
   * @returns {Promise<boolean>} True se la notifica è stata inviata con successo
   */
  async inviaNotifica(userId, notifica) {
    if (!this.isActive) {
      logger.warn(`WebSocket: Tentativo di inviare notifica ma il servizio non è attivo`);
      return false;
    }
    
    if (!userId || !notifica) {
      logger.error(`Parametri invalidi per inviaNotifica: userId=${userId}, notifica=${notifica ? 'presente' : 'assente'}`);
      return false;
    }
    
    try {
      // Verifica se l'utente ha connessioni attive
      if (!this.clients.has(userId) || this.clients.get(userId).length === 0) {
        logger.info(`WebSocket: Nessuna connessione attiva per l'attore ID: ${userId}, notifica non inviata`);
        return false;
      }
      
      logger.info(`WebSocket: Invio notifica all'attore ${userId}: ${JSON.stringify(notifica)}`);
      
      // Prepara il messaggio di notifica
      const message = {
        type: WebSocketEvent.NOTIFICATION,
        payload: notifica,
        timestamp: Date.now()
      };
      
      // Invia a tutte le connessioni dell'utente
      let inviateConSuccesso = 0;
      const connections = this.clients.get(userId);
      
      for (const client of connections) {
        if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
          if (this.sendMessage(client, message)) {
            inviateConSuccesso++;
          }
        }
      }
      
      logger.info(`WebSocket: Notifica inviata con successo a ${inviateConSuccesso}/${connections.length} connessioni dell'attore ${userId}`);
      return inviateConSuccesso > 0;
    } catch (error) {
      logger.error(`WebSocket: Errore nell'invio della notifica: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
      return false;
    }
  }

  /**
   * Invia un aggiornamento dello stato di un lotto a tutti gli utenti interessati
   * @param {object} lotto - Dati del lotto aggiornato
   * @param {number[]} userIds - Array di ID utenti a cui notificare (se vuoto, notifica a tutti)
   */
  notificaAggiornamentoLotto(lotto, userIds = []) {
    try {
      this.broadcastMessage({
        type: WebSocketEvent.LOTTO_UPDATE,
        payload: lotto,
        timestamp: Date.now()
      }, userIds);
      
      logger.info(`WebSocket: Aggiornamento lotto ${lotto.id} inviato a ${userIds.length > 0 ? userIds.length + ' utenti' : 'tutti gli utenti'}`);
    } catch (error) {
      logger.error(`Errore nella notifica aggiornamento lotto: ${error.message}`);
    }
  }

  /**
   * Invia un aggiornamento dello stato di una prenotazione agli utenti interessati
   * @param {object} prenotazione - Dati della prenotazione aggiornata
   * @param {number[]} userIds - Array di ID utenti a cui notificare
   */
  notificaAggiornamentoPrenotazione(prenotazione, userIds = []) {
    try {
      this.broadcastMessage({
        type: WebSocketEvent.PRENOTAZIONE_UPDATE,
        payload: prenotazione,
        timestamp: Date.now()
      }, userIds);
      
      logger.info(`WebSocket: Aggiornamento prenotazione ${prenotazione.id} inviato a ${userIds.length} utenti`);
    } catch (error) {
      logger.error(`Errore nella notifica aggiornamento prenotazione: ${error.message}`);
    }
  }

  /**
   * Invia un messaggio broadcast a tutti gli utenti selezionati o a tutti se userIds è vuoto
   * @param {object} message - Messaggio da inviare
   * @param {number[]} userIds - Array di ID utenti (opzionale)
   * @returns {number} Numero di client a cui è stato inviato il messaggio
   */
  broadcastMessage(message, userIds = []) {
    try {
      let clientRaggiungibili = 0;
      
      if (userIds.length > 0) {
        // Invia solo agli utenti specificati
        for (const userId of userIds) {
          if (this.clients.has(userId)) {
            const clients = this.clients.get(userId);
            for (const client of clients) {
              if (this.sendMessage(client, message)) {
                clientRaggiungibili++;
              }
            }
          }
        }
      } else {
        // Invia a tutti gli utenti connessi
        for (const clients of this.clients.values()) {
          for (const client of clients) {
            if (this.sendMessage(client, message)) {
              clientRaggiungibili++;
            }
          }
        }
      }
      
      return clientRaggiungibili;
    } catch (error) {
      logger.error(`Errore nell'invio del messaggio broadcast: ${error.message}`);
      return 0;
    }
  }

  /**
   * Ottiene il numero di connessioni attive
   * @returns {object} Statistiche delle connessioni
   */
  getStatistiche() {
    let numUtenti = this.clients.size;
    let numConnessioni = 0;
    
    for (const clients of this.clients.values()) {
      numConnessioni += clients.length;
    }
    
    return {
      utenti_connessi: numUtenti,
      connessioni_totali: numConnessioni,
      sessioni_riconnessione: this.pendingReconnections.size,
      servizio_attivo: this.isActive
    };
  }

  /**
   * Chiude tutte le connessioni e ferma il server
   */
  stop() {
    logger.info('Arresto del servizio WebSocket');
    
    // Ferma tutti gli intervalli
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Chiude tutte le connessioni
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        try {
          client.close(1001, 'Servizio in fase di riavvio');
        } catch (error) {
          // Ignora errori durante la chiusura
        }
      }
    }
    
    // Svuota la mappa dei client
    this.clients.clear();
    
    // Mantieni le sessioni di riconnessione
    
    // Chiude il server
    if (this.server) {
      try {
        this.server.close();
      } catch (error) {
        logger.error(`Errore nella chiusura del server WebSocket: ${error.message}`);
      }
      this.server = null;
    }
    
    this.isActive = false;
    logger.info('Servizio WebSocket arrestato con successo');
  }
}

// Esporta una singola istanza (singleton)
module.exports = new WebSocketService(); 

