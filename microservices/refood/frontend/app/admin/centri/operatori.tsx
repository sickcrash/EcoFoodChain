import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Appbar, Card, Button, ActivityIndicator, Searchbar, Chip, Avatar, List, Checkbox, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR, STORAGE_KEYS, API_URL, RUOLI } from '../../../src/config/constants';
import { useAuth } from '../../../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { getActiveToken } from '../../../src/services/authService';

// Interfaccia per l'operatore
interface Operatore {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  assegnato: boolean;
  ruolo_specifico?: string;
}

// Interfaccia per il centro
interface Centro {
  id: number;
  nome: string;
  indirizzo: string;
  tipo: string;
}

export default function GestioneOperatoriScreen() {
  const params = useLocalSearchParams();
  const centroId = params.id as string;
  const { user } = useAuth();
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  
  // Usa useFocusEffect per tracciare quando lo schermo è in focus
  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
      };
    }, [])
  );
  
  // Stati
  const [centro, setCentro] = useState<Centro | null>(null);
  const [operatori, setOperatori] = useState<Operatore[]>([]);
  const [amministratori, setAmministratori] = useState<Operatore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOperatori, setFilteredOperatori] = useState<Operatore[]>([]);
  const [filteredAmministratori, setFilteredAmministratori] = useState<Operatore[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [operatoriSelezionati, setOperatoriSelezionati] = useState<Record<number, boolean>>({});
  const [amministratoriSelezionati, setAmministratoriSelezionati] = useState<Record<number, boolean>>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [visualizzazione, setVisualizzazione] = useState<'operatori' | 'amministratori'>('operatori');

  // Filtra gli operatori quando cambia la query di ricerca
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredOperatori(operatori);
      setFilteredAmministratori(amministratori);
    } else {
      const query = searchQuery.toLowerCase();
      
      // Filtra operatori
      const filteredOps = operatori.filter(op => 
        op.nome.toLowerCase().includes(query) || 
        op.cognome.toLowerCase().includes(query) ||
        op.email.toLowerCase().includes(query)
      );
      setFilteredOperatori(filteredOps);

      // Filtra amministratori
      const filteredAdmins = amministratori.filter(admin => 
        admin.nome.toLowerCase().includes(query) || 
        admin.cognome.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query)
      );
      setFilteredAmministratori(filteredAdmins);
    }
  }, [searchQuery, operatori, amministratori]);

  // Controlla se ci sono modifiche quando cambia la selezione
  useEffect(() => {
    if (operatori.length > 0 || amministratori.length > 0) {
      const opChanges = operatori.some(op => operatoriSelezionati[op.id] !== op.assegnato);
      const adminChanges = amministratori.some(admin => amministratoriSelezionati[admin.id] !== admin.assegnato);
      setHasChanges(opChanges || adminChanges);
    }
  }, [operatoriSelezionati, amministratoriSelezionati, operatori, amministratori]);

  // Funzione per caricare i dati del centro
  const loadCentro = useCallback(async () => {
    try {
      const token = await getActiveToken();
      
      const response = await fetch(`${API_URL}/centri/${centroId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Errore nel caricamento del centro (${response.status})`);
      }

      const data = await response.json();
      
      setCentro(data);
    } catch (error) {
      console.error('Errore nel caricamento del centro:', error);
      Alert.alert('Errore', 'Impossibile caricare i dettagli del centro.');
    }
  }, [centroId]);

  // Funzione per caricare operatori, amministratori e le loro associazioni
  const loadUtenti = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getActiveToken();
      
      console.log(`[DEBUG] Caricamento utenti per il centro ID: ${centroId}`);
      
      // Carica tutti gli operatori
      const operatoriResponse = await fetch(`${API_URL}/users?ruolo=Operatore`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!operatoriResponse.ok) {
        throw new Error(`Errore nel caricamento degli operatori (${operatoriResponse.status})`);
      }

      const operatoriData = await operatoriResponse.json();
      
      // Carica tutti gli amministratori (escluso se stesso)
      const amministratoriResponse = await fetch(`${API_URL}/users?ruolo=Amministratore`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!amministratoriResponse.ok) {
        throw new Error(`Errore nel caricamento degli amministratori (${amministratoriResponse.status})`);
      }

      const amministratoriData = await amministratoriResponse.json();
      
      // Carica utenti già  associati al centro
      const utentiCentroResponse = await fetch(`${API_URL}/centri/${centroId}/utenti`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!utentiCentroResponse.ok) {
        throw new Error(`Errore nel caricamento degli utenti associati (${utentiCentroResponse.status})`);
      }

      const utentiCentroData = await utentiCentroResponse.json();
      
      // Prepara gli operatori
      let allOperatori: Operatore[] = [];
      if (operatoriData && Array.isArray(operatoriData)) {
        allOperatori = operatoriData;
      } else if (operatoriData && Array.isArray(operatoriData.users)) {
        allOperatori = operatoriData.users;
      }
      
      // Prepara gli amministratori (escludi l'utente corrente)
      let allAmministratori: Operatore[] = [];
      if (amministratoriData && Array.isArray(amministratoriData)) {
        allAmministratori = amministratoriData.filter((admin: any) => admin.id !== user?.id);
      } else if (amministratoriData && Array.isArray(amministratoriData.users)) {
        allAmministratori = amministratoriData.users.filter((admin: any) => admin.id !== user?.id);
      }

      // Utenti già  associati al centro
      let utentiAssociati: any[] = [];
      if (utentiCentroData && Array.isArray(utentiCentroData)) {
        utentiAssociati = utentiCentroData;
      }

      // Verifica se l'utente corrente è SuperAdmin
      const currentUserIsSuper = utentiAssociati.some(u => 
        u.id === user?.id && 
        u.ruolo === RUOLI.AMMINISTRATORE && 
        u.ruolo_specifico === 'SuperAdmin'
      );
      
      setIsSuperAdmin(currentUserIsSuper);
      console.log(`[DEBUG] Utente corrente è SuperAdmin: ${currentUserIsSuper}`);
      
      // Crea oggetti per tenere traccia degli utenti selezionati
      const selectedOperatori: Record<number, boolean> = {};
      const selectedAmministratori: Record<number, boolean> = {};
      
      // Marca gli utenti già  associati come selezionati
      utentiAssociati.forEach((utente: any) => {
        if (utente.ruolo === RUOLI.OPERATORE) {
          selectedOperatori[utente.id] = true;
        } else if (utente.ruolo === RUOLI.AMMINISTRATORE && utente.id !== user?.id) {
          selectedAmministratori[utente.id] = true;
        }
      });
      
      // Prepara gli operatori con il flag assegnato
      const operatoriFormattati = allOperatori.map(op => ({
        ...op,
        assegnato: !!selectedOperatori[op.id]
      }));
      
      // Prepara gli amministratori con il flag assegnato
      const amministratoriFormattati = allAmministratori.map(admin => ({
        ...admin,
        assegnato: !!selectedAmministratori[admin.id]
      }));

      // Imposta i dati nello stato
      setOperatori(operatoriFormattati);
      setFilteredOperatori(operatoriFormattati);
      setOperatoriSelezionati(selectedOperatori);
      
      setAmministratori(amministratoriFormattati);
      setFilteredAmministratori(amministratoriFormattati);
      setAmministratoriSelezionati(selectedAmministratori);
      
      console.log(`[DEBUG] Operatori caricati: ${operatoriFormattati.length}`);
      console.log(`[DEBUG] Amministratori caricati: ${amministratoriFormattati.length}`);
      
    } catch (error: any) {
      console.error('Errore nel caricamento degli utenti:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error.message || 'Impossibile caricare gli utenti',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [centroId, user?.id]);

  // Carica i dati all'avvio e quando torna in focus
  useEffect(() => {
    if (centroId && isScreenFocused) {
      loadCentro();
      loadUtenti();
    } else if (!centroId) {
      Alert.alert('Errore', 'ID centro non valido', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  }, [centroId, isScreenFocused, loadCentro, loadUtenti]);

  // Gestisce il refresh tramite pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadUtenti();
  };

  // Gestisce la selezione/deselezione di un operatore
  const toggleOperatore = (id: number) => {
    setOperatoriSelezionati(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Gestisce la selezione/deselezione di un amministratore
  const toggleAmministratore = (id: number) => {
    setAmministratoriSelezionati(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Salva le associazioni utenti-centro
  const salvaAssociazioni = async () => {
    setSaving(true);
    try {
      const token = await getActiveToken();
      
      // Prepara i dati da inviare: operatori
      const operatoriDaAssegnare = Object.entries(operatoriSelezionati)
        .filter(([_, isSelected]) => isSelected)
        .map(([id, _]) => parseInt(id));
      
      // Prepara i dati da inviare: amministratori (solo se è SuperAdmin)
      const amministratoriDaAssegnare = isSuperAdmin 
        ? Object.entries(amministratoriSelezionati)
            .filter(([_, isSelected]) => isSelected)
            .map(([id, _]) => parseInt(id))
        : [];
      
      console.log('Invio richiesta con operatori:', operatoriDaAssegnare);
      if (isSuperAdmin) {
        console.log('Invio richiesta con amministratori:', amministratoriDaAssegnare);
      }
      
      // Effettua la richiesta POST al server
      const response = await fetch(`${API_URL}/centri/${centroId}/operatori`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          operatori_ids: operatoriDaAssegnare,
          amministratori_ids: amministratoriDaAssegnare
        }),
      });

      const data = await response.json();
      console.log('Risposta dal server:', data);

      if (!response.ok) {
        throw new Error(data.message || `Errore nel salvataggio delle associazioni (${response.status})`);
      }

      // Associazioni salvate con successo
      Toast.show({
        type: 'success',
        text1: 'Associazioni salvate con successo',
        visibilityTime: 3000,
      });
      
      // Ricarica i dati per aggiornare la lista
      onRefresh();
    } catch (error: any) {
      console.error('Errore nel salvataggio delle associazioni:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error.message || 'Si è verificato un errore durante il salvataggio',
        visibilityTime: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  // Renderizza un item della lista degli operatori
  const renderOperatoreItem = ({ item }: { item: Operatore }) => (
    <List.Item
      title={`${item.nome} ${item.cognome}`}
      description={item.email}
      left={props => (
        <Avatar.Icon 
          {...props} 
          icon="account-hard-hat" 
          size={40} 
          style={styles.avatar} 
          color="#fff"
        />
      )}
      right={props => (
        <Checkbox
          status={operatoriSelezionati[item.id] ? 'checked' : 'unchecked'}
          onPress={() => toggleOperatore(item.id)}
        />
      )}
      style={[
        styles.listItem, 
        operatoriSelezionati[item.id] && styles.selectedItem
      ]}
      onPress={() => toggleOperatore(item.id)}
    />
  );
  
  // Renderizza un item della lista degli amministratori
  const renderAmministratoreItem = ({ item }: { item: Operatore }) => (
    <List.Item
      title={`${item.nome} ${item.cognome}`}
      description={item.email}
      left={props => (
        <Avatar.Icon 
          {...props} 
          icon="account-tie" 
          size={40} 
          style={styles.avatarAdmin} 
          color="#fff"
        />
      )}
      right={props => (
        <Checkbox
          status={amministratoriSelezionati[item.id] ? 'checked' : 'unchecked'}
          onPress={() => toggleAmministratore(item.id)}
        />
      )}
      style={[
        styles.listItem, 
        amministratoriSelezionati[item.id] && styles.selectedItemAdmin
      ]}
      onPress={() => toggleAmministratore(item.id)}
    />
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={centro ? `Gestione Utenti - ${centro.nome}` : 'Gestione Utenti'} />
        {hasChanges && (
          <Appbar.Action 
            icon="content-save" 
            onPress={salvaAssociazioni} 
            disabled={saving}
          />
        )}
      </Appbar.Header>
      
      {centro && (
        <Card style={styles.centroCard}>
          <Card.Content>
            <Text style={styles.centroTitle}>{centro.nome}</Text>
            <View style={styles.centroInfo}>
              <Chip icon="domain" style={styles.centroChip}>{centro.tipo}</Chip>
              <Text style={styles.centroIndirizzo}>{centro.indirizzo}</Text>
            </View>
          </Card.Content>
        </Card>
      )}
      
      {isSuperAdmin && (
        <View style={styles.segmentContainer}>
          <SegmentedButtons
            value={visualizzazione}
            onValueChange={(value) => setVisualizzazione(value as 'operatori' | 'amministratori')}
            buttons={[
              { value: 'operatori', label: 'Operatori', icon: 'account-hard-hat' },
              { value: 'amministratori', label: 'Amministratori', icon: 'account-tie' }
            ]}
          />
        </View>
      )}
      
      <View style={styles.header}>
        <Searchbar
          placeholder={`Cerca ${visualizzazione === 'operatori' ? 'operatori' : 'amministratori'}...`}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento utenti...</Text>
        </View>
      ) : (
        <>
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionText}>
              {visualizzazione === 'operatori' 
                ? `${Object.values(operatoriSelezionati).filter(Boolean).length} operatori selezionati`
                : `${Object.values(amministratoriSelezionati).filter(Boolean).length} amministratori selezionati`
              }
            </Text>
            <Button 
              mode="text" 
              onPress={() => {
                if (visualizzazione === 'operatori') {
                  const newState: Record<number, boolean> = {};
                  operatori.forEach(op => {
                    newState[op.id] = false;
                  });
                  setOperatoriSelezionati(newState);
                } else {
                  const newState: Record<number, boolean> = {};
                  amministratori.forEach(admin => {
                    newState[admin.id] = false;
                  });
                  setAmministratoriSelezionati(newState);
                }
              }}
              disabled={visualizzazione === 'operatori' 
                ? !Object.values(operatoriSelezionati).some(Boolean)
                : !Object.values(amministratoriSelezionati).some(Boolean)
              }
            >
              <Text>Deseleziona tutti</Text>
            </Button>
          </View>
          
          {visualizzazione === 'operatori' ? (
            <FlatList
              data={filteredOperatori}
              renderItem={renderOperatoreItem}
              keyExtractor={(item) => `op-${item.id}`}
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
                    {searchQuery ? 'Nessun operatore corrisponde alla ricerca' : 'Nessun operatore disponibile'}
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
          ) : (
            <FlatList
              data={filteredAmministratori}
              renderItem={renderAmministratoreItem}
              keyExtractor={(item) => `admin-${item.id}`}
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
                    {searchQuery ? 'Nessun amministratore corrisponde alla ricerca' : 'Nessun amministratore disponibile'}
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
        </>
      )}
      
      {hasChanges && (
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={salvaAssociazioni}
            style={styles.saveButton}
            loading={saving}
            disabled={saving}
            icon="content-save"
          >
            <Text>Salva Modifiche</Text>
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centroCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  centroTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  centroInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  centroChip: {
    backgroundColor: '#e8f5e9',
    marginRight: 8,
    marginBottom: 4,
  },
  centroIndirizzo: {
    color: '#666',
    flex: 1,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#fff',
    elevation: 1,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f0f0f0',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
  },
  selectionText: {
    color: '#666',
  },
  listContent: {
    paddingBottom: 80, // Extra padding per il pulsante di salvataggio
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
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedItem: {
    backgroundColor: '#e8f5e9',
  },
  selectedItemAdmin: {
    backgroundColor: '#e3f2fd',
  },
  avatar: {
    backgroundColor: PRIMARY_COLOR,
  },
  avatarAdmin: {
    backgroundColor: '#1976d2',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 8,
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
  },
}); 


