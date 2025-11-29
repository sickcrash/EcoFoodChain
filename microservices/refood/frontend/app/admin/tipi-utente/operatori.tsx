import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Appbar, Card, ActivityIndicator, Searchbar, Avatar, List, Checkbox, SegmentedButtons, Divider } from 'react-native-paper';
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

// Interfaccia per il tipo utente
interface TipoUtente {
  id: number;
  indirizzo: string;
  tipo: string;
}

export default function GestioneOperatoriScreen() {
  const params = useLocalSearchParams();
  const tipoUtenteId = params.id as string;
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
  const [tipoUtente, setTipoUtente] = useState<TipoUtente | null>(null);
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

  // Carica i dati all'avvio e quando torna in focus
  // Funzione per filtrare operatori o amministratori in base alla ricerca
  const filterOperatori = useCallback(() => {
    if (visualizzazione === 'operatori') {
      if (!searchQuery.trim()) {
        setFilteredOperatori(operatori);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = operatori.filter(
          op => op.nome.toLowerCase().includes(query) || 
                op.cognome.toLowerCase().includes(query) || 
                op.email.toLowerCase().includes(query)
        );
        setFilteredOperatori(filtered);
      }
    } else {
      if (!searchQuery.trim()) {
        setFilteredAmministratori(amministratori);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = amministratori.filter(
          admin => admin.nome.toLowerCase().includes(query) || 
                   admin.cognome.toLowerCase().includes(query) || 
                   admin.email.toLowerCase().includes(query)
        );
        setFilteredAmministratori(filtered);
      }
    }
  }, [amministratori, operatori, searchQuery, visualizzazione]);

  // Effettua la ricerca quando il testo di ricerca cambia
  useEffect(() => {
    filterOperatori();
  }, [filterOperatori]);

  // Funzione per aggiornare i dati con pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadUtenti();
    setRefreshing(false);
    setHasChanges(false);
  };

  // Funzione per caricare i dati del tipo utente
  const loadTipoUtente = useCallback(async () => {
    try {
      const token = await getActiveToken();
      
      const response = await fetch(`${API_URL}/tipi-utente/${tipoUtenteId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Errore nel caricamento del tipo utente (${response.status})`);
      }

      const data = await response.json();
      
      setTipoUtente(data.tipoUtente);
    } catch (error) {
      console.error('Errore nel caricamento del tipo utente:', error);
      Alert.alert('Errore', 'Impossibile caricare i dettagli del tipo utente.');
    }
  }, [tipoUtenteId]);

  // Funzione per caricare operatori, amministratori e le loro associazioni
  const loadUtenti = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getActiveToken();
      
      console.log(`[DEBUG] Caricamento utenti per il tipo utente ID: ${tipoUtenteId}`);
      
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
      
      // Carica utenti già  associati al tipo utente
      const utentiTipoUtenteResponse = await fetch(`${API_URL}/tipi-utente/${tipoUtenteId}/utenti`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!utentiTipoUtenteResponse.ok) {
        throw new Error(`Errore nel caricamento degli utenti associati (${utentiTipoUtenteResponse.status})`);
      }

      const utentiTipoUtenteData = await utentiTipoUtenteResponse.json();
      
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

      // Utenti già  associati al tipo utente
      let utentiAssociati: any[] = [];
      if (utentiTipoUtenteData && Array.isArray(utentiTipoUtenteData)) {
        utentiAssociati = utentiTipoUtenteData;
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
      setAmministratori(amministratoriFormattati);
      setFilteredAmministratori(amministratoriFormattati);
      
      // Imposta gli utenti selezionati
      setOperatoriSelezionati(selectedOperatori);
      setAmministratoriSelezionati(selectedAmministratori);
      
      // Resetta gli stati di errore
      setHasChanges(false);
    } catch (error) {
      console.error('Errore nel caricamento degli utenti:', error);
      Alert.alert('Errore', 'Impossibile caricare la lista degli utenti.');
    } finally {
      setLoading(false);
    }
  }, [tipoUtenteId, user?.id]);

  useEffect(() => {
    if (tipoUtenteId && isScreenFocused) {
      loadTipoUtente();
      loadUtenti();
    } else if (!tipoUtenteId) {
      Alert.alert('Errore', 'ID tipo utente non valido', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  }, [tipoUtenteId, isScreenFocused, loadTipoUtente, loadUtenti]);

  // Funzione per gestire la selezione/deselezione di un operatore
  const toggleOperatore = (id: number) => {
    setOperatoriSelezionati(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      // Controlla se ci sono cambiamenti rispetto allo stato originale
      const operatoreOriginale = operatori.find(op => op.id === id);
      const hasCambiamenti = operatoreOriginale ? (newState[id] !== operatoreOriginale.assegnato) : false;
      
      // Aggiorna lo stato hasChanges se necessario
      if (hasCambiamenti && !hasChanges) {
        setHasChanges(true);
      } else if (!hasCambiamenti) {
        // Verifica se ci sono altri cambiamenti in operatoriSelezionati
        const altriCambiamenti = Object.entries(newState).some(([opId, selected]) => {
          const op = operatori.find(o => o.id === parseInt(opId));
          return op ? selected !== op.assegnato : false;
        });
        setHasChanges(altriCambiamenti || hasChangesInAmministratori());
      }
      
      return newState;
    });
  };

  // Funzione per gestire la selezione/deselezione di un amministratore
  const toggleAmministratore = (id: number) => {
    setAmministratoriSelezionati(prev => {
      const newState = { ...prev, [id]: !prev[id] };
      // Controlla se ci sono cambiamenti rispetto allo stato originale
      const amministratoreOriginale = amministratori.find(admin => admin.id === id);
      const hasCambiamenti = amministratoreOriginale ? (newState[id] !== amministratoreOriginale.assegnato) : false;
      
      // Aggiorna lo stato hasChanges se necessario
      if (hasCambiamenti && !hasChanges) {
        setHasChanges(true);
      } else if (!hasCambiamenti) {
        // Verifica se ci sono altri cambiamenti in amministratoriSelezionati
        const altriCambiamenti = Object.entries(newState).some(([adminId, selected]) => {
          const admin = amministratori.find(a => a.id === parseInt(adminId));
          return admin ? selected !== admin.assegnato : false;
        });
        setHasChanges(altriCambiamenti || hasChangesInOperatori());
      }
      
      return newState;
    });
  };

  // Verifica se ci sono cambiamenti negli operatori
  const hasChangesInOperatori = () => {
    return Object.entries(operatoriSelezionati).some(([opId, selected]) => {
      const op = operatori.find(o => o.id === parseInt(opId));
      return op ? selected !== op.assegnato : false;
    });
  };

  // Verifica se ci sono cambiamenti negli amministratori
  const hasChangesInAmministratori = () => {
    return Object.entries(amministratoriSelezionati).some(([adminId, selected]) => {
      const admin = amministratori.find(a => a.id === parseInt(adminId));
      return admin ? selected !== admin.assegnato : false;
    });
  };

  // Salva le associazioni utenti-tipo utente
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
      const response = await fetch(`${API_URL}/tipi-utente/${tipoUtenteId}/operatori`, {
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
  const renderOperatoreItem = ({ item }: { item: Operatore }) => {
    return (
      <List.Item
        title={`${item.nome} ${item.cognome}`}
        description={item.email}
        left={props => <Avatar.Icon {...props} icon="account-hard-hat" />}
        right={props => (
          <Checkbox
            status={operatoriSelezionati[item.id] ? 'checked' : 'unchecked'}
            onPress={() => toggleOperatore(item.id)}
          />
        )}
        onPress={() => toggleOperatore(item.id)}
      />
    );
  };

  // Renderizza un item della lista degli amministratori
  const renderAmministratoreItem = ({ item }: { item: Operatore }) => {
    return (
      <List.Item
        title={`${item.nome} ${item.cognome}`}
        description={item.email}
        left={props => <Avatar.Icon {...props} icon="account-tie" />}
        right={props => (
          <Checkbox
            status={amministratoriSelezionati[item.id] ? 'checked' : 'unchecked'}
            onPress={() => toggleAmministratore(item.id)}
            disabled={!isSuperAdmin}
          />
        )}
        onPress={() => isSuperAdmin ? toggleAmministratore(item.id) : null}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={tipoUtente ? `Gestione Utenti - ${tipoUtente.tipo}` : 'Gestione Utenti'} />
        {hasChanges && (
          <Appbar.Action 
            icon="content-save" 
            onPress={salvaAssociazioni} 
            disabled={saving}
          />
        )}
      </Appbar.Header>
      
      {tipoUtente && (
        <Card style={styles.tipoUtenteCard}>
          <Card.Content>
            <Text style={styles.tipoUtenteTitle}>{tipoUtente.tipo}</Text>
            <View style={styles.tipoUtenteInfo}>
              <Text style={styles.tipoUtenteIndirizzo}>{tipoUtente.indirizzo}</Text>
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
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento utenti...</Text>
        </View>
      ) : (
        <FlatList
          data={visualizzazione === 'operatori' ? filteredOperatori : filteredAmministratori}
          renderItem={visualizzazione === 'operatori' ? renderOperatoreItem : renderAmministratoreItem}
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
                {searchQuery.trim() ? 'Nessun risultato trovato' : `Nessun ${visualizzazione === 'operatori' ? 'operatore' : 'amministratore'} disponibile`}
              </Text>
            </View>
          }
        />
      )}
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
  },
  searchBar: {
    elevation: 2,
  },
  tipoUtenteCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 3,
  },
  tipoUtenteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tipoUtenteInfo: {
    marginTop: 8,
  },
  tipoUtenteIndirizzo: {
    fontSize: 14,
    color: '#666',
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingBottom: 16,
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
}); 


