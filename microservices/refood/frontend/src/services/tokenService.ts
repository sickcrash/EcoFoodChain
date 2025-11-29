// tokenService.ts

import { getAccessToken as getStoredAccessToken, setAccessToken as storeAccessToken, setRefreshToken as storeRefreshToken, removeAccessToken, removeRefreshToken, getRefreshToken as getStoredRefreshToken } from './tokenStorage';
import axios, { isAxiosError } from 'axios';
import { API_URL } from '../config/constants';
import { setAuthToken } from './api';

/**
 * Rinnova il token di accesso usando il refresh token.
 * Restituisce true se il token è stato aggiornato correttamente.
 */
export const refreshToken = async (): Promise<boolean> => {
  console.log('refreshToken: Avvio del processo di refresh token.'); // NUOVO LOG
  try {
    const refresh = await getStoredRefreshToken();
    console.log('refreshToken: Refresh token recuperato dallo storage:', refresh ? 'Presente' : 'Assente'); // NUOVO LOG
    
    if (!refresh) {
      console.warn('refreshToken: Nessun refresh token trovato nello storage sicuro. Impossibile rinnovare.'); // Log esistente, reso pià¹ specifico
      return false;
    }

    console.log(`refreshToken: Tentativo di POST a ${API_URL}/auth/refresh-token con refresh token.`); // NUOVO LOG
    const response = await axios.post(`${API_URL}/auth/refresh-token`, {
      refresh_token: refresh,
    });
    console.log('refreshToken: Risposta dal server di refresh ricevuta. Status:', response.status); // NUOVO LOG
    console.log('refreshToken: Dati risposta refresh:', response.data); // NUOVO LOG

    if (response.status === 200 && (response.data?.access_token || response.data?.token)) {
      const newToken = response.data.access_token || response.data.token;
      console.log('refreshToken: Nuovo access token ricevuto con successo.'); // NUOVO LOG

      await storeAccessToken(newToken);
      console.log('refreshToken: Nuovo access token salvato nello storage sicuro.'); // NUOVO LOG
      setAuthToken(newToken); // imposta lâ€™Authorization header globalmente
      console.log('refreshToken: Header Authorization aggiornato.'); // NUOVO LOG

      return true;
    }

    console.warn('refreshToken: Refresh token non riuscito: risposta senza token valido o status non 200.'); // Log esistente, reso pià¹ specifico
    return false;
  } catch (err: any) { // Aggiunto : any per gestione tipo errore
    console.error('refreshToken: Errore durante il refresh del token:', err); // Log esistente, ora con pià¹ contesto
    if (isAxiosError(err)) {
        console.error('refreshToken: Dettagli errore Axios:', err.response?.status, err.response?.data); // NUOVO LOG per errori Axios
    }
    return false;
  }
};

/**
 * Ottiene il token di accesso attuale dallo storage sicuro.
 */
export const getActiveToken = async (): Promise<string | null> => {
  console.log('getActiveToken: Tentativo di recuperare il token attivo.'); // NUOVO LOG
  const token = await getStoredAccessToken();
  console.log('getActiveToken: Token attivo letto:', token ? 'Presente' : 'Assente'); // NUOVO LOG
  return token;
};



