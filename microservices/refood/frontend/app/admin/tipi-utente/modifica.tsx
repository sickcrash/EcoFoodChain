import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Button, Card, Text, Appbar, HelperText, ActivityIndicator, RadioButton } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, API_URL, PRIMARY_COLOR } from '../../../src/config/constants';
import { getActiveToken } from '../../../src/services/authService';

// Tipi di utente disponibili
const TIPI_UTENTE = [
  { label: 'Privato', value: 'Privato', id: 1 },
  { label: 'Canale sociale', value: 'Canale sociale', id: 2 },
  { label: 'Centro riciclo', value: 'centro riciclo', id: 3 }
];

export default function ModificaTipoUtenteScreen() {
  const params = useLocalSearchParams();
  const tipoUtenteId = params.id as string;
  
  // Stati del form
  const [indirizzo, setIndirizzo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState('Privato');
  
  // Stati di errore
  const [indirizzoError, setIndirizzoError] = useState('');
  const [telefonoError, setTelefonoError] = useState('');
  const [emailError, setEmailError] = useState('');
  
  // Altri stati
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Carica i dati del tipo utente all'avvio
  // Carica i dati del tipo utente dal server
  const loadTipoUtente = useCallback(async () => {
    if (!tipoUtenteId) {
      Alert.alert('Errore', 'ID tipo utente non valido', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      return;
    }

    setLoading(true);
    try {
      const token = await getActiveToken();
      
      const response = await fetch(`${API_URL}/tipi-utente/${tipoUtenteId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Errore nel caricamento del tipo utente (${response.status})`);
      }

      const data = await response.json();
      
      if (data && data.tipoUtente) {
        // Popola i campi del form
        setIndirizzo(data.tipoUtente.indirizzo || '');
        setTelefono(data.tipoUtente.telefono || '');
        setEmail(data.tipoUtente.email || '');
        setTipo(data.tipoUtente.tipo || 'Privato');
      } else {
        throw new Error('Dati del tipo utente non trovati');
      }
    } catch (error) {
      console.error('Errore nel caricamento del tipo utente:', error);
      Alert.alert('Errore', 'Impossibile caricare i dettagli del tipo utente.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  }, [tipoUtenteId]);

  // Funzioni di validazione
  const validateIndirizzo = () => {
    if (indirizzo.trim().length < 5) {
      setIndirizzoError('L\'indirizzo deve contenere almeno 5 caratteri');
      return false;
    }
    setIndirizzoError('');
    return true;
  };

  const validateTelefono = () => {
    // Se il telefono è vuoto, è considerato valido (campo opzionale)
    if (!telefono) return true;
    
    const telefonoRegex = /^[0-9+\s()-]{8,20}$/;
    if (!telefonoRegex.test(telefono)) {
      setTelefonoError('Inserisci un numero di telefono valido');
      return false;
    }
    setTelefonoError('');
    return true;
  };

  const validateEmail = () => {
    // Se l'email è vuota, è considerata valida (campo opzionale)
    if (!email) return true;
    
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
    const isIndirizzoValid = validateIndirizzo();
    const isTelefonoValid = validateTelefono();
    const isEmailValid = validateEmail();
    
    // Se tutti i campi sono validi, procedi con l'invio
    if (isIndirizzoValid && isTelefonoValid && isEmailValid) {
      setSubmitting(true);
      try {
        const token = await getActiveToken();
        
        // Prepara i dati da inviare
        const tipoUtenteDati = {
          indirizzo,
          tipo,
          telefono: telefono || null,
          email: email || null
        };
        
        console.log('Invio dati aggiornamento tipo utente:', JSON.stringify(tipoUtenteDati));
        
        // Effettua la richiesta PUT al server
        const response = await fetch(`${API_URL}/tipi-utente/${tipoUtenteId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tipoUtenteDati),
        });

        const responseData = await response.json();
        console.log('Risposta dal server:', JSON.stringify(responseData));

        if (!response.ok) {
          throw new Error(responseData.message || `Errore nell'aggiornamento del tipo utente (${response.status})`);
        }

        // Tipo utente aggiornato con successo
        Alert.alert(
          'Successo',
          'Tipo utente aggiornato con successo',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } catch (error: any) {
        console.error('Errore nell\'aggiornamento del tipo utente:', error);
        
        Alert.alert(
          'Errore',
          error.message || 'Si è verificato un errore durante l\'aggiornamento del tipo utente.',
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
        <Text style={styles.loadingText}>Caricamento dati tipo utente...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Modifica Tipo Utente" />
      </Appbar.Header>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.formCard}>
          <Card.Title title="Informazioni di Base" />
          <Card.Content>
            <TextInput
              label="Indirizzo completo *"
              value={indirizzo}
              onChangeText={setIndirizzo}
              onBlur={validateIndirizzo}
              style={styles.input}
              error={!!indirizzoError}
              mode="outlined"
              multiline
            />
            {!!indirizzoError && <HelperText type="error">{indirizzoError}</HelperText>}
          </Card.Content>
        </Card>
        
        <Card style={styles.formCard}>
          <Card.Title title="Contatti" />
          <Card.Content>
            <TextInput
              label="Numero di telefono"
              value={telefono}
              onChangeText={setTelefono}
              onBlur={validateTelefono}
              style={styles.input}
              error={!!telefonoError}
              mode="outlined"
              keyboardType="phone-pad"
            />
            {!!telefonoError && <HelperText type="error">{telefonoError}</HelperText>}
            
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              onBlur={validateEmail}
              style={styles.input}
              error={!!emailError}
              mode="outlined"
              keyboardType="email-address"
            />
            {!!emailError && <HelperText type="error">{emailError}</HelperText>}
          </Card.Content>
        </Card>
        
        <Card style={styles.formCard}>
          <Card.Title title="Tipo di Utente" />
          <Card.Content>
            <RadioButton.Group onValueChange={value => setTipo(value)} value={tipo}>
              {TIPI_UTENTE.map((option) => (
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
          Annulla
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.button}
          contentStyle={styles.buttonContent}
          icon="check"
          loading={submitting}
          disabled={submitting}
        >
          Salva
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
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  formCard: {
    marginVertical: 8,
    elevation: 2,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  radioItem: {
    paddingVertical: 8,
  },
  requiredText: {
    marginTop: 8,
    marginBottom: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 8,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
  buttonContent: {
    height: 48,
  },
}); 


