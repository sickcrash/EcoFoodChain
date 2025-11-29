import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text as RNText } from 'react-native';
import { RadioButton, Text, Title, Button } from 'react-native-paper';
import { router } from 'expo-router';

export default function TestRadioScreen() {
  const [value, setValue] = useState('primo');
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Title style={styles.title}>Test RadioButton</Title>
        
        <RNText style={styles.label}>Valore selezionato: {value}</RNText>
        
        <RadioButton.Group onValueChange={value => setValue(value)} value={value}>
          <View style={styles.radioOption}>
            <RadioButton value="primo" />
            <Text>Opzione Uno</Text>
          </View>
          
          <View style={styles.radioOption}>
            <RadioButton value="secondo" />
            <Text>Opzione Due</Text>
          </View>
          
          <View style={styles.radioOption}>
            <RadioButton value="terzo" />
            <Text>Opzione Tre</Text>
          </View>
        </RadioButton.Group>
        
        <Button
          mode="contained"
          onPress={() => router.back()}
          style={styles.button}
        >
          Torna Indietro
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 20,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  button: {
    marginTop: 30,
  }
}); 