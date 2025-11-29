// Import dei moduli React e componenti UI necessari
import React, { useState } from 'react';
import { UNITA_MISURA_GROUPS, PRIMARY_COLOR, STORAGE_KEYS } from '../../src/config/constants';

import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  KeyboardAvoidingView,
  Alert,
  Pressable,
  TouchableOpacity,
  Modal as RNModal,
} from 'react-native';

import {
  Appbar,
  Text,
  TextInput,
  Button,
  Surface,
  Divider,
  Portal,
  Card,
  Modal,
  List,
  useTheme,
} from 'react-native-paper';

import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { DatePickerModal } from 'react-native-paper-dates';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { createSegnalazione } from '../../src/services/segnalazioniService';
import type { UnitaMisura, SegnalazioneInput } from '../../src/services/segnalazioniService';

import notificheService from '../../src/services/notificheService';
import { useNotifiche } from '../../src/context/NotificheContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/src/context/AuthContext';

const NuovaSegnalazioneScreen = () => {
  const theme = useTheme();
  const isDark = theme.dark;

  const [loading, setLoading] = useState(false);
  const { refreshNotifiche } = useNotifiche();
  const { user } = useAuth();

  // Stati del form
  const [nome, setNome] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [quantita, setQuantita] = useState('');
  const [unita, setUnita] = useState<UnitaMisura | ''>(''); // FIX: stato come stringa
  const [prezzo, setPrezzo] = useState('');
  const [indirizzoCentro, setIndirizzoCentro] = useState('');
  const [shelflife, setShelflife] = useState<Date | null>(addDays(new Date(), 7));

  // Gestione immagini
  const [images, setImages] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedImage = images[activeIndex];

  // Stati per gestire i modal
  const [showUnitaPicker, setShowUnitaPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNativeCalendar, setShowNativeCalendar] = useState(false);

  // Stati per gestire gli errori
  const [errors, setErrors] = useState({
    nome: false,
    descrizione: false,
    quantita: false,
    unita: false, // FIX: aggiunto
    prezzo: false,
    indirizzoCentro: false,
    shelflife: false,
  });

  const backgroundColor = isDark ? '#121212' : '#f5f5f5';
  const textColor = isDark ? '#fff' : '#000';

  const isOperatoreCentro = user?.ruolo === 'OperatoreCentro';

  if (!isOperatoreCentro) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <Text style={[styles.loadingText, { color: textColor }]}>
          Non hai il permesso per accedere a questa pagina
        </Text>
        <Button
          mode="contained"
          onPress={() => router.push('/')}
          style={{ marginTop: 12, backgroundColor: PRIMARY_COLOR }}
        >
          Torna indietro
        </Button>
      </View>
    );
  }

  // Valida un campo specifico
  const validateField = (field: string, value: any) => {
    let isValid = true;

    switch (field) {
      case 'nome':
        isValid = value.trim().length > 0;
        break;
      case 'descrizione':
        isValid = value.trim().length > 0;
        break;
      case 'quantita':
        isValid = !isNaN(parseFloat(value)) && parseFloat(value) > 0;
        break;
      case 'unita': // FIX
        isValid = typeof value === 'string' && value.length > 0;
        break;
      case 'indirizzoCentro':
        isValid = value.trim().length > 0;
        break;
      case 'prezzo':
        isValid = value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
        break;
      case 'shelflife':
        isValid = value instanceof Date && !isNaN(value.getTime());
        if (isValid && value < new Date()) {
          Toast.show({
            type: 'info',
            text1: 'Data nel passato',
            text2: 'Stai inserendo un prodotto con shelf-life già passata.',
            visibilityTime: 5000,
          });
        }
        break;
    }
    setErrors((prev) => ({ ...prev, [field]: !isValid }));
    return isValid;
  };

  // Valida l'intero form
  const validateForm = () => {
    const nomeValid = validateField('nome', nome);
    const descValid = validateField('descrizione', descrizione);
    const imgLenghtValid = images.length > 0;
    const quantitaValid = validateField('quantita', quantita);
    const unitaValid = validateField('unita', unita); // FIX
    const prezzoValid = validateField('prezzo', prezzo);
    const indirizzoCentroValid = validateField('indirizzoCentro', indirizzoCentro);
    const shelflifeValid = validateField('shelflife', shelflife);

    return (
      nomeValid &&
      descValid &&
      imgLenghtValid &&
      quantitaValid &&
      unitaValid &&
      prezzoValid &&
      indirizzoCentroValid &&
      shelflifeValid
    );
  };

  const handleSubmit = async () => {
    if (loading) return;

    const ok = validateForm();
    if (!ok) {
      Toast.show({
        type: 'error',
        text1: 'Compila tutti i campi obbligatori',
        text2: 'Aggiungi almeno una foto e correggi gli errori evidenziati.',
      });
      return;
    }

    try {
      setLoading(true);

      const payload: SegnalazioneInput = {
        nome: nome.trim(),
        descrizione: (descrizione || '').trim() || undefined,
        quantita: parseFloat(quantita),
        unitaMisura: unita as UnitaMisura, // FIX
        prezzo: prezzo === '' ? null : parseFloat(prezzo),
        indirizzoCentro: indirizzoCentro.trim(),
        shelflife: formatLocalDateForInput(shelflife!),
        images: images.map((uri) => ({ uri })),
      };

      await createSegnalazione(payload);

      Toast.show({
        type: 'success',
        text1: 'Segnalazione creata',
      });

      setTimeout(async () => {
        try {
          const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
          const user = userData ? JSON.parse(userData) : null;
          const userNomeCompleto = user ? `${user.nome} ${user.cognome}` : 'Operatore';

          await notificheService.addNotificaToAmministratori(
            null,
            'Nuova segnalazione creata',
            `È stata creata una nuova segnalazione da ${userNomeCompleto}: ${nome} (${parseFloat(
              quantita
            )} ${unita}) - Shelf-Life ${formatLocalDateForInput(shelflife!)}`,
            'Alert'
          );

          if (typeof refreshNotifiche === 'function') {
            refreshNotifiche();
          }
        } catch (notificationError) {
          console.warn('Errore invio notifica segnalazione:', notificationError);
        }
      }, 0);

      router.navigate('/(tabs)/segnalazioni');
    } catch (e: any) {
      const message =
        e?.response?.data?.message || e?.message || 'Errore durante il salvataggio';
      Toast.show({ type: 'error', text1: 'Errore', text2: String(message) });
    } finally {
      setLoading(false);
    }
  };

  // Apre il selettore immagini
  const scegliFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permesso negato', "Hai negato l'accesso alla libreria fotografica.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets) {
      const nuoveFoto = result.assets.map((asset) => asset.uri);
      const unione = [...images, ...nuoveFoto];
      if (unione.length > 6) {
        Alert.alert('Limite immagini', 'Hai selezionato troppe immagini. Verranno usate solo le prime 6.');
      }
      setImages(unione.slice(0, 6));
    }
  };

  const rimuoviImmagine = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Data non impostata';
    try {
      if (isNaN(date.getTime())) return 'Data non valida';
      return format(date, 'dd/MM/yyyy', { locale: it });
    } catch {
      return 'Errore formato data';
    }
  };

  const validateAndParseWebDate = (dateString: string) => {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) throw new Error('Formato data non valido');
      const [y, m, d] = dateString.split('-').map((p) => parseInt(p, 10));
      const date = new Date(y, m - 1, d);
      if (isNaN(date.getTime())) throw new Error('Data risultante non valida');
      return date;
    } catch {
      return new Date();
    }
  };

  function formatLocalDateForInput(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const incrementDate = (days: number) => {
    try {
      if (shelflife && !isNaN(shelflife.getTime())) {
        const newDate = new Date(shelflife);
        newDate.setDate(newDate.getDate() + days);
        if (!isNaN(newDate.getTime())) {
          setShelflife(newDate);
          validateField('shelflife', newDate);
          return;
        }
      }
      const today = new Date();
      today.setDate(today.getDate() + days);
      setShelflife(today);
      validateField('shelflife', today);
    } catch {
      const today = new Date();
      today.setDate(today.getDate() + days);
      setShelflife(today);
      validateField('shelflife', today);
    }
  };

  // --- RENDER COMPONENT ---
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: isDark ? '#181A20' : '#f5f5f5' }]}
    >
      <Appbar.Header style={{ backgroundColor: isDark ? '#181A20' : '#fff' }}>
        <Appbar.BackAction onPress={() => router.back()} color={isDark ? '#fff' : '#000'} />
        <Appbar.Content title="Nuova Segnalazione" titleStyle={{ color: isDark ? '#fff' : '#000' }} />
      </Appbar.Header>

      <ScrollView style={[styles.container, { backgroundColor: isDark ? '#181A20' : '#f5f5f5' }]}>
        <Surface style={[styles.infoCard, { backgroundColor: isDark ? '#23262F' : '#e3f2fd' }]}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={24}
            color={isDark ? PRIMARY_COLOR : '#d32f2f'}
            style={styles.infoIcon}
          />
          <Text style={[styles.infoCardText, { color: isDark ? PRIMARY_COLOR : '#d32f2f' }]}>
            Una volta aperta, una segnalazione può essere eliminata solo dopo che è stata chiusa da un amministratore.
          </Text>
        </Surface>

        <Card style={[styles.formCard, { backgroundColor: isDark ? '#23262F' : '#fff' }]}>
          <Card.Title title="Dati del Prodotto" titleStyle={{ color: isDark ? '#fff' : '#000', fontWeight: 'bold' }} />
          <Card.Content>
            <TextInput
              label="Nome del prodotto"
              value={nome}
              onChangeText={(text) => {
                setNome(text);
                validateField('nome', text);
              }}
              style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
              error={errors.nome}
              mode="outlined"
              left={<TextInput.Icon icon="tag" color={PRIMARY_COLOR} />}
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
              inputMode="text"
              editable
              autoCapitalize="sentences"
            />
            {errors.nome && (
              <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>Il nome è obbligatorio</Text>
            )}

            <Button
              mode="outlined"
              icon="image"
              onPress={scegliFoto}
              disabled={images.length >= 6}
              style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
              theme={{
                colors: {
                  text: isDark ? '#fff' : '#000',
                  onSurfaceVariant: isDark ? '#b0b0b0' : undefined,
                  primary: PRIMARY_COLOR,
                  background: isDark ? '#181A20' : '#fff',
                  onSurface: isDark ? '#fff' : '#000',
                },
              }}
            >
              Seleziona Immagini
            </Button>

            {images.length > 0 && (
              <View style={styles.imageGrid}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.imageItem}>
                    <Pressable
                      onPress={() => {
                        setActiveIndex(index);
                        setModalVisible(true);
                      }}
                      style={({ hovered }) => [
                        styles.imageWrapper,
                        Platform.OS === 'web' && hovered ? styles.imageHovered : null,
                      ]}
                    >
                      <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
                    </Pressable>
                    <TouchableOpacity onPress={() => rimuoviImmagine(index)} style={styles.removeButton}>
                      <Text style={[styles.removeButtonText, { color: isDark ? '#181A20' : '#fff' }]}>Rimuovi</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {images.length >= 6 && (
              <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                Hai raggiunto il numero massimo di immagini.
              </Text>
            )}

            <Text style={{ color: PRIMARY_COLOR, marginBottom: 8, textAlign: 'center' }}>(Dimensione foto max 20MB)</Text>

            <TextInput
              label="Descrizione"
              value={descrizione}
              onChangeText={(text) => {
                const v = text.slice(0, 400);
                setDescrizione(v);
                validateField('descrizione', v);
              }}
              onBlur={() => validateField('descrizione', descrizione)}
              style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
              mode="outlined"
              multiline
              numberOfLines={3}
              left={<TextInput.Icon icon="text" color={PRIMARY_COLOR} />}
              right={<TextInput.Affix text={`${descrizione?.length ?? 0}/400`} />}
              error={!!errors.descrizione}
              activeOutlineColor={errors.descrizione ? '#F44336' : PRIMARY_COLOR}
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
              selectionColor={PRIMARY_COLOR}
              inputMode="text"
              editable
              maxLength={400}
            />
            {errors.descrizione && (
              <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                La descrizione è obbligatoria
              </Text>
            )}

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
                inputMode="decimal"
                editable
              />

              <Pressable style={styles.unitSelector} onPress={() => setShowUnitaPicker(true)}>
                <Surface
                  style={[
                    styles.unitDisplay,
                    { borderColor: PRIMARY_COLOR, backgroundColor: isDark ? '#23262F' : '#fff' },
                  ]}
                >
                  <Text style={[styles.unitText, { color: isDark ? '#fff' : PRIMARY_COLOR }]}>
                    {unita || 'unità'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={PRIMARY_COLOR} />
                </Surface>
              </Pressable>
            </View>
            {errors.quantita && (
              <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                Inserisci una quantità valida
              </Text>
            )}
            {errors.unita && (
              <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                Seleziona un’unità di misura
              </Text>
            )}

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
              placeholder="(opzionale)"
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
            {errors.prezzo && (
              <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                Il prezzo deve essere un numero positivo o vuoto
              </Text>
            )}

            <TextInput
              label="Indirizzo del centro"
              value={indirizzoCentro}
              onChangeText={(text) => {
                setIndirizzoCentro(text);
                validateField('indirizzoCentro', text);
              }}
              style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
              error={errors.indirizzoCentro}
              mode="outlined"
              left={<TextInput.Icon icon="map-marker" color={PRIMARY_COLOR} />}
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
              inputMode="text"
            />
            {errors.indirizzoCentro && (
              <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                L'indirizzo è obbligatorio.
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card style={[styles.formCard, { backgroundColor: isDark ? '#23262F' : '#fff' }]}>
          <Card.Title title="Shelf-Life" titleStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }} />
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
              style={({ pressed }) => [styles.dateSelector, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Surface
                style={[
                  styles.dateSurface,
                  { backgroundColor: isDark ? '#181A20' : '#fff', borderColor: PRIMARY_COLOR },
                  errors.shelflife && styles.dateError,
                ]}
              >
                <Ionicons name="calendar" size={24} color={PRIMARY_COLOR} style={styles.dateIcon} />
                <View style={styles.dateTextContainer}>
                  <Text style={[styles.dateValue, { color: isDark ? '#fff' : PRIMARY_COLOR }]}>
                    {formatDate(shelflife)}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={PRIMARY_COLOR} />
              </Surface>
            </Pressable>
            <Text style={[styles.infoText, { color: isDark ? '#b0b0b0' : '#666' }]}>
              Inserire una stima della "scadenza" del prodotto che si sta segnalando.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: isDark ? '#23262F' : '#fff', borderTopColor: isDark ? '#23262F' : '#e0e0e0' },
        ]}
      >
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

      {/* Modal fullscreen immagini */}
      <RNModal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Image source={{ uri: selectedImage || '' }} style={styles.fullscreenImage} resizeMode="contain" />
          {activeIndex > 0 && (
            <TouchableOpacity onPress={() => setActiveIndex(activeIndex - 1)} style={[styles.navButton, styles.navLeft]}>
              <MaterialCommunityIcons name="chevron-left" size={32} color="#fff" />
            </TouchableOpacity>
          )}
          {activeIndex < images.length - 1 && (
            <TouchableOpacity onPress={() => setActiveIndex(activeIndex + 1)} style={[styles.navButton, styles.navRight]}>
              <MaterialCommunityIcons name="chevron-right" size={32} color="#fff" />
            </TouchableOpacity>
          )}
          <Button icon="close" mode="contained" onPress={() => setModalVisible(false)} style={styles.closeButton}>
            Chiudi
          </Button>
        </View>
      </RNModal>

      {/* Modal per selezionare l'unità di misura */}
      <Portal>
        <Modal visible={showUnitaPicker} onDismiss={() => setShowUnitaPicker(false)} contentContainerStyle={styles.modalContainer}>
          <Surface
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#23262F' : '#fff', maxHeight: '95%', minHeight: 320, justifyContent: 'space-between' },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : undefined }]}>Seleziona unità di misura</Text>
            </View>
            <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />
            <ScrollView style={styles.modalScroll}>
              {Object.entries(UNITA_MISURA_GROUPS).map(([group, units]) => (
                <View key={group}>
                  <Text
                    style={[
                      styles.modalGroup,
                      { color: isDark ? '#b0b0b0' : '#666', backgroundColor: isDark ? '#181A20' : '#f5f5f5' },
                    ]}
                  >
                    {group}
                  </Text>
                  {units.map(({ label, value }) => (
                    <List.Item
                      key={value}
                      title={label}
                      titleStyle={{ color: isDark ? '#fff' : PRIMARY_COLOR, fontWeight: unita === value ? ('bold' as const) : undefined }}
                      onPress={() => {
                        setUnita(value as UnitaMisura);
                        setShowUnitaPicker(false);
                        validateField('unita', value);
                      }}
                      left={(props) => (
                        <List.Icon
                          {...props}
                          icon={unita === value ? 'check-circle' : 'circle-outline'}
                          color={PRIMARY_COLOR}
                        />
                      )}
                      style={unita === value ? [styles.selectedItem, { backgroundColor: isDark ? '#263238' : '#e8f5e9' }] : undefined}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
            <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />
            <View style={styles.modalFooter}>
              <Button mode="text" onPress={() => setShowUnitaPicker(false)} labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}>
                Chiudi
              </Button>
            </View>
          </Surface>
        </Modal>
      </Portal>

      {/* Modale per il selettore di data */}
      <Portal>
        <Modal visible={showDatePicker} onDismiss={() => setShowDatePicker(false)} contentContainerStyle={styles.modalContainer}>
          <Surface
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#23262F' : '#fff', maxHeight: 480, minHeight: 320, justifyContent: 'space-between' },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : undefined }]}>Seleziona una data di shelf-life</Text>
            </View>
            <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />
            <View style={[styles.datePickerContainer, { flex: 1, minHeight: 180, justifyContent: 'flex-start' }]}>
              {Platform.OS === 'web' ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <label
                    htmlFor="shelflifeWeb"
                    style={{ color: isDark ? '#fff' : '#000', fontWeight: 'bold', marginBottom: 8, alignSelf: 'flex-start' }}
                  ></label>
                  <input
                    id="shelflifeWeb"
                    type="date"
                    style={{
                      border: `1px solid ${errors.shelflife ? '#B00020' : isDark ? '#333' : '#ccc'}`,
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
                    value={shelflife ? formatLocalDateForInput(shelflife) : ''}
                    onChange={(e) => {
                      try {
                        if (e.target.value) {
                          const date = validateAndParseWebDate(e.target.value);
                          setShelflife(date);
                          validateField('shelflife', date);
                        }
                      } catch {}
                    }}
                  />
                </div>
              ) : (
                <View style={styles.dateButtonsContainer}>
                  <Text style={[styles.dateSelectionText, { color: isDark ? '#fff' : undefined }]}>
                    Data selezionata: {formatDate(shelflife || new Date())}
                  </Text>
                  <View style={styles.dateButtonsRow}>
                    <Button mode="outlined" icon="arrow-left" onPress={() => incrementDate(-1)} style={styles.dateButton} labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}>
                      -1 giorno
                    </Button>
                    <Button
                      mode="outlined"
                      icon="calendar-today"
                      onPress={() => {
                        setShelflife(new Date());
                        validateField('shelflife', new Date());
                      }}
                      style={styles.dateButton}
                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}
                    >
                      Oggi
                    </Button>
                    <Button mode="outlined" icon="arrow-right" onPress={() => incrementDate(1)} style={styles.dateButton} labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}>
                      +1 giorno
                    </Button>
                  </View>
                  <View style={styles.dateButtonsRow}>
                    <Button mode="outlined" onPress={() => incrementDate(7)} style={styles.dateButton} labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}>
                      +1 settimana
                    </Button>
                    <Button mode="outlined" onPress={() => incrementDate(30)} style={styles.dateButton} labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}>
                      +1 mese
                    </Button>
                  </View>
                  <Button
                    mode="contained"
                    icon="calendar"
                    onPress={() => setShowNativeCalendar(true)}
                    style={[styles.nativeCalendarButton, { backgroundColor: PRIMARY_COLOR }]}
                    labelStyle={{ color: isDark ? '#181A20' : '#fff', fontWeight: 'bold' as const }}
                  >
                    Apri calendario
                  </Button>
                </View>
              )}
            </View>
            <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />
            <View
              style={[
                styles.modalFooter,
                { paddingBottom: 16, paddingTop: 8, backgroundColor: 'transparent', justifyContent: 'flex-end', flexGrow: 0, flexShrink: 0 },
              ]}
            >
              <Button mode="text" onPress={() => setShowDatePicker(false)} labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }} style={{ marginRight: 8 }}>
                Chiudi
              </Button>
              <Button mode="contained" onPress={() => setShowDatePicker(false)} style={{ backgroundColor: PRIMARY_COLOR }} labelStyle={{ color: isDark ? '#181A20' : '#fff', fontWeight: 'bold' as const }}>
                Conferma
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
          date={(shelflife && !isNaN(shelflife.getTime()) ? shelflife : addDays(new Date(), 1)) || addDays(new Date(), 1)}
          onDismiss={() => setShowNativeCalendar(false)}
          onConfirm={({ date }) => {
            if (date) {
              const normalized = new Date(date.setHours(0, 0, 0, 0));
              setShelflife(normalized);
              validateField('shelflife', normalized);
            }
            setShowNativeCalendar(false);
            setShowDatePicker(false);
          }}
          validRange={{ startDate: new Date() }}
          saveLabel="Conferma"
          label="Seleziona data di shelf-life"
        />
      )}
    </KeyboardAvoidingView>
  );
};

export default NuovaSegnalazioneScreen;

// --- styles identici a prima ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  formCard: { marginHorizontal: 16, marginBottom: 16, elevation: 2, borderRadius: 8 },
  infoCard: { margin: 16, padding: 16, borderRadius: 8, elevation: 2, flexDirection: 'row', alignItems: 'center' },
  infoIcon: { marginRight: 12 },
  infoCardText: { flex: 1, fontSize: 14, color: '#0d47a1' } as any,
  infoText: { flex: 1, fontSize: 14 },
  input: { marginBottom: 16, backgroundColor: '#fff' },
  dateSelector: { marginBottom: 16 },
  dateSurface: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#ccc', borderRadius: 4, backgroundColor: '#fff' },
  dateIcon: { marginRight: 12 },
  dateTextContainer: { flex: 1 },
  dateLabel: { fontSize: 12, color: '#666' },
  dateValue: { fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: '#e0e0e0', backgroundColor: '#fff' },
  button: { flex: 1, marginHorizontal: 4 },
  buttonContent: { paddingVertical: 8 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 },
  previewImage: { width: 200, height: 200, borderRadius: 8, backgroundColor: '#ccc' },
  imageItem: { alignItems: 'center', marginBottom: 12, marginHorizontal: 5 },
  imageWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 10,
    marginBottom: 10,
    ...Platform.select({ web: { cursor: 'pointer', transitionDuration: '200ms' } }),
  },
  imageHovered: { ...Platform.select({ web: { transform: [{ scale: 1.05 }], boxShadow: '0 4px 10px rgba(0,0,0,0.2)' } }) },
  removeButton: { marginTop: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#F44336', borderRadius: 6 },
  removeButtonText: { fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  fullscreenImage: { width: '100%', height: '80%', borderRadius: 8 },
  closeButton: { marginTop: 16, backgroundColor: '#F44336' },
  navButton: { position: 'absolute', top: '50%', transform: [{ translateY: -16 }], backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 30, zIndex: 20 },
  navLeft: { left: 16 },
  navRight: { right: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 } as any,
  flex1: { flex: 1 } as any,
  unitSelector: { marginLeft: 8, alignSelf: 'flex-end', marginBottom: 16 } as any,
  unitDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 15, borderWidth: 1, borderRadius: 4, minWidth: 80 } as any,
  unitText: { marginRight: 4, fontSize: 16 } as any,
  modalContainer: { margin: 20, borderRadius: 8, overflow: 'hidden' } as any,
  modalContent: { backgroundColor: '#fff', borderRadius: 8, maxHeight: '80%' } as any,
  modalHeader: { padding: 16 } as any,
  modalTitle: { fontSize: 18, fontWeight: 'bold' } as any,
  modalScroll: { maxHeight: 300 } as any,
  modalGroup: { fontSize: 14, fontWeight: 'bold', color: '#666', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: '#f5f5f5' } as any,
  selectedItem: { backgroundColor: '#e8f5e9' } as any,
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 8, flexGrow: 0, flexShrink: 0, backgroundColor: 'transparent', minHeight: 56 } as any,
  primaryButton: { backgroundColor: PRIMARY_COLOR } as any,
  dateError: { borderColor: '#B00020' } as any,
  datePickerContainer: { padding: 16, flexGrow: 1, minHeight: 180, justifyContent: 'flex-start' } as any,
  dateButtonsContainer: { padding: 16, alignItems: 'center' } as any,
  dateSelectionText: { fontSize: 16, marginBottom: 16 } as any,
  dateButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, width: '100%' } as any,
  dateButton: { flex: 1, marginHorizontal: 4 } as any,
  nativeCalendarButton: { marginTop: 12, alignSelf: 'flex-start' } as any,
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 12, fontSize: 16 },
});
