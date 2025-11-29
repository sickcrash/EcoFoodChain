import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { Text, Button, Card, Title, Paragraph, ProgressBar, Badge, Chip, Searchbar, IconButton, ActivityIndicator, Modal, Portal, Dialog, TextInput, Surface, Divider, RadioButton } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { getLottiDisponibili, Lotto } from '../../src/services/lottiService';
import { calcolaStatoLotto } from '../../src/utils/statoLotto';
import { prenotaLotto } from '../../src/services/prenotazioniService';
import { PRIMARY_COLOR, BONIFICO_IBAN_LABEL } from '../../src/config/constants';
import { useAuth } from '../../src/context/AuthContext';
import Toast from 'react-native-toast-message';
import { Calendar, Package } from 'react-native-feather';
import { isAxiosError } from 'axios';

interface Filtri {
  centro_id?: number;
  categoria?: string;
  cerca?: string;
  scadenza_min?: string;
  scadenza_max?: string;
  stato?: string;
}

interface LottoWithCategoria extends Lotto {
  categoria?: string;
  _relevanceScore?: number;
}

export default function LottiDisponibiliScreen() {
  const { user, refreshToken } = useAuth();
  
  const [lotti, setLotti] = useState<LottoWithCategoria[]>([]);
  const [lottiNonFiltrati, setLottiNonFiltrati] = useState<LottoWithCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<Filtri>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filtriVisibili, setFiltriVisibili] = useState(false);
  
  // Stati per la prenotazione
  const [lottoSelezionato, setLottoSelezionato] = useState<LottoWithCategoria | null>(null);
  const [prenotazioneModalVisible, setPrenotazioneModalVisible] = useState(false);
  const [dataRitiroPrevista, setDataRitiroPrevista] = useState<Date>(addDays(new Date(), 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNativeCalendar, setShowNativeCalendar] = useState(false);
  const [notePrenotazione, setNotePrenotazione] = useState('');
  const [prenotazioneInCorso, setPrenotazioneInCorso] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState<'contanti' | 'bonifico' | null>(null);
  // IMPLEMENTAZIONE FILTRO LOCALE PER LA RICERCA CON DEBOUNCE
  const [debounceTimeout, setDebounceTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Funzione sicura per convertire stringhe di date in oggetti Date
  const safeParseDate = (dateString: string | undefined | null): Date | null => {
    if (!dateString) return null;
    
    try {
      // Verifica se la data è in formato ISO (contiene T) o solo data (YYYY-MM-DD)
      const dateParts = dateString.split('T')[0].split('-');
      if (dateParts.length === 3) {
        // Crea la data usando anno-mese-giorno (con mese indicizzato da 0)
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // Mese è 0-based in JavaScript
        const day = parseInt(dateParts[2], 10);
        
        // Verifica validità dei componenti
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const date = new Date(year, month, day);
          
          // Verifica ulteriormente che la data sia valida
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      console.warn('Impossibile parsare la data in modo sicuro:', dateString);
      return null;
    } catch (error) {
      console.error('Errore nel parsing della data:', error, dateString);
      return null;
    }
  };

  // Modifichiamo la funzione per caricare i lotti disponibili
  const loadLottiDisponibili = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Caricamento lotti disponibili con filtri:', JSON.stringify(filtri));
      
      // Crea una copia dei filtri senza la ricerca per l'API
      const apiFiltri = { ...filtri };
      delete apiFiltri.cerca; // Rimuovi il filtro 'cerca' perché lo applicheremo localmente
      
      // Verifica se l'utente è amministratore o operatore
      const isAdmin = user?.ruolo === 'Amministratore';
      const isOperatore = user?.ruolo === 'Operatore';
      const mostraTutti = isAdmin || isOperatore;
      
      try {
        // Questa chiamata include il parametro mostraTutti per amministratori e operatori
        const result = await getLottiDisponibili(apiFiltri, forceRefresh, mostraTutti);
        
        if (mostraTutti) {
          console.log(`Ricevuti ${result.lotti.length} lotti (inclusi quelli già prenotati)`);
        } else {
          console.log(`Ricevuti ${result.lotti.length} lotti disponibili (filtrati per prenotazioni attive)`);
        }
        
        // Ordina i lotti per data di scadenza (i più vicini alla scadenza prima)
        const lottiOrdinati = result.lotti.sort((a: Lotto, b: Lotto) => {
          return new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime();
        });
        
        // Salva tutti i lotti non filtrati
        setLottiNonFiltrati(lottiOrdinati);
        
        // Applica il filtro di ricerca locale se necessario
        if (searchQuery.trim()) {
          console.log('Applicazione filtro locale per:', searchQuery.trim());
          
          // Normalizza il testo di ricerca (rimuovi caratteri speciali)
          const testoDaCercare = searchQuery.trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // rimuove accenti
          
          // Filtra i lotti localmente con la stessa logica di handleSearchChange
          const lottiFiltrati = lottiOrdinati.filter(lotto => {
            // Normalizza i testi per la ricerca
            const nome = (lotto.nome || "").toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const descrizione = (lotto.descrizione || "").toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const centroNome = (lotto.centro_nome || "").toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            // Verifica se il testo di ricerca è contenuto in uno dei campi
            return nome.includes(testoDaCercare) || 
                   descrizione.includes(testoDaCercare) || 
                   centroNome.includes(testoDaCercare);
          });
          
          console.log(`Filtrati ${lottiFiltrati.length} lotti su ${lottiOrdinati.length}`);
          setLotti(lottiFiltrati);
        } else {
          // Se non c'è testo di ricerca, mostra tutti i lotti
          setLotti(lottiOrdinati);
        }
        
        console.log(`Caricati ${lottiOrdinati.length} lotti disponibili`);
      } catch (err: any) {
        console.error('Errore nel caricamento dei lotti disponibili:', err);
        
        // Gestiamo con grace l'errore 500 per evitare di mandare in crash l'app
        if (isAxiosError(err) && err.response?.status === 500) {
          setError("Il server non risponde correttamente. Verranno mostrati i lotti disponibili in cache se presenti.");
          
          // Attendiamo un breve periodo e riproviamo silenziosamente
          setTimeout(() => {
            // Tentativo silenzioso di recupero
            getLottiDisponibili(apiFiltri, true)
              .then((result) => {
                if (result.lotti.length > 0) {
                  const lottiOrdinati = result.lotti.sort((a, b) => {
                    return new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime();
                  });
                  setLottiNonFiltrati(lottiOrdinati);
                  setLotti(lottiOrdinati);
                  setError(null);
                }
              })
              .catch(() => {
                // Ignoriamo errori silenziosi
              });
          }, 5000);
        } else {
          // Per altri errori, mostro un messaggio appropriato
          setError(err.message || 'Errore nel caricamento dei lotti disponibili');
          
          Toast.show({
            type: 'error',
            text1: 'Errore',
            text2: err.message || 'Impossibile caricare i lotti disponibili',
          });
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtri, searchQuery, user?.ruolo]);
  
  // Effetto per caricare i lotti al montaggio del componente
  useEffect(() => {
    loadLottiDisponibili();
  }, [loadLottiDisponibili]);
  
  // Effetto per ricaricare i lotti quando i filtri cambiano (escluso il filtro cerca)
  useEffect(() => {
    const { cerca, ...altriFiltri } = filtri;

    if (Object.keys(altriFiltri).length > 0) {
      loadLottiDisponibili(true);
    }
  }, [filtri, loadLottiDisponibili]);
  
  // Modifico useFocusEffect per considerare anche i filtri
  useFocusEffect(
    useCallback(() => {
      console.log('useFocusEffect attivato con filtri:', JSON.stringify(filtri));

      loadLottiDisponibili(true);

      return () => {
        // Cleanup
      };
    }, [filtri, loadLottiDisponibili])
  );
  
  // Funzione per gestire il pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadLottiDisponibili(true);
  };
  
  // IMPLEMENTAZIONE FILTRO LOCALE PER LA RICERCA CON DEBOUNCE
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    
    // Cancella il timeout precedente se esiste
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    
    // Imposta un nuovo timeout per il debounce (300ms)
    const timeout = setTimeout(() => {
      console.log('Applicazione ricerca per:', text);
      
      // Se il testo di ricerca è vuoto, resetta al set di lotti filtrati dall'API
      if (!text.trim()) {
        setLotti(lottiNonFiltrati);
        return;
      }
      
      // Normalizza il testo di ricerca (rimuovi caratteri speciali e accenti)
      const testoDaCercare = text.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // Filtra i lotti localmente con una ricerca più approfondita
      const lottiFiltrati = lottiNonFiltrati.filter(lotto => {
        // Normalizza i testi per la ricerca
        const nome = (lotto.nome || "").toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const descrizione = (lotto.descrizione || "").toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const centroNome = (lotto.centro_nome || "").toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const categoria = (lotto.categoria || "").toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const stato = (lotto.stato || "").toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const unita = (lotto.unita_misura || "").toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Verifica se il testo di ricerca è contenuto in uno dei campi principali
        const matchPrincipale = nome.includes(testoDaCercare) || 
                 descrizione.includes(testoDaCercare) || 
                 centroNome.includes(testoDaCercare);
                 
        // Verifica se il testo di ricerca è contenuto in uno dei campi secondari
        const matchSecondario = categoria.includes(testoDaCercare) || 
                 stato.includes(testoDaCercare) || 
                 unita.includes(testoDaCercare);
        
        // Diamo priorità ai match nei campi principali, ma includiamo anche i secondari
        return matchPrincipale || matchSecondario;
      });
      
      console.log(`Filtrati ${lottiFiltrati.length} lotti su ${lottiNonFiltrati.length}`);
      
      // Applica il filtro di evidenziazione sui risultati
      const lottiEvidenziati = lottiFiltrati.map(lotto => {
        // Se il termine di ricerca corrisponde esattamente a una categoria o stato,
        // assegna un punteggio più alto per prioritizzare quei risultati
        let score = 0;
        
        const categoria = (lotto.categoria || "").toLowerCase();
        const stato = (lotto.stato || "").toLowerCase();
        const nome = (lotto.nome || "").toLowerCase();
        
        if (categoria === testoDaCercare) score += 5;
        if (stato === testoDaCercare) score += 3;
        if (nome.includes(testoDaCercare)) score += 10;
        
        return { ...lotto, _relevanceScore: score };
      }).sort((a, b) => {
        // Ordina per punteggio di rilevanza e poi per data di scadenza
        if (b._relevanceScore !== a._relevanceScore) {
          return b._relevanceScore - a._relevanceScore;
        }
        return new Date(a.data_scadenza).getTime() - new Date(b.data_scadenza).getTime();
      });
      
      setLotti(lottiEvidenziati);
    }, 300); // Tempo di debounce: 300ms
    
    setDebounceTimeout(timeout);
  };
  
  // Funzione per cercare
  const onSearch = () => {
    handleSearchChange(searchQuery);
    
    if (searchQuery.trim()) {
      // Mostra un toast per confermare la ricerca
      Toast.show({
        type: 'info',
        text1: 'Ricerca attiva',
        text2: `Ricerca locale per: "${searchQuery.trim()}"`,
        visibilityTime: 2000,
      });
    }
  };

  // Funzione per applicare il filtro di stato (colore)
  const applyStatoFilter = (stato: string | null) => {
    const nuoviFiltri = { ...filtri };
    
    // Se è lo stesso stato, lo togliamo (toggle)
    if (stato && filtri.stato === stato) {
      delete nuoviFiltri.stato;
      Toast.show({
        type: 'info',
        text1: 'Filtro rimosso',
        text2: `Il filtro per stato "${stato}" è stato rimosso`
      });
    } else if (stato) {
      // Altrimenti impostiamo il nuovo stato
      nuoviFiltri.stato = stato;
      Toast.show({
        type: 'success',
        text1: 'Filtro applicato',
        text2: `Verranno mostrati solo i lotti in stato "${stato}"`
      });
    } else {
      // Se è null, rimuoviamo il filtro di stato
      delete nuoviFiltri.stato;
      Toast.show({
        type: 'info',
        text1: 'Filtro rimosso',
        text2: 'Il filtro per stato è stato rimosso'
      });
    }
    
    // Aggiorna i filtri
    setFiltri(nuoviFiltri);
  };

  // Funzione per resettare i filtri
  const resetFiltri = () => {
    console.log("Resetting all filters");
    
    // Resetta tutti i filtri API
    setFiltri({});
    
    // Resetta la ricerca locale
    setSearchQuery('');
    
    // Se abbiamo già i lotti non filtrati, li usiamo
    if (lottiNonFiltrati.length > 0) {
      // Resetta la lista dei lotti al valore originale non filtrato
      setLotti(lottiNonFiltrati);
      
      Toast.show({
        type: 'success',
        text1: 'Filtri reimpostati',
        text2: 'Tutti i filtri sono stati rimossi'
      });
    } else {
      // Se non abbiamo lotti in cache, ricarica i dati dal server
      loadLottiDisponibili(true);
      
      Toast.show({
        type: 'success',
        text1: 'Filtri reimpostati',
        text2: 'Ricaricamento dati in corso...'
      });
    }
  };
  
  // Funzione per applicare i filtri
  const applyFilters = () => {
    setFiltriVisibili(false);
    // Il filtro è già stato applicato quando è stato selezionato
  };
  
  // Funzione per navigare ai dettagli del lotto
  const navigateToLottoDetail = (lotto: Lotto) => {
    router.push(`/lotti/dettaglio/${lotto.id}`);
  };
  
  // Funzione per ottenere il colore dello stato
  // Colori coerenti con la dashboard
  const getStateColor = (stato: 'Verde' | 'Arancione' | 'Rosso') => {
    switch (stato) {
      case 'Verde':
        return '#4CAF50';
      case 'Arancione':
        return '#FF9800';
      case 'Rosso':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };
  
  // Funzione per formattare la data
  const formatDate = (dateString: string) => {
    try {
      const date = safeParseDate(dateString);
      if (date && !isNaN(date.getTime())) {
        return format(date, 'dd/MM/yyyy', { locale: it });
      } else {
        return 'Data non valida';
      }
    } catch (err) {
      console.error('Errore nella formattazione della data:', err);
      return 'Errore formato data';
    }
  };
  
  // Funzione per mostrare il modale di prenotazione
  const handlePrenotazione = (lotto: Lotto) => {
    setLottoSelezionato(lotto as LottoWithCategoria);
    setDataRitiroPrevista(addDays(new Date(), 1)); // Imposta la data di prelievo prevista a domani
    setNotePrenotazione('');
    const isLottoVerde = (lotto.stato || '').toUpperCase() === 'VERDE';
    const isUtentePrivato = (user?.tipo_utente || '').toUpperCase() === 'PRIVATO';
    setMetodoPagamento(isLottoVerde && isUtentePrivato ? 'contanti' : null);
    setPrenotazioneModalVisible(true);
  };
  
  // Funzione migliorata per gestire gli errori di autenticazione
  const handleAuthError = async () => {
    try {
      console.log('Tentativo di aggiornare l\'autenticazione...');
      
      // Verifica se la funzione refreshToken è disponibile
      if (refreshToken) {
        console.log('Tentativo di refresh del token...');
        const refreshSuccess = await refreshToken();
        
        if (refreshSuccess) {
          Toast.show({
            type: 'info',
            text1: 'Autenticazione aggiornata',
            text2: 'Riprova l\'operazione',
            visibilityTime: 3000,
          });
          
          // Ricarica i lotti dopo il refresh del token
          loadLottiDisponibili(true);
          return;
        }
      }
      
      // Se non c'è refreshToken o il refresh fallisce, mostra l'errore
      Toast.show({
        type: 'error',
        text1: 'Errore di autenticazione',
        text2: 'Accedi nuovamente per continuare',
        visibilityTime: 4000,
      });
      
      // Ridireziona alla pagina di login
      router.push('/login');
    } catch (err) {
      console.error('Errore nell\'aggiornamento dell\'autenticazione:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore di autenticazione',
        text2: 'Accedi nuovamente per continuare',
      });
      router.push('/login');
    }
  };
  
  // Funzione per confermare la prenotazione
  const confermaPrenotazione = async () => {
    if (!lottoSelezionato) {
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Nessun lotto selezionato per la prenotazione',
      });
      return;
    }
    
    try {
      setPrenotazioneInCorso(true);
      
      // Prepara la data di prelievo nel formato corretto
      const dataRitiro = dataRitiroPrevista
        ? format(dataRitiroPrevista, 'yyyy-MM-dd')
        : undefined;
      const isLottoVerde = lottoSelezionato.stato?.toUpperCase() === 'VERDE';
      const isUtenteTipoPrivato = user?.tipo_utente?.toUpperCase() === 'PRIVATO';
      const pagamentoRichiesto = isLottoVerde && isUtenteTipoPrivato;

      if (pagamentoRichiesto && !metodoPagamento) {
        Toast.show({
          type: 'info',
          text1: 'Metodo di pagamento richiesto',
          text2: 'Seleziona un metodo di pagamento per completare la prenotazione.',
          visibilityTime: 3000,
        });
        setPrenotazioneInCorso(false);
        return;
      }

      // Chiama il servizio di prenotazione
      const result = await prenotaLotto(
        lottoSelezionato.id,
        dataRitiro,
        notePrenotazione || null,
        pagamentoRichiesto ? metodoPagamento : null
      );
      
      if (result.success) {
        // Chiudi il modale e mostra conferma
        setPrenotazioneModalVisible(false);
        setMetodoPagamento(null);

        // Verifica se è un utente privato che prenota un lotto verde con pagamento bonifico
        const isLottoVerde = lottoSelezionato.stato?.toUpperCase() === 'VERDE';
        const isUtenteTipoPrivato = user?.tipo_utente?.toUpperCase() === 'PRIVATO';
        if (isUtenteTipoPrivato && isLottoVerde) {
          Toast.show({
            type: 'success',
            text1: 'Prenotazione effettuata',
            text2: 'La tua richiesta è stata presa in carico, controlla la mail per i prossimi passi.',
            visibilityTime: 4000,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'Prenotazione effettuata',
            text2: 'La tua prenotazione è stata registrata con successo!',
            visibilityTime: 3000,
          });
        }
        
        // Ricarica i lotti dopo la prenotazione
        await loadLottiDisponibili(true);
        
        // Reindirizza alla pagina delle prenotazioni (dentro le tabs)
        router.push('/(tabs)/prenotazioni');
      } else {
        // Gestione specifica degli errori di prenotazione
        if (result.error?.message === 'Prenotazione duplicata') {
          // Caso di prenotazione duplicata dello stesso utente
          Toast.show({
            type: 'info',
            text1: 'Prenotazione già esistente',
            text2: `Hai già una prenotazione attiva per questo lotto (Stato: ${result.error.prenotazioneEsistente?.stato}).`,
            visibilityTime: 4000,
          });
        } else if (result.error?.message === 'Lotto già prenotato') {
          // Caso di lotto già prenotato da altri
          Toast.show({
            type: 'error',
            text1: 'Lotto non disponibile',
            text2: 'Questo lotto è già stato prenotato da un altro centro',
            visibilityTime: 3000,
          });
          
          // Ricarica i lotti per rimuoverlo dalla lista
          await loadLottiDisponibili(true);
        } else if (result.error?.message === 'Unauthorized' || result.error?.message?.includes('token')) {
          // Gestione errore di autorizzazione
          handleAuthError();
        } else if (result.missingCentroId) {
          Toast.show({
            type: 'info',
            text1: 'ID Centro richiesto',
            text2: 'Inserisci il codice del tuo centro per completare la prenotazione',
            visibilityTime: 3000,
          });
        } else {
          // Altri errori
          Toast.show({
            type: 'error',
            text1: 'Errore nella prenotazione',
            text2: result.message || 'Si è verificato un errore. Riprova più tardi.',
            visibilityTime: 3000,
          });
        }
      }
    } catch (error: any) {
      console.error('Errore durante la prenotazione:', error);
      
      // Verifica se è un errore di autorizzazione
      if (error.message?.includes('token') || error.message?.includes('Unauthorized') || 
          error?.response?.status === 401 || error?.response?.status === 403) {
        handleAuthError();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: 'Si è verificato un errore. Riprova più tardi.',
          visibilityTime: 3000,
        });
      }
    } finally {
      setPrenotazioneInCorso(false);
    }
  };
  
  // Funzione per calcolare i giorni rimanenti alla scadenza
  const getGiorniRimanenti = (dataScadenza: string) => {
    try {
      const oggi = new Date();
      const scadenza = safeParseDate(dataScadenza);
      
      if (!scadenza || isNaN(scadenza.getTime())) {
        console.warn('Data di scadenza non valida per il calcolo dei giorni rimanenti:', dataScadenza);
        return 0;
      }
      
      const diffTime = scadenza.getTime() - oggi.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (err) {
      console.error('Errore nel calcolo dei giorni rimanenti:', err);
      return 0;
    }
  };
  
  // Funzione per renderizzare un item della lista
  const renderLottoItem = ({ item }: { item: Lotto }) => {
    const giorniRimanenti = getGiorniRimanenti(item.data_scadenza);
    const statoDinamico = calcolaStatoLotto(item.data_scadenza);
    const statoColor = getStateColor(statoDinamico);
    
    return (
      <Card 
        style={styles.lottoCard} 
        onPress={() => navigateToLottoDetail(item)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Title>{item.nome}</Title>
              <Badge 
                style={[styles.statoBadge, { backgroundColor: statoColor }]}
              >
                {giorniRimanenti > 0 ? `${giorniRimanenti} giorni` : 'Scade oggi'}
              </Badge>
            </View>
          </View>
          
          <Paragraph style={styles.descrizione}>
            {item.descrizione && item.descrizione.length > 100 
              ? `${item.descrizione.substring(0, 100)}...` 
              : item.descrizione || 'Nessuna descrizione'}
          </Paragraph>
          
          <View style={styles.dettagliContainer}>
            <View style={styles.dettaglioItem}>
              <Package width={16} height={16} color="#555" />
              <Text style={styles.dettaglioText}>
                {item.quantita} {item.unita_misura}
              </Text>
            </View>
            
            <View style={styles.dettaglioItem}>
              <Calendar width={16} height={16} color="#555" />
              <Text style={styles.dettaglioText}>
                Scadenza: {formatDate(item.data_scadenza)}
              </Text>
            </View>
          </View>
          
          <ProgressBar 
            progress={1 - (giorniRimanenti / 7)} 
            color={statoColor} 
            style={styles.progressBar} 
          />
        </Card.Content>
        
        <Card.Actions style={styles.cardActions}>
          <Button 
            mode="outlined" 
            onPress={() => navigateToLottoDetail(item)}
            style={styles.actionButton}
            icon="information-outline"
          >
            Dettagli
          </Button>
          
          <Button 
            mode="contained" 
            onPress={() => handlePrenotazione(item)}
            style={styles.prenotaButton}
            icon="shopping"
            disabled={!user || !(
              (user.tipo_utente?.toUpperCase() === 'PRIVATO' && statoDinamico === 'Verde') ||
              (user.tipo_utente?.toUpperCase() === 'CANALE SOCIALE' && statoDinamico === 'Arancione') ||
              (user.tipo_utente?.toUpperCase() === 'CENTRO RICICLO' && statoDinamico === 'Rosso')
            )}
          >
            Prenota
          </Button>
        </Card.Actions>
      </Card>
    );
  };
  
  // Modifica completa del renderDialog per rendere i pulsanti più evidenti
  const renderDialog = () => {
    const richiedeMetodoPagamento =
      lottoSelezionato?.stato?.toUpperCase() === 'VERDE' &&
      user?.tipo_utente?.toUpperCase() === 'PRIVATO';

    return (
      <Portal>
        <Dialog
          visible={prenotazioneModalVisible}
          onDismiss={() => {
            setPrenotazioneModalVisible(false);
            setMetodoPagamento(null);
          }}
          style={styles.prenotazioneDialog}
          dismissable={!prenotazioneInCorso} // Impedisci chiusura durante il caricamento
        >
          <Dialog.Title style={styles.dialogTitle}>Prenota Lotto</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <View style={styles.dialogContent}>
              <Text style={styles.dialogText}>
                Stai prenotando il lotto:
              </Text>
              <Text style={styles.dialogProdotto}>
                {lottoSelezionato?.nome}
              </Text>
              <Text style={styles.dialogText}>
                Seleziona la data di prelievo:
              </Text>

              <View style={styles.dateButtonsContainer}>
                <Button
                  mode="outlined"
                  onPress={() => setDataRitiroPrevista(addDays(new Date(), 1))}
                  style={[
                    styles.dateButton,
                    format(dataRitiroPrevista, 'yyyy-MM-dd') === format(addDays(new Date(), 1), 'yyyy-MM-dd') ? styles.dateButtonSelected : null
                  ]}
                >
                  Domani
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setDataRitiroPrevista(addDays(new Date(), 2))}
                  style={[
                    styles.dateButton,
                    format(dataRitiroPrevista, 'yyyy-MM-dd') === format(addDays(new Date(), 2), 'yyyy-MM-dd') ? styles.dateButtonSelected : null
                  ]}
                >
                  Dopodomani
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setDataRitiroPrevista(addDays(new Date(), 3))}
                  style={[
                    styles.dateButton,
                    format(dataRitiroPrevista, 'yyyy-MM-dd') === format(addDays(new Date(), 3), 'yyyy-MM-dd') ? styles.dateButtonSelected : null
                  ]}
                >
                  Tra 3 giorni
                </Button>
              </View>

              <View style={styles.datePickerContainer}>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    style={styles.webDatePicker}
                    min={new Date().toISOString().split('T')[0]}
                    value={dataRitiroPrevista.toISOString().split('T')[0]}
                    onChange={(e) => {
                      try {
                        console.log('Input web datestring:', e.target.value);
                        if (e.target.value) {
                          const date = new Date(e.target.value);
                          if (!isNaN(date.getTime())) {
                            setDataRitiroPrevista(date);
                          }
                        }
                      } catch (error) {
                        console.error('Errore nel date picker web:', error);
                      }
                    }}
                  />
                ) : (
                  <Button
                    mode="outlined"
                    icon="calendar"
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        setShowDatePicker(true);
                      } else {
                        setShowDatePicker(true);
                        setShowNativeCalendar(true);
                      }
                    }}
                    style={styles.datePickerButton}
                  >
                    Seleziona un'altra data
                  </Button>
                )}
              </View>

              <Text style={styles.selectedDateText}>
                Data selezionata: {format(dataRitiroPrevista, 'dd/MM/yyyy', { locale: it })}
              </Text>

              {richiedeMetodoPagamento && (
                <View style={styles.paymentSection}>
                  <Text style={styles.paymentSectionTitle}>Metodo di pagamento</Text>
                  <RadioButton.Group
                    onValueChange={(value) => setMetodoPagamento(value as 'contanti' | 'bonifico')}
                    value={metodoPagamento ?? 'contanti'}
                  >
                    <TouchableOpacity
                      style={styles.paymentOption}
                      activeOpacity={0.8}
                      onPress={() => setMetodoPagamento('contanti')}
                    >
                      <RadioButton value="contanti" />
                      <View style={styles.paymentOptionContent}>
                        <Text style={styles.paymentOptionTitle}>Contanti alla consegna</Text>
                        <Text style={styles.paymentOptionSubtitle}>
                          Pagherai direttamente al momento del ritiro del lotto.
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.paymentOption}
                      activeOpacity={0.8}
                      onPress={() => setMetodoPagamento('bonifico')}
                    >
                      <RadioButton value="bonifico" />
                      <View style={styles.paymentOptionContent}>
                        <Text style={styles.paymentOptionTitle}>Bonifico bancario</Text>
                        <Text style={styles.paymentOptionSubtitle}>{BONIFICO_IBAN_LABEL}</Text>
                      </View>
                    </TouchableOpacity>
                  </RadioButton.Group>
                </View>
              )}

              <TextInput
                label="Note (opzionale)"
                value={notePrenotazione}
                onChangeText={setNotePrenotazione}
                multiline
                style={styles.noteInput}
              />
            </View>
          </Dialog.ScrollArea>
          <View style={styles.dialogBottomBar}>
            <Button
              onPress={() => {
                setPrenotazioneModalVisible(false);
                setMetodoPagamento(null);
              }}
              style={styles.dialogCancelButton}
              labelStyle={styles.dialogButtonLabel}
              contentStyle={styles.dialogButtonContent}
              disabled={prenotazioneInCorso}
            >
              ANNULLA
            </Button>
            <Button
              mode="contained"
              onPress={confermaPrenotazione}
              loading={prenotazioneInCorso}
              disabled={prenotazioneInCorso || (richiedeMetodoPagamento && !metodoPagamento)}
              style={styles.dialogConfirmButton}
              labelStyle={styles.dialogButtonLabel}
              contentStyle={styles.dialogButtonContent}
            >
              CONFERMA
            </Button>
          </View>
        </Dialog>
      </Portal>
    );
  };

  // Miglioramento del modal dei filtri per una user experience più intuitiva
  const renderFiltriModal = () => (
    <Portal>
      <Modal
        visible={filtriVisibili}
        onDismiss={() => setFiltriVisibili(false)}
        contentContainerStyle={styles.modalContent}
      >
        <View style={styles.modalHeader}>
          <IconButton
            icon="close"
            size={24}
            onPress={() => setFiltriVisibili(false)}
          />
          <Text style={styles.modalTitle}>Filtri Avanzati</Text>
          <Button
            onPress={resetFiltri}
            mode="text"
          >
            Reset
          </Button>
        </View>
        
        <Divider />
        
        <View style={styles.filtriContent}>
          <Text style={styles.filterSectionTitle}>Stato lotto</Text>
          <View style={styles.chipContainer}>
            <Chip
              selected={filtri.stato === 'Verde'}
              onPress={() => applyStatoFilter(filtri.stato === 'Verde' ? null : 'Verde')}
              style={[styles.chip, filtri.stato === 'Verde' && styles.chipSelected, { backgroundColor: filtri.stato === 'Verde' ? 'rgba(76, 175, 80, 0.2)' : undefined }]}
              textStyle={{ color: filtri.stato === 'Verde' ? '#388E3C' : undefined }}
            >
              <View style={styles.chipContent}>
                <View style={[styles.colorIndicator, { backgroundColor: '#4CAF50' }]} />
                <Text>Verde</Text>
              </View>
            </Chip>
            
            <Chip
              selected={filtri.stato === 'Arancione'}
              onPress={() => applyStatoFilter(filtri.stato === 'Arancione' ? null : 'Arancione')}
              style={[styles.chip, filtri.stato === 'Arancione' && styles.chipSelected, { backgroundColor: filtri.stato === 'Arancione' ? 'rgba(255, 152, 0, 0.2)' : undefined }]}
              textStyle={{ color: filtri.stato === 'Arancione' ? '#F57C00' : undefined }}
            >
              <View style={styles.chipContent}>
                <View style={[styles.colorIndicator, { backgroundColor: '#FF9800' }]} />
                <Text>Arancione</Text>
              </View>
            </Chip>
            
            <Chip
              selected={filtri.stato === 'Rosso'}
              onPress={() => applyStatoFilter(filtri.stato === 'Rosso' ? null : 'Rosso')}
              style={[styles.chip, filtri.stato === 'Rosso' && styles.chipSelected, { backgroundColor: filtri.stato === 'Rosso' ? 'rgba(244, 67, 54, 0.2)' : undefined }]}
              textStyle={{ color: filtri.stato === 'Rosso' ? '#D32F2F' : undefined }}
            >
              <View style={styles.chipContent}>
                <View style={[styles.colorIndicator, { backgroundColor: '#F44336' }]} />
                <Text>Rosso</Text>
              </View>
            </Chip>
          </View>
          
          <Text style={styles.filterSectionTitle}>Intervallo scadenza</Text>
          <View style={styles.dateRangeContainer}>
            <TouchableOpacity 
              style={styles.dateInput}
              onPress={() => {
                // Implementazione futura datepicker per scadenza minima
                Toast.show({
                  type: 'info',
                  text1: 'Funzionalità in arrivo',
                  text2: 'Il selettore data sarà disponibile nella prossima versione',
                });
              }}
            >
              <Text style={styles.dateInputLabel}>Da</Text>
              <Text>{filtri.scadenza_min ? format(new Date(filtri.scadenza_min), 'dd/MM/yyyy') : 'Qualsiasi'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.dateInput}
              onPress={() => {
                // Implementazione futura datepicker per scadenza massima
                Toast.show({
                  type: 'info',
                  text1: 'Funzionalità in arrivo',
                  text2: 'Il selettore data sarà disponibile nella prossima versione',
                });
              }}
            >
              <Text style={styles.dateInputLabel}>A</Text>
              <Text>{filtri.scadenza_max ? format(new Date(filtri.scadenza_max), 'dd/MM/yyyy') : 'Qualsiasi'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={() => {
                applyFilters();
                setFiltriVisibili(false);
              }}
              style={styles.applyButton}
            >
              Applica Filtri
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );

  // Modal per il DatePicker
  const renderDatePickerModal = () => (
    <>
      <Portal>
        <Modal
          visible={showDatePicker}
          onDismiss={() => {
            setShowNativeCalendar(false);
            setShowDatePicker(false);
          }}
          contentContainerStyle={styles.modalContainer}
        >
          <Surface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleziona data di prelievo</Text>
            </View>
            <Divider />
            <View style={styles.datePickerContainer}>
              <View style={styles.dateButtonsRow}>
                <Button 
                  mode="outlined" 
                  icon="arrow-left" 
                  onPress={() => {
                  const newDate = addDays(dataRitiroPrevista, -1);
                  setDataRitiroPrevista(newDate);
                }}
                style={styles.dateButton}
              >
                -1 giorno
              </Button>
              <Button 
                mode="outlined" 
                icon="calendar-today" 
                onPress={() => {
                  setDataRitiroPrevista(addDays(new Date(), 1));
                }}
                style={styles.dateButton}
              >
                Domani
              </Button>
              <Button 
                mode="outlined" 
                icon="arrow-right" 
                onPress={() => {
                  const newDate = addDays(dataRitiroPrevista, 1);
                  setDataRitiroPrevista(newDate);
                }}
                style={styles.dateButton}
              >
                +1 giorno
              </Button>
            </View>
              <View style={styles.dateButtonsRow}>
                <Button 
                  mode="outlined" 
                  onPress={() => {
                    const newDate = addDays(dataRitiroPrevista, 7);
                    setDataRitiroPrevista(newDate);
                  }}
                  style={styles.dateButton}
                >
                  +1 settimana
                </Button>
                <Button 
                  mode="outlined" 
                  onPress={() => {
                    const newDate = addDays(dataRitiroPrevista, 30);
                    setDataRitiroPrevista(newDate);
                  }}
                  style={styles.dateButton}
                >
                  +1 mese
                </Button>
              </View>
              <Button
                mode="contained"
                icon="calendar"
                onPress={() => setShowNativeCalendar(true)}
                style={[styles.nativeCalendarButton, { backgroundColor: PRIMARY_COLOR }]}
                labelStyle={{ fontWeight: 'bold', color: '#fff' }}
              >
                Apri calendario
              </Button>
            </View>
            <Divider />
            <View style={styles.modalFooter}>
              <Button 
                mode="text" 
                onPress={() => {
                  setShowNativeCalendar(false);
                  setShowDatePicker(false);
                }}
              >
                Chiudi
              </Button>
              <Button 
                mode="contained" 
                onPress={() => {
                  setShowNativeCalendar(false);
                  setShowDatePicker(false);
                }}
              >
                Conferma
              </Button>
            </View>
          </Surface>
        </Modal>
      </Portal>
      {Platform.OS !== 'web' && (
        <DatePickerModal
          locale="it"
          mode="single"
          visible={showNativeCalendar}
          date={dataRitiroPrevista || new Date()}
          onDismiss={() => setShowNativeCalendar(false)}
          onConfirm={({ date }) => {
            if (date) {
              const normalized = new Date(date.setHours(0, 0, 0, 0));
              setDataRitiroPrevista(normalized);
            }
            setShowNativeCalendar(false);
            setShowDatePicker(false);
          }}
          validRange={{ startDate: new Date() }}
          saveLabel="Conferma"
          label="Seleziona data di prelievo"
        />
      )}
    </>
  );

  // All'interno di renderLottoItem o vicino
  const renderInfoMessage = () => {
    const isAdmin = user?.ruolo === 'Amministratore';
    const isOperatore = user?.ruolo === 'Operatore';
    
    return (
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          {isAdmin || isOperatore ? 
            '⚠️ Stai visualizzando tutti i lotti, inclusi quelli già prenotati. Solo amministratori e operatori hanno questa visibilità completa.' :
            'ℹ️ Stai visualizzando solo i lotti effettivamente disponibili. I lotti già prenotati da altri centri non sono mostrati.'
          }
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header di ricerca */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Cerca lotti disponibili"
          onChangeText={handleSearchChange}
          value={searchQuery}
          style={styles.searchbar}
          icon="magnify"
          onSubmitEditing={onSearch}
        />
        <IconButton
          icon="magnify"
          size={24}
          onPress={onSearch}
          style={styles.searchButton}
          iconColor="#FFFFFF"
        />
        <IconButton
          icon="filter"
          size={24}
          onPress={() => setFiltriVisibili(true)}
          style={[
            styles.filterButton,
            Object.keys(filtri).length > 0 && styles.activeFilterButton
          ]}
          iconColor={Object.keys(filtri).length > 0 ? PRIMARY_COLOR : '#555'}
        />
      </View>

      {/* Mostra se ci sono filtri attivi */}
      {(Object.keys(filtri).length > 0 || searchQuery.trim()) && (
        <View style={styles.activeFiltersContainer}>
          <Text style={styles.activeFiltersText}>Filtri attivi:</Text>
          
          {/* Chip per la ricerca (filtro locale) */}
          {searchQuery.trim() && (
            <Chip 
              style={styles.filterChip} 
              onClose={() => {
                // Reset solo della ricerca locale
                setSearchQuery('');
                // Riapplica i filtri senza ricerca
                setLotti(lottiNonFiltrati);
                console.log('Rimosso filtro di ricerca locale');
              }}
            >
              Ricerca: {searchQuery.trim()}
            </Chip>
          )}
          
          {/* Chip per lo stato (filtro API) */}
          {filtri.stato && (
            <Chip 
              style={[
                styles.filterChip, 
                filtri.stato === 'verde' ? styles.greenChip : 
                filtri.stato === 'arancione' ? styles.orangeChip : 
                filtri.stato === 'rosso' ? styles.redChip : null
              ]} 
              onClose={() => applyStatoFilter(null)}
            >
              Stato: {filtri.stato}
            </Chip>
          )}
          
          {/* Button per resettare tutti i filtri */}
          <Button 
            mode="text" 
            onPress={resetFiltri}
            style={styles.resetButton}
            icon="filter-remove"
          >
            Resetta tutto
          </Button>
        </View>
      )}

      {/* Lista dei lotti */}
      {loading && lotti.length === 0 ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Caricamento lotti disponibili...</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <Button 
            mode="contained" 
            onPress={() => loadLottiDisponibili(true)}
            style={styles.retryButton}
          >
            Riprova
          </Button>
        </View>
      ) : lotti.length === 0 ? (
        <View style={styles.centeredContainer}>
          <Ionicons name="basket-outline" size={48} color="#9E9E9E" />
          <Text style={styles.emptyText}>Nessun lotto disponibile</Text>
          <Text style={styles.emptySubtext}>
            Non ci sono lotti disponibili per la prenotazione al momento.
          </Text>
          <Button 
            mode="contained" 
            onPress={() => loadLottiDisponibili(true)}
            style={styles.retryButton}
          >
            Aggiorna
          </Button>
        </View>
      ) : (
        <FlatList
          data={lotti}
          renderItem={renderLottoItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY_COLOR]}
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {error || (loading ? 'Caricamento in corso...' : 'Nessun lotto disponibile')}
              </Text>
              {!loading && !error && (
                <Button 
                  mode="outlined" 
                  onPress={onRefresh}
                  style={styles.retryButton}
                >
                  Riprova
                </Button>
              )}
            </View>
          )}
          ListHeaderComponent={renderInfoMessage}
        />
      )}
      
      {/* Modale di prenotazione */}
      {renderDialog()}
      
      {/* Modale dei filtri */}
      {renderFiltriModal()}
      
      {/* Modal per il DatePicker */}
      {renderDatePickerModal()}
      
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    elevation: 2,
  },
  searchbar: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#f0f0f0',
  },
  searchButton: {
    margin: 0,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 4,
    marginRight: 8,
  },
  filterButton: {
    margin: 0,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  activeFiltersText: {
    marginRight: 8,
    fontSize: 12,
  },
  filterChip: {
    margin: 4,
  },
  resetButton: {
    marginLeft: 'auto',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
  },
  listContent: {
    padding: 8,
  },
  lottoCard: {
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statoBadge: {
    alignSelf: 'flex-start',
  },
  descrizione: {
    marginBottom: 8,
    color: '#555',
  },
  dettagliContainer: {
    marginVertical: 8,
  },
  dettaglioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dettaglioText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  cardActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  actionButton: {
    flex: 1,
    marginRight: 8,
  },
  prenotaButton: {
    flex: 1,
    backgroundColor: PRIMARY_COLOR,
  },
  prenotazioneModal: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  lottoInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  lottoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginTop: 8,
  },
  noteInput: {
    backgroundColor: 'transparent',
  },
  paymentSection: {
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  paymentSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  paymentOptionContent: {
    marginLeft: 8,
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  paymentOptionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  prenotazioneDialog: {
    backgroundColor: 'white',
    borderRadius: 8,
    margin: 20,
    padding: 0,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 500 : '90%',
    maxHeight: Platform.OS === 'ios' || Platform.OS === 'android' ? '80%' : 'auto',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 16,
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
    maxHeight: Platform.OS === 'ios' || Platform.OS === 'android' ? '60%' : 400,
  },
  dialogContent: {
    padding: 16,
  },
  dialogBottomBar: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  dialogCancelButton: {
    flex: 1,
    marginRight: 10,
    borderColor: '#aaa',
    borderWidth: 1,
    backgroundColor: '#f5f5f5',
    height: 50,
  },
  dialogConfirmButton: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: PRIMARY_COLOR,
    height: 50,
  },
  dialogButtonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Platform.OS === 'ios' ? (PRIMARY_COLOR) : undefined,
  },
  dialogButtonContent: {
    height: 50,
    paddingVertical: 8,
  },
  dialogText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
  },
  dialogProdotto: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY_COLOR,
  },
  dateButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  nativeCalendarButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  dateButtonSelected: {
    borderColor: PRIMARY_COLOR,
    borderWidth: 2,
  },
  selectedDateText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
  },
  activeFilterButton: {
    backgroundColor: 'rgba(0, 152, 74, 0.1)',
  },
  filtriDialog: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingBottom: 8,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  colorFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  colorFilterChip: {
    margin: 4,
    minWidth: 80,
    justifyContent: 'center',
  },
  greenChip: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  orangeChip: {
    backgroundColor: 'rgba(255, 160, 0, 0.2)',
    borderColor: '#FFA000',
    borderWidth: 1,
  },
  redChip: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderColor: '#F44336',
    borderWidth: 1,
  },
  infoContainer: {
    backgroundColor: '#e3f2fd',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3', // Colore blu info
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webDatePicker: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginTop: 8,
  },
  modalContainer: {
    padding: 16,
    margin: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filtriContent: {
    padding: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  chip: {
    margin: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipSelected: {
    borderWidth: 1,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    width: '48%',
  },
  dateInputLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  buttonContainer: {
    marginTop: 16,
  },
  applyButton: {
    paddingVertical: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    marginTop: 8,
  },
  dateButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 8,
  },
}); 
