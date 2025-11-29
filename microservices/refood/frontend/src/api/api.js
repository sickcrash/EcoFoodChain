import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';
import { getActiveToken } from '../services/authService';

// Impostazione della URL base per tutte le richieste (rispetta EXPO_PUBLIC_API_URL)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per aggiungere il token di autenticazione a tutte le richieste
api.interceptors.request.use(
  async (config) => {
    // --- (A) Se è una POST multipart verso /segnalazioni, lascia che Axios imposti il boundary ---
    const isFormData =
      (typeof FormData !== 'undefined' && config.data instanceof FormData) ||
      (config.data && typeof config.data === 'object' && typeof config.data.append === 'function' && !('toJSON' in config.data));
    const isSegnalazioni = typeof config.url === 'string' && config.url.includes('/segnalazioni');

    if (isFormData && isSegnalazioni) {
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('Content-Type', undefined); // Axios v1
      } else if (config.headers) {
        delete config.headers['Content-Type']; // Axios < v1
      }
    }

    // --- (B) Recupero token: prima SecureStore (mobile), poi localStorage/sessionStorage (web) ---
    try {
      let token = null;

      // 1) Mobile
      if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
        try {
          token = await SecureStore.getItemAsync('auth_token');
        } catch { /* fallback sotto */ }
      }

      if (!token) {
        try {
          token = await getActiveToken();
        } catch { /* ignore */ }
      }

      // 2) Web
      if (!token && typeof window !== 'undefined') {
        token = window.localStorage?.getItem('auth_token')
          || window.sessionStorage?.getItem('auth_token')
          || null;
      }

      if (token) {
        if (config.headers && typeof config.headers.set === 'function') {
          config.headers.set('Authorization', `Bearer ${token}`);
        } else {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.error('Errore nel recupero del token:', error);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor per gestire gli errori comuni
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Se non è un 401, lascio passare
    if (!error.response || error.response.status !== 401) {
      return Promise.reject(error);
    }

    const originalRequest = error.config || {};

    // Evita loop: non intercettare la rotta di refresh
    if (typeof originalRequest.url === 'string' && originalRequest.url.includes('/auth/refresh-token')) {
      return Promise.reject(error);
    }

    try {
      // 1) Recupera il refresh token: prima SecureStore (mobile), poi web storage
      let refreshToken = null;
      if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
        try {
          refreshToken = await SecureStore.getItemAsync('refresh_token');
        } catch { /* fallback sotto */ }
      }
      if (!refreshToken && typeof window !== 'undefined') {
        refreshToken = window.localStorage?.getItem('refresh_token')
          || window.sessionStorage?.getItem('refresh_token')
          || null;
      }

      if (!refreshToken) {
        // Niente da fare: non posso aggiornare, rigetto
        return Promise.reject(error);
      }

      // 2) Chiama lâ€™endpoint corretto del backend
      const resp = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });

      const newAccess = resp.data?.accessToken;
      const newRefresh = resp.data?.refreshToken;

      if (!newAccess) {
        return Promise.reject(error);
      }

      // 3) Salva i nuovi token
      try {
        // mobile
        await SecureStore.setItemAsync('auth_token', newAccess);
        if (newRefresh) await SecureStore.setItemAsync('refresh_token', newRefresh);
      } catch { /* ignora su web */ }

      // web
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem('auth_token', newAccess);
        if (newRefresh) window.localStorage?.setItem('refresh_token', newRefresh);
      }

      // 4) Riprova la richiesta originale con il nuovo access token
      originalRequest.headers = originalRequest.headers || {};
      if (typeof originalRequest.headers.set === 'function') {
        originalRequest.headers.set('Authorization', `Bearer ${newAccess}`);
      } else {
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      }

      // Usa lâ€™istanza `api` cosà¬ mantiene baseURL e interceptors
      return api.request(originalRequest);
    } catch (refreshError) {
      // refresh fallito: pulisco tutto e rigetto
      try {
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('refresh_token');
      } catch { /* web only cleanup */ }
      if (typeof window !== 'undefined') {
        window.localStorage?.removeItem('auth_token');
        window.localStorage?.removeItem('refresh_token');
        window.sessionStorage?.removeItem('auth_token');
        window.sessionStorage?.removeItem('refresh_token');
      }
      return Promise.reject(refreshError);
    }
  }
);

// Funzioni di autenticazione
const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('attori/profile'),
};

// Funzioni per la gestione degli utenti
const usersAPI = {
  getAllAttori: () => api.get('/attori'),
  getAttoreById: (id) => api.get(`/attori/${id}`),
};

// Funzioni per la gestione dei tipi utente
const tipiUtenteAPI = {
  getAllTipiUtente: () => api.get('/tipi-utente'),
  getTipoUtenteById: (id) => api.get(`/tipi-utente/${id}`),
  createTipoUtente: (data) => api.post('/tipi-utente', data),
  updateTipoUtente: (id, data) => api.put(`/tipi-utente/${id}`, data),
  deleteTipoUtente: (id) => api.delete(`/tipi-utente/${id}`),
  getOperatori: (id) => api.get(`/tipi-utente/${id}/attori`),
  associaOperatore: (id, attoreId) => api.post(`/tipi-utente/${id}/attori/${attoreId}`),
  rimuoviOperatore: (id, attoreId) => api.delete(`/tipi-utente/${id}/attori/${attoreId}`),
};

// Funzioni per la gestione della mappa e geolocalizzazione
const mappaAPI = {
  getCentriMappa: () => {
    console.log('API Call: getCentriMappa');
    return api.get('/mappa/centri');
  },

  getCentroById: (id) => {
    console.log('API Call: getCentroById', id);
    return api.get(`/mappa/centri/${id}`);
  },

  searchCentri: (query, options = {}) => {
    console.log('API Call: searchCentri', query, options);
    const queryParams = { q: query };

    // Aggiungi parametri opzionali
    if (options.tipo && options.tipo !== 'tutti') {
      queryParams.tipo = options.tipo;
    }
    if (options.solo_con_coordinate) {
      queryParams.solo_con_coordinate = 'true';
    }

    const serialized = Object.entries(queryParams)
      .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
      .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value)))
      .join('&');

    const suffix = serialized ? '?' + serialized : '';
    return api.get('/mappa/centri/search' + suffix);
  },


  getStatisticheCentri: () => {
    console.log('API Call: getStatisticheCentri');
    return api.get('/mappa/statistiche');
  },
};



export {
  api,
  authAPI,
  usersAPI,
  tipiUtenteAPI,
  mappaAPI
};



