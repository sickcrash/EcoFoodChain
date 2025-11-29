import axios, { isAxiosError } from 'axios';
import { calcolaStatoLotto } from '../utils/statoLotto';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, STORAGE_KEYS, API_TIMEOUT, DATA_FRESHNESS_THRESHOLD } from '../config/constants';
import notificheService from './notificheService';
import { pushNotificationService } from './pushNotificationService';
import { getActiveToken } from './authService';

// Configurazione globale di axios
axios.defaults.timeout = API_TIMEOUT; // Usa il timeout configurato nelle costanti

// Definizione delle interfacce
export interface Lotto {
  id: number;
  nome: string; // corrisponde a prodotto nel backend
  descrizione?: string | null;
  quantita: number;
  unita_misura: string;
  data_inserimento?: string;
  data_scadenza: string;
  centro_id: number; // corrisponde a centro_origine_id nel backend
  centro_nome?: string;
  stato: 'Verde' | 'Arancione' | 'Rosso'; // NB: ora puà² essere ricalcolato dinamicamente
  creato_il?: string;
  categorie?: string[];
  origine?: string;
  stato_prenotazione?: string; // Indica se il lotto è già  prenotato
  prezzo?: number | null; // Prezzo del lotto (solo per lotti verdi)
  indirizzo?: string | null;
  tipo_pagamento?: 'contanti' | 'bonifico' | null; // Metodo di pagamento
}

export interface LottoFiltri {
  stato?: string;
  centro_id?: number;
  categoria?: string;
  scadenza_min?: string;
  scadenza_max?: string;
  cerca?: string;
}

// Definiamo meglio l'interfaccia di ritorno per includere pagination
export interface LottiResponse {
  lotti: Lotto[];
  pagination?: any;
}

// Cache in memoria
let lottiCache = {
  data: null as any,
  timestamp: 0,
  filtri: null as LottoFiltri | null
};

// Funzione per ottenere gli header di autenticazione
export const getAuthHeader = async () => {
  try {
    const token = await getActiveToken();

    if (!token) {
      console.warn('Token di autenticazione non trovato!');
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    }

    return { Authorization: `Bearer ${token}` };
  } catch (error) {
    console.error('Errore nel recupero del token:', error);
    throw error;
  }
};

// Funzione per normalizzare i lotti (adatta i nomi dei campi)
export const normalizeLotto = (lotto: any): Lotto => {
  return {
    id: lotto.id,
    nome: lotto.prodotto || lotto.nome || 'Senza nome',
    descrizione: lotto.descrizione || null,
    quantita: parseFloat(lotto.quantita) || 0,
    unita_misura: lotto.unita_misura || 'pz',
    data_inserimento: lotto.creato_il || lotto.data_inserimento,
    data_scadenza: lotto.data_scadenza,
    centro_id: lotto.tipo_utente_origine_id || lotto.centro_origine_id || lotto.centro_id || 0,
    centro_nome: lotto.centro_nome || '',
    // Preferisci lo stato calcolato dal backend, fallback a calcolo locale
    stato: lotto.stato || calcolaStatoLotto(lotto.data_scadenza),
    creato_il: lotto.creato_il,
    categorie: Array.isArray(lotto.categorie)
      ? lotto.categorie
      : typeof lotto.categorie === 'string'
        ? lotto.categorie
            .split(',')
            .map((value: string) => value.trim())
            .filter(Boolean)
        : [],
    stato_prenotazione: lotto.stato_prenotazione || null,
    prezzo: lotto.prezzo !== undefined ? parseFloat(lotto.prezzo) : null,
    indirizzo: lotto.indirizzo || null,
    tipo_pagamento: lotto.tipo_pagamento || null,
  };
};

// Funzione helper per ottenere lo stato di un lotto (per uso diretto)
export function getStatoLotto(lotto: { data_scadenza: string }): 'Verde' | 'Arancione' | 'Rosso' {
  return calcolaStatoLotto(lotto.data_scadenza);
}

// Funzione per invalidare la cache
export const invalidateCache = () => {
  lottiCache.timestamp = 0;
  console.log('Cache dei lotti invalidata');
};

// Funzione per ottenere la lista dei lotti con filtri opzionali
export const getLotti = async (filtri: LottoFiltri = {}, forceRefresh = false, mostraTutti = false): Promise<LottiResponse> => {
  try {
    // Usa la cache in memoria per migliorare le prestazioni
    // Verifica se possiamo usare la cache
    const now = Date.now();
    const cacheAge = now - lottiCache.timestamp;
    const filtriEqual = JSON.stringify(filtri) === JSON.stringify(lottiCache.filtri);

    if (!forceRefresh && lottiCache.data && filtriEqual && cacheAge < DATA_FRESHNESS_THRESHOLD) {
      console.log('Usando lotti dalla cache locale (età  cache:', Math.round(cacheAge / 1000), 'secondi)');
      return lottiCache.data;
    }

    // Costruisce i parametri di query dai filtri
    const params = new URLSearchParams();
    if (filtri) {
      if (filtri.stato) params.append('stato', filtri.stato.toString().toUpperCase());
      if (filtri.cerca) params.append('cerca', filtri.cerca);
      if (filtri.scadenza_min) params.append('data_min', filtri.scadenza_min);
      if (filtri.scadenza_max) params.append('data_max', filtri.scadenza_max);
      if (filtri.categoria) params.append('categoria', filtri.categoria);
      if (filtri.centro_id) params.append('centro_id', filtri.centro_id.toString());
    }
    if (mostraTutti) params.append('mostraTutti', 'true');

    const queryParams = params.toString() ? `?${params.toString()}` : '';

    const headers = await getAuthHeader();

    try {
      console.log(`Richiesta GET ${API_URL}/lotti${queryParams}`);

      const response = await axios.get(`${API_URL}/lotti${queryParams}`, {
        headers,
        timeout: 20000 // Aumentato il timeout a 20 secondi
      });

      // Estrazione e normalizzazione dei dati
      const lottiData = response.data.lotti || response.data.data || [];
      const normalizedLotti = Array.isArray(lottiData)
        ? lottiData.map(normalizeLotto)
        : [];

      // Formattazione della risposta (per tutti i ruoli)
      const result: LottiResponse = {
        lotti: normalizedLotti,
        pagination: response.data.pagination || null
      };

      console.log(`Ricevuti e normalizzati ${normalizedLotti.length} lotti`);

      // Aggiorna la cache
      lottiCache = {
        data: result,
        timestamp: now,
        filtri
      };

      return result;
    } catch (error) {
      console.error('Errore nel recupero dei lotti:', error);

      // Gestione specifica per errori 500 dal server
      if (isAxiosError(error) && error.response?.status === 500) {
        console.warn('Errore interno del server (500), tentativo di utilizzo dati in cache');

        // Se ci sono dati in cache, usali anche se scaduti
        if (lottiCache.data) {
          console.log('Utilizzando dati lotti dalla cache dopo errore server');
          return lottiCache.data;
        }

        // Se non ci sono dati in cache, restituisci un array vuoto ma non bloccare l'app
        return { lotti: [] };
      }

      // Rilancia altri tipi di errori
      throw error;
    }

  } catch (err) {
    // Tipo pià¹ sicuro per l'errore
    const error = err as any;
    console.error('Errore nel recupero dei lotti:', error);

    // Gestione specifica errori
    if (error && (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED')) {
      console.warn('Timeout durante il caricamento dei lotti. Verifica la connessione.');
      // In caso di timeout, prova a usare la cache
      if (lottiCache.data) {
        return lottiCache.data;
      }
    } else if (isAxiosError(error) && error.response) {
      // Il server ha risposto con un errore
      if (error.response.status === 401) {
        throw new Error('Sessione scaduta. Effettua nuovamente il login.');
      }
    }

    // Se tutto fallisce, restituisci un array vuoto invece di bloccare l'app
    return { lotti: [] };
  }
};

// Funzione per ottenere un singolo lotto per ID
export const getLottoById = async (id: number) => {
  try {
    console.log(`Richiesta dettagli lotto ${id} in corso...`);

    const headers = await getAuthHeader();
    const response = await axios.get(`${API_URL}/lotti/${id}`, {
      headers,
      timeout: 10000
    });

    console.log(`Dettagli lotto ${id} ricevuti (raw):`, JSON.stringify(response.data));
    console.log(`Campo stato_prenotazione presente:`, response.data.stato_prenotazione ? 'SI' : 'NO');

    if (response.data.stato_prenotazione) {
      console.log(`VALORE stato_prenotazione:`, response.data.stato_prenotazione);
    }

    // Normalizza il lotto ricevuto
    const lottoNormalizzato = normalizeLotto(response.data);

    // Verifica stato_prenotazione dopo normalizzazione
    console.log(`Lotto normalizzato - stato_prenotazione:`, lottoNormalizzato.stato_prenotazione ? 'SI' : 'NO');

    return lottoNormalizzato;
  } catch (error: any) {
    console.error(`Errore nel recupero del lotto ${id}:`, error);

    if (error.response?.status === 404) {
      throw new Error(`Lotto ${id} non trovato.`);
    } else if (error.response?.status === 401) {
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error(`Timeout durante il caricamento del lotto. Verifica la connessione al server.`);
    }

    throw error;
  }
};

// Funzione per creare un nuovo lotto
export const createLotto = async (lotto: Omit<Lotto, 'id' | 'stato'>) => {
  try {
    console.log('Creazione nuovo lotto:', JSON.stringify(lotto));

    // Ottieni gli header di autenticazione
    const headers = await getAuthHeader();

    // Determina lo stato del lotto in base alla data di scadenza
    // Questa è solo una simulazione locale per capire se il lotto sarà  verde
    // Il backend farà  la sua valutazione in base ai suoi criteri
    let isVerde = true;
    try {
      const oggi = new Date();
      const dataScadenza = new Date(lotto.data_scadenza);

      // Se la data di scadenza è nel passato o molto vicina (meno di 5 giorni)
      // il lotto probabilmente non sarà  verde
      const diffTime = dataScadenza.getTime() - oggi.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      isVerde = diffDays > 5;
      console.log(`Stima stato lotto: ${isVerde ? 'Verde' : 'Non Verde'} (${diffDays} giorni alla scadenza)`);
    } catch (err) {
      console.error('Errore nel calcolo predittivo dello stato:', err);
      // In caso di errore, assumiamo che il lotto sia verde come valore predefinito
    }

    // Adatta i nomi dei campi a quelli attesi dal backend
    const payload = {
      prodotto: lotto.nome,
      quantita: lotto.quantita,
      unita_misura: lotto.unita_misura,
      data_scadenza: lotto.data_scadenza,
      centro_origine_id: lotto.centro_id,
      giorni_permanenza: 7, // Valore predefinito
      prezzo: isVerde ? lotto.prezzo : 0, // Imposta il prezzo a 0 se il lotto non è verde
      descrizione: (lotto.descrizione?.trim() || null),
      indirizzo: (lotto.indirizzo?.trim() || null)
    };

    console.log('Payload per creazione lotto:', JSON.stringify(payload));

    // Effettua la richiesta
    const response = await axios.post(`${API_URL}/lotti`, payload, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // Aumentato il timeout a 30 secondi
    });

    console.log('Risposta creazione lotto:', JSON.stringify(response.data));

    // Invalida la cache
    invalidateCache();

    // Normalizza e restituisci il lotto creato
    return {
      success: true,
      message: response.data.message || 'Lotto creato con successo',
      lotto: normalizeLotto(response.data.lotto || response.data)
    };
  } catch (error: any) {
    console.error('Errore nella creazione del lotto:', error);

    // Se l'errore proviene dalla risposta, mostra il messaggio
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nella creazione del lotto',
        error: error.response.data
      };
    }

    // Altrimenti mostra un messaggio generico
    return {
      success: false,
      message: error.message || 'Errore nella creazione del lotto',
      error
    };
  }
};

// Funzione per aggiornare un lotto esistente
export const updateLotto = async (lottoId: number, lottoData: Partial<Lotto>, notifyAdmin: boolean = true): Promise<any> => {
  try {
    console.log(`Aggiornamento lotto ID ${lottoId}:`, JSON.stringify(lottoData));

    // Verifica se l'utente ha i permessi per aggiornare i lotti
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    const user = userData ? JSON.parse(userData) : null;

    if (!user || (user.ruolo !== 'Operatore' && user.ruolo !== 'Amministratore')) {
      throw new Error('Non hai i permessi per modificare questo lotto');
    }

    // Ottieni gli header di autenticazione
    const headers = await getAuthHeader();

    // Adatta i nomi dei campi a quelli attesi dal backend
    const payload: Record<string, any> = {};

    if (lottoData.nome !== undefined) payload.prodotto = lottoData.nome;
    if (lottoData.quantita !== undefined) payload.quantita = lottoData.quantita;
    if (lottoData.unita_misura !== undefined) payload.unita_misura = lottoData.unita_misura;
    if (lottoData.data_scadenza !== undefined) {
      // Assicuriamoci che la data sia nel formato corretto (YYYY-MM-DD)
      let dataScadenza = lottoData.data_scadenza;

      // Se è un oggetto Date, formattalo come stringa
      if (typeof dataScadenza === 'object' && dataScadenza !== null && 'toISOString' in dataScadenza) {
        dataScadenza = format(dataScadenza as Date, 'yyyy-MM-dd');
      } else if (typeof dataScadenza === 'string') {
        // Se è già  una stringa, assicuriamoci che sia nel formato corretto YYYY-MM-DD
        // Prova a convertirla in Date e poi di nuovo in stringa per normalizzarla
        try {
          const date = new Date(dataScadenza as string);
          if (!isNaN(date.getTime())) {
            dataScadenza = format(date, 'yyyy-MM-dd');
          }
        } catch (e) {
          console.error('Errore nella conversione della data:', e);
          // Se fallisce, mantieni il valore originale
        }
      }

      payload.data_scadenza = dataScadenza;
      console.log(`Data scadenza normalizzata: ${payload.data_scadenza}`);
    }

    if (lottoData.descrizione !== undefined) {
      payload.descrizione = (lottoData.descrizione?.trim() || null);
    }
    if (lottoData.indirizzo !== undefined) {
      payload.indirizzo = (lottoData.indirizzo?.trim() || null);
    }

    // Se lottoData.stato è definito e non è "Verde", imposta il prezzo a 0
    if (lottoData.stato !== undefined) {
      payload.stato = lottoData.stato;
      if (lottoData.stato !== 'Verde') {
        console.log(`Stato lotto non è Verde, imposto automaticamente prezzo a 0`);
        payload.prezzo = 0;
      } else if (lottoData.prezzo !== undefined) {
        // Se il lotto è Verde e il prezzo è definito, usa il prezzo fornito
        payload.prezzo = lottoData.prezzo;
      }
    } else if (lottoData.prezzo !== undefined) {
      // Se stiamo aggiornando solo il prezzo senza cambiare lo stato
      // Dobbiamo verificare prima lo stato attuale
      try {
        const lottoAttuale = await getLottoById(lottoId);
        if (lottoAttuale.stato !== 'Verde') {
          console.log(`Lotto ${lottoId} non è Verde (è ${lottoAttuale.stato}), imposto prezzo a 0`);
          payload.prezzo = 0;
        } else {
          payload.prezzo = lottoData.prezzo;
        }
      } catch (error) {
        console.error(`Errore nel recupero dello stato del lotto ${lottoId}:`, error);
        // In caso di errore, procedi comunque con l'aggiornamento
        payload.prezzo = lottoData.prezzo;
      }
    }

    console.log('Payload per aggiornamento lotto:', JSON.stringify(payload));

    // Effettua la richiesta
    const response = await axios.put(`${API_URL}/lotti/${lottoId}`, payload, {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    console.log('Risposta aggiornamento lotto:', JSON.stringify(response.data));

    // Invalida la cache
    invalidateCache();

    // Se l'aggiornamento ha avuto successo e dobbiamo notificare gli amministratori
    if (notifyAdmin && response.data) {
      try {
        // Ottieni info sull'utente attuale
        const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
        const user = userData ? JSON.parse(userData) : null;
        const userNomeCompleto = user ? `${user.nome} ${user.cognome}` : 'Operatore';

        // Ottieni il centro_id dal lotto aggiornato o da quello inviato
        const centroId =
          response.data?.lotto?.tipo_utente_origine_id ??
          response.data?.lotto?.centro_origine_id ??
          response.data?.tipo_utente_origine_id ??
          response.data?.centro_origine_id ??
          lottoData.centro_id ??
          null;

        if (centroId) {
          // Prepara un messaggio descrittivo delle modifiche
          let descrizioneModifiche = 'Modifiche: ';
          if (lottoData.nome) descrizioneModifiche += 'nome, ';
          if (lottoData.quantita !== undefined) descrizioneModifiche += 'quantità , ';
          if (lottoData.unita_misura) descrizioneModifiche += 'unità  di misura, ';
          if (lottoData.data_scadenza) descrizioneModifiche += 'data scadenza, ';
          if (lottoData.stato) descrizioneModifiche += 'stato, ';
          if (lottoData.prezzo !== undefined) descrizioneModifiche += 'prezzo, ';
          // Rimuovi l'ultima virgola e spazio
          descrizioneModifiche = descrizioneModifiche.replace(/, $/, '');

          // Invia la notifica agli amministratori e crea notifica locale per l'operatore
          await notificheService.addNotificaToAmministratori(
            centroId,
            'Lotto modificato',
            `Hai modificato il lotto "${response.data.prodotto || lottoData.nome}". ${descrizioneModifiche}`,
            userNomeCompleto
          );

          // Invia anche una notifica push locale
          await pushNotificationService.sendLocalNotification(
            'Lotto modificato',
            `Hai modificato il lotto "${response.data.prodotto || lottoData.nome}". ${descrizioneModifiche}`,
            {
              type: 'notifica',
              subtype: 'lotto_modificato',
              lottoId: lottoId
            }
          );

          console.log('Notifica inviata agli amministratori del centro per modifica lotto');
        }
      } catch (notifyError) {
        console.error('Errore nell\'invio della notifica agli amministratori:', notifyError);
      }
    }

    // Normalizza e restituisci il lotto aggiornato
    return {
      success: true,
      message: 'Lotto aggiornato con successo',
      lotto: normalizeLotto(response.data.lotto || response.data)
    };
  } catch (error: any) {
    console.error('Errore nell\'aggiornamento del lotto:', error);

    // Se l'errore proviene dalla risposta, mostra il messaggio
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nell\'aggiornamento del lotto',
        error: error.response.data
      };
    }

    // Altrimenti mostra un messaggio generico
    return {
      success: false,
      message: error.message || 'Errore nell\'aggiornamento del lotto',
      error
    };
  }
};

// Funzione migliorata per i lotti disponibili con gestione degli errori 500
export const getLottiDisponibili = async (filtri?: LottoFiltri, forceRefresh = false, mostraTutti = false): Promise<{ lotti: Lotto[] }> => {
  try {
    console.log('Richiesta lotti disponibili con filtri:', filtri ? JSON.stringify(filtri) : 'nessun filtro', 'mostraTutti:', mostraTutti);

    const headers = await getAuthHeader();

    // Costruisce i parametri di query dai filtri
    const params = new URLSearchParams();
    if (filtri) {
      Object.entries(filtri).forEach(([key, value]) => {
        if (!value) return;
        params.append(key, value.toString());
      });
    }
    if (mostraTutti) {
      params.append('mostraTutti', 'true');
    }

    const queryParams = params.toString() ? `?${params.toString()}` : '';

    console.log(`Richiesta GET ${API_URL}/lotti/disponibili${queryParams}`);

    try {
      const response = await axios.get(`${API_URL}/lotti/disponibili${queryParams}`, {
        headers,
        timeout: 30000 // Aumentato a 30 secondi per dare pià¹ tempo al server
      });

      console.log('Risposta del server:', JSON.stringify(response.data));

      // Estrazione e normalizzazione dei dati
      const lottiData = response.data.lotti || response.data || [];
      const normalizedLotti = Array.isArray(lottiData) ? lottiData.map(normalizeLotto) : [];

      console.log(`Ricevuti e normalizzati ${normalizedLotti.length} lotti disponibili`);

      console.log(`Restituisco ${normalizedLotti.length} lotti disponibili dal server`);
      return {
        lotti: normalizedLotti
      };
    } catch (error) {
      console.error('Errore nella chiamata al server per i lotti disponibili:', error);

      // Gestione specifica per errori di rete e server
      if (isAxiosError(error)) {
        // Gestione timeout o errori di connessione
        if (!error.response) {
          console.warn('Errore di rete durante il recupero dei lotti disponibili');
          return { lotti: [] }; // Ritorna un array vuoto invece di lanciare un errore
        }

        // Gestione errori server (500, 502, 503, 504)
        if (error.response.status >= 500) {
          console.warn(`Errore server ${error.response.status} durante il recupero lotti disponibili`);
          return { lotti: [] };
        }
      }

      // Per altri tipi di errori, rigeneriamo l'errore
      throw error;
    }
  } catch (err) {
    // Cast pià¹ sicuro dell'errore
    const error = err as any;
    console.error('Errore nel recupero dei lotti disponibili:', error);

    // Gestione specifica degli errori pià¹ comuni
    if (error.response?.status === 401) {
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    } else if (error.code === 'ECONNABORTED') {
      console.warn('Timeout durante il caricamento dei lotti.');
      return { lotti: [] }; // Non bloccare l'app, ritorna array vuoto
    } else if (isAxiosError(error)) {
      // Per gli errori di rete, non bloccare l'app
      if (!error.response) {
        console.warn('Impossibile comunicare con il server.');
        return { lotti: [] }; // Ritorna un array vuoto invece di lanciare un errore
      }
    }

    // Se stiamo ancora qui, ritorna comunque un array vuoto per non bloccare l'app
    return { lotti: [] };
  }
};

export default {
  getLotti,
  getLottoById,
  createLotto,
  getLottiDisponibili,
  invalidateCache
};

// Funzione specifica per aggiornare solo il prezzo di un lotto
export const updateLottoPrezzo = async (lottoId: number, prezzo: number | null): Promise<any> => {
  try {
    console.log(`Aggiornamento prezzo lotto ID ${lottoId} a ${prezzo}`);

    // Verifica se l'utente ha i permessi per aggiornare i lotti
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    const user = userData ? JSON.parse(userData) : null;

    if (!user || (user.ruolo !== 'Operatore' && user.ruolo !== 'Amministratore')) {
      throw new Error('Non hai i permessi per modificare questo lotto');
    }

    // Ottieni lo stato attuale del lotto
    const lottoAttuale = await getLottoById(lottoId);

    // Verifica se il lotto è verde (solo i lotti verdi possono avere un prezzo diverso da 0)
    if (lottoAttuale.stato !== 'Verde') {
      console.log(`Lotto ${lottoId} non è Verde (è ${lottoAttuale.stato}), impedisco l'aggiornamento del prezzo`);
      return {
        success: false,
        message: 'Solo i lotti verdi possono avere un prezzo. I lotti arancioni o rossi hanno automaticamente prezzo 0.',
        lotto: lottoAttuale
      };
    }

    // Ottieni gli header di autenticazione
    const headers = await getAuthHeader();

    // Effettua la richiesta all'endpoint specifico per l'aggiornamento del prezzo
    const response = await axios.put(`${API_URL}/lotti/${lottoId}/prezzo`,
      { prezzo: prezzo },
      {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('Risposta aggiornamento prezzo lotto:', JSON.stringify(response.data));

    // Invalida la cache
    invalidateCache();

    // Normalizza e restituisci il lotto aggiornato
    return {
      success: true,
      message: 'Prezzo del lotto aggiornato con successo',
      lotto: normalizeLotto(response.data.data || response.data)
    };
  } catch (error: any) {
    console.error('Errore nell\'aggiornamento del prezzo del lotto:', error);

    // Se l'errore proviene dalla risposta, mostra il messaggio
    if (error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore nell\'aggiornamento del prezzo',
        error: error.response.data
      };
    }

    // Altrimenti mostra un messaggio generico
    return {
      success: false,
      message: error.message || 'Errore nell\'aggiornamento del prezzo',
      error
    };
  }
};

export async function deleteLotto(lottoId: number) {
  const headers = await getAuthHeader?.(); // se esiste già  nel file, altrimenti usa l'interceptor axios
  const res = await axios.delete(`${API_URL}/lotti/${lottoId}`, {
    headers: { ...(headers || {}) }
  });
  return res.data;
}

