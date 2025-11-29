import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL, STORAGE_KEYS } from '../config/constants';
import logger from '../utils/logger';
import { getActiveToken } from './authService';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;
let notificationHandlerConfigured = false;

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  // Evita il load completo su Expo Go (dove le push remote non sono supportate)
  if (Constants.appOwnership === 'expo') {
    logger.warn('PushNotificationService: esecuzione su Expo Go, skip registrazione push.');
    return null;
  }

  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }

  if (notificationsModule && !notificationHandlerConfigured) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
  }

  return notificationsModule;
}

/**
 * Servizio per la gestione delle notifiche push
 */
class PushNotificationService {
  /**
   * Configura le notifiche push
   */
  async configurePushNotifications(): Promise<boolean> {
    try {
      // Verifica se è un dispositivo fisico (necessario per le notifiche push)
      if (!Device.isDevice) {
        logger.warn('Le notifiche push non funzionano su emulatori/simulatori');
        return false;
      }

      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        // Expo Go: evitiamo di forzare la registrazione (remote non supportate)
        return false;
      }

      // Richiedi il permesso per le notifiche
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        logger.warn('Permesso per le notifiche non concesso!');
        return false;
      }

      // Ottieni e salva il token (per Expo Push Service)
      const token = await this.getExpoPushToken();
      
      if (token) {
        await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
        logger.log('Token push salvato:', token);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Errore durante la configurazione delle notifiche push:', error);
      return false;
    }
  }
  
  /**
   * Ottiene il token per le notifiche push
   */
  async getExpoPushToken(): Promise<string | null> {
    try {
      const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
      if (savedToken) {
        return savedToken;
      }

      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        logger.warn('PushNotificationService: modulo notifiche non disponibile (probabilmente Expo Go).');
        return null;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId ??
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
        undefined;

      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );

      logger.log('Token Expo ottenuto:', tokenResponse.data);
      return tokenResponse.data;
    } catch (error) {
      logger.error('Errore durante il recupero del token push:', error);
      return null;
    }
  }

  /**
   * Configura il canale di notifiche per Android
   */
  async setupNotificationChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        return;
      }

      await Notifications.setNotificationChannelAsync('default', {
        name: 'Refood',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      
      logger.log('Canale di notifiche Android configurato');
    }
  }
  
  /**
   * Invia una notifica locale (test)
   */
  async sendLocalNotification(
    title: string,
    body: string,
    data: Record<string, any> = {}
  ): Promise<void> {
    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      logger.warn('PushNotificationService: impossibile inviare notifica locale (modulo non disponibile).');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Invia immediatamente
    });
    
    logger.log('Notifica locale inviata');
  }
  
  /**
   * Cancella tutte le notifiche programmate
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        return;
      }
      // Cancella le notifiche visualizzate
      await Notifications.dismissAllNotificationsAsync();
      logger.log('Tutte le notifiche sono state cancellate');
    } catch (error) {
      logger.error('Errore durante la cancellazione delle notifiche:', error);
    }
  }

  /**
   * Invia il token push al server per la registrazione
   */
  async registerPushTokenWithServer(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
      const authToken = await getActiveToken();
      
      if (!token || !authToken) {
        logger.warn('Token push o token di autenticazione non disponibili');
        return false;
      }
      
      // In modalità  sviluppo, non inviamo realmente il token al server
      if (__DEV__) {
        logger.info('Modalità  sviluppo: simulazione registrazione token push');
        return true;
      }
      
      const deviceInfo = {
        pushToken: token,
        platform: Platform.OS,
        deviceName: Device.deviceName || 'Dispositivo sconosciuto',
        deviceModel: Device.modelName || 'Modello sconosciuto',
      };
      
      try {
        const response = await axios.post(
          `${API_URL}/users/register-device`,
          deviceInfo,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            timeout: 5000 // 5 secondi di timeout
          }
        );
        
        if (response.status === 200 || response.status === 201) {
          logger.log('Token push registrato con successo sul server');
          return true;
        } else {
          logger.warn('Risposta imprevista dal server durante la registrazione del token push');
          return false;
        }
      } catch (requestError: any) {
        // Non mostrare errore 404 (endpoint non implementato in dev)
        if (requestError.response && requestError.response.status === 404) {
          logger.warn('Endpoint di registrazione token non disponibile (404)');
          return true; // Fingiamo che sia andato a buon fine
        }
        // Rilanciare altri errori
        throw requestError;
      }
    } catch (error) {
      logger.error('Errore durante l\'invio del token push al server:', error);
      return false;
    }
  }

  /**
   * Cancella la registrazione per le notifiche push
   */
  async unregisterPushNotifications(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
      const authToken = await getActiveToken();
      
      if (token && authToken) {
        // Cancella la registrazione sul server
        await axios.delete(`${API_URL}/users/unregister-device`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            pushToken: token,
          },
        });
      }
      
      // Rimuovi il token dall'archiviazione locale
      await AsyncStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN);
      console.log('Registrazione notifiche push cancellata');
      
      return true;
    } catch (error) {
      console.error('Errore durante la cancellazione delle notifiche push:', error);
      return false;
    }
  }

  /**
   * Configura i listener per gestire le notifiche ricevute
   * @param onNotificationReceived Callback da eseguire quando si riceve una notifica mentre l'app è aperta
   * @param onNotificationResponseReceived Callback da eseguire quando l'utente tocca una notifica
   */
  setupNotificationListeners(
    onNotificationReceived: (notification: Notifications.Notification) => void,
    onNotificationResponseReceived: (response: Notifications.NotificationResponse) => void
  ): () => void {
    // Listener per le notifiche ricevute mentre l'app è in primo piano
    const notificationListener = Notifications.addNotificationReceivedListener(onNotificationReceived);
    
    // Listener per le notifiche a cui l'utente ha risposto
    const responseListener = Notifications.addNotificationResponseReceivedListener(onNotificationResponseReceived);
    
    // Funzione di cleanup per rimuovere i listener
    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }

  /**
   * Ottiene il badge corrente
   */
  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Errore durante il recupero del conteggio del badge:', error);
      return 0;
    }
  }

  /**
   * Imposta il badge con il conteggio specificato
   */
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Errore durante l\'impostazione del conteggio del badge:', error);
    }
  }

  /**
   * Invia una notifica locale
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data: any = {},
    trigger: Notifications.NotificationTriggerInput = null
  ): Promise<string> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          badge: 1,
          sound: true,
        },
        trigger,
      });
      
      return notificationId;
    } catch (error) {
      console.error('Errore durante l\'invio della notifica locale:', error);
      throw error;
    }
  }
}

// Crea e esporta un'istanza del servizio
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService; 


