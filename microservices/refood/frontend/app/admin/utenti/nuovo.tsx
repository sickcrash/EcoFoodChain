import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, HelperText, Divider, Chip, Avatar, RadioButton, TouchableRipple } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR, STORAGE_KEYS, API_URL, RUOLI, VALIDAZIONI } from '../../../src/config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getActiveToken } from '../../../src/services/authService';

// Interfaccia per rappresentare un centro
interface Centro {
  id: number;
  nome: string;
  indirizzo: string;
  tipo: string;
}

// Interfaccia per il form dell'utente
interface UserForm {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  confirmPassword: string;
  ruolo: string;
}

export default function NuovoUtenteScreen() {

  // Stati
  const [form, setForm] = useState<UserForm>({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    confirmPassword: '',
    ruolo: RUOLI.OPERATORE
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [centri, setCentri] = useState<Centro[]>([]);
  const [selectedCentri, setSelectedCentri] = useState<Record<number, boolean>>({});
  const [loadingCentri, setLoadingCentri] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Carica i centri all'avvio
  useEffect(() => {
    loadCentri();
  }, []);
  
  // Funzione per caricare i centri
  const loadCentri = async () => {
    setLoadingCentri(true);
    try {
      const token = await getActiveToken();
      
      const response = await fetch(`${API_URL}/centri`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Errore nel caricamento dei centri (${response.status})`);
      }
      
      const data = await response.json();
      
      // Formatta i dati dei centri
      let listaCentri: Centro[] = [];
      if (data && Array.isArray(data.data)) {
        listaCentri = data.data;
      } else if (data && Array.isArray(data)) {
        listaCentri = data;
      }
      
      setCentri(listaCentri);
      
    } catch (error) {
      console.error('Errore nel caricamento dei centri:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Impossibile caricare i centri',
      });
    } finally {
      setLoadingCentri(false);
    }
  };
  
  // Funzione per aggiornare il form
  const updateForm = (key: keyof UserForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    
    // Pulisci l'errore quando l'utente modifica il campo
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };
  
  // Funzione per gestire la selezione di un centro
  const toggleCentro = (id: number) => {
    setSelectedCentri(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Validazione dei campi
  const validateField = (field: keyof UserForm): boolean => {
    switch (field) {
      case 'nome':
        if (!form.nome.trim()) {
          setErrors(prev => ({ ...prev, nome: 'Il nome è obbligatorio' }));
          return false;
        }
        return true;
        
      case 'cognome':
        if (!form.cognome.trim()) {
          setErrors(prev => ({ ...prev, cognome: 'Il cognome è obbligatorio' }));
          return false;
        }
        return true;
        
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!form.email.trim()) {
          setErrors(prev => ({ ...prev, email: 'L\'email è obbligatoria' }));
          return false;
        } else if (!emailRegex.test(form.email)) {
          setErrors(prev => ({ ...prev, email: 'Inserisci un\'email valida' }));
          return false;
        }
        return true;
        
      case 'password':
        if (!form.password) {
          setErrors(prev => ({ ...prev, password: 'La password è obbligatoria' }));
          return false;
        } else if (form.password.length < VALIDAZIONI.PASSWORD_MIN_LENGTH) {
          setErrors(prev => ({ ...prev, password: `La password deve contenere almeno ${VALIDAZIONI.PASSWORD_MIN_LENGTH} caratteri` }));
          return false;
        }
        return true;
        
      case 'confirmPassword':
        if (form.password !== form.confirmPassword) {
          setErrors(prev => ({ ...prev, confirmPassword: 'Le password non coincidono' }));
          return false;
        }
        return true;
        
      case 'ruolo':
        if (!form.ruolo) {
          setErrors(prev => ({ ...prev, ruolo: 'Il ruolo è obbligatorio' }));
          return false;
        }
        return true;
        
      default:
        return true;
    }
  };
  
  // Validazione del form completo
  const validateForm = (): boolean => {
    const fields: (keyof UserForm)[] = ['nome', 'cognome', 'email', 'password', 'confirmPassword', 'ruolo'];
    
    // Valida tutti i campi
    const validations = fields.map(field => validateField(field));
    
    // Controlla se ci sono centri selezionati
    const hasCentri = Object.values(selectedCentri).some(Boolean);
    if (!hasCentri) {
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Seleziona almeno un centro',
      });
      return false;
    }
    
    return validations.every(Boolean);
  };
  
  // Invia il form per creare un nuovo utente
  const handleSubmit = async () => {
    // Verifica se il form è valido
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      const token = await getActiveToken();
      
      // Preparazione dei dati da inviare
      const userData = {
        nome: form.nome,
        cognome: form.cognome,
        email: form.email,
        password: form.password,
        ruolo: form.ruolo
      };
      
      // Creazione dell'utente
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Errore nella creazione dell'utente (${response.status})`);
      }
      
      const data = await response.json();
      console.log('Risposta creazione utente:', JSON.stringify(data));
      
      // Cerco l'ID utente in vari possibili campi della risposta
      let userId;
      if (data.id) {
        userId = data.id;
      } else if (data.utente && data.utente.id) {
        userId = data.utente.id;
      } else if (data.user && data.user.id) {
        userId = data.user.id;
      } else if (data.userId) {
        userId = data.userId;
      } else if (data.user_id) {
        userId = data.user_id;
      }
      
      // Se ancora non abbiamo trovato l'ID, proviamo a cercarlo in qualsiasi campo che sembra un ID
      if (!userId) {
        for (const key in data) {
          if ((key.toLowerCase().includes('id') || key === '_id') && 
              (typeof data[key] === 'number' || (typeof data[key] === 'string' && !isNaN(parseInt(data[key]))))) {
            userId = data[key];
            console.log(`Trovato possibile ID nel campo "${key}": ${userId}`);
            break;
          }
        }
      }
      
      if (!userId) {
        console.error('Impossibile trovare ID utente nella risposta. Risposta completa:', data);
        throw new Error('ID utente non trovato nella risposta');
      } else {
        console.log(`ID utente estratto: ${userId}`);
      }
      
      // Ottieni i centri selezionati
      const centriIds = Object.entries(selectedCentri)
        .filter(([_, isSelected]) => isSelected)
        .map(([id, _]) => parseInt(id));
        
      // Associa l'utente ai centri selezionati
      if (centriIds.length > 0) {
        // Prepara i dati da inviare in base al ruolo
        const payload = form.ruolo === RUOLI.OPERATORE
          ? { operatori_ids: [userId] }
          : { amministratori_ids: [userId] };
        
        console.log(`Associo utente ${userId} (${form.ruolo}) ai centri:`, centriIds);
        console.log('Payload:', JSON.stringify(payload));
        
        // Per ogni centro selezionato
        let associazioniRiuscite = 0;
        for (const centroId of centriIds) {
          try {
            console.log(`Associo utente al centro ${centroId}...`);
            
            const assocResponse = await fetch(`${API_URL}/centri/${centroId}/operatori`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });
            
            if (!assocResponse.ok) {
              const errorBody = await assocResponse.json();
              console.error(`Errore nell'associazione al centro ${centroId}:`, errorBody);
              Toast.show({
                type: 'warning',
                text1: 'Attenzione',
                text2: `Errore nell'associazione al centro #${centroId}: ${errorBody.message || 'Errore sconosciuto'}`,
                visibilityTime: 3000,
              });
            } else {
              console.log(`Utente associato con successo al centro ${centroId}`);
              associazioniRiuscite++;
            }
          } catch (err) {
            console.error(`Eccezione durante l'associazione al centro ${centroId}:`, err);
          }
        }
        
        if (associazioniRiuscite === centriIds.length) {
          console.log('Tutte le associazioni sono state completate con successo');
        } else {
          console.log(`Completate ${associazioniRiuscite} associazioni su ${centriIds.length}`);
        }
      }
      
      // Mostra un messaggio di successo
      Toast.show({
        type: 'success',
        text1: 'Successo',
        text2: 'Utente creato e associato ai centri selezionati',
        visibilityTime: 4000,
        topOffset: 50,
        onShow: () => console.log('Toast di successo visualizzato'),
      });
      
      // Torna alla lista degli utenti solo dopo che il Toast è visibile
      setTimeout(() => {
        console.log('Navigazione alla lista utenti...');
        router.replace('/admin/utenti');
      }, 1500);
      
    } catch (error: any) {
      console.error('Errore nella creazione dell\'utente:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error.message || 'Si è verificato un errore durante la creazione dell\'utente',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Ottieni il colore del ruolo
  const getRoleColor = (ruolo: string) => {
    switch (ruolo) {
      case RUOLI.AMMINISTRATORE:
        return '#1976d2'; // Blu
      case RUOLI.OPERATORE:
        return '#4CAF50'; // Verde
      default:
        return '#757575'; // Grigio
    }
  };
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          <Text style={styles.sectionTitle}>Informazioni Utente</Text>
          
          {/* Nome */}
          <TextInput
            label="Nome"
            value={form.nome}
            onChangeText={(value) => updateForm('nome', value)}
            mode="outlined"
            style={styles.input}
            error={!!errors.nome}
            disabled={loading}
          />
          {errors.nome && <HelperText type="error">{errors.nome}</HelperText>}
          
          {/* Cognome */}
          <TextInput
            label="Cognome"
            value={form.cognome}
            onChangeText={(value) => updateForm('cognome', value)}
            mode="outlined"
            style={styles.input}
            error={!!errors.cognome}
            disabled={loading}
          />
          {errors.cognome && <HelperText type="error">{errors.cognome}</HelperText>}
          
          {/* Email */}
          <TextInput
            label="Email"
            value={form.email}
            onChangeText={(value) => updateForm('email', value)}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            error={!!errors.email}
            disabled={loading}
          />
          {errors.email && <HelperText type="error">{errors.email}</HelperText>}
          
          {/* Password */}
          <TextInput
            label="Password"
            value={form.password}
            onChangeText={(value) => updateForm('password', value)}
            mode="outlined"
            style={styles.input}
            secureTextEntry={!showPassword}
            error={!!errors.password}
            disabled={loading}
            right={
              <TextInput.Icon 
                icon={showPassword ? "eye-off" : "eye"} 
                onPress={() => setShowPassword(!showPassword)} 
              />
            }
          />
          {errors.password && <HelperText type="error">{errors.password}</HelperText>}
          
          {/* Conferma Password */}
          <TextInput
            label="Conferma Password"
            value={form.confirmPassword}
            onChangeText={(value) => updateForm('confirmPassword', value)}
            mode="outlined"
            style={styles.input}
            secureTextEntry={!showConfirmPassword}
            error={!!errors.confirmPassword}
            disabled={loading}
            right={
              <TextInput.Icon 
                icon={showConfirmPassword ? "eye-off" : "eye"} 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)} 
              />
            }
          />
          {errors.confirmPassword && <HelperText type="error">{errors.confirmPassword}</HelperText>}
          
          {/* Ruolo */}
          <Text style={styles.fieldLabel}>Ruolo</Text>
          <RadioButton.Group 
            onValueChange={(value) => updateForm('ruolo', value)} 
            value={form.ruolo}
          >
            <View style={styles.radioContainer}>
              <TouchableRipple 
                onPress={() => updateForm('ruolo', RUOLI.OPERATORE)}
                style={styles.radioItem}
              >
                <View style={styles.radioContent}>
                  <Avatar.Icon 
                    size={40} 
                    icon="account-hard-hat" 
                    style={[styles.roleAvatar, { backgroundColor: getRoleColor(RUOLI.OPERATORE) }]} 
                    color="#fff"
                  />
                  <View style={styles.radioTextContainer}>
                    <Text style={styles.radioLabel}>Operatore</Text>
                    <Text style={styles.radioDescription}>Puà² gestire i lotti e le prenotazioni</Text>
                  </View>
                  <RadioButton value={RUOLI.OPERATORE} />
                </View>
              </TouchableRipple>
              
              <TouchableRipple 
                onPress={() => updateForm('ruolo', RUOLI.AMMINISTRATORE)}
                style={styles.radioItem}
              >
                <View style={styles.radioContent}>
                  <Avatar.Icon 
                    size={40} 
                    icon="account-tie" 
                    style={[styles.roleAvatar, { backgroundColor: getRoleColor(RUOLI.AMMINISTRATORE) }]} 
                    color="#fff"
                  />
                  <View style={styles.radioTextContainer}>
                    <Text style={styles.radioLabel}>Amministratore</Text>
                    <Text style={styles.radioDescription}>Puà² gestire centri, operatori e impostazioni</Text>
                  </View>
                  <RadioButton value={RUOLI.AMMINISTRATORE} />
                </View>
              </TouchableRipple>
            </View>
          </RadioButton.Group>
          
          <Divider style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Seleziona Centri</Text>
          <Text style={styles.sectionDescription}>
            Seleziona i centri a cui associare l'utente:
          </Text>
          
          {loadingCentri ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} />
              <Text style={styles.loadingText}>Caricamento centri...</Text>
            </View>
          ) : (
            <>
              {centri.length > 0 ? (
                <>
                  <View style={styles.centroList}>
                    {centri.map((centro) => (
                      <TouchableRipple
                        key={centro.id}
                        onPress={() => toggleCentro(centro.id)}
                        style={[
                          styles.centroItem,
                          selectedCentri[centro.id] && styles.centroItemSelected
                        ]}
                      >
                        <View style={styles.centroItemContent}>
                          <View style={styles.centroInfo}>
                            <Text style={styles.centroName}>{centro.nome}</Text>
                            <Text style={styles.centroAddress}>{centro.indirizzo}</Text>
                            <Chip 
                              style={styles.centroChip} 
                              textStyle={{ fontSize: 12 }}
                            >
                              {centro.tipo}
                            </Chip>
                          </View>
                          <MaterialCommunityIcons 
                            name={selectedCentri[centro.id] ? "checkbox-marked" : "checkbox-blank-outline"} 
                            size={24} 
                            color={selectedCentri[centro.id] ? PRIMARY_COLOR : "#757575"} 
                          />
                        </View>
                      </TouchableRipple>
                    ))}
                  </View>
                  <View style={styles.centroSelectedCount}>
                    <Text>
                      {Object.values(selectedCentri).filter(Boolean).length} centri selezionati
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.noCentriContainer}>
                  <MaterialCommunityIcons name="domain-off" size={64} color="#ccc" />
                  <Text style={styles.noCentriText}>Nessun centro disponibile</Text>
                </View>
              )}
            </>
          )}
          
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading || loadingCentri || centri.length === 0}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
            >
              Crea Utente
            </Button>
            <Button
              mode="outlined"
              onPress={() => router.replace('/admin/utenti')}
              disabled={loading}
              style={styles.cancelButton}
            >
              Annulla
            </Button>
          </View>
          
        </ScrollView>
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
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  sectionDescription: {
    marginBottom: 16,
    color: '#666',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  fieldLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  radioContainer: {
    marginBottom: 16,
  },
  radioItem: {
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 1,
  },
  radioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  roleAvatar: {
    marginRight: 16,
  },
  radioTextContainer: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  radioDescription: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    marginVertical: 24,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  centroList: {
    marginBottom: 16,
  },
  centroItem: {
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 1,
  },
  centroItemSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: PRIMARY_COLOR,
    borderWidth: 1,
  },
  centroItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  centroInfo: {
    flex: 1,
  },
  centroName: {
    fontSize: 16,
    fontWeight: '500',
  },
  centroAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  centroChip: {
    alignSelf: 'flex-start',
    height: 24,
  },
  centroSelectedCount: {
    alignItems: 'center',
    marginBottom: 16,
  },
  noCentriContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCentriText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 24,
  },
  submitButton: {
    marginBottom: 16,
    backgroundColor: PRIMARY_COLOR,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
  cancelButton: {
    borderColor: '#f44336',
  },
}); 




