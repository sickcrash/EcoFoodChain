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

// Interfaccia per il tipo Utente
interface TipoUtente {
  id: number;
  indirizzo: string;
  telefono: string;
  email: string;
  tipo: string;
  operatori_assegnati?: number;
}

export default function GestioneTipiUtenteScreen() {
  const { user } = useAuth();
  const [tipiUtente, setTipiUtente] = useState<TipoUtente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTipiUtente, setFilteredTipiUtente] = useState<TipoUtente[]>([]);

  // Carica i tipi utente all'avvio
  useEffect(() => {
    loadTipiUtente();
  }, []);

  // Filtra i tipi utente quando cambia la query di ricerca
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTipiUtente(tipiUtente);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = tipiUtente.filter(tipoUtente => 
        tipoUtente.indirizzo.toLowerCase().includes(query) ||
        tipoUtente.tipo.toLowerCase().includes(query) ||
        (tipoUtente.email && tipoUtente.email.toLowerCase().includes(query)) ||
        (tipoUtente.telefono && tipoUtente.telefono.toLowerCase().includes(query))
      );
      setFilteredTipiUtente(filtered);
    }
  }, [searchQuery, tipiUtente]);

  // Funzione per caricare i tipi utente dal server
  const loadTipiUtente = async () => {
    setLoading(true);
    try {
      const token = await getActiveToken();
      
      console.log('Richiesta tipi utente in corso all\'API:', `${API_URL}/tipi-utente`);
      
      const response = await fetch(`${API_URL}/tipi-utente`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Risposta non valida:', response.status, response.statusText);
        throw new Error(`Errore nel caricamento dei tipi utente (${response.status})`);
      }

      const data = await response.json();
      
      console.log('Risposta ricevuta:', JSON.stringify(data).substring(0, 200) + '...');
      
      // Gestisci diversi formati possibili della risposta
      let tipiUtenteData = [];
      if (data && Array.isArray(data.tipiUtente)) {
        tipiUtenteData = data.tipiUtente;
      } else if (data && Array.isArray(data.data)) {
        tipiUtenteData = data.data;
      } else if (Array.isArray(data)) {
        tipiUtenteData = data;
      } else {
        console.error('Formato risposta non riconosciuto:', data);
      }
      
      console.log(`Trovati ${tipiUtenteData.length} tipi utente`);
      setTipiUtente(tipiUtenteData);
      setFilteredTipiUtente(tipiUtenteData);
    } catch (error) {
      console.error('Errore nel caricamento dei tipi utente:', error);
      Alert.alert('Errore', 'Impossibile caricare i tipi utente. Verifica la connessione e riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Gestisce il refresh tramite pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadTipiUtente();
  };

  // Naviga alla schermata di modifica del tipo utente
  const editTipoUtente = (tipoUtente: TipoUtente) => {
    router.push({
      pathname: '/admin/tipi-utente/modifica',
      params: { id: tipoUtente.id.toString() }
    });
  };

  // Naviga alla schermata di associazione operatori
  const manageOperatori = (tipoUtente: TipoUtente) => {
    router.push({
      pathname: '/admin/tipi-utente/operatori',
      params: { id: tipoUtente.id.toString() }
    });
  };

  // Funzione per associare l'amministratore corrente al tipo utente
  const associaAmministratore = async (tipoUtente: TipoUtente) => {
    try {
      const token = await getActiveToken();
      const response = await fetch(`${API_URL}/tipi-utente/${tipoUtente.id}/utenti/${user?.id}`, {
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
            text2: 'Sei già  associato a questo tipo utente',
            visibilityTime: 3000,
          });
          return;
        }
        throw new Error(errorData.message || `Errore durante l'associazione (${response.status})`);
      }
      
      Toast.show({
        type: 'success',
        text1: 'Associazione completata',
        text2: `Sei stato associato al tipo utente ${tipoUtente.tipo}`,
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

  // Renderizza un item della lista dei tipi utente
  const renderTipoUtenteItem = ({ item }: { item: TipoUtente }) => {
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Title>{item.tipo}</Title>
              <Paragraph>{item.indirizzo}</Paragraph>
              {item.telefono && <Paragraph>Tel: {item.telefono}</Paragraph>}
              {item.email && <Paragraph>Email: {item.email}</Paragraph>}
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
            onPress={() => editTipoUtente(item)}
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
          placeholder="Cerca tipi utente..."
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
          <Text style={styles.loadingText}>Caricamento tipi utente...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTipiUtente}
          renderItem={renderTipoUtenteItem}
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
              <MaterialCommunityIcons name="account-group-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Nessun tipo utente corrisponde alla ricerca' : 'Nessun tipo utente disponibile'}
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
        label="Nuovo Tipo Utente"
        onPress={() => router.push('/admin/tipi-utente/nuovo')}
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


