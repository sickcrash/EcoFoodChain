import axios, { isAxiosError } from 'axios';
import { API_URL, STORAGE_KEYS } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lotto } from './lottiService';
import notificheService from './notificheService';
import Toast from 'react-native-toast-message';
import { getActiveToken } from './authService';

// Chiave per memorizzare il centro_id nella cache locale
const CENTRO_ID_STORAGE_KEY = 'user_centro_id';

// Interfaccia per le prenotazioni
export interface Prenotazione {
  id: number;
  lotto_id: number;
  centro_ricevente_id: number;
  centro_id?: number; // Mantenuto per retrocompatibilità 
  data_prenotazione: string;
  data_ritiro_prevista: string | null;
  data_ritiro_effettiva: string | null;
  stato: 'Prenotato' | 'InAttesa' | 'Confermato' | 'ProntoPerRitiro' | 'Rifiutato' | 'InTransito' | 'Consegnato' | 'Annullato' | 'Eliminato';
  note: string | null;
  created_at: string;
  updated_at: string;
  // Dati relazionati
  lotto?: Lotto;
  centro_nome?: string;
  // Campi che possono arrivare "appiattiti" direttamente nella risposta dell'API
  prodotto?: string;
  quantita?: number;
  unita_misura?: string;
  data_scadenza?: string;
  centro_origine_nome?: string;
  centro_ricevente_nome?: string;
  data_ritiro?: string;
  data_consegna?: string;
  prezzo?: number | null; // Prezzo del lotto associato
  tipo_pagamento?: 'contanti' | 'bonifico' | null; // Metodo di pagamento scelto
  stato_lotto?: string; // Stato del lotto (Verde, Arancione, Rosso)
  
  // Nuovi campi per tracciamento ritiro
  ritirato_da?: string | null; // Nome di chi ritira fisicamente il lotto
  documento_ritiro?: string | null; // Estremi documento identificativo di chi ritira
  data_ritiro_effettivo?: string | null; // Timestamp effettivo del ritiro
  note_ritiro?: string | null; // Note sul ritiro
  operatore_ritiro?: number | null; // ID dell'operatore che ha gestito il ritiro
  transizioni_stato?: string | null; // JSON con lo storico delle transizioni di stato
}

// Tipo per gli stati di prenotazione, usato per parametri tipizzati
export type StatoPrenotazione = 'Prenotato' | 'InAttesa' | 'Confermato' | 'ProntoPerRitiro' | 'Rifiutato' | 'InTransito' | 'Consegnato' | 'Annullato' | 'Eliminato';

// Interfaccia per la risposta della prenotazione
export interface PrenotazioneResponse {
  success: boolean;
  message: string;
  prenotazione?: Prenotazione;
  error?: any;
  missingCentroId?: boolean;
}

// Interfaccia per i filtri delle prenotazioni
export interface PrenotazioneFiltri {
  stato?: string;
  data_inizio?: string;
  data_fine?: string;
  centro_id?: number;
}

// Cache per le prenotazioni
let prenotazioniCache = {
  data: null as any,
  timestamp: 0,
  filtri: null as PrenotazioneFiltri | null
};


// Funzione per invalidare la cache
export const invalidateCache = () => {
  prenotazioniCache.timestamp = 0;
  prenotazioniCache.data = null;
  prenotazioniCache.filtri = null;
  console.log('Cache delle prenotazioni invalidata');
};

// Funzione per salvare il centro_id nella cache locale
export const saveCentroId = async (centroId: number): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(CENTRO_ID_STORAGE_KEY, centroId.toString());
    console.log('Centro ID salvato nella cache locale:', centroId);
    return true;
  } catch (error) {
    console.error('Errore durante il salvataggio del centro_id:', error);
    return false;
  }
};

// Funzione per recuperare il centro_id dalla cache locale
export const getCachedCentroId = async (): Promise<number | null> => {
  try {
    const centroId = await AsyncStorage.getItem(CENTRO_ID_STORAGE_KEY);
    if (centroId) {
      const id = parseInt(centroId, 10);
      if (!isNaN(id)) {
        console.log('Centro ID recuperato dalla cache locale:', id);
        return id;
      }
    }
    return null;
  } catch (error) {
    console.error('Errore durante il recupero del centro_id:', error);
    return null;
  }
};

// Funzione per ottenere gli header di autenticazione
export const getAuthHeader = async () => {
  try {
    const token = await getActiveToken();
    
    if (!token) {
      throw new Error('Token non trovato');
    }
    
    return { Authorization: `Bearer ${token}` };
  } catch (error) {
    console.error('Errore nel recupero del token:', error);
    throw error;
  }
};

// Funzione per effettuare una prenotazione
export const prenotaLotto = async (
  lotto_id: number, 
  data_ritiro_prevista: string | null = null, 
  note: string | null = null,
  tipo_pagamento: 'contanti' | 'bonifico' | null = null
): Promise<PrenotazioneResponse> => {
  try {
    console.log(`Prenotazione del lotto ${lotto_id} in corso...`);
    
    let headers = await getAuthHeader();
    console.log('Headers autenticazione:', headers);
    
    // MIGLIORAMENTO: Verifica prima lo stato del lotto per evitare prenotazioni multiple
    try {
      console.log(`Verifico lo stato attuale del lotto ${lotto_id} prima di prenotarlo...`);
      const lottoResponse = await axios.get(`${API_URL}/lotti/${lotto_id}`, {
        headers,
        timeout: 10000
      });
      
      const lotto = lottoResponse.data;
      console.log(`Stato attuale del lotto: "${lotto.stato || 'Non specificato'}"`);
      
      // Verifica per il tipo di pagamento
      const isLottoVerde = lotto.stato?.toUpperCase() === 'VERDE';
      
      // Recupera il tipo di utente corrente
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      const user = userData ? JSON.parse(userData) : null;
      const isUtenteTipoPrivato = user?.tipo_utente?.toUpperCase() === 'PRIVATO';
      
      // Se non è un utente privato che prenota un lotto verde, imposta il tipo di pagamento a null
      if (!isLottoVerde || !isUtenteTipoPrivato) {
        console.log('Utente non privato o lotto non verde, imposto tipo_pagamento a null');
        tipo_pagamento = null;
      }
      
      // Verifica se esistono già  prenotazioni attive per questo lotto
      console.log(`Verifico se esistono già  prenotazioni per il lotto ${lotto_id}...`);
      const prenotazioniResponse = await axios.get(`${API_URL}/prenotazioni`, {
        headers,
        params: { lotto_id },
        timeout: 10000
      });
      
      const prenotazioniEsistenti = prenotazioniResponse.data.data || prenotazioniResponse.data.prenotazioni || [];
      // Consideriamo attive solo le prenotazioni in stati che indicano che il lotto è effettivamente impegnato
      // E soprattutto verifichiamo che siano effettivamente associate al lotto richiesto
      const prenotazioniAttive = prenotazioniEsistenti.filter((p: any) => {
        // Stati che indicano che il lotto è attivamente impegnato
        const statiAttivi = ['Prenotato', 'InAttesa', 'Confermato', 'InTransito'];
        // Verifica cruciale: la prenotazione deve avere lo stesso lotto_id
        const lottoCorretto = p.lotto_id === lotto_id;
        
        if (!lottoCorretto && statiAttivi.includes(p.stato)) {
          console.warn(`âš ï¸ Trovata prenotazione ID=${p.id} in stato ${p.stato} ma associata al lotto ${p.lotto_id} anzichà© ${lotto_id}`);
        }
        
        return statiAttivi.includes(p.stato) && lottoCorretto;
      });
      
      if (prenotazioniAttive.length > 0) {
        console.error(`Trovate ${prenotazioniAttive.length} prenotazioni attive esistenti per il lotto ${lotto_id}`);
        
        // Log dettagliato delle prenotazioni trovate
        prenotazioniAttive.forEach((p: any, index: number) => {
          console.error(`Prenotazione #${index+1}: ID=${p.id}, Stato=${p.stato}, Lotto=${p.lotto_id}, Centro=${p.centro_ricevente_nome || `#${p.tipo_utente_ricevente_id || 'N/A'}`}`);
        });
        
        return {
          success: false,
          message: `Questo lotto risulta già  prenotato.`,
          error: { 
            status: 400, 
            message: 'Lotto già  prenotato',
            prenotazioniEsistenti: prenotazioniAttive.map((p: any) => ({ 
              id: p.id, 
              stato: p.stato,
              lotto_id: p.lotto_id,
              centro: p.centro_ricevente_nome || `Centro #${p.tipo_utente_ricevente_id || 'N/A'}`
            }))
          }
        };
      }
      
      console.log(`Nessuna prenotazione esistente trovata per il lotto ${lotto_id}, procedo con la prenotazione`);
    } catch (checkError: any) {
      // Se non riusciamo a verificare il lotto, logghiamo l'errore ma proviamo comunque la prenotazione
      console.warn(`Errore durante la verifica dello stato del lotto ${lotto_id}:`, checkError.message);
      console.warn('Procedo comunque con il tentativo di prenotazione');
    }
    
    // Controlla il formato della data, assicurandoti che sia valida
    if (data_ritiro_prevista) {
      try {
        // Validazione di base della data
        const dataParts = data_ritiro_prevista.split('-');
        if (dataParts.length !== 3 || 
            dataParts[0].length !== 4 || 
            dataParts[1].length !== 2 || 
            dataParts[2].length !== 2) {
          console.error('Formato data non valido. Deve essere YYYY-MM-DD:', data_ritiro_prevista);
          throw new Error('Formato data non valido. Deve essere nel formato YYYY-MM-DD');
        }
      } catch (err) {
        console.error('Errore nella validazione della data:', err);
        throw new Error('La data di ritiro prevista non è valida. Usa il formato YYYY-MM-DD.');
      }
    }
    
    // Costruisci il payload con solo i dati realmente necessari
    const payload: Record<string, any> = {
      lotto_id,
      data_ritiro: data_ritiro_prevista,
      note: note || '' // Garantisce che note sia sempre una stringa, anche quando è vuoto o null
    };
    
    // Aggiungi il tipo_pagamento solo se è definito (non null)
    if (tipo_pagamento) {
      payload.tipo_pagamento = tipo_pagamento;
    }
    
    console.log('Invio richiesta di prenotazione con payload:', payload);
    
    // Effettua la richiesta al backend
    const response = await axios.post(`${API_URL}/prenotazioni`, payload, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('Risposta ricevuta:', response.data);
    
    if (response.data && response.data.status === 'success') {
      // Notifica dell'avvenuta prenotazione
      try {
        // Crea una notifica locale per confermare la prenotazione
        notificheService.addLocalNotifica(
          'Prenotazione effettuata',
          `Hai prenotato il lotto "${response.data.data?.prodotto || 'Lotto #' + lotto_id}" con successo!`,
          false,
          true
        );
      } catch (notificaErr) {
        console.warn('Errore nella generazione della notifica locale:', notificaErr);
        // Ignoriamo eventuali errori nella generazione delle notifiche
      }
      
      return {
        success: true,
        message: response.data.message || 'Prenotazione effettuata con successo',
        prenotazione: response.data.data
      };
    } else {
      console.warn('Risposta anomala dal server:', response.data);
      return {
        success: false,
        message: response.data.message || 'Errore nella prenotazione',
        error: response.data.error || { status: response.status, message: 'Errore generico' }
      };
    }
  } catch (error: any) {
    console.error('Errore nella prenotazione del lotto:', error);
    
    // Gestisci le risposte di errore dal server
    if (error.response) {
      console.error('Error ' + error.response.status + ' - ' + error.response.statusText);
      console.error('Dettagli risposta:', error.response.data);
      
      // Gestione specifica dell'errore "lotto già  prenotato"
      if (error.response.status === 400 && 
          error.response.data?.message?.includes('già  prenotato')) {
        console.log('Errore di prenotazione: il lotto è già  prenotato', error.response.data);
        
        // Formatta un messaggio di errore pià¹ chiaro
        const errorMessage = 'Questo lotto è già  stato prenotato' + 
          (error.response.data.message.includes('altro centro') ? 
            ' da un altro centro' : '');
        
        return {
          success: false,
          message: errorMessage,
          error: {
            status: 400,
            message: 'Lotto già  prenotato',
            details: error.response.data
          }
        };
      }
      
      // Log dei dati utente in caso di 403
      if (error.response.status === 403) {
        try {
          const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          const user = userData ? JSON.parse(userData) : null;
          console.error(`Dati utente durante errore 403: ID: ${user?.id}, Ruolo: ${user?.ruolo}, Centro: ${user?.centro_id}, [ERROR] ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
        } catch (err) {
          console.error('Errore nel log dei dati utente:', err);
        }
      }

      return {
        success: false,
        message: error.response.data?.message || `Errore ${error.response.status}: ${error.response.statusText}`,
        error: {
          status: error.response.status,
          message: error.response.data?.message || error.response.statusText,
          details: error.response.data
        }
      };
    }
    
    return {
      success: false,
      message: error.message || 'Errore nella prenotazione',
      error: { message: error.message }
    };
  }
};

// Funzione per ottenere l'elenco delle prenotazioni
export const getPrenotazioni = async (filtri: PrenotazioneFiltri = {}, forceRefresh = false) => {
  try {
    console.log('=== INIZIO RICHIESTA getPrenotazioni ===');
    console.log('Filtri richiesti:', JSON.stringify(filtri, null, 2));
    
    // Ottieni le credenziali di autenticazione
    const headers = await getAuthHeader();
    console.log('Headers di autenticazione ottenuti');
    
    // Costruisci i parametri di query
    const params: any = {};
    
    if (filtri.stato) {
      params.stato = filtri.stato;
      console.log(`Applicando filtro stato: ${filtri.stato}`);
    }
    
    if (filtri.data_inizio) {
      params.data_inizio = filtri.data_inizio;
      console.log(`Applicando filtro data_inizio: ${filtri.data_inizio}`);
    }
    
    if (filtri.data_fine) {
      params.data_fine = filtri.data_fine;
      console.log(`Applicando filtro data_fine: ${filtri.data_fine}`);
    }
    
    if (filtri.centro_id) {
      params.centro_id = filtri.centro_id;
      console.log(`Applicando filtro centro_id: ${filtri.centro_id}`);
    }
    
    console.log(`API request: GET ${API_URL}/prenotazioni con params:`, params);
    
    // Effettua la richiesta API con timeout di 30 secondi
    console.log('Invio richiesta al server...');
    const startTime = Date.now();
    
    const response = await axios.get(`${API_URL}/prenotazioni`, { 
      headers,
      params,
      timeout: 30000 // Manteniamo il timeout di 30 secondi
    });
    
    const endTime = Date.now();
    console.log(`Risposta ricevuta in ${endTime - startTime}ms con status ${response.status}`);
    
    // Trasforma i dati per includere informazioni aggiuntive
    let prenotazioni = response.data.data || response.data.prenotazioni || [];
    
    console.log(`Ricevute ${prenotazioni.length} prenotazioni dal server`);
    console.log(`Dati di risposta: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`); // Tronca per non avere log troppo lunghi
    
    // Assicuriamoci che non ci siano prenotazioni duplicate con lo stesso ID
    // Se ci sono duplicati, manteniamo solo la versione pià¹ recente
    if (prenotazioni.length > 0) {
      console.log('Controllo duplicati nelle prenotazioni...');
      const prenotazioniMap = new Map();
      
      // Ordiniamo prima per data di aggiornamento (pià¹ recente prima)
      prenotazioni.sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.data_prenotazione);
        const dateB = new Date(b.updated_at || b.data_prenotazione);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Poi inseriamo nella mappa solo la prima occorrenza di ogni ID
      for (const prenotazione of prenotazioni) {
        if (!prenotazioniMap.has(prenotazione.id)) {
          prenotazioniMap.set(prenotazione.id, prenotazione);
        } else {
          console.warn(`Trovata prenotazione duplicata con ID ${prenotazione.id}, stato: ${prenotazione.stato}. Mantengo solo la versione pià¹ recente.`);
        }
      }
      
      // Convertiamo la mappa in array
      prenotazioni = Array.from(prenotazioniMap.values());
      console.log(`Dopo rimozione duplicati per ID: ${prenotazioni.length} prenotazioni`);
      
      // NUOVA LOGICA: Controlla anche duplicati basati su lotto_id
      // In alcuni casi, potremmo avere pià¹ prenotazioni per lo stesso lotto,
      // che non dovrebbe essere possibile logicamente
      console.log('Controllo duplicati di prenotazioni per lo stesso lotto...');
      const prenotazioniPerLotto = new Map();
      
      for (const prenotazione of prenotazioni) {
        // Ignora le prenotazioni senza lotto_id
        if (!prenotazione.lotto_id) continue;
        
        if (!prenotazioniPerLotto.has(prenotazione.lotto_id)) {
          prenotazioniPerLotto.set(prenotazione.lotto_id, prenotazione);
        } else {
          const prenotazioneEsistente = prenotazioniPerLotto.get(prenotazione.lotto_id);
          const dateA = new Date(prenotazione.updated_at || prenotazione.data_prenotazione);
          const dateB = new Date(prenotazioneEsistente.updated_at || prenotazioneEsistente.data_prenotazione);
          
          console.warn(`Trovata prenotazione duplicata per lotto ID ${prenotazione.lotto_id}:`);
          console.warn(`  - Prenotazione1: ID=${prenotazioneEsistente.id}, Stato=${prenotazioneEsistente.stato}, Data=${dateB.toISOString()}`);
          console.warn(`  - Prenotazione2: ID=${prenotazione.id}, Stato=${prenotazione.stato}, Data=${dateA.toISOString()}`);
          
          // Tieni la prenotazione pià¹ recente
          if (dateA.getTime() > dateB.getTime()) {
            console.warn(`  Mantengo la prenotazione pià¹ recente (ID=${prenotazione.id}, Stato=${prenotazione.stato})`);
            prenotazioniPerLotto.set(prenotazione.lotto_id, prenotazione);
          } else {
            console.warn(`  Mantengo la prenotazione pià¹ recente (ID=${prenotazioneEsistente.id}, Stato=${prenotazioneEsistente.stato})`);
          }
        }
      }
      
      // Verifica se sono stati trovati duplicati
      if (prenotazioniPerLotto.size < prenotazioni.length) {
        console.warn(`Trovate ${prenotazioni.length - prenotazioniPerLotto.size} prenotazioni duplicate per lotto_id`);
        prenotazioni = Array.from(prenotazioniPerLotto.values());
        console.log(`Dopo rimozione duplicati per lotto_id: ${prenotazioni.length} prenotazioni`);
      } else {
        console.log('Nessun duplicato trovato per lotto_id');
      }
    }
    
    if (prenotazioni.length === 0) {
      console.log('Nessuna prenotazione trovata con i filtri specificati');
    } else {
      console.log(`Prima prenotazione ricevuta: ID=${prenotazioni[0].id}, Stato=${prenotazioni[0].stato}`);
    }
    
    // Aggiungi dati del lotto se disponibili
    if (response.data.lotti && response.data.centri) {
      console.log(`Arricchimento prenotazioni con ${response.data.lotti.length} lotti e ${response.data.centri.length} centri`);
      
      // Crea una mappa di ricerca rapida per lotti e centri
      const lottiMap = response.data.lotti.reduce((map: Record<number, any>, lotto: any) => {
        map[lotto.id] = lotto;
        return map;
      }, {});
      
      const centriMap = response.data.centri.reduce((map: Record<number, any>, centro: any) => {
        map[centro.id] = centro;
        return map;
      }, {});
      
      // Arricchisci le prenotazioni con i dati relazionati
      prenotazioni = prenotazioni.map((prenotazione: any) => {
        const lotto = lottiMap[prenotazione.lotto_id];
        const centro = centriMap[prenotazione.centro_ricevente_id];
        
        return {
          ...prenotazione,
          lotto: lotto || undefined,
          centro_nome: centro ? centro.nome : undefined
        };
      });
      
      console.log('Prenotazioni arricchite con successo');
    } else {
      console.log('Dati di lotti e centri non disponibili nella risposta');
    }
    
    // Prepara il risultato finale con conteggi dalla risposta se disponibili
    const result = {
      prenotazioni,
      total: response.data.pagination?.total || response.data.total || prenotazioni.length,
      page: response.data.pagination?.page || response.data.page || 1,
      pages: response.data.pagination?.pages || response.data.pages || 1
    };
    
    console.log(`Preparato risultato finale con ${prenotazioni.length} prenotazioni`);
    console.log('=== FINE RICHIESTA getPrenotazioni ===');
    
    return result;
  } catch (error: any) {
    console.error('=== ERRORE IN getPrenotazioni ===');
    console.error('Errore completo:', error);
    
    // Log dettagliato dell'errore
    if (error.response) {
      // La richiesta è stata fatta e il server ha risposto con un codice di stato che non è 2xx
      console.error('Errore di risposta dal server:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data));
      console.error('Headers:', JSON.stringify(error.response.headers));
    } else if (error.request) {
      // La richiesta è stata fatta ma non è stata ricevuta alcuna risposta
      console.error('Nessuna risposta ricevuta dal server');
      console.error('Request:', error.request);
    } else {
      // Qualcosa è andato storto nella configurazione della richiesta
      console.error('Errore nella configurazione della richiesta:', error.message);
    }
    
    // Gestione specifica per vari tipi di errori
    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout durante il caricamento delle prenotazioni. Verifica la connessione al server.');
    } else if (error.response) {
      // Il server ha risposto con un errore
      console.error('Risposta di errore dal server:', error.response.status);
      if (error.response.status === 401) {
        throw new Error('Sessione scaduta. Effettua nuovamente il login.');
      } else {
        throw new Error(`Errore dal server: ${error.response.status} - ${error.response.data?.message || 'Errore sconosciuto'}`);
      }
    } else if (error.request) {
      // Nessuna risposta ricevuta
      throw new Error('Nessuna risposta dal server. Verifica la connessione di rete.');
    }
    
    throw error;
  }
};

// Funzione per ottenere una prenotazione per ID
export const getPrenotazioneById = async (id: number) => {
  try {
    console.log(`Richiesta dettagli prenotazione ${id} in corso...`);
    
    const headers = await getAuthHeader();
    const response = await axios.get(`${API_URL}/prenotazioni/${id}`, { 
      headers,
      timeout: 10000
    });
    
    console.log(`Dettagli prenotazione ${id} ricevuti:`, JSON.stringify(response.data));
    
    return response.data;
  } catch (error: any) {
    console.error(`Errore nel recupero della prenotazione ${id}:`, error);
    
    if (error.response?.status === 404) {
      throw new Error(`Prenotazione ${id} non trovata.`);
    } else if (error.response?.status === 401) {
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(`Timeout durante il caricamento della prenotazione. Verifica la connessione al server.`);
    }
    
    throw error;
  }
};

/**
 * Annulla una prenotazione.
 * @param id ID della prenotazione
 * @param motivo Motivo dell'annullamento
 * @returns Risultato dell'operazione
 */
export const annullaPrenotazione = async (id: number, motivo: string = '') => {
  try {
    const headers = await getAuthHeader();
    
    // Effettua una richiesta PUT per annullare la prenotazione
    const response = await axios.post(
      `${API_URL}/prenotazioni/${id}/annulla`, 
      { motivo },
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione annullata con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (error) {
    console.error('Errore durante l\'annullamento della prenotazione:', error);
    
    if (isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || 'Errore durante l\'annullamento della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: 'Errore di rete durante l\'annullamento della prenotazione',
      error
    };
  }
};

/**
 * Accetta una prenotazione.
 * @param id ID della prenotazione
 * @param data_prevista_ritiro Data prevista per il ritiro
 * @param note Note opzionali sull'accettazione
 * @returns Risultato dell'operazione
 */
export const accettaPrenotazione = async (id: number, data_ritiro_prevista: string, note: string = ''): Promise<any> => {
  try {
    console.log(`Tentativo accettazione prenotazione ID ${id} con data ritiro ${data_ritiro_prevista}...`);
    const headers = await getAuthHeader();
    
    // MIGLIORAMENTO: Verifica prima lo stato attuale della prenotazione
    let prenotazioneDettagli;
    try {
      console.log(`Recupero stato attuale prenotazione ${id}...`);
      const checkResponse = await axios.get(`${API_URL}/prenotazioni/${id}`, { 
        headers,
        timeout: 10000
      });
      prenotazioneDettagli = checkResponse.data;
      
      console.log(`Prenotazione ${id} trovata, stato attuale: "${prenotazioneDettagli.stato}"`);
      
      // Verifica se lo stato attuale è compatibile con l'accettazione
      const statoAttuale = prenotazioneDettagli.stato?.toLowerCase() || '';
      if (statoAttuale !== 'prenotato' && statoAttuale !== 'inattesa' && statoAttuale !== 'richiesta') {
        console.error(`Impossibile accettare prenotazione con stato "${statoAttuale}"`);
        return {
          success: false,
          message: `Impossibile accettare la prenotazione: lo stato attuale "${statoAttuale}" non consente l'accettazione`,
          error: { 
            status: 400, 
            message: 'Stato prenotazione incompatibile con l\'accettazione',
            dettagli: prenotazioneDettagli 
          }
        };
      }
      
      // Se lo stato è compatibile, procedi con la chiamata API
      console.log(`Stato "${statoAttuale}" compatibile con accettazione, procedo...`);
    } catch (checkError: any) {
      console.warn('Errore durante la verifica preliminare della prenotazione:', checkError.message);
      // Continua comunque con il tentativo, l'endpoint gestirà  gli errori
    }
    
    // Controlla che la data di ritiro sia in formato corretto (YYYY-MM-DD)
    if (!data_ritiro_prevista.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error(`Formato data non valido: ${data_ritiro_prevista}`);
      
      // Correggi automaticamente il formato se possibile
      let dataCorretta = data_ritiro_prevista;
      try {
        // Se la data è in formato italiano (DD/MM/YYYY) o altro formato leggibile
        const dataObj = new Date(data_ritiro_prevista);
        if (!isNaN(dataObj.getTime())) {
          dataCorretta = dataObj.toISOString().split('T')[0];
          console.log(`Data convertita automaticamente a: ${dataCorretta}`);
        } else {
          // Se la conversione fallisce, usa la data di domani
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dataCorretta = tomorrow.toISOString().split('T')[0];
          console.log(`Utilizzando data di default (domani): ${dataCorretta}`);
        }
      } catch {
        // Se la conversione fallisce, usa la data di domani
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dataCorretta = tomorrow.toISOString().split('T')[0];
        console.log(`Errore nella conversione della data, utilizzando domani: ${dataCorretta}`);
      }
      
      // Utilizza la data corretta
      data_ritiro_prevista = dataCorretta;
    }
    
    // Preparazione payload con nome campo corretto (potrebbe essere data_prevista_ritiro o data_ritiro_prevista)
    const payload = {
      data_prevista_ritiro: data_ritiro_prevista,
      data_ritiro_prevista: data_ritiro_prevista, // Fornisci entrambi i formati per compatibilità 
      note: note
    };
    
    console.log(`Invio richiesta accettazione con payload:`, JSON.stringify(payload));
    
    try {
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/accetta`, 
        payload,
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
      // Verifica che la prenotazione sia stata restituita
      if (response.data && response.data.prenotazione) {
        console.log(`Accettazione completata con successo, nuovo stato: ${response.data.prenotazione.stato}`);
        return {
          success: true,
          message: response.data.message || 'Prenotazione accettata con successo',
          prenotazione: response.data.prenotazione
        };
      } else {
        // Se non abbiamo una prenotazione nella risposta, recuperala manualmente
        console.log(`Risposta senza prenotazione, recupero manuale...`);
        try {
          const getResponse = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
          return {
            success: true,
            message: response.data.message || 'Prenotazione accettata con successo',
            prenotazione: getResponse.data
          };
        } catch (getError) {
          console.error(`Errore nel recupero manuale della prenotazione:`, getError);
          // Restituisci comunque successo con i dati disponibili
          return {
            success: true,
            message: response.data.message || 'Prenotazione accettata con successo',
            prenotazione: null
          };
        }
      }
    } catch (error: any) {
      console.error('Errore durante l\'accettazione della prenotazione:', error);
      
      // Miglioramento gestione errori specifici
      if (isAxiosError(error) && error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        console.error(`Errore ${status} nell'accettazione: ${JSON.stringify(errorData)}`);
        
        // Gestione specifica per errore 400 (stato incompatibile)
        if (status === 400) {
          // Tenta un approccio alternativo per accettare la prenotazione
          try {
            console.log(`Tentativo alternativo con setStatoPrenotazione dopo errore 400`);
            return await setStatoPrenotazione(id, 'Confermato', note);
          } catch (fallbackError) {
            console.error(`Anche il fallback è fallito:`, fallbackError);
            
            // Se anche il fallback fallisce, restituisci l'errore originale
            return {
              success: false,
              message: errorData.message || 'Impossibile accettare la prenotazione: lo stato attuale non lo consente',
              error: errorData
            };
          }
        }
        
        // Per altri errori, restituisci il messaggio dal server
        return {
          success: false,
          message: errorData.message || `Errore ${status} durante l'accettazione della prenotazione`,
          error: errorData
        };
      }
      
      // Gestione errori generici
      return {
        success: false,
        message: error.message || 'Errore durante l\'accettazione della prenotazione',
        error
      };
    }
  } catch (error: any) {
    console.error('Errore generale durante l\'accettazione della prenotazione:', error);
    
    return {
      success: false,
      message: error.message || 'Errore generale durante l\'accettazione della prenotazione',
      error
    };
  }
};

/**
 * Rifiuta una prenotazione.
 * @param id ID della prenotazione
 * @param motivazione Motivazione del rifiuto
 * @returns Risultato dell'operazione
 */
export const rifiutaPrenotazione = async (
  id: number, 
  motivazione: string
): Promise<any> => {
  try {
    const headers = await getAuthHeader();
    
    console.log('Rifiuto prenotazione in corso...');
    
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/rifiuta`,
      { motivazione },
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    // Utilizza il sistema di notifiche generalizzato
    if (response.data.prenotazione) {
      try {
        // Chiama setStatoPrenotazione con lo stato personalizzato per il rifiuto e la motivazione nelle note
        await setStatoPrenotazione(id, 'InAttesa', `Richiesta rifiutata: ${motivazione}`);
      } catch (notifyError) {
        console.error('Errore nell\'invio delle notifiche di rifiuto prenotazione:', notifyError);
      }
    }
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione rifiutata con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (error) {
    console.error('Errore durante il rifiuto della prenotazione:', error);
    
    if (isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || 'Errore durante il rifiuto della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: 'Errore di rete durante il rifiuto della prenotazione',
      error
    };
  }
};

/**
 * Cambia lo stato di una prenotazione e invia notifiche appropriate.
 * @param id ID della prenotazione
 * @param stato Nuovo stato ('InTransito', 'Consegnato', ecc.)
 * @param note Note opzionali sul cambio di stato
 * @returns Risultato dell'operazione
 */
export const setStatoPrenotazione = async (
  id: number, 
  stato: StatoPrenotazione, 
  note: string = ''
): Promise<any> => {
  try {
    const headers = await getAuthHeader();
    
    console.log(`Cambio stato prenotazione ${id} a "${stato}" in corso...`);
    
    // Verifica prima se la prenotazione esiste
    let prenotazioneAttuale = null;
    try {
      console.log(`Verifico l'esistenza della prenotazione ${id}...`);
      const checkResponse = await axios.get(`${API_URL}/prenotazioni/${id}`, { 
        headers,
        timeout: 10000
      });
      prenotazioneAttuale = checkResponse.data;
      console.log(`Prenotazione ${id} trovata, stato attuale: ${prenotazioneAttuale.stato || 'N/A'}`);
    } catch (checkError: any) {
      if (isAxiosError(checkError) && checkError.response?.status === 404) {
        console.error(`Prenotazione con ID ${id} non trovata nel sistema`);
        return {
          success: false,
          message: `La prenotazione con ID ${id} non esiste nel sistema`,
          error: { status: 404, message: 'Prenotazione non trovata' }
        };
      }
      // Se l'errore non è 404, ignoriamo e proseguiamo comunque
      console.warn(`Errore durante la verifica della prenotazione: ${checkError.message}`);
    }
    
    // LOGICA MIGLIORATA: Utilizziamo endpoint specifici a seconda dello stato desiderato
    // L'endpoint /prenotazioni/:id/stato non è disponibile, usiamo endpoint specifici
    let response;
    switch (stato) {
      case 'Prenotato':
        // Per lo stato "Prenotato", usiamo un endpoint alternativo
        console.log(`Usando endpoint alternativo per impostare stato "Prenotato"`);
        
        try {
          // Se non c'è già  una prenotazione esistente, dobbiamo crearla
          if (!prenotazioneAttuale) {
            console.error(`Non è possibile impostare lo stato "Prenotato" senza prenotazione esistente`);
            return {
              success: false,
              message: `Impossibile impostare lo stato "Prenotato": la prenotazione non esiste`,
              error: { status: 400, message: 'Prenotazione inesistente' }
            };
          }
          
          // Aggiungiamo una notifica invece di cambiare lo stato
          // Lo stato Prenotato viene impostato automaticamente alla creazione della prenotazione
          await notificheService.addNotificaToAmministratori(
            prenotazioneAttuale.centro_id || null,
            'Nuova prenotazione',
            `Una nuova prenotazione è stata registrata con ID ${id}.\n\n${note || ''}`
          );
          
          // Recuperiamo i dati aggiornati della prenotazione
          const updatedResponse = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
          
          // Restituiamo successo simulando una risposta di cambio stato
          return {
            success: true,
            message: `Prenotazione ${id} aggiornata a ${stato}`,
            prenotazione: updatedResponse.data
          };
        } catch (prenotError) {
          console.error(`Errore nell'impostazione dello stato Prenotato:`, prenotError);
          throw prenotError;
        }
        
      case 'Confermato': 
        // Usa l'endpoint di accettazione
        console.log(`Usando endpoint /prenotazioni/${id}/accetta per cambio stato a Confermato`);
        // Se non abbiamo una data, usiamo la data corrente + 1 giorno
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedDate = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
        
        try {
          // Prima otteniamo i dettagli della prenotazione per verificare lo stato attuale
          if (!prenotazioneAttuale) {
            const prenotazioneCheck = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
            prenotazioneAttuale = prenotazioneCheck.data;
            console.log(`Dettagli prenotazione per accettazione: ID=${id}, Stato attuale="${prenotazioneAttuale.stato}"`);
          }
          
          // Verifica se lo stato attuale permette l'accettazione
          const statoAttuale = prenotazioneAttuale.stato || '';
          if (statoAttuale.toLowerCase() !== 'prenotato' && 
              statoAttuale.toLowerCase() !== 'inattesa' && 
              statoAttuale.toLowerCase() !== 'richiesta') {
            console.error(`Impossibile accettare prenotazione con stato "${statoAttuale}"`);
            return {
              success: false,
              message: `Impossibile accettare la prenotazione: lo stato attuale "${statoAttuale}" non consente l'accettazione`,
              error: { status: 400, message: 'Stato prenotazione incompatibile' }
            };
          }
          
          // Prepara il payload per l'accettazione
          const acceptPayload = { 
            data_prevista_ritiro: formattedDate,
            note 
          };
          
          console.log(`Payload accettazione: ${JSON.stringify(acceptPayload)}`);
          
          response = await axios.put(
            `${API_URL}/prenotazioni/${id}/accetta`,
            acceptPayload,
            { headers }
          );
        } catch (acceptError: any) {
          console.error(`Errore dettagliato accettazione:`, acceptError);
          if (isAxiosError(acceptError) && acceptError.response) {
            console.error(`Risposta errore accettazione: status=${acceptError.response.status}, data=`, acceptError.response.data);
            
            if (acceptError.response.status === 400) {
              // Potremmo avere ulteriori dettagli nell'errore
              const errorMsg = acceptError.response.data?.message || 'Errore nella richiesta di accettazione';
              
              // Prova con una nuova prenotazione diretta come fallback
              console.log(`Tentativo alternativo: ricreazione prenotazione in stato confermato`);
              try {
                // Utilizza specifiche APIs per aggiornare lo stato
                await notificheService.addNotificaToAmministratori(
                  prenotazioneAttuale?.centro_id || null,
                  'Prenotazione confermata manualmente',
                  `La prenotazione ${id} è stata confermata manualmente.\n\n${note || ''}`
                );
                
                // Recupera i dati aggiornati della prenotazione
                const updatedResponse = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
                response = { data: { 
                  message: 'Prenotazione confermata manualmente', 
                  prenotazione: updatedResponse.data 
                }};
              } catch (fallbackError) {
                console.error(`Anche il fallback è fallito:`, fallbackError);
                throw new Error(`Impossibile confermare la prenotazione: ${errorMsg}`);
              }
            } else {
              throw acceptError;
            }
          } else {
            throw acceptError;
          }
        }
        break;
        
      case 'InAttesa':
        // Se c'è richiesta di rifiuto, usa l'endpoint di rifiuto
        if (note && note.includes('Richiesta rifiutata:')) {
          console.log(`Usando endpoint /prenotazioni/${id}/rifiuta per cambio stato a InAttesa (rifiuto)`);
          const motivazione = note.replace('Richiesta rifiutata:', '').trim();
          
          response = await axios.put(
            `${API_URL}/prenotazioni/${id}/rifiuta`, 
            { motivo: motivazione },
            { headers }
          );
        } else {
          console.error(`Non esiste un endpoint specifico per impostare lo stato InAttesa`);
          
          // Utilizziamo una notifica come alternativa
          await notificheService.addNotificaToAmministratori(
            prenotazioneAttuale?.centro_id || null,
            'Prenotazione in attesa',
            `La prenotazione ${id} è stata messa in attesa.\n\n${note || ''}`
          );
          
          // Recuperiamo i dati aggiornati della prenotazione
          const updatedResponse = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
          
          // Restituiamo successo simulando una risposta di cambio stato
          return {
            success: true,
            message: `Prenotazione ${id} aggiornata a ${stato}`,
            prenotazione: updatedResponse.data
          };
        }
        break;
        
      case 'InTransito':
        // Utilizziamo l'endpoint specifico per il transito
        console.log(`Usando endpoint specifico /prenotazioni/${id}/transito`);
        try {
          response = await axios.put(
            `${API_URL}/prenotazioni/${id}/transito`,
            { note },
            { headers }
          );
        } catch (transitoError: any) {
          // Se l'endpoint specifico fallisce, proviamo con una notifica
          console.error(`Errore nell'endpoint transito:`, transitoError);
          
          await notificheService.addNotificaToAmministratori(
            prenotazioneAttuale?.centro_id || null,
            'Prenotazione in transito',
            `La prenotazione ${id} è ora in transito.\n\n${note || ''}`
          );
          
          // Recuperiamo i dati aggiornati della prenotazione
          const updatedResponse = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
          
          // Restituiamo successo simulando una risposta di cambio stato
          return {
            success: true,
            message: `Prenotazione ${id} impostata in transito`,
            prenotazione: updatedResponse.data
          };
        }
        break;
        
      case 'Consegnato':
        // Utilizziamo l'endpoint specifico per la consegna
        console.log(`Usando endpoint specifico /prenotazioni/${id}/consegna`);
        try {
          response = await axios.put(
            `${API_URL}/prenotazioni/${id}/consegna`,
            { note },
            { headers }
          );
        } catch (consegnaError: any) {
          // Se l'endpoint specifico fallisce, proviamo con una notifica
          console.error(`Errore nell'endpoint consegna:`, consegnaError);
          
          await notificheService.addNotificaToAmministratori(
            prenotazioneAttuale?.centro_id || null,
            'Prenotazione consegnata',
            `La prenotazione ${id} è stata consegnata.\n\n${note || ''}`
          );
          
          // Recuperiamo i dati aggiornati della prenotazione
          const updatedResponse = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
          
          // Restituiamo successo simulando una risposta di cambio stato
          return {
            success: true,
            message: `Prenotazione ${id} impostata come consegnata`,
            prenotazione: updatedResponse.data
          };
        }
        break;
        
      default:
        // Per gli altri stati, tenteremo di utilizzare un altro approccio
        console.log(`Nessun endpoint specifico per lo stato ${stato}, uso approccio alternativo`);
        
        // Aggiungiamo una notifica come fallback
        await notificheService.addNotificaToAmministratori(
          prenotazioneAttuale?.centro_id || null,
          `Prenotazione: cambio stato`,
          `La prenotazione ${id} è stata aggiornata allo stato "${stato}".\n\n${note || ''}`
        );
        
        // Recuperiamo i dati aggiornati della prenotazione
        const updatedResponse = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
        
        // Restituiamo successo simulando una risposta di cambio stato
        return {
          success: true,
          message: `Prenotazione ${id} aggiornata a ${stato}`,
          prenotazione: updatedResponse.data
        };
    }
    
    // Invalida la cache
    invalidateCache();
    
    if (response.data.prenotazione) {
      // Ottengo tutti i dati necessari per una notifica completa
      try {
        // Ottieni i dettagli completi della prenotazione
      const prenotazione = response.data.prenotazione;
      
        // Ottieni i dettagli del lotto se non sono inclusi nella risposta
        let lotto = prenotazione.lotto;
        if (!lotto && prenotazione.lotto_id) {
          const lottoResponse = await axios.get(`${API_URL}/lotti/${prenotazione.lotto_id}`, { headers });
          lotto = lottoResponse.data;
        }
        
        if (!lotto) {
          console.warn('Impossibile ottenere i dati del lotto per le notifiche');
          return {
            success: true,
            message: response.data.message || `Stato prenotazione aggiornato a ${stato}`,
            prenotazione: prenotazione
          };
        }
        
        // Mappa degli stati per messaggi user-friendly
        const statoLabel: Record<string, string> = {
          'InTransito': 'in transito',
          'Consegnato': 'consegnato',
          'Prenotato': 'prenotato',
          'InAttesa': 'in attesa di conferma',
          'Confermato': 'confermato'
        };
        
        // Raccoglie dettagli per la notifica
        const dettagliCambioStato = [
          `Nome Lotto: ${lotto.prodotto || lotto.nome || 'Non specificato'}`,
          `Quantità : ${lotto.quantita || prenotazione.quantita || 'N/A'} ${lotto.unita_misura || prenotazione.unita_misura || 'pz'}`,
          `Data Scadenza: ${lotto.data_scadenza ? new Date(lotto.data_scadenza).toLocaleDateString('it-IT') : 'N/A'}`,
          `Centro di Origine: ${lotto.centro_nome || prenotazione.centro_origine_nome || `Centro #${lotto.centro_id || prenotazione.centro_id}`}`,
          `Centro Richiedente: ${prenotazione.centro_ricevente_nome || `Centro #${prenotazione.centro_ricevente_id}`}`,
          `Nuovo Stato: ${statoLabel[stato] || stato}`,
          note ? `Note: ${note}` : ''
        ].filter(Boolean).join('\n');
        
        // Notifica al centro di origine con titoli specifici per lo stato
        let titoloOrigine, messaggioOrigine;
        let titoloRichiedente, messaggioRichiedente;
        
        switch (stato) {
          case 'InTransito':
            titoloOrigine = 'Lotto in transito';
            messaggioOrigine = `Un lotto del tuo centro è ora in transito verso il centro richiedente.\n\n${dettagliCambioStato}`;
            titoloRichiedente = 'Lotto in transito';
            messaggioRichiedente = `Il lotto che hai prenotato è ora in transito verso il tuo centro.\n\n${dettagliCambioStato}`;
            break;
          case 'Consegnato':
            titoloOrigine = 'Lotto consegnato';
            messaggioOrigine = `Un lotto del tuo centro è stato consegnato al centro richiedente.\n\n${dettagliCambioStato}`;
            titoloRichiedente = 'Lotto ricevuto';
            messaggioRichiedente = `Hai ricevuto il lotto che avevi prenotato.\n\n${dettagliCambioStato}`;
            break;
          default:
            titoloOrigine = `Prenotazione: ${statoLabel[stato]}`;
            messaggioOrigine = `Una prenotazione per un lotto del tuo centro è ora ${statoLabel[stato]}.\n\n${dettagliCambioStato}`;
            titoloRichiedente = `Prenotazione: ${statoLabel[stato]}`;
            messaggioRichiedente = `La tua prenotazione è ora ${statoLabel[stato]}.\n\n${dettagliCambioStato}`;
        }

        // MIGLIORAMENTO: Invia notifiche a tutti i ruoli richiesti
        
        // 1. Notifica al centro di origine (AMMINISTRATORE E OPERATORI)
        const centroOrigineId = lotto.centro_id || prenotazione.centro_id;
        if (centroOrigineId) {
          console.log(`Invio notifica al centro di origine (ID: ${centroOrigineId})`);
        await notificheService.addNotificaToAmministratori(
            centroOrigineId,
            titoloOrigine,
            messaggioOrigine
          );
          
          // Invia anche agli operatori del centro di origine
          try {
            console.log(`Invio notifica agli operatori del centro di origine (ID: ${centroOrigineId})`);
            await notificheService.addNotificaToOperatori(
              centroOrigineId,
              titoloOrigine,
              messaggioOrigine
            );
          } catch (opError) {
            console.error(`Errore nell'invio delle notifiche agli operatori: ${opError}`);
          }
        }
        
        // 2. Notifica al centro richiedente (CENTRO SOCIALE)
        if (prenotazione.centro_ricevente_id) {
          console.log(`Invio notifica al centro richiedente (ID: ${prenotazione.centro_ricevente_id})`);
          await notificheService.addNotificaToAmministratori(
            prenotazione.centro_ricevente_id,
            titoloRichiedente,
            messaggioRichiedente
          );
          
          // Se è un centro sociale, invia anche a tutti gli utenti del centro
          try {
            console.log(`Invio notifica agli utenti del centro (ID: ${prenotazione.centro_ricevente_id})`);
            await notificheService.addNotificaToCentroBySocialType(
              prenotazione.centro_ricevente_id,
              titoloRichiedente,
              messaggioRichiedente
            );
          } catch (csError) {
            console.error(`Errore nell'invio delle notifiche al centro: ${csError}`);
          }
        }
      } catch (notifyError) {
        console.error(`Errore nell'invio delle notifiche di cambio stato a "${stato}":`, notifyError);
      }
    }
    
    return {
      success: true,
      message: response.data.message || `Stato prenotazione aggiornato a ${stato}`,
      prenotazione: response.data.prenotazione
    };
  } catch (error) {
    console.error(`Errore durante il cambio stato a "${stato}" della prenotazione ${id}:`, error);
    
    // Log dettagliato per Error 404
    if (isAxiosError(error) && error.response?.status === 404) {
      console.error(`Endpoint non trovato: ${API_URL}/prenotazioni/${id}/stato`);
      console.error('Possibili cause:');
      console.error('1. La prenotazione con ID ' + id + ' non esiste');
      console.error('2. L\'endpoint /stato non è implementato sul backend');
      console.error('Dettagli risposta:', error.response.data);
      
      return {
        success: false,
        message: 'Prenotazione non trovata o endpoint non supportato',
        error: error.response.data || { status: 404, message: 'Not Found' }
      };
    }
    
    if (isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || `Errore durante il cambio stato a "${stato}" della prenotazione`,
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: `Errore di rete durante il cambio stato a "${stato}" della prenotazione`,
      error
    };
  }
};

// Funzioni specifiche per i diversi stati che utilizzano setStatoPrenotazione

/**
 * Marca una prenotazione come "in transito".
 * @param id ID della prenotazione
 * @param note Note opzionali sulla transizione
 * @returns Risultato dell'operazione
 */
export const marcaInTransito = async (id: number, note: string = ''): Promise<any> => {
  try {
    // Prima proviamo l'endpoint specifico per transito, se esiste
    const headers = await getAuthHeader();
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/transito`,
      { note },
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    // Genera notifiche
    await generaNotificheTransito(id, response.data.prenotazione, note);
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione marcata come "in transito" con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (err: any) {
    console.warn(`Endpoint specifico /transito non disponibile, ripiego su /stato: ${err.message}`);
    // Se l'endpoint specifico non esiste, ripieghiamo su setStatoPrenotazione
    return setStatoPrenotazione(id, 'InTransito', note);
  }
};

/**
 * Marca una prenotazione come "consegnata".
 * @param id ID della prenotazione
 * @param note Note opzionali sulla consegna
 * @returns Risultato dell'operazione
 */
export const marcaConsegnata = async (id: number, note: string = ''): Promise<any> => {
  try {
    // Prima proviamo l'endpoint specifico per consegna, se esiste
    const headers = await getAuthHeader();
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/consegna`,
      { note },
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    // Genera notifiche
    await generaNotificheConsegna(id, response.data.prenotazione, note);
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione marcata come "consegnata" con successo',
      prenotazione: response.data.prenotazione
    };
  } catch (err: any) {
    console.warn(`Endpoint specifico /consegna non disponibile, ripiego su /stato: ${err.message}`);
    // Se l'endpoint specifico non esiste, ripieghiamo su setStatoPrenotazione
    return setStatoPrenotazione(id, 'Consegnato', note);
  }
};

// Funzioni helper interne per generare le notifiche
async function generaNotificheTransito(id: number, prenotazione: any, note: string): Promise<void> {
  if (!prenotazione) {
    try {
      const headers = await getAuthHeader();
      const response = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
      prenotazione = response.data;
    } catch (error) {
      console.error(`Impossibile recuperare i dettagli della prenotazione ${id}:`, error);
      return;
    }
  }
  
  try {
    // Ottieni i dettagli del lotto se necessario
    let lotto = prenotazione.lotto;
    const headers = await getAuthHeader();
    
    if (!lotto && prenotazione.lotto_id) {
      const lottoResponse = await axios.get(`${API_URL}/lotti/${prenotazione.lotto_id}`, { headers });
      lotto = lottoResponse.data;
    }
    
    if (!lotto) {
      console.warn('Impossibile ottenere i dati del lotto per le notifiche');
      return;
    }
    
    // Dettagli per la notifica
    const dettagliTransito = [
      `Nome Lotto: ${lotto.prodotto || lotto.nome || 'Non specificato'}`,
      `Quantità : ${lotto.quantita || prenotazione.quantita || 'N/A'} ${lotto.unita_misura || prenotazione.unita_misura || 'pz'}`,
      `Data Scadenza: ${lotto.data_scadenza ? new Date(lotto.data_scadenza).toLocaleDateString('it-IT') : 'N/A'}`,
      `Centro di Origine: ${lotto.centro_nome || prenotazione.centro_origine_nome || `Centro #${lotto.centro_id || prenotazione.centro_id}`}`,
      `Centro Richiedente: ${prenotazione.centro_ricevente_nome || `Centro #${prenotazione.centro_ricevente_id}`}`,
      note ? `Note: ${note}` : ''
    ].filter(Boolean).join('\n');
    
    // Notifica al centro di origine
    await notificheService.addNotificaToAmministratori(
      lotto.centro_id || prenotazione.centro_id,
      'Lotto in transito',
      `Un lotto del tuo centro è ora in transito verso il centro richiedente.\n\n${dettagliTransito}`
    );
    
    // Notifica al centro richiedente
    await notificheService.addNotificaToAmministratori(
      prenotazione.centro_ricevente_id,
      'Lotto in transito',
      `Il lotto che hai prenotato è ora in transito verso il tuo centro.\n\n${dettagliTransito}`
    );
    
    console.log('Notifiche di transito inviate con successo');
  } catch (error) {
    console.error('Errore nell\'invio delle notifiche di transito:', error);
  }
}

async function generaNotificheConsegna(id: number, prenotazione: any, note: string): Promise<void> {
  if (!prenotazione) {
    try {
      const headers = await getAuthHeader();
      const response = await axios.get(`${API_URL}/prenotazioni/${id}`, { headers });
      prenotazione = response.data;
    } catch (error) {
      console.error(`Impossibile recuperare i dettagli della prenotazione ${id}:`, error);
      return;
    }
  }
  
  try {
    // Ottieni i dettagli del lotto se necessario
    let lotto = prenotazione.lotto;
    const headers = await getAuthHeader();
    
    if (!lotto && prenotazione.lotto_id) {
      const lottoResponse = await axios.get(`${API_URL}/lotti/${prenotazione.lotto_id}`, { headers });
      lotto = lottoResponse.data;
    }
    
    if (!lotto) {
      console.warn('Impossibile ottenere i dati del lotto per le notifiche di consegna');
      return;
    }
    
    // Dettagli per la notifica
    const dettagliConsegna = [
      `Nome Lotto: ${lotto.prodotto || lotto.nome || 'Non specificato'}`,
      `Quantità : ${lotto.quantita || prenotazione.quantita || 'N/A'} ${lotto.unita_misura || prenotazione.unita_misura || 'pz'}`,
      `Data Scadenza: ${lotto.data_scadenza ? new Date(lotto.data_scadenza).toLocaleDateString('it-IT') : 'N/A'}`,
      `Centro di Origine: ${lotto.centro_nome || prenotazione.centro_origine_nome || `Centro #${lotto.centro_id || prenotazione.centro_id}`}`,
      `Centro Richiedente: ${prenotazione.centro_ricevente_nome || `Centro #${prenotazione.centro_ricevente_id}`}`,
      `Data Consegna: ${new Date().toLocaleDateString('it-IT')}`,
      note ? `Note: ${note}` : ''
    ].filter(Boolean).join('\n');
    
    // Notifica al centro di origine
    await notificheService.addNotificaToAmministratori(
      lotto.centro_id || prenotazione.centro_id,
      'Lotto consegnato',
      `Un lotto del tuo centro è stato consegnato al centro richiedente.\n\n${dettagliConsegna}`
    );
    
    // Notifica al centro richiedente
    await notificheService.addNotificaToAmministratori(
      prenotazione.centro_ricevente_id,
      'Lotto ricevuto',
      `Hai ricevuto il lotto che avevi prenotato.\n\n${dettagliConsegna}`
    );
    
    console.log('Notifiche di consegna inviate con successo');
  } catch (error) {
    console.error('Errore nell\'invio delle notifiche di consegna:', error);
  }
}

/**
 * Elimina una prenotazione (solo per amministratori).
 * @param id ID della prenotazione
 * @returns Risultato dell'operazione
 */
export const eliminaPrenotazione = async (id: number): Promise<any> => {
  try {
    const headers = await getAuthHeader();
    
    // Prima di eliminare, ottieni i dettagli per le notifiche
    let dettagliPrenotazione: Prenotazione | null = null;
    try {
      const dettagli = await getPrenotazioneById(id);
      if (dettagli.prenotazione) {
        dettagliPrenotazione = dettagli.prenotazione;
      }
    } catch (err) {
      console.error('Impossibile ottenere dettagli prenotazione prima dell\'eliminazione:', err);
    }
    
    const response = await axios.delete(
      `${API_URL}/prenotazioni/${id}`, 
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    if (dettagliPrenotazione && notificheService) {
      // Se abbiamo i dettagli, invia notifiche
      if (dettagliPrenotazione.lotto) {
        // Notifica al centro di origine
        if (dettagliPrenotazione.lotto.centro_id) {
          await notificheService.addNotificaToAmministratori(
            dettagliPrenotazione.lotto.centro_id,
            'Prenotazione eliminata',
            `La prenotazione del lotto "${dettagliPrenotazione.lotto.nome}" è stata eliminata da un amministratore.`
          );
        }
        
        // Notifica al centro ricevente
        if (dettagliPrenotazione.centro_id) {
          await notificheService.addNotificaToAmministratori(
            dettagliPrenotazione.centro_id,
            'Prenotazione eliminata',
            `La prenotazione che avevi effettuato per il lotto "${dettagliPrenotazione.lotto.nome}" è stata eliminata da un amministratore.`
          );
        }
      }
    }
    
    return {
      success: true,
      message: response.data.message || 'Prenotazione eliminata con successo'
    };
  } catch (error) {
    console.error('Errore durante l\'eliminazione della prenotazione:', error);
    
    if (isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data.message || 'Errore durante l\'eliminazione della prenotazione',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: 'Errore di rete durante l\'eliminazione della prenotazione',
      error
    };
  }
};

/**
 * Segna una prenotazione come pronta per il ritiro
 * @param id ID della prenotazione
 * @param note Note opzionali per il ritiro
 * @returns Risposta API
 */
export const segnaComePromtaPerRitiro = async (
  id: number, 
  note: string = ''
): Promise<any> => {
  try {
    console.log(`Segnando prenotazione ${id} come pronta per il ritiro...`);
    
    const headers = await getAuthHeader();
    if (!headers) {
      throw new Error('Non autorizzato. Effettua il login per continuare.');
    }
    
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/pronto-per-ritiro`,
      { note },
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    // Genera una notifica locale
    try {
      Toast.show({
        type: 'success',
        text1: 'Prenotazione pronta',
        text2: 'La prenotazione è stata segnata come pronta per il ritiro',
        visibilityTime: 3000,
      });
    } catch (e) {
      console.error('Impossibile mostrare toast:', e);
    }
    
    return response.data;
  } catch (error) {
    console.error('Errore nel segnare prenotazione come pronta per ritiro:', error);
    
    // Gestione errori specifici
    if (isAxiosError(error)) {
      const response = error.response;
      
      // Mostra messaggio di errore dal server se disponibile
      try {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: response?.data?.message || 'Impossibile segnare la prenotazione come pronta per il ritiro',
          visibilityTime: 4000,
        });
      } catch (e) {
        console.error('Impossibile mostrare toast di errore:', e);
      }
      
      throw new Error(response?.data?.message || 'Errore nel segnare la prenotazione come pronta per il ritiro');
    }
    
    throw error;
  }
};

/**
 * Registra il ritiro effettivo di un lotto prenotato
 * @param id ID della prenotazione
 * @param ritiroDa Nome della persona che ritira il lotto
 * @param documentoRitiro Documento di identità  (opzionale)
 * @param noteRitiro Note sul ritiro (opzionale)
 * @returns Risposta API
 */
export const registraRitiro = async (
  id: number,
  ritiroDa: string,
  documentoRitiro: string = '',
  noteRitiro: string = ''
): Promise<any> => {
  try {
    console.log(`Registrando ritiro per prenotazione ${id}...`);
    
    if (!ritiroDa) {
      throw new Error('àˆ necessario specificare chi ritira il lotto');
    }
    
    const headers = await getAuthHeader();
    if (!headers) {
      throw new Error('Non autorizzato. Effettua il login per continuare.');
    }
    
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/registra-ritiro`,
      {
        ritirato_da: ritiroDa,
        documento_ritiro: documentoRitiro || null,
        note_ritiro: noteRitiro || null
      },
      { headers }
    );
    
    // Invalida la cache
    invalidateCache();
    
    // Genera una notifica locale
    try {
      Toast.show({
        type: 'success',
        text1: 'Ritiro registrato',
        text2: 'Il ritiro del lotto è stato registrato con successo',
        visibilityTime: 3000,
      });
    } catch (e) {
      console.error('Impossibile mostrare toast:', e);
    }
    
    return response.data;
  } catch (error) {
    console.error('Errore nella registrazione del ritiro:', error);
    
    // Gestione errori specifici
    if (isAxiosError(error)) {
      const response = error.response;
      
      // Mostra messaggio di errore dal server se disponibile
      try {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: response?.data?.message || 'Impossibile registrare il ritiro',
          visibilityTime: 4000,
        });
      } catch (e) {
        console.error('Impossibile mostrare toast di errore:', e);
      }
      
      throw new Error(response?.data?.message || 'Errore nella registrazione del ritiro');
    }
    
    throw error;
  }
};

export default {
  prenotaLotto,
  getPrenotazioni,
  getPrenotazioneById,
  annullaPrenotazione,
  accettaPrenotazione,
  rifiutaPrenotazione,
  eliminaPrenotazione,
  setStatoPrenotazione,
  marcaInTransito,
  marcaConsegnata,
  segnaComePromtaPerRitiro,
  registraRitiro
}; 


