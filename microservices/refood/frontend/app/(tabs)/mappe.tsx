import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  View, StyleSheet, Text, Dimensions, ActivityIndicator, 
  TouchableOpacity, FlatList, ScrollView, Alert, Platform, Linking
} from 'react-native';
import MapComponent from '../../components/MapComponent';
import {
  Searchbar, Button, Card, useTheme
} from 'react-native-paper';
import { ThemeContext } from '../../src/context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { mappaAPI } from '../../src/api/api';

// Tipi
interface Centro {
  id: number;
  nome: string;
  tipologia: string;
  categoria: string;
  indirizzo: string;
  email?: string;
  telefono?: string;
  lat: number;
  lng: number;
  colore: string;
  num_utenti?: number;
  has_coordinates: boolean;
}

interface TipoCentro {
  id: string;
  nome: string;
  colore: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const DESKTOP_BREAKPOINT = 1024;

// Configurazione colori - DEVE corrispondere al backend
const COLORI_CENTRI = {
  'privato': '#4CAF50',         // Verde
  'canale sociale': '#FF9800',  // Arancione
  'centro riciclo': '#F44336',  // Rosso
  'altro': '#9E9E9E'            // Grigio
};

const formatTipoName = (tipo: string): string => {
  if (!tipo) {
    return 'Altro';
  }

  return tipo.charAt(0).toUpperCase() + tipo.slice(1);
};

const getColorForTipo = (tipo: string): string => {
  const tipoLower = (tipo || '').toLowerCase();
  return COLORI_CENTRI[tipoLower as keyof typeof COLORI_CENTRI] || COLORI_CENTRI.altro;
};

const parseCoordinate = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const cleaned = value.trim().replace(',', '.');
    if (!cleaned) {
      return null;
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export default function MappaScreen() {
  const theme = useTheme();
  const { isDarkMode } = useContext(ThemeContext);
  // Stati
  const [loading, setLoading] = useState(true);
  const [centri, setCentri] = useState<Centro[]>([]);
  const [filteredCentri, setFilteredCentri] = useState<Centro[]>([]);
  const [tipiCentro, setTipiCentro] = useState<TipoCentro[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTipi, setSelectedTipi] = useState<string[]>([]);
  const [selectedCentro, setSelectedCentro] = useState<Centro | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [statistiche, setStatistiche] = useState<any>(null);
  const [showCentroDetails, setShowCentroDetails] = useState(true); // Nuovo stato per il popup

  // Determina se siamo su mobile
  const isMobile = screenWidth < DESKTOP_BREAKPOINT;

  // Colori dinamici per tema
  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const cardBackground = isDarkMode ? '#181A20' : '#fff';
  const textColor = isDarkMode ? '#fff' : '#333';
  const subTextColor = isDarkMode ? '#ccc' : '#666';
  const borderColor = isDarkMode ? '#222' : '#e0e0e0';
  const sidebarBg = isDarkMode ? '#181A20' : '#fff';
  const sidebarHeaderBg = isDarkMode ? '#222' : '#f8f8f8';
  const filterButtonBg = isDarkMode ? '#222' : '#f0f0f0';
  const filterButtonTextActive = isDarkMode ? '#fff' : 'white';
  const searchBarBg = isDarkMode ? '#222' : '#f5f5f5';
  const selectedCentroBg = isDarkMode ? '#23272f' : '#e3f2fd';
  const selectedCentroBorder = isDarkMode ? theme.colors.primary : '#1976d2';
  const noGpsOverlayBg = isDarkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.9)';

  // Su mobile, mostra solo una vista alla volta: mappa o lista
  useEffect(() => {
    if (isMobile) {
      setShowSidebar(false);
    }
  }, [isMobile]);

  // Filtra i centri quando cambia la query di ricerca o i tipi selezionati
  useEffect(() => {
    let filtered = [...centri];

    // Filtra per query di ricerca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(centro =>
        centro.nome.toLowerCase().includes(query) ||
        centro.indirizzo.toLowerCase().includes(query) ||
        (centro.email && centro.email.toLowerCase().includes(query)) ||
        centro.tipologia.toLowerCase().includes(query) ||
        (centro.telefono && centro.telefono.includes(query))
      );
    }

    // Filtra per tipi selezionati
    if (selectedTipi.length > 0) {
      filtered = filtered.filter(centro => selectedTipi.includes(centro.tipologia));
    }

    setFilteredCentri(filtered);
  }, [searchQuery, selectedTipi, centri]);

  // Carica i dati dei centri dall'API
  const loadCentri = useCallback(async () => {
    try {
      setLoading(true);

      const response = await mappaAPI.getCentriMappa();

      // Il backend restituisce { success: true, data: { centri: [], statistiche: {} } }
      if (!response?.data?.success || !response.data.data?.centri) {
        Alert.alert('Errore', 'Nessun centro trovato o formato risposta non valido');
        setLoading(false);
        return;
      }

      const centriData = response.data.data.centri;
      const statisticheData = response.data.data.statistiche;

      // Mappa i dati dal backend al formato frontend
      const centri: Centro[] = centriData.map((centro: any) => {
        const tipologia = centro.tipologia || centro.tipo || 'altro';
        const latParsed = parseCoordinate(centro.lat ?? centro.latitudine ?? centro.latitude);
        const lngParsed = parseCoordinate(centro.lng ?? centro.longitudine ?? centro.longitude);
        const hasCoordinates = latParsed !== null && lngParsed !== null;

        return {
          id: centro.id,
          nome: centro.nome || `Centro ${centro.id}`,
          tipologia,
          categoria: centro.categoria || 'altro',
          indirizzo: centro.indirizzo || '',
          email: centro.email,
          telefono: centro.telefono,
          lat: hasCoordinates ? (latParsed as number) : 0,
          lng: hasCoordinates ? (lngParsed as number) : 0,
          colore: centro.colore || getColorForTipo(tipologia),
          num_utenti: centro.num_utenti || 0,
          has_coordinates: hasCoordinates,
        };
      });

      setCentri(centri);
      setFilteredCentri(centri);
      setStatistiche(statisticheData);

      // Genera i tipi di centro dai dati con colori corretti
      const tipiUnique = [...new Set(centri.map((c: Centro) => c.tipologia))];
      const tipi: TipoCentro[] = tipiUnique.map((tipo: string) => ({
        id: tipo,
        nome: formatTipoName(tipo),
        colore: getColorForTipo(tipo)
      }));

      setTipiCentro(tipi);

    } catch (error) {
      console.error('Errore durante il caricamento dei centri dalla mappa:', error);
      Alert.alert(
        'Errore caricamento',
        'Impossibile caricare i dati dei centri. Verifica la connessione e riprova.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Carica i dati dei centri al caricamento
  useEffect(() => {
    loadCentri();
  }, [loadCentri]);

  // Gestisce la selezione/deselezione dei tipi di centro
  const toggleTipo = (tipo: string) => {
    if (selectedTipi.includes(tipo)) {
      setSelectedTipi(selectedTipi.filter(t => t !== tipo));
    } else {
      setSelectedTipi([...selectedTipi, tipo]);
    }
  };

  // Gestisce la selezione di un centro
  const handleCentroPress = (centro: Centro) => {
    setSelectedCentro(centro);
    setShowCentroDetails(true); // Mostra sempre il popup quando selezioni un centro

    // Su mobile, chiudi automaticamente la sidebar quando selezioni un centro
    if (isMobile && showSidebar) {
      setShowSidebar(false);
    }
  };

  // Toggle della sidebar
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Cerca centri usando l'API
  const searchCentri = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setFilteredCentri(centri);
      return;
    }

    try {
      const response = await mappaAPI.searchCentri(query);

      if (response?.data?.success && response.data.data?.centri) {
        const searchResults = response.data.data.centri.map((centro: any) => ({
          id: centro.id,
          nome: centro.nome || `Centro ${centro.id}`,
          tipologia: centro.tipologia || centro.tipo || 'altro',
          categoria: centro.categoria || 'altro',
          indirizzo: centro.indirizzo || '',
          email: centro.email,
          telefono: centro.telefono,
          lat: centro.lat || centro.latitudine || 0,
          lng: centro.lng || centro.longitudine || 0,
          colore: centro.colore || COLORI_CENTRI['altro'],
          num_utenti: centro.num_utenti || 0,
          has_coordinates: !!(centro.lat && centro.lng)
        }));

        setFilteredCentri(searchResults);
      }
    } catch (error) {
      console.warn('Ricerca remota dei centri fallita, uso fallback locale.', error);
      // Fallback alla ricerca locale
      const filtered = centri.filter(centro =>
        centro.nome.toLowerCase().includes(query.toLowerCase()) ||
        centro.indirizzo.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredCentri(filtered);
    }
  };

  // Gestisce il cambio della query di ricerca
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      searchCentri(query);
    } else if (query.length === 0) {
      setFilteredCentri(centri);
    }
  };

  // Funzione per aprire Google Maps nell'app nativa
  const openInGoogleMaps = (centro: Centro) => {
    if (!centro.has_coordinates) return;

    const scheme = Platform.select({
      ios: 'maps:0,0?q=',
      android: 'geo:0,0?q='
    });
    const latLng = `${centro.lat},${centro.lng}`;
    const label = encodeURIComponent(centro.nome);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latLng}`
    });

    try {
      if (Platform.OS === 'web') {
        window.open(url as string, '_blank');
      } else {
        Linking.openURL(url as string);
      }
    } catch (error) {
      console.error('Impossibile aprire Google Maps per il centro selezionato:', error);
      Alert.alert('Funzione non disponibile', 'Impossibile avviare la navigazione verso questo centro.');
    }
  };

  // Loading dei dati
  if (loading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor }]}> 
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loaderText, { color: textColor }]}>Caricamento mappa...</Text>
        {statistiche && (
          <Text style={[styles.loaderSubText, { color: subTextColor }]}>Trovati {statistiche.totale} centri</Text>
        )}
      </View>
    );
  }

  const sidebarWidth = showSidebar
    ? isMobile
      ? screenWidth
      : screenWidth * 0.3
    : 0;
  const mapWidth = isMobile
    ? screenWidth
    : Math.max(screenWidth - sidebarWidth, 0);

  return (
    <View style={[styles.container, { backgroundColor }]}> 
      {/* Header con statistiche */}
      <View style={[styles.headerContainer, { backgroundColor: cardBackground, borderBottomColor: borderColor }]}> 
        <View style={styles.userInfo}>
          <Text style={[styles.welcomeText, { color: textColor }]}>Mappa Centri ReFood</Text>
          {statistiche && (
            <Text style={[styles.statsText, { color: subTextColor }]}>{statistiche.totale} centri totali - {centri.filter(c => c.has_coordinates).length} con GPS</Text>
          )}
        </View>

        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Cerca centri per nome, indirizzo, email..."
            onChangeText={handleSearchChange}
            value={searchQuery}
            style={[styles.searchBar, {
              width: showSidebar
                ? (isMobile ? screenWidth - 60 : sidebarWidth - 60)
                : screenWidth - 60,
              backgroundColor: searchBarBg
            }]}
            inputStyle={{ color: textColor }}
            iconColor={theme.colors.primary}
            placeholderTextColor={subTextColor}
            clearButtonMode="never"
          />

          <TouchableOpacity onPress={toggleSidebar} style={[styles.toggleButton, { backgroundColor: filterButtonBg }]}> 
            <MaterialCommunityIcons
              name={showSidebar ? 'chevron-left' : 'chevron-right'}
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Filtri per tipo centro */}
        {showSidebar && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            <TouchableOpacity
              onPress={() => setSelectedTipi([])}
              style={[
                styles.filterButton,
                { backgroundColor: filterButtonBg, borderColor },
                selectedTipi.length === 0 && { backgroundColor: '#4CAF50' } // Verde sempre per il tasto attivo "Tutti"
              ]}
            >
              <Text style={[
                styles.filterButtonText,
                { color: textColor },
                selectedTipi.length === 0 && { color: '#fff' } // Testo bianco su verde
              ]}>Tutti ({centri.length})</Text>
            </TouchableOpacity>

            {tipiCentro.map((tipo) => {
              const count = centri.filter(c => c.tipologia === tipo.id).length;
              return (
                <TouchableOpacity
                  key={tipo.id}
                  onPress={() => toggleTipo(tipo.id)}
                  style={[
                    styles.filterButton,
                    { backgroundColor: filterButtonBg, borderColor },
                    selectedTipi.includes(tipo.id) && { backgroundColor: tipo.colore }
                  ]}
                >
                  <Text style={[
                    styles.filterButtonText,
                    { color: textColor },
                    selectedTipi.includes(tipo.id) && { color: filterButtonTextActive }
                  ]}>
                    {tipo.nome} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Contenuto principale */}
      <View style={styles.mainContent}>
        {/* Sidebar con lista centri */}
        {showSidebar && (
          <View style={[styles.sidebar, { width: sidebarWidth, backgroundColor: sidebarBg, borderRightColor: borderColor }]}> 
            <View style={[styles.sidebarHeader, { backgroundColor: sidebarHeaderBg, borderBottomColor: borderColor }]}> 
              <Text style={[styles.sidebarTitle, { color: textColor }]}>Centri ({filteredCentri.length})</Text>
              {searchQuery.length >= 2 && (
                <Text style={[styles.searchResults, { color: subTextColor }]}>Risultati per "{searchQuery}"</Text>
              )}
            </View>

            <FlatList
              data={filteredCentri}
              renderItem={({ item }) => {
                const isSelected = selectedCentro?.id === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => handleCentroPress(item)}
                    style={[
                      styles.centroItem,
                      { backgroundColor: sidebarBg, borderColor },
                      isSelected && { backgroundColor: selectedCentroBg, borderColor: selectedCentroBorder, borderWidth: 2 }
                    ]}
                  >
                    <View style={styles.centroItemContent}>
                      <View style={[
                        styles.centroTypeIndicator,
                        { backgroundColor: item.colore }
                      ]} />

                      <View style={styles.centroInfo}>
                        <Text style={[styles.centroNome, { color: textColor }, isSelected && { color: theme.colors.primary }]}> {item.nome} </Text>
                        <Text style={[styles.centroTipo, { color: subTextColor }, isSelected && { color: theme.colors.primary }]}> {formatTipoName(item.tipologia)} </Text>
                        <Text style={[styles.centroIndirizzo, { color: subTextColor }, isSelected && { color: theme.colors.primary }]} numberOfLines={2}> {item.indirizzo} </Text>

                        <View style={styles.centroDetails}>
                          {item.telefono && (
                            <Text style={[styles.centroDetail, { color: subTextColor }, isSelected && { color: theme.colors.primary }]}>Tel {item.telefono}</Text>
                          )}
                          {item.email && (
                            <Text style={[styles.centroDetail, { color: subTextColor }, isSelected && { color: theme.colors.primary }]} numberOfLines={1}>Mail {item.email}</Text>
                          )}
                          {!item.has_coordinates && (
                            <Text style={[styles.noCoordinates, { color: '#ff9800' }, isSelected && { color: theme.colors.primary }]}>Avviso Senza coordinate GPS</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item.id.toString()}
              style={styles.centroList}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: borderColor }]} />}
              ListEmptyComponent={() => (
                <View style={styles.emptyList}>
                  <MaterialCommunityIcons name="map-marker-off" size={48} color={subTextColor} />
                  <Text style={[styles.emptyListText, { color: subTextColor }]}> {searchQuery ? 'Nessun centro trovato' : 'Nessun centro disponibile'} </Text>
                  {searchQuery && (
                    <Button mode="outlined" onPress={() => setSearchQuery('')} textColor={theme.colors.primary}>
                      <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Cancella ricerca</Text>
                    </Button>
                  )}
                </View>
              )}
            />
          </View>
        )}

        {/* Mappa */}
        <View style={[styles.mapContainer, { width: mapWidth }]}> 
          <MapComponent
            centri={filteredCentri.filter(c => c.has_coordinates)} // Solo centri con coordinate
            selectedCentro={selectedCentro}
            onCentroSelect={handleCentroPress}
            height={screenHeight - 200}
          />

          {/* Dettagli centro selezionato */}
          {selectedCentro && showCentroDetails && (
            <Card style={[styles.selectedCentroCard, { backgroundColor: cardBackground }]}> 
              <Card.Content>
                <View style={styles.selectedCentroHeader}>
                  <View style={[styles.selectedCentroColorIndicator, { backgroundColor: selectedCentro.colore }]} />
                  <Text style={[styles.selectedCentroName, { color: textColor }]}>{selectedCentro.nome}</Text>
                </View>
                <Text style={[styles.selectedCentroType, { color: subTextColor }]}>{formatTipoName(selectedCentro.tipologia)}</Text>
                <Text style={[styles.selectedCentroAddress, { color: subTextColor }]}>{selectedCentro.indirizzo}</Text>

                {(selectedCentro.telefono || selectedCentro.email) && (
                  <View style={styles.selectedCentroContacts}>
                    {selectedCentro.telefono && (
                      <Text style={[styles.selectedCentroContact, { color: subTextColor }]}>Tel {selectedCentro.telefono}</Text>
                    )}
                    {selectedCentro.email && (
                      <Text style={[styles.selectedCentroContact, { color: subTextColor }]}>Mail {selectedCentro.email}</Text>
                    )}
                  </View>
                )}

                <View style={styles.selectedCentroActions}>
                  {selectedCentro.has_coordinates && (
                    <Button
                      mode="contained"
                      onPress={() => openInGoogleMaps(selectedCentro)}
                      style={styles.actionButton}
                      icon="map-marker"
                      textColor={isDarkMode ? '#fff' : undefined}
                    >
                      Apri in Maps
                    </Button>
                  )}

                  <Button
                    mode="outlined"
                    onPress={() => setShowCentroDetails(false)}
                    style={styles.actionButton}
                    icon="close"
                    textColor={theme.colors.primary}
                  >
                    Chiudi
                  </Button>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Info overlay se nessun centro ha coordinate */}
          {filteredCentri.length > 0 && filteredCentri.filter(c => c.has_coordinates).length === 0 && (
            <View style={[styles.noGpsOverlay, { backgroundColor: noGpsOverlayBg, borderColor }]}> 
              <MaterialCommunityIcons name="map-marker-off" size={48} color={subTextColor} />
              <Text style={[styles.noGpsText, { color: textColor }]}>Nessun centro con coordinate GPS trovato</Text>
              <Text style={[styles.noGpsSubText, { color: subTextColor }]}>I centri senza coordinate non possono essere visualizzati sulla mappa</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
  },
  loaderSubText: {
    marginTop: 5,
    fontSize: 14,
  },
  headerContainer: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  userInfo: {
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsText: {
    fontSize: 14,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    elevation: 0,
  },
  toggleButton: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 8,
  },
  filterScrollView: {
    paddingHorizontal: 15,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    borderRightWidth: 1,
  },
  sidebarHeader: {
    padding: 15,
    borderBottomWidth: 1,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchResults: {
    fontSize: 12,
    marginTop: 2,
  },
  centroList: {
    padding: 10,
  },
  centroItem: {
    marginBottom: 8,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  centroItemSelected: {
    borderWidth: 2,
  },
  centroItemContent: {
    flexDirection: 'row',
  },
  centroTypeIndicator: {
    width: 6,
    borderRadius: 3,
    marginRight: 12,
  },
  centroInfo: {
    flex: 1,
  },
  centroNome: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  selectedText: {
    fontWeight: 'bold',
  },
  centroTipo: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  centroIndirizzo: {
    fontSize: 12,
    marginBottom: 8,
  },
  centroDetails: {
    gap: 2,
  },
  centroDetail: {
    fontSize: 11,
    marginBottom: 0,
  },
  selectedSubText: {
    fontWeight: '600',
  },
  centroUtenti: {
    fontSize: 11,
    marginTop: 4,
  },
  noCoordinates: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    marginVertical: 4,
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  selectedCentroCard: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    zIndex: 1000,
  },
  selectedCentroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedCentroColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  selectedCentroName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  selectedCentroType: {
    fontSize: 14,
    marginBottom: 4,
  },
  selectedCentroAddress: {
    fontSize: 14,
    marginBottom: 12,
  },
  selectedCentroContacts: {
    marginBottom: 12,
  },
  selectedCentroContact: {
    fontSize: 12,
    marginBottom: 2,
  },
  selectedCentroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  noGpsOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -50 }],
    width: 200,
    alignItems: 'center',
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  noGpsText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  noGpsSubText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
});

