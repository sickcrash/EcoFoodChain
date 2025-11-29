import Toast from 'react-native-toast-message';
import logger from './logger';

/**
 * Funzione di utilità per mostrare toast in modo sicuro, gestendo errori quando
 * il componente Toast non è disponibile (es. durante la navigazione tra schermate)
 */
export const safeShowToast = (options: {
  type: 'success' | 'error' | 'info' | 'warning',
  text1: string,
  text2?: string,
  visibilityTime?: number,
  position?: 'top' | 'bottom',
  topOffset?: number,
  bottomOffset?: number,
  onPress?: () => void
}) => {
  try {
    // Verifica che Toast sia disponibile prima di chiamare show
    if (typeof Toast !== 'undefined' && Toast && typeof Toast.show === 'function') {
      Toast.show(options);
      return true;
    } else {
      logger.warn('Toast non disponibile durante la chiamata a safeShowToast');
      
      // Log dei messaggi che volevi mostrare
      logger.log(`Toast (non mostrato): ${options.text1} - ${options.text2 || ''}`);
      return false;
    }
  } catch (error) {
    // Cattura e logga qualsiasi errore durante la chiamata a Toast.show
    logger.error('Errore durante la visualizzazione del toast:', error);
    return false;
  }
};

/**
 * Funzione per mostrare toast di successo
 */
export const showSuccessToast = (text1: string, text2?: string) => {
  return safeShowToast({
    type: 'success',
    text1,
    text2,
    visibilityTime: 3000
  });
};

/**
 * Funzione per mostrare toast di errore
 */
export const showErrorToast = (text1: string, text2?: string) => {
  return safeShowToast({
    type: 'error',
    text1,
    text2,
    visibilityTime: 4000
  });
};

/**
 * Funzione per mostrare toast informativo
 */
export const showInfoToast = (text1: string, text2?: string) => {
  return safeShowToast({
    type: 'info',
    text1,
    text2,
    visibilityTime: 3000
  });
};

export default {
  safeShowToast,
  showSuccessToast,
  showErrorToast,
  showInfoToast
}; 