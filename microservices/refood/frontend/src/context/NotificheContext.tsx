import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Notifica, NotificaFiltri } from '../types/notification';
import notificheService from '../services/notificheService';
import { useAuth } from './AuthContext';
import { listenEvent, APP_EVENTS } from '../utils/events';
import logger from '../utils/logger';
import websocketService, { WebSocketEvent, WebSocketMessage } from '../services/websocketService';
import { Subscription } from 'rxjs';
import Toast from 'react-native-toast-message';

interface NotificheContextType {
  notifiche: Notifica[];
  nonLette: number;
  nonLetteFiltrate: number;
  loading: boolean;
  error: string | null;
  caricaNotifiche: (page?: number, limit?: number, filtri?: NotificaFiltri) => Promise<void>;
  segnaComeLetta: (notificaId: number) => Promise<boolean>;
  segnaTutteLette: () => Promise<boolean>;
  eliminaNotifica: (notificaId: number) => Promise<boolean>;
  refreshNotifiche: () => Promise<void>;
  aggiornaConteggio: () => Promise<void>;
  segnalaComeLetta: (id: number) => Promise<void>;
  syncLocalNotificheToServer: () => Promise<number>;
  wsConnected: boolean;
}

// Creazione del contesto con valori di default
const NotificheContext = createContext<NotificheContextType>({
  notifiche: [],
  nonLette: 0,
  nonLetteFiltrate: 0,
  loading: false,
  error: null,
  caricaNotifiche: async () => { },
  segnaComeLetta: async () => false,
  segnaTutteLette: async () => false,
  eliminaNotifica: async () => false,
  refreshNotifiche: async () => { },
  aggiornaConteggio: async () => { },
  segnalaComeLetta: async () => { },
  syncLocalNotificheToServer: async () => 0,
  wsConnected: false,
});

// Hook personalizzato per utilizzare il contesto
export const useNotifiche = () => useContext(NotificheContext);

interface NotificheProviderProps {
  children: ReactNode;
}

// Provider del contesto
export const NotificheProvider: React.FC<NotificheProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [nonLette, setNonLette] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [usingPolling, setUsingPolling] = useState<boolean>(false);

  // Conteggio non lette "filtrate" per il badge (stesse regole della lista)
  const nonLetteFiltrate = useMemo(() => {
    const userRole = user?.ruolo;
    const userFullName = `${user?.nome ?? ''} ${user?.cognome ?? ''}`.trim().toLowerCase();

    const passaFiltro = (n: Notifica) => {
      const msg = (n?.messaggio || '').toLowerCase();
      const isSegnalazione = msg.includes('segnalazione');
      if (!isSegnalazione) return true;               // tutte le altre notifiche passano
      if (userRole === 'Amministratore') return true; // admin sempre ok
      if (userRole === 'OperatoreCentro') {           // OperatoreCentro solo se citato nel testo
        return userFullName ? msg.includes(userFullName) : false;
      }
      return false;                                   // Operatore: non vede le segnalazioni
    };

    return (notifiche || []).filter(n => !n.letta && passaFiltro(n)).length;
  }, [notifiche, user?.ruolo, user?.nome, user?.cognome]);

  // Riferimento alla sottoscrizione WebSocket
  const wsSubscriptionRef = React.useRef<Subscription | null>(null);
  // Riferimento al timer di polling
  const pollingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Carica le notifiche dal server
  const caricaNotifiche = useCallback(async (page = 1, limit = 20, filtri?: NotificaFiltri) => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      setError(null);

      const response = await notificheService.getNotifiche(page, limit, filtri);

      if (page === 1) {
        // Se è la prima pagina, sostituisci l’array
        setNotifiche(response.data);
      } else {
        // Altrimenti, aggiungi alla fine dell'array esistente
        setNotifiche(prevNotifiche => [...prevNotifiche, ...response.data]);
      }
    } catch (err) {
      logger.error('Errore durante il caricamento delle notifiche:', err);
      setError('Impossibile caricare le notifiche');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Aggiorna il conteggio delle notifiche non lette
  const aggiornaConteggio = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const count = await notificheService.getNotificheNonLette();
      setNonLette(count);
    } catch (err) {
      logger.error('Errore durante l\'aggiornamento del conteggio notifiche:', err);
    }
  }, [isAuthenticated]);

  // Segna una notifica come letta
  const segnaComeLetta = useCallback(async (notificaId: number) => {
    try {
      const success = await notificheService.segnaComeLetta(notificaId);

      if (!success) {
        throw new Error('Il server non ha confermato la lettura della notifica');
      }

      // Aggiorna l’array locale di notifiche
      setNotifiche(prevNotifiche =>
        prevNotifiche.map(notifica =>
          notifica.id === notificaId ? { ...notifica, letta: true } : notifica
        )
      );

      // Aggiorna il conteggio delle notifiche non lette
      await aggiornaConteggio();

      return true;
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      const message = serverMessage || err?.message || 'Impossibile segnare la notifica come letta';
      logger.error('Errore durante la marcatura della notifica come letta:', err);
      Toast.show({
        type: 'error',
        text1: 'Operazione non riuscita',
        text2: message,
        visibilityTime: 3000,
      });
      setError(message);
      return false;
    }
  }, [aggiornaConteggio]);

  // Segna tutte le notifiche come lette
  const segnaTutteLette = useCallback(async () => {
    try {
      const success = await notificheService.segnaTutteComeLette();

      if (success) {
        // Aggiorna l’array locale di notifiche
        setNotifiche(prevNotifiche =>
          prevNotifiche.map(notifica => ({ ...notifica, letta: true }))
        );

        // Azzera il conteggio delle notifiche non lette
        setNonLette(0);
      }

      return success;
    } catch (err) {
      logger.error('Errore durante la marcatura di tutte le notifiche come lette:', err);
      return false;
    }
  }, []);

  // Elimina una notifica
  const eliminaNotifica = useCallback(async (notificaId: number) => {
    try {
      const success = await notificheService.eliminaNotifica(notificaId);

      if (!success) {
        throw new Error('Il server non ha confermato l\'eliminazione della notifica');
      }

      // Rimuovi la notifica dall'array locale
      setNotifiche(prevNotifiche =>
        prevNotifiche.filter(notifica => notifica.id !== notificaId)
      );

      // Aggiorna il conteggio
      await aggiornaConteggio();

      return true;
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      const message = serverMessage || err?.message || 'Impossibile eliminare la notifica';
      logger.error('Errore durante l\'eliminazione della notifica:', err);
      Toast.show({
        type: 'error',
        text1: 'Operazione non riuscita',
        text2: message,
        visibilityTime: 3000,
      });
      setError(message);
      return false;
    }
  }, [aggiornaConteggio]);

  // Ricarica completamente le notifiche
  const refreshNotifiche = useCallback(async () => {
    logger.log('Aggiornamento completo delle notifiche...');
    await caricaNotifiche(1, 20);
    await aggiornaConteggio();
  }, [caricaNotifiche, aggiornaConteggio]);

  // Avvia il polling delle notifiche
  const startPolling = useCallback(() => {
    // Interrompi eventuali polling precedenti
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    logger.log('Avvio polling notifiche come fallback');

    // Funzione di callback per il polling
    const onNewNotificheCount = (count: number) => {
      // Se il conteggio è cambiato, ricarica le notifiche
      if (count > nonLette) {
        logger.log(`Rilevate ${count - nonLette} nuove notifiche tramite polling`);
        refreshNotifiche();
      }
      setNonLette(count);
    };

    // Avvia il polling con intervallo più breve (15 secondi invece di 30)
    notificheService.avviaPollingNotifiche(onNewNotificheCount, 15000);

    // Salva il riferimento per pulizia
    pollingIntervalRef.current = setInterval(() => {
      aggiornaConteggio();
    }, 15000);

    // Flag che indica che stiamo usando il polling
    setUsingPolling(true);
  }, [nonLette, refreshNotifiche, aggiornaConteggio]);

  // Interrompe il polling
  const stopPolling = useCallback(() => {
    notificheService.interrompiPollingNotifiche();

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setUsingPolling(false);
  }, []);

  // Gestisce i messaggi WebSocket
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    logger.log('WebSocket messaggio ricevuto:', message.type);

    switch (message.type) {
      case WebSocketEvent.CONNECT:
        setWsConnected(true);
        setUsingPolling(false);
        logger.log('WebSocket connesso');
        break;

      case WebSocketEvent.DISCONNECT:
        setWsConnected(false);
        logger.log('WebSocket disconnesso');
        // Non impostiamo subito usingPolling qui, perché potrebbe essere una disconnessione temporanea
        break;

      case WebSocketEvent.ERROR:
        // Controlla se è un errore permanente che indica di usare il fallback
        if (message.payload?.permanent && message.payload?.usingFallback) {
          logger.log('Attivazione polling come fallback per errore WebSocket permanente');
          setWsConnected(false);
          setUsingPolling(true);

          // Avvia il polling immediatamente
          startPolling();
        }
        break;

      case WebSocketEvent.NOTIFICATION:
        // Ricevuta una nuova notifica
        const nuovaNotifica = message.payload.notifica as Notifica;
        if (nuovaNotifica && nuovaNotifica.id) {
          logger.log('Nuova notifica ricevuta via WebSocket:', nuovaNotifica.titolo);

          // Aggiungi la nuova notifica all'inizio dell'array
          setNotifiche(prev => [nuovaNotifica, ...prev]);

          // Incrementa il contatore delle notifiche non lette
          setNonLette(prev => prev + 1);

          // Mostra un toast per la nuova notifica
          Toast.show({
            type: nuovaNotifica.priorita === 'Alta' ? 'error' : 'info',
            text1: nuovaNotifica.titolo,
            text2: nuovaNotifica.messaggio,
            visibilityTime: 4000,
          });
        }
        break;

      case WebSocketEvent.LOTTO_UPDATE:
        // Aggiornamento stato lotto
        logger.log('Aggiornamento lotto ricevuto via WebSocket');

        // Potremmo aggiungere logica specifica qui se necessario
        // Ad esempio, refreshare automaticamente la schermata dei lotti

        break;

      case WebSocketEvent.PRENOTAZIONE_UPDATE:
        // Aggiornamento stato prenotazione
        logger.log('Aggiornamento prenotazione ricevuto via WebSocket');

        // Potremmo aggiungere logica specifica qui se necessario

        break;

      default:
        logger.log('Messaggio WebSocket non gestito:', message.type);
    }
  }, [startPolling]);

  // Inizializza la connessione WebSocket
  const initializeWebSocket = useCallback(() => {
    if (!isAuthenticated) return;

    logger.log('Inizializzazione connessione WebSocket...');

    // Chiudi eventuali connessioni esistenti
    if (wsSubscriptionRef.current) {
      wsSubscriptionRef.current.unsubscribe();
      wsSubscriptionRef.current = null;
    }

    // Sottoscrizione ai messaggi WebSocket
    wsSubscriptionRef.current = websocketService.getMessages().subscribe(
      handleWebSocketMessage,
      error => {
        logger.error('Errore nella sottoscrizione WebSocket:', error);
        // In caso di errore nella sottoscrizione, attiva il polling
        startPolling();
      }
    );

    // Avvia la connessione
    websocketService.connect().catch(err => {
      logger.error('Errore nella connessione WebSocket:', err);
      // In caso di errore di connessione, attiva il polling
      startPolling();
    });

    return () => {
      // Pulizia alla chiusura
      if (wsSubscriptionRef.current) {
        wsSubscriptionRef.current.unsubscribe();
        wsSubscriptionRef.current = null;
      }
      websocketService.disconnect();
      stopPolling();
    };
  }, [isAuthenticated, handleWebSocketMessage, startPolling, stopPolling]);

  // Effetto per impostare il polling delle notifiche e la connessione WebSocket
  useEffect(() => {
    if (!isAuthenticated) return;

    // Inizializza la connessione WebSocket
    const cleanup = initializeWebSocket();

    // Avvia comunque il polling come supporto se il WebSocket dovesse fallire
    startPolling();

    // Cleanup quando il componente si smonta o l’utente cambia
    return () => {
      if (cleanup) cleanup();
      stopPolling();
    };
  }, [isAuthenticated, initializeWebSocket, startPolling, stopPolling]);

  // Ascolta l’evento di refresh notifiche (quando l’app torna in primo piano)
  useEffect(() => {
    if (!isAuthenticated) return;

    logger.log('Configuro listener per refresh notifiche');
    const removeListener = listenEvent(APP_EVENTS.REFRESH_NOTIFICATIONS, () => {
      logger.log('Evento refresh notifiche ricevuto, aggiornamento in corso...');
      refreshNotifiche().catch(err => {
        logger.error('Errore durante il refresh delle notifiche:', err);
      });
    });

    return () => {
      removeListener();
    };
  }, [isAuthenticated, refreshNotifiche]);

  // Carica le notifiche all'avvio o quando cambia l’utente
  useEffect(() => {
    if (isAuthenticated) {
      refreshNotifiche();
    } else {
      // Reset dello stato quando non c'è un utente autenticato
      setNotifiche([]);
      setNonLette(0);
    }
  }, [isAuthenticated, refreshNotifiche]);

  // Valore del contesto
  const value = {
    notifiche,
    nonLette,
    nonLetteFiltrate,
    loading,
    error,
    caricaNotifiche,
    segnaComeLetta,
    segnaTutteLette,
    eliminaNotifica,
    refreshNotifiche,
    aggiornaConteggio,
    segnalaComeLetta: async (id: number) => {
      try {
        await notificheService.segnaComeLetta(id);

        // Aggiorna lo stato locale delle notifiche
        setNotifiche(prev =>
          prev.map(notifica =>
            notifica.id === id
              ? { ...notifica, letta: true, dataLettura: new Date().toISOString() }
              : notifica
          )
        );

        // Aggiorna il conteggio delle non lette
        aggiornaConteggio();
      } catch (error) {
        logger.error(`Errore nel segnare come letta la notifica ${id}:`, error);
        setError('Impossibile segnare la notifica come letta');
      }
    },
    syncLocalNotificheToServer: async () => {
      try {
        // Verifica se il caricamento è già in corso
        if (loading) {
          logger.warn('Sincronizzazione ignorata: caricamento già in corso');
          return 0;
        }

        setLoading(true);
        const count = await notificheService.syncAllLocalNotificationsToServer();

        // Ricarica le notifiche dopo la sincronizzazione
        if (count > 0) {
          await refreshNotifiche();
        }

        return count;
      } catch (error) {
        logger.error('Errore durante la sincronizzazione delle notifiche:', error);
        setError('Impossibile sincronizzare le notifiche con il server');
        return 0;
      } finally {
        setLoading(false);
      }
    },
    wsConnected: wsConnected || usingPolling, // Considera la connessione "attiva" anche se stiamo usando il polling
  };

  return (
    <NotificheContext.Provider value={value}>
      {children}
    </NotificheContext.Provider>
  );
};

export default NotificheProvider; 
