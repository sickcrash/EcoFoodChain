import React, { useState, useEffect, useMemo, useContext } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  HelperText,
  Appbar,
  Card,
  Divider,
  Portal,
  Modal,
  Surface,
  List,
  Title,
  Chip,
  RadioButton
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { getLottoById, updateLotto } from '../../../src/services/lottiService';
import { prenotaLotto } from '../../../src/services/prenotazioniService';
import { PRIMARY_COLOR, BONIFICO_IBAN_LABEL } from '../../../src/config/constants';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { useNotifiche } from '../../../src/context/NotificheContext';

import { ThemeContext } from '../../../src/context/ThemeContext';

// Definizione delle unità  di misura disponibili, raggruppate per tipo
const UNITA_MISURA_GROUPS = {
  'Peso': ['kg', 'g'],
  'Volume': ['l', 'ml'],
  'Quantità ': ['pz'],
};

// Definizione delle unità  di misura disponibili
const UNITA_MISURA_OPTIONS = [
  { label: 'Chilogrammi (kg)', value: 'kg' },
  { label: 'Grammi (g)', value: 'g' },
  { label: 'Litri (l)', value: 'l' },
  { label: 'Millilitri (ml)', value: 'ml' },
  { label: 'Pezzi (pz)', value: 'pz' },
];

const formatDate = (date: Date | null) => {
  if (!date) return 'Data non impostata';

  try {
    // Verifico che la data sia valida
    if (isNaN(date.getTime())) {
      console.warn('Data non valida:', date);
      return 'Data non valida';
    }

    return format(date, 'dd/MM/yyyy', { locale: it });
  } catch (error) {
    console.error('Errore nella formattazione della data:', error);
    return 'Errore formato data';
  }
};

function formatUtcToLocal(ts?: string | null) {
  if (!ts) return 'Data non disponibile';
  const iso = ts.includes('T')
    ? (ts.endsWith('Z') ? ts : ts + 'Z')
    : ts.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

type ThemeContextType = {
  isDarkMode?: boolean;
  toggleTheme?: () => void;
};

const DettaglioLottoScreen = () => {
  const themeContext = useContext(ThemeContext) as ThemeContextType;
  const isDarkMode = !!themeContext?.isDarkMode;
  // Palette dinamica coerente con ProfiloScreen
  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const textColor = isDarkMode ? '#fff' : '#000';
  const cardBackgroundColor = isDarkMode ? '#1e1e1e' : '#fff';
  // Usa un fallback per il colore delle icone in chiaro
  const iconColor = isDarkMode ? PRIMARY_COLOR : '#616161';
  const infoTextColor = isDarkMode ? '#fff' : '#000';
  const infoValueColor = isDarkMode ? '#fff' : '#000';
  const { user } = useAuth();
  const { refreshNotifiche } = useNotifiche();
  const params = useLocalSearchParams();
  const { id } = params;

  // Controlla se l'utente puà² modificare i lotti in base al suo ruolo
  const canEditLotto = useMemo(() => {
    return user?.ruolo === 'Operatore' || user?.ruolo === 'Amministratore';
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lotto, setLotto] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);

  // Stato del form
  const [nome, setNome] = useState('');
  const [descrizione, setDescrizione] = useState('');
  const [quantita, setQuantita] = useState('');
  const [unitaMisura, setUnitaMisura] = useState('kg');
  const [dataScadenza, setDataScadenza] = useState<Date | null>(new Date());
  const [prezzo, setPrezzo] = useState('');
  const [luogoRitiro, setLuogoRitiro] = useState('');

  // Stati dei modali
  const [showUnitaPicker, setShowUnitaPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNativeCalendar, setShowNativeCalendar] = useState(false);

  // Validazione
  const [errors, setErrors] = useState({
    nome: false,
    quantita: false,
    dataScadenza: false,
    prezzo: false,
  });

  // Stati per la prenotazione
  const [prenotazioneModalVisible, setPrenotazioneModalVisible] = useState(false);
  const [dataRitiroPrevista, setDataRitiroPrevista] = useState(addDays(new Date(), 1));
  const [notePrenotazione, setNotePrenotazione] = useState('');
  const [prenotazioneInCorso, setPrenotazioneInCorso] = useState(false);
  const [tipoPagamento, setTipoPagamento] = useState<'contanti' | 'bonifico' | null>(null);

  // Determina se l'utente puà² prenotare il lotto (solo utenti normali, non amministratori/operatori)
  const canPrenotareLotto = useMemo(() => {
    // Solo gli utenti con ruolo 'Utente' possono prenotare
    return user?.ruolo === 'Utente';

    // Vecchia condizione che includeva anche gli amministratori:
    // return user?.ruolo === 'Utente' || user?.ruolo === 'Amministratore';
  }, [user]);

  // Verifica i permessi di modifica all'avvio
  useEffect(() => {
    if (!canEditLotto && editMode) {
      // Se l'utente non ha i permessi ma è in modalità  modifica, disattiva la modalità  di modifica
      setEditMode(false);
      Toast.show({
        type: 'error',
        text1: 'Permessi insufficienti',
        text2: 'Non hai i permessi per modificare questo lotto',
      });
    }
  }, [canEditLotto, editMode]);

  // Debug: verifica l'apertura del modale di prenotazione
  useEffect(() => {
    if (prenotazioneModalVisible) {
      console.log('Modale di prenotazione aperto');
    } else {
      console.log('Modale di prenotazione chiuso');
    }
  }, [prenotazioneModalVisible]);

  // Funzione di utilità  per il debug delle date
  const debugDateValue = (label: string, value: any): void => {
    try {
      let debugInfo = `${label}: `;

      // Analisi del tipo di valore
      debugInfo += `(tipo: ${typeof value}) `;

      if (value === null) {
        debugInfo += 'NULL';
      } else if (value === undefined) {
        debugInfo += 'UNDEFINED';
      } else if (typeof value === 'string') {
        debugInfo += `"${value}" `;

        // Prova a creare una data dalla stringa per vedere se è valida
        try {
          const testDate = new Date(value);
          debugInfo += `â†’ Date: ${testDate} (${isNaN(testDate.getTime()) ? 'INVALIDA' : 'valida'})`;
        } catch (error) {
          const err = error as Error;
          debugInfo += `â†’ NON convertibile in Date: ${err.message || 'errore sconosciuto'}`;
        }
      } else if (value instanceof Date) {
        debugInfo += `Date object: ${value.toString()} `;
        debugInfo += `(getTime: ${isNaN(value.getTime()) ? 'INVALIDA' : value.getTime()})`;
        debugInfo += `(ISO: ${isNaN(value.getTime()) ? 'INVALIDA' : value.toISOString()})`;
      } else {
        debugInfo += `${JSON.stringify(value)}`;
      }

      // Log generale
      console.log(debugInfo);

      // Per date critiche, mostra un toast per debug
      if (label.includes('CRITICO')) {
        Toast.show({
          type: 'info',
          text1: 'Debug data',
          text2: debugInfo.substring(0, 100) + (debugInfo.length > 100 ? '...' : ''),
          position: 'bottom',
          visibilityTime: 4000,
        });
      }

    } catch (error) {
      const err = error as Error;
      console.error('Errore nella funzione debugDateValue:', err.message || String(err));
    }
  };

  function formatLocalDateForInput(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Funzione di utilità  per il parsing sicuro delle date
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

        // Verifica validità  dei componenti
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
      console.error('Errore nel parsing della data:', error);
      return null;
    }
  };

  // Carica i dati del lotto
  useEffect(() => {
    const fetchLotto = async () => {
      try {
        setLoading(true);
        const lottoData = await getLottoById(Number(id));

        // Debug della data ricevuta
        debugDateValue('LOTTO RICEVUTO - data_scadenza', lottoData.data_scadenza);

        setLotto(lottoData);

        // Popola i campi del form con i dati del lotto
        setNome(lottoData.nome);
        setDescrizione(lottoData.descrizione || '');
        setQuantita(lottoData.quantita.toString());
        setUnitaMisura(lottoData.unita_misura);
        setPrezzo(lottoData.prezzo !== undefined && lottoData.prezzo !== null ? lottoData.prezzo.toString() : '');
        setLuogoRitiro(lottoData.indirizzo || '');

        // Assicurati che la data di scadenza sia valida
        try {
          // Usa il parsing sicuro
          const scadenzaDate = safeParseDate(lottoData.data_scadenza);
          if (scadenzaDate) {
            debugDateValue('Data di scadenza parsata', scadenzaDate);
            setDataScadenza(scadenzaDate);
          } else {
            // Se la data non è valida, imposta la data corrente
            console.warn('Data di scadenza non valida:', lottoData.data_scadenza);
            setDataScadenza(new Date());
          }
        } catch (dateError) {
          console.error('Errore nella conversione della data:', dateError);
          setDataScadenza(new Date()); // Fallback alla data corrente
        }
      } catch (error) {
        console.error('Errore nel caricamento del lotto:', error);
        Toast.show({
          type: 'error',
          text1: 'Errore',
          text2: 'Impossibile caricare i dati del lotto',
        });
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchLotto();
  }, [id]);

  // Validazione dei campi
  const validateField = (field: string, value: any) => {
    switch (field) {
      case 'nome':
        setErrors(prev => ({ ...prev, nome: !value.trim() }));
        break;
      case 'quantita':
        const qty = parseFloat(value);
        setErrors(prev => ({ ...prev, quantita: isNaN(qty) || qty <= 0 }));
        break;
      case 'dataScadenza':
        setErrors(prev => ({ ...prev, dataScadenza: !value }));
        break;
      case 'prezzo':
        // Prezzo puà² essere vuoto (null) o un numero positivo
        setErrors(prev => ({ ...prev, prezzo: value !== '' && (isNaN(parseFloat(value)) || parseFloat(value) < 0) }));
        break;
      default:
        break;
    }
  };

  const validateForm = () => {
    const newErrors = {
      nome: !nome.trim(),
      quantita: isNaN(parseFloat(quantita)) || parseFloat(quantita) <= 0,
      dataScadenza: !dataScadenza,
      prezzo: prezzo !== '' && (isNaN(parseFloat(prezzo)) || parseFloat(prezzo) < 0),
    };

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  // Gestione del salvataggio
  const handleSubmit = async () => {
    // Validazione del form
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      // Assicurati che dataScadenza sia una data valida
      if (!dataScadenza || isNaN(dataScadenza.getTime())) {
        throw new Error('Data di scadenza non valida');
      }

      // Formatta la data nel formato YYYY-MM-DD per il backend (no shift timezone)
      const formattedDate = format(dataScadenza, 'yyyy-MM-dd');
      console.log(`Data scadenza formattata per update: ${formattedDate}`);

      // Prepara i dati per l'aggiornamento
      const lottoData = {
        id: lotto.id,
        nome,
        descrizione,
        indirizzo: (luogoRitiro?.trim() || null),
        quantita: parseFloat(quantita),
        unita_misura: unitaMisura,
        data_scadenza: formattedDate, // Formato YYYY-MM-DD per il backend
        prezzo: prezzo !== '' ? parseFloat(prezzo) : null,
        notifyAdmin: true, // Notifica gli amministratori delle modifiche
      };

      console.log('Dati inviati per aggiornamento:', lottoData);

      // Invia l'aggiornamento
      const updatedLottoResponse = await updateLotto(lotto.id, lottoData, true);

      if (!updatedLottoResponse.success) {
        throw new Error(updatedLottoResponse.message || 'Errore nell\'aggiornamento del lotto');
      }

      Toast.show({
        type: 'success',
        text1: 'Lotto aggiornato',
        text2: 'Le modifiche sono state salvate con successo',
      });

      // Forza un refresh completo dei dati dal server
      const refreshedLotto = await getLottoById(lotto.id);
      console.log('Lotto refreshed after update:', refreshedLotto);

      // Aggiorna lo stato locale con i dati aggiornati
      setLotto(refreshedLotto);

      // Aggiorna anche i campi di form per sicurezza
      setNome(refreshedLotto.nome);
      setDescrizione(refreshedLotto.descrizione || '');
      setQuantita(refreshedLotto.quantita.toString());
      setUnitaMisura(refreshedLotto.unita_misura);
      setPrezzo(refreshedLotto.prezzo !== undefined && refreshedLotto.prezzo !== null ? refreshedLotto.prezzo.toString() : '');

      // Parsing sicuro della data di scadenza
      if (refreshedLotto.data_scadenza) {
        const newDate = safeParseDate(refreshedLotto.data_scadenza);
        if (newDate) {
          console.log(`Nuova data di scadenza impostata: ${newDate.toISOString()}`);
          setDataScadenza(newDate);
        }
      }

      setEditMode(false);
      refreshNotifiche(); // Aggiorna le notifiche

    } catch (error) {
      console.error('Errore nell\'aggiornamento del lotto:', error);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: error instanceof Error ? error.message : 'Impossibile aggiornare il lotto',
      });
    } finally {
      setSaving(false);
    }
  };

  // Annulla le modifiche
  const handleCancel = () => {
    // Debug della data originale
    debugDateValue('CRITICO - data_scadenza originale nel lotto', lotto.data_scadenza);

    // Resetta i campi ai valori originali
    setNome(lotto.nome);
    setDescrizione(lotto.descrizione || '');
    setQuantita(lotto.quantita.toString());
    setUnitaMisura(lotto.unita_misura);
    setPrezzo(lotto.prezzo !== undefined && lotto.prezzo !== null ? lotto.prezzo.toString() : '');
    setLuogoRitiro(lotto.indirizzo || '');

    // Usa la funzione safeParseDate per il parsing sicuro
    const parsedDate = safeParseDate(lotto.data_scadenza);
    if (parsedDate) {
      debugDateValue('Data di scadenza ripristinata', parsedDate);
      setDataScadenza(parsedDate);
    } else {
      console.warn('Impossibile parsare la data di scadenza durante il reset, imposto la data corrente');
      setDataScadenza(new Date());
    }

    setEditMode(false);
  };

  // Calcola stato del lotto (scaduto, in scadenza, ecc.)
  const getLottoStatus = () => {
    if (!lotto) return { label: 'In caricamento', color: '#666', bgColor: '#f5f5f5' };

    try {
      // Verifica se il lotto è prenotato e l'utente è un amministratore o operatore
      if (lotto.stato_prenotazione === 'Prenotato' &&
        (user?.ruolo === 'Amministratore' || user?.ruolo === 'Operatore')) {
        console.log('Lotto prenotato visualizzato da Admin/Operatore. Mostro etichetta "Prenotato"');
        return { label: 'Prenotato', color: '#2196F3', bgColor: '#E3F2FD' };
      }

      // Usa direttamente lo stato calcolato dal backend
      console.log('Stato del lotto dal backend:', lotto.stato);

      // Il backend puà² inviare "Verde", "Arancione", "Rosso"
      switch (lotto.stato) {
        case 'Rosso':
          return { label: 'Scaduto', color: '#F44336', bgColor: 'rgba(229,57,53,0.12)' };
        case 'Arancione':
          return { label: 'In scadenza', color: '#FFA000', bgColor: 'rgba(251,140,0,0.12)' };
        case 'Verde':
          return { label: 'Valido', color: '#4CAF50', bgColor: 'rgba(0,151,74,0.12)' };
        default:
          // Fallback al calcolo manuale solo se non c'è lo stato
          const oggi = new Date();
          const scadenza = new Date(lotto.data_scadenza);

          console.log('Fallback al calcolo manuale:', {
            oggi: oggi.toISOString(),
            scadenza: scadenza.toISOString(),
          });

          if (scadenza < oggi) {
            return { label: 'Scaduto', color: '#F44336', bgColor: 'rgba(229,57,53,0.12)' };
          }

          // Giorni rimanenti (a giorno, no timezone shift)
          const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const diffDays = Math.floor((startOf(scadenza).getTime() - startOf(oggi).getTime()) / (1000 * 60 * 60 * 24));
          console.log(`Giorni rimanenti (calcolo manuale): ${diffDays}`);

          if (diffDays <= 1) {
            return { label: 'Scaduto', color: '#F44336', bgColor: 'rgba(229,57,53,0.12)' };
          }
          if (diffDays <= 3) {
            return { label: 'In scadenza', color: '#FFA000', bgColor: 'rgba(251,140,0,0.12)' };
          }

          return { label: 'Valido', color: '#4CAF50', bgColor: 'rgba(0,151,74,0.12)' };
      }
    } catch (error) {
      console.error('Errore nel calcolo dello stato del lotto:', error);
      return { label: 'Stato sconosciuto', color: '#1E88E5', bgColor: 'rgba(30,136,229,0.12)' };
    }
  };

  // Incrementa la data in modo sicuro
  const incrementDate = (days: number) => {
    try {
      if (dataScadenza && !isNaN(dataScadenza.getTime())) {
        const newDate = new Date(dataScadenza);
        newDate.setDate(newDate.getDate() + days);
        setDataScadenza(newDate);
        validateField('dataScadenza', newDate);
      } else {
        // Se la data non è valida, usa oggi + l'incremento
        const today = new Date();
        today.setDate(today.getDate() + days);
        setDataScadenza(today);
        validateField('dataScadenza', today);
      }
    } catch (error) {
      console.error('Errore nell\'incremento della data:', error);
      const today = new Date();
      setDataScadenza(today);
      validateField('dataScadenza', today);
    }
  };

  // Funzione per gestire la prenotazione del lotto
  const handlePrenotazione = () => {
    // Verificare se l'utente puà² prenotare
    if (!canPrenotareLotto) {
      Toast.show({
        type: 'error',
        text1: 'Permessi insufficienti',
        text2: 'Non hai i permessi per prenotare lotti',
      });
      return;
    }

    // Verifica se l'utente ha i permessi necessari in base allo stato del lotto
    const tipoUtente = user?.tipo_utente?.toUpperCase();
    const statoLotto = lotto?.stato?.toUpperCase();

    // Ogni tipo di utente puà² prenotare solo i lotti del suo "colore"
    const permessoValido = (
      (tipoUtente === 'PRIVATO' && statoLotto === 'VERDE') ||
      (tipoUtente === 'CANALE SOCIALE' && statoLotto === 'ARANCIONE') ||
      (tipoUtente === 'CENTRO RICICLO' && statoLotto === 'ROSSO')
    );

    if (!permessoValido) {
      Toast.show({
        type: 'error',
        text1: 'Permessi insufficienti',
        text2: `Non hai i permessi per prenotare un lotto con stato ${lotto?.stato}`,
      });
      return;
    }

    // Mostra il modale di prenotazione
    setDataRitiroPrevista(addDays(new Date(), 1)); // Imposta la data di prelievo prevista a domani
    setNotePrenotazione('');
    setPrenotazioneModalVisible(true);
  };

  // Funzione per confermare la prenotazione
  const confermaPrenotazione = async () => {
    try {
      setPrenotazioneInCorso(true);

      // Formatta la data nel formato YYYY-MM-DD
      const dataRitiroFormatted = format(dataRitiroPrevista, 'yyyy-MM-dd');

      // Verifica se è richiesto il tipo di pagamento (lotto verde e utente privato)
      const isLottoVerde = lotto.stato?.toUpperCase() === 'VERDE';
      const isUtenteTipoPrivato = user?.tipo_utente?.toUpperCase() === 'PRIVATO';

      // Se è richiesto ma non è stato selezionato, mostra un errore
      if (isLottoVerde && isUtenteTipoPrivato && !tipoPagamento) {
        Toast.show({
          type: 'error',
          text1: 'Metodo di pagamento richiesto',
          text2: 'Per i lotti verdi è necessario selezionare un metodo di pagamento',
        });
        setPrenotazioneInCorso(false);
        return;
      }

      // Imposta esplicitamente il tipo di pagamento a null se non è utente privato o lotto verde
      const tipoPagamentoToSend = (isLottoVerde && isUtenteTipoPrivato) ? tipoPagamento : null;

      // Effettua la prenotazione
      const result = await prenotaLotto(
        lotto?.id || 0,
        dataRitiroFormatted,
        notePrenotazione || null,
        tipoPagamentoToSend
      );

      if (result.success) {
        // Aggiorna lo stato
        setPrenotazioneModalVisible(false);
        setTipoPagamento(null); // Reset del tipo di pagamento

        // Messaggio di conferma
        Toast.show({
          type: 'success',
          text1: 'Prenotazione effettuata',
          text2: 'La tua prenotazione è stata registrata con successo!',
          visibilityTime: 3000,
        });

        // Aggiorna le notifiche
        refreshNotifiche();

        // Reindirizza alla pagina delle prenotazioni (dentro le tabs)
        router.push('/(tabs)/prenotazioni');
      } else {
        // Gestione specifica degli errori di prenotazione
        if (result.error?.message === 'Prenotazione duplicata') {
          // Caso di prenotazione duplicata dello stesso utente
          Toast.show({
            type: 'info',
            text1: 'Prenotazione già  esistente',
            text2: `Hai già  una prenotazione attiva per questo lotto (Stato: ${result.error.prenotazioneEsistente?.stato}).`,
            visibilityTime: 4000,
          });
        } else if (result.error?.message === 'Lotto già  prenotato') {
          // Caso di lotto già  prenotato da altri
          Toast.show({
            type: 'error',
            text1: 'Lotto non disponibile',
            text2: 'Questo lotto è già  stato prenotato da un altro utente',
            visibilityTime: 3000,
          });

          // Torna alla lista dei lotti
          router.push('/lotti');
        } else if (result.missingCentroId) {
          // Caso di ID Centro richiesto ma non fornito
          Toast.show({
            type: 'info',
            text1: 'Configurazione mancante',
            text2: 'Contatta l\'amministratore per completare la configurazione',
            visibilityTime: 3000,
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Errore nella prenotazione',
            text2: result.message || 'Si è verificato un errore. Riprova pià¹ tardi.',
            visibilityTime: 3000,
          });
        }
      }
    } catch (error) {
      console.error('Errore nella prenotazione:', error);

      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: 'Si è verificato un errore durante la prenotazione. Riprova pià¹ tardi.',
        visibilityTime: 3000,
      });
    } finally {
      setPrenotazioneInCorso(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={[styles.loadingText, { color: textColor }]}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Appbar.Header style={{ backgroundColor: cardBackgroundColor }}>
        <Appbar.BackAction onPress={() => router.back()} color={textColor} />
        <Appbar.Content title={editMode ? "Modifica Lotto" : "Dettaglio Lotto"} color={textColor} />
        {!editMode && canEditLotto && (
          <Appbar.Action icon="pencil" onPress={() => setEditMode(true)} color={iconColor} />
        )}
      </Appbar.Header>
      <ScrollView style={[styles.scrollView, { backgroundColor }]} contentContainerStyle={styles.scrollContent}>
        {!editMode ? (
          // ...existing code for view mode...
          <>
            <Card style={[styles.card, { backgroundColor: cardBackgroundColor, borderColor: isDarkMode ? '#222' : '#eee', borderWidth: 1 }]}>
              <Card.Content>
                <View style={styles.headerRow}>
                  <Title style={{ color: textColor }}>{lotto.nome}</Title>
                  <View style={styles.statusContainer}>
                    <Chip
                      style={[styles.statusChip, { backgroundColor: getLottoStatus().bgColor }]}
                      textStyle={[styles.statusChipText, { color: getLottoStatus().color }]}
                    >
                      {getLottoStatus().label}
                    </Chip>
                  </View>
                </View>
                {lotto.descrizione && (
                  <Text style={[styles.description, { color: textColor }]}>{lotto.descrizione}</Text>
                )}
                <Divider style={[styles.divider, { backgroundColor: isDarkMode ? '#333' : '#e0e0e0' }]} />
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="scale" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}>
                    Quantità : <Text style={[styles.infoValue, { color: infoValueColor }]}>{lotto.quantita} {lotto.unita_misura}</Text>
                  </Text>
                </View>
                {/* Visualizzazione prezzo solo se presente */}
                {lotto.prezzo !== undefined && lotto.prezzo !== null && (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="currency-eur" size={20} color={iconColor} />
                    <Text style={[styles.infoText, { color: infoTextColor }]}>
                      Prezzo: <Text style={[styles.infoValue, { color: infoValueColor }]}>{lotto.prezzo.toFixed(2)} â‚¬</Text>
                    </Text>
                  </View>
                )}
                {/* Visualizzazione tipo pagamento se disponibile */}
                {lotto.tipo_pagamento && (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="credit-card" size={20} color={iconColor} />
                    <Text style={[styles.infoText, { color: infoTextColor }]}>
                      Tipo pagamento: <Text style={[styles.infoValue, { color: infoValueColor }]}>
                        {lotto.tipo_pagamento === 'contanti' ? 'Contanti' : BONIFICO_IBAN_LABEL}
                      </Text>
                    </Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Ionicons name="calendar" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}>
                    Shelf-Life: <Text style={[styles.infoValue, { color: infoValueColor }]}>{formatDate(new Date(lotto.data_scadenza))}</Text>
                  </Text>
                </View>
                {/* Luogo di ritiro (indirizzo) */}
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="map-marker" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}>
                    Luogo di ritiro: <Text style={[styles.infoValue, { color: infoValueColor }]}>{lotto.indirizzo || 'Non indicato'}</Text>
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="person" size={20} color={iconColor} />
                  <Text style={[styles.infoText, { color: infoTextColor }]}>
                    Creato da: <Text style={[styles.infoValue, { color: infoValueColor }]}>{lotto.creato_nome || "Utente"}</Text>
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: infoTextColor }]}>Creato il:</Text>
                  <Text style={[styles.infoValue, { color: infoValueColor }]}>
                    {formatUtcToLocal(lotto.creato_il ?? lotto.createdAt ?? lotto.created_at)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: infoTextColor }]}>Ultimo aggiornamento:</Text>
                  <Text style={[styles.infoValue, { color: infoValueColor }]}>
                    {formatUtcToLocal(lotto.aggiornato_il ?? lotto.updated_at)}
                  </Text>
                </View>
                {/* Pulsante di prenotazione */}
                {canPrenotareLotto && (
                  <TouchableOpacity
                    onPress={handlePrenotazione}
                    style={styles.prenotaButtonContainer}
                    activeOpacity={0.8}
                  >
                    <Button
                      mode="contained"
                      icon="cart-plus"
                      onPress={handlePrenotazione}
                      style={[styles.prenotaButton, { backgroundColor: PRIMARY_COLOR }]}
                      contentStyle={{ height: 48 }}
                      labelStyle={{ color: isDarkMode ? '#000' : '#fff', fontWeight: 'bold' }}
                      theme={{ colors: { text: isDarkMode ? '#000' : '#fff' } }}
                    >
                      Prenota questo lotto
                    </Button>
                  </TouchableOpacity>
                )}
              </Card.Content>
            </Card>
          </>
        ) : (
          // Modalità  modifica UNIFICATA con nuovo.tsx
          <>
            {/* InfoCard introduttiva come in nuovo.tsx */}
            <Surface style={[styles.infoCard, { backgroundColor: isDarkMode ? '#23262F' : '#e3f2fd' }]}>
              <MaterialCommunityIcons name="information" size={24} color={isDarkMode ? PRIMARY_COLOR : '#388e3c'} style={styles.infoIcon} />
              <Text style={[styles.infoCardText, { color: isDarkMode ? PRIMARY_COLOR : '#388e3c' }]}>
                Lo stato del lotto (Verde, Arancione, Rosso) verrà  calcolato automaticamente in base alla data di scadenza.
                Non è necessario specificarlo.
              </Text>
            </Surface>
            {/* Card informazioni lotto */}
            <Card style={[styles.formCard, { backgroundColor: cardBackgroundColor, borderColor: isDarkMode ? '#222' : '#eee', borderWidth: 1 }]}>
              <Card.Title title="Informazioni Lotto" titleStyle={{ color: textColor, fontWeight: 'bold' }} />
              <Card.Content>
                <TextInput
                  label="Nome del lotto"
                  value={nome}
                  onChangeText={(text) => {
                    setNome(text);
                    validateField('nome', text);
                  }}
                  style={[styles.input, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                  error={errors.nome}
                  mode="outlined"
                  left={<TextInput.Icon icon="package-variant" color={PRIMARY_COLOR} />}
                  theme={{
                    colors: {
                      text: isDarkMode ? '#fff' : '#000',
                      placeholder: isDarkMode ? '#b0b0b0' : undefined,
                      onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                      primary: PRIMARY_COLOR,
                      background: isDarkMode ? '#181A20' : '#fff',
                      onSurface: isDarkMode ? '#fff' : '#000',
                    },
                  }}
                  underlineColor={PRIMARY_COLOR}
                  selectionColor={PRIMARY_COLOR}
                  placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                  inputMode="text"
                  editable
                  autoCapitalize="sentences"
                  placeholder="Nome del lotto"
                />
                {errors.nome && <HelperText type="error">Il nome è obbligatorio</HelperText>}
                <TextInput
                  label="Descrizione"
                  value={descrizione}
                  onChangeText={setDescrizione}
                  style={[styles.input, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  left={<TextInput.Icon icon="text" color={PRIMARY_COLOR} />}
                  theme={{
                    colors: {
                      text: isDarkMode ? '#fff' : '#000',
                      placeholder: isDarkMode ? '#b0b0b0' : undefined,
                      onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                      primary: PRIMARY_COLOR,
                      background: isDarkMode ? '#181A20' : '#fff',
                      onSurface: isDarkMode ? '#fff' : '#000',
                    },
                  }}
                  underlineColor={PRIMARY_COLOR}
                  selectionColor={PRIMARY_COLOR}
                  placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                  inputMode="text"
                  editable
                  placeholder="Descrizione"
                />
                {/* Campo Luogo di ritiro */}
                <View style={styles.row}>
                  <TextInput
                    label="Quantità "
                    value={quantita}
                    onChangeText={(text) => {
                      setQuantita(text);
                      validateField('quantita', text);
                    }}
                    keyboardType="numeric"
                    style={[styles.input, styles.flex1, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                    error={errors.quantita}
                    mode="outlined"
                    left={<TextInput.Icon icon="scale" color={PRIMARY_COLOR} />}
                    theme={{
                      colors: {
                        text: isDarkMode ? '#fff' : '#000',
                        placeholder: isDarkMode ? '#b0b0b0' : undefined,
                        onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                        primary: PRIMARY_COLOR,
                        background: isDarkMode ? '#181A20' : '#fff',
                        onSurface: isDarkMode ? '#fff' : '#000',
                      },
                    }}
                    underlineColor={PRIMARY_COLOR}
                    selectionColor={PRIMARY_COLOR}
                    placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                    inputMode="decimal"
                    editable
                    placeholder="Quantità "
                  />
                  <Pressable
                    style={styles.unitSelector}
                    onPress={() => setShowUnitaPicker(true)}
                  >
                    <Surface style={[styles.unitDisplay, { borderColor: PRIMARY_COLOR, backgroundColor: isDarkMode ? '#23262F' : '#fff' }]}>
                      <Text style={[styles.unitText, { color: isDarkMode ? '#fff' : PRIMARY_COLOR }]}>{unitaMisura}</Text>
                      <MaterialCommunityIcons name="chevron-down" size={20} color={PRIMARY_COLOR} />
                    </Surface>
                  </Pressable>
                </View>
                {errors.quantita && <HelperText type="error">Inserisci una quantità  valida</HelperText>}
                {/* Campo Prezzo */}
                <TextInput
                  label="Prezzo (â‚¬)"
                  value={prezzo}
                  onChangeText={(text) => {
                    setPrezzo(text);
                    validateField('prezzo', text);
                  }}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                  error={errors.prezzo}
                  mode="outlined"
                  left={<TextInput.Icon icon="currency-eur" color={PRIMARY_COLOR} />}
                  placeholder="Prezzo (opzionale)"
                  theme={{
                    colors: {
                      text: isDarkMode ? '#fff' : '#000',
                      placeholder: isDarkMode ? '#b0b0b0' : undefined,
                      onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                      primary: PRIMARY_COLOR,
                      background: isDarkMode ? '#181A20' : '#fff',
                      onSurface: isDarkMode ? '#fff' : '#000',
                    },
                  }}
                  underlineColor={PRIMARY_COLOR}
                  selectionColor={PRIMARY_COLOR}
                  placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                  inputMode="decimal"
                />
                {errors.prezzo && <HelperText type="error">Il prezzo deve essere un numero positivo o vuoto</HelperText>}
                {/* Campo Luogo di ritiro (unico, dopo tutti gli altri) */}
                <TextInput
                  label="Luogo del ritiro"
                  value={luogoRitiro}
                  onChangeText={setLuogoRitiro}
                  style={[styles.input, { backgroundColor: isDarkMode ? '#181A20' : '#fff' }]}
                  mode="outlined"
                  left={<TextInput.Icon icon="map-marker" color={PRIMARY_COLOR} />}
                  placeholder="Indica dove ritirare il lotto"
                  theme={{
                    colors: {
                      text: isDarkMode ? '#fff' : '#000',
                      placeholder: isDarkMode ? '#b0b0b0' : undefined,
                      onSurfaceVariant: isDarkMode ? '#b0b0b0' : undefined,
                      primary: PRIMARY_COLOR,
                      background: isDarkMode ? '#181A20' : '#fff',
                      onSurface: isDarkMode ? '#fff' : '#000',
                    },
                  }}
                  underlineColor={PRIMARY_COLOR}
                  selectionColor={PRIMARY_COLOR}
                  placeholderTextColor={isDarkMode ? '#b0b0b0' : undefined}
                  inputMode="text"
                />
              </Card.Content>
            </Card>
            {/* Card data di scadenza separata */}
            <Card style={[styles.formCard, { backgroundColor: cardBackgroundColor, borderColor: isDarkMode ? '#222' : '#eee', borderWidth: 1 }]}>
              <Card.Title title="Data di Scadenza" titleStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }} />
              <Card.Content>
                  <Pressable
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        setShowDatePicker(true);
                      } else {
                        setShowDatePicker(true);
                        setShowNativeCalendar(true);
                      }
                    }}
                  style={({ pressed }) => [
                    styles.dateSelector,
                    { opacity: pressed ? 0.9 : 1 }
                  ]}
                >
                  <Surface style={[styles.dateSurface, { backgroundColor: isDarkMode ? '#181A20' : '#fff', borderColor: PRIMARY_COLOR }, errors.dataScadenza && styles.dateError]}>
                    <Ionicons name="calendar" size={24} color={PRIMARY_COLOR} style={styles.dateIcon} />
                    <View style={styles.dateTextContainer}>
                      <Text style={[styles.dateLabel, { color: PRIMARY_COLOR }]}>Data di scadenza</Text>
                      <Text style={[styles.dateValue, { color: isDarkMode ? '#fff' : PRIMARY_COLOR }]}>{dataScadenza && !isNaN(dataScadenza.getTime()) ? formatDate(dataScadenza) : 'Data non valida'}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={PRIMARY_COLOR} />
                  </Surface>
                </Pressable>
                {errors.dataScadenza && <HelperText type="error">La data di scadenza deve essere valida</HelperText>}
                <Text style={[styles.infoText, { color: isDarkMode ? '#b0b0b0' : '#666' }]}>
                  àˆ possibile inserire anche date passate per i prodotti già  scaduti.
                  I lotti con data di scadenza nel passato saranno automaticamente etichettati come scaduti (rosso).
                </Text>
              </Card.Content>
            </Card>
            {/* Footer con Annulla/Salva come nuovo.tsx */}
            <View style={[styles.footer, { backgroundColor: isDarkMode ? '#23262F' : '#fff', borderTopColor: isDarkMode ? '#23262F' : '#e0e0e0' }]}>
              <Button
                mode="contained"
                onPress={handleCancel}
                style={[styles.button, { backgroundColor: '#F44336' }]}
                contentStyle={styles.buttonContent}
                icon="close"
                labelStyle={{ color: isDarkMode ? '#000' : '#fff', fontWeight: 'bold' }}
                theme={{ colors: { text: isDarkMode ? '#000' : '#fff' } }}
              >
                Annulla
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                style={[styles.button, styles.primaryButton, { backgroundColor: PRIMARY_COLOR }]}
                contentStyle={styles.buttonContent}
                loading={saving}
                disabled={saving}
                icon="check"
                labelStyle={{ color: isDarkMode ? '#181A20' : '#fff', fontWeight: 'bold' }}
              >
                Salva
              </Button>
            </View>
          </>
        )}
      </ScrollView>
      {/* Modal per la selezione dell'unità  di misura */}
      <Portal>
        <Modal
          visible={showUnitaPicker}
          onDismiss={() => setShowUnitaPicker(false)}
          contentContainerStyle={[styles.modalContainer, { backgroundColor }]}
        >
          <View style={[styles.modalContent, { backgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Seleziona unità  di misura</Text>
            </View>
            <ScrollView style={styles.modalScroll}>
              {Object.entries(UNITA_MISURA_GROUPS).map(([group, units]) => (
                <React.Fragment key={group}>
                  <Text style={[styles.modalGroup, { color: textColor, backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5' }]}>{group}</Text>
                  {units.map(unit => (
                    <List.Item
                      key={unit}
                      title={UNITA_MISURA_OPTIONS.find(opt => opt.value === unit)?.label || unit}
                      onPress={() => {
                        setUnitaMisura(unit);
                        setShowUnitaPicker(false);
                      }}
                      style={unitaMisura === unit ? [styles.selectedItem, { backgroundColor: isDarkMode ? '#263238' : '#e8f5e9' }] : undefined}
                      right={() => unitaMisura === unit ? <List.Icon icon="check" color={PRIMARY_COLOR} /> : null}
                    />
                  ))}
                </React.Fragment>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button onPress={() => setShowUnitaPicker(false)} textColor={PRIMARY_COLOR}>
                <Text style={{ color: PRIMARY_COLOR, fontWeight: '600' }}>Chiudi</Text>
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
      {Platform.OS !== 'web' && (
        <DatePickerModal
          locale="it"
          mode="single"
          visible={showNativeCalendar}
          date={(dataScadenza && !isNaN(dataScadenza.getTime()) ? dataScadenza : addDays(new Date(), 1)) || addDays(new Date(), 1)}
          onDismiss={() => setShowNativeCalendar(false)}
          onConfirm={({ date }) => {
            if (date) {
              const normalized = new Date(date.setHours(0, 0, 0, 0));
              setDataScadenza(normalized);
              validateField('dataScadenza', normalized);
            }
            setShowNativeCalendar(false);
            setShowDatePicker(false);
          }}
          validRange={{ startDate: new Date() }}
          saveLabel="Conferma"
          label="Seleziona data di scadenza"
        />
      )}
      {/* Modal per la selezione della data */}
      <Portal>
        <Modal
          visible={showDatePicker}
          onDismiss={() => {
            setShowNativeCalendar(false);
            setShowDatePicker(false);
          }}
          contentContainerStyle={[styles.modalContainer, { backgroundColor }]}
        >
          <View style={[styles.modalContent, { backgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Seleziona data di scadenza</Text>
            </View>
            {/* Date Picker copiato da nuovo.tsx per coerenza UX/UI e tema */}
            <View style={[styles.datePickerContainer, { flex: 1, minHeight: 180, justifyContent: 'flex-start' }]}>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  style={{
                    ...styles.webDatePicker,
                    backgroundColor: isDarkMode ? '#181A20' : '#fff',
                    color: isDarkMode ? '#fff' : '#222',
                    borderColor: isDarkMode ? '#333' : '#ccc',
                  }}
                  min={formatLocalDateForInput(new Date())}
                  value={dataScadenza ? formatLocalDateForInput(dataScadenza) : ''}
                  onChange={(e) => {
                    try {
                      if (e.target.value) {
                        const parts = e.target.value.split('-');
                        const year = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        const day = parseInt(parts[2], 10);
                        const date = new Date(year, month, day);
                        if (!isNaN(date.getTime())) {
                          setDataScadenza(date);
                          validateField('dataScadenza', date);
                        }
                      }
                    } catch (error) {
                      console.error('Errore nel date picker web:', error);
                    }
                  }}
                />
              ) : (
                <View style={styles.dateButtonsContainer}>
                  <Text style={[styles.dateSelectionText, { color: isDarkMode ? '#fff' : undefined }]}>
                    Data selezionata: {formatDate(dataScadenza || new Date())}
                  </Text>
                  <View style={styles.dateButtonsRow}>
                    <Button
                      mode="outlined"
                      icon="arrow-left"
                      onPress={() => incrementDate(-1)}
                      style={styles.dateButton}
                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                    >
                      -1 giorno
                    </Button>
                    <Button
                      mode="outlined"
                      icon="calendar-today"
                      onPress={() => {
                        const today = new Date();
                        setDataScadenza(today);
                        validateField('dataScadenza', today);
                      }}
                      style={styles.dateButton}
                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                    >
                      Oggi
                    </Button>
                    <Button
                      mode="outlined"
                      icon="arrow-right"
                      onPress={() => incrementDate(1)}
                      style={styles.dateButton}
                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                    >
                      +1 giorno
                    </Button>
                  </View>
                  <View style={styles.dateButtonsRow}>
                    <Button
                      mode="outlined"
                      onPress={() => incrementDate(7)}
                      style={styles.dateButton}
                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                    >
                      +1 settimana
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => incrementDate(30)}
                      style={styles.dateButton}
                      labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                    >
                      +1 mese
                    </Button>
                  </View>
                  <Button
                    mode="contained"
                    icon="calendar"
                    onPress={() => setShowNativeCalendar(true)}
                    style={styles.nativeCalendarButton}
                    labelStyle={{ color: isDarkMode ? '#181A20' : '#fff', fontWeight: 'bold' }}
                  >
                    Apri calendario
                  </Button>
                </View>
              )}
            </View>
            <View style={[
              styles.modalFooter,
              {
                backgroundColor: isDarkMode ? '#181A20' : '#fafafa',
                borderTopColor: isDarkMode ? '#23262F' : '#eee',
                // Fix overflow/taglio su dispositivi piccoli
                flexShrink: 0,
                flexGrow: 0,
                minHeight: 60,
                height: 60,
                alignItems: 'center',
                zIndex: 10,
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
              },
            ]}>
              <Button
                onPress={() => {
                  setShowNativeCalendar(false);
                  setShowDatePicker(false);
                }}
                textColor={PRIMARY_COLOR}
                mode="text"
                labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}
                style={{ marginRight: 8 }}
              >
                Chiudi
              </Button>
              <Button
                mode="contained"
                onPress={() => {
                  setShowNativeCalendar(false);
                  setShowDatePicker(false);
                }}
                style={{ backgroundColor: PRIMARY_COLOR }}
                labelStyle={{ color: isDarkMode ? '#181A20' : '#fff', fontWeight: 'bold' as const }}
              >
                Conferma
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>
      {/* Modal per la prenotazione del lotto */}
      <Portal>
        <Modal
          visible={prenotazioneModalVisible}
          onDismiss={() => setPrenotazioneModalVisible(false)}
          contentContainerStyle={[styles.prenotazioneModalContainer, { backgroundColor }]}
          dismissable={!prenotazioneInCorso}
        >
          <Surface style={[styles.prenotazioneModalContent, { backgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                {lotto?.nome ? `Prenota "${lotto.nome}"` : 'Prenota lotto'}
              </Text>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.modalBody}>
                <Text style={[styles.prenotazioneInfo, { color: textColor }]}>
                  Stai per prenotare il lotto <Text style={[styles.boldText, { color: textColor }]}>{lotto?.nome}</Text>
                </Text>
                <Divider style={[styles.divider, { backgroundColor: isDarkMode ? '#333' : '#e0e0e0' }]} />
                <Text style={[styles.prenotazioneLabel, { color: textColor }]}>Data di prelievo prevista:</Text>
                {Platform.OS === 'web' ? (
                  <input
                    id="dataRitiroWeb"
                    type="date"
                    style={{
                      border: `1px solid ${errors.dataScadenza ? '#B00020' : (isDarkMode ? '#333' : '#ccc')}`,
                      borderRadius: 4,
                      padding: 12,
                      fontSize: 16,
                      width: '75%',
                      display: 'block',
                      marginLeft: 'auto',
                      marginRight: 'auto',
                      background: isDarkMode ? '#181A20' : '#fff',
                      color: isDarkMode ? '#fff' : '#000',
                      outline: 'none',
                      boxSizing: 'border-box',
                      height: 48,
                      minHeight: 48,
                      maxHeight: 48,
                      marginBottom: 8,
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    value={dataRitiroPrevista?.toISOString().split('T')[0]}
                    onChange={(e) => {
                      try {
                        if (e.target.value) {
                          const parts = e.target.value.split('-');
                          const year = parseInt(parts[0], 10);
                          const month = parseInt(parts[1], 10) - 1;
                          const day = parseInt(parts[2], 10);
                          const date = new Date(year, month, day);
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
                  <View style={styles.dateButtonsContainer}>
                    <Text style={[styles.dateSelectionText, { color: isDarkMode ? '#fff' : undefined }]}>
                      Data selezionata: {formatDate(dataRitiroPrevista || new Date())}
                    </Text>
                    <View style={styles.dateButtonsRow}>
                      <Button
                        mode="outlined"
                        icon="arrow-left"
                        onPress={() => setDataRitiroPrevista(prev => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d; })}
                        style={styles.dateButton}
                        labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                      >
                        -1 giorno
                      </Button>
                      <Button
                        mode="outlined"
                        icon="calendar-today"
                        onPress={() => setDataRitiroPrevista(new Date())}
                        style={styles.dateButton}
                        labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                      >
                        Oggi
                      </Button>
                      <Button
                        mode="outlined"
                        icon="arrow-right"
                        onPress={() => setDataRitiroPrevista(prev => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d; })}
                        style={styles.dateButton}
                        labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                      >
                        +1 giorno
                      </Button>
                    </View>
                    <View style={styles.dateButtonsRow}>
                      <Button
                        mode="outlined"
                        onPress={() => setDataRitiroPrevista(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })}
                        style={styles.dateButton}
                        labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                      >
                        +1 settimana
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => setDataRitiroPrevista(prev => { const d = new Date(prev); d.setDate(d.getDate() + 30); return d; })}
                        style={styles.dateButton}
                        labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}
                      >
                        +1 mese
                      </Button>
                    </View>
                  </View>
                )}
                {/* Selezione metodo di pagamento per lotti verdi e utenti privati */}
                {lotto?.stato?.toUpperCase() === 'VERDE' && user?.tipo_utente?.toUpperCase() === 'PRIVATO' && (
                  <>
                    <Text style={[styles.prenotazioneLabel, { color: textColor }]}>Metodo di pagamento:</Text>
                    <View style={styles.paymentMethodContainer}>
                      <View style={styles.radioButtonRow}>
                        <RadioButton
                          value="contanti"
                          status={tipoPagamento === 'contanti' ? 'checked' : 'unchecked'}
                          onPress={() => setTipoPagamento('contanti')}
                          color={isDarkMode ? '#b0b0b0' : '#666'}
                          uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'}
                        />
                        <Text style={[styles.radioButtonLabel, { color: textColor }]} onPress={() => setTipoPagamento('contanti')}>Contanti</Text>
                      </View>
                      <View style={styles.radioButtonRow}>
                        <RadioButton
                          value="bonifico"
                          status={tipoPagamento === 'bonifico' ? 'checked' : 'unchecked'}
                          onPress={() => setTipoPagamento('bonifico')}
                          color={isDarkMode ? '#b0b0b0' : '#666'}
                          uncheckedColor={isDarkMode ? '#b0b0b0' : '#666'}
                        />
                        <Text style={[styles.radioButtonLabel, { color: textColor }]} onPress={() => setTipoPagamento('bonifico')}>{BONIFICO_IBAN_LABEL}</Text>
                      </View>
                    </View>
                  </>
                )}
                <TextInput
                  value={notePrenotazione}
                  onChangeText={setNotePrenotazione}
                  style={[styles.noteInput, { backgroundColor: isDarkMode ? '#181A20' : '#f5f5f5', color: isDarkMode ? '#fff' : '#000' }]}
                  placeholder="Note (opzionale)"
                  multiline
                  numberOfLines={3}
                  mode="outlined"
                  theme={{
                    colors: {
                      text: isDarkMode ? '#fff' : '#000',
                      placeholder: isDarkMode ? '#b0b0b0' : '#666',
                      primary: PRIMARY_COLOR,
                      background: isDarkMode ? '#181A20' : '#f5f5f5',
                      onSurface: isDarkMode ? '#fff' : '#000',
                    },
                  }}
                  placeholderTextColor={isDarkMode ? '#b0b0b0' : '#666'}
                />
              </View>
            </ScrollView>
            <Divider style={[styles.divider, { backgroundColor: isDarkMode ? '#333' : '#e0e0e0' }]} />
            <View style={[styles.prenotazioneModalFooter, { backgroundColor: isDarkMode ? '#23262F' : '#f5f5f5' }]}>
              <Button
                mode="contained"
                onPress={() => setPrenotazioneModalVisible(false)}
                style={[styles.footerButton, { backgroundColor: '#F44336' }]}
                contentStyle={{ height: 48 }}
                disabled={prenotazioneInCorso}
                labelStyle={{ color: isDarkMode ? '#000' : '#fff', fontWeight: 'bold' }}
              >
                Annulla
              </Button>
              <Button
                mode="contained"
                onPress={confermaPrenotazione}
                style={[styles.footerButton, { backgroundColor: PRIMARY_COLOR, marginLeft: 8 }]}
                contentStyle={{ height: 48 }}
                labelStyle={{ color: isDarkMode ? '#000' : '#fff', fontWeight: 'bold' }}
                loading={prenotazioneInCorso}
                disabled={prenotazioneInCorso}
              >
                Conferma
              </Button>
            </View>
          </Surface>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  } as any,
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  } as any,
  scrollView: {
    flex: 1,
  } as any,
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  } as any,
  card: {
    marginBottom: 16,
    elevation: 2,
  } as any,
  formCard: {
    marginBottom: 16,
    elevation: 2,
  } as any,
  infoCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  } as any,
  infoIcon: {
    marginRight: 12,
  } as any,
  infoCardText: {
    flex: 1,
    fontSize: 14,
    color: '#0d47a1',
  } as any,
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  } as any,
  description: {
    marginBottom: 16,
    fontSize: 14,
    // color dinamico
  } as any,
  divider: {
    marginVertical: 12,
  } as any,
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  } as any,
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    // color dinamico
  } as any,
  infoLabel: {
    marginLeft: 8,
    marginRight: 5,
    fontSize: 13,
    fontWeight: '600',
    // color dinamico
  } as any,
  infoValue: {
    fontWeight: 'bold',
    // color dinamico
  } as any,
  prenotaButtonContainer: {
    marginTop: 16,
    marginBottom: 8,
    alignItems: 'center',
  } as any,
  prenotaButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 2,
    backgroundColor: PRIMARY_COLOR,
  } as any,
  prenotaButtonLabel: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#fff',
  } as any,
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  } as any,
  datePickerContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  webDatePicker: {
    width: 200,
    height: 40,
    fontSize: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    color: '#222',
    marginBottom: 16,
  } as any,
  dateButtonsContainer: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
  } as any,
  dateSelectionText: {
    fontSize: 15,
    marginBottom: 8,
    fontWeight: '500',
  } as any,
    dateButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    } as any,
    dateButton: {
      marginHorizontal: 4,
      minWidth: 90,
    } as any,
    nativeCalendarButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
    } as any,
  modalBody: {
    padding: 12,
  } as any,
  prenotazioneInfo: {
    fontSize: 15,
    marginBottom: 8,
    color: '#333',
  } as any,
  boldText: {
    fontWeight: 'bold',
    color: '#222',
  } as any,
  noteInput: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
  } as any,
  footerButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
  } as any,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  } as any,
  flex1: {
    flex: 1,
  } as any,
  input: {
    marginBottom: 12,
  } as any,
  unitSelector: {
    marginLeft: 8,
    marginTop: 4,
    alignSelf: 'flex-end',
    marginBottom: 12,
  } as any,
  unitDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderWidth: 1,
    borderRadius: 4,
    minWidth: 80,
  } as any,
  unitText: {
    marginRight: 4,
    fontSize: 16,
  } as any,
  dateSelector: {
    marginBottom: 8,
  } as any,
  dateSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  } as any,
  dateError: {
    borderColor: '#B00020',
  } as any,
  dateIcon: {
    marginRight: 12,
  } as any,
  dateTextContainer: {
    flex: 1,
  } as any,
  dateLabel: {
    fontSize: 12,
    color: '#666',
  } as any,
  dateValue: {
    fontSize: 16,
  } as any,
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    // borderTopColor dinamico
    // backgroundColor dinamico
    elevation: 4,
  } as any,
  button: {
    flex: 1,
    marginHorizontal: 4,
  } as any,
  buttonContent: {
    paddingVertical: 8,
  } as any,
  primaryButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    marginLeft: 8,
  } as any,
  confirmButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    marginLeft: 8,
    height: 50,
  },
  confirmButtonLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    margin: 20,
    marginTop: 40,
    marginBottom: 40,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 1000,
    maxHeight: '90%',
  } as any,
  modalContent: {
    borderRadius: 8,
    maxHeight: '80%',
  } as any,
  modalHeader: {
    padding: 16,
  } as any,
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  } as any,
  modalScroll: {
    maxHeight: 350,
  } as any,
  modalGroup: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  } as any,
  selectedItem: {
  } as any,
  prenotazioneModalContent: {
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  prenotazioneLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    // color dinamico
  },
  modalScrollView: {
    maxHeight: '80%',
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
  },
  prenotazioneModalContainer: {
    margin: 20,
    marginTop: 40,
    marginBottom: 40,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 1000,
    maxHeight: '90%',
  },
  prenotazioneModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#23262F', // dark di default, override inline per tema
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  } as any,
  statusContainer: {
    flexDirection: 'row',
  },
  statusChip: {
    height: 28,
    paddingHorizontal: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default DettaglioLottoScreen;


