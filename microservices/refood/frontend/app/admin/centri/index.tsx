import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Card, FAB, Button, ActivityIndicator, Searchbar, Title, Paragraph, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR, STORAGE_KEYS, API_URL } from '../../../src/config/constants';
import { useAuth } from '../../../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getActiveToken } from '../../../src/services/authService';

// Interfaccia per il tipo Centro
interface Centro {
  id: number;
  nome: string;
  indirizzo: string;
  telefono: string;
  email: string;
  tipo: string;
  operatori_assegnati?: number;
  tipo_descrizione?: string;
}

export default function GestioneCentriScreen() {
  const { user } = useAuth();
  const [centri, setCentri] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCentri, setFilteredCentri] = useState<Centro[]>([]);

  // Carica i centri all'avvio
  useEffect(() => {
    loadCentri();
  }, []);

  // Filtra i centri quando cambia la query di ricerca
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCentri(centri);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = centri.filter(centro => 
        centro.nome.toLowerCase().includes(query) || 
        centro.indirizzo.toLowerCase().includes(query) ||
        centro.tipo.toLowerCase().includes(query)
      );
      setFilteredCentri(filtered);
    }
  }, [searchQuery, centri]);

  // Funzione per caricare i centri dal server
  const loadCentri = async () => {
    setLoading(true);
    try {
      const token = await getActiveToken();
      
      console.log('Richiesta centri in corso all\'API:', `${API_URL}/centri`);
      
      const response = await fetch(`${API_URL}/centri`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Risposta non valida:', response.status, response.statusText);
        throw new Error(`Errore nel caricamento dei centri (${response.status})`);
      }

      const data = await response.json();
      
      console.log('Risposta ricevuta:', JSON.stringify(data).substring(0, 200) + '...');
      
      // Gestisci diversi formati possibili della risposta
      let centriData = [];
      if (data && Array.isArray(data.centri)) {
        centriData = data.centri;
      } else if (data && Array.isArray(data.data)) {
        centriData = data.data;
      } else if (Array.isArray(data)) {
        centriData = data;
      } else {
        console.error('Formato risposta non riconosciuto:', data);
      }
      
      console.log(`Trovati ${centriData.length} centri`);
      setCentri(centriData);
      setFilteredCentri(centriData);
    } catch (error) {
      console.error('Errore nel caricamento dei centri:', error);
      Alert.alert('Errore', 'Impossibile caricare i centri. Verifica la connessione e riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Gestisce il refresh tramite pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadCentri();
  };

  // Naviga alla schermata di modifica del centro
  const editCentro = (centro: Centro) => {
    router.push({
      pathname: '/admin/centri/modifica',
      params: { id: centro.id.toString() }
    });
  };

  // Naviga alla schermata di associazione operatori
  const manageOperatori = (centro: Centro) => {
    router.push({
      pathname: '/admin/centri/operatori',
      params: { id: centro.id.toString() }
    });
  };

  // Funzione per associare l'amministratore corrente al centro
  const associaAmministratore = async (centro: Centro) => {
    try {
      const token = await getActiveToken();
      const response = await fetch(`${API_URL}/centri/${centro.id}/utenti/${user?.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          // Già  associato, mostra un messaggio informativo
          Toast.show({
            type: 'info',
            text1: 'Informazione',
            text2: 'Sei già  associato a questo centro',
            visibilityTime: 3000,
          });
          return;
        }
        throw new Error(errorData.message || `Errore durante l'associazione (${response.status})`);
      }
      
      Toast.show({
        type: 'success',
        text1: 'Associazione completata',
        text2: `Sei stato associato al centro ${centro.nome}`,
        visibilityTime: 3000,
      });
      
      // Ricarica la lista
      onRefresh();
    } catch (error: any) {
      console.error('Errore nell\'associazione dell\'amministratore:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error.message || 'Si è verificato un errore durante l\'associazione',
        visibilityTime: 4000,
      });
    }
  };

  // Renderizza un item della lista dei centri
  const renderCentroItem = ({ item }: { item: Centro }) => {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Title>{item.nome}</Title>
              <Paragraph>{item.indirizzo}</Paragraph>
            </View>
            {item.operatori_assegnati && (
              <Badge style={styles.badge} size={24}>
                {item.operatori_assegnati}
              </Badge>
            )}
          </View>
        </Card.Content>
        <Card.Actions style={styles.cardActions}>
          <Button 
            icon="account-group" 
            mode="text" 
            onPress={() => manageOperatori(item)}
          >
            <Text>Operatori</Text>
          </Button>
          <Button 
            icon="pencil" 
            mode="text" 
            onPress={() => editCentro(item)}
          >
            <Text>Modifica</Text>
          </Button>
          <Button 
            icon="link-variant" 
            mode="text" 
            onPress={() => associaAmministratore(item)}
          >
            <Text>Associa</Text>
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Cerca centri..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        <Button 
          mode="text" 
          onPress={onRefresh}
          icon="refresh"
          style={{ marginTop: 8 }}
        >
          <Text>Ricarica</Text>
        </Button>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento centri...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCentri}
          renderItem={renderCentroItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
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
              <MaterialCommunityIcons name="domain-off" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Nessun centro corrisponde alla ricerca' : 'Nessun centro disponibile'}
              </Text>
              {searchQuery && (
                <Button 
                  mode="text"
                  onPress={() => setSearchQuery('')}
                  style={styles.resetButton}
                >
                  <Text>Resetta ricerca</Text>
                </Button>
              )}
            </View>
          }
        />
      )}
      
      <FAB
        style={styles.fab}
        icon="plus"
        label="Nuovo Centro"
        onPress={() => router.push('/admin/centri/nuovo')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    elevation: 4,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // Extra padding per la FAB
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
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
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'column',
  },
  tipoChip: {
    backgroundColor: '#e8f5e9',
  },
  divider: {
    marginVertical: 8,
  },
  cardActions: {
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: PRIMARY_COLOR,
  },
  badge: {
    backgroundColor: '#4caf50',
    marginLeft: 8,
  },
});


