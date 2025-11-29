import { Tabs, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useNotifiche } from '../../src/context/NotificheContext';
import { RUOLI } from '../../src/config/constants';
import { View, Platform, Dimensions } from 'react-native';
import { useEffect, useContext, useState, useMemo } from 'react';
import { ThemeContext } from '../../src/context/ThemeContext';
import EqualSpaceTabBar from '../../src/components/EqualSpaceTabBar';

export default function TabLayout() {
  const { isDarkMode } = useContext(ThemeContext);
  const { user } = useAuth();
  const { aggiornaConteggio } = useNotifiche();
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    if (!user) return;
    aggiornaConteggio();
    const interval = setInterval(() => aggiornaConteggio(), 30000);
    return () => clearInterval(interval);
  }, [user, aggiornaConteggio]);

  // Rimosso: badge numerico sulle prenotazioni
  // Gestione responsiva: mostra le etichette delle tab solo se c'è spazio sufficiente
  useEffect(() => {
    // Mostra le etichette solo se lo spazio è sufficiente sia in larghezza che in altezza
    // Queste soglie sono state tarate per evitare label troncate
    const LABEL_MIN_WIDTH = 920;
    const LABEL_MIN_HEIGHT = 560;
    const update = () => {
      const size = Platform.OS === 'web' && typeof window !== 'undefined'
        ? { w: window.innerWidth, h: window.innerHeight }
        : { w: Dimensions.get('window').width, h: Dimensions.get('window').height };
      const enoughWidth = (size.w || 0) >= LABEL_MIN_WIDTH;
      const enoughHeight = (size.h || 0) >= LABEL_MIN_HEIGHT;
      setShowLabels(enoughWidth && enoughHeight);
    };
    update();
    if (Platform.OS === 'web') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    } else {
      const sub = Dimensions.addEventListener('change', update);
      return () => (sub as any)?.remove?.();
    }
  }, []);

  const paperTheme = {
    ...(isDarkMode
      ? {
        dark: true,
        colors: {
          primary: '#bb86fc',
          background: '#222222',
          surface: '#333333',
          text: '#ffffff',
          placeholder: '#bbbbbb',
          notification: '#ff80ab',
        },
      }
      : {
        dark: false,
        colors: {
          primary: '#6200ee',
          background: '#ffffff',
          surface: '#ffffff',
          text: '#000000',
          placeholder: '#666666',
          notification: '#f50057',
        },
      }),
  };

  const activeTabColor = useMemo(
    () => (user ? '#4CAF50' : paperTheme.colors.primary),
    [user, paperTheme.colors.primary]
  );

  // Non uscire prima: mantenere l'ordine dei hook costante fra i render
  
  // Matrice centralizzata ruoli -> tabs
  type TabKey = 'index' | 'lotti' | 'prenotazioni' | 'statistiche' | 'mappe' | 'profilo' | 'segnalazioni' | 'notifiche';
  const ROLES = {
    AMMINISTRATORE: RUOLI.AMMINISTRATORE,
    OPERATORE: RUOLI.OPERATORE,
    UTENTE: RUOLI.UTENTE,
    OPERATORE_CENTRO: 'OperatoreCentro',
    CANALE_SOCIALE: RUOLI.CENTRO_SOCIALE,
    CENTRO_RICICLAGGIO: RUOLI.CENTRO_RICICLAGGIO,
  } as const;
  const TAB_PERMISSIONS: Record<TabKey, 'all' | string[]> = {
    index: [ROLES.AMMINISTRATORE, ROLES.OPERATORE, ROLES.CANALE_SOCIALE, ROLES.CENTRO_RICICLAGGIO],
    lotti: 'all',
    prenotazioni: 'all',
    statistiche: 'all',
    mappe: [ROLES.AMMINISTRATORE, ROLES.UTENTE, ROLES.OPERATORE, ROLES.OPERATORE_CENTRO],
    profilo: 'all',
    segnalazioni: [ROLES.AMMINISTRATORE, ROLES.OPERATORE_CENTRO],
    notifiche: 'all', // tenuta nascosta dalla tab, accessibile via navigazione interna
  };
  const canAccess = (tab: TabKey) => {
    const allowed = TAB_PERMISSIONS[tab];
    return allowed === 'all' || (user?.ruolo ? (allowed as string[]).includes(user.ruolo) : false);
  };

  // Configurazione dichiarativa delle tabs mostrate nella bottom bar
  type TabDef = {
    key: Exclude<TabKey, 'notifiche'>;
    title: string;
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  };

  const ALL_TABS: TabDef[] = [
    { key: 'index',         title: 'Home',         icon: 'home' },
    { key: 'lotti',         title: 'Lotti',        icon: 'package-variant' },
    { key: 'segnalazioni',  title: 'Segnalazioni', icon: 'alert' },
    { key: 'prenotazioni',  title: 'Prenotazioni', icon: 'calendar' },
    { key: 'statistiche',   title: 'Statistiche',  icon: 'chart-bar' },
    { key: 'mappe',         title: 'Mappe',        icon: 'map-marker' },
    { key: 'profilo',       title: 'Profilo',      icon: 'account-circle' },
  ];

  // Se l'index non è accessibile per il ruolo corrente, sposta l'utente verso una tab consentita.
  useEffect(() => {
    if (!user) return;
    if (!canAccess('index')) {
      if (canAccess('lotti')) router.replace('/(tabs)/lotti');
      else if (canAccess('prenotazioni')) router.replace('/(tabs)/prenotazioni');
      else router.replace('/(tabs)/profilo');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.ruolo]);

  return (
    <View style={{ flex: 1, backgroundColor: paperTheme.colors.background }}>
      <Tabs
        initialRouteName="index"
        tabBar={(props) => (
          <EqualSpaceTabBar
            {...props}
            allowedKeys={ALL_TABS.filter(t => canAccess(t.key)).map(t => t.key)}
            config={ALL_TABS as any}
            activeColor={activeTabColor as any}
            inactiveColor={isDarkMode ? '#9E9E9E' : '#808080'}
            showLabels={showLabels}
            backgroundColor={paperTheme.colors.background}
            borderTopColor={isDarkMode ? '#333' : '#e1e1e1'}
          />
        )}
        screenOptions={{
          headerStyle: { backgroundColor: paperTheme.colors.surface },
          headerTintColor: paperTheme.colors.text,
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {ALL_TABS.map(t => {
          const allowed = canAccess(t.key);
          return (
            <Tabs.Screen
              key={t.key}
              name={t.key}
              options={{
                title: t.title,
                // Se non autorizzato, non mostrare il bottone in tab bar
                ...(allowed ? {} : { tabBarButton: () => null }),
                tabBarIcon: allowed
                  ? ({ color }) => (
                      <MaterialCommunityIcons name={t.icon} color={color} size={showLabels ? 28 : 32} />
                    )
                  : undefined,
              }}
            />
          );
        })}
        {/* Nota: la schermata notifiche vive fuori dal gruppo (tabs) e viene
            registrata nello Stack principale in app/_layout.tsx. Non aggiungerla qui
            per evitare mismatch nell'albero delle route. */}
      </Tabs>
    </View>
  );
}
