import * as React from 'react';
import { View, StyleSheet, FlatList, Platform, RefreshControl, Animated, Easing } from 'react-native';
import { Surface, Text, Chip, Button, Appbar, IconButton } from 'react-native-paper';
import { useContext, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { PRIMARY_COLOR, STATUS_COLORS } from '../../src/config/constants';
import { ThemeContext } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import SegnalazioneCard, { Segnalazione } from '../../src/components/SegnalazioneCard';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { listSegnalazioni, StatoSegnalazione, startRevisione } from '../../src/services/segnalazioniService';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';


// Colori stato
const STATO_COLOR: Record<'inviata' | 'in_lavorazione' | 'chiusa', string> = {
  inviata: '#1E88E5',        // blu
  in_lavorazione: '#FB8C00', // arancio
  chiusa: '#E53935',         // rosso
};

function getStateColor(key: 'tutte' | 'inviata' | 'in_lavorazione' | 'chiusa') {
  if (key === 'tutte') return PRIMARY_COLOR;           // come nei lotti
  return STATO_COLOR[key];
}

function getStatusColorLight(key: 'tutte' | 'inviata' | 'in_lavorazione' | 'chiusa') {
  if (key === 'tutte') return 'rgba(0,151,74,0.12)';
  if (key === 'inviata') return 'rgba(30,136,229,0.12)';
  if (key === 'in_lavorazione') return 'rgba(251,140,0,0.12)';
  if (key === 'chiusa') return 'rgba(229,57,53,0.12)';
  return 'transparent';
}

// Accetta solo gli stati validi del backend (no "tutte")
const isStatoSegnalazione = (v: any): v is StatoSegnalazione =>
  v === 'inviata' || v === 'in_lavorazione' || v === 'chiusa';

export default function SegnalazioniIndex() {
  const { isDarkMode } = useContext(ThemeContext);
  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const surfaceColor = isDarkMode ? '#1e1e1e' : '#fff';
  const textColor = isDarkMode ? '#fff' : '#000';
  const mutedTextColor = isDarkMode ? '#ccc' : '#666';

  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [reloading, setReloading] = useState(false);

  const [selected, setSelected] = useState<StatoSegnalazione | 'tutte'>('tutte');
  const [items, setItems] = useState<Segnalazione[]>([]);

  const [error, setError] = useState<string | null>(null);

  const spinAnim = useRef(new Animated.Value(0));
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const spin = spinAnim.current.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const fetchData = useCallback(async (showSpinner = true) => {
    try {
      showSpinner && setLoading(true);
      setError(null);

      // Chiedi (al massimo) il filtro di stato al backend, niente filtro per creato_da
      const params: { stato?: StatoSegnalazione } = {};
      if (isStatoSegnalazione(selected)) {
        params.stato = selected;
      }

      const res = await listSegnalazioni(params);

      // Filtro SOLO lato client:
      // - Admin: vede tutto
      // - Operatore centro: vede solo quelle create da lui
      const visible = (user?.ruolo === 'Amministratore' || !user?.id)
        ? res
        : res.filter(it => it.creato_da === user.id);

      // Mappa alla shape attesa dalla Card
      const mapped: Segnalazione[] = visible.map(it => ({
        id: it.id,
        nome: it.nome,
        descrizione: it.descrizione,
        quantita: it.quantita,
        unita_misura: it.unita_misura,
        prezzo: it.prezzo,
        shelflife: it.shelflife,
        stato: it.stato,
      }));

      setItems(mapped);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Errore nel caricamento.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selected, user?.id, user?.ruolo]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useFocusEffect(
    React.useCallback(() => {
      // refresh "soft" senza spinner per evitare flicker
      fetchData(false);
      return () => { }; // cleanup non necessario, ma teniamo la firma corretta
    }, [fetchData])
  );

  const EXTRA_SPIN_AFTER_SUCCESS_MS = 2000; // quanto continuare a spinnare dopo successo
  const EXTRA_SPIN_AFTER_ERROR_MS = 800;  // dopo errore (più corto)

  const onFooterReload = async () => {
    if (reloading) return;
    setReloading(true);

    // avvia rotazione infinita
    spinAnim.current.setValue(0);
    loopRef.current = Animated.loop(
      Animated.timing(spinAnim.current, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loopRef.current.start();

    let hadError = false;

    try {
      await fetchData(false); // ricarica senza spinner globale
      Toast.show({
        type: 'success',
        text1: 'Aggiornato',
        text2: 'Elenco ricaricato',
        visibilityTime: 1200,
      });
    } catch (error: any) {
      hadError = true;
      Toast.show({
        type: 'error',
        text1: 'Errore di rete',
        text2: error?.message || 'Riprova',
        visibilityTime: 2000,
      });
    } finally {
      // continua a spinnare *anche dopo* la fine del fetch
      const extra = hadError ? EXTRA_SPIN_AFTER_ERROR_MS : EXTRA_SPIN_AFTER_SUCCESS_MS;
      await new Promise(res => setTimeout(res, extra));
      try {
        loopRef.current?.stop();
      } catch (stopError) {
        console.warn('Impossibile interrompere l\'animazione di refresh:', stopError);
      }
      setReloading(false);
    }
  };


  // Se il backend ignorasse 'stato', questo filtro locale tiene in sync la UI
  const data = useMemo(
    () => (selected === 'tutte' ? items : items.filter(s => s.stato === selected)),
    [items, selected]
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  async function openSegnalazione(s: Segnalazione) {
    // Se sono admin e la segnalazione è "inviata", avvio la revisione prima di navigare
    if (user?.ruolo === 'Amministratore' && s.stato === 'inviata') {
      try {
        await startRevisione(s.id);

        // Ottimismo UI: aggiorno lo stato in lista a "in_lavorazione"
        setItems(prev =>
          prev.map(it => (it.id === s.id ? { ...it, stato: 'in_lavorazione' } : it))
        );
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: e?.response?.data?.message || e?.message || 'Impossibile avviare la revisione.',
        });
        // Anche in caso d'errore, proseguo la navigazione al dettaglio
      }
    }
    // Navigo al dettaglio (passo "review=1" solo per admin, se vuoi sfruttarlo nella pagina)
    router.push({
      pathname: '/segnalazioni/dettaglio/[id]',
      params: { id: String(s.id), review: user?.ruolo === 'Amministratore' ? '1' : undefined },
    });
  }

  async function openRevisione(s: Segnalazione) {
    // Se è "inviata", avvia la revisione lato backend
    if (user?.ruolo === 'Amministratore' && s.stato === 'inviata') {
      try {
        await startRevisione(s.id);
        // aggiorna ottimisticamente lo stato in lista
        setItems(prev => prev.map(it => it.id === s.id ? { ...it, stato: 'in_lavorazione' } : it));
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: e?.response?.data?.message || e?.message || 'Impossibile avviare la revisione.',
        });
        // proseguo comunque alla pagina di revisione
      }
    }

    // naviga alla pagina di revisione
    router.push({ pathname: '/segnalazioni/revisione/[id]', params: { id: String(s.id) } });
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <Surface style={[styles.header, { backgroundColor: surfaceColor }]}>
        <Appbar.Header style={{ backgroundColor: isDarkMode ? '#181A20' : '#fff' }}>
          <Appbar.BackAction onPress={() => router.back()} color={isDarkMode ? '#fff' : '#000'} />
          <Appbar.Content title="Lista Segnalazioni" titleStyle={{ color: isDarkMode ? '#fff' : '#000' }} />
          {user?.ruolo === 'OperatoreCentro' && (
            <IconButton
              icon="plus"
              size={24}
              onPress={() => router.push('/segnalazioni/nuova')}
              iconColor={PRIMARY_COLOR}
              style={{ marginLeft: 8, marginRight: 30, backgroundColor: isDarkMode ? '#23262F' : '#e3f2fd', borderRadius: 20, borderWidth: 2, borderColor: PRIMARY_COLOR }}
            />
          )}
        </Appbar.Header>

        {/* Chips filtro stato */}
        <View style={styles.chipsRow}>
          {(['tutte', 'inviata', 'in_lavorazione', 'chiusa'] as const).map((key) => {
            const isSelected = selected === key;
            const bg = isSelected ? getStatusColorLight(key) : 'transparent';
            const borderColor = isSelected ? getStateColor(key) : mutedTextColor;
            const labelColor = getStateColor(key);
            const label =
              key === 'tutte' ? 'Tutte'
                : key === 'inviata' ? 'Inviate'
                  : key === 'in_lavorazione' ? 'In lavorazione'
                    : 'Chiuse';

            return (
              <Chip
                key={key}
                selected={isSelected}
                onPress={() => setSelected(isSelected ? 'tutte' : key)}
                style={[
                  {
                    marginRight: 8,
                    marginBottom: 8,
                    backgroundColor: bg,
                    borderColor: borderColor,
                    borderWidth: 1,
                  },
                ]}
                textStyle={{
                  color: labelColor,
                  fontWeight: isSelected ? 'bold' : 'normal',
                }}
              >
                {label}
              </Chip>
            );
          })}
        </View>
      </Surface>

        <FlatList
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          data={data as Segnalazione[]}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY_COLOR]}
              progressBackgroundColor={backgroundColor}
              tintColor={PRIMARY_COLOR}
            />
          }
          ListEmptyComponent={() => (
            <View style={[styles.emptyContainer, { backgroundColor }]}>
              <Text style={[styles.emptyText, { color: textColor }]}>
                {error || (loading ? 'Caricamento...' : 'Nessuna segnalazione disponibile')}
              </Text>
              {!loading && (
                <Button
                  mode="outlined"
                  onPress={onRefresh}
                  style={styles.retryButton}
                  textColor={PRIMARY_COLOR}
                >
                  Riprova
                </Button>
              )}
            </View>
          )}

          renderItem={({ item }) => (
            <SegnalazioneCard
              segnalazione={item}
              onPress={openSegnalazione}             // PRIMA era una push diretta
              onRevision={
                user?.ruolo === 'Amministratore'
                  ? openRevisione                // Avvia revisione (se inviata) e naviga
                  : undefined
              }
            />
          )}

          ListHeaderComponent={() => (
            <View style={[styles.infoContainer, { backgroundColor: surfaceColor }]}>
              <Text style={[styles.infoText, { color: textColor }]}>   Le segnalazioni chiuse vengono eliminate automaticamente dopo 7 giorni.
              </Text>
            </View>
          )}

          ListFooterComponent={() => (
            <View style={styles.footerReload}>
              <Button
                mode="outlined"
                onPress={onFooterReload}
                disabled={reloading}
                style={styles.reloadButton}
                textColor={PRIMARY_COLOR}
                buttonColor= {isDarkMode ? 'rgba(0,151,74,0.12)' : ''}
                icon={({ size }) => (
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <MaterialCommunityIcons name="refresh" size={size} color={PRIMARY_COLOR} />
                  </Animated.View>
                )}
              >
                Ricarica elenco
              </Button>
            </View>
          )}
        />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 8,
    elevation: 4,
    padding: 5
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginLeft: 17,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 80,
    paddingHorizontal: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  card: {
    borderRadius: 12,
    marginVertical: 8,
    paddingVertical: 4,
    elevation: Platform.OS === 'android' ? 2 : 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  title: {
    flex: 1,
    fontWeight: '700',
    fontSize: 16
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6
  },
  qtyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EEF3FF',
  },
  qtyText: {
    fontWeight: '700'
  },
  statoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  desc: {
    marginTop: 8,
    lineHeight: 18,
    fontSize: 14
  },
  bottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    opacity: 0.85,
  },
  metaText: {
    fontSize: 13
  },
  ctaRight: {
    alignItems: 'flex-end'
  },
  infoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 12,
  },
  infoCardText: {
    flex: 1,
    fontSize: 14,
    color: '#0d47a1',
  } as any,
  infoContainer: {
    backgroundColor: '#e3f2fd',
    marginHorizontal: 8,
    marginVertical: 4,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: STATUS_COLORS.INFO,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  footerReload: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  reloadButton: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 24,
  },

});
