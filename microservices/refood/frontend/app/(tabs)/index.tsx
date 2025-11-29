import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Title, Paragraph, Button, ActivityIndicator, Text, Avatar } from 'react-native-paper';
import { useAuth } from '../../src/context/AuthContext';
import { PRIMARY_COLOR, STORAGE_KEYS, API_URL } from '../../src/config/constants';
import { router } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeContext } from '../../src/context/ThemeContext';
import { formatInt } from '../../src/utils/numbers';
import { normalizeCounters, NormalizedCounters } from '../../src/utils/normalizeCounters';
import { fetchOverviewGenerali, OverviewGenerali } from '../../src/services/overviewService';
import { getActiveToken } from '../../src/services/authService';

const ZERO_COUNTERS: NormalizedCounters = {
  lotti: { attivi: 0, inScadenza: 0, totale: 0 },
  prenotazioni: { attive: 0, consegnate: 0, totale: 0 },
  segnalazioni: { aperte: 0 },
};

export default function TabOneScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NormalizedCounters | null>(null);
  const [overview, setOverview] = useState<OverviewGenerali | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { isDarkMode } = useThemeContext();
  const { width } = useWindowDimensions();
  const isPhone = width < 600;
  const isSmallPhone = width < 360;
  const shouldStackActions = width < 420;
  const contentHorizontalPadding = isSmallPhone ? 16 : 24;
  const sectionSpacing = isSmallPhone ? 12 : 16;

  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const textColor = isDarkMode ? '#fff' : '#000';

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getActiveToken();
      if (!token) {
        setError('Sessione scaduta. Effettua nuovamente il login.');
        setLoading(false);
        return;
      }

      // Counters (attivi, in scadenza, ecc.)
      const countersRes = await axios.get(`${API_URL}/statistiche/counters?detailed=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const norm = normalizeCounters(countersRes.data);
      setStats(norm);

      // Overview con gli stessi totali usati in Statistiche
      const ov = await fetchOverviewGenerali(token);
      setOverview(ov);

      // Debug (se serve)
      // console.log('Counters NORMALIZED:', JSON.stringify(norm, null, 2));
      // console.log('Overview GENERALI:', JSON.stringify(ov, null, 2));
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Impossibile caricare le statistiche');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const s = stats ?? ZERO_COUNTERS;

  if (!user) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
        <View style={[styles.loadingContainer, { paddingHorizontal: contentHorizontalPadding }]}>
          <Text style={{ color: textColor, fontSize: 20, marginBottom: 20 }}>
            Tema {isDarkMode ? 'Scuro' : 'Chiaro'}
          </Text>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingHorizontal: contentHorizontalPadding,
            paddingTop: sectionSpacing,
            paddingBottom: sectionSpacing * 2,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
        }
      >
      {/* Card benvenuto */}
      <Card
        style={[
          styles.welcomeCard,
          { backgroundColor: isDarkMode ? '#1e1e1e' : '#fff', marginBottom: sectionSpacing },
        ]}
      >
        <View style={styles.notificationContainer}>
          <Card.Content style={styles.welcomeContent}>
            <View style={styles.welcomeHeader}>
              <Avatar.Icon size={50} icon="account" style={styles.avatar} color="#fff" />
              <View style={styles.welcomeTextContainer}>
                <Title style={[styles.welcomeTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                  Benvenuto, {user.nome}!
                </Title>
                <Text style={[styles.welcomeSubtitle, { color: isDarkMode ? '#ccc' : '#666' }]}>
                  {user.ruolo === 'OperatoreCentro'
                    ? 'Centro associato Refood'
                    : user.ruolo === 'Operatore'
                    ? 'Operatore Refood'
                    : user.ruolo === 'Amministratore'
                    ? 'Amministratore Refood'
                    : `${user.ruolo} Refood`}
                </Text>
              </View>
            </View>
          </Card.Content>
        </View>
      </Card>

      {/* Riepilogo del giorno */}
      {!loading && !error && (
        <Card style={[styles.highlightCard, { marginBottom: sectionSpacing }]}>
          <View style={styles.cardHeader}>
            <Card.Title
              title="Riepilogo del giorno"
              titleStyle={{ color: textColor }}
              left={() => <MaterialCommunityIcons name="chart-timeline-variant" size={30} color={PRIMARY_COLOR} />}
            />
          </View>
          <Card.Content>
            <View style={styles.highlightStats}>
              {/* Lotti attivi: dai counters */}
              <View style={[styles.highlightItem, isPhone ? styles.highlightItemHalf : styles.highlightItemQuarter]}>
                <MaterialCommunityIcons name="food-apple" size={24} color="#4CAF50" style={{ marginLeft: -6 }} />
                <Text style={[styles.highlightNumber, { color: isDarkMode ? '#fff' : '#000' }]}>{formatInt(s.lotti.attivi)}</Text>
                <Text style={[styles.highlightLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Lotti attivi</Text>
              </View>

              {/* Prenotazioni: usa i totali della pagina Statistiche */}
              <View style={[styles.highlightItem, isPhone ? styles.highlightItemHalf : styles.highlightItemQuarter]}>
                <MaterialCommunityIcons name="truck-delivery" size={24} color="#FF9800" style={{ marginLeft: 7 }} />
                <Text style={[styles.highlightNumber, { color: isDarkMode ? '#fff' : '#000' }]}>
                  {formatInt(overview?.prenotazioniTotali ?? s.prenotazioni.attive)}
                </Text>
                <Text style={[styles.highlightLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Prenotazioni Totali</Text>
              </View>

              {/* In scadenza: dai counters */}
              <View style={[styles.highlightItem, isPhone ? styles.highlightItemHalf : styles.highlightItemQuarter]}>
                <MaterialCommunityIcons name="alert-circle" size={24} color="#F44336" style={{ marginLeft: 7 }} />
                <Text style={[styles.highlightNumber, { color: isDarkMode ? '#fff' : '#000' }]}>{formatInt(s.lotti.inScadenza)}</Text>
                <Text style={[styles.highlightLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>In scadenza</Text>
              </View>

              {/* Segnalazioni: dai counters */}
              <View style={[styles.highlightItem, isPhone ? styles.highlightItemHalf : styles.highlightItemQuarter]}>
                <MaterialCommunityIcons name="alert-decagram" size={24} color="#E53935" />
                <Text style={[styles.highlightNumber, { color: isDarkMode ? '#fff' : '#000' }]}>
                  {formatInt(s.segnalazioni.aperte)}
                </Text>
                <Text style={[styles.highlightLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Segnalazioni</Text>
              </View>
            </View>

            <View style={styles.todayActivities}>
              <Text style={[styles.todayActivitiesTitle, { color: isDarkMode ? '#fff' : '#000' }]}>Attività  oggi</Text>
              <View style={styles.todayActivitiesContainer}>
                <View style={styles.todayActivityItem}>
                  <View style={styles.todayActivityIconContainer}>
                    <MaterialCommunityIcons name="basket-plus" size={18} color="#fff" />
                  </View>
                  <Text style={[styles.todayActivityValue, { color: isDarkMode ? '#fff' : '#000' }]}>
                    {formatInt((s as any)?.attivita?.lotti_inseriti_oggi || 0)}
                  </Text>
                  <Text style={[styles.todayActivityLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Lotti inseriti</Text>
                </View>
                <View style={styles.todayActivityItem}>
                  <View style={[styles.todayActivityIconContainer, { backgroundColor: '#2196F3' }]}>
                    <MaterialCommunityIcons name="calendar-plus" size={18} color="#fff" />
                  </View>
                  <Text style={[styles.todayActivityValue, { color: isDarkMode ? '#fff' : '#000' }]}>
                    {formatInt((s as any)?.attivita?.prenotazioni_oggi || 0)}
                  </Text>
                  <Text style={[styles.todayActivityLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Prenotazioni</Text>
                </View>
                <View style={styles.todayActivityItem}>
                  <View style={[styles.todayActivityIconContainer, { backgroundColor: '#FF9800' }]}>
                    <MaterialCommunityIcons name="autorenew" size={18} color="#fff" />
                  </View>
                  <Text style={[styles.todayActivityValue, { color: isDarkMode ? '#fff' : '#000' }]}>
                    {formatInt((s as any)?.attivita?.cambi_stato || 0)}
                  </Text>
                  <Text style={[styles.todayActivityLabel, { color: isDarkMode ? '#ccc' : '#666' }]}>Cambi stato</Text>
                </View>
              </View>
              <View style={styles.lastUpdateContainer}>
                <Text style={styles.lastUpdateText}>
                  Ultimo aggiornamento: {new Date().toLocaleTimeString()}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : error ? (
        <Card style={[styles.errorCard, { marginBottom: sectionSpacing }]}>
          <Card.Content>
            <Paragraph style={styles.errorText}>{error}</Paragraph>
            <Button mode="contained" onPress={loadStats} style={styles.retryButton}>
              Riprova
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <>
          {user.ruolo === 'Operatore' && (
            <OperatoreContent
              stats={s}
              isDarkMode={isDarkMode}
              shouldStackActions={shouldStackActions}
            />
          )}
          {user.ruolo === 'Amministratore' && (
            <AmministratoreContent
              stats={s}
              overview={overview}
              user={user}
              textColor={textColor}
              isDarkMode={isDarkMode}
            />
          )}
          {user.ruolo === 'CentroSociale' && <CentroSocialeContent stats={s} />}
          {user.ruolo === 'CentroRiciclaggio' && <CentroRiciclaggioContent stats={s} />}
          {user.ruolo === 'OperatoreCentro' && (
            <OperatoreCentroContent
              isDarkMode={isDarkMode}
              shouldStackActions={shouldStackActions}
            />
          )}
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- componenti ruolo (solo Amministratore usa anche "overview") ---

const OperatoreContent = ({ stats, isDarkMode, shouldStackActions }: { stats: any, isDarkMode: boolean, shouldStackActions: boolean }) => (
  <Card style={styles.roleCard}>
    <Card.Title
      title="I Tuoi Lotti"
      titleStyle={{ color: isDarkMode ? '#fff' : undefined }}
      left={() => <MaterialCommunityIcons name="basket" size={30} color="#4CAF50" />}
    />
    <Card.Content>
      <View style={styles.operatoreStats}>
        <View style={styles.operatoreIcon}>
          <MaterialCommunityIcons name="basket-plus" size={48} color="#4CAF50" />
        </View>
        <View style={styles.operatoreInfo}>
          <Text style={[styles.operatoreInfoText, isDarkMode && { color: '#fff' }]}>
            Hai inserito <Text style={styles.operatoreHighlight}>{formatInt((stats as any)?.operatore?.lotti_inseriti || 0)}</Text> lotti
          </Text>
          <Text style={[styles.operatoreInfoText, isDarkMode && { color: '#fff' }]}>
            Di cui <Text style={styles.operatoreHighlight}>{formatInt((stats as any)?.operatore?.lotti_attivi || 0)}</Text> ancora attivi
          </Text>
          <View style={[styles.operatoreActions, shouldStackActions && styles.operatoreActionsStacked]}>
            <Button mode="contained" icon="plus" onPress={() => router.push('/lotti/nuovo')} style={[styles.operatoreButton, shouldStackActions && styles.operatoreButtonStacked]}>
              Nuovo Lotto
            </Button>
            <Button
              mode="outlined"
              icon="view-list"
              onPress={() => router.push('/(tabs)/lotti')}
              style={[styles.operatoreButton, { borderColor: PRIMARY_COLOR}, shouldStackActions && styles.operatoreButtonStacked]}
              buttonColor='rgba(0,151,74,0.12)'
            >
              Gestisci
            </Button>
          </View>
        </View>
      </View>
      <View style={[styles.personaleStats, isDarkMode && { backgroundColor: '#1e1e1e' }]}>
        <Text style={[styles.personaleTitle, isDarkMode && { color: '#fff' }]}>Il tuo contributo</Text>
        <View style={styles.personaleRow}>
          <View style={styles.personaleItem}>
            <MaterialCommunityIcons name="calendar-check" size={24} color="#4CAF50" />
            <Text style={[styles.personaleValue, isDarkMode && { color: '#fff' }]}>{formatInt((stats as any)?.operatore?.lotti_della_settimana || 0)}</Text>
            <Text style={[styles.personaleLabel, isDarkMode && { color: '#fff' }]}>Questa settimana</Text>
          </View>
          <View style={styles.personaleItem}>
            <MaterialCommunityIcons name="weight" size={24} color="#4CAF50" />
            <Text style={[styles.personaleValue, isDarkMode && { color: '#fff' }]}>{formatInt((stats as any)?.operatore?.kg_salvati || 0)} kg</Text>
            <Text style={[styles.personaleLabel, isDarkMode && { color: '#fff' }]}>Cibo salvato</Text>
          </View>
        </View>
      </View>
    </Card.Content>
  </Card>
);

const AmministratoreContent = ({
  stats,
  overview,
  user,
  textColor,
  isDarkMode,
}: {
  stats: any;
  overview: OverviewGenerali | null;
  user: any;
  textColor: string;
  isDarkMode: boolean;
}) => {
  return (
    <Card style={styles.roleCard}>
      <Card.Title
        title="Dashboard Amministratore"
        titleStyle={{ color: textColor }}
        left={() => <MaterialCommunityIcons name="view-dashboard" size={30} color={PRIMARY_COLOR} />}
      />
      <Card.Content>
        <View style={styles.adminStatsContainer}>
          <View style={styles.adminStatsRow}>
            <View style={[styles.adminStat, styles.blueStat]}>
              <MaterialCommunityIcons name="food-apple" size={28} color="#fff" />
              <Text style={styles.adminStatNumber}>
                {formatInt(overview?.lottiTotali ?? (stats as any)?.lotti?.totale ?? 0)}
              </Text>
              <Text style={styles.adminStatLabel}>Lotti Totali</Text>
            </View>
            <View style={[styles.adminStat, styles.purpleStat]}>
              <MaterialCommunityIcons name="truck-delivery" size={28} color="#fff" />
              <Text style={styles.adminStatNumber}>
                {formatInt(overview?.prenotazioniTotali ?? (stats as any)?.prenotazioni?.totale ?? 0)}
              </Text>
              <Text style={styles.adminStatLabel}>Prenotazioni Totali</Text>
            </View>
          </View>
          <View style={styles.adminStatsRow}>
            <View style={[styles.adminStat, styles.orangeStat]}>
              <MaterialCommunityIcons name="calendar-clock" size={28} color="#fff" />
              <Text style={styles.adminStatNumber}>{formatInt((stats as any)?.attivita?.oggi || 0)}</Text>
              <Text style={styles.adminStatLabel}>Attività Oggi</Text>
            </View>
            <View style={[styles.adminStat, styles.greenStat]}>
              <MaterialCommunityIcons name="check-circle" size={28} color="#fff" />
              <Text style={styles.adminStatNumber}>{formatInt((stats as any)?.prenotazioni?.consegnate || 0)}</Text>
              <Text style={styles.adminStatLabel}>Consegnati</Text>
            </View>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const CentroSocialeContent = ({ stats }: { stats: any }) => {
  return (
    <Card style={styles.roleCard}>
      <Card.Title
        title="I Tuoi Lotti Disponibili"
        left={() => <MaterialCommunityIcons name="hand-heart" size={30} color="#FF9800" />}
      />
      <Card.Content>
        <Text style={styles.centroSocialeText}>Lotti arancioni riservati per il tuo centro</Text>
        <View style={styles.lottiBadge}>
          <MaterialCommunityIcons name="food-apple" size={40} color="#FF9800" />
          <Text style={styles.lottiBadgeNumber}>{formatInt((stats as any)?.lotti?.per_stato?.arancione || 0)}</Text>
          <Text style={styles.lottiBadgeLabel}>Lotti Arancioni</Text>
        </View>
      </Card.Content>
    </Card>
  );
};

const CentroRiciclaggioContent = ({ stats }: { stats: any }) => (
  <Card style={styles.roleCard}>
    <Card.Title
      title="Lotti per Riciclaggio"
      left={() => <MaterialCommunityIcons name="recycle" size={30} color="#F44336" />}
    />
    <Card.Content>
      <Text style={styles.centroRicicloText}>Lotti rossi disponibili per il tuo centro</Text>
      <View style={styles.lottiBadge}>
        <MaterialCommunityIcons name="food-apple" size={40} color="#F44336" />
        <Text style={styles.lottiBadgeNumber}>{formatInt((stats as any)?.lotti?.per_stato?.rosso || 0)}</Text>
        <Text style={styles.lottiBadgeLabel}>Lotti Rossi</Text>
      </View>
    </Card.Content>
  </Card>
);

const OperatoreCentroContent = ({ isDarkMode, shouldStackActions }: { isDarkMode: boolean, shouldStackActions: boolean }) => (
  <Card style={styles.roleCard}>
    <Card.Title
      title="Segnalazioni"
      titleStyle={{ color: isDarkMode ? '#fff' : undefined }}
      left={() => <MaterialCommunityIcons name="alert-circle" size={30} color="#F44336" />}
    />
    <Card.Content>
      <Text style={[styles.operatoreInfoText, isDarkMode && { color: '#fff', marginBottom: 12 }]}>
        Segnala prodotti non conformi per il ritiro o lo smaltimento.
      </Text>
      <View style={[styles.operatoreActions, shouldStackActions && styles.operatoreActionsStacked]}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => router.push('/segnalazioni/nuova')}
          style={[styles.operatoreButton, shouldStackActions && styles.operatoreButtonStacked]}
          buttonColor="#F44336"
          textColor={isDarkMode ? '#181A20' : '#fff'}
        >
          Segnala Prodotto
        </Button>
        <Button
          mode="outlined"
          icon="view-list"
          onPress={() => router.push('/(tabs)/segnalazioni')}
          style={[styles.operatoreButton, { borderColor: '#F44336' }, shouldStackActions && styles.operatoreButtonStacked]}
          buttonColor='rgba(229,57,53,0.12)'
          textColor="#F44336"
        >
          Stato Segnalazioni
        </Button>
      </View>
    </Card.Content>
  </Card>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: {},
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  welcomeCard: { margin: 0, elevation: 4, borderRadius: 12 },
  notificationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  welcomeContent: { flex: 1, paddingVertical: 8 },
  welcomeHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { backgroundColor: PRIMARY_COLOR, marginRight: 16 },
  welcomeTextContainer: { flex: 1 },
  welcomeTitle: { fontSize: 22, fontWeight: 'bold' },
  welcomeSubtitle: { fontSize: 16, color: '#666', marginTop: 4 },
  highlightCard: { margin: 0, elevation: 4, borderRadius: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  highlightStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, flexWrap: 'wrap' },
  highlightItem: { alignItems: 'center', marginVertical: 8 },
  highlightItemHalf: { flexBasis: '47%' },
  highlightItemQuarter: { flexBasis: '23%', minWidth: 120 },
  highlightNumber: { fontSize: 22, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  highlightLabel: { fontSize: 14, color: '#666' },
  todayActivities: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 16 },
  todayActivitiesTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  todayActivitiesContainer: { flexDirection: 'row', justifyContent: 'space-around' },
  todayActivityItem: { alignItems: 'center' },
  todayActivityIconContainer: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#4CAF50',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  todayActivityValue: { fontSize: 16, fontWeight: 'bold' },
  todayActivityLabel: { fontSize: 12, color: '#666' },
  lastUpdateContainer: { marginTop: 12, alignItems: 'center' },
  lastUpdateText: { fontSize: 11, color: '#999', fontStyle: 'italic' },
  roleCard: { margin: 0, elevation: 3, borderRadius: 12 },
  operatoreStats: { flexDirection: 'row', paddingVertical: 8 },
  operatoreIcon: { width: 80, justifyContent: 'center', alignItems: 'center' },
  operatoreInfo: { flex: 1, justifyContent: 'center' },
  operatoreInfoText: { fontSize: 16, marginBottom: 8 },
  operatoreHighlight: { fontWeight: 'bold', color: '#4CAF50' },
  operatoreActions: { flexDirection: 'row', marginTop: 8 },
  operatoreActionsStacked: { flexDirection: 'column' },
  operatoreButton: { flex: 1, marginHorizontal: 4 },
  operatoreButtonStacked: { flex: 0, width: '100%', marginHorizontal: 0, marginVertical: 4 },
  adminStatsContainer: { marginVertical: 8 },
  adminStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  adminStat: { width: '48%', borderRadius: 8, padding: 12, alignItems: 'center' },
  blueStat: { backgroundColor: '#2196F3' },
  purpleStat: { backgroundColor: '#673AB7' },
  orangeStat: { backgroundColor: '#FF9800' },
  greenStat: { backgroundColor: '#4CAF50' },
  adminStatNumber: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginVertical: 4 },
  adminStatLabel: { fontSize: 14, color: '#fff' },
  centroSocialeText: { fontSize: 16, textAlign: 'center', marginVertical: 8 },
  lottiBadge: { alignItems: 'center', marginVertical: 16 },
  lottiBadgeNumber: { fontSize: 32, fontWeight: 'bold', marginTop: 8 },
  lottiBadgeLabel: { fontSize: 14, color: '#666' },
  centroRicicloText: { fontSize: 16, textAlign: 'center', marginVertical: 8 },
  errorCard: { margin: 0, backgroundColor: '#ffebee', borderRadius: 12 },
  errorText: { color: '#d32f2f', marginBottom: 10 },
  retryButton: { backgroundColor: '#4CAF50' },
  personaleStats: { marginTop: 16, padding: 8, borderRadius: 8, backgroundColor: '#f5f5f5' },
  personaleTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  personaleRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  personaleItem: { alignItems: 'center', padding: 8 },
  personaleValue: { fontSize: 18, fontWeight: 'bold', marginVertical: 4, color: '#333' },
  personaleLabel: { fontSize: 12, color: '#666', textAlign: 'center' },
});

