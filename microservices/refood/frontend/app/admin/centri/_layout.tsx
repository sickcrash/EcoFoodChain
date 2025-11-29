import { Stack , router } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { RUOLI } from '../../../src/config/constants';
import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function AdminCentriLayout() {
  const { user, isLoading } = useAuth();

  // Verifica l'autorizzazione dell'utente
  useEffect(() => {
    if (!isLoading && (!user || user.ruolo !== RUOLI.AMMINISTRATORE)) {
      // Reindirizza alla home se l'utente non è un amministratore
      alert('Accesso negato: questa sezione è riservata agli amministratori');
      router.replace('/(tabs)');
    }
  }, [user, isLoading]);

  // Mostra un caricamento mentre verifichiamo l'utente
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Caricamento...</Text>
      </View>
    );
  }

  // Se l'utente non è admin, non mostra nulla mentre reindirizza
  if (!user || user.ruolo !== RUOLI.AMMINISTRATORE) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Accesso negato</Text>
      </View>
    );
  }

  // L'utente è un amministratore, mostra il contenuto
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: "Gestione Centri",
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="nuovo" 
        options={{ 
          title: "Nuovo Centro",
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="modifica" 
        options={{ 
          title: "Modifica Centro",
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="operatori" 
        options={{ 
          title: "Gestione Operatori",
          headerShown: false 
        }} 
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
}); 