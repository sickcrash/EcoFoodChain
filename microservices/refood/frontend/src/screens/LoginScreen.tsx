import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, Animated, Keyboard } from 'react-native';
import { TextInput, Button, Text, HelperText, Card, Divider, Banner, useTheme, Switch, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { PRIMARY_COLOR, SUPPORT_EMAIL, API_URL, VALIDAZIONI } from '../config/constants';
import Toast from 'react-native-toast-message';
import logger from '../utils/logger';
import { useLocalSearchParams, router } from 'expo-router';
import { ThemeContext } from '../context/ThemeContext';

const LoginScreen = () => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { login, error, clearError, isLoading, isAuthenticated } = useAuth();
  const [fadeAnim] = useState(new Animated.Value(0));
  const params = useLocalSearchParams();
  
  const [showRegistrationBanner, setShowRegistrationBanner] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [resetVerificationName, setResetVerificationName] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [showResetNew, setShowResetNew] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // --- Modifiche per il tema ---
  const theme = useTheme();
  const isDarkMode = theme.dark;
  const { toggleTheme } = useContext(ThemeContext);

  const dynamicColors = {
    background: theme.colors.background,
    text: isDarkMode ? '#fff' : '#000',
    cardBackground: isDarkMode ? '#1e1e1e' : '#fff',
    inputBackground: isDarkMode ? '#333' : '#fff',
    inputOutline: PRIMARY_COLOR,
  helperText: isDarkMode ? '#ff8a80' : '#d32f2f',
  divider: isDarkMode ? '#444' : '#e0e0e0',
  bannerBackground: isDarkMode ? '#28a745' : '#e6ffe6',
  bannerText: isDarkMode ? '#fff' : '#000',
  logoColor: isDarkMode ? '#fff' : '#000',
};

  useEffect(() => {
    logger.log('LoginScreen - isAuthenticated cambiato:', isAuthenticated);
    if (isAuthenticated) {
      logger.log('LoginScreen - Utente autenticato, dovrebbe reindirizzare automaticamente');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (error) {
      Toast.show({
        type: "error",
        position: "bottom",
        text1: "Accesso non riuscito",
        text2: error,
        visibilityTime: 4000,
        autoHide: true,
      });
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [error, fadeAnim]);

  useEffect(() => {
    if (params.registrationSuccess === 'true') {
      setShowRegistrationBanner(true);
      Toast.show({
        type: 'success',
        text1: 'Registrazione completata con successo!',
        text2: 'Inserisci le tue credenziali per accedere',
        visibilityTime: 6000,
        position: 'top',
      });
      if (params.email && typeof params.email === 'string') {
        setEmail(params.email);
      }
    }
  }, [params]);

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('L\'email e obbligatoria');
      return false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Inserisci un indirizzo email valido');
      return false;
    } else {
      setEmailError('');
      return true;
    }
  };

  const validatePassword = () => {
    if (!password) {
      setPasswordError('La password e obbligatoria');
      return false;
    } else if (password.length < 6) {
      setPasswordError(`La password deve contenere almeno ${VALIDAZIONI.PASSWORD_MIN_LENGTH} caratteri`);
      return false;
    } else {
      setPasswordError('');
      return true;
    }
  };

  const handleLogin = async () => {
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();

    if (isEmailValid && isPasswordValid) {
      logger.log('LoginScreen - Tentativo di login con:', email);
      const success = await login(email, password);
      logger.log('LoginScreen - Risultato login:', success ? 'successo' : 'fallito');
      if (success) {
        logger.log('LoginScreen - Login riuscito, _layout gestirÂ  la navigazione automaticamente');
      }
    }
  };

  const openResetDialog = () => {
    setResetEmail(email.trim());
    setResetPhone('');
    setResetVerificationName('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetError(null);
    setShowResetNew(false);
    setShowResetConfirm(false);
    setResetDialogVisible(true);
  };

  const closeResetDialog = () => {
    setResetDialogVisible(false);
    setResetLoading(false);
    setResetError(null);
    setResetVerificationName('');
  };

  const handleResetPassword = async () => {
    const trimmedEmail = resetEmail.trim();
    const normalizedPhone = (resetPhone || '').replace(/[^0-9+]/g, '').trim();
    const normalizedVerification = resetVerificationName
      ? resetVerificationName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim()
      : '';

    if (!trimmedEmail) {
      setResetError('Inserisci l\'email associata all\'account.');
      return;
    }
    if (!normalizedPhone && !normalizedVerification) {
      setResetError('Inserisci il numero di telefono registrato oppure il nome e cognome usati in fase di registrazione.');
      return;
    }
    if (normalizedPhone && normalizedPhone.length < 6) {
      setResetError('Inserisci il numero di telefono fornito in fase di registrazione.');
      return;
    }
    if (resetNewPassword.length < 8) {
      setResetError('La nuova password deve contenere almeno 8 caratteri.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Le nuove password non coincidono.');
      return;
    }

    setResetLoading(true);
    setResetError(null);

    try {
      const payload: Record<string, string> = {
        email: trimmedEmail,
        nuova_password: resetNewPassword,
      };
      if (normalizedPhone) {
        payload.telefono = normalizedPhone;
      }
      if (resetVerificationName.trim()) {
        payload.verifica_nome = resetVerificationName.trim();
      }

      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json?.message || 'Impossibile aggiornare la password.');
      }

      setPassword(resetNewPassword);
      setEmail(trimmedEmail);
      setResetVerificationName('');
      Toast.show({
        type: 'success',
        text1: 'Password aggiornata',
        text2: 'Ora puoi accedere con le nuove credenziali',
        visibilityTime: 4000,
      });
      setResetDialogVisible(false);
    } catch (resetErr: any) {
      const message = resetErr?.message || 'Impossibile aggiornare la password.';
      const contactSuffix = SUPPORT_EMAIL
        ? ` Per assistenza scrivi a ${SUPPORT_EMAIL}.`
        : ' Contatta l\'amministratore di sistema.';
      setResetError(message.includes('supporto') || message.includes('telefono') ? message : `${message}${contactSuffix}`);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      {/* Interruttore tema (stile come in Profilo) */}
      <View style={styles.themeToggleContainer}>
        <MaterialCommunityIcons
          name={isDarkMode ? 'weather-night' : 'white-balance-sunny'}
          size={20}
          color={isDarkMode ? '#fff' : '#333'}
          style={{ marginRight: 6 }}
        />
        <Switch value={isDarkMode} onValueChange={toggleTheme} color={PRIMARY_COLOR} />
      </View>
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1974&auto=format&fit=crop' }} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <KeyboardAvoidingView
          enabled={Platform.OS === 'ios'}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 48 : 0}
          style={[styles.container, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.65)' }]} // Oscura di piu lâ€™immagine per dark mode
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={keyboardVisible ? styles.scrollViewKeyboard : styles.scrollView}
          >
            {/* Banner di registrazione completata */}
            {showRegistrationBanner && (
              <Banner
                visible={showRegistrationBanner}
                actions={[
                  {
                    label: 'OK',
                    onPress: () => setShowRegistrationBanner(false),
                    labelStyle: { color: PRIMARY_COLOR }, // Assicurati che il testo del bottone sia leggibile
                  },
                ]}
                icon={({size}) => (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={size}
                    color={PRIMARY_COLOR} // Colore icona banner
                  />
                )}
                style={[styles.registrationBanner, { backgroundColor: dynamicColors.bannerBackground }]}
              >
                <Text style={[styles.bannerTitle, { color: dynamicColors.bannerText }]}>Registrazione completata con successo!</Text>
                <Text style={{ color: dynamicColors.bannerText }}>Ora puoi accedere con le tue credenziali.</Text>
              </Banner>
            )}
            
            <View style={styles.logoContainer}>
              {/* Lâ€™icona food-apple rimane bianca per contrasto con lâ€™immagine di sfondo */}
              <MaterialCommunityIcons name="food-apple" size={64} color={dynamicColors.logoColor} /> 
              <Text style={[styles.appName, { color: dynamicColors.logoColor }]}>Refood</Text>
              <Text style={[styles.tagline, { color: dynamicColors.logoColor }]}>Riduci lo spreco alimentare</Text>
            </View>

            <Card style={[styles.formCard, { backgroundColor: dynamicColors.cardBackground }]} elevation={5}>
              <Card.Content style={styles.formContainer}>
                <Text style={[styles.loginTitle, { color: PRIMARY_COLOR }]}>Accedi</Text> {/* Mantieni PRIMARY_COLOR per il titolo */}
                <Divider style={[styles.divider, { backgroundColor: dynamicColors.divider }]} />
                
                {/* Campo email comune per entrambi */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    onBlur={validateEmail}
                    error={!!emailError}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                    mode="outlined"
                    outlineColor={dynamicColors.inputOutline}
                    activeOutlineColor={dynamicColors.inputOutline}
                    textColor={dynamicColors.text}
                    left={<TextInput.Icon icon="email" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                    placeholder="Email"
                    placeholderTextColor={isDarkMode ? '#b0b0b0' : '#888'}
                    theme={{
                      colors: {
                        placeholder: isDarkMode ? '#b0b0b0' : '#888',
                        onSurfaceVariant: isDarkMode ? '#b0b0b0' : '#888',
                      },
                    }}
                  />
                  {emailError ? <HelperText type="error" style={{ color: dynamicColors.helperText }}>{emailError}</HelperText> : null}
                </View>

                {/* Campo password comune per entrambi */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    onBlur={validatePassword}
                    secureTextEntry={!passwordVisible}
                    error={!!passwordError}
                    style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                    mode="outlined"
                    outlineColor={dynamicColors.inputOutline}
                    activeOutlineColor={dynamicColors.inputOutline}
                    textColor={dynamicColors.text}
                    left={<TextInput.Icon icon="lock" color={isDarkMode ? '#fff' : dynamicColors.text} />}
                    right={
                      <TextInput.Icon
                        icon={passwordVisible ? 'eye-off' : 'eye'}
                        onPress={() => setPasswordVisible(!passwordVisible)}
                        color={isDarkMode ? '#fff' : dynamicColors.text}
                      />
                    }
                    placeholder="Password"
                    placeholderTextColor={isDarkMode ? '#b0b0b0' : '#888'}
                    theme={{
                      colors: {
                        placeholder: isDarkMode ? '#b0b0b0' : '#888',
                        onSurfaceVariant: isDarkMode ? '#b0b0b0' : '#888',
                      },
                    }}
                  />
                  {passwordError ? <HelperText type="error" style={{ color: dynamicColors.helperText }}>{passwordError}</HelperText> : null}
                </View>

                {/* Pulsante di azione */}
                <Button
                  mode="contained"
                  onPress={handleLogin}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.actionButton}
                  buttonColor={PRIMARY_COLOR}
                  icon="login"
                >
                  <Text style={styles.actionButtonLabel}>Accedi</Text>
                </Button>
                
                {/* Link per password dimenticata solo per login (cliccabile, nessuna azione) */}
                <Button
                  mode="text"
                  onPress={openResetDialog}
                  style={styles.forgotPasswordButton}
                >
                  <Text style={styles.textButtonLabel}>Password dimenticata?</Text>
                </Button>
                
                {/* Toggle tra login e registrazione (usa router.push per evitare redirect assoluti nel web) */}
                <Button
                  mode="text"
                  style={styles.toggleModeButton}
                  onPress={() => {
                    logger.log('LoginScreen - Cliccato su "Registrati"');
                    if (Platform.OS === 'web') {
                      try {
                        const w = window as any;
                        const hasPort = !!w?.location?.port;
                        if (!hasPort && w?.location?.hostname === 'localhost') {
                          // Se si è finiti su localhost senza porta, forza 8080
                          const origin = `http://localhost:8080`;
                          w.location.href = new URL('/register', origin).toString();
                          return;
                        }
                      } catch {}
                    }
                    router.push('/register');
                  }}
                >
                  <Text style={styles.textButtonLabel}>Non hai un account? Registrati</Text>
                </Button>
              </Card.Content>
            </Card>
            
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: dynamicColors.logoColor }]}>Copyright 2025 Refood App - Tutti i diritti riservati</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>

      <Portal>
        <Dialog
          visible={resetDialogVisible}
          onDismiss={closeResetDialog}
          style={[styles.resetDialog, { backgroundColor: dynamicColors.cardBackground }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: dynamicColors.text }]}>Reimposta password</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Email"
              mode="outlined"
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { color: dynamicColors.text }]}
              theme={{
                colors: {
                  background: dynamicColors.inputBackground,
                  surface: dynamicColors.inputBackground,
                  onSurfaceVariant: isDarkMode ? '#ccc' : '#666',
                  outline: dynamicColors.divider,
                  primary: PRIMARY_COLOR,
                  text: dynamicColors.text,
                  placeholder: isDarkMode ? '#bbbbbb' : '#888888',
                },
              }}
            />
            <TextInput
              label="Telefono registrato"
              mode="outlined"
              value={resetPhone}
              onChangeText={(text) => setResetPhone(text.replace(/[^0-9+]/g, ''))}
              keyboardType="phone-pad"
              style={[styles.input, { color: dynamicColors.text }]}
              theme={{
                colors: {
                  background: dynamicColors.inputBackground,
                  surface: dynamicColors.inputBackground,
                  onSurfaceVariant: isDarkMode ? '#ccc' : '#666',
                  outline: dynamicColors.divider,
                  primary: PRIMARY_COLOR,
                  text: dynamicColors.text,
                  placeholder: isDarkMode ? '#bbbbbb' : '#888888',
                },
              }}
            />
            <TextInput
              label="Nome completo registrato"
              mode="outlined"
              value={resetVerificationName}
              onChangeText={setResetVerificationName}
              autoCapitalize="words"
              style={[styles.input, { color: dynamicColors.text }]}
              theme={{
                colors: {
                  background: dynamicColors.inputBackground,
                  surface: dynamicColors.inputBackground,
                  onSurfaceVariant: isDarkMode ? '#ccc' : '#666',
                  outline: dynamicColors.divider,
                  primary: PRIMARY_COLOR,
                  text: dynamicColors.text,
                  placeholder: isDarkMode ? '#bbbbbb' : '#888888',
                },
              }}
              placeholder="Es. Maria Rossi"
            />
            <HelperText type="info" visible style={{ color: dynamicColors.helperText, marginBottom: 12 }}>
              Inserisci il nome completo se non ricordi il telefono.
            </HelperText>
            <TextInput
              label="Nuova password"
              mode="outlined"
              value={resetNewPassword}
              onChangeText={setResetNewPassword}
              secureTextEntry={!showResetNew}
              right={
                <TextInput.Icon
                  icon={showResetNew ? 'eye-off' : 'eye'}
                  onPress={() => setShowResetNew((prev) => !prev)}
                />
              }
              style={[styles.input, { color: dynamicColors.text }]}
              theme={{
                colors: {
                  background: dynamicColors.inputBackground,
                  surface: dynamicColors.inputBackground,
                  onSurfaceVariant: isDarkMode ? '#ccc' : '#666',
                  outline: dynamicColors.divider,
                  primary: PRIMARY_COLOR,
                  text: dynamicColors.text,
                  placeholder: isDarkMode ? '#bbbbbb' : '#888888',
                },
              }}
            />
            <TextInput
              label="Conferma nuova password"
              mode="outlined"
              value={resetConfirmPassword}
              onChangeText={setResetConfirmPassword}
              secureTextEntry={!showResetConfirm}
              right={
                <TextInput.Icon
                  icon={showResetConfirm ? 'eye-off' : 'eye'}
                  onPress={() => setShowResetConfirm((prev) => !prev)}
                />
              }
              style={[styles.input, { color: dynamicColors.text }]}
              theme={{
                colors: {
                  background: dynamicColors.inputBackground,
                  surface: dynamicColors.inputBackground,
                  onSurfaceVariant: isDarkMode ? '#ccc' : '#666',
                  outline: dynamicColors.divider,
                  primary: PRIMARY_COLOR,
                  text: dynamicColors.text,
                  placeholder: isDarkMode ? '#bbbbbb' : '#888888',
                },
              }}
            />
            {resetError ? (
              <HelperText type="error" style={{ color: dynamicColors.helperText }}>
                {resetError}
              </HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeResetDialog} disabled={resetLoading} textColor={PRIMARY_COLOR}>
              <Text style={styles.textButtonLabel}>Annulla</Text>
            </Button>
            <Button onPress={handleResetPassword} loading={resetLoading} disabled={resetLoading} textColor={PRIMARY_COLOR}>
              <Text style={styles.textButtonLabel}>Aggiorna</Text>
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    justifyContent: 'center',
  },
  themeToggleContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 24,
    right: 12,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    // Lo sfondo opaco e gestito in linea per dinamicitÂ  
    // backgroundColor: 'rgba(0,0,0,0.5)',
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
    paddingTop: 40,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 40,
    fontWeight: 'bold',
    // color: '#fff', // Gestito in linea
    marginTop: 10,
  },
  tagline: {
    fontSize: 16,
    // color: '#fff', // Gestito in linea
    textAlign: 'center',
    opacity: 0.8,
  },
  formCard: {
    borderRadius: 12,
    overflow: 'hidden',
    // backgroundColor: '#fff', // Gestito in linea
  },
  formContainer: {
    padding: 16,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    marginBottom: 20,
    // backgroundColor: '#e0e0e0', // Gestito in linea
  },
  inputWrapper: {
    marginBottom: 12,
  },
  input: {
    marginBottom: 12,
  },
  errorContainer: {
    marginVertical: 16,
    width: '100%',
  },
  errorSurface: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff9fa',
    padding: 12,
  },
  errorIcon: {
    marginRight: 10,
  },
  errorText: {
    color: '#d32f2f',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    marginTop: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  textButtonLabel: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  forgotPasswordButton: {
    marginTop: 10,
  },
  toggleModeButton: {
    marginTop: 10,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    // color: '#fff', // Gestito in linea
    fontSize: 12,
    opacity: 0.7,
  },
  registrationBanner: {
    marginBottom: 20,
    // background color gestito in linea
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: PRIMARY_COLOR, // Questo rimane PRIMARY_COLOR
    marginBottom: 10,
  },
  resetDialog: {
    borderRadius: 20,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
});

export default LoginScreen;








