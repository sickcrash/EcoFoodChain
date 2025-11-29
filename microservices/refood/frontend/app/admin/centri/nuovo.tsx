import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Appbar, Card, RadioButton } from 'react-native-paper';
import { PRIMARY_COLOR, STORAGE_KEYS, API_URL } from '../../../src/config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { getActiveToken } from '../../../src/services/authService';

// Tipi di centro disponibili
const TIPI_CENTRO = [
  { label: 'Centro di Distribuzione', value: 'Distribuzione', id: 1 },
  { label: 'Centro Sociale', value: 'Centro Sociale', id: 4 },
  { label: 'Centro di Trasformazione', value: 'Trasformazione', id: 3 }
];

export default function NuovoCentroScreen() {
  const [loading, setLoading] = useState(false);
  
  // Stato del form
  const [nome, setNome] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState('Distribuzione');
  
  // Errori di validazione
  const [errors, setErrors] = useState({
    nome: false,
    indirizzo: false,
    telefono: false,
    email: false,
  });

  // Valida un campo specifico
  const validateField = (field: string, value: string) => {
    let isValid = true;

    switch (field) {
      case 'nome':
        isValid = value.trim().length >= 3;
        break;
      case 'indirizzo':
        isValid = value.trim().length >= 5;
        break;
      case 'telefono':
        // Opzionale ma se presente deve essere valido
        if (value) {
          isValid = /^[\d\s\+\-\(\)]{6,20}$/.test(value);
        }
        break;
      case 'email':
        // Opzionale ma se presente deve essere valida
        if (value) {
          isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        }
        break;
    }

    setErrors(prev => ({ ...prev, [field]: !isValid }));
    return isValid;
  };

  // Valida l'intero form
  const validateForm = () => {
    const nomeValid = validateField('nome', nome);
    const indirizzoValid = validateField('indirizzo', indirizzo);
    const telefonoValid = validateField('telefono', telefono);
    const emailValid = validateField('email', email);
    
    return nomeValid && indirizzoValid && telefonoValid && emailValid;
  };

  // Invia il form per creare un nuovo centro
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Errore', 'Alcuni campi non sono validi. Controlla e riprova.');
      return;
    }

    setLoading(true);
    try {
      const token = await getActiveToken();
      
      // Trova l'ID del tipo di centro selezionato
      const tipoSelezionato = TIPI_CENTRO.find(t => t.value === tipo);
      
      if (!tipoSelezionato) {
        throw new Error('Tipo di centro non valido');
      }
      
      // Prepara i dati del centro - solo i campi esistenti nella tabella Centri
      const centroData = {
        nome,
        indirizzo,
        tipo, // Utilizziamo direttamente il valore dal selettore
        tipo_id: tipoSelezionato.id, // Aggiungiamo l'ID del tipo
        telefono: telefono || null,
        email: email || null
      };
      
      console.log('Invio dati centro:', JSON.stringify(centroData));
      
      // Effettua la richiesta POST al server
      const response = await fetch(`${API_URL}/centri`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(centroData),
      });

      const responseData = await response.json();
      console.log('Risposta dal server:', JSON.stringify(responseData));

      if (!response.ok) {
        throw new Error(responseData.message || `Errore nella creazione del centro (${response.status})`);
      }

      // Centro creato con successo
      Alert.alert(
        'Successo',
        'Centro creato con successo',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Reindirizza alla pagina dei centri
              router.replace('/admin/centri');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Errore nella creazione del centro:', error);
      
      Alert.alert(
        'Errore',
        error.message || 'Si è verificato un errore durante la creazione del centro.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Nuovo Centro" />
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.formCard}>
          <Card.Title title="Informazioni di Base" />
          <Card.Content>
            <TextInput
              label="Nome del centro *"
              value={nome}
              onChangeText={(text) => {
                setNome(text);
                validateField('nome', text);
              }}
              style={styles.input}
              error={errors.nome}
              mode="outlined"
            />
            {errors.nome && <HelperText type="error">Inserisci un nome valido (minimo 3 caratteri)</HelperText>}
            
            <TextInput
              label="Indirizzo completo *"
              value={indirizzo}
              onChangeText={(text) => {
                setIndirizzo(text);
                validateField('indirizzo', text);
              }}
              style={styles.input}
              error={errors.indirizzo}
              mode="outlined"
              multiline
            />
            {errors.indirizzo && <HelperText type="error">Inserisci un indirizzo valido (minimo 5 caratteri)</HelperText>}
          </Card.Content>
        </Card>
        
        <Card style={styles.formCard}>
          <Card.Title title="Contatti" />
          <Card.Content>
            <TextInput
              label="Numero di telefono"
              value={telefono}
              onChangeText={(text) => {
                setTelefono(text);
                validateField('telefono', text);
              }}
              style={styles.input}
              error={errors.telefono}
              mode="outlined"
              keyboardType="phone-pad"
            />
            {errors.telefono && <HelperText type="error">Il formato del numero di telefono non è valido</HelperText>}
            
            <TextInput
              label="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                validateField('email', text);
              }}
              style={styles.input}
              error={errors.email}
              mode="outlined"
              keyboardType="email-address"
            />
            {errors.email && <HelperText type="error">Il formato dell'email non è valido</HelperText>}
          </Card.Content>
        </Card>
        
        <Card style={styles.formCard}>
          <Card.Title title="Tipo di Centro" />
          <Card.Content>
            <RadioButton.Group onValueChange={value => setTipo(value)} value={tipo}>
              {TIPI_CENTRO.map((option) => (
                <RadioButton.Item
                  key={option.value}
                  label={option.label}
                  value={option.value}
                  style={styles.radioItem}
                />
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>
        
        <Text style={styles.requiredText}>* Campi obbligatori</Text>
      </ScrollView>
      
      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.button}
          contentStyle={styles.buttonContent}
          icon="close"
        >
          <Text>Annulla</Text>
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={[styles.button, styles.primaryButton]}
          contentStyle={styles.buttonContent}
          loading={loading}
          disabled={loading}
          icon="check"
        >
          <Text>Salva</Text>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  formCard: {
    marginBottom: 16,
    elevation: 2,
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  radioItem: {
    paddingVertical: 4,
  },
  requiredText: {
    marginBottom: 16,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
    elevation: 4,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  primaryButton: {
    backgroundColor: PRIMARY_COLOR,
  },
}); 


