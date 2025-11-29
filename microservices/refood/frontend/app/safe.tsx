import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { router } from 'expo-router';

export default function SafeIndex() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={{ marginBottom: 12 }}>
        Safe Index
      </Text>
      <Text style={{ marginBottom: 24 }}>
        Schermata minimale per avvio senza errori.
      </Text>
      <Button mode="contained" onPress={() => router.replace('/(tabs)')}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Apri app</Text>
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});


