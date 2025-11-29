import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, FAB, Button, ActivityIndicator, Searchbar, Chip, Avatar, List, Divider, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR, STORAGE_KEYS, API_URL, RUOLI } from '../../../src/config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getActiveToken } from '../../../src/services/authService';

// Interfaccia per rappresentare un utente
interface Utente {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  centri?: { id: number; nome: string }[];
}

export default function GestioneUtentiScreen() {
  // Stati
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUtenti, setFilteredUtenti] = useState<Utente[]>([]);
  const [ruoloFiltro, setRuoloFiltro] = useState<string | null>(null);
  
  // Carica gli utenti quando il componente viene montato
  useEffect(() => {
    loadUtenti();
  }, []);
  
  // Filtra gli utenti quando cambia la query di ricerca o il filtro per ruolo
  useEffect(() => {
    if (searchQuery.trim() === '' && !ruoloFiltro) {
      setFilteredUtenti(utenti);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = utenti.filter(utente => {
        const matchesSearch = searchQuery.trim() === '' || 
          utente.nome.toLowerCase().includes(query) || 
          utente.cognome.toLowerCase().includes(query) || 
          utente.email.toLowerCase().includes(query);
        
        const matchesRole = !ruoloFiltro || utente.ruolo === ruoloFiltro;
        
        return matchesSearch && matchesRole;
      });
      
      setFilteredUtenti(filtered);
    }
  }, [searchQuery, ruoloFiltro, utenti]);
  
  // Funzione per caricare gli utenti
  const loadUtenti = async () => {
    setLoading(true);
    try {
      const token = await getActiveToken();
      
      const response = await fetch(`${API_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Errore nel caricamento degli utenti (${response.status})`);
      }
      
      const data = await response.json();
      console.log('Risposta API utenti:', JSON.stringify(data));
      
      // Formatta i dati degli utenti
      let listaUtenti: Utente[] = [];
      if (data && Array.isArray(data.data)) {
        listaUtenti = data.data;
      } else if (data && Array.isArray(data)) {
        listaUtenti = data;
      }
      
      console.log(`Caricati ${listaUtenti.length} utenti`);
      setUtenti(listaUtenti);
      setFilteredUtenti(listaUtenti);
      
    } catch (error) {
      console.error('Errore nel caricamento degli utenti:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Impossibile caricare gli utenti',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Gestisce il refresh tramite pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadUtenti();
  };
  
  // Naviga alla schermata di creazione di un nuovo utente
  const navigateToNewUser = () => {
    router.push('/admin/utenti/nuovo');
  };
  
  // Naviga alla schermata di dettaglio/modifica di un utente
  const navigateToUserDetail = (utente: Utente) => {
    // Per ora mostriamo solo un messaggio, poi implementeremo la schermata di dettaglio
    Toast.show({
      type: 'info',
      text1: 'Info',
      text2: `Dettagli di ${utente.nome} ${utente.cognome}`,
    });
  };
  
  // Funzione per ottenere l'icona in base al ruolo
  const getRoleIcon = (ruolo: string) => {
    switch (ruolo) {
      case RUOLI.AMMINISTRATORE:
        return 'account-tie';
      case RUOLI.OPERATORE:
        return 'account-hard-hat';
      case RUOLI.CENTRO_SOCIALE:
        return 'home-heart';
      case RUOLI.CENTRO_RICICLAGGIO:
        return 'recycle';
      default:
        return 'account';
    }
  };
  
  // Funzione per ottenere il colore dell'avatar in base al ruolo
  const getRoleColor = (ruolo: string) => {
    switch (ruolo) {
      case RUOLI.AMMINISTRATORE:
        return '#1976d2'; // Blu
      case RUOLI.OPERATORE:
        return '#4CAF50'; // Verde
      case RUOLI.CENTRO_SOCIALE:
        return '#FF9800'; // Arancione
      case RUOLI.CENTRO_RICICLAGGIO:
        return '#9C27B0'; // Viola
      default:
        return '#757575'; // Grigio
    }
  };
  
  // Renderizza un item della lista degli utenti
  const renderUtenteItem = ({ item }: { item: Utente }) => (
    <List.Item
      title={`${item.nome} ${item.cognome}`}
      description={
        <View>
          <Text style={styles.emailText}>{item.email}</Text>
          {item.centri && item.centri.length > 0 && (
            <View style={styles.centriContainer}>
              <Text style={styles.centriText}>
                Centri: {item.centri.map(c => c.nome).join(', ')}
              </Text>
            </View>
          )}
        </View>
      }
      left={props => (
        <Avatar.Icon 
          {...props} 
          icon={getRoleIcon(item.ruolo)} 
          size={40} 
          style={[styles.avatar, { backgroundColor: getRoleColor(item.ruolo) }]} 
          color="#fff"
        />
      )}
      right={props => (
        <View style={styles.itemActions}>
          <Chip 
            style={[styles.roleChip, { backgroundColor: `${getRoleColor(item.ruolo)}20` }]}
            textStyle={[styles.roleChipText, { color: getRoleColor(item.ruolo) }]}
          >
            {item.ruolo}
          </Chip>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#757575" />
        </View>
      )}
      onPress={() => navigateToUserDetail(item)}
      style={styles.listItem}
    />
  );
  
  // Renderizza i chip per filtrare per ruolo
  const renderRuoloChips = () => (
    <View style={styles.chipsContainer}>
      <SegmentedButtons
        value={ruoloFiltro || ''}
        onValueChange={(value) => setRuoloFiltro(value === '' ? null : value)}
        buttons={[
          { value: '', label: 'Tutti' },
          { value: RUOLI.AMMINISTRATORE, label: 'Admin' },
          { value: RUOLI.OPERATORE, label: 'Operatori' },
          { value: RUOLI.CENTRO_SOCIALE, label: 'Centri Sociali' },
        ]}
      />
    </View>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Cerca utenti..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>
      
      {renderRuoloChips()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento utenti...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUtenti}
          renderItem={renderUtenteItem}
          keyExtractor={(item) => item.id.toString()}
          ItemSeparatorComponent={() => <Divider />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY_COLOR]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-off" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery || ruoloFiltro ? 'Nessun utente corrisponde ai filtri' : 'Nessun utente disponibile'}
              </Text>
              {(searchQuery || ruoloFiltro) && (
                <Button 
                  mode="text"
                  onPress={() => {
                    setSearchQuery('');
                    setRuoloFiltro(null);
                  }}
                  style={styles.resetButton}
                >
                  <Text>Resetta filtri</Text>
                </Button>
              )}
            </View>
          }
        />
      )}
      
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={navigateToNewUser}
        label="Nuovo Utente"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  chipsContainer: {
    padding: 16,
    paddingTop: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f5f5f5',
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  listContent: {
    padding: 8,
    paddingBottom: 80,
  },
  listItem: {
    backgroundColor: '#fff',
    marginVertical: 4,
    borderRadius: 8,
    elevation: 1,
  },
  avatar: {
    margin: 8,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
    justifyContent: 'flex-end',
  },
  roleChip: {
    marginRight: 8,
    height: 28,
    paddingHorizontal: 8,
    justifyContent: 'center',
    minWidth: 90,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emailText: {
    fontSize: 12,
    color: '#666',
  },
  centriContainer: {
    marginTop: 4,
  },
  centriText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  resetButton: {
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: PRIMARY_COLOR,
  },
}); 

