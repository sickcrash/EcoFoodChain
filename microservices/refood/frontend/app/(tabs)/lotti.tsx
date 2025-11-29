import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Platform, TouchableOpacity } from 'react-native';
import { Text, Button, Surface, Searchbar, IconButton, Chip } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getLotti, Lotto, invalidateCache, LottoFiltri } from '../../src/services/lottiService';
import LottoCard from '../../src/components/LottoCard';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { PRIMARY_COLOR, STATUS_COLORS } from '../../src/config/constants';
import { ThemeContext } from '../../src/context/ThemeContext'
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Costanti locali per gli stati dei lotti disponibili
const STATI_LOTTI = {
  VERDE: 'Verde',
  ARANCIONE: 'Arancione',
  ROSSO: 'Rosso'
};

export default function LottiScreen() {
  // Stati per gestire i dati e le interazioni dell'utente
  const [lotti, setLotti] = useState<Lotto[]>([]);
  const [lottiNonFiltrati, setLottiNonFiltrati] = useState<Lotto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStato, setSelectedStato] = useState<string | null>(null);

  // Per intercettare la navigazione con refresh (non serve più)
  // const [shouldRefresh, setShouldRefresh] = useState(false);
  
  // Ottieni l'utente autenticato
  const { user } = useAuth();
  
  // Ottieni il tema
  const { isDarkMode } = useContext(ThemeContext);

  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const surfaceColor = isDarkMode ? '#1e1e1e' : '#fff';
  const textColor = isDarkMode ? '#fff' : '#000';
  const mutedTextColor = isDarkMode ? '#ccc' : '#666';
  const inputBackgroundColor = isDarkMode ? '#333' : '#fff';

  // Funzione per filtrare localmente i lotti in base al testo di ricerca
  const filtroLocale = (testo: string, lottiDaFiltrare: Lotto[]): Lotto[] => {
    if (!testo.trim()) return lottiDaFiltrare;
    
    const testoNormalizzato = testo.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // rimuove accenti
    
    return lottiDaFiltrare.filter(lotto => {
      const nome = (lotto.nome || "").toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // Cerca solo nel nome del lotto
      return nome.includes(testoNormalizzato);
    });
  };
  
  // Carica i lotti dal servizio API
  const loadLotti = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Costruisci i filtri (senza includere il testo di ricerca)
      const filtri: LottoFiltri = {};
      if (selectedStato) {
        filtri.stato = selectedStato.toUpperCase();
      }

      // Verifica se l'utente è amministratore o operatore
      const isAdmin = user?.ruolo === 'Amministratore';
      const isOperatore = user?.ruolo === 'Operatore';
      const isOperatoreCentro = user?.ruolo === 'OperatoreCentro';
      const mostraTutti = isAdmin || isOperatore || isOperatoreCentro;

      // Chiamata al servizio con il parametro mostraTutti per amministratori e operatori
      const response = await getLotti(filtri, forceRefresh, mostraTutti);

      const lottiTotali = response.lotti || [];

      // Salva tutti i lotti non filtrati
      setLottiNonFiltrati(lottiTotali);

      // Applica il filtro di ricerca locale se necessario
      setLotti(lottiTotali);

      if (lottiTotali.length === 0) {
        if (Object.keys(filtri).length > 0) {
          setError('Nessun lotto trovato con i filtri selezionati');
        } else {
          setError('Nessun lotto disponibile al momento');
        }
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Si è verificato un errore durante il caricamento dei lotti');
      console.error('Errore nel caricamento dei lotti:', err);

      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile caricare i lotti',
        visibilityTime: 3000,
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setIsSearching(false);
    }
  }, [selectedStato, user?.ruolo]);
  
  // Ricarica i dati quando la schermata riceve il focus
  useFocusEffect(
    useCallback(() => {
      invalidateCache();
      loadLotti(true);
      return undefined;
    }, [loadLotti])
  );

  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    loadLotti();
  }, [selectedStato, loadLotti]);
  
  // Gestione della ricerca con debounce
  useEffect(() => {
    const debounceFn = setTimeout(() => {
      if (!isLoading && !refreshing) {
        if (lottiNonFiltrati.length > 0) {
          // Se abbiamo già caricato i lotti, filtriamo localmente
          setIsSearching(true);
          const lottiFiltrati = filtroLocale(searchText, lottiNonFiltrati);
          setLotti(lottiFiltrati);
          
          if (lottiFiltrati.length === 0 && searchText.trim()) {
            setError('Nessun lotto corrisponde alla tua ricerca');
          } else if (lottiFiltrati.length === 0) {
            setError('Nessun lotto disponibile al momento');
          } else {
            setError(null);
          }
          
          setIsSearching(false);
        } else {
          loadLotti();
        }
      }
    }, 300);

    return () => clearTimeout(debounceFn);
  }, [searchText, lottiNonFiltrati, loadLotti, isLoading, refreshing]);
  
  // Gestisce l'azione di pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    invalidateCache();
    loadLotti(true);
  };
  
  // Gestione della cancellazione della ricerca
  const handleClearSearch = () => {
    setSearchText('');
    // Ripristina i lotti non filtrati
    setLotti(lottiNonFiltrati);
    if (lottiNonFiltrati.length === 0) {
      setError('Nessun lotto disponibile al momento');
    } else {
      setError(null);
    }
  };
  
  // Resetta tutti i filtri
  const resetFiltri = () => {
    setSelectedStato(null);
    setError(null);
    loadLotti(true);
  };
  
  // Naviga al dettaglio del lotto
  const navigateToLottoDetail = (lotto: Lotto) => {
    router.push({
      pathname: '/lotti/dettaglio/[id]',
      params: { id: lotto.id.toString() }
    });
  };
  
  // Naviga alla schermata di creazione lotto
  const navigateToCreateLotto = () => {
    router.push('/lotti/nuovo');
  };
  
  // Funzioni di utilità per il modale
  const getStateColor = (stato: string) => {
    switch (stato.toUpperCase()) {
      case 'VERDE':
        return STATUS_COLORS.SUCCESS;
      case 'ARANCIONE':
        return STATUS_COLORS.WARNING;
      case 'ROSSO':
        return STATUS_COLORS.ERROR;
      default:
        return STATUS_COLORS.INFO;
    }
  };

  const getStatusColorLight = (stato: string) => {
    switch (stato) {
      case STATI_LOTTI.VERDE:
        return 'rgba(76, 175, 80, 0.2)';
      case STATI_LOTTI.ARANCIONE:
        return 'rgba(255, 152, 0, 0.2)';
      case STATI_LOTTI.ROSSO:
        return 'rgba(244, 67, 54, 0.2)';
      default:
        return 'rgba(33, 150, 243, 0.2)';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#121212' : '#f5f5f5' }]}> 
      {/* Header con barra di ricerca e filtri */}
 <Surface style={[styles.header, { backgroundColor: surfaceColor }]}> 
  {/* Header con titolo e icona filtro */}
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
  <Text style={{ fontSize: 20, fontWeight: 'bold', color: textColor }}>Lotti disponibili</Text>
  {(user?.ruolo === 'Amministratore' || user?.ruolo === 'Operatore') && (
    <IconButton
      icon="plus"
      size={24}
      onPress={navigateToCreateLotto}
      iconColor={PRIMARY_COLOR}
      style={{ marginLeft: 8, backgroundColor: isDarkMode ? '#23262F' : '#e3f2fd', borderRadius: 20, borderWidth: 2, borderColor: PRIMARY_COLOR }}
    />
  )}
</View>
  {/* Searchbar con icona clear */}
  <View style={{ position: 'relative', marginTop: 8 }}>
    <Searchbar
      placeholder="Cerca lotti..."
      onChangeText={setSearchText}
      value={searchText}
      style={[styles.searchBar, { backgroundColor: inputBackgroundColor }]}
      inputStyle={{ color: textColor }}
      placeholderTextColor={mutedTextColor}
      iconColor={mutedTextColor}
      loading={isSearching}
      right={() => null}
    />
    {searchText.length > 0 && (
      <TouchableOpacity
        onPress={handleClearSearch}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: [{ translateY: -12 }],
          zIndex: 1
        }}
      >
        <MaterialCommunityIcons name="close-circle" size={24} color={mutedTextColor} />
      </TouchableOpacity>
    )}
  </View>

  {/* Chip dei colori */}
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
    {Object.values(STATI_LOTTI).map(stato => (
      <Chip
        key={stato}
        selected={selectedStato === stato}
        onPress={() => setSelectedStato(selectedStato === stato ? null : stato)}
        style={{
          marginRight: 8,
          marginBottom: 8,
          backgroundColor: selectedStato === stato ? getStatusColorLight(stato) : 'transparent',
          borderColor: selectedStato === stato ? getStateColor(stato) : mutedTextColor,
          borderWidth: 1,
        }}
        textStyle={{
          color: getStateColor(stato),
          fontWeight: selectedStato === stato ? 'bold' : 'normal',
        }}
      >
        {stato}
      </Chip>
    ))}
    {(selectedStato || searchText.trim()) && (
      <Chip
        icon="close"
        onPress={() => {
          resetFiltri();
          handleClearSearch();
        }}
        style={{
          marginRight: 8,
          marginBottom: 8,
          backgroundColor: isDarkMode ? '#444' : '#eee',
        }}
        textStyle={{
          color: PRIMARY_COLOR,
        }}
      >
        Reset
      </Chip>
    )}
  </View>
</Surface>

  {/* Messaggio di debug: conteggio lotti caricati e visibili */}
  <View style={{ marginHorizontal: 8, marginTop: 8, marginBottom: 0 }}>
    <Text style={{ fontSize: 13, color: '#888' }}>
      Debug: lotti caricati dal backend: {lottiNonFiltrati.length} • lotti mostrati: {lotti.length}
    </Text>
  </View>

  {/* Lista dei lotti */}
  <FlatList
    data={lotti}
    renderItem={({ item }) => (
      <LottoCard
        lotto={item}
        onPress={navigateToLottoDetail}
        onElimina={async (lotto) => {
          try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/lotti/${lotto.id}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${user?.token}`,
              },
            });
            if (response.ok) {
              Toast.show({
                type: 'success',
                text1: 'Lotto eliminato',
                text2: 'Il lotto è stato eliminato con successo.',
              });
              await loadLotti(true);
            } else if (response.status === 404) {
              Toast.show({
                type: 'info',
                text1: 'Lotto non trovato',
                text2: 'Il lotto era già stato eliminato o non esiste.',
              });
              await loadLotti(true);
            } else {
              const errText = await response.text();
              Toast.show({
                type: 'error',
                text1: 'Errore eliminazione lotto',
                text2: errText || 'Impossibile eliminare il lotto dal database',
              });
            }
          } catch (err) {
            Toast.show({
              type: 'error',
              text1: 'Errore eliminazione lotto',
              text2: String(err) || 'Impossibile eliminare il lotto dal database',
            });
          }
        }}
      />
    )}
    keyExtractor={(item) => item.id.toString()}
    contentContainerStyle={styles.listContent}
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
    ListEmptyComponent={() => (
      <View style={[styles.emptyContainer, { backgroundColor }]}> 
        <Text style={[styles.emptyText, { color: textColor }]}> 
          {error || (isLoading ? 'Caricamento...' : 'Nessun lotto disponibile')}
        </Text>
        {!isLoading && (
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
    ListHeaderComponent={() => (
      <View style={[styles.infoContainer, { backgroundColor: surfaceColor }]}> 
        <Text style={[styles.infoText, { color: textColor }]}> 
          {user?.ruolo === 'Amministratore' || user?.ruolo === 'Operatore'
            ? '⚠️ Stai visualizzando tutti i lotti, inclusi quelli già prenotati.'
            : 'ℹ️ Stai visualizzando solo i lotti disponibili. I prenotati non sono mostrati.'}
        </Text>
      </View>
    )}
  />
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 8,
    elevation: 4,
    backgroundColor: '#fff',
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  filterButton: {
    flex: 1,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  appliedFiltersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
  },
  appliedFiltersText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  clearFiltersButton: {
    margin: 0,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 80,
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
  filterModalContent: {
    padding: 24,
  },
  filterSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  stateFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  stateChip: {
    marginRight: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    height: 42,
    paddingHorizontal: 16,
  },
  modalContainer: {
    padding: Platform.OS === 'web' ? 20 : 10,
    margin: Platform.OS === 'web' ? 20 : 10,
    maxWidth: '100%',
  },
  modalContent: {
    padding: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    maxWidth: 550,
    alignSelf: 'center',
    width: '100%',
    elevation: 4,
    overflow: 'hidden',
  },
  modalHeaderContainer: {
    backgroundColor: PRIMARY_COLOR,
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    elevation: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIcon: {
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  lottoInfoContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY_COLOR,
  },
  lottoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  lottoTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  lottoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  lottoDetailsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  detailItem: {
    width: '50%',
    marginBottom: 12,
    paddingRight: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  detailsButton: {
    marginRight: 8,
    borderColor: PRIMARY_COLOR,
  },
  detailsButtonLabel: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  modalFormContainer: {
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#fafafa',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 12,
    color: '#333',
  },
  formField: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 12,
    color: '#444',
  },
  notesInput: {
    marginBottom: 16,
    backgroundColor: '#fff',
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 12, 
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 6,
  },
  cancelButtonLabel: {
    color: '#666',
    fontWeight: '600',
    fontSize: 15,
  },
  confirmButton: {
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR,
    flex: 1,
    paddingVertical: 6,
    elevation: 2,
  },
  confirmButtonLabel: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  modalFooterNote: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  statusChip: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  statusIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  modalBodyContainer: {
    padding: Platform.OS === 'web' ? 20 : 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  infoIcon: {
    marginRight: 8, 
    opacity: 0.7,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  viewDetailsButtonContainer: {
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  viewDetailsButton: {
    borderColor: PRIMARY_COLOR,
    borderRadius: 8,
  },
  viewDetailsButtonLabel: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  notesSectionTitle: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 12,
    marginTop: 12,
    color: '#555',
  },
  centroIdContainer: {
    marginBottom: 16,
    backgroundColor: '#FFF4F2',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  centroIdHelp: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  centroIdInput: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
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
  webDatePicker: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16
  },
  dateButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  dateButtonSelected: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 2,
    backgroundColor: 'rgba(0, 152, 74, 0.1)',
  },
  selectedDateText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 7 giorni per riga
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  dayText: {
    textAlign: 'center',
    fontSize: 14,
  },
  selectedDayCell: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 20,
  },
  selectedDayText: {
    color: 'white',
    fontWeight: 'bold',
  },
  todayCell: {
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    borderRadius: 20,
  },
  todayText: {
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
  },
  pastDayCell: {
    opacity: 0.4,
  },
  pastDayText: {
    color: '#999',
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  stateBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  paymentMethodContainer: {
    marginBottom: 16,
  },
  radioButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioButtonLabel: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
}); 
