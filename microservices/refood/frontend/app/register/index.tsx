import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ImageBackground,
  Alert,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { TextInput, Button, Text, HelperText, Card, Divider, RadioButton, Dialog, Portal, Paragraph, Title, Subheading, useTheme } from 'react-native-paper';
import { router, Link } from 'expo-router';
import { registerUser } from '../../src/services/authService';
import { PRIMARY_COLOR, VALIDAZIONI } from '../../src/config/constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import logger from '../../src/utils/logger';
import { useAuth } from '../../src/context/AuthContext';

// Tipi per il form di registrazione
interface FormDati {
  email: string;
  password: string;
  confermaPassword: string;
  nome: string;
  cognome: string;
  tipologia: 'organizzazione' | 'utente' | null;
  ruoloOrganizzazione: 'Operatore' | 'Amministratore' | 'OperatoreCentro' | null;
  tipoUtente: 'Privato' | 'Canale sociale' | 'centro riciclo' | null;
  citta: string;
  cap: string;
  telefono: string;
  via?: string;
  civico?: string;
  provincia?: string;
}

// Stato errori form
interface ErroriForm {
  email: string;
  password: string;
  confermaPassword: string;
  nome: string;
  cognome: string;
  tipologia: string;
  ruoloOrganizzazione: string;
  tipoUtente: string;
  citta: string;
  cap: string;
  telefono: string;
  via?: string;
  civico?: string;
  provincia?: string;
}

const RegisterScreen = () => {
  const { login } = useAuth();
  const theme = useTheme();
  const isDarkMode = theme.dark;

  const dynamicColors = {
    background: isDarkMode ? '#181A20' : '#f5f5f5',
    text: isDarkMode ? '#fff' : '#000',
    cardBackground: isDarkMode ? '#1e1e1e' : '#fff',
    inputBackground: isDarkMode ? '#23262F' : '#fff',
    inputOutline: PRIMARY_COLOR,
    helperText: isDarkMode ? '#ff8a80' : '#d32f2f',
    divider: isDarkMode ? '#444' : '#e0e0e0',
    logoColor: isDarkMode ? '#fff' : '#000',
  };

  const [isLoading, setIsLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Stato per i dialoghi di feedback
  const [successDialogVisible, setSuccessDialogVisible] = useState(false);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Stato del form
  const [form, setForm] = useState<FormDati>({
    email: '',
    password: '',
    confermaPassword: '',
    nome: '',
    cognome: '',
    tipologia: null, // Modificato: inizializzato a null invece di 'organizzazione'
    ruoloOrganizzazione: null,
    tipoUtente: null,
    citta: '',
    cap: '',
    telefono: '',
    via: '',
    civico: '',
    provincia: '',
  });

  // Traccia i cambiamenti nel form per debugging
  useEffect(() => {
    console.log('Form aggiornato:', {
      tipologia: form.tipologia,
      ruoloOrganizzazione: form.ruoloOrganizzazione,
      tipoUtente: form.tipoUtente
    });

    // Gestione speciale per il cognome quando cambia il tipo utente
    if (form.tipologia === 'utente' && (form.tipoUtente === 'Canale sociale' || form.tipoUtente === 'centro riciclo')) {
      setForm(prev => ({ ...prev, cognome: '' }));
      console.log('Cognome impostato a stringa vuota per tipo:', form.tipoUtente);
    }
  }, [form.tipologia, form.ruoloOrganizzazione, form.tipoUtente]);




  // Stato errori
  const [errori, setErrori] = useState<ErroriForm>({
    email: '',
    password: '',
    confermaPassword: '',
    nome: '',
    cognome: '',
    tipologia: '',
    ruoloOrganizzazione: '',
    tipoUtente: '',
    citta: '',
    cap: '',
    telefono: '',
    via: '',
    civico: '',
    provincia: '',
  });

  // Validazioni varie...
  const validateCitta = () => {
    if (form.tipologia === 'utente' && !form.citta) {
      setErrori(prev => ({ ...prev, citta: 'Città  obbligatoria' }));
      return false;
    }
    setErrori(prev => ({ ...prev, citta: '' }));
    return true;
  };

  const validateCap = () => {
    if (form.tipologia === 'utente' && !form.cap) {
      setErrori(prev => ({ ...prev, cap: 'CAP obbligatorio' }));
      return false;
    }
    setErrori(prev => ({ ...prev, cap: '' }));
    return true;
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email) {
      setErrori(prev => ({ ...prev, email: 'Email obbligatoria' }));
      return false;
    } else if (!emailRegex.test(form.email)) {
      setErrori(prev => ({ ...prev, email: 'Email non valida' }));
      return false;
    }
    setErrori(prev => ({ ...prev, email: '' }));
    return true;
  };

  const validatePassword = () => {
    if (!form.password) {
      setErrori(prev => ({ ...prev, password: 'Password obbligatoria' }));
      return false;
    } else if (form.password.length < VALIDAZIONI.PASSWORD_MIN_LENGTH) {
      setErrori(prev => ({ ...prev, password: `Password troppo corta (min ${VALIDAZIONI.PASSWORD_MIN_LENGTH} caratteri)` }));
      return false;
    }
    setErrori(prev => ({ ...prev, password: '' }));
    return true;
  };

  const validateConfermaPassword = () => {
    if (!form.confermaPassword) {
      setErrori(prev => ({ ...prev, confermaPassword: 'Conferma password obbligatoria' }));
      return false;
    } else if (form.password !== form.confermaPassword) {
      setErrori(prev => ({ ...prev, confermaPassword: 'Le password non coincidono' }));
      return false;
    }
    setErrori(prev => ({ ...prev, confermaPassword: '' }));
    return true;
  };

  const validateNome = () => {
    if (!form.nome) {
      setErrori(prev => ({ ...prev, nome: 'Nome obbligatorio' }));
      return false;
    }
    setErrori(prev => ({ ...prev, nome: '' }));
    return true;
  };

  const validateCognome = () => {
    // Cognome richiesto solo per organizzazione o utente privato
    if (
      (form.tipologia === 'organizzazione') ||
      (form.tipologia === 'utente' && form.tipoUtente === 'Privato')
    ) {
      if (!form.cognome) {
        setErrori(prev => ({ ...prev, cognome: 'Cognome obbligatorio' }));
        return false;
      }
      setErrori(prev => ({ ...prev, cognome: '' }));
      return true;
    } else {
      // Per altri tipi, il cognome non è richiesto e deve essere vuoto
      if (form.cognome) {
        setForm(prev => ({ ...prev, cognome: '' }));
      }
      setErrori(prev => ({ ...prev, cognome: '' }));
      return true;
    }
  };

  const validateTipologia = () => {
    if (!form.tipologia) {
      setErrori(prev => ({ ...prev, tipologia: 'Seleziona una tipologia' }));
      return false;
    }
    setErrori(prev => ({ ...prev, tipologia: '' }));
    return true;
  };

  const validateRuoloOrganizzazione = () => {
    if (form.tipologia === 'organizzazione' && !form.ruoloOrganizzazione) {
      setErrori(prev => ({ ...prev, ruoloOrganizzazione: 'Seleziona un ruolo' }));
      return false;
    }
    setErrori(prev => ({ ...prev, ruoloOrganizzazione: '' }));
    return true;
  };

  const validateTipoUtente = () => {
    if (form.tipologia === 'utente' && !form.tipoUtente) {
      setErrori(prev => ({ ...prev, tipoUtente: 'Seleziona un tipo utente' }));
      return false;
    }
    setErrori(prev => ({ ...prev, tipoUtente: '' }));
    return true;
  };

  const validateTelefono = () => {
    if (form.tipologia === 'utente' && !form.telefono) {
      setErrori(prev => ({ ...prev, telefono: 'Telefono obbligatorio' }));
      return false;
    }
    setErrori(prev => ({ ...prev, telefono: '' }));
    return true;
  };

  const validateVia = () => {
    if (form.tipologia === 'utente' && !form.via) {
      setErrori(prev => ({ ...prev, via: 'Via/Piazza obbligatoria' }));
      return false;
    }
    setErrori(prev => ({ ...prev, via: '' }));
    return true;
  };

  const validateCivico = () => {
    if (form.tipologia === 'utente' && !form.civico) {
      setErrori(prev => ({ ...prev, civico: 'Numero civico obbligatorio' }));
      return false;
    }
    setErrori(prev => ({ ...prev, civico: '' }));
    return true;
  };

  const validateProvincia = () => {
    if (form.tipologia === 'utente' && !form.provincia) {
      setErrori(prev => ({ ...prev, provincia: 'Provincia obbligatoria' }));
      return false;
    }
    setErrori(prev => ({ ...prev, provincia: '' }));
    return true;
  };


  // Gestione della registrazione
  const handleRegister = async () => {
    const validazioni = {
      email: validateEmail(),
      password: validatePassword(),
      confermaPassword: validateConfermaPassword(),
      nome: validateNome(),
      cognome: validateCognome(),
      tipologia: validateTipologia(),
      ruoloOrganizzazione: validateRuoloOrganizzazione(),
      tipoUtente: validateTipoUtente(),
      citta: validateCitta(),
      cap: validateCap(),
      telefono: validateTelefono(),
      via: validateVia(),
      civico: validateCivico(),
      provincia: validateProvincia(),
    } as const;

    const requireCognome =
      (form.tipologia === 'organizzazione') ||
      (form.tipologia === 'utente' && form.tipoUtente === 'Privato');

    const isValid =
      validazioni.email &&
      validazioni.password &&
      validazioni.confermaPassword &&
      validazioni.nome &&
      (!requireCognome || validazioni.cognome) &&
      validazioni.tipologia &&
      validazioni.ruoloOrganizzazione &&
      validazioni.tipoUtente &&
      validazioni.citta &&
      validazioni.cap &&
      validazioni.telefono &&
      validazioni.via &&
      validazioni.civico &&
      validazioni.provincia;

    if (!isValid) {
      const campiNonValidi = (Object.keys(validazioni) as (keyof typeof validazioni)[]).filter(k => !validazioni[k]);
      logger.log('Form non valido, campi non validi:', campiNonValidi);
      console.log('Form non valido, campi non validi:', campiNonValidi);
      Alert.alert('Attenzione', `Verifica i seguenti campi: ${campiNonValidi.join(', ')}`);
      return;
    }

    try {
      setIsLoading(true);
      let payload;
      if (form.tipologia === 'organizzazione') {
        if (!form.ruoloOrganizzazione) {
          setErrorMessage("Seleziona un ruolo per l'organizzazione.");
          setErrorDialogVisible(true);
          setIsLoading(false);
          return;
        }
        payload = {
          email: form.email,
          password: form.password,
          nome: form.nome,
          cognome: form.cognome,
          ruolo: form.ruoloOrganizzazione,
          tipologia: 'organizzazione',
          tipoUtente: null,
          indirizzo: '', // richiesto dal backend anche se vuoto
        };
      } else if (form.tipologia === 'utente') {
        const indirizzoUtente = [
          form.via,
          form.civico,
          form.cap,
          form.citta,
          form.provincia
        ]
          .filter(Boolean)
          .join(', ');

        payload = {
          email: form.email,
          password: form.password,
          nome: form.nome,
          cognome: form.cognome,
          ruolo: 'Utente',
          indirizzo: indirizzoUtente,
          tipoUtente: {
            tipo: form.tipoUtente || '',
            telefono: form.telefono,
            email: form.email,
            indirizzo: indirizzoUtente
          }
        };
      }

      if (!payload) {
        setErrorMessage('Seleziona una tipologia valida.');
        setErrorDialogVisible(true);
        setIsLoading(false);
        return;
      }

      const result = await registerUser(payload as any);
      logger.log('Risposta registrazione:', result);
      if (result && (result as any).success) {
        setSuccessDialogVisible(true);
      } else {
        const msg = (result as any)?.message || (result as any)?.data?.message || 'Registrazione fallita.';
        setErrorMessage(msg);
        setErrorDialogVisible(true);
      }
    } catch (error) {
      console.error('Errore durante la registrazione:', error);
      let msg = 'Registrazione fallita.';
      if (error instanceof Error) {
        msg = error.message;
      }
      setErrorMessage(msg);
      setErrorDialogVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler per il login automatico dopo la registrazione
  const handleAutoLogin = async () => {
    setSuccessDialogVisible(false);

    try {
      Toast.show({
        type: 'info',
        text1: 'Accesso in corso...',
        visibilityTime: 3000,
      });

      logger.log('Tentativo di login diretto dopo registrazione per:', form.email);
      const loginSuccess = await login(form.email, form.password);

      if (loginSuccess) {
        logger.log('Login automatico riuscito, redirezione alla home');

        Toast.show({
          type: 'success',
          text1: 'Benvenuto in Refood!',
          text2: 'Accesso effettuato con successo',
          visibilityTime: 4000,
        });

        setTimeout(() => {
          router.replace('/');
        }, 500);
      } else {
        throw new Error('Login automatico fallito');
      }
    } catch (loginError) {
      logger.error('Errore durante login automatico:', loginError);
      setErrorMessage('Non è stato possibile effettuare l\'accesso automatico. Verrai reindirizzato alla pagina di login.');
      setErrorDialogVisible(true);
    }
  };

  // Handler per reindirizzare alla pagina di login manuale
  const redirectToLogin = () => {
    setErrorDialogVisible(false);
    setSuccessDialogVisible(false);
    setTimeout(() => {
      router.replace({
        pathname: "/",
        params: {
          registrationSuccess: "true",
          email: form.email
        }
      });
    }, 300);
  };


  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const renderContent = () => (
    <View style={styles.mainContainer}>
      {/* Toggle rimosso */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1974&auto=format&fit=crop' }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <KeyboardAvoidingView
          enabled={Platform.OS === 'ios'}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}
          style={[styles.container, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.65)' }]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={keyboardVisible ? styles.scrollViewKeyboard : styles.scrollView}
          >
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="food-apple" size={54} color={dynamicColors.logoColor} />
              <Text style={[styles.appName, { color: dynamicColors.logoColor }]}>Refood</Text>
              <Text style={[styles.tagline, { color: dynamicColors.logoColor }]}>Unisciti a noi nella lotta contro lo spreco alimentare</Text>
            </View>

            <Card style={[styles.formCard, { backgroundColor: dynamicColors.cardBackground }]} elevation={5}>
              <Card.Content style={styles.formContainer}>
                <Title style={[styles.registerTitle, { color: PRIMARY_COLOR }]}>Registrazione</Title>
                <Divider style={[styles.divider, { backgroundColor: dynamicColors.divider }]} />

                {/* Email */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Email"
                    value={form.email}
                    onChangeText={(text) => setForm(prev => ({ ...prev, email: text }))}
                    onBlur={validateEmail}
                    error={!!errori.email}
                    style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    activeOutlineColor={dynamicColors.inputOutline}
                    left={<TextInput.Icon icon="email" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                    placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                    textColor={isDarkMode ? '#fff' : undefined}
                    theme={{
                      colors: {
                        placeholder: isDarkMode ? '#b0b0b0' : undefined,
                        onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                      },
                    }}
                  />
                  {!!errori.email && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.email}</HelperText>}
                </View>

                {/* Password */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Password"
                    value={form.password}
                    onChangeText={(text) => setForm(prev => ({ ...prev, password: text }))}
                    onBlur={validatePassword}
                    error={!!errori.password}
                    mode="outlined"
                    secureTextEntry
                    style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                    activeOutlineColor={dynamicColors.inputOutline}
                    left={<TextInput.Icon icon="lock" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                    placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                    textColor={isDarkMode ? '#fff' : undefined}
                    theme={{
                      colors: {
                        placeholder: isDarkMode ? '#b0b0b0' : undefined,
                        onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                      },
                    }}
                  />
                  {!!errori.password && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.password}</HelperText>}
                </View>

                {/* Conferma Password */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Conferma Password"
                    value={form.confermaPassword}
                    onChangeText={(text) => setForm(prev => ({ ...prev, confermaPassword: text }))}
                    onBlur={validateConfermaPassword}
                    error={!!errori.confermaPassword}
                    mode="outlined"
                    secureTextEntry
                    style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                    activeOutlineColor={dynamicColors.inputOutline}
                    left={<TextInput.Icon icon="lock-check" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                    placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                    textColor={isDarkMode ? '#fff' : undefined}
                    theme={{
                      colors: {
                        placeholder: isDarkMode ? '#b0b0b0' : undefined,
                        onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                      },
                    }}
                  />
                  {!!errori.confermaPassword && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.confermaPassword}</HelperText>}
                </View>

                {/* Nome */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Nome"
                    value={form.nome}
                    onChangeText={(text) => setForm(prev => ({ ...prev, nome: text }))}
                    onBlur={validateNome}
                    error={!!errori.nome}
                    mode="outlined"
                    style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                    activeOutlineColor={dynamicColors.inputOutline}
                    left={<TextInput.Icon icon="account" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                    placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                    textColor={isDarkMode ? '#fff' : undefined}
                    theme={{
                      colors: {
                        placeholder: isDarkMode ? '#b0b0b0' : undefined,
                        onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                      },
                    }}
                  />
                  {!!errori.nome && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.nome}</HelperText>}
                </View>

                {/* Cognome: visibile solo per organizzazione o utente privato */}
                {(!form.tipologia || form.tipologia === 'organizzazione' ||
                  (form.tipologia === 'utente' && form.tipoUtente === 'Privato')) && (
                    <View style={styles.inputWrapper}>
                      <TextInput
                        label="Cognome"
                        value={form.cognome}
                        onChangeText={(text) => setForm(prev => ({ ...prev, cognome: text }))}
                        onBlur={validateCognome}
                        error={!!errori.cognome}
                        mode="outlined"
                        style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                        activeOutlineColor={dynamicColors.inputOutline}
                        left={<TextInput.Icon icon="account" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                        placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                        textColor={isDarkMode ? '#fff' : undefined}
                        theme={{
                          colors: {
                            placeholder: isDarkMode ? '#b0b0b0' : undefined,
                            onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                          },
                        }}
                      />
                      {!!errori.cognome && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.cognome}</HelperText>}
                    </View>
                  )}

                {/* Seleziona Tipologia */}
                <Subheading style={[styles.sectionTitle, isDarkMode && { backgroundColor: '#23262F', color: '#fff' }]}>Seleziona Tipologia</Subheading>

                <View style={[
                  styles.radioContainer,
                  { backgroundColor: isDarkMode ? '#23262F' : dynamicColors.inputBackground, borderColor: isDarkMode ? '#444' : '#ddd' }
                ]}>
                  <RadioButton.Group
                    onValueChange={(value) => {
                      setForm(prev => ({
                        ...prev,
                        tipologia: value as 'organizzazione' | 'utente',
                        // reset
                        ruoloOrganizzazione: null,
                        tipoUtente: null,
                        indirizzo: '',
                        telefono: ''
                      }));
                      validateTipologia();
                    }}
                    value={form.tipologia || ''}
                  >
                    <View style={[
                      styles.radioOption,
                      { backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5', borderColor: isDarkMode ? '#444' : '#e0e0e0' }
                    ]}>
                      <RadioButton value="organizzazione" color={PRIMARY_COLOR} uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'} />
                      <Text style={[styles.radioLabel, { color: isDarkMode ? '#fff' : dynamicColors.text }]}>Organizzazione</Text>
                    </View>
                    <View style={[
                      styles.radioOption,
                      { backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5', borderColor: isDarkMode ? '#444' : '#e0e0e0' }
                    ]}>
                      <RadioButton value="utente" color={PRIMARY_COLOR} uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'} />
                      <Text style={[styles.radioLabel, { color: isDarkMode ? '#fff' : dynamicColors.text }]}>Utente</Text>
                    </View>
                  </RadioButton.Group>
                </View>
                {!!errori.tipologia && <HelperText type="error">{errori.tipologia}</HelperText>}

                {/* Organizzazione: ruoli */}
                {form.tipologia === 'organizzazione' && (
                  <View style={[styles.subSelectionContainer, { backgroundColor: dynamicColors.inputBackground, borderColor: isDarkMode ? '#444' : '#e0e0e0' }]}>
                    <Subheading style={[styles.sectionTitle, isDarkMode && { backgroundColor: '#23262F', color: '#fff' }]}>Seleziona Un Ruolo Nell'Organizzazione</Subheading>
                    <View style={[styles.radioContainer, { backgroundColor: dynamicColors.inputBackground, borderColor: isDarkMode ? '#444' : '#ddd' }]}>
                      <RadioButton.Group
                        onValueChange={(value) => {
                          setForm(prev => ({
                            ...prev,
                            ruoloOrganizzazione: value as 'Operatore' | 'Amministratore' | 'OperatoreCentro'
                          }));
                          validateRuoloOrganizzazione();
                        }}
                        value={form.ruoloOrganizzazione || ''}
                      >
                        <View style={[styles.radioOption, { backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5', borderColor: isDarkMode ? '#444' : '#e0e0e0' }]}>
                          <RadioButton value="OperatoreCentro" color={PRIMARY_COLOR} uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'} />
                          <Text style={[styles.radioLabel, { color: dynamicColors.text }]}>Centro associato</Text>
                        </View>
                        <View style={[styles.radioOption, { backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5', borderColor: isDarkMode ? '#444' : '#e0e0e0' }]}>
                          <RadioButton value="Operatore" color={PRIMARY_COLOR} uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'} />
                          <Text style={[styles.radioLabel, { color: dynamicColors.text }]}>Operatore</Text>
                        </View>
                        <View style={[styles.radioOption, { backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5', borderColor: isDarkMode ? '#444' : '#e0e0e0' }]}>
                          <RadioButton value="Amministratore" color={PRIMARY_COLOR} uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'} />
                          <Text style={[styles.radioLabel, { color: dynamicColors.text }]}>Amministratore</Text>
                        </View>
                      </RadioButton.Group>
                    </View>
                    {!!errori.ruoloOrganizzazione && <HelperText type="error">{errori.ruoloOrganizzazione}</HelperText>}
                  </View>
                )}

                {/* Utente: tipo + dati aggiuntivi */}
                {form.tipologia === 'utente' && (
                  <View style={[styles.subSelectionContainer, { backgroundColor: dynamicColors.inputBackground, borderColor: isDarkMode ? '#444' : '#e0e0e0' }]}>
                    <Subheading style={[styles.sectionTitle, isDarkMode && { backgroundColor: '#23262F', color: '#fff' }]}>Seleziona Tipo Utente</Subheading>
                    <View style={[
                      styles.radioContainer,
                      { backgroundColor: isDarkMode ? '#23262F' : dynamicColors.inputBackground, borderColor: isDarkMode ? '#444' : '#ddd' }
                    ]}>
                      <RadioButton.Group
                        onValueChange={(value) => {
                          setForm(prev => ({
                            ...prev,
                            tipoUtente: value as 'Privato' | 'Canale sociale' | 'centro riciclo'
                          }));
                          validateTipoUtente();
                        }}
                        value={form.tipoUtente || ''}
                      >
                        <View style={[
                          styles.radioOption,
                          { backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5', borderColor: isDarkMode ? '#444' : '#e0e0e0' }
                        ]}>
                          <RadioButton value="Privato" color={PRIMARY_COLOR} uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'} />
                          <Text style={[styles.radioLabel, { color: isDarkMode ? '#fff' : dynamicColors.text }]}>Privato</Text>
                        </View>
                        <View style={[
                          styles.radioOption,
                          { backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5', borderColor: isDarkMode ? '#444' : '#e0e0e0' }
                        ]}>
                          <RadioButton value="Canale sociale" color={PRIMARY_COLOR} uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'} />
                          <Text style={[styles.radioLabel, { color: isDarkMode ? '#fff' : dynamicColors.text }]}>Canale sociale</Text>
                        </View>
                        <View style={[
                          styles.radioOption,
                          { backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5', borderColor: isDarkMode ? '#444' : '#e0e0e0' }
                        ]}>
                          <RadioButton value="centro riciclo" color={PRIMARY_COLOR} uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'} />
                          <Text style={[styles.radioLabel, { color: isDarkMode ? '#fff' : dynamicColors.text }]}>Centro riciclo</Text>
                        </View>
                      </RadioButton.Group>
                    </View>
                    {!!errori.tipoUtente && <HelperText type="error">{errori.tipoUtente}</HelperText>}

                    <Subheading style={[styles.sectionTitle, isDarkMode && { backgroundColor: '#23262F', color: '#fff' }]}>Dati Aggiuntivi</Subheading>

                    {/* Via/Piazza */}
                    <TextInput
                      label="Via/Piazza"
                      value={form.via || ''}
                      onChangeText={(text) => setForm(prev => ({ ...prev, via: text }))}
                      onBlur={validateVia}
                      error={!!errori.via}
                      mode="outlined"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      left={<TextInput.Icon icon="road" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                      placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                      textColor={isDarkMode ? '#fff' : undefined}
                      theme={{
                        colors: {
                          placeholder: isDarkMode ? '#b0b0b0' : undefined,
                          onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                        },
                      }}
                    />
                    {!!errori.via && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.via}</HelperText>}

                    {/* Numero Civico */}
                    <TextInput
                      label="Numero Civico"
                      value={form.civico || ''}
                      onChangeText={(text) => setForm(prev => ({ ...prev, civico: text }))}
                      onBlur={validateCivico}
                      error={!!errori.civico}
                      mode="outlined"
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      left={<TextInput.Icon icon="home-city" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                      placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                      textColor={isDarkMode ? '#fff' : undefined}
                      theme={{
                        colors: {
                          placeholder: isDarkMode ? '#b0b0b0' : undefined,
                          onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                        },
                      }}
                    />
                    {!!errori.civico && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.civico}</HelperText>}

                    {/* Città  */}
                    <TextInput
                      label="Città "
                      value={form.citta || ''}
                      onChangeText={(text) => setForm(prev => ({ ...prev, citta: text }))}
                      onBlur={validateCitta}
                      error={!!errori.citta}
                      mode="outlined"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      left={<TextInput.Icon icon="city" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                      placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                      textColor={isDarkMode ? '#fff' : undefined}
                      theme={{
                        colors: {
                          placeholder: isDarkMode ? '#b0b0b0' : undefined,
                          onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                        },
                      }}
                    />
                    {!!errori.citta && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.citta}</HelperText>}

                    {/* Provincia */}
                    <TextInput
                      label="Provincia (sigla)"
                      value={form.provincia || ''}
                      onChangeText={(text) => setForm(prev => ({ ...prev, provincia: text }))}
                      onBlur={validateProvincia}
                      error={!!errori.provincia}
                      mode="outlined"
                      maxLength={2}
                      autoCapitalize="characters"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      left={<TextInput.Icon icon="map" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                      placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                      textColor={isDarkMode ? '#fff' : undefined}
                      theme={{
                        colors: {
                          placeholder: isDarkMode ? '#b0b0b0' : undefined,
                          onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                        },
                      }}
                    />
                    {!!errori.provincia && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.provincia}</HelperText>}

                    {/* CAP */}
                    <TextInput
                      label="CAP"
                      value={form.cap || ''}
                      onChangeText={(text) => setForm(prev => ({ ...prev, cap: text.replace(/[^0-9]/g, '') }))}
                      onBlur={validateCap}
                      error={!!errori.cap}
                      mode="outlined"
                      keyboardType="number-pad"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      left={<TextInput.Icon icon="numeric" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                      placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                      textColor={isDarkMode ? '#fff' : undefined}
                      theme={{
                        colors: {
                          placeholder: isDarkMode ? '#b0b0b0' : undefined,
                          onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                        },
                      }}
                    />
                    {!!errori.cap && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.cap}</HelperText>}

                    {/* Telefono */}
                    <TextInput
                      label="Telefono"
                      value={form.telefono || ''}
                      onChangeText={(text) => setForm(prev => ({ ...prev, telefono: text.replace(/[^0-9]/g, '') }))}
                      onBlur={validateTelefono}
                      error={!!errori.telefono}
                      mode="outlined"
                      keyboardType="phone-pad"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      left={<TextInput.Icon icon="phone" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                      placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                      textColor={isDarkMode ? '#fff' : undefined}
                      theme={{
                        colors: {
                          placeholder: isDarkMode ? '#b0b0b0' : undefined,
                          onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                        },
                      }}
                    />
                    {!!errori.telefono && <HelperText type="error" style={{ color: dynamicColors.helperText }}>{errori.telefono}</HelperText>}
                  </View>
                )}

                <Button
                  mode="contained"
                  onPress={handleRegister}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.button}
                >
                  Registrati
                </Button>

                <Link href="/" asChild>
                  <Button
                    mode="text"
                    style={styles.linkButton}
                  >
                    Hai già  un account? Accedi
                  </Button>
                </Link>
              </Card.Content>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>

      {/* Success Dialog */}
      <Portal>
        <Dialog visible={successDialogVisible} dismissable={false}>
          <Dialog.Title style={isDarkMode ? { color: '#fff' } : {}}>Registrazione Completata</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={isDarkMode ? { color: '#fff' } : {}}>Il tuo account è stato creato con successo!</Paragraph>
            <Paragraph style={isDarkMode ? { color: '#fff' } : {}}>Vuoi effettuare l'accesso automaticamente?</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={redirectToLogin} textColor={PRIMARY_COLOR}>
              <Text style={{ color: PRIMARY_COLOR, fontWeight: '600' }}>No, vai al login</Text>
            </Button>
            <Button onPress={handleAutoLogin} mode="contained">
              <Text style={{ color: '#fff', fontWeight: '600' }}>Si, accedi ora</Text>
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Error Dialog */}
      <Portal>
        <Dialog visible={errorDialogVisible} dismissable={true} onDismiss={() => setErrorDialogVisible(false)}>
          <Dialog.Title style={isDarkMode ? { color: '#fff' } : {}}>Si è verificato un errore</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={isDarkMode ? { color: '#fff' } : {}}>{errorMessage}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={redirectToLogin} textColor={PRIMARY_COLOR}>
              <Text style={{ color: PRIMARY_COLOR, fontWeight: '600' }}>Vai al login</Text>
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );

  if (Platform.OS === 'web') {
    return renderContent();
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {renderContent()}
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  // themeToggleContainer rimosso
  backgroundImage: {
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  scrollViewKeyboard: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  formCard: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  formContainer: {
    padding: 10,
  },
  registerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: PRIMARY_COLOR,
  },
  divider: {
    marginBottom: 15,
    height: 1,
    backgroundColor: PRIMARY_COLOR,
  },
  inputWrapper: {
    marginBottom: 12,
  },
  input: {
    marginBottom: 4,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 20,
    paddingVertical: 8,
    backgroundColor: PRIMARY_COLOR,
  },
  linkButton: {
    marginTop: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
    color: PRIMARY_COLOR,
    textAlign: 'center',
    backgroundColor: '#f0f8f0',
    paddingVertical: 8,
    borderRadius: 6,
  },
  radioContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 3,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  radioLabel: {
    marginLeft: 8,
    fontSize: 16,
    flex: 1,
  },
  subSelectionContainer: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectionButtonsContainer: {
    marginBottom: 20,
  },
  selectionButton: {
    marginBottom: 8,
    padding: 5,
  },
  selectionInstructions: {
    marginBottom: 8,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    fontSize: 16,
  },
});

export default RegisterScreen;



