/**
 * Utility per il logging condizionale
 * Sostituisce console.log con una versione che mostra i log solo in modalità sviluppo
 */

const isDevEnvironment = () => {
  return __DEV__ === true;
};

// Flag per disabilitare completamente i log
const DISABLE_ALL_LOGS = process.env.EXPO_PUBLIC_DISABLE_LOGS === 'true';

class Logger {
  // Versione condizionale di console.log che funziona solo in ambiente di sviluppo
  log(...args: any[]) {
    // Se i log sono disabilitati, non facciamo niente
    if (DISABLE_ALL_LOGS) return;
    
    if (isDevEnvironment()) {
      console.log(...args);
    }
  }

  // Versione condizionale di console.error che funziona solo in ambiente di sviluppo
  error(...args: any[]) {
    // Se i log sono disabilitati, non facciamo niente
    if (DISABLE_ALL_LOGS) return;
    
    // Gli errori vogliamo sempre mostrarli in console, anche in produzione
    console.error(...args);
  }

  // Versione condizionale di console.warn che funziona solo in ambiente di sviluppo
  warn(...args: any[]) {
    // Se i log sono disabilitati, non facciamo niente
    if (DISABLE_ALL_LOGS) return;
    
    if (isDevEnvironment()) {
      console.warn(...args);
    }
  }

  // Versione condizionale di console.info che funziona solo in ambiente di sviluppo
  info(...args: any[]) {
    // Se i log sono disabilitati, non facciamo niente
    if (DISABLE_ALL_LOGS) return;
    
    if (isDevEnvironment()) {
      console.info(...args);
    }
  }
}

export default new Logger(); 
