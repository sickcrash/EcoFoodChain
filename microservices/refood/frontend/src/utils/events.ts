import EventEmitter from 'eventemitter3';

// Crea l’istanza globale di EventEmitter
export const appEvents = new EventEmitter();

// Definisci gli eventi usati nell'app
export const APP_EVENTS = {
  JWT_EXPIRED: 'jwtExpired',
  REFRESH_NOTIFICATIONS: 'refreshNotifications',
};

// Funzione per aggiungere un listener a un evento
export const listenEvent = (eventName: string, callback: (...args: any[]) => void) => {
  appEvents.on(eventName, callback);
  return () => appEvents.off(eventName, callback);
};

// Funzione per emettere un evento
export const emitEvent = (eventName: string, data?: any) => {
  appEvents.emit(eventName, data);
};
