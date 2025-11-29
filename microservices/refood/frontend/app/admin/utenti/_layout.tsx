import { Stack , router } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { RUOLI } from '../../../src/config/constants';
import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

export default function AdminUtentiLayout() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (!isLoading && (!user || user.ruolo !== RUOLI.AMMINISTRATORE)) {
      alert('Accesso negato: questa sezione è riservata agli amministratori');
      router.replace('/(tabs)');
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.text, { color: colors.onBackground }]}>
          Caricamento...
        </Text>
      </View>
    );
  }

  if (!user || user.ruolo !== RUOLI.AMMINISTRATORE) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.text, { color: colors.error }]}>
          Accesso negato
        </Text>
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Gestione Utenti',
        }}
      />
      <Stack.Screen
        name="nuovo"
        options={{
          title: 'Nuovo Utente',
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
  },
  text: {
    marginTop: 16,
    fontSize: 16,
  },
});
