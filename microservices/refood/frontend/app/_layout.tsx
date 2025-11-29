import { Stack } from 'expo-router/stack';
import Head from 'expo-router/head';
import { router, useSegments, type Href } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, LogBox } from 'react-native';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { PRIMARY_COLOR } from '../src/config/constants';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { NotificheProvider } from '../src/context/NotificheContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import logger from '../src/utils/logger';
import { ThemeProvider, useThemeContext } from '../src/context/ThemeContext';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go with the release of SDK 53. Use a development build instead of Expo Go.',
]);

// Tema chiaro personalizzato
const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: PRIMARY_COLOR,
    secondary: '#FF9800',
  },
};

// Tema scuro personalizzato
const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: PRIMARY_COLOR,
    secondary: '#FF9800',

    // Proprietà essenziali per input con testo nero
    surfaceVariant: '#FFFFFF',
    onSurfaceVariant: '#000000',
    inverseSurface: '#FFFFFF',
    inverseOnSurface: '#000000',

    // Proprietà per text input in dark mode
    placeholder: '#000000',
    outline: '#000000',

    // Proprietà specifiche per rendere il testo degli input nero
    inputText: '#000000',
    onPrimaryContainer: '#000000',

    // ===== PROPRIETÀ AGGIUNTIVE PER TESTO UTENTE =====
    text: '#000000',
    onPrimary: '#000000',
    onSurface: '#000000',
    onTertiaryContainer: '#000000',

    textSelectionColor: '#000000',
    cursorColor: '#000000',
    textDecorationColor: '#000000',

    surface: '#FFFFFF',
    background: '#FFFFFF',

    textInput: '#000000',
    formColor: '#000000',
    formText: '#000000',
    onBackground: '#000000',

    // ===== PROPRIETÀ SPECIFICHE PER LA PAGINA NOTIFICHE =====
    notificationSurface: '#121212',
    notificationCard: '#1E1E1E',
    notificationText: '#FFFFFF',
    notificationContainerBg: '#121212',

    elevation: {
      level0: '#121212',
      level1: '#1E1E1E',
      level2: '#222222',
      level3: '#252525',
      level4: '#272727',
      level5: '#2C2C2C',
    },

    // Proprietà per prenotazioni in dark mode
    bookingContainerBg: '#121212',
    bookingCardBg: '#1E1E1E',
    bookingCardText: '#FFFFFF',
  },
};

const TAB_PERMISSIONS: Record<string, 'all' | string[]> = {
  index: ['Amministratore', 'Operatore', 'Canale Sociale', 'Centro Riciclo'],
  lotti: 'all',
  prenotazioni: 'all',
  statistiche: 'all',
  notifiche: 'all',
  mappe: ['Amministratore', 'Utente', 'Operatore', 'OperatoreCentro'],
  profilo: 'all',
  segnalazioni: ['Amministratore', 'OperatoreCentro'],
};

const TAB_ORDER = [
  { key: 'index', route: '/(tabs)' as Href },
  { key: 'lotti', route: '/(tabs)/lotti' as Href },
  { key: 'prenotazioni', route: '/(tabs)/prenotazioni' as Href },
  { key: 'segnalazioni', route: '/(tabs)/segnalazioni' as Href },
  { key: 'statistiche', route: '/(tabs)/statistiche' as Href },
  { key: 'mappe', route: '/(tabs)/mappe' as Href },
  { key: 'profilo', route: '/(tabs)/profilo' as Href },
] as const;

type TabKey = typeof TAB_ORDER[number]['key'];

const normalizeRole = (role?: string | null): string | null => {
  if (!role) return null;
  const trimmed = role.trim();
  const aliases: Record<string, string> = {
    Privato: 'Utente',
    CentroSociale: 'Canale Sociale',
    'Centro Riciclo': 'Centro Riciclo',
    CentroRiciclaggio: 'Centro Riciclo',
  };
  return aliases[trimmed] ?? trimmed;
};

const canAccessTab = (role: string | null, tab: TabKey): boolean => {
  const allowed = TAB_PERMISSIONS[tab];
  if (allowed === 'all') return true;
  return role ? allowed.includes(role) : false;
};

const getDefaultRouteForRole = (role?: string | null): Href => {
  const normalized = normalizeRole(role);
  for (const tab of TAB_ORDER) {
    if (canAccessTab(normalized, tab.key)) {
      return tab.route;
    }
  }
  return '/(tabs)/profilo' as Href;
};

// Componente per proteggere le route autenticate
function RootLayoutNav() {
  const segments = useSegments();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inAuthRequiredPage = inAuthGroup;
    const inAuthPages = segments[0] === 'login' || segments[0] === 'register';

    logger.log('RootLayoutNav - Percorso:', segments.join('/'));
    logger.log('RootLayoutNav - isAuthenticated:', isAuthenticated);
    logger.log('RootLayoutNav - inAuthGroup:', inAuthGroup);
    logger.log('RootLayoutNav - inAuthPages:', inAuthPages);

    const defaultRoute = getDefaultRouteForRole(user?.ruolo);

    if (!isAuthenticated && inAuthRequiredPage) {
      logger.log('RootLayoutNav - Utente non autenticato, reindirizzamento al login');
      router.replace({ pathname: '/login' });
    } else if (isAuthenticated && inAuthPages) {
      logger.log('RootLayoutNav - Utente già autenticato, reindirizzamento alla prima tab disponibile');
      router.replace(defaultRoute);
    } else if (isAuthenticated && inAuthGroup) {
      const currentTab = (segments[1] ?? 'index') as TabKey;
      const normalizedRole = normalizeRole(user?.ruolo);
      if (!canAccessTab(normalizedRole, currentTab)) {
        logger.log('RootLayoutNav - Tab corrente non consentita, redirigo alla prima tab accessibile');
        router.replace(defaultRoute);
      }
    }
  }, [isAuthenticated, user?.ruolo, segments, isLoading]);

  return (
    <>
      <Head>
        <title>ReFood</title>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#4CAF50" />
      </Head>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register/index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifiche/index" />
      </Stack>
    </>
  );
}

// Componente con i provider
function ProvidersInner() {
  const { isDarkMode } = useThemeContext();

  return (
    <PaperProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <NotificheProvider>
            <RootLayoutNav />
            <Toast />
          </NotificheProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </PaperProvider>
  );
}

export default function RootLayout() {
  // Ignora warning di useLayoutEffect per il web
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        LogBox.ignoreLogs([
          'onStartShouldSetResponder',
          'findDOMNode is deprecated',
          'useSyncExternalStore changed size',
          'change in the order of Hooks called by ContextNavigator',
        ]);
      } catch {}
      const originalWarn = console.warn;
      console.warn = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) {
          return;
        }
        originalWarn(...args);
      };
    }
  }, []);

  return (
    <ThemeProvider>
      <ProvidersInner />
    </ThemeProvider>
  );
}
