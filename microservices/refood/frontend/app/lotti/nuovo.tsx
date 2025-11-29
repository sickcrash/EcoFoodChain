import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  HelperText,
  Appbar,
  Card,
  Divider,
  Portal,
  Modal,
  Surface,
  List,
  useTheme,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../../src/context/AuthContext';

import { createLotto, invalidateCache } from '../../src/services/lottiService';

import { PRIMARY_COLOR, RUOLI, STORAGE_KEYS } from '../../src/config/constants';

import { router } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { removeAccessToken } from '../../src/services/tokenStorage';

import Toast from 'react-native-toast-message';

import { it } from 'date-fns/locale';

import { useNotifiche } from '../../src/context/NotificheContext';

import { pushNotificationService } from '../../src/services/pushNotificationService';

import notificheService from '../../src/services/notificheService';

import logger from '../../src/utils/logger';

import { format, addDays } from 'date-fns';




const UNITA_MISURA_GROUPS = {

  'Peso': ['kg', 'g'],

  'Volume': ['l', 'ml'],

  'Quantità': ['pz'],

};











const NuovoLottoScreen = () => {

  const theme = useTheme();

  const isDark = theme.dark;

  const { user } = useAuth();

  const { refreshNotifiche } = useNotifiche();

  const [loading, setLoading] = useState(false);



  // Stati per gestire il form

  const [nome, setNome] = useState('');

  const [descrizione, setDescrizione] = useState('');

  const [quantita, setQuantita] = useState('');

  const [unitaMisura, setUnitaMisura] = useState('kg');

  const [dataScadenza, setDataScadenza] = useState<Date | null>(addDays(new Date(), 7));



  const [prezzo, setPrezzo] = useState('');

  const [luogoRitiro, setLuogoRitiro] = useState('');



  // Stati per gestire i modal

  const [showUnitaPicker, setShowUnitaPicker] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [showNativeCalendar, setShowNativeCalendar] = useState(false);




  // Stati per gestire gli errori e il caricamento

  const [errors, setErrors] = useState({

    nome: false,

    quantita: false,

    dataScadenza: false,

    prezzo: false,

  });









  // Verifica se l'utente ha i permessi necessari

  useEffect(() => {

    if (user?.ruolo !== RUOLI.OPERATORE && user?.ruolo !== RUOLI.AMMINISTRATORE) {

      Alert.alert(

        'Accesso non autorizzato',

        'Non hai i permessi per creare nuovi lotti',

        [{ text: 'OK', onPress: () => router.back() }]

      );

    }

  }, [user]);



  // Funzione per formattare le date in modo sicuro

  const formatDate = (date: Date | null) => {

    if (!date) return 'Data non impostata';



    try {

      // Verifico che la data sia valida

      if (isNaN(date.getTime())) {

        console.warn('Data non valida:', date);

        return 'Data non valida';

      }



      return format(date, 'dd/MM/yyyy', { locale: it });

    } catch (error) {

      console.error('Errore nella formattazione della data:', error);

      return 'Errore formato data';

    }

  };



  // Funzione per incrementare la data del numero di giorni specificato

  const incrementDate = (days: number) => {

    try {

      // Verifica che dataScadenza sia un oggetto Date valido

      if (dataScadenza && !isNaN(dataScadenza.getTime())) {

        // Crea una nuova data basata su dataScadenza per evitare mutazioni

        const newDate = new Date(dataScadenza);

        // Usa setDate che gestisce automaticamente il cambio di mese/anno

        newDate.setDate(newDate.getDate() + days);



        // Verifica che la nuova data sia valida

        if (!isNaN(newDate.getTime())) {

          console.log(`Data incrementata di ${days} giorni:`, newDate);

          setDataScadenza(newDate);

          validateField('dataScadenza', newDate);

          return;

        }

      }



      // Fallback in caso di errore: usa la data di oggi + incremento

      console.warn('Utilizzo data fallback per incrementDate');

      const today = new Date();

      today.setDate(today.getDate() + days);

      setDataScadenza(today);

      validateField('dataScadenza', today);

    } catch (error) {

      console.error('Errore nell\'incremento della data:', error);

      // Fallback in caso di errore: usa la data di oggi

      const today = new Date();

      today.setDate(today.getDate() + days);

      setDataScadenza(today);

      validateField('dataScadenza', today);

    }

  };



  function formatLocalDateForInput(d: Date) {

    const y = d.getFullYear();

    const m = String(d.getMonth() + 1).padStart(2, '0');

    const day = String(d.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;

  }



  // Valida un campo specifico

  const validateField = (field: string, value: any) => {

    let isValid = true;



    switch (field) {

      case 'nome':

        isValid = value.trim().length > 0;

        break;

      case 'quantita':

        isValid = !isNaN(parseFloat(value)) && parseFloat(value) > 0;

        break;

      case 'dataScadenza':

        // Non blocchiamo più date nel passato per permettere

        // l'inserimento di lotti già scaduti

        isValid = value instanceof Date && !isNaN(value.getTime());



        // Se la data è nel passato, mostriamo un'avvertenza ma permettiamo l'invio

        if (isValid && value < new Date()) {

          // Mostriamo un Toast di avviso

          Toast.show({

            type: 'info',

            text1: 'Data nel passato',

            text2: 'Stai inserendo un lotto con data di scadenza già passata. Sarà etichettato come scaduto (rosso).',

            visibilityTime: 5000,

          });

        }

        break;

      case 'prezzo':

        // Prezzo può essere vuoto (null) o un numero positivo

        isValid = value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);

        break;

    }



    setErrors(prev => ({ ...prev, [field]: !isValid }));

    return isValid;

  };



  // Valida l'intero form

  const validateForm = () => {

    const nomeValid = validateField('nome', nome);

    const quantitaValid = validateField('quantita', quantita);

    const dataValid = validateField('dataScadenza', dataScadenza);

    const prezzoValid = validateField('prezzo', prezzo);



    return nomeValid && quantitaValid && dataValid && prezzoValid;

  };



  // Invia il form per creare un nuovo lotto

  const handleSubmit = async () => {

    if (!validateForm()) {

      Alert.alert('Errore', 'Alcuni campi non sono validi. Controlla e riprova.');

      return;

    }



    setLoading(true);

    console.log('Inizio processo di creazione lotto...');



    try {

      // Verifica la validità della data prima di procedere

      if (!dataScadenza || isNaN(dataScadenza.getTime())) {

        throw new Error('Data di scadenza non valida');

      }



      // Prepara i dati del lotto

      const lottoData = {

        nome: nome.trim(),

        descrizione: (descrizione?.trim() || null),

        indirizzo: (luogoRitiro?.trim() || null),

        quantita: parseFloat(quantita),

        unita_misura: unitaMisura,

        data_scadenza: format(dataScadenza as Date, 'yyyy-MM-dd') as unknown as string,

        prezzo: prezzo ? parseFloat(prezzo) : null,

        centro_id: 1, // ID predefinito dato che il sistema non è più centralizzato

      };



      console.log('Dati lotto preparati:', JSON.stringify(lottoData, null, 2));



      // Utilizziamo la funzione del servizio

      const result = await createLotto(lottoData);



      console.log('Risultato creazione lotto:', JSON.stringify(result));



      // Importante: invalida la cache prima di navigare

      invalidateCache();



      // Feedback immediato con Toast

      Toast.show({

        type: 'success',

        text1: 'Lotto creato con successo',

        text2: 'Stai per essere reindirizzato alla lista dei lotti',

        visibilityTime: 2000,

      });



      // Gestione notifiche in background per non bloccare l'utente

      setTimeout(async () => {

        try {

          // Ottieni info sull'utente corrente

          const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

          const user = userData ? JSON.parse(userData) : null;

          const userNomeCompleto = user ? `${user.nome} ${user.cognome}` : 'Operatore';



          // Invia notifica agli amministratori del centro e crea notifica locale per l'operatore

          if (result.lotto?.id) {

            await notificheService.addNotificaToAmministratori(

              result.lotto.id,

              'Nuovo lotto creato',

              `Hai creato un nuovo lotto: ${nome} (${quantita} ${unitaMisura}), con scadenza: ${formatDate(dataScadenza)}`,

              userNomeCompleto

            );



            logger.log(`Notifica inviata agli amministratori del lotto ${result.lotto.id}`);

          } else {

            logger.warn('Impossibile inviare notifica agli amministratori: lotto_id mancante');

          }



          // Invia anche la notifica push locale

          await pushNotificationService.sendLocalNotification(

            'Nuovo lotto creato',

            `Hai creato un nuovo lotto: ${nome} (${quantita} ${unitaMisura})`,

            {

              type: 'notifica',

              subtype: 'lotto_creato',

              lottoId: result.lotto?.id || 0

            }

          );

          logger.log('Notifica push locale inviata per il nuovo lotto');



          // Aggiorna le notifiche

          if (refreshNotifiche) {

            refreshNotifiche();

          }

        } catch (notificationError) {

          logger.error('Errore nell\'invio della notifica:', notificationError);

        }

      }, 0);



      // Imposta loading a false prima di navigare

      setLoading(false);



      // Reindirizzamento diretto e immediato

      console.log('Reindirizzamento alla lista lotti...');



      // Naviga alla schermata dei lotti

      router.navigate('/(tabs)');



      // Piccola pausa e poi vai specificamente alla tab lotti

      setTimeout(() => {

        router.navigate('/(tabs)/lotti');

      }, 100);



    } catch (error: any) {

      console.error('Errore completo nella creazione del lotto:', error);

      setLoading(false);



      // Gestione errori come prima

      let errorMessage = 'Si è verificato un errore durante la creazione del lotto';

      let isAuthError = false;



      // Resto del codice di gestione errori...

      if (error.message === 'Sessione scaduta. Effettua nuovamente il login.') {

        errorMessage = error.message;

        isAuthError = true;

      } else if (error.message && error.message.includes('Non sei autorizzato')) {

        errorMessage = error.message;

        isAuthError = true;

      } else if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {

        errorMessage = 'La richiesta è scaduta. Verificare che il server sia raggiungibile.';

      } else if (error.response) {

        // Errore con risposta dal server

        console.error('Risposta errore server:', error.response.status, error.response.data);



        if (error.response.status === 401) {

          errorMessage = 'Non sei autorizzato. Effettua nuovamente il login.';

          isAuthError = true;

        } else if (error.response.data && error.response.data.message) {

          errorMessage = error.response.data.message;

          if (errorMessage.includes('Autenticazione richiesta')) {

            isAuthError = true;

          }

        } else if (error.response.status === 400) {

          errorMessage = 'Dati non validi. Verifica i campi inseriti.';

        }

      } else if (error.message) {

        errorMessage = error.message;

      }



      // Mostra l'errore con Toast invece di Alert per maggiore visibilità

      Toast.show({

        type: 'error',

        text1: 'Errore nella creazione',

        text2: errorMessage,

        visibilityTime: 3000,

      });



      if (isAuthError) {

        // Piccola pausa prima di reindirizzare per problemi di auth

        setTimeout(async () => {

          await AsyncStorage.removeItem(STORAGE_KEYS.USER_TOKEN);

          router.replace("/");

        }, 2000);

      }

    }

  };







  // Funzione per validare e convertire stringhe di data (per web datepicker)

  const validateAndParseWebDate = (dateString: string) => {

    try {

      // Verifica la format YYYY-MM-DD

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {

        throw new Error('Formato data non valido');

      }



      const parts = dateString.split('-');

      const year = parseInt(parts[0], 10);

      const month = parseInt(parts[1], 10) - 1; // 0-based in JavaScript

      const day = parseInt(parts[2], 10);



      if (isNaN(year) || isNaN(month) || isNaN(day)) {

        throw new Error('Componenti data non validi');

      }



      const date = new Date(year, month, day);



      // Verifica validità data

      if (isNaN(date.getTime())) {

        throw new Error('Data risultante non valida');

      }



      return date;

    } catch (error) {

      console.error('Errore nel parsing della data web:', error);

      return new Date(); // Fallback alla data corrente

    }

  };



  return (

    <KeyboardAvoidingView

      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}

      style={[styles.container, { backgroundColor: isDark ? '#181A20' : '#f5f5f5' }]}

    >

      <Appbar.Header style={{ backgroundColor: isDark ? '#181A20' : '#fff' }}>

        <Appbar.BackAction onPress={() => router.back()} color={isDark ? '#fff' : '#000'} />

        <Appbar.Content title="Nuovo Lotto" titleStyle={{ color: isDark ? '#fff' : '#000' }} />

      </Appbar.Header>



      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        <Surface style={[styles.infoCard, { backgroundColor: isDark ? '#23262F' : '#e3f2fd' }]}>

          <MaterialCommunityIcons name="information" size={24} color={isDark ? PRIMARY_COLOR : '#388e3c'} style={styles.infoIcon} />

          <Text style={[styles.infoCardText, { color: isDark ? PRIMARY_COLOR : '#388e3c' }]}>

            Lo stato del lotto (Verde, Arancione, Rosso) verrà calcolato automaticamente in base alla data di scadenza.

            Non è necessario specificarlo.

          </Text>

        </Surface>



        <Card style={[styles.formCard, { backgroundColor: isDark ? '#23262F' : '#fff' }]}>

          <Card.Title title="Informazioni Lotto" titleStyle={{ color: isDark ? '#fff' : undefined, fontWeight: 'bold' as const }} />

          <Card.Content>

            <TextInput

              label="Nome del lotto"

              value={nome}

              onChangeText={(text) => {

                setNome(text);

                validateField('nome', text);

              }}

              style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}

              error={errors.nome}

              mode="outlined"

              left={<TextInput.Icon icon="package-variant" color={PRIMARY_COLOR} />}

              theme={{

                colors: {

                  text: isDark ? '#fff' : '#000',

                  placeholder: isDark ? '#b0b0b0' : undefined,

                  onSurfaceVariant: isDark ? '#b0b0b0' : undefined,

                  primary: PRIMARY_COLOR,

                  background: isDark ? '#181A20' : '#fff',

                  onSurface: isDark ? '#fff' : '#000',

                },

              }}

              underlineColor={PRIMARY_COLOR}

              selectionColor={PRIMARY_COLOR}

              placeholderTextColor={isDark ? '#b0b0b0' : undefined}

              inputMode="text"

              editable

              autoCapitalize="sentences"

              placeholder="Nome del lotto"

            />

            {errors.nome && <HelperText type="error">Il nome è obbligatorio</HelperText>}



            <TextInput

              label="Descrizione"

              value={descrizione}

              onChangeText={setDescrizione}

              style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}

              mode="outlined"

              multiline

              numberOfLines={3}

              left={<TextInput.Icon icon="text" color={PRIMARY_COLOR} />}

              theme={{

                colors: {

                  text: isDark ? '#fff' : '#000',

                  placeholder: isDark ? '#b0b0b0' : undefined,

                  onSurfaceVariant: isDark ? '#b0b0b0' : undefined,

                  primary: PRIMARY_COLOR,

                  background: isDark ? '#181A20' : '#fff',

                  onSurface: isDark ? '#fff' : '#000',

                },

              }}

              underlineColor={PRIMARY_COLOR}

              selectionColor={PRIMARY_COLOR}

              placeholderTextColor={isDark ? '#b0b0b0' : undefined}

              inputMode="text"

              editable

              placeholder="Descrizione"

            />



            <View style={styles.row}>

              <TextInput

                label="Quantità"

                value={quantita}

                onChangeText={(text) => {

                  setQuantita(text);

                  validateField('quantita', text);

                }}

                keyboardType="numeric"

                style={[styles.input, styles.flex1, { backgroundColor: isDark ? '#181A20' : '#fff' }]}

                error={errors.quantita}

                mode="outlined"

                left={<TextInput.Icon icon="scale" color={PRIMARY_COLOR} />}

                theme={{

                  colors: {

                    text: isDark ? '#fff' : '#000',

                    placeholder: isDark ? '#b0b0b0' : undefined,

                    onSurfaceVariant: isDark ? '#b0b0b0' : undefined,

                    primary: PRIMARY_COLOR,

                    background: isDark ? '#181A20' : '#fff',

                    onSurface: isDark ? '#fff' : '#000',

                  },

                }}

                underlineColor={PRIMARY_COLOR}

                selectionColor={PRIMARY_COLOR}

                placeholderTextColor={isDark ? '#b0b0b0' : undefined}

                inputMode="decimal"

                editable

                placeholder="Quantità"

              />



              <Pressable

                style={styles.unitSelector}

                onPress={() => setShowUnitaPicker(true)}

              >

                <Surface style={[styles.unitDisplay, { borderColor: PRIMARY_COLOR, backgroundColor: isDark ? '#23262F' : '#fff' }]}>

                  <Text style={[styles.unitText, { color: isDark ? '#fff' : PRIMARY_COLOR }]}>{unitaMisura}</Text>

                  <MaterialCommunityIcons name="chevron-down" size={20} color={PRIMARY_COLOR} />

                </Surface>

              </Pressable>

            </View>

            {errors.quantita && <HelperText type="error">Inserisci una quantità valida</HelperText>}



            {/* Campo Prezzo */}

            <TextInput

              label="Prezzo (€)"

              value={prezzo}

              onChangeText={(text) => {

                setPrezzo(text);

                validateField('prezzo', text);

              }}

              keyboardType="numeric"

              style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}

              error={errors.prezzo}

              mode="outlined"

              left={<TextInput.Icon icon="currency-eur" color={PRIMARY_COLOR} />}

              placeholder="Prezzo (opzionale)"

              theme={{

                colors: {

                  text: isDark ? '#fff' : '#000',

                  placeholder: isDark ? '#b0b0b0' : undefined,

                  onSurfaceVariant: isDark ? '#b0b0b0' : undefined,

                  primary: PRIMARY_COLOR,

                  background: isDark ? '#181A20' : '#fff',

                  onSurface: isDark ? '#fff' : '#000',

                },

              }}

              underlineColor={PRIMARY_COLOR}

              selectionColor={PRIMARY_COLOR}

              placeholderTextColor={isDark ? '#b0b0b0' : undefined}

              inputMode="decimal"

            />

            {errors.prezzo && <HelperText type="error">Il prezzo deve essere un numero positivo o vuoto</HelperText>}



            {/* Campo Luogo di ritiro */}

            <TextInput

              label="Luogo del ritiro"

              value={luogoRitiro}

              onChangeText={setLuogoRitiro}

              style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}

              mode="outlined"

              left={<TextInput.Icon icon="map-marker" color={PRIMARY_COLOR} />}

              placeholder="Indica dove ritirare il lotto"

              theme={{

                colors: {

                  text: isDark ? '#fff' : '#000',

                  placeholder: isDark ? '#b0b0b0' : undefined,

                  onSurfaceVariant: isDark ? '#b0b0b0' : undefined,

                  primary: PRIMARY_COLOR,

                  background: isDark ? '#181A20' : '#fff',

                  onSurface: isDark ? '#fff' : '#000',

                },

              }}

              underlineColor={PRIMARY_COLOR}

              selectionColor={PRIMARY_COLOR}

              placeholderTextColor={isDark ? '#b0b0b0' : undefined}

              inputMode="text"

            />

            {errors.prezzo && <HelperText type="error">Il prezzo deve essere un numero positivo o vuoto</HelperText>}

          </Card.Content>

        </Card>



        <Card style={[styles.formCard, { backgroundColor: isDark ? '#23262F' : '#fff' }]}>

          <Card.Title title="Data di Scadenza" titleStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }} />

          <Card.Content>

            <Pressable

              onPress={() => {

                if (Platform.OS === 'web') {

                  setShowDatePicker(true);

                } else {

                  setShowDatePicker(true);

                  setShowNativeCalendar(true);

                }

              }}

              style={({ pressed }) => [

                styles.dateSelector,

                { opacity: pressed ? 0.9 : 1 }

              ]}

            >

              <Surface style={[styles.dateSurface, { backgroundColor: isDark ? '#181A20' : '#fff', borderColor: PRIMARY_COLOR }, errors.dataScadenza && styles.dateError]}>

                <Ionicons name="calendar" size={24} color={PRIMARY_COLOR} style={styles.dateIcon} />

                <View style={styles.dateTextContainer}>

                  <Text style={[styles.dateLabel, { color: PRIMARY_COLOR }]}>Data di scadenza</Text>

                  <Text style={[styles.dateValue, { color: isDark ? '#fff' : PRIMARY_COLOR }]}>{formatDate(dataScadenza)}</Text>

                </View>

                <MaterialCommunityIcons name="chevron-right" size={24} color={PRIMARY_COLOR} />

              </Surface>

            </Pressable>

            {errors.dataScadenza && <HelperText type="error">La data di scadenza deve essere futura</HelperText>}

            <Text style={[styles.infoText, { color: isDark ? '#b0b0b0' : '#666' }]}>

              È possibile inserire anche date passate per i prodotti già scaduti.

              I lotti con data di scadenza nel passato saranno automaticamente etichettati come scaduti (rosso).

            </Text>

          </Card.Content>

        </Card>

      </ScrollView>



      <View style={[styles.footer, { backgroundColor: isDark ? '#23262F' : '#fff', borderTopColor: isDark ? '#23262F' : '#e0e0e0' }]}>

        <Button

          mode="contained"

          onPress={() => router.back()}

          style={[styles.button, { backgroundColor: '#F44336' }]}

          contentStyle={styles.buttonContent}

          icon="close"

          labelStyle={{ color: isDark ? '#000' : '#fff', fontWeight: 'bold' as const }}

          theme={{ colors: { text: isDark ? '#000' : '#fff' } }}

        >

          Annulla

        </Button>

        <Button

          mode="contained"

          onPress={handleSubmit}

          style={[styles.button, styles.primaryButton, { backgroundColor: PRIMARY_COLOR }]}

          contentStyle={styles.buttonContent}

          loading={loading}

          disabled={loading}

          icon="check"

          labelStyle={{ color: isDark ? '#181A20' : '#fff', fontWeight: 'bold' as const }}

        >

          Salva

        </Button>

      </View>



      {/* Modal per selezionare l'unità di misura */}

      <Portal>

        <Modal

          visible={showUnitaPicker}

          onDismiss={() => setShowUnitaPicker(false)}

          contentContainerStyle={styles.modalContainer}

        >

          <Surface style={[styles.modalContent, { backgroundColor: isDark ? '#23262F' : '#fff', maxHeight: '95%', minHeight: 320, justifyContent: 'space-between' }]}>

            <View style={styles.modalHeader}>

              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : undefined }]}>Seleziona unità di misura</Text>

            </View>

            <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />

            <ScrollView style={styles.modalScroll}>

              {Object.entries(UNITA_MISURA_GROUPS).map(([group, units]) => (

                <View key={group}>

                  <Text style={[styles.modalGroup, { color: isDark ? '#b0b0b0' : '#666', backgroundColor: isDark ? '#181A20' : '#f5f5f5' }]}>{group}</Text>

                  {units.map(unit => (

                    <List.Item

                      key={unit}

                      title={unit}

                      titleStyle={{ color: isDark ? '#fff' : PRIMARY_COLOR, fontWeight: unit === unitaMisura ? 'bold' as const : undefined }}

                      onPress={() => {

                        setUnitaMisura(unit);

                        setShowUnitaPicker(false);

                      }}

                      left={props => <List.Icon {...props} icon={

                        unit === unitaMisura ? "check-circle" : "circle-outline"

                      } color={PRIMARY_COLOR} />}

                      style={unit === unitaMisura ? [styles.selectedItem, { backgroundColor: isDark ? '#263238' : '#e8f5e9' }] : undefined}

                    />

                  ))}

                </View>

              ))}

            </ScrollView>

            <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />

            <View style={styles.modalFooter}>

              <Button

                mode="text"

                onPress={() => setShowUnitaPicker(false)}

                labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}

              >

                Chiudi

              </Button>

            </View>

          </Surface>

        </Modal>

      </Portal>

      {Platform.OS !== 'web' && (

        <DatePickerModal

          locale="it"

          mode="single"

          visible={showNativeCalendar}

          date={(dataScadenza && !isNaN(dataScadenza.getTime()) ? dataScadenza : addDays(new Date(), 1)) || addDays(new Date(), 1)}

          onDismiss={() => setShowNativeCalendar(false)}

          onConfirm={({ date }) => {

            if (date) {

              const normalized = new Date(date.setHours(0, 0, 0, 0));

              setDataScadenza(normalized);

              validateField('dataScadenza', normalized);

            }

            setShowNativeCalendar(false);

            setShowDatePicker(false);

          }}

          validRange={{ startDate: new Date() }}

          saveLabel="Conferma"

          label="Seleziona data di scadenza"

        />

      )}



      {/* Modale per il selettore di data */}

      <Portal>

        <Modal

          visible={showDatePicker}

          onDismiss={() => setShowDatePicker(false)}

          contentContainerStyle={styles.modalContainer}

        >

          <Surface style={[styles.modalContent, { backgroundColor: isDark ? '#23262F' : '#fff', maxHeight: 480, minHeight: 320, justifyContent: 'space-between' }]}>

            <View style={styles.modalHeader}>

              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : undefined }]}>Seleziona data di scadenza</Text>

            </View>

            <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />

            <View style={[styles.datePickerContainer, { flex: 1, minHeight: 180, justifyContent: 'flex-start' }]}>

              {Platform.OS === 'web' ? (

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                  <label htmlFor="dataScadenzaWeb" style={{ color: isDark ? '#fff' : '#000', fontWeight: 'bold', marginBottom: 8, alignSelf: 'flex-start' }}>



                  </label>

                  <input

                    id="dataScadenzaWeb"

                    type="date"

                    style={{

                      border: `1px solid ${errors.dataScadenza ? '#B00020' : (isDark ? '#333' : '#ccc')}`,

                      borderRadius: 4,

                      padding: 12,

                      fontSize: 16,

                      width: '75%',

                      display: 'block',

                      marginLeft: 'auto',

                      marginRight: 'auto',

                      background: isDark ? PRIMARY_COLOR : '#fff',

                      color: isDark ? '#fff' : '#000',

                      outline: 'none',

                      boxSizing: 'border-box',

                      height: 48,

                      minHeight: 48,

                      maxHeight: 48,

                      marginBottom: 8,

                    }}

                    min={formatLocalDateForInput(new Date())}

                    value={dataScadenza ? formatLocalDateForInput(dataScadenza) : ''}

                    onChange={(e) => {

                      try {

                        console.log('Input web datestring:', e.target.value);

                        if (e.target.value) {

                          const date = validateAndParseWebDate(e.target.value);

                          setDataScadenza(date);

                          validateField('dataScadenza', date);

                        }

                      } catch (error) {

                        console.error('Errore nel date picker web:', error);

                      }

                    }}

                  />

                </div>

              ) : (

                <View style={styles.dateButtonsContainer}>

                  <Text style={[styles.dateSelectionText, { color: isDark ? '#fff' : undefined }]}>

                    Data selezionata: {formatDate(dataScadenza || new Date())}

                  </Text>

                  <View style={styles.dateButtonsRow}>

                    <Button

                      mode="outlined"

                      icon="arrow-left"

                      onPress={() => incrementDate(-1)}

                      style={styles.dateButton}

                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}

                    >

                      -1 giorno

                    </Button>

                    <Button

                      mode="outlined"

                      icon="calendar-today"

                      onPress={() => {

                        setDataScadenza(new Date());

                        validateField('dataScadenza', new Date());

                      }}

                      style={styles.dateButton}

                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}

                    >

                      Oggi

                    </Button>

                    <Button

                      mode="outlined"

                      icon="arrow-right"

                      onPress={() => incrementDate(1)}

                      style={styles.dateButton}

                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}

                    >

                      +1 giorno

                    </Button>

                  </View>

                  <View style={styles.dateButtonsRow}>

                    <Button

                      mode="outlined"

                      onPress={() => incrementDate(7)}

                      style={styles.dateButton}

                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}

                    >

                      +1 settimana

                    </Button>

                    <Button

                      mode="outlined"

                      onPress={() => incrementDate(30)}

                      style={styles.dateButton}

                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}

                    >

                      +1 mese

                    </Button>

                  </View>

                  <Button

                    mode="contained"

                    icon="calendar"

                    onPress={() => setShowNativeCalendar(true)}

                    style={styles.nativeCalendarButton}

                    labelStyle={{ color: isDark ? '#181A20' : '#fff', fontWeight: 'bold' as const }}

                  >

                    Apri calendario

                  </Button>

                </View>

              )}

            </View>

            <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />

            <View style={[styles.modalFooter, { paddingBottom: 16, paddingTop: 8, backgroundColor: 'transparent', justifyContent: 'flex-end', flexGrow: 0, flexShrink: 0 }]}>

              <Button

                mode="text"

                onPress={() => {

                  setShowNativeCalendar(false);

                  setShowDatePicker(false);

                }}

                labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}

                style={{ marginRight: 8 }}

              >

                Chiudi

              </Button>

              <Button

                mode="contained"

                onPress={() => {

                  setShowNativeCalendar(false);

                  setShowDatePicker(false);

                }}

                style={{ backgroundColor: PRIMARY_COLOR }}

                labelStyle={{ color: isDark ? '#181A20' : '#fff', fontWeight: 'bold' as const }}

              >

                Conferma

              </Button>

            </View>

          </Surface>

        </Modal>

      </Portal>

    </KeyboardAvoidingView>

  );

};



// Aggiunta dell'esportazione predefinita richiesta

export default NuovoLottoScreen;



const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: '#f5f5f5',

  } as any,

  scrollView: {

    flex: 1,

  } as any,

  scrollContent: {

    padding: 16,

    paddingBottom: 32,

  } as any,

  formCard: {

    marginBottom: 16,

    elevation: 2,

  } as any,

  infoCard: {

    backgroundColor: '#e3f2fd',

    borderRadius: 8,

    padding: 16,

    marginBottom: 16,

    flexDirection: 'row',

    alignItems: 'center',

  } as any,

  infoIcon: {

    marginRight: 12,

  } as any,

  infoCardText: {

    flex: 1,

    fontSize: 14,

    color: '#0d47a1',

  } as any,

  input: {

    marginBottom: 16,

    backgroundColor: '#fff',

  } as any,

  row: {

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 8,

  } as any,

  flex1: {

    flex: 1,

  } as any,

  unitSelector: {

    marginLeft: 8,

    alignSelf: 'flex-end',

    marginBottom: 16,

  } as any,

  unitDisplay: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 12,

    paddingVertical: 15,

    borderWidth: 1,

    borderRadius: 4,

    minWidth: 80,

  } as any,

  unitText: {

    marginRight: 4,

    fontSize: 16,

  } as any,

  selectField: {

    marginBottom: 16,

  } as any,

  selectLabel: {

    fontSize: 12,

    color: '#666',

    marginBottom: 4,

    paddingLeft: 4,

  } as any,

  selectValue: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    borderWidth: 1,

    borderColor: '#ccc',

    borderRadius: 4,

    padding: 16,

    backgroundColor: '#fff',

  } as any,

  selectPlaceholder: {

    color: '#999',

  } as any,

  errorBorder: {

    borderColor: '#B00020',

  } as any,

  dateSelector: {

    marginBottom: 8,

  } as any,

  dateSurface: {

    flexDirection: 'row',

    alignItems: 'center',

    padding: 16,

    borderWidth: 1,

    borderColor: '#ccc',

    borderRadius: 4,

    backgroundColor: '#fff',

  } as any,

  dateError: {

    borderColor: '#B00020',

  } as any,

  dateIcon: {

    marginRight: 12,

  } as any,

  dateTextContainer: {

    flex: 1,

  } as any,

  dateLabel: {

    fontSize: 12,

    color: '#666',

  } as any,

  dateValue: {

    fontSize: 16,

  } as any,

  dateButtonsContainer: {

    padding: 16,

    alignItems: 'center',

  } as any,

  dateSelectionText: {

    fontSize: 16,

    marginBottom: 16,

  } as any,

  dateButtonsRow: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    marginBottom: 8,

    width: '100%',

  } as any,

  dateButton: {

    flex: 1,

    marginHorizontal: 4,

  } as any,

  nativeCalendarButton: {

    marginTop: 12,

    alignSelf: 'flex-start',

  } as any,

  infoText: {

    fontSize: 14,

    color: '#666',

    marginTop: 8,

  } as any,

  footer: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    padding: 16,

    borderTopWidth: 1,

    borderTopColor: '#e0e0e0',

    backgroundColor: '#fff',

  } as any,

  button: {

    flex: 1,

    marginHorizontal: 4,

  } as any,

  buttonContent: {

    paddingVertical: 8,

  } as any,

  primaryButton: {

    backgroundColor: PRIMARY_COLOR,

  } as any,

  modalContainer: {

    margin: 20,

    borderRadius: 8,

    overflow: 'hidden',

  } as any,

  modalContent: {

    backgroundColor: '#fff',

    borderRadius: 8,

    maxHeight: '80%',

  } as any,

  modalHeader: {

    padding: 16,

  } as any,

  modalTitle: {

    fontSize: 18,

    fontWeight: 'bold',

  } as any,

  modalScroll: {

    maxHeight: 300,

  } as any,

  modalGroup: {

    fontSize: 14,

    fontWeight: 'bold',

    color: '#666',

    paddingHorizontal: 16,

    paddingTop: 16,

    paddingBottom: 8,

    backgroundColor: '#f5f5f5',

  } as any,

  selectedItem: {

    backgroundColor: '#e8f5e9',

  } as any,

  modalFooter: {

    flexDirection: 'row',

    justifyContent: 'flex-end',

    alignItems: 'center',

    padding: 8,

    flexGrow: 0,

    flexShrink: 0,

    backgroundColor: 'transparent',

    minHeight: 56,

  } as any,

  datePickerContainer: {

    padding: 16,

    flexGrow: 1,

    minHeight: 180,

    justifyContent: 'flex-start',

  } as any,

  webDatePicker: {

    border: '1px solid #ccc',

    borderRadius: '4px',

    padding: 12,

    fontSize: 16,

    width: '75%',

    display: 'block',

    marginLeft: 'auto',

    marginRight: 'auto',

  } as any,

  loadingContainer: {

    padding: 40,

    justifyContent: 'center',

    alignItems: 'center',

  } as any,

  loadingText: {

    fontSize: 16,

    marginTop: 16,

    color: '#666',

  } as any,

  emptyCentriContainer: {

    padding: 40,

    justifyContent: 'center',

    alignItems: 'center',

  } as any,

  noCentriText: {

    fontSize: 16,

    color: '#666',

    marginTop: 16,

    textAlign: 'center',

  } as any,

  centroListItem: {

    borderBottomWidth: 1,

    borderBottomColor: '#eee',

  } as any,

  selectedCentroItem: {

    backgroundColor: '#e8f5e9',

  } as any,

  divider: {

    marginVertical: 8,

  } as any,

}); 







