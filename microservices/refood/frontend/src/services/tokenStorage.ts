import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';

export async function setAccessToken(token: string | null): Promise<void> {
  if (!token) {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, token);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
}

export async function removeAccessToken(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
}

export async function setRefreshToken(token: string | null): Promise<void> {
  if (!token) {
    await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function removeRefreshToken(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}
