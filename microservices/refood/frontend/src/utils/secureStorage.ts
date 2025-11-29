import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import logger from './logger';
import { Platform } from 'react-native';

const isSSR = Platform.OS === "web" ? typeof window === "undefined" : false;
let secureStoreAvailable: boolean | null = null;

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function ensureSecureStoreAvailability(): Promise<boolean> {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }
  try {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  } catch (error) {
    logger.warn('SecureStore non disponibile:', getErrorMessage(error));
    secureStoreAvailable = false;
  }
  return secureStoreAvailable ?? false;
}

export async function setSecureItem(key: string, value: string | null): Promise<void> {
  if (isSSR) {
    return;
  }
  if (value === null || value === undefined) {
    await deleteSecureItem(key);
    return;
  }

  const canUseSecure = await ensureSecureStoreAvailability();
  if (canUseSecure) {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainService: 'refood-secure-storage',
      });
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return;
    } catch (error) {
      logger.warn(`SecureStore.setItemAsync fallback su AsyncStorage: ${getErrorMessage(error)}`);
    }
  }

  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    logger.error(`Impossibile salvare il valore in AsyncStorage per la chiave ${key}:`, error);
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (isSSR) {
    return null;
  }

  const canUseSecure = await ensureSecureStoreAvailability();
  if (canUseSecure) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null && value !== undefined) {
        return value;
      }
    } catch (error) {
      logger.warn(`SecureStore.getItemAsync errore: ${getErrorMessage(error)}`);
    }
  }

  try {
    const fallback = await AsyncStorage.getItem(key);
    if (fallback && canUseSecure) {
      try {
        await SecureStore.setItemAsync(key, fallback, {
          keychainService: 'refood-secure-storage',
        });
        await AsyncStorage.removeItem(key).catch(() => undefined);
      } catch (error) {
        logger.warn('Migrazione verso SecureStore non riuscita:', getErrorMessage(error));
      }
    }
    return fallback;
  } catch (error) {
    logger.error(`Impossibile leggere il valore da AsyncStorage per la chiave ${key}:`, error);
    return null;
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isSSR) {
    return;
  }

  const canUseSecure = await ensureSecureStoreAvailability();
  if (canUseSecure) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      logger.warn(`SecureStore.deleteItemAsync errore: ${getErrorMessage(error)}`);
    }
  }

  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    logger.error(`Impossibile rimuovere la chiave ${key} da AsyncStorage:`, error);
  }
}




