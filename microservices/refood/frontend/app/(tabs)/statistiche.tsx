import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { Text, Card, Title, Button, Divider, Chip, useTheme } from 'react-native-paper';
import { getActiveToken } from '../../src/services/authService';
// import { useFocusEffect } from 'expo-router'; // non usato
import { PieChart } from 'react-native-chart-kit';
import ImpactChart from '../../src/components/ImpactChart';
import { useAuth } from '../../src/context/AuthContext';
import logger from '../../src/utils/logger';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ThemeContext } from '../../src/context/ThemeContext'; // Importa ThemeContext
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, STORAGE_KEYS } from '../../src/config/constants';
import { useResponsiveContentWidth } from '../../src/hooks/useResponsiveContentWidth';

export default function StatisticheScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statistiche, setStatistiche] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [periodoSelezionato, setPeriodoSelezionato] = useState<'oggi' | 'settimana' | 'mese' | 'anno'>('mese');
  const paperTheme = useTheme(); // Tema di React Native Paper
  const { isDarkMode } = useContext(ThemeContext); // Ottieni lo stato del tema dal contesto

  // Helpers di formattazione
  const formatNum = (n: number) => new Intl.NumberFormat('it-IT').format(Math.round(Number(n || 0)));
  const formatEuro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
  const formatLitri = (l: number) => {
    const v = Number(l || 0);
    if (v >= 1000) return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Math.round(v / 1000))} m\\u00B3`;
    return `${formatNum(v)} L`;
  };

  // CONFIGURAZIONE DEI GRAFICI DINAMICA
  const CHART_CONFIG = useMemo(() => ({
    backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF', // Sfondo del grafico
    backgroundGradientFrom: isDarkMode ? '#1E1E1E' : '#FFFFFF', // Sfondo sfumato (inizio)
    backgroundGradientTo: isDarkMode ? '#1E1E1E' : '#FFFFFF', // Sfondo sfumata (fine)
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(${isDarkMode ? '76, 175, 80' : '76, 175, 80'}, ${opacity})`, // Colore Linea/Barra (verde)
    labelColor: (opacity = 1) => `rgba(${isDarkMode ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`, // Colore etichette (bianco/nero)
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: paperTheme.colors.primary, // Usa il colore primario del tema Paper
    },
    fillShadowGradientFrom: isDarkMode ? 'rgba(76, 175, 80, 0.7)' : 'rgba(76, 175, 80, 0.7)',
    fillShadowGradientTo: isDarkMode ? 'rgba(76, 175, 80, 0)' : 'rgba(76, 175, 80, 0)',
    style: {
      borderRadius: 16,
    },
    // Per i grafici a torta (PieChart) i colori sono gestiti nei dati
    // Per ProgressChart, i colori sono gestiti direttamente
  }), [isDarkMode, paperTheme.colors.primary]); // Dipendenze

  const responsiveContentWidth = useResponsiveContentWidth();
  const chartWidth = responsiveContentWidth;
  const chartInnerWidth = Math.max(10, chartWidth - 32); // tolgo padding cardContent
  const chartHeight = Math.max(220, Math.min(420, Math.round(chartWidth * 0.45)));

  const fetchData = useCallback(async (periodo: 'oggi' | 'settimana' | 'mese' | 'anno') => {
    setLoading(true);
    setError(null);
    try {
      // Token
      const token = await getActiveToken();
      if (!token) throw new Error('Non autenticato');

      // 1) Statistiche complete (backend reale)
      const completeRes = await axios.get(`${API_URL}/statistiche/complete`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { periodo: 'ultimi_12_mesi' }
      });
      const complete = completeRes.data;

      // 2) Counters per KPI
      const countersRes = await axios.get(`${API_URL}/statistiche/counters`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { detailed: true },
      });
      const counters = countersRes.data;

      // 3) Impatto dettagliato (CO2, acqua, valore, kg cibo)
      const impRes = await axios.get(`${API_URL}/statistiche/impatto`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const impatto = impRes.data || {};

      // 4) Mappa ai dati attesi dal layout esistente
      const utentiRegistrati = counters?.utenti?.totale || 0;
      const lottiTotali = counters?.lotti?.totale || 0;
      const prenotazioniTotali = counters?.prenotazioni?.totale || 0;
      const ciboSalvatoKg = Number(impatto?.cibo_salvato_kg || complete?.generali?.totaleAlimentiSalvati || 0);
      const co2RisparmiataKg = Number(impatto?.co2_risparmiata_kg || complete?.generali?.co2Risparmiata || 0);
      const acquaRisparmiataL = Number(impatto?.acqua_risparmiata_litri || 0);
      const valoreEconomicoEur = Number(impatto?.valore_economico_risparmiato || complete?.generali?.valoreEconomicoRisparmiato || 0);
      const tonnellateRiciclate = Math.round((ciboSalvatoKg / 1000) * 100) / 100;
      const alberiSalvati = Math.round((co2RisparmiataKg / 22));

      // Serie perPeriodo per grafici (sostenibilità  nel tempo)
      const labels = (complete?.perPeriodo || []).map((r: any) => r.periodo);
      const datasetCO2 = (complete?.perPeriodo || []).map((r: any) => r.co2Risparmiata || 0);
      const datasetCibo = (complete?.perPeriodo || []).map((r: any) => r.quantitaAlimentiSalvati || 0);
      const datasetAcqua = (complete?.perPeriodo || []).map((r: any) => r.acquaRisparmiata || 0);
      const datasetValore = (complete?.perPeriodo || []).map((r: any) => r.valoreEconomico || 0);

      const lastIdx = Math.max(labels.length - 1, 0);
      const prevIdx = Math.max(labels.length - 2, 0);
      const pct = (a: number, b: number) => (b ? (a - b) / b : 0);
      const trend = {
        cibo: pct(datasetCibo[lastIdx] || 0, datasetCibo[prevIdx] || 0),
        co2: pct(datasetCO2[lastIdx] || 0, datasetCO2[prevIdx] || 0),
        acqua: pct(datasetAcqua[lastIdx] || 0, datasetAcqua[prevIdx] || 0),
        valore: pct(datasetValore[lastIdx] || 0, datasetValore[prevIdx] || 0),
      };

      const mapped = {
        generali: {
          utentiRegistrati,
          lottiTotali,
          prenotazioniTotali,
          tonnellateRiciclate,
          alberiSalvati,
          ciboSalvatoKg,
          co2RisparmiataKg,
          acquaRisparmiataL,
          valoreEconomicoEur,
        },
        perPeriodo: {
          labels,
          datasets: [
            {
              data: datasetCO2,
              color: (opacity = 1) => `rgba(${isDarkMode ? '76, 175, 80' : '76, 175, 80'}, ${opacity})`,
              strokeWidth: 2,
            },
            {
              data: datasetCibo,
              color: (opacity = 1) => `rgba(${isDarkMode ? '33, 150, 243' : '33, 150, 243'}, ${opacity})`,
              strokeWidth: 2,
            },
          ],
          legend: ['CO2 (kg)', 'Cibo (kg)'],
        },
        perPeriodoAcqua: {
          labels,
          datasets: [
            {
              data: datasetAcqua,
              color: (opacity = 1) => `rgba(${isDarkMode ? '33, 150, 243' : '33, 150, 243'}, ${opacity})`,
              strokeWidth: 2,
            },
          ],
          legend: ['Acqua (L)'],
        },
        completamento: (() => {
          const consegnate = counters?.prenotazioni?.consegnate || 0;
          const annullate = counters?.prenotazioni?.annullate || 0;
          const inCorso = Math.max((prenotazioniTotali - consegnate - annullate), 0);
          return {
            labels: ['Completate', 'In Corso', 'Annullate'],
            data: [
              prenotazioniTotali ? consegnate / prenotazioniTotali : 0,
              prenotazioniTotali ? inCorso / prenotazioniTotali : 0,
              prenotazioniTotali ? annullate / prenotazioniTotali : 0,
            ],
            pieData: [
              { name: 'Completate', population: consegnate, color: paperTheme.colors.primary, legendFontColor: isDarkMode ? '#FFFFFF' : '#7F7F7F', legendFontSize: 15 },
              { name: 'In Corso', population: inCorso, color: isDarkMode ? '#DAA520' : '#FFD700', legendFontColor: isDarkMode ? '#FFFFFF' : '#7F7F7F', legendFontSize: 15 },
              { name: 'Annullate', population: annullate, color: isDarkMode ? '#B22222' : '#FF6347', legendFontColor: isDarkMode ? '#FFFFFF' : '#7F7F7F', legendFontSize: 15 },
            ],
          };
        })(),
        lottiPerPeriodo: {
          labels,
          datasets: [
            {
              data: (complete?.perPeriodo || []).map((r: any) => r.valoreEconomico || 0),
              color: (opacity = 1) => `rgba(${isDarkMode ? '76, 175, 80' : '76, 175, 80'}, ${opacity})`,
              strokeWidth: 2,
            },
          ],
          legend: ['Valore Economico (â‚¬)'],
        },
        trend,
      } as any;

      // Costruisci distribuzioni pie chart da counters (se disponibili)
      const lottiPerStatoRaw: any = counters?.lotti?.per_stato || counters?.lotti?.by_state || {};
      const prenPerStatoRaw: any = counters?.prenotazioni?.per_stato || counters?.prenotazioni?.by_state || {};

      const lottiPieData = [
        { key: 'verde', label: 'Verdi', color: '#4CAF50' },
        { key: 'arancione', label: 'Arancioni', color: '#FF9800' },
        { key: 'rosso', label: 'Rossi', color: '#F44336' },
      ].map(d => ({
        name: d.label,
        population: Number(lottiPerStatoRaw?.[d.key] || 0),
        color: d.color,
        legendFontColor: isDarkMode ? '#FFFFFF' : '#7F7F7F',
        legendFontSize: 14,
      })).filter(p => p.population > 0);

      const prenPieData = [
        { key: 'prenotato', label: 'Prenotate', color: '#2196F3' },
        { key: 'consegnato', label: 'Consegnate', color: '#4CAF50' },
        { key: 'annullato', label: 'Annullate', color: '#E53935' },
      ].map(d => ({
        name: d.label,
        population: Number(prenPerStatoRaw?.[d.key] || 0),
        color: d.color,
        legendFontColor: isDarkMode ? '#FFFFFF' : '#7F7F7F',
        legendFontSize: 14,
      })).filter(p => p.population > 0);

      setStatistiche({ ...mapped, distribuzioni: { lottiPieData, prenPieData } });
    } catch (err: any) {
      setError(err.message || 'Impossibile caricare le statistiche.');
      Toast.show({ type: 'error', text1: 'Errore', text2: 'Errore nel caricamento delle statistiche.' });
      logger.error('Errore nel caricamento delle statistiche:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDarkMode, paperTheme.colors.primary]);

  useEffect(() => {
    fetchData(periodoSelezionato);
  }, [fetchData, periodoSelezionato]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(periodoSelezionato);
  }, [fetchData, periodoSelezionato]);

  // Rimosso handleShare perchà© l'icona di condivisione non è pià¹ presente
  // const handleShare = async () => {
  //   try {
  //     if (statistiche) {
  //       const shareMessage = `Statistiche della piattaforma:\n\n` +
  //         `Utenti registrati: ${statistiche.generali.utentiRegistrati}\n` +
  //         `Lotti totali: ${statistiche.generali.lottiTotali}\n` +
  //         `Prenotazioni totali: ${statistiche.generali.prenotazioniTotali}\n` +
  //         `Tonnellate riciclate: ${statistiche.generali.tonnellateRiciclate}\n` +
  //         `Alberi salvati: ${statistiche.generali.alberiSalvati}\n\n` +
  //         `Consulta l'app per maggiori dettagli!`;

  //       await Share.share({
  //         message: shareMessage,
  //         url: 'link_alla_tua_app_o_sito', // Sostituisci con un link reale
  //         title: 'Statistiche Piattaforma',
  //       });
  //     }
  //   } catch (error: any) {
  //     Alert.alert('Errore di condivisione', error.message);
  //   }
  // };

  // Stili dinamici basati sul tema
  const dynamicStyles = useMemo(() => StyleSheet.create({
    // Rimosso appbarHeader e appbarTitle in quanto l'Appbar è stata eliminata
    // appbarHeader: {
    //   backgroundColor: isDarkMode ? '#1E1E1E' : paperTheme.colors.primary,
    // },
    // appbarTitle: {
    //   color: '#FFFFFF',
    // },
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#f5f5f5', // Sfondo principale
    },
    scrollViewContent: {
      padding: 16,
      paddingBottom: 80,
      paddingTop: 16, // Aggiunto padding top per compensare la rimozione dell'Appbar
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#121212' : '#f5f5f5', // Sfondo loading
    },
    loadingText: {
      marginTop: 10,
      color: isDarkMode ? '#CCCCCC' : '#666666',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: isDarkMode ? '#121212' : '#f5f5f5', // Sfondo errore
    },
    errorCard: {
      backgroundColor: isDarkMode ? '#4d0000' : '#ffebee', // Sfondo errore card
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      width: '100%',
    },
    errorText: {
      color: isDarkMode ? '#FFDCDC' : '#d32f2f', // Testo errore
      marginBottom: 15,
      textAlign: 'center',
    },
    retryButton: {
      backgroundColor: paperTheme.colors.primary, // Colore bottone riprova (usa Paper primary)
    },
    retryButtonLabel: {
      color: '#FFFFFF', // Colore testo bottone riprova
    },
    card: {
      marginBottom: 16,
      borderRadius: 12,
      elevation: 3,
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF', // Sfondo card
    },
    cardContent: {
      padding: 16,
    },
    chartBox: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
      color: isDarkMode ? '#FFFFFF' : '#333333', // Titolo card
    },
    kpiContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
      marginTop: 8,
    },
    kpiItem: {
      alignItems: 'center',
      margin: 8,
      width: '40%', // Per due colonne
    },
    kpiNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      color: paperTheme.colors.primary, // Colore KPI (usa Paper primary)
      marginBottom: 4,
    },
    kpiLabel: {
      fontSize: 12,
      color: isDarkMode ? '#CCCCCC' : '#666', // Etichetta KPI
      textAlign: 'center',
    },
    impactContainer: {
      marginTop: 8,
      alignItems: 'center',
    },
    treeImpact: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#224422' : '#E8F5E9', // Sfondo impatto alberi
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    impactText: {
      marginLeft: 8,
      fontSize: 14,
      color: isDarkMode ? '#90EE90' : '#1B5E20', // Testo impatto alberi
    },
    divider: {
      marginVertical: 16,
      backgroundColor: isDarkMode ? '#3A3A3A' : '#E0E0E0', // Colore divider
    },
    chartsContainer: {
      marginTop: 8,
    },
    footer: {
      marginTop: 16,
      alignItems: 'center',
      paddingBottom: 20,
    },
    footerText: {
      fontSize: 14,
      color: isDarkMode ? '#CCCCCC' : '#666', // Testo footer
    },
    footerTimestamp: {
      fontSize: 12,
      color: isDarkMode ? '#888888' : '#999', // Timestamp footer
      marginTop: 4,
    },
    periodSelectorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF', // Sfondo selettore periodo
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#3A3A3A' : '#e0e0e0', // Bordo selettore periodo
      marginBottom: 16,
      borderRadius: 12,
    },
    periodLabel: {
      fontSize: 14,
      color: isDarkMode ? '#FFFFFF' : '#333', // Etichetta periodo
      marginRight: 10,
    },
    // Rimosso menu e menuItemText in quanto il menu è stato eliminato
    // menu: {
    //   backgroundColor: isDarkMode ? '#282828' : '#FFFFFF',
    // },
    // menuItemText: {
    //   color: isDarkMode ? '#FFFFFF' : '#333333',
    // },
    chip: {
      backgroundColor: isDarkMode ? '#3A3A3A' : '#E0E0E0', // Sfondo chip
      marginHorizontal: 4, // Spaziatura tra i chip
    },
    chipSelected: {
      backgroundColor: paperTheme.colors.primary, // Sfondo chip selezionato (usa Paper primary)
    },
    chipText: {
      color: isDarkMode ? '#FFFFFF' : '#333333', // Testo chip
    },
    chipTextSelected: {
      color: '#FFFFFF', // Testo chip selezionato
    },
    chartLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 12,
      marginTop: 16,
      color: isDarkMode ? '#FFFFFF' : '#333333', // Etichetta grafico
    },
    trendChip: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      marginTop: 4,
      gap: 4,
    },
    trendUp: { backgroundColor: 'rgba(76,175,80,0.15)' },
    trendDown: { backgroundColor: 'rgba(244,67,54,0.15)' },
    trendFlat: { backgroundColor: 'rgba(158,158,158,0.15)' },
    trendTextUp: { color: '#388E3C', fontSize: 12, fontWeight: '600' },
    trendTextDown: { color: '#C62828', fontSize: 12, fontWeight: '600' },
    trendTextFlat: { color: isDarkMode ? '#CCCCCC' : '#666666', fontSize: 12, fontWeight: '600' },
    smallTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 6,
      color: isDarkMode ? '#FFFFFF' : '#333333',
      textAlign: 'center',
    },
    noDataText: {
      textAlign: 'center',
      padding: 20,
      color: isDarkMode ? '#CCCCCC' : '#666666',
    },
    distributionsRow: {
      flexDirection: 'column',
      gap: 16,
    },
    distributionItem: {
      marginVertical: 4,
    },
  }), [isDarkMode, paperTheme.colors.primary]);

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator animating={true} color={paperTheme.colors.primary} size="large" />
        <Text style={dynamicStyles.loadingText}>Caricamento statistiche...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={dynamicStyles.errorContainer}>
        <Card style={dynamicStyles.errorCard}>
          <Card.Content>
            <Text style={dynamicStyles.errorText}>{error}</Text>
            <Button mode="contained" onPress={onRefresh} style={dynamicStyles.retryButton} labelStyle={dynamicStyles.retryButtonLabel}>
              Riprova
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      {/* L'Appbar.Header è stato rimosso qui */}

      <ScrollView
        contentContainerStyle={dynamicStyles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[paperTheme.colors.primary]} // Usa il colore primario del tema Paper
            tintColor={paperTheme.colors.primary} // Colore refresh in dark mode
          />
        }
      >
        {/* Selettore Periodo (usato come riga di Chip) */}
        <View style={dynamicStyles.periodSelectorContainer}>
          <Text style={dynamicStyles.periodLabel}>Periodo:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip
              selected={periodoSelezionato === 'oggi'}
              onPress={() => setPeriodoSelezionato('oggi')}
              style={[dynamicStyles.chip, periodoSelezionato === 'oggi' && dynamicStyles.chipSelected]}
              textStyle={[dynamicStyles.chipText, periodoSelezionato === 'oggi' && dynamicStyles.chipTextSelected]}
            >
              Oggi
            </Chip>
            <Chip
              selected={periodoSelezionato === 'settimana'}
              onPress={() => setPeriodoSelezionato('settimana')}
              style={[dynamicStyles.chip, periodoSelezionato === 'settimana' && dynamicStyles.chipSelected]}
              textStyle={[dynamicStyles.chipText, periodoSelezionato === 'settimana' && dynamicStyles.chipTextSelected]}
            >
              Settimana
            </Chip>
            <Chip
              selected={periodoSelezionato === 'mese'}
              onPress={() => setPeriodoSelezionato('mese')}
              style={[dynamicStyles.chip, periodoSelezionato === 'mese' && dynamicStyles.chipSelected]}
              textStyle={[dynamicStyles.chipText, periodoSelezionato === 'mese' && dynamicStyles.chipTextSelected]}
            >
              Mese
            </Chip>
            <Chip
              selected={periodoSelezionato === 'anno'}
              onPress={() => setPeriodoSelezionato('anno')}
              style={[dynamicStyles.chip, periodoSelezionato === 'anno' && dynamicStyles.chipSelected]}
              textStyle={[dynamicStyles.chipText, periodoSelezionato === 'anno' && dynamicStyles.chipTextSelected]}
            >
              Anno
            </Chip>
          </ScrollView>
        </View>

        {/* Card: Statistiche Generali */}
        {statistiche?.generali && (
          <Card style={dynamicStyles.card}>
            <Card.Content style={dynamicStyles.cardContent}>
              <Title style={dynamicStyles.cardTitle}>Impatto Complessivo</Title>
              {/* KPI impatto: Cibo, CO2, Acqua, Valore */}
              <View style={dynamicStyles.kpiContainer}>
                <View style={dynamicStyles.kpiItem}>
                  <Text style={dynamicStyles.kpiNumber}>{formatNum(statistiche.generali.ciboSalvatoKg)} kg</Text>
                  {typeof statistiche?.trend?.cibo === 'number' && (
                    <View style={[dynamicStyles.trendChip, statistiche.trend.cibo > 0 ? dynamicStyles.trendUp : statistiche.trend.cibo < 0 ? dynamicStyles.trendDown : dynamicStyles.trendFlat]}>
                      <Ionicons
                        name={statistiche.trend.cibo > 0 ? 'trending-up' : statistiche.trend.cibo < 0 ? 'trending-down' : 'remove'}
                        size={14}
                        color={statistiche.trend.cibo > 0 ? '#388E3C' : statistiche.trend.cibo < 0 ? '#C62828' : (isDarkMode ? '#CCCCCC' : '#666666')}
                        accessible={false}
                        importantForAccessibility="no"
                      />
                      <Text style={statistiche.trend.cibo > 0 ? dynamicStyles.trendTextUp : statistiche.trend.cibo < 0 ? dynamicStyles.trendTextDown : dynamicStyles.trendTextFlat}>{`${Math.round(Math.abs(statistiche.trend.cibo * 100))}%`}</Text>
                    </View>
                  )}
                  <Text style={dynamicStyles.kpiLabel}>Cibo salvato</Text>
                </View>
                <View style={dynamicStyles.kpiItem}>
                  <Text style={dynamicStyles.kpiNumber}>{formatNum(statistiche.generali.co2RisparmiataKg)} kg</Text>
                  {typeof statistiche?.trend?.co2 === 'number' && (
                    <View style={[dynamicStyles.trendChip, statistiche.trend.co2 > 0 ? dynamicStyles.trendUp : statistiche.trend.co2 < 0 ? dynamicStyles.trendDown : dynamicStyles.trendFlat]}>
                      <Ionicons
                        name={statistiche.trend.co2 > 0 ? 'trending-up' : statistiche.trend.co2 < 0 ? 'trending-down' : 'remove'}
                        size={14}
                        color={statistiche.trend.co2 > 0 ? '#388E3C' : statistiche.trend.co2 < 0 ? '#C62828' : (isDarkMode ? '#CCCCCC' : '#666666')}
                        accessible={false}
                        importantForAccessibility="no"
                      />
                      <Text style={statistiche.trend.co2 > 0 ? dynamicStyles.trendTextUp : statistiche.trend.co2 < 0 ? dynamicStyles.trendTextDown : dynamicStyles.trendTextFlat}>{`${Math.round(Math.abs(statistiche.trend.co2 * 100))}%`}</Text>
                    </View>
                  )}
                  <Text style={dynamicStyles.kpiLabel}>CO2 risparmiata</Text>
                </View>
                <View style={dynamicStyles.kpiItem}>
                  <Text style={dynamicStyles.kpiNumber}>{formatLitri(statistiche.generali.acquaRisparmiataL)}</Text>
                  {typeof statistiche?.trend?.acqua === 'number' && (
                    <View style={[dynamicStyles.trendChip, statistiche.trend.acqua > 0 ? dynamicStyles.trendUp : statistiche.trend.acqua < 0 ? dynamicStyles.trendDown : dynamicStyles.trendFlat]}>
                      <Ionicons
                        name={statistiche.trend.acqua > 0 ? 'trending-up' : statistiche.trend.acqua < 0 ? 'trending-down' : 'remove'}
                        size={14}
                        color={statistiche.trend.acqua > 0 ? '#388E3C' : statistiche.trend.acqua < 0 ? '#C62828' : (isDarkMode ? '#CCCCCC' : '#666666')}
                        accessible={false}
                        importantForAccessibility="no"
                      />
                      <Text style={statistiche.trend.acqua > 0 ? dynamicStyles.trendTextUp : statistiche.trend.acqua < 0 ? dynamicStyles.trendTextDown : dynamicStyles.trendTextFlat}>{`${Math.round(Math.abs(statistiche.trend.acqua * 100))}%`}</Text>
                    </View>
                  )}
                  <Text style={dynamicStyles.kpiLabel}>Acqua risparmiata</Text>
                </View>
                <View style={dynamicStyles.kpiItem}>
                  <Text style={dynamicStyles.kpiNumber}>{formatEuro(statistiche.generali.valoreEconomicoEur)}</Text>
                  {typeof statistiche?.trend?.valore === 'number' && (
                    <View style={[dynamicStyles.trendChip, statistiche.trend.valore > 0 ? dynamicStyles.trendUp : statistiche.trend.valore < 0 ? dynamicStyles.trendDown : dynamicStyles.trendFlat]}>
                      <Ionicons
                        name={statistiche.trend.valore > 0 ? 'trending-up' : statistiche.trend.valore < 0 ? 'trending-down' : 'remove'}
                        size={14}
                        color={statistiche.trend.valore > 0 ? '#388E3C' : statistiche.trend.valore < 0 ? '#C62828' : (isDarkMode ? '#CCCCCC' : '#666666')}
                        accessible={false}
                        importantForAccessibility="no"
                      />
                      <Text style={statistiche.trend.valore > 0 ? dynamicStyles.trendTextUp : statistiche.trend.valore < 0 ? dynamicStyles.trendTextDown : dynamicStyles.trendTextFlat}>{`${Math.round(Math.abs(statistiche.trend.valore * 100))}%`}</Text>
                    </View>
                  )}
                  <Text style={dynamicStyles.kpiLabel}>Valore economico</Text>
                </View>
              </View>

              {/* KPI di sistema secondari */}
              <View style={dynamicStyles.kpiContainer}>
                <View style={dynamicStyles.kpiItem}>
                  <Text style={dynamicStyles.kpiNumber}>{formatNum(statistiche.generali.utentiRegistrati)}</Text>
                  <Text style={dynamicStyles.kpiLabel}>Utenti Registrati</Text>
                </View>
                <View style={dynamicStyles.kpiItem}>
                  <Text style={dynamicStyles.kpiNumber}>{formatNum(statistiche.generali.lottiTotali)}</Text>
                  <Text style={dynamicStyles.kpiLabel}>Lotti Totali</Text>
                </View>
                <View style={dynamicStyles.kpiItem}>
                  <Text style={dynamicStyles.kpiNumber}>{formatNum(statistiche.generali.prenotazioniTotali)}</Text>
                  <Text style={dynamicStyles.kpiLabel}>Prenotazioni Totali</Text>
                </View>
                <View style={dynamicStyles.kpiItem}>
                  <Text style={dynamicStyles.kpiNumber}>{formatNum(statistiche.generali.tonnellateRiciclate)}</Text>
                  <Text style={dynamicStyles.kpiLabel}>Tonnellate Riciclate</Text>
                </View>
              </View>

              {/* Alberi salvati (badge) */}
              <View style={dynamicStyles.impactContainer}>
                <TouchableOpacity style={dynamicStyles.treeImpact}>
                  <Ionicons name="leaf-outline" size={24} color={isDarkMode ? '#90EE90' : '#1B5E20'} />
                  <Text style={dynamicStyles.impactText}>
                    {formatNum(statistiche.generali.alberiSalvati)} Alberi Salvati
                  </Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}

        <Divider style={dynamicStyles.divider} />

        {/* Impatto nel tempo (Cibo/CO2/Acqua) */}
        {statistiche?.perPeriodo && statistiche.perPeriodo.datasets[0]?.data?.length > 0 ? (
          <Card style={dynamicStyles.card}>
            <Card.Content style={dynamicStyles.cardContent}>
              <Text style={dynamicStyles.chartLabel}>Impatto nel tempo</Text>
              <View style={dynamicStyles.chartBox} accessible={false} importantForAccessibility="no">
                <ImpactChart
                  labels={statistiche.perPeriodo.labels}
                  series={[
                    { key: 'co2', name: 'CO2 (kg)', color: '#4CAF50', data: statistiche.perPeriodo.datasets[0].data },
                    { key: 'cibo', name: 'Cibo (kg)', color: '#2196F3', data: statistiche.perPeriodo.datasets[1].data },
                    { key: 'acqua', name: 'Acqua (kL)', color: '#FF9800', data: (statistiche.perPeriodoAcqua?.datasets?.[0]?.data || []).map((v: number) => (v || 0) / 1000) },
                  ]}
                  width={chartInnerWidth}
                  height={chartHeight}
                  isDark={isDarkMode}
                />
              </View>
            </Card.Content>
          </Card>
        ) : (
          <Card style={dynamicStyles.card}>
            <Card.Content style={dynamicStyles.cardContent}>
              <Text style={dynamicStyles.chartLabel}>Impatto nel tempo</Text>
              <Text style={dynamicStyles.noDataText}>Nessun dato disponibile per questo periodo.</Text>
            </Card.Content>
          </Card>
        )}

        <Divider style={dynamicStyles.divider} />

        {/* Completamento prenotazioni */}
        {statistiche?.completamento?.pieData?.length ? (
          <Card style={dynamicStyles.card}>
            <Card.Content style={dynamicStyles.cardContent}>
              <Text style={dynamicStyles.chartLabel}>Completamento Prenotazioni</Text>
              <View style={dynamicStyles.chartBox} accessible={false} importantForAccessibility="no">
                <PieChart
                  data={statistiche.completamento.pieData}
                  width={chartInnerWidth}
                  height={Math.max(220, Math.round(chartHeight * 0.9))}
                  chartConfig={CHART_CONFIG}
                  accessor="population"
                  backgroundColor={'transparent'}
                  paddingLeft={"12"}
                  absolute
                />
              </View>
            </Card.Content>
          </Card>
        ) : (
          <Card style={dynamicStyles.card}>
            <Card.Content style={dynamicStyles.cardContent}>
              <Text style={dynamicStyles.chartLabel}>Completamento Prenotazioni</Text>
              <Text style={dynamicStyles.noDataText}>Nessun dato disponibile.</Text>
            </Card.Content>
          </Card>
        )}

        <Divider style={dynamicStyles.divider} />

        {/* Grafico acqua rimosso nella nuova versione */}

        <Divider style={dynamicStyles.divider} />

        {/* Distribuzione Stati */}
        {statistiche?.distribuzioni && (
          <Card style={dynamicStyles.card}>
            <Card.Content style={dynamicStyles.cardContent}>
              <Text style={dynamicStyles.chartLabel}>Distribuzione Stati</Text>
              <View style={dynamicStyles.distributionsRow}>
                <View style={dynamicStyles.distributionItem}>
                  <Text style={dynamicStyles.smallTitle}>Lotti per stato</Text>
                  {statistiche.distribuzioni.lottiPieData?.length ? (
                    <View style={dynamicStyles.chartBox} accessible={false} importantForAccessibility="no">
                      <PieChart
                        data={statistiche.distribuzioni.lottiPieData}
                        width={chartInnerWidth}
                        height={Math.max(220, Math.round(chartHeight * 0.9))}
                        chartConfig={CHART_CONFIG}
                        accessor="population"
                        backgroundColor={'transparent'}
                        paddingLeft={"12"}
                        absolute
                      />
                    </View>
                  ) : (
                    <Text style={dynamicStyles.noDataText}>Nessun dato disponibile.</Text>
                  )}
                </View>
                <View style={dynamicStyles.distributionItem}>
                  <Text style={dynamicStyles.smallTitle}>Prenotazioni per stato</Text>
                  {statistiche.distribuzioni.prenPieData?.length ? (
                    <View style={dynamicStyles.chartBox} accessible={false} importantForAccessibility="no">
                      <PieChart
                        data={statistiche.distribuzioni.prenPieData}
                        width={chartInnerWidth}
                        height={Math.max(220, Math.round(chartHeight * 0.9))}
                        chartConfig={CHART_CONFIG}
                        accessor="population"
                        backgroundColor={'transparent'}
                        paddingLeft={"12"}
                        absolute
                      />
                    </View>
                  ) : (
                    <Text style={dynamicStyles.noDataText}>Nessun dato disponibile.</Text>
                  )}
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Footer */}
        <View style={dynamicStyles.footer}>
          <Text style={dynamicStyles.footerText}>
            Dati aggiornati al {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}
          </Text>
          <Text style={dynamicStyles.footerTimestamp}>
            ID Utente: {user?.id} | Ruolo: {user?.ruolo}
          </Text>
          <Text style={dynamicStyles.footerTimestamp}>
            Platform: {Platform.OS}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}


