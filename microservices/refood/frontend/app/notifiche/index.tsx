import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Stack, router, type Href, useFocusEffect } from 'expo-router';
import { Appbar, Button, Text, Chip, Divider, Menu, Portal, Dialog } from 'react-native-paper';
import { useNotifiche } from '../../src/context/NotificheContext';
import NotificaItem from '../../src/components/NotificaItem';
import { NotificaFiltri, Notifica } from '../../src/types/notification';
import { pushNotificationService } from '../../src/services/pushNotificationService';
import Toast from 'react-native-toast-message';
import logger from '../../src/utils/logger';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemeContext } from '../../src/context/ThemeContext';
import { PRIMARY_COLOR } from '@/src/config/constants';
import { useAuth } from '../../src/context/AuthContext';

// Dati mock di esempio per fallback quando il backend non risponde
const MOCK_NOTIFICHE: Notifica[] = [
  {
    id: 999001,
    titolo: 'Benvenuto in ReFood',
    messaggio: 'Grazie per aver installato ReFood! Qui riceverai notifiche su eventi importanti come cambiamenti di stato dei lotti, prenotazioni, e altro.',
    tipo: 'Alert',
    priorita: 'Alta',
    letta: false,
    data: new Date().toISOString(),
    dataCreazione: new Date().toISOString()
  },
  {
    id: 999002,
    titolo: 'Nuovo lotto disponibile',
    messaggio: 'àˆ stato creato un nuovo lotto: albicocche',
    tipo: 'CambioStato',
    priorita: 'Media',
    letta: false,
    data: new Date(Date.now() - 3600000).toISOString(), // 1 ora fa
    dataCreazione: new Date(Date.now() - 3600000).toISOString()
  }
];

export default function NotificheScreen() {
  const {
    notifiche,
    loading,
    error,
    caricaNotifiche,
    refreshNotifiche,
    segnaTutteLette,
  } = useNotifiche();

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [filterDialogVisible, setFilterDialogVisible] = useState(false);
  const [filtri, setFiltri] = useState<NotificaFiltri>({});
  const [filtriFiltro, setFiltriFiltro] = useState<NotificaFiltri>({});
  const [initialLoadCompleted, setInitialLoadCompleted] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [localNotifiche, setLocalNotifiche] = useState<Notifica[]>([]);
  const [hadNetworkError, setHadNetworkError] = useState(false);

  const lastLoadTimeRef = useRef<number>(0);
  const maxLoadAttemptsRef = useRef(3); // Massimo numero di tentativi di caricamento
  const { isDarkMode } = useContext(ThemeContext);
  const { user } = useAuth();

  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const mutedTextColor = isDarkMode ? '#cccccc' : '#666666';
  const iconColor = isDarkMode ? '#fff' : undefined;

  // Effetto per monitorare i tentativi di caricamento
  useEffect(() => {
    if (loadAttempts > maxLoadAttemptsRef.current) {
      logger.warn(`Raggiunto il limite massimo di tentativi (${maxLoadAttemptsRef.current}). Usando dati mock.`);
      setIsUsingMockData(true);
      setLocalNotifiche(MOCK_NOTIFICHE);
      setInitialLoadCompleted(true);
      setLoadAttempts(0); // Reset per eventuali futuri tentativi
    }
  }, [loadAttempts]);

  // Carica i dati solo la prima volta o quando la schermata è a fuoco
  useFocusEffect(
    useCallback(() => {
      logger.log('NotificheScreen: useFocusEffect triggered');

      // Se stiamo già  utilizzando i dati mock, non tentare di ricaricare dal server
      if (isUsingMockData) {
        logger.log('NotificheScreen: usando dati mock, nessun caricamento necessario');
        return;
      }

      // Se il caricamento è già  in corso, non fare nulla
      if (loading || refreshing) {
        logger.log('NotificheScreen: caricamento già  in corso, ignoro');
        return;
      }

      const now = Date.now();
      const timeSinceLastLoad = now - lastLoadTimeRef.current;
      // Aumentiamo la soglia a 10 secondi per evitare ricaricamenti troppo frequenti
      const REFRESH_THRESHOLD = 10000; // 10 secondi

      logger.log(`NotificheScreen: ultimo caricamento ${Math.floor(timeSinceLastLoad / 1000)}s fa`);

      // Se non è mai stato caricato o è passato abbastanza tempo dall'ultimo caricamento
      if (!initialLoadCompleted || timeSinceLastLoad > REFRESH_THRESHOLD) {
        logger.log('NotificheScreen: caricamento notifiche necessario');

        // Verifica se siamo al primo caricamento o se stiamo ricaricando dopo un errore
        const isInitialOrRetry = !initialLoadCompleted || hadNetworkError;

        // Aggiorna il timestamp prima di iniziare il caricamento
        lastLoadTimeRef.current = now;

        // Effettua il caricamento
        refreshNotifiche()
          .then(() => {
            logger.log('NotificheScreen: caricamento completato con successo');
            setInitialLoadCompleted(true);
            setHadNetworkError(false);
            setLoadAttempts(0); // Reset dei tentativi dopo un caricamento riuscito
          })
          .catch(err => {
            logger.error('NotificheScreen: errore durante il caricamento', err);
            setHadNetworkError(true);

            // Incrementa il contatore dei tentativi solo per il caricamento iniziale o retry
            if (isInitialOrRetry) {
              setLoadAttempts(prev => prev + 1);
              logger.warn(`NotificheScreen: tentativo ${loadAttempts + 1}/${maxLoadAttemptsRef.current}`);
            }
          });
      } else {
        logger.log('NotificheScreen: caricamento non necessario (recente)');
      }
    }, [refreshNotifiche, loading, refreshing, initialLoadCompleted, loadAttempts, isUsingMockData, hadNetworkError])
  );

  // Gestisce il refresh delle notifiche
  const onRefresh = async () => {
    logger.log('NotificheScreen: onRefresh manuale avviato');

    if (isUsingMockData) {
      // Se stiamo usando dati mock, simuliamo un refresh che non fa nulla
      logger.log('NotificheScreen: simulazione refresh con dati mock');
      setRefreshing(true);
      setTimeout(() => {
        setRefreshing(false);
        Toast.show({
          type: 'info',
          text1: 'Modalità  Demo',
          text2: 'Utilizzo dati di esempio. Il backend non è raggiungibile.',
          visibilityTime: 3000,
        });
      }, 1000);
      return;
    }

    setRefreshing(true);
    setHadNetworkError(false); // Reset del flag quando l'utente richiede un refresh

    try {
      await refreshNotifiche();
      setPage(1); // Reset della pagina a 1 dopo un refresh completo
      lastLoadTimeRef.current = Date.now();
      setLoadAttempts(0); // Reset dei tentativi dopo un refresh manuale riuscito
      setIsUsingMockData(false); // Torniamo ai dati reali se il refresh ha successo
      logger.log('NotificheScreen: refresh manuale completato con successo');
    } catch (error) {
      logger.error('Errore durante il refresh delle notifiche:', error);
      setHadNetworkError(true);

      // Se il refresh manuale fallisce, mostriamo dati mock
      setIsUsingMockData(true);
      setLocalNotifiche(MOCK_NOTIFICHE);

      Toast.show({
        type: 'error',
        text1: 'Errore di connessione',
        text2: 'Impossibile caricare le notifiche. Utilizzo dati locali.',
        visibilityTime: 3000,
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Carica pià¹ notifiche
  const loadMoreNotifiche = async () => {
    // Non caricare pià¹ pagine se:
    // - stiamo usando dati mock
    // - c'è già  un caricamento in corso
    // - c'è stato un errore di rete precedente
    // - non ci sono notifiche nella prima pagina (significa che non ci sono dati)
    if (
      isUsingMockData ||
      loadingMore ||
      loading ||
      hadNetworkError ||
      notificheToDisplay.length === 0
    ) {
      return;
    }

    logger.log(`NotificheScreen: caricamento pagina ${page + 1}`);
    setLoadingMore(true);

    try {
      await caricaNotifiche(page + 1, 20, filtri);
      setPage(page + 1);
      setHadNetworkError(false); // Reset del flag se il caricamento ha successo
    } catch (error) {
      logger.error(`Errore durante il caricamento della pagina ${page + 1}:`, error);
      setHadNetworkError(true); // Imposta il flag per evitare ulteriori tentativi

      // Mostra un messaggio all'utente
      Toast.show({
        type: 'error',
        text1: 'Errore di connessione',
        text2: 'Impossibile caricare pià¹ notifiche',
        visibilityTime: 3000,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleNotificaPress = (selectedNotifica: Notifica) => {
    const rawId = selectedNotifica?.id;
    const parsedId = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);

    if (!Number.isFinite(parsedId)) {
      logger.warn('handleNotificaPress: ID non valido ricevuto', rawId);
      Toast.show({
        type: 'error',
        text1: 'Impossibile aprire la notifica',
        text2: 'ID della notifica non valido',
        visibilityTime: 2500,
      });
      return;
    }

    router.push({
      pathname: '/notifiche/[id]',
      params: { id: String(parsedId) },
    } as Href);
  };

  // Gestisce il segna tutte come lette
  const handleMarkAllAsRead = async () => {
    // Se stiamo usando dati mock, aggiorniamo solo i dati locali
    if (isUsingMockData) {
      setLocalNotifiche(prev => prev.map(n => ({ ...n, letta: true })));
      Toast.show({
        type: 'success',
        text1: 'Notifiche aggiornate',
        text2: 'Tutte le notifiche sono state segnate come lette',
        visibilityTime: 2000,
      });
      setMenuVisible(false);
      return;
    }

    await segnaTutteLette();
    setMenuVisible(false);
  };

  // Gestisce l'applicazione dei filtri
  const applyFilters = () => {
    setFiltri(filtriFiltro);
    setFilterDialogVisible(false);
    setPage(1);

    // Se stiamo usando dati mock, filtriamo localmente
    if (isUsingMockData) {
      let filteredMockNotifiche = [...MOCK_NOTIFICHE];

      if (filtriFiltro.tipo) {
        filteredMockNotifiche = filteredMockNotifiche.filter(n => n.tipo === filtriFiltro.tipo);
      }

      if (filtriFiltro.priorita) {
        filteredMockNotifiche = filteredMockNotifiche.filter(n => n.priorita === filtriFiltro.priorita);
      }

      if (filtriFiltro.letta !== undefined) {
        filteredMockNotifiche = filteredMockNotifiche.filter(n => n.letta === filtriFiltro.letta);
      }

      setLocalNotifiche(filteredMockNotifiche);
    } else {
      caricaNotifiche(1, 20, filtriFiltro);
    }
  };

  // Gestisce la cancellazione dei filtri
  const clearFilters = () => {
    setFiltriFiltro({});

    // Se stiamo usando dati mock, ripristina dati originali
    if (isUsingMockData) {
      setLocalNotifiche(MOCK_NOTIFICHE);
    }

    setFilterDialogVisible(false);
  };

  // Verifica se i filtri sono attivi
  const hasActiveFilters = () => {
    return Object.keys(filtri).length > 0;
  };

  // Renderizza un chip per il filtro attivo
  const renderFilterChips = () => {
    const chips = [];

    if (filtri.tipo) {
      chips.push(
        <Chip
          key="tipo"
          style={styles.filterChip}
          onClose={() => {
            const newFiltri = { ...filtri };
            delete newFiltri.tipo;
            setFiltri(newFiltri);
            setFiltriFiltro(newFiltri);

            // Se stiamo usando dati mock, applica filtri localmente
            if (isUsingMockData) {
              let filteredMockNotifiche = [...MOCK_NOTIFICHE];

              if (newFiltri.priorita) {
                filteredMockNotifiche = filteredMockNotifiche.filter(n => n.priorita === newFiltri.priorita);
              }

              if (newFiltri.letta !== undefined) {
                filteredMockNotifiche = filteredMockNotifiche.filter(n => n.letta === newFiltri.letta);
              }

              setLocalNotifiche(filteredMockNotifiche);
            } else {
              caricaNotifiche(1, 20, newFiltri);
            }
          }}
        >
          Tipo: {filtri.tipo}
        </Chip>
      );
    }

    if (filtri.priorita) {
      chips.push(
        <Chip
          key="priorita"
          style={styles.filterChip}
          onClose={() => {
            const newFiltri = { ...filtri };
            delete newFiltri.priorita;
            setFiltri(newFiltri);
            setFiltriFiltro(newFiltri);

            // Se stiamo usando dati mock, applica filtri localmente
            if (isUsingMockData) {
              let filteredMockNotifiche = [...MOCK_NOTIFICHE];

              if (newFiltri.tipo) {
                filteredMockNotifiche = filteredMockNotifiche.filter(n => n.tipo === newFiltri.tipo);
              }

              if (newFiltri.letta !== undefined) {
                filteredMockNotifiche = filteredMockNotifiche.filter(n => n.letta === newFiltri.letta);
              }

              setLocalNotifiche(filteredMockNotifiche);
            } else {
              caricaNotifiche(1, 20, newFiltri);
            }
          }}
        >
          Priorità : {filtri.priorita}
        </Chip>
      );
    }

    if (filtri.letta !== undefined) {
      chips.push(
        <Chip
          key="letta"
          style={styles.filterChip}
          onClose={() => {
            const newFiltri = { ...filtri };
            delete newFiltri.letta;
            setFiltri(newFiltri);
            setFiltriFiltro(newFiltri);

            // Se stiamo usando dati mock, applica filtri localmente
            if (isUsingMockData) {
              let filteredMockNotifiche = [...MOCK_NOTIFICHE];

              if (newFiltri.tipo) {
                filteredMockNotifiche = filteredMockNotifiche.filter(n => n.tipo === newFiltri.tipo);
              }

              if (newFiltri.priorita) {
                filteredMockNotifiche = filteredMockNotifiche.filter(n => n.priorita === newFiltri.priorita);
              }

              setLocalNotifiche(filteredMockNotifiche);
            } else {
              caricaNotifiche(1, 20, newFiltri);
            }
          }}
        >
          {filtri.letta ? 'Lette' : 'Non lette'}
        </Chip>
      );
    }

    return chips;
  };

  // Renderizza il footer della lista
  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" />
      </View>
    );
  };

  // Renderizza un messaggio di errore
  const renderError = () => {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={onRefresh} style={styles.retryButton}>
          Riprova
        </Button>
      </View>
    );
  };

  // Renderizza un messaggio quando non ci sono notifiche
  const renderEmpty = () => {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>
          {hasActiveFilters()
            ? 'Nessuna notifica corrisponde ai filtri applicati.'
            : 'Non hai notifiche al momento.'}
        </Text>
        {hasActiveFilters() && (
          <Button
            mode="outlined"
            onPress={() => {
              setFiltri({});
              setFiltriFiltro({});

              if (isUsingMockData) {
                setLocalNotifiche(MOCK_NOTIFICHE);
              } else {
                caricaNotifiche(1, 20, {});
              }
            }}
            style={styles.clearFiltersButton}
          >
            Cancella filtri
          </Button>
        )}
      </View>
    );
  };

  // Nel componente NotificheScreen, aggiungi un metodo per inviare una notifica di test
  const inviaNotificaTest = async () => {
    await pushNotificationService.sendLocalNotification(
      'Notifica di Test',
      'Questa è una notifica di test per verificare il funzionamento del sistema.',
      { type: 'notifica' }
    );

    Toast.show({
      type: 'success',
      text1: 'Notifica di test inviata',
      text2: 'Controlla la barra delle notifiche del dispositivo',
      visibilityTime: 3000,
    });
  };


  // Determina quali notifiche mostrare (mock o reali)
  const notificheToDisplay = isUsingMockData ? localNotifiche : notifiche;

  const notificheAfterMenuFilters = (notificheToDisplay || []).filter(n => {
    if (filtri.tipo && n.tipo !== filtri.tipo) return false;
    if (filtri.priorita && n.priorita !== filtri.priorita) return false;
    if (filtri.letta !== undefined && n.letta !== filtri.letta) return false;
    return true;
  });

  // Filtro "segnalazione": visibile solo ad Amministratore,
  // oppure ad OperatoreCentro se il proprio Nome+Cognome è nel messaggio
  const userRole = user?.ruolo;
  const userFullName = `${user?.nome ?? ''} ${user?.cognome ?? ''}`.trim().toLowerCase();

  const notificheToDisplayFiltered = notificheAfterMenuFilters.filter(n => {
    const msg = (n?.messaggio || '').toLowerCase();
    const tipoNotifica = (n?.tipo || '').toLowerCase();
    const isSegnalazione = tipoNotifica === 'segnalazione' || msg.includes('segnalazione');

    if (!isSegnalazione) return true;
    if (userRole === 'Operatore') return false;
    if (userRole === 'OperatoreCentro') {
      return userFullName ? msg.includes(userFullName) : true;
    }
    return true;
  });

  // Renderizza l'header con icona indietro e indicatore WebSocket
  const renderHeader = () => (
    <Appbar.Header
      style={[styles.header, { backgroundColor: isDarkMode ? '#121212' : '#fff' }]}
    >
      <Appbar.BackAction
        onPress={() => router.back()}
        color={isDarkMode ? '#fff' : '#000'}
      />
      <Appbar.Content
        title="Notifiche"
        titleStyle={{ color: isDarkMode ? '#fff' : '#000', fontSize: 20, fontWeight: '600' }}
      />

      {notifiche.length > 0 && (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Appbar.Action
              icon="bell-check"
              onPress={() => setMenuVisible(true)}
              color={isDarkMode ? '#fff' : '#000'}
              accessibilityLabel="Azioni notifiche"
            />
          }
          contentStyle={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#fff' }}
        >
          <Menu.Item
            onPress={handleMarkAllAsRead}
            title="Segna tutte come lette"
            titleStyle={{ color: textColor }}
            leadingIcon={({ size }) => (
              <MaterialCommunityIcons name="check-all" color={iconColor} size={size} />
            )}
          />
          <Divider />
          <Menu.Item
            onPress={() => {
              setFiltri({ letta: false });
              setFiltriFiltro({ letta: false });
              if (isUsingMockData) {
                const nonLette = MOCK_NOTIFICHE.filter(n => !n.letta);
                setLocalNotifiche(nonLette);
              } else {
                caricaNotifiche(1, 20, { letta: false });
              }
              setMenuVisible(false);
            }}
            title="Mostra solo non lette"
            titleStyle={{ color: textColor }}
            leadingIcon={({ size }) => (
              <MaterialCommunityIcons name="bell" color={iconColor} size={size} />
            )}
          />
          <Menu.Item
            onPress={() => {
              setFiltri({});
              setFiltriFiltro({});
              if (isUsingMockData) {
                setLocalNotifiche(MOCK_NOTIFICHE);
              } else {
                caricaNotifiche(1, 20, {});
              }
              setMenuVisible(false);
            }}
            title="Mostra tutte"
            titleStyle={{ color: textColor }}
            leadingIcon={({ size }) => (
              <MaterialCommunityIcons name="bell-outline" color={iconColor} size={size} />
            )}
          />
          <Divider />
          <Menu.Item
            onPress={() => {
              inviaNotificaTest();
              setMenuVisible(false);
            }}
            title="Invia notifica test"
            titleStyle={{ color: textColor }}
            leadingIcon={({ size }) => (
              <MaterialCommunityIcons name="bell-plus" color={iconColor} size={size} />
            )}
          />
          {isUsingMockData && (
            <Menu.Item
              onPress={() => {
                setIsUsingMockData(false);
                setLoadAttempts(0);
                setInitialLoadCompleted(false);
                lastLoadTimeRef.current = 0;
                setMenuVisible(false);
                refreshNotifiche().catch(error => {
                  logger.error('Impossibile tornare ai dati reali:', error);
                  setIsUsingMockData(true);
                  setLocalNotifiche(MOCK_NOTIFICHE);
                  Toast.show({
                    type: 'error',
                    text1: 'Errore di connessione',
                    text2: 'Impossibile caricare dati reali. Continuazione in modalità  demo.',
                    visibilityTime: 3000,
                  });
                });
              }}
              title="Tenta di usare dati reali"
              titleStyle={{ color: textColor }}
              leadingIcon={({ size }) => (
                <MaterialCommunityIcons name="cloud-sync" color={iconColor} size={size} />
              )}
            />
          )}
        </Menu>
      )}
    </Appbar.Header>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          header: () => renderHeader()
        }}
      />

      {isUsingMockData && (
        <View style={[
          styles.mockBanner,
          { backgroundColor: isDarkMode ? '#2c2c2c' : '#FFF3E0', borderBottomColor: isDarkMode ? '#444' : '#FFE0B2' }
        ]}>
          <Text style={[
            styles.mockText,
            { color: isDarkMode ? '#FFB74D' : '#E65100' }
          ]}>
            Modalità  Demo - I dati mostrati sono di esempio
          </Text>
        </View>
      )}

      {hasActiveFilters() && (
        <View style={[
          styles.filtersContainer,
          {
            backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
            borderBottomColor: isDarkMode ? '#333' : '#e0e0e0',
          }
        ]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderFilterChips()}
          </ScrollView>
        </View>
      )}

      {(loading && !refreshing && notificheToDisplay.length === 0) ? (
        <View style={[styles.centerContainer, { backgroundColor }]}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={[styles.loadingText, { color: mutedTextColor }]}>
            Caricamento notifiche...
          </Text>
        </View>
      ) : error && !isUsingMockData ? (
        renderError()
      ) : (
        <FlatList
          data={notificheToDisplayFiltered}
          renderItem={({ item }) => (
            <NotificaItem notifica={item} onPress={handleNotificaPress} />
          )}
          keyExtractor={item => item.id.toString()}
          nestedScrollEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY_COLOR]}
              progressBackgroundColor={backgroundColor}
              tintColor={PRIMARY_COLOR}
            />
          }
          onEndReached={isUsingMockData ? undefined : loadMoreNotifiche}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={loading ? null : renderEmpty()}
          contentContainerStyle={
            notificheToDisplayFiltered.length === 0
              ? [styles.emptyListContainer, { backgroundColor, paddingVertical: 24 }]
              : { backgroundColor, paddingVertical: 12 }
          }
        />
      )}

      <Portal>
        <Dialog
          visible={filterDialogVisible}
          onDismiss={() => setFilterDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Filtra notifiche</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.filterLabel}>Tipo</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, tipo: 'CambioStato' })}>
                <Chip
                  selected={filtriFiltro.tipo === 'CambioStato'}
                  style={styles.chipFilter}
                >
                  Cambio Stato
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, tipo: 'Prenotazione' })}>
                <Chip
                  selected={filtriFiltro.tipo === 'Prenotazione'}
                  style={styles.chipFilter}
                >
                  Prenotazione
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, tipo: 'Alert' })}>
                <Chip
                  selected={filtriFiltro.tipo === 'Alert'}
                  style={styles.chipFilter}
                >
                  Alert
                </Chip>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Priorità </Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, priorita: 'Alta' })}>
                <Chip
                  selected={filtriFiltro.priorita === 'Alta'}
                  style={styles.chipFilter}
                >
                  Alta
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, priorita: 'Media' })}>
                <Chip
                  selected={filtriFiltro.priorita === 'Media'}
                  style={styles.chipFilter}
                >
                  Media
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, priorita: 'Bassa' })}>
                <Chip
                  selected={filtriFiltro.priorita === 'Bassa'}
                  style={styles.chipFilter}
                >
                  Bassa
                </Chip>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Stato</Text>
            <View style={styles.chipContainer}>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, letta: true })}>
                <Chip
                  selected={filtriFiltro.letta === true}
                  style={styles.chipFilter}
                >
                  Lette
                </Chip>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFiltriFiltro({ ...filtriFiltro, letta: false })}>
                <Chip
                  selected={filtriFiltro.letta === false}
                  style={styles.chipFilter}
                >
                  Non lette
                </Chip>
              </TouchableOpacity>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={clearFilters} textColor={PRIMARY_COLOR}>
              <Text style={{ color: PRIMARY_COLOR, fontWeight: '600' }}>Cancella</Text>
            </Button>
            <Button onPress={applyFilters} textColor={PRIMARY_COLOR}>
              <Text style={{ color: PRIMARY_COLOR, fontWeight: '600' }}>Applica</Text>
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: Platform.OS === 'ios' ? 88 : 72,
    paddingTop: Platform.OS === 'ios' ? 24 : 12,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  clearFiltersButton: {
    marginTop: 8,
  },
  dialog: {
    borderRadius: 8,
  },
  filterLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
  },
  chipFilter: {
    margin: 4,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterChip: {
    marginRight: 8,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  mockBanner: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  mockText: {
    fontSize: 12,
    color: '#E65100',
    fontStyle: 'italic',
  },
  wsIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  wsIndicatorText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
}); 



