import { router } from 'expo-router';
import { Platform } from 'react-native';
import logger from './logger';

// Tipi per i percorsi accettati da expo-router
type RoutePath = string;

/**
 * Funzione che gestisce il reindirizzamento in modo ottimizzato per le diverse piattaforme
 */
export const safeNavigate = (
  path: RoutePath, 
  params: Record<string, string> = {}, 
  replace: boolean = true
) => {
  try {
    logger.log(`navigationHelper - safeNavigate a ${path} (replace: ${replace ? 'si' : 'no'})`);
    
    // Utilizziamo un formato coerente con expo-router
    if (replace) {
      router.replace({
        pathname: path as any,
        params
      });
    } else {
      router.push({
        pathname: path as any,
        params
      });
    }
    
    // Fallback per web in caso di errori
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Imposta un timeout per dare il tempo all'expo-router di funzionare
      setTimeout(() => {
        const newUrl = window.location.href;
        // Verifica se la navigazione è fallita o ha problemi
        if (newUrl.includes('undefined') || newUrl.includes('__EXPO_ROUTER_key=')) {
          // Tenta la navigazione diretta come fallback
          let url = path;
          if (Object.keys(params).length > 0) {
            const query = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
              query.append(key, value);
            }
            url = `${url}?${query.toString()}`;
          }
          window.location.href = url;
        }
      }, 300);
    }
  } catch (error) {
    logger.error(`navigationHelper - Errore durante la navigazione a ${path}:`, error);
  }
};

export default {
  safeNavigate
}; 