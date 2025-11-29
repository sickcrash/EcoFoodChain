import Constants from 'expo-constants';
import logger from '../utils/logger';

const FALLBACK_API_URL = 'http://localhost:3000/api/v1';

const getHostFromExpoRuntime = (): string | null => {
  const debuggerHost =
    (Constants?.expoGoConfig as any)?.debuggerHost ||
    (Constants?.expoConfig as any)?.hostUri ||
    (Constants?.expoConfig as any)?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    '';

  const host = debuggerHost.split(':')[0];
  const isLanIPv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  if (!host || host === 'localhost' || host === '127.0.0.1' || !isLanIPv4) {
    return null;
  }
  return host;
};

const maybeRewriteLocalhost = (url: string): string => {
  if (!url) {
    return FALLBACK_API_URL;
  }

  // Gestione veloce senza dipendere da URL global (non sempre disponibile su RN).
  const match = url.match(/^(https?:\/\/)([^\/]+)(.*)$/i);
  if (!match) {
    return url;
  }

  const [, protocol, hostPort, rest] = match;
  const [host, port] = hostPort.split(':');

  if (host !== 'localhost' && host !== '127.0.0.1') {
    return url;
  }

  const resolvedHost = getHostFromExpoRuntime();
  if (!resolvedHost) {
    return url;
  }

  const rewritten = `${protocol}${resolvedHost}${port ? `:${port}` : ''}${rest}`;
  logger.info(`[config] API_URL rimappato per device locale: ${rewritten}`);
  return rewritten;
};

// URL base dell'API
// Regola unica: legge EXPO_PUBLIC_API_URL, con fallback sicuro per sviluppo locale.
const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL;
export const API_URL = maybeRewriteLocalhost(RAW_API_URL);

// Contatti di supporto
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'supporto@refood.local';

// Chiavi per AsyncStorage
export const STORAGE_KEYS = {
  USER_TOKEN: 'user_token',
  USER_DATA: 'user_data',
  LAST_SYNC: 'last_sync',  // Per tenere traccia dell'ultima sincronizzazione
  REFRESH_TOKEN: 'refresh_token', // Per il token di refresh
  AUTH_TOKEN: 'auth_token',
  PUSH_TOKEN: 'push_token', // Per il token delle notifiche push
  LOCAL_NOTIFICATIONS: 'local_notifications', // Per salvare le notifiche locali
};

// Definizione dei colori principali dell'applicazione
export const COLORI = {
  primario: '#4CAF50',        // Verde principale
  primarioScuro: '#388E3C',   // Verde scuro
  primarioChiaro: '#A5D6A7',  // Verde chiaro
  secondario: '#FFC107',      // Ambra
  secondarioScuro: '#FFA000', // Ambra scuro
  secondarioChiaro: '#FFECB3', // Ambra chiaro
  sfondo: '#F5F5F5',          // Grigio chiaro per sfondo
  testoPrimario: '#212121',   // Nero per testo primario
  testoSecondario: '#757575', // Grigio per testo secondario
  divider: '#BDBDBD',         // Grigio per divisori
  error: '#D32F2F',           // Rosso per errori
  success: '#388E3C',         // Verde per successi
  warning: '#FFA000',         // Ambra per avvisi
  info: '#1976D2',            // Blu per informazioni
};

// Ruoli utente
export const RUOLI = {
  AMMINISTRATORE: 'Amministratore',
  OPERATORE: 'Operatore',
  UTENTE: 'Utente',
  CENTRO_SOCIALE: 'Canale Sociale',
  CENTRO_RICICLAGGIO: 'Centro Riciclo'
};

export const BONIFICO_IBAN_LABEL = 'Bonifico su IBAN: ITXXXXXXXXXXXXXXXXXXXXXXXXX';

// Tipi utente
export const TIPI_UTENTE = {
  PRIVATO: 'Privato',
  CANALE_SOCIALE: 'Canale Sociale',
  CENTRO_RICICLO: 'Centro Riciclo',
};

// Configurazione della navigazione
export const ROUTES = {
  HOME: 'Home',
  LOGIN: 'Login',
  REGISTRAZIONE: 'Registrazione',
  PROFILO: 'Profilo',
  TIPI_UTENTE: 'TipiUtente',
  TIPI_UTENTE_DETTAGLIO: 'TipiUtenteDettaglio',
  TIPI_UTENTE_MODIFICA: 'TipiUtenteModifica',
  TIPI_UTENTE_NUOVO: 'TipiUtenteNuovo',
  ATTORI: 'Attori',
  ATTORI_DETTAGLIO: 'AttoriDettaglio',
};

// Configurazioni per validazioni
export const VALIDAZIONI = {
  PASSWORD_MIN_LENGTH: 8,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  TELEFONO_REGEX: /^[0-9]{9,10}$/,
};

// Altre configurazioni dell'applicazione
export const CONFIG = {
  // Configurazioni per la paginazione
  ITEMS_PER_PAGE: 10,
  
  // Tempo di validità delle cache (in millisecondi)
  CACHE_DURATION: 5 * 60 * 1000, // 5 minuti
  
  // Intervallo di aggiornamento automatico dei dati (in millisecondi)
  REFRESH_INTERVAL: 30 * 1000, // 30 secondi
  
  // Configurazioni per upload file
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
};

// Impostazioni di animazione
export const ANIMAZIONI = {
  DURATA_STANDARD: 300, // millisecondi
  DURATA_VELOCE: 150,   // millisecondi
  DURATA_LENTA: 500,    // millisecondi
};

// Colore primario dell'app
export const PRIMARY_COLOR = '#4CAF50';

// Colori di stato
export const STATUS_COLORS = {
  SUCCESS: '#4CAF50',
  WARNING: '#FFA000',
  ERROR: '#F44336',
  INFO: '#2196F3',
};

// Timeout per le richieste API (in millisecondi)
export const API_TIMEOUT = 60000; // Aumentato a 60 secondi

// Intervallo di tempo per considerare i dati "freschi" (in millisecondi)
export const DATA_FRESHNESS_THRESHOLD = 5 * 60 * 1000; // 5 minuti 

// src/config/constants.ts
export type UnitaMisura = 'kg'|'g'|'L'|'ml'|'pz';
export type UnitaOption = { label: string; value: UnitaMisura };
export const UNITA_MISURA_GROUPS: Record<string, UnitaOption[]> = {
  Peso:   [{label:'kg', value:'kg'}, {label:'g', value:'g'}],
  Volume: [{label:'L',  value:'L'},  {label:'ml', value:'ml'}],
  Pezzi:  [{label:'pz', value:'pz'}],
};
