import React, { useState, useEffect, useCallback, useContext } from 'react';
import { ThemeContext } from '../../src/context/ThemeContext';
import { useTheme, Text, Button, Card, Title, Paragraph, Badge, Chip, ActivityIndicator, Portal, Dialog, TextInput, Divider } from 'react-native-paper';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  getPrenotazioni, 
  annullaPrenotazione, 
  accettaPrenotazione,
  rifiutaPrenotazione,
  eliminaPrenotazione,
  Prenotazione,
  invalidateCache
} from '../../src/services/prenotazioniService';
import { RUOLI, BONIFICO_IBAN_LABEL } from '../../src/config/constants';
import { useAuth } from '../../src/context/AuthContext';
import Toast from 'react-native-toast-message';
import { useResponsiveContentWidth } from '../../src/hooks/useResponsiveContentWidth';
import cardActionStyles from '../../src/styles/cardActionButtons';

interface Filtri {
  stato?: string;
  data_inizio?: string;
  data_fine?: string;
  centro_id?: number;
  stato_multiple?: string[];
}

export default function PrenotazioniScreen() {
  const themeContext = useContext(ThemeContext);
  const paperTheme = useTheme();
  const isDark = paperTheme.dark || (!!themeContext && themeContext.isDarkMode);
  // Colori dinamici con tonalità  simili alla HomeScreen/statistiche
  const filtersContentWidth = useResponsiveContentWidth();
  const isFiltersCompact = filtersContentWidth < 680;
  const isFiltersMultiRow = filtersContentWidth < 420;

  const router = useRouter();
  const colors = {
    background: isDark ? '#121212' : '#f5f5f5',
    card: isDark ? '#1e1e1e' : '#fff',
    text: isDark ? '#fff' : '#000',
    subText: isDark ? '#B0B0B0' : '#555',
    divider: isDark ? '#333C4A' : '#E0E0E0',
    badgeText: isDark ? '#181A20' : '#fff',
    statoLabel: isDark ? '#FFD600' : '#555',
    icon: isDark ? '#B0B0B0' : '#555',
    chip: isDark ? '#3A3A3A' : '#E0E0E0',
    chipSelected: paperTheme.colors.primary,
    chipText: isDark ? '#FFFFFF' : '#333333',
    chipTextSelected: '#FFFFFF',
    fab: isDark ? '#4CAF50' : '#4CAF50',
    dialogBg: isDark ? '#23262F' : '#fff',
    dialogText: isDark ? '#fff' : '#000',
    dialogSubText: isDark ? '#B0B0B0' : '#666',
    dialogWarning: isDark ? '#FF8A65' : '#F44336',
    inputBg: isDark ? '#23262F' : '#fff',
    inputText: isDark ? '#fff' : '#000',
    buttonLabel: isDark ? '#fff' : '#000',
    annullaButton: isDark ? '#F44336' : '#F44336',
    accettaButton: isDark ? '#388E3C' : '#4CAF50',
    rifiutaButton: isDark ? '#F44336' : '#F44336',
    eliminaButton: isDark ? '#F44336' : '#F44336',
    deleteDialogButton: isDark ? '#F44336' : '#F44336',
    retryButton: isDark ? '#4CAF50' : '#4CAF50',
    exploreButton: isDark ? '#4CAF50' : '#4CAF50',
    resetFilterLink: isDark ? '#4CAF50' : '#4CAF50',
    dettagliButton: isDark ? '#388E3C' : '#4CAF50', // Verde identico ad "Accetta"
    actionButtonText: '#FFFFFF',
  };
  const { user, refreshToken } = useAuth();
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtri, setFiltri] = useState<Filtri>({});
  
  // Stati per l'annullamento
  const [prenotazioneSelezionata, setPrenotazioneSelezionata] = useState<Prenotazione | null>(null);
  const [annullamentoModalVisible, setAnnullamentoModalVisible] = useState(false);
  const [motivoAnnullamento, setMotivoAnnullamento] = useState('');
  const [annullamentoInCorso, setAnnullamentoInCorso] = useState(false);
  
  // Stati per l'accettazione e il rifiuto
  const [accettazioneModalVisible, setAccettazioneModalVisible] = useState(false);
  const [dataRitiroPrevista, setDataRitiroPrevista] = useState<Date | null>(null);
  const [accettazioneInCorso, setAccettazioneInCorso] = useState(false);
  
  const [rifiutoModalVisible, setRifiutoModalVisible] = useState(false);
  const [motivoRifiuto, setMotivoRifiuto] = useState('');
  const [rifiutoInCorso, setRifiutoInCorso] = useState(false);
  
  const [eliminazioneModalVisible, setEliminazioneModalVisible] = useState(false);
  const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false);
  const [defaultFilterApplied, setDefaultFilterApplied] = useState(false);

  // Funzione per gestire gli errori di autenticazione
  

const handleAuthError = useCallback(async (): Promise<boolean> => {

  try {

    console.log("Tentativo di aggiornare l'autenticazione...");



    if (refreshToken) {

      console.log('Tentativo di refresh del token...');

      const refreshSuccess = await refreshToken();



      if (refreshSuccess) {

        Toast.show({

          type: 'info',

          text1: 'Autenticazione aggiornata',

          text2: "Riprova l'operazione",

          visibilityTime: 3000,

        });

        return true;

      }

    }



    Toast.show({

      type: 'error',

      text1: 'Errore di autenticazione',

      text2: 'Accedi nuovamente per continuare',

      visibilityTime: 4000,

    });

    router.push('/login');

    return false;

  } catch (err) {

    console.error("Errore nell'aggiornamento dell'autenticazione:", err);

    Toast.show({

      type: 'error',

      text1: 'Errore di autenticazione',

      text2: 'Accedi nuovamente per continuare',

    });

    router.push('/login');

    return false;

  }

}, [refreshToken, router]);





  // Modifica la funzione loadPrenotazioni per gestire errori di autenticazione
  const loadPrenotazioni = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const result = await getPrenotazioni(filtri, forceRefresh);

      // Filtro lato frontend per nascondere ritirati/eliminati
      const filtrate = (result.prenotazioni || []).filter((p: Prenotazione) => {
        const stato = p.stato?.toLowerCase();
        return stato !== 'ritirato' && stato !== 'eliminato' && stato !== 'completata' && stato !== 'consegnato';
      });

      setPrenotazioni(filtrate);
    } catch (error: any) {
      console.error('Errore nel caricamento delle prenotazioni:', error);
      
      // Verifica se è un errore di autorizzazione
      if (error.message?.includes('token') || error.message?.includes('Unauthorized') ||
          error?.response?.status === 401 || error?.response?.status === 403) {
        const refreshed = await handleAuthError();
        if (refreshed) {
          return loadPrenotazioni(true);
        }
      } else {
        setError('Impossibile caricare le prenotazioni');
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: 'Si è verificato un errore durante il caricamento delle prenotazioni',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtri, handleAuthError]);

  // Effetto per caricare le prenotazioni al montaggio del componente
  useEffect(() => {
    loadPrenotazioni();
  }, [filtri, loadPrenotazioni]);
  
  // Effetto per ricaricare le prenotazioni quando i filtri cambiano
  useEffect(() => {
    if (Object.keys(filtri).length > 0) {
      // Quando cambiano i filtri, svuota prima l'elenco delle prenotazioni
      // per evitare di mostrare dati vecchi mentre si caricano quelli nuovi
      setPrenotazioni([]);
      setLoading(true);
      
      // Invalida la cache prima di ricaricare i dati
      invalidateCache();
      
      // Ricarica le prenotazioni con i nuovi filtri
      loadPrenotazioni(true);
    }
  }, [filtri, loadPrenotazioni]);
  
  // Effetto per ricaricare le prenotazioni quando la schermata ottiene il focus
  useFocusEffect(
    useCallback(() => {
      // Forza sempre il ricaricamento quando si torna su questa schermata
      setPrenotazioni([]); // Svuota subito la lista per evitare "ghost"
      loadPrenotazioni(true);
      // Pulizia opzionale
      return () => {};
    }, [loadPrenotazioni])
  );

  // Rimuovi eventuali prenotazioni "fantasma" dopo ritiro/lotto eliminato
  // (Non pià¹ necessario: la lista viene svuotata e ricaricata a ogni focus)
  
  // Funzione per gestire il pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadPrenotazioni(true);
  };
  
  // Funzione per cercare
  
  // Funzione per resettare i filtri
  const resetFiltri = () => {
    setFiltri({});
    console.log('Filtri resettati, ricarico tutte le prenotazioni');
    // Prima di ricaricare i dati, invalidare la cache
    invalidateCache();
    setLoading(true);
    loadPrenotazioni(true);
  };
  
  // Funzione per applicare i filtri per stato
  const applyStatusFilter = (stato: string) => {
    // Se stiamo cliccando sullo stesso filtro già  attivo, non fare nulla
    if (filtri.stato === stato) {
      console.log(`Filtro ${stato} già  attivo, ricarico comunque i dati`);
      // Forziamo comunque un refresh dei dati
      setLoading(true);
      invalidateCache();
      loadPrenotazioni(true);
      return;
    }
    
    console.log(`Applicazione filtro stato: ${stato}`);
    // Mostra lo stato di caricamento prima di cambiare il filtro
    setLoading(true);
    
    // Invalida la cache prima di cambiare filtro
    invalidateCache();
    
    // Imposta il nuovo filtro
    setFiltri({ stato });
  };
  
  // Funzione per navigare ai dettagli della prenotazione
  const navigateToPrenotazioneDetail = (prenotazione: Prenotazione) => {
    // Naviga ai dettagli
    // @ts-ignore - Il formato è corretto ma TypeScript non lo riconosce
    router.push(`/prenotazioni/dettaglio/${prenotazione.id}`);
    // Niente listener custom: il refresh è già  gestito da useFocusEffect
  };
  
  // Funzione per navigare alla schermata dei lotti disponibili
  const navigateToLottiDisponibili = () => {
    router.push('/lotti/disponibili');
  };
  
  // Funzione per formattare la data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data non disponibile';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.warn('Data non valida:', dateString);
        return 'Data non valida';
      }
      return format(date, 'dd/MM/yyyy', { locale: it });
    } catch (err) {
      console.error('Errore nella formattazione della data:', err);
      return dateString;
    }
  };
  
  // Funzione per ottenere il colore dello stato
  const getStatoColor = (stato: string) => {
    const statoLower = stato.toLowerCase();
    if (statoLower === 'richiesta' || statoLower === 'prenotato' || statoLower === 'inattesa') {
      return '#FFA000'; // arancione
    } else if (statoLower === 'confermata' || statoLower === 'confermato') {
      return '#4CAF50'; // verde
    } else if (statoLower === 'prontoperritiro') {
      return '#2196F3'; // blu - stesso colore che usavamo per intransito
    } else if (statoLower === 'completata' || statoLower === 'consegnato') {
      return '#673AB7'; // viola
    } else if (statoLower === 'annullata' || statoLower === 'annullato') {
      return '#F44336'; // rosso
    } else if (statoLower === 'rifiutato') {
      return '#F44336'; // rosso (stesso del annullato per coerenza visiva)
    } else if (statoLower === 'eliminato') {
      return '#9E9E9E'; // grigio
    } else {
      return '#9E9E9E'; // grigio default
    }
  };
  
  // Funzione per mostrare il modale di annullamento
  const handleAnnullamento = (prenotazione: Prenotazione) => {
    setPrenotazioneSelezionata(prenotazione);
    setMotivoAnnullamento('');
    setAnnullamentoModalVisible(true);
  };
  
  // Funzione per confermare l'annullamento
  const confermaAnnullamento = async () => {
    if (!prenotazioneSelezionata) return;
    
    try {
      setAnnullamentoInCorso(true);
      const result = await annullaPrenotazione(prenotazioneSelezionata.id, motivoAnnullamento);
      
      if (result.success) {
        setAnnullamentoModalVisible(false);
        setPrenotazioneSelezionata(null);
        setMotivoAnnullamento('');
        
        Toast.show({
          type: 'success',
          text1: 'Prenotazione annullata',
          text2: 'La prenotazione è stata annullata con successo'
        });
        
        await loadPrenotazioni(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: result.message || 'Impossibile annullare la prenotazione'
        });
      }
    } catch (error: any) {
      console.error('Errore durante l\'annullamento della prenotazione:', error);
      
      // Verifica se è un errore di autorizzazione
      if (error.message?.includes('token') || error.message?.includes('Unauthorized') || 
          error?.response?.status === 401 || error?.response?.status === 403) {
        const refreshed = await handleAuthError();
        if (refreshed) {
          return loadPrenotazioni(true);
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: 'Si è verificato un errore durante l\'annullamento'
        });
      }
    } finally {
      setAnnullamentoInCorso(false);
    }
  };
  
  // Funzione per ottenere il messaggio relativo allo stato
  const getStatoLabel = (stato: string) => {
    const statoLower = stato.toLowerCase();
    if (statoLower === 'richiesta' || statoLower === 'prenotato' || statoLower === 'inattesa') {
      return 'In attesa di conferma';
    } else if (statoLower === 'confermata' || statoLower === 'confermato') {
      return 'Prenotazione confermata';
    } else if (statoLower === 'prontoperritiro') {
      return 'Pronta per essere ritirata';
    } else if (statoLower === 'completata' || statoLower === 'consegnato') {
      return 'Consegna completata';
    } else if (statoLower === 'annullata' || statoLower === 'annullato') {
      return 'Prenotazione annullata';
    } else if (statoLower === 'rifiutato') {
      return 'Prenotazione rifiutata';
   } else if (statoLower === 'ritirato') {
  return 'Ritiro effettuato';
} else if (statoLower === 'eliminato') {
  return 'Prenotazione eliminata';
    } else {
      return stato;
    }
  };
  
  // Funzione helper per verificare lo stato in modo sicuro
  const isStato = (stato: string, valori: string[]): boolean => {
    const statoLower = stato.toLowerCase();
    return valori.some(v => {
      const vLower = v.toLowerCase();
      // Gestisci gli stati equivalenti
      if ((statoLower === 'prenotato' && vLower === 'richiesta') || 
          (statoLower === 'richiesta' && vLower === 'prenotato') ||
          (statoLower === 'inattesa' && vLower === 'richiesta') ||
          (statoLower === 'richiesta' && vLower === 'inattesa') ||
          (statoLower === 'prenotato' && vLower === 'inattesa') ||
          (statoLower === 'inattesa' && vLower === 'prenotato') ||
          (statoLower === 'confermato' && vLower === 'confermata') ||
          (statoLower === 'confermata' && vLower === 'confermato') ||
          (statoLower === 'prontoperritiro' && vLower === 'confermata') ||
          (statoLower === 'confermata' && vLower === 'prontoperritiro') ||
          (statoLower === 'consegnato' && vLower === 'completata') ||
          (statoLower === 'completata' && vLower === 'consegnato') ||
          (statoLower === 'annullato' && vLower === 'annullata') ||
          (statoLower === 'annullata' && vLower === 'annullato') ||
          (statoLower === 'eliminato' && vLower === 'eliminata') ||
          (statoLower === 'eliminata' && vLower === 'eliminato') ||
          (statoLower === 'rifiutato' && vLower === 'rifiutata') ||
          (statoLower === 'rifiutata' && vLower === 'rifiutato')) {
        return true;
      }
      return statoLower === vLower;
    });
  };
  
  // Funzione per renderizzare un item della lista
  const renderPrenotazioneItem = ({ item }: { item: Prenotazione }) => {
    const statoColor = getStatoColor(item.stato);
    
    // Utilizziamo i campi presenti direttamente nell'oggetto item, non dentro lotto
    // poichà© l'API restituisce i dati del lotto già  "appiattiti" nella prenotazione
    
    const ruolo = user?.ruolo;
    const isOperatoreOrAdmin = ruolo === RUOLI.OPERATORE || ruolo === RUOLI.AMMINISTRATORE;
    const canEliminare = ruolo === RUOLI.AMMINISTRATORE && isStato(item.stato, ['Richiesta', 'Confermata', 'Prenotato', 'InAttesa', 'Confermato', 'InTransito']);
    return (
      <Card
        style={[
          styles.prenotazioneCard,
          {
            borderLeftColor: statoColor,
            backgroundColor: colors.card,
          },
        ]}
        onPress={() => navigateToPrenotazioneDetail(item)}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Title numberOfLines={1} style={[styles.cardTitle, { color: colors.text }]}>{item.prodotto || 'Lotto non disponibile'}</Title>
              <Badge
                style={[styles.statoBadge, { backgroundColor: statoColor, color: colors.badgeText }]}
              >
                {item.stato.toLowerCase() === 'prenotato' ? 'In attesa' : item.stato}
              </Badge>
            </View>
          </View>

          <Paragraph style={[styles.statoLabel, { color: colors.statoLabel }]}>
            {getStatoLabel(item.stato)}
          </Paragraph>

          <Divider style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.dettagliContainer}>
            <View style={styles.dettaglioItem}>
              <Ionicons name="cube-outline" size={16} color={colors.icon} />
              <Text style={[styles.dettaglioText, { color: colors.text }]}>
                {item.quantita || '?'} {item.unita_misura || 'pz'}
              </Text>
            </View>

            <View style={styles.dettaglioItem}>
              <Ionicons name="home-outline" size={16} color={colors.icon} />
              <Text style={[styles.dettaglioText, { color: colors.text }]} numberOfLines={1}>
                <Text style={{ color: colors.subText }}>Da:</Text> {item.centro_origine_nome || 'Centro origine sconosciuto'}
              </Text>
            </View>

            <View style={styles.dettaglioItem}>
              <Ionicons name="location-outline" size={16} color={colors.icon} />
              <Text style={[styles.dettaglioText, { color: colors.text }]} numberOfLines={1}>
                <Text style={{ color: colors.subText }}>A:</Text> {item.centro_ricevente_nome || 'Centro destinazione sconosciuto'}
              </Text>
            </View>

            <View style={styles.dettaglioItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.icon} />
              <Text style={[styles.dettaglioText, { color: colors.text }]}>
                <Text style={{ color: colors.subText }}>Prenotato il:</Text> {formatDate(item.data_prenotazione)}
              </Text>
            </View>

            {item.data_ritiro && (
              <View style={styles.dettaglioItem}>
                <Ionicons name="time-outline" size={16} color={colors.icon} />
                <Text style={[styles.dettaglioText, { color: colors.text }]}>
                  <Text style={{ color: colors.subText }}>Ritiro previsto:</Text> {formatDate(item.data_ritiro)}
                </Text>
              </View>
            )}

            {(item.prezzo !== undefined && item.prezzo !== null || item.lotto?.prezzo !== undefined && item.lotto?.prezzo !== null) && (
              <View style={styles.dettaglioItem}>
                <Ionicons name="pricetag-outline" size={16} color={colors.icon} />
                <Text style={[styles.dettaglioText, { color: colors.text }]}>
                  <Text style={{ color: colors.subText }}>Prezzo:</Text> {parseFloat(String(item.prezzo ?? item.lotto?.prezzo ?? 0)).toFixed(2)} â‚¬
                </Text>
              </View>
            )}

            {(item.tipo_pagamento || item.lotto?.tipo_pagamento) && (
              <View style={styles.dettaglioItem}>
                <Ionicons name="card-outline" size={16} color={colors.icon} />
                <Text style={[styles.dettaglioText, { color: colors.text }]}>
                  <Text style={{ color: colors.subText }}>Pagamento:</Text> {(item.tipo_pagamento ?? item.lotto?.tipo_pagamento) === 'contanti' ? 'Contanti' : BONIFICO_IBAN_LABEL}
                </Text>
              </View>
            )}
          </View>
        </Card.Content>

        <Card.Actions style={styles.cardActions}>
          <View style={cardActionStyles.wrapper}>
            <Button
              mode="contained"
              onPress={() => navigateToPrenotazioneDetail(item)}
              style={[cardActionStyles.button, { backgroundColor: colors.dettagliButton }]}
              labelStyle={[cardActionStyles.label, { color: colors.actionButtonText }]}
              contentStyle={cardActionStyles.content}
              uppercase={false}
            >
              Dettagli
            </Button>

            {(user?.ruolo === RUOLI.CENTRO_SOCIALE || user?.ruolo === RUOLI.CENTRO_RICICLAGGIO) &&
              isStato(item.stato, ['Richiesta']) && (
                <Button
                  mode="contained"
                  onPress={() => handleAnnullamento(item)}
                  style={[cardActionStyles.button, { backgroundColor: colors.annullaButton }]}
                  icon="close-circle-outline"
                  labelStyle={[cardActionStyles.label, { color: colors.actionButtonText }]}
                  contentStyle={cardActionStyles.content}
                  uppercase={false}
                >
                  Annulla
                </Button>
              )}

            {isOperatoreOrAdmin && isStato(item.stato, ['Richiesta']) && (
              <>
                <Button
                  mode="contained"
                  onPress={() => handleAccettaPrenotazione(item)}
                  style={[cardActionStyles.button, { backgroundColor: colors.accettaButton }]}
                  icon="check-circle-outline"
                  labelStyle={[cardActionStyles.label, { color: colors.actionButtonText }]}
                  contentStyle={cardActionStyles.content}
                  uppercase={false}
                >
                  Accetta
                </Button>
                <Button
                  mode="contained"
                  onPress={() => handleRifiutaPrenotazione(item)}
                  style={[cardActionStyles.button, { backgroundColor: colors.rifiutaButton }]}
                  icon="close-circle-outline"
                  labelStyle={[cardActionStyles.label, { color: colors.actionButtonText }]}
                  contentStyle={cardActionStyles.content}
                  uppercase={false}
                >
                  Rifiuta
                </Button>
              </>
            )}

            {canEliminare && (
              <Button
                mode="contained"
                onPress={() => handleEliminaPrenotazione(item)}
                style={[cardActionStyles.button, { backgroundColor: colors.eliminaButton }]}
                icon="delete-outline"
                labelStyle={[cardActionStyles.label, { color: colors.actionButtonText }]}
                contentStyle={cardActionStyles.content}
                uppercase={false}
              >
                Elimina
              </Button>
            )}
          </View>
        </Card.Actions>
      </Card>
    );
  };

  // Aggiungiamo le funzioni per gestire l'accettazione, il rifiuto e l'eliminazione
  const handleAccettaPrenotazione = (prenotazione: Prenotazione) => {
    setPrenotazioneSelezionata(prenotazione);
    // Imposta la data di domani come default per il ritiro
    setDataRitiroPrevista(addDays(new Date(), 1));
    setAccettazioneModalVisible(true);
  };

  const handleRifiutaPrenotazione = (prenotazione: Prenotazione) => {
    setPrenotazioneSelezionata(prenotazione);
    setMotivoRifiuto('');
    setRifiutoModalVisible(true);
  };

  const handleEliminaPrenotazione = (prenotazione: Prenotazione) => {
    setPrenotazioneSelezionata(prenotazione);
    setEliminazioneModalVisible(true);
  };

  // Funzione per confermare l'accettazione
  const confermaAccettazione = async () => {
    if (!prenotazioneSelezionata || !dataRitiroPrevista) return;
    
    try {
      setAccettazioneInCorso(true);
      
      // Formatta la data nel formato YYYY-MM-DD
      const dataRitiroFormatted = format(dataRitiroPrevista, 'yyyy-MM-dd');
      
      // Chiamata API per accettare la prenotazione
      const result = await accettaPrenotazione(
        prenotazioneSelezionata.id,
        dataRitiroFormatted
      );
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Prenotazione accettata',
          text2: result.message,
          visibilityTime: 4000,
        });
        
        // Chiudi il modale e ricarica le prenotazioni
        setAccettazioneModalVisible(false);
        loadPrenotazioni(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: result.message,
          visibilityTime: 4000,
        });
      }
    } catch (err: any) {
      console.error('Errore nell\'accettazione della prenotazione:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile accettare la prenotazione',
        visibilityTime: 4000,
      });
    } finally {
      setAccettazioneInCorso(false);
    }
  };

  // Funzione per confermare il rifiuto
  const confermaRifiuto = async () => {
    if (!prenotazioneSelezionata) return;
    
    try {
      setRifiutoInCorso(true);
      console.log(`Invio richiesta rifiuto per prenotazione ${prenotazioneSelezionata.id} con motivo: ${motivoRifiuto}`);
      
      // Chiamata API per rifiutare la prenotazione
      const result = await rifiutaPrenotazione(
        prenotazioneSelezionata.id,
        motivoRifiuto
      );
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Prenotazione rifiutata',
          text2: result.message,
          visibilityTime: 4000,
        });
        
        // Chiudi il modale e ricarica le prenotazioni
        setRifiutoModalVisible(false);
        
        // Carica normalmente
        console.log('Ricaricamento normale dopo rifiuto');
        loadPrenotazioni(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: result.message,
          visibilityTime: 4000,
        });
      }
    } catch (err: any) {
      console.error('Errore nel rifiuto della prenotazione:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile rifiutare la prenotazione',
        visibilityTime: 4000,
      });
    } finally {
      setRifiutoInCorso(false);
    }
  };

  // Funzione per confermare l'eliminazione
  const confermaEliminazione = async () => {
    if (!prenotazioneSelezionata) return;
    
    try {
      setEliminazioneInCorso(true);
      
      // Chiamata API per eliminare la prenotazione
      const result = await eliminaPrenotazione(
        prenotazioneSelezionata.id
      );
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Prenotazione eliminata',
          text2: result.message,
          visibilityTime: 4000,
        });
        
        // Chiudi il modale e ricarica le prenotazioni
        setEliminazioneModalVisible(false);
        loadPrenotazioni(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: result.message,
          visibilityTime: 4000,
        });
      }
    } catch (err: any) {
      console.error('Errore nell\'eliminazione della prenotazione:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Impossibile eliminare la prenotazione',
        visibilityTime: 4000,
      });
    } finally {
      setEliminazioneInCorso(false);
    }
  };

  // Controllo se l'utente puà² effettuare prenotazioni
  const canBook = user && [RUOLI.CENTRO_SOCIALE, RUOLI.CENTRO_RICICLAGGIO].includes(user.ruolo);

  const renderStatusChip = ({
    label,
    value,
    onPress,
    isSelected,
  }: {
    label: string;
    value?: string;
    onPress?: () => void;
    isSelected?: boolean;
  }) => {
    const selected = isSelected ?? (value ? filtri.stato === value : !filtri.stato);
    const handlePress = onPress ?? (() => value && applyStatusFilter(value));
    const backgroundColor = selected ? colors.chipSelected : colors.chip;
    const borderColor = selected ? colors.chipSelected : colors.divider;

    return (
      <Chip
        key={label}
        compact
        mode="flat"
        selected={selected}
        onPress={handlePress}
        style={[
          styles.filterChip,
          styles.filterChipContent,
          { backgroundColor, borderColor },
          selected && styles.filterChipSelected,
        ]}
        textStyle={[
          styles.filterChipText,
          { color: selected ? colors.chipTextSelected : colors.chipText },
          selected && styles.filterChipTextSelected,
        ]}
        accessibilityLabel={`Filtra prenotazioni con stato ${label}`}
      >
        {label}
      </Chip>
    );
  };

  const statusChips = [
    renderStatusChip({ label: 'Tutte', onPress: resetFiltri, isSelected: !filtri.stato }),
    renderStatusChip({ label: 'In attesa', value: 'Prenotato' }),
    renderStatusChip({ label: 'Confermate', value: 'Confermato' }),
    renderStatusChip({ label: 'Pronte per ritiro', value: 'ProntoPerRitiro' }),
    renderStatusChip({ label: 'Consegnate', value: 'Consegnato' }),
    renderStatusChip({ label: 'Annullate', value: 'Annullato' }),
    renderStatusChip({ label: 'Rifiutate', value: 'Rifiutato' }),
  ];

  useEffect(() => {
    // Effetto che si attiva quando l'utente è operatore o amministratore
    // per impostare automaticamente il filtro su "Richiesta" solo al primo accesso
    if (
      user &&
      (user.ruolo === RUOLI.OPERATORE || user.ruolo === RUOLI.AMMINISTRATORE) &&
      !defaultFilterApplied &&
      !Object.keys(filtri).length &&
      prenotazioni.length === 0
    ) {
      console.log('Imposto filtro iniziale su "Prenotato" per operatore/admin');
      setDefaultFilterApplied(true);
      setFiltri({ stato: 'Prenotato' });
    }
  }, [user, prenotazioni.length, filtri, defaultFilterApplied]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      {/* Header con filtri */}
      <View style={[styles.headerContainer, { backgroundColor: colors.background }] }>
        <View
          style={[
            styles.filtersWrapper,
            { width: filtersContentWidth },
          ]}
        >
        <View
          style={[
            styles.filterBar,
            { backgroundColor: colors.card, borderColor: colors.divider },
          ]}
        >
          <Text style={[styles.filterLabel, { color: colors.text }]}>Stato:</Text>
          {isFiltersCompact ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterChipsScroll}
              contentContainerStyle={styles.filterScrollContent}
            >
              {statusChips}
            </ScrollView>
          ) : (
            <View
              style={[
                styles.filterChipsContainer,
                (!isFiltersCompact || isFiltersMultiRow) && styles.filterChipsWrap,
              ]}
            >
              {statusChips}
            </View>
          )}
        </View>
        </View>
      </View>

      {/* Contenuto principale */}
      <View style={[styles.contentContainer, { backgroundColor: colors.background }] }>
        {loading ? (
          <View style={[styles.centeredContainer, { backgroundColor: colors.background }] }>
            <ActivityIndicator size="large" color={colors.accettaButton} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Caricamento prenotazioni...</Text>
          </View>
        ) : error ? (
          <View style={[styles.centeredContainer, { backgroundColor: colors.background }] }>
            <Ionicons name="alert-circle-outline" size={48} color={colors.dialogWarning} />
            <Text style={[styles.errorText, { color: colors.dialogWarning }]}>{error}</Text>
            <Button
              mode="contained"
              onPress={() => loadPrenotazioni(true)}
              style={[styles.retryButton, { backgroundColor: colors.retryButton }]}
              labelStyle={{ color: colors.badgeText }}
            >
              Riprova
            </Button>
          </View>
        ) : prenotazioni.length === 0 ? (
          <View style={[styles.centeredContainer, { backgroundColor: colors.background }] }>
            <Ionicons name="cart-outline" size={48} color={isDark ? '#555' : '#9E9E9E'} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Nessuna prenotazione trovata</Text>
            <Text style={[styles.emptySubtext, { color: colors.subText }] }>
              Non ci sono prenotazioni da visualizzare{filtri.stato ? ` con stato "${filtri.stato}"` : ''}.
              {filtri.stato && (
                <Text>
                  {'\n'}
                  <Text
                    style={[styles.resetFilterLink, { color: colors.resetFilterLink }]}
                    onPress={resetFiltri}
                  >
                    Rimuovi filtro
                  </Text>
                </Text>
              )}
            </Text>
            {canBook && (
              <Button
                mode="contained"
                onPress={navigateToLottiDisponibili}
                style={[styles.exploreButton, { backgroundColor: colors.exploreButton }]}
                icon="search"
                labelStyle={{ color: colors.badgeText }}
              >
                Esplora lotti disponibili
              </Button>
            )}
          </View>
        ) : (
          <FlatList
            data={prenotazioni.filter(p => {
            const stato = p.stato?.toLowerCase();
            return stato !== 'ritirato' && stato !== 'eliminato' && stato !== 'consegnato' && stato !== 'completata';
            })}
            renderItem={renderPrenotazioneItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            numColumns={1}
            showsVerticalScrollIndicator={false}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={true}
            nestedScrollEnabled
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#4CAF50"]}
              />
            }
          />
        )}
      </View>
      
      {/* Pulsante per esplorare lotti disponibili (solo per centri) */}
      {canBook && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.fab }]}
          onPress={navigateToLottiDisponibili}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
      
      {/* Modale di annullamento */}
      <Portal>
        <Dialog
          visible={annullamentoModalVisible}
          onDismiss={() => setAnnullamentoModalVisible(false)}
          style={[styles.annullamentoModal, { backgroundColor: colors.dialogBg }]}
        >
          <Dialog.Title style={{ color: colors.dialogText }}>Annulla prenotazione</Dialog.Title>

          <Dialog.Content>
            {prenotazioneSelezionata && (
              <>
                <Paragraph style={{ color: colors.dialogText }}>
                  Sei sicuro di voler annullare la prenotazione per il lotto "{prenotazioneSelezionata.lotto?.nome || 'sconosciuto'}"?
                </Paragraph>

                <TextInput
                  label="Motivo dell'annullamento (opzionale)"
                  value={motivoAnnullamento}
                  onChangeText={setMotivoAnnullamento}
                  multiline
                  numberOfLines={3}
                  style={[styles.motivoInput, { backgroundColor: colors.inputBg, color: colors.inputText }]}
                  theme={{ colors: { text: colors.inputText, placeholder: colors.subText, background: colors.inputBg } }}
                  placeholderTextColor={colors.subText}
                />
              </>
            )}
          </Dialog.Content>

          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => setAnnullamentoModalVisible(false)}
              disabled={annullamentoInCorso}
              style={styles.dialogCancelButton}
              labelStyle={[styles.dialogButtonLabel, { color: colors.buttonLabel }]}
            >
              Annulla
            </Button>
            <Button
              mode="contained"
              onPress={confermaAnnullamento}
              loading={annullamentoInCorso}
              disabled={annullamentoInCorso}
              style={[styles.dialogConfirmButton, { backgroundColor: colors.annullaButton }]}
              labelStyle={[styles.dialogButtonLabel, { color: colors.badgeText }]}
            >
              Conferma
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Modale di accettazione */}
      <Portal>
        <Dialog
          visible={accettazioneModalVisible}
          onDismiss={() => !accettazioneInCorso && setAccettazioneModalVisible(false)}
          dismissable={!accettazioneInCorso}
          style={{ backgroundColor: colors.dialogBg }}
        >
          <Dialog.Title style={{ color: colors.dialogText }}>Conferma accettazione</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogText, { color: colors.dialogText }] }>
              Stai per accettare la prenotazione del lotto{' '}
              <Text style={styles.boldText}>
                {prenotazioneSelezionata?.lotto?.nome}
              </Text>.
            </Text>

            <Text style={[styles.dialogLabel, { color: colors.dialogText }]}>Data di ritiro prevista:</Text>
            <TouchableOpacity
              onPress={() => {
                // Qui in futuro potremmo aprire un date picker
              }}
              style={[styles.dateInputContainer, { backgroundColor: colors.inputBg }]}
            >
              <Text style={[styles.dateInputText, { color: colors.inputText }] }>
                {dataRitiroPrevista ? format(dataRitiroPrevista, 'dd/MM/yyyy', { locale: it }) : 'Seleziona data'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={colors.icon} />
            </TouchableOpacity>

            <Text style={[styles.dialogSubText, { color: colors.dialogSubText }] }>
              Accettando la prenotazione, il centro che ha fatto la richiesta riceverà  una notifica.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => !accettazioneInCorso && setAccettazioneModalVisible(false)}
              disabled={accettazioneInCorso}
              style={[styles.dialogCancelButton, { backgroundColor: colors.annullaButton }]}
              labelStyle={[styles.dialogButtonLabel, { color: isDark ? '#000' : '#fff' }]}
            >
              Annulla
            </Button>
            <Button
              mode="contained"
              onPress={confermaAccettazione}
              loading={accettazioneInCorso}
              disabled={accettazioneInCorso || !dataRitiroPrevista}
              style={[styles.dialogConfirmButton, { backgroundColor: colors.accettaButton }]}
              labelStyle={[styles.dialogButtonLabel, { color: colors.badgeText }]}
            >
              Conferma
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Modale di rifiuto */}
      <Portal>
        <Dialog
          visible={rifiutoModalVisible}
          onDismiss={() => !rifiutoInCorso && setRifiutoModalVisible(false)}
          dismissable={!rifiutoInCorso}
          style={{ backgroundColor: colors.dialogBg }}
        >
          <Dialog.Title style={{ color: colors.dialogText }}>Conferma rifiuto</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogText, { color: colors.dialogText }] }>
              Stai per rifiutare la prenotazione del lotto{' '}
              <Text style={styles.boldText}>
                {prenotazioneSelezionata?.lotto?.nome}
              </Text>.
            </Text>

            <Text style={[styles.dialogLabel, { color: colors.dialogText }]}>Motivo del rifiuto (opzionale):</Text>
            <TextInput
              value={motivoRifiuto}
              onChangeText={setMotivoRifiuto}
              placeholder="Inserisci il motivo del rifiuto"
              multiline
              style={[styles.dialogInput, { backgroundColor: colors.inputBg, color: colors.inputText }]}
              theme={{ colors: { text: colors.inputText, placeholder: colors.subText, background: colors.inputBg } }}
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.dialogSubText, { color: colors.dialogSubText }] }>
              Rifiutando la prenotazione, il centro che ha fatto la richiesta riceverà  una notifica.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => !rifiutoInCorso && setRifiutoModalVisible(false)}
              disabled={rifiutoInCorso}
              labelStyle={[styles.dialogButtonLabel, { color: colors.buttonLabel }]}
            >
              Annulla
            </Button>
            <Button
              mode="contained"
              onPress={confermaRifiuto}
              loading={rifiutoInCorso}
              disabled={rifiutoInCorso}
              style={{ backgroundColor: colors.rifiutaButton }}
              labelStyle={[styles.dialogButtonLabel, { color: colors.badgeText }]}
            >
              Conferma
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Modale di eliminazione */}
      <Portal>
        <Dialog
          visible={eliminazioneModalVisible}
          onDismiss={() => !eliminazioneInCorso && setEliminazioneModalVisible(false)}
          dismissable={!eliminazioneInCorso}
          style={{ backgroundColor: colors.dialogBg }}
        >
          <Dialog.Title style={{ color: colors.dialogText }}>Conferma eliminazione</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogText, { color: colors.dialogText }] }>
              Stai per eliminare definitivamente la prenotazione del lotto{' '}
              <Text style={styles.boldText}>
                {prenotazioneSelezionata?.lotto?.nome}
              </Text>.
            </Text>

            <Text style={[styles.dialogWarningText, { color: colors.dialogWarning }] }>
              Questa operazione non puà² essere annullata.
            </Text>

            <Text style={[styles.dialogSubText, { color: colors.dialogSubText }] }>
              I centri associati a questa prenotazione riceveranno una notifica dell'eliminazione.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => !eliminazioneInCorso && setEliminazioneModalVisible(false)}
              disabled={eliminazioneInCorso}
              labelStyle={[styles.dialogButtonLabel, { color: colors.buttonLabel }]}
            >
              Annulla
            </Button>
            <Button
              mode="contained"
              onPress={confermaEliminazione}
              loading={eliminazioneInCorso}
              disabled={eliminazioneInCorso}
              style={[styles.deleteDialogButton, { backgroundColor: colors.deleteDialogButton }]}
              labelStyle={[styles.dialogButtonLabel, { color: colors.badgeText }]}
            >
              Elimina
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor gestito dinamicamente dal componente
  },
  headerContainer: {
    backgroundColor: 'transparent', // gestito dinamicamente
    paddingVertical: 6,
    elevation: 2,
    zIndex: 10,
    minHeight: 56,
    height: 'auto',
    alignItems: 'center',
  },
  filtersWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1,
  },
  filterChipsScroll: {
    flex: 1,
  },
  filterScrollContent: {
    paddingRight: 8,
    alignItems: 'center',
  },
  filterChipsWrap: {
    justifyContent: 'flex-start',
  },
  contentContainer: {
    flex: 1,
  },
  filterTabsContainer: {
    elevation: 2,
    paddingVertical: 0,
    zIndex: 10,
  },
  resetButton: {
    marginBottom: 10,
  },
  debugText: {
    fontSize: 14,
    color: '#555',
    marginTop: 0,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    // backgroundColor gestito dinamicamente
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    // color gestito dinamicamente
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    // color gestito dinamicamente
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    // color gestito dinamicamente
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    // color gestito dinamicamente
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
  },
  exploreButton: {
    marginTop: 24,
  },
  listContent: {
    padding: 0,
    paddingTop: 0,
    paddingBottom: 80, // Aggiungi spazio in fondo per il FAB
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  prenotazioneCard: {
    marginVertical: 4,
    marginHorizontal: 6,
    elevation: 2,
    borderRadius: 8,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    // backgroundColor gestito dinamicamente
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    flex: 1,
    marginHorizontal: 4,
  },
  statoBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
  },
  statoLabel: {
    fontSize: 14,
    // color gestito dinamicamente
    marginBottom: 8,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 8,
    // backgroundColor gestito dinamicamente
    height: 1,
  },
  dettagliContainer: {
    marginVertical: 8,
  },
  dettaglioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dettaglioText: {
    marginLeft: 8,
    fontSize: 14,
    // color gestito dinamicamente
    flex: 1,
  },
  cardActions: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    zIndex: 100,
  },
  annullamentoModal: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  motivoInput: {
    backgroundColor: 'transparent',
    marginTop: 16,
  },
  dialogText: {
    fontSize: 16,
    marginBottom: 16,
    // color gestito dinamicamente
  },
  dialogLabel: {
    fontSize: 14,
    marginBottom: 8,
    // color gestito dinamicamente
    fontWeight: 'bold',
  },
  dialogInput: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  dialogSubText: {
    fontSize: 14,
    marginTop: 16,
    // color gestito dinamicamente
    fontStyle: 'italic',
  },
  dialogWarningText: {
    fontSize: 16,
    marginVertical: 8,
    // color gestito dinamicamente
    fontWeight: 'bold',
  },
  filterChip: {
    marginRight: 8,
    marginVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipSelected: {
    elevation: 0,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  filterChipTextSelected: {
    fontWeight: '700',
  },
  filterChipContent: {
    height: 32,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  resetFilterLink: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  boldText: {
    fontWeight: 'bold',
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // backgroundColor gestito dinamicamente
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
  },
  debugBar: {
    backgroundColor: '#f0f9f0',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  deleteDialogButton: {
    // backgroundColor gestito dinamicamente
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginTop: 8,
  },
  dialogCancelButton: {
    flex: 1,
    marginRight: 8,
    borderColor: '#ccc',
    borderWidth: 1,
    height: 50,
  },
  dialogConfirmButton: {
    flex: 1,
    marginLeft: 8,
    height: 50,
  },
  dialogButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});


















