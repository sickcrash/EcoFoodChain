import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { TextInput, Button, Text, HelperText, Card, Divider, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { PRIMARY_COLOR, VALIDAZIONI } from '../config/constants';
import Toast from 'react-native-toast-message';
import logger from '../utils/logger';
import { Link } from 'expo-router';

const RegistrationScreen = () => {
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [nomeError, setNomeError] = useState('');
  const [cognomeError, setCognomeError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const { register, error, clearError, isLoading } = useAuth();
  const [fadeAnim] = useState(new Animated.Value(0));

  const theme = useTheme();
  const isDarkMode = theme.dark;
  const { width } = useWindowDimensions();

  const isTablet = width >= 600;

  const dynamicColors = useMemo(
    () => ({
      overlay: isDarkMode ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.72)',
      logo: isDarkMode ? '#ffffff' : '#ffffff',
      cardBackground: isDarkMode ? '#1f1f1f' : '#ffffff',
      inputBackground: isDarkMode ? '#2b2f36' : '#ffffff',
      inputOutline: PRIMARY_COLOR,
      textPrimary: isDarkMode ? '#ffffff' : '#1c1c1c',
      tagline: isDarkMode ? '#f5f5f5' : '#f9f9f9',
      helperText: isDarkMode ? '#ff8a80' : '#d32f2f',
      footer: isDarkMode ? '#d0d0d0' : '#ffffff',
    }),
    [isDarkMode]
  );
  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (error) {
      Toast.show({
        type: "error",
        position: "bottom",
        text1: "Registrazione non riuscita",
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

  const validateNome = () => {
    if (!nome) {
      setNomeError('Il nome è obbligatorio');
      return false;
    } else {
      setNomeError('');
      return true;
    }
  };

  const validateCognome = () => {
    if (!cognome) {
      setCognomeError('Il cognome è obbligatorio');
      return false;
    } else {
      setCognomeError('');
      return true;
    }
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('L\'email è obbligatoria');
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
      setPasswordError('La password è obbligatoria');
      return false;
    } else if (password.length < 6) {
      setPasswordError(`La password deve contenere almeno ${VALIDAZIONI.PASSWORD_MIN_LENGTH} caratteri`);
      return false;
    } else {
      setPasswordError('');
      return true;
    }
  };

  const validateConfirmPassword = () => {
    if (!confirmPassword) {
      setConfirmPasswordError('La conferma password è obbligatoria');
      return false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('Le password non coincidono');
      return false;
    } else {
      setConfirmPasswordError('');
      return true;
    }
  };

  const handleRegistration = async () => {
    const isNomeValid = validateNome();
    const isCognomeValid = validateCognome();
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isConfirmPasswordValid = validateConfirmPassword();

    if (isNomeValid && isCognomeValid && isEmailValid && isPasswordValid && isConfirmPasswordValid) {
      logger.log('RegistrationScreen - Tentativo di registrazione con:', email);
      const success = await register(nome, cognome, email, password, 'utente', null, null);
      logger.log('RegistrationScreen - Risultato registrazione:', success ? 'successo' : 'fallito');
      
      if (success) {
        Toast.show({
          type: "success",
          position: "bottom",
          text1: "Registrazione completata",
          text2: "Puoi accedere con le tue credenziali",
          visibilityTime: 4000,
          autoHide: true,
        });
        logger.log('RegistrationScreen - Registrazione completata con successo, attendiamo che l\'utente ritorni alla login');
      }
    }
  };

  const renderContent = () => (
      <View style={styles.mainContainer}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1974&auto=format&fit=crop' }}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <KeyboardAvoidingView
            enabled={Platform.OS === 'ios'}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}
            style={[styles.container, { backgroundColor: dynamicColors.overlay }]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                keyboardVisible ? styles.scrollViewKeyboard : styles.scrollView,
                isTablet && styles.scrollViewWide,
              ]}
            >
              <View style={styles.logoContainer}>
                <MaterialCommunityIcons name="food-apple" size={64} color={dynamicColors.logo} />
                <Text style={[styles.appName, { color: dynamicColors.logo }]}>Refood</Text>
                <Text style={[styles.tagline, { color: dynamicColors.tagline }]}>Riduci lo spreco alimentare</Text>
              </View>

              <View style={[styles.formWrapper, isTablet && styles.formWrapperWide]}>
                <Card style={[styles.formCard, { backgroundColor: dynamicColors.cardBackground }]} elevation={5}>
                <Card.Content style={styles.formContainer}>
                  <Text style={styles.registrationTitle}>Registrazione</Text>
                  <Divider style={styles.divider} />
                
                  <View style={styles.inputWrapper}>
                    <TextInput
                      label="Nome"
                      value={nome}
                      onChangeText={setNome}
                      onBlur={validateNome}
                      error={!!nomeError}
                      mode="outlined"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      textColor={dynamicColors.textPrimary}
                      left={<TextInput.Icon icon="account" color={dynamicColors.textPrimary} />}
                    />
                    {nomeError ? <HelperText type="error" style={{ color: dynamicColors.helperText }}>{nomeError}</HelperText> : null}
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      label="Cognome"
                      value={cognome}
                      onChangeText={setCognome}
                      onBlur={validateCognome}
                      error={!!cognomeError}
                      mode="outlined"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      textColor={dynamicColors.textPrimary}
                      left={<TextInput.Icon icon="account" color={dynamicColors.textPrimary} />}
                    />
                    {cognomeError ? <HelperText type="error" style={{ color: dynamicColors.helperText }}>{cognomeError}</HelperText> : null}
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      label="Email"
                      value={email}
                      onChangeText={setEmail}
                      onBlur={validateEmail}
                      error={!!emailError}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      mode="outlined"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      textColor={dynamicColors.textPrimary}
                      left={<TextInput.Icon icon="email" color={dynamicColors.textPrimary} />}
                    />
                    {emailError ? <HelperText type="error" style={{ color: dynamicColors.helperText }}>{emailError}</HelperText> : null}
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      onBlur={validatePassword}
                      secureTextEntry={!passwordVisible}
                      error={!!passwordError}
                      mode="outlined"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      textColor={dynamicColors.textPrimary}
                      left={<TextInput.Icon icon="lock" color={dynamicColors.textPrimary} />}
                      right={
                        <TextInput.Icon
                          icon={passwordVisible ? 'eye-off' : 'eye'}
                          onPress={() => setPasswordVisible(!passwordVisible)}
                          color={dynamicColors.textPrimary}
                        />
                      }
                    />
                    {passwordError ? <HelperText type="error" style={{ color: dynamicColors.helperText }}>{passwordError}</HelperText> : null}
                  </View>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      label="Conferma Password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onBlur={validateConfirmPassword}
                      secureTextEntry={!passwordVisible}
                      error={!!confirmPasswordError}
                      mode="outlined"
                      style={[styles.input, { backgroundColor: dynamicColors.inputBackground }]}
                      outlineColor={dynamicColors.inputOutline}
                      activeOutlineColor={dynamicColors.inputOutline}
                      textColor={dynamicColors.textPrimary}
                      left={<TextInput.Icon icon="lock-check" color={dynamicColors.textPrimary} />}
                    />
                    {confirmPasswordError ? <HelperText type="error" style={{ color: dynamicColors.helperText }}>{confirmPasswordError}</HelperText> : null}
                  </View>

                  <Button
                    mode="contained"
                    onPress={handleRegistration}
                    loading={isLoading}
                    disabled={isLoading}
                    style={styles.registrationButton}
                    buttonColor={PRIMARY_COLOR}
                    icon="account-plus"
                  >
                    Registrati
                  </Button>

                  <Link href="/" asChild>
                    <Button mode="text" style={styles.loginLink} textColor={PRIMARY_COLOR}>
                      Hai già un account? Accedi
                    </Button>
                  </Link>
                </Card.Content>
              </Card>
              </View>

              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: dynamicColors.footer }]}>© 2025 Refood App - Tutti i diritti riservati</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </ImageBackground>
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
    paddingTop: 40,
    paddingBottom: 20,
  },
  scrollViewWide: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.8,
  },
  formCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  formWrapper: {
    width: '100%',
  },
  formWrapperWide: {
    maxWidth: 520,
    width: '100%',
  },
  formContainer: {
    padding: 16,
  },
  registrationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    marginBottom: 20,
    backgroundColor: '#e0e0e0',
  },
  inputWrapper: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'transparent',
  },
  registrationButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  loginLink: {
    marginTop: 16,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.7,
  },
});

export default RegistrationScreen;

