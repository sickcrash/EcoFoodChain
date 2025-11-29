// Configurazione dell'API
import { API_URL } from './constants';

const NOTIFICATIONS_BASE = process.env.EXPO_PUBLIC_NOTIFICATIONS_URL || `${API_URL}/notifiche`;

export const API_CONFIG = {
  // URL dell'API principale
  API_URL,

  // URL per le notifiche (allineato alla stessa base)
  NOTIFICATIONS_API_URL: NOTIFICATIONS_BASE,

  // Flag per abilitare dati mock per le notifiche durante lo sviluppo
  USE_MOCK_NOTIFICATIONS: false,

  // Timeout per le richieste API (in ms)
  REQUEST_TIMEOUT: 10000,
}; 
