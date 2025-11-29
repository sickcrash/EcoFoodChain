import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Button, Card, Text, Appbar, HelperText, ActivityIndicator, RadioButton } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, API_URL, PRIMARY_COLOR } from '../../../src/config/constants';
import { getActiveToken } from '../../../src/services/authService';

// Tipi di centro disponibili
const TIPI_CENTRO = [
  { label: 'Centro di Distribuzione', value: 'Distribuzione', id: 1 },
  { label: 'Centro Sociale', value: 'Centro Sociale', id: 4 },
  { label: 'Centro di Trasformazione', value: 'Trasformazione', id: 3 }
];

export default function ModificaCentroScreen() {
  const params = useLocalSearchParams();
  const centroId = params.id as string;
  
  // Stati del form
  const [nome, setNome] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState('Centro di Raccolta');
  
  // Stati di errore
  const [nomeError, setNomeError] = useState('');
  const [indirizzoError, setIndirizzoError] = useState('');
  const [telefonoError, setTelefonoError] = useState('');
  const [emailError, setEmailError] = useState('');
  
  // Altri stati
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Carica i dati del centro dal server
  const loadCentro = useCallback(async () => {
    if (!centroId) {
      Alert.alert('Errore', 'ID centro non valido', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }

    setLoading(true);
    try {
      const token = await getActiveToken();
      
      const response = await fetch(`${API_URL}/centri/${centroId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Errore nel caricamento del centro (${response.status})`);
      }

      const data = await response.json();
      
      if (data && data.centro) {
        // Popola i campi del form
        setNome(data.centro.nome || '');
        setIndirizzo(data.centro.indirizzo || '');
        setTelefono(data.centro.telefono || '');
        setEmail(data.centro.email || '');
        setTipo(data.centro.tipo || 'Centro di Raccolta');
      } else {
        throw new Error('Dati del centro non trovati');
      }
    } catch (error) {
      console.error('Errore nel caricamento del centro:', error);
      Alert.alert('Errore', 'Impossibile caricare i dettagli del centro.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  }, [centroId]);

  // Carica i dati del centro all'avvio
  useEffect(() => {
    loadCentro();
  }, [loadCentro]);

  // Funzioni di validazione
  const validateNome = () => {
    if (nome.trim().length < 3) {
      setNomeError('Il nome deve contenere almeno 3 caratteri');
      return false;
    }
    setNomeError('');
    return true;
  };

  const validateIndirizzo = () => {
    if (indirizzo.trim().length < 5) {
      setIndirizzoError('L\'indirizzo deve contenere almeno 5 caratteri');
      return false;
    }
    setIndirizzoError('');
    return true;
  };

  const validateTelefono = () => {
    const telefonoRegex = /^[0-9+\s()-]{8,20}$/;
    if (!telefonoRegex.test(telefono)) {
      setTelefonoError('Inserisci un numero di telefono valido');
      return false;
    }
    setTelefonoError('');
    return true;
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Inserisci un indirizzo email valido');
      return false;
    }
    setEmailError('');
    return true;
  };

  // Gestisce l'invio del form
  const handleSubmit = async () => {
    // Valida tutti i campi
    const isNomeValid = validateNome();
    const isIndirizzoValid = validateIndirizzo();
    const isTelefonoValid = validateTelefono();
    const isEmailValid = validateEmail();
    
    // Se tutti i campi sono validi, procedi con l'invio
    if (isNomeValid && isIndirizzoValid && isTelefonoValid && isEmailValid) {
      setSubmitting(true);
      try {
        const token = await getActiveToken();
        
        // Trova l'ID del tipo di centro selezionato
        const tipoSelezionato = TIPI_CENTRO.find(t => t.value === tipo);
        
        if (!tipoSelezionato) {
          throw new Error('Tipo di centro non valido');
        }
        
        // Prepara i dati da inviare
        const centroDati = {
          nome,
          indirizzo,
          tipo: tipo, // Stringa del tipo
          tipo_id: tipoSelezionato.id, // ID numerico del tipo
          telefono,
          email
        };
        
        console.log('Invio dati aggiornamento centro:', JSON.stringify(centroDati));
        
        // Effettua la richiesta PUT al server
        const response = await fetch(`${API_URL}/centri/${centroId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(centroDati),
        });

        const responseData = await response.json();
        console.log('Risposta dal server:', JSON.stringify(responseData));

        if (!response.ok) {
          throw new Error(responseData.message || `Errore nell'aggiornamento del centro (${response.status})`);
        }

        // Centro aggiornato con successo
        Alert.alert(
          'Successo',
          'Centro aggiornato con successo',
          [{ text: 'OK', onPress: () => router.replace('/admin/centri') }]
        );
      } catch (error: any) {
        console.error('Errore nell\'aggiornamento del centro:', error);
        
        Alert.alert(
          'Errore',
          error.message || 'Si è verificato un errore durante l\'aggiornamento del centro.',
          [{ text: 'OK' }]
        );
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Caricamento dati del centro...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Modifica Centro" />
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>Modifica informazioni centro</Text>
            
            <TextInput
              label="Nome centro *"
              value={nome}
              onChangeText={setNome}
              mode="outlined"
              style={styles.input}
              error={!!nomeError}
              onBlur={validateNome}
            />
            {nomeError ? <HelperText type="error">{nomeError}</HelperText> : null}
            
            <TextInput
              label="Indirizzo *"
              value={indirizzo}
              onChangeText={setIndirizzo}
              mode="outlined"
              style={styles.input}
              error={!!indirizzoError}
              onBlur={validateIndirizzo}
            />
            {indirizzoError ? <HelperText type="error">{indirizzoError}</HelperText> : null}
            
            <TextInput
              label="Telefono *"
              value={telefono}
              onChangeText={setTelefono}
              mode="outlined"
              style={styles.input}
              error={!!telefonoError}
              onBlur={validateTelefono}
              keyboardType="phone-pad"
            />
            {telefonoError ? <HelperText type="error">{telefonoError}</HelperText> : null}
            
            <TextInput
              label="Email *"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={styles.input}
              error={!!emailError}
              onBlur={validateEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailError ? <HelperText type="error">{emailError}</HelperText> : null}
            
            <Text style={styles.sectionTitle}>Tipo di centro *</Text>
            <RadioButton.Group onValueChange={setTipo} value={tipo}>
              {TIPI_CENTRO.map((option) => (
                <RadioButton.Item
                  key={option.value}
                  label={option.label}
                  value={option.value}
                  style={styles.radioItem}
                />
              ))}
            </RadioButton.Group>
            
            <Text style={styles.requiredFieldsNote}>* Campi obbligatori</Text>
          </Card.Content>
        </Card>
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.button}
          loading={submitting}
          disabled={submitting}
        >
          <Text>Aggiorna Centro</Text>
        </Button>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.cancelButton}
          disabled={submitting}
        >
          <Text>Annulla</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  radioItem: {
    marginBottom: 8,
  },
  requiredFieldsNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 16,
    fontStyle: 'italic',
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: '#fff',
    elevation: 4,
    flexDirection: 'column',
  },
  button: {
    marginBottom: 8,
    backgroundColor: PRIMARY_COLOR,
  },
  cancelButton: {
    borderColor: PRIMARY_COLOR,
  },
}); 


