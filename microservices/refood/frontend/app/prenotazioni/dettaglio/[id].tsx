import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import {
  useTheme,
  Text,
  Card,
  Title,
  Paragraph,
  Divider,
  Appbar,
  Button,
  Chip,
  Surface,
  Portal,
  Dialog,
  TextInput,
} from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { ThemeContext } from '../../../src/context/ThemeContext';
import { useAuth } from '../../../src/context/AuthContext';
import { getPrenotazioneById, segnaComePromtaPerRitiro } from '../../../src/services/prenotazioniService';
import { registraRitiro } from '../../../src/services/registraRitiro';
import { PRIMARY_COLOR, RUOLI, BONIFICO_IBAN_LABEL } from '../../../src/config/constants';

type ThemeContextType = {
  isDarkMode?: boolean;
  toggleTheme?: () => void;
};
const DettaglioPrenotazioneScreen = () => {
  const theme = useTheme();
  const themeContext = useContext(ThemeContext) as ThemeContextType;
  const isDarkMode = !!themeContext?.isDarkMode;
  // Palette dinamica coerente con DettaglioLottoScreen
  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const textColor = isDarkMode ? '#fff' : '#000';
  const cardBackgroundColor = isDarkMode ? '#1e1e1e' : '#fff';
  const iconColor = isDarkMode ? '#fff' : (theme.colors.onBackground || '#666');
  const infoTextColor = isDarkMode ? '#fff' : '#000';
  const notesSurfaceColor = isDarkMode ? '#232323' : '#fff';
  const notesTextColor = isDarkMode ? '#fff' : '#000';
  const infoValueColor = isDarkMode ? '#fff' : '#000';
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const { id } = params;
  
  const [loading, setLoading] = useState(true);
  const [prenotazione, setPrenotazione] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Aggiungo state per gestire i dialoghi
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');
  const [dialogAction, setDialogAction] = useState<() => Promise<void>>(() => async () => {});
  const [notePreparazione, setNotePreparazione] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ritiroRegistratoLocalmente, setRitiroRegistratoLocalmente] = useState(false);

  // All'apertura, controlla se c'è un flag locale per questo id
  useEffect(() => {
    const checkLocalRitiro = async () => {
      const key = `ritiroRegistrato_${id}`;
      const value = await AsyncStorage.getItem(key);
      setRitiroRegistratoLocalmente(value === 'true');
    };
    checkLocalRitiro();
  }, [id]);

  // Quando aggiorni dal backend, se lo stato è "ritirato" E il flag locale è true, rimuovi il flag locale
  useEffect(() => {
    if (
      prenotazione &&
      (prenotazione.stato || '').toLowerCase() === 'ritirato' &&
      ritiroRegistratoLocalmente
    ) {
      const key = `ritiroRegistrato_${id}`;
      AsyncStorage.removeItem(key);
      setRitiroRegistratoLocalmente(false);
    }
  }, [prenotazione, id, ritiroRegistratoLocalmente]);
  
  // Formattazione della data
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Data non disponibile';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Data non valida';
      }
      return format(date, 'dd/MM/yyyy', { locale: it });
    } catch {
      return 'Errore data';
    }
  };
  
  // Formattazione della data con l'ora
  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'Data non disponibile';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Data non valida';
      }
      return format(date, 'dd/MM/yyyy HH:mm', { locale: it });
    } catch {
      return 'Errore data';
    }
  };
  
  // Ottiene il colore dello stato
  const getStatoColor = (stato: string) => {
    const statoLower = stato.toLowerCase();
    if (statoLower === 'prenotato' || statoLower === 'inattesa') {
      return '#FFA000'; // arancione
    } else if (statoLower === 'confermato') {
      return '#4CAF50'; // verde
    } else if (statoLower === 'intransito') {
      return '#2196F3'; // blu
    } else if (statoLower === 'consegnato') {
      return '#673AB7'; // viola
    } else if (statoLower === 'annullato') {
      return '#F44336'; // rosso
    } else if (statoLower === 'rifiutato') {
      return '#F44336'; // rosso (stesso del annullato per coerenza visiva)
    } else if (statoLower === 'eliminato') {
      return '#9E9E9E'; // grigio
    } else {
      return '#9E9E9E'; // grigio default
    }
  };
  
  // Recupera i dettagli della prenotazione
  useEffect(() => {
    const fetchPrenotazione = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Recupero dettagli prenotazione ${id}...`);
        const data = await getPrenotazioneById(parseInt(id as string, 10));
        
        console.log('Dati prenotazione ricevuti:', JSON.stringify(data));
        setPrenotazione(data);
      } catch (error: any) {
        console.error('Errore nel recupero dei dettagli della prenotazione:', error);
        setError(error.message || 'Errore nel recupero dei dettagli della prenotazione');
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: error.message || 'Impossibile recuperare i dettagli della prenotazione',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPrenotazione();
  }, [id]);
  
  // Funzione per segnare come pronta per il ritiro
  const handleProntoPerRitiro = () => {
    setDialogTitle('Conferma preparazione');
    setDialogMessage('Sei sicuro di voler segnare questa prenotazione come pronta per il ritiro?');
    setDialogAction(() => async () => {
      try {
        setIsProcessing(true);
        setDialogVisible(false);
        
        await segnaComePromtaPerRitiro(parseInt(id as string, 10), notePreparazione);
        
        Toast.show({
          type: 'success',
          text1: 'Pronta per il ritiro',
          text2: 'La prenotazione è stata segnata come pronta per il ritiro',
        });
        
        // Ricarica i dati della prenotazione
        const updatedData = await getPrenotazioneById(parseInt(id as string, 10));
        setPrenotazione(updatedData);
        
      } catch (error: any) {
        console.error('Errore nel segnare come pronta per il ritiro:', error);
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: error.message || 'Errore nel segnare come pronta per il ritiro',
        });
      } finally {
        setIsProcessing(false);
        setNotePreparazione('');
      }
    });
    setDialogVisible(true);
  };
  const handleRegistraRitiro = () => {
    setDialogTitle('Conferma ritiro');
    setDialogMessage('Sei sicuro di voler registrare il ritiro?');
    setDialogAction(() => async () => {
      setIsProcessing(true);
      setDialogVisible(false);
      setPrenotazione((prev: any) => ({
        ...prev,
        stato: 'Ritirato',
      }));
      setRitiroRegistratoLocalmente(true);
      await AsyncStorage.setItem(`ritiroRegistrato_${id}`, 'true');
      try {
        await registraRitiro(
          parseInt(id as string, 10),
          user?.nome || '',
        );
        Toast.show({
          type: 'success',
          text1: 'Ritiro registrato',
          text2: 'Il lotto è stato ritirato',
        });
        // Dopo la registrazione del ritiro, elimina il lotto dal DB
        try {
          await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/lotti/${prenotazione.lotto_id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user?.token}`,
            },
          });
          Toast.show({
            type: 'success',
            text1: 'Ritiro effettuato',
            text2: 'Il lotto è stato ritirato con successo',
          });
          // Torna indietro dopo la cancellazione
          setTimeout(() => {
            router.back();
          }, 800); // breve delay per mostrare il toast
        } catch (deleteErr) {
          Toast.show({
            type: 'error',
            text1: 'Errore eliminazione lotto',
            text2: String(deleteErr) || 'Impossibile eliminare il lotto dal database',
          });
        }
        // NON aggiornare pià¹ lo stato dal backend, la label resta sempre "Ritiro effettuato"
      } catch (error: any) {
        if (error?.response?.status === 401 || error?.message?.toLowerCase().includes('token')) {
          Toast.show({
            type: 'error',
            text1: 'Sessione scaduta',
            text2: 'Effettua di nuovo il login',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Errore',
            text2: error.message || 'Errore nel registrare il ritiro',
          });
        }
      } finally {
        setIsProcessing(false);
      }
    });
    setDialogVisible(true);
  };


  
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor }]}> 
        <Appbar.Header style={{ backgroundColor: cardBackgroundColor }}>
          <Appbar.BackAction onPress={() => router.back()} color={textColor} />
          <Appbar.Content title="Dettaglio Prenotazione" color={textColor} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={[styles.loadingText, { color: textColor }]}>Caricamento dettagli prenotazione...</Text>
        </View>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor }]}> 
        <Appbar.Header style={{ backgroundColor: cardBackgroundColor }}>
          <Appbar.BackAction onPress={() => router.back()} color={textColor} />
          <Appbar.Content title="Errore" color={textColor} />
        </Appbar.Header>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={'#F44336'} />
          <Text style={[styles.errorText, { color: '#F44336' }]}>{error}</Text>
          <Button 
            mode="contained" 
            onPress={() => router.back()}
            style={styles.errorButton}
          >
            Torna indietro
          </Button>
        </View>
      </View>
    );
  }
  
  if (!prenotazione) {
    return (
      <View style={[styles.container, { backgroundColor }]}> 
        <Appbar.Header style={{ backgroundColor: cardBackgroundColor }}>
          <Appbar.BackAction onPress={() => router.back()} color={textColor} />
          <Appbar.Content title="Prenotazione non trovata" color={textColor} />
        </Appbar.Header>
        <View style={styles.errorContainer}>
          <Ionicons name="search" size={48} color={iconColor} />
          <Text style={[styles.notFoundText, { color: textColor }]}>Prenotazione non trovata</Text>
          <Button 
            mode="contained" 
            onPress={() => router.back()}
            style={styles.errorButton}
          >
            Torna indietro
          </Button>
        </View>
      </View>
    );
  }
  
  const statoNormalized = (prenotazione.stato || '').toLowerCase();
  const statoColor = getStatoColor(prenotazione.stato);
  const canMarkReadyForPickup = !ritiroRegistratoLocalmente && ['prenotato', 'confermato'].includes(statoNormalized);
  const canRegisterPickup = !ritiroRegistratoLocalmente && ['prontoperritiro', 'confermato'].includes(statoNormalized);
  const canShowActions = user?.ruolo !== RUOLI.AMMINISTRATORE && !isProcessing && (canMarkReadyForPickup || canRegisterPickup);
  
  return (
    <View style={[styles.container, { backgroundColor }]}> 
      <Appbar.Header style={{ backgroundColor: cardBackgroundColor }}>
        <Appbar.BackAction onPress={() => router.back()} color={textColor} />
        <Appbar.Content title="Dettaglio Prenotazione" color={textColor} />
      </Appbar.Header>
      <ScrollView style={styles.scrollView}>
        <Card style={[styles.card, { backgroundColor: cardBackgroundColor }]}> 
          <Card.Content>
            <View style={styles.headerRow}>
              <Title style={{ color: textColor }}>{prenotazione.prodotto || 'Lotto non disponibile'}</Title>
              <Chip 
                style={{ backgroundColor: ritiroRegistratoLocalmente ? '#4CAF5020' : `${statoColor}20` }}
                textStyle={{ color: ritiroRegistratoLocalmente ? '#4CAF50' : statoColor }}
              >
                {ritiroRegistratoLocalmente
                  ? 'Ritiro effettuato'
                  : prenotazione.stato.toLowerCase() === 'ritirato'
                    ? 'Ritiro effettuato'
                    : prenotazione.stato.toLowerCase() === 'prenotato'
                      ? 'In attesa'
                      : prenotazione.stato}
              </Chip>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Dettagli del Lotto</Text>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="cube-outline" size={20} color={iconColor} />
                <Text style={[styles.infoText, { color: infoTextColor }]}> 
                  Quantità : <Text style={[styles.infoValue, { color: infoValueColor }]}>{prenotazione.quantita} {prenotazione.unita_misura}</Text>
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="calendar" size={20} color={iconColor} />
                <Text style={[styles.infoText, { color: infoTextColor }]}> 
                  Scadenza: <Text style={[styles.infoValue, { color: infoValueColor }]}>{formatDate(prenotazione.data_scadenza)}</Text>
                </Text>
              </View>
              {/* Visualizzazione prezzo solo se presente */}
              {prenotazione.prezzo !== undefined && prenotazione.prezzo !== null && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="currency-eur" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}> 
                    Prezzo: <Text style={[styles.infoValue, { color: infoValueColor }]}>{parseFloat(String(prenotazione.prezzo)).toFixed(2)}  EUR</Text>
                  </Text>
                </View>
              )}
              {/* Visualizzazione tipo pagamento solo se presente */}
              {prenotazione.tipo_pagamento && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="credit-card" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}> 
                    Metodo di Pagamento: <Text style={[styles.infoValue, { color: infoValueColor }]}> 
                      {prenotazione.tipo_pagamento === 'contanti' ? 'Contanti' : BONIFICO_IBAN_LABEL}
                    </Text>
                  </Text>
                </View>
              )}
            </View>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Dettagli della Prenotazione</Text>
              {/* Creatore e aggiornamento */}
              {(prenotazione.creatore_nome || prenotazione.creatore_cognome) && (
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}> 
                    Creato da: <Text style={[styles.infoValue, { color: infoValueColor }]}>{`${prenotazione.creatore_nome || ''} ${prenotazione.creatore_cognome || ''}`.trim()}</Text>
                  </Text>
                </View>
              )}
              {prenotazione.updated_at && (
                <View style={styles.infoRow}>
                  <Ionicons name="refresh" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}> 
                    Ultimo aggiornamento: <Text style={[styles.infoValue, { color: infoValueColor }]}>{formatDateTime(prenotazione.updated_at)}</Text>
                  </Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Ionicons name="home-outline" size={20} color={iconColor} />
                <Text style={[styles.infoText, { color: infoTextColor }]}> 
                  Da: <Text style={[styles.infoValue, { color: infoValueColor }]}>{prenotazione.centro_origine_nome || 'Centro origine sconosciuto'}</Text>
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color={iconColor} />
                <Text style={[styles.infoText, { color: infoTextColor }]}> 
                  A: <Text style={[styles.infoValue, { color: infoValueColor }]}>{prenotazione.centro_ricevente_nome || 'Centro destinazione sconosciuto'}</Text>
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color={iconColor} />
                <Text style={[styles.infoText, { color: infoTextColor }]}> 
                  Data prenotazione: <Text style={[styles.infoValue, { color: infoValueColor }]}>{formatDateTime(prenotazione.data_prenotazione)}</Text>
                </Text>
              </View>
              {prenotazione.data_ritiro && (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}> 
                    Data ritiro prevista: <Text style={[styles.infoValue, { color: infoValueColor }]}>{formatDate(prenotazione.data_ritiro)}</Text>
                  </Text>
                </View>
              )}
              {prenotazione.data_consegna && (
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}> 
                    Data consegna: <Text style={[styles.infoValue, { color: infoValueColor }]}>{formatDateTime(prenotazione.data_consegna)}</Text>
                  </Text>
                </View>
              )}
              {prenotazione.note && (
                <View style={styles.notesContainer}>
                  <Text style={[styles.notesLabel, { color: infoTextColor }]}>Note:</Text>
                  <Surface style={[styles.notesSurface, { backgroundColor: notesSurfaceColor }] }>
                    <Text style={[styles.notesText, { color: notesTextColor }]}>{prenotazione.note}</Text>
                  </Surface>
                </View>
              )}
            </View>
            {/* Sezione Trasporto, se disponibile */}
            {prenotazione.trasporto && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>Dettagli del Trasporto</Text>
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="truck-outline" size={20} color={iconColor} />
                    <Text style={[styles.infoText, { color: infoTextColor }]}> 
                      Mezzo: <Text style={[styles.infoValue, { color: infoValueColor }]}>{prenotazione.trasporto.mezzo || 'Non specificato'}</Text>
                    </Text>
                  </View>
                  {prenotazione.trasporto.autista && (
                    <View style={styles.infoRow}>
                      <Ionicons name="person-outline" size={20} color={iconColor} />
                      <Text style={[styles.infoText, { color: infoTextColor }]}> 
                        Autista: <Text style={[styles.infoValue, { color: infoValueColor }]}>{prenotazione.trasporto.autista}</Text>
                      </Text>
                    </View>
                  )}
                  {prenotazione.trasporto.telefono_autista && (
                    <View style={styles.infoRow}>
                      <Ionicons name="call-outline" size={20} color={iconColor} />
                      <Text style={[styles.infoText, { color: infoTextColor }]}> 
                        Telefono: <Text style={[styles.infoValue, { color: infoValueColor }]}>{prenotazione.trasporto.telefono_autista}</Text>
                      </Text>
                    </View>
                  )}
                  {prenotazione.trasporto.distanza_km && (
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="road-variant" size={20} color={iconColor} />
                      <Text style={[styles.infoText, { color: infoTextColor }]}> 
                        Distanza: <Text style={[styles.infoValue, { color: infoValueColor }]}>{prenotazione.trasporto.distanza_km} km</Text>
                      </Text>
                    </View>
                  )}
                  {prenotazione.trasporto.orario_partenza && (
                    <View style={styles.infoRow}>
                      <Ionicons name="time-outline" size={20} color={iconColor} />
                      <Text style={[styles.infoText, { color: infoTextColor }]}> 
                        Partenza: <Text style={[styles.infoValue, { color: infoValueColor }]}>{formatDateTime(prenotazione.trasporto.orario_partenza)}</Text>
                      </Text>
                    </View>
                  )}
                  {prenotazione.trasporto.orario_arrivo && (
                    <View style={styles.infoRow}>
                      <Ionicons name="flag-outline" size={20} color={iconColor} />
                      <Text style={[styles.infoText, { color: infoTextColor }]}> 
                        Arrivo: <Text style={[styles.infoValue, { color: infoValueColor }]}>{formatDateTime(prenotazione.trasporto.orario_arrivo)}</Text>
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
      {/* Aggiungo il dialog per la conferma */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={{ backgroundColor: cardBackgroundColor }}>
          <Dialog.Title style={{ color: textColor }}>{dialogTitle}</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ color: infoTextColor }}>{dialogMessage}</Paragraph>
            {dialogTitle === 'Conferma preparazione' && (
              <TextInput
                label="Note (opzionale)"
                value={notePreparazione}
                onChangeText={setNotePreparazione}
                mode="outlined"
                style={{ marginTop: 16, backgroundColor: notesSurfaceColor, color: textColor }}
                placeholder="Aggiungi note sulla preparazione"
                multiline
                theme={{ colors: { text: textColor, placeholder: isDarkMode ? '#bbb' : '#666' } }}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setDialogVisible(false)} style={styles.dialogButton}>
              Annulla
            </Button>
            <Button 
              onPress={() => dialogAction()} 
              loading={isProcessing}
              disabled={isProcessing}
              mode="contained" 
              style={styles.dialogButton}
            >
              Conferma
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {/* Pulsante per "Registra ritiro" */}
      {canShowActions && (
        <View style={styles.actionsContainer}>
          {canMarkReadyForPickup && (
            <Button
              mode="outlined"
              icon="clipboard-check-outline"
              style={[styles.actionButton, styles.secondaryActionButton]}
              textColor={PRIMARY_COLOR}
              onPress={handleProntoPerRitiro}
            >
              Segna pronta per il ritiro
            </Button>
          )}
          {canRegisterPickup && (
            <Button
              mode="contained"
              icon="cart-arrow-down"
              style={[styles.actionButton, styles.primaryActionButton]}
              onPress={handleRegistraRitiro}
            >
              Registra Ritiro
            </Button>
          )}
        </View>
      )}
      {/* Mostra sempre la label "Ritiro effettuato" se ritiroRegistratoLocalmente è true */}
      {ritiroRegistratoLocalmente && (
        <View style={{ position: 'absolute', bottom: 30, right: 20, backgroundColor: '#4CAF5020', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10 }}>
          <Text style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: 16 }}>Ritiro effettuato</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor dinamico
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    // color dinamico
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    // color dinamico
    textAlign: 'center',
    marginBottom: 20,
  },
  notFoundText: {
    marginTop: 16,
    fontSize: 16,
    // color dinamico
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    marginTop: 10,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    // color dinamico
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 16,
    // color dinamico
  },
  infoValue: {
    fontWeight: 'bold',
  },
  notesContainer: {
    marginTop: 12,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    // color dinamico
  },
  notesSurface: {
    padding: 12,
    borderRadius: 8,
    elevation: 1,
  },
  notesText: {
    fontSize: 14,
    // color dinamico
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    gap: 12,
    alignItems: 'flex-end',
  },
  actionButton: {
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  primaryActionButton: {
    backgroundColor: PRIMARY_COLOR,
    elevation: 4,
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    backgroundColor: 'transparent',
  },
  dialogActions: {
    justifyContent: 'flex-end',
    padding: 8,
  },
  dialogButton: {
    marginLeft: 8,
  },
});

export default DettaglioPrenotazioneScreen;

























