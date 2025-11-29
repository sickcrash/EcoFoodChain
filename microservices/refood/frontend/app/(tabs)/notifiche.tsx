import React from 'react';
import { Stack } from 'expo-router';
import logger from '../../src/utils/logger';
import NotificheScreen from '../notifiche/index';
import { IconButton } from 'react-native-paper';
import { View } from 'react-native';
import notificheService from '../../src/services/notificheService';
import Toast from 'react-native-toast-message';

/**
 * Componente che reindirizza alla schermata delle notifiche.
 * Questo componente invoca direttamente il NotificheScreen con notifiche reali
 * dal backend.
 */
export default function NotificheTabRedirect() {
  logger.log('Rendering NotificheTabRedirect con notifiche reali');
  
  const addTestNotifica = () => {
    // Creo una notifica di test con ID negativo
    const notifica = notificheService.addLocalNotifica(
      `Test notifica #${Math.floor(Math.random() * 100)}`,
      `Questa è una notifica di test creata il ${new Date().toLocaleTimeString()}`,
      false
    );
    
    logger.log('Creata notifica di test con ID:', notifica.id);
    Toast.show({
      type: 'info',
      text1: 'Notifica di test creata',
      text2: `ID: ${notifica.id}`,
      visibilityTime: 3000,
    });
  };
  
  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: 'Notifiche',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconButton 
                icon="plus-circle" 
                size={24} 
                onPress={addTestNotifica} 
                iconColor="#4CAF50" 
              />
            </View>
          )
        }} 
      />
      <NotificheScreen />
    </>
  );
} 