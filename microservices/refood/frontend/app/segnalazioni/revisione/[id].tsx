// Import dei moduli React e componenti UI necessari
import React, { useState, useEffect, useMemo } from 'react';

import {
    View,
    ScrollView,
    StyleSheet,
    Platform,
    Image,
    KeyboardAvoidingView,
    Pressable,
    TouchableOpacity,
    Modal as RNModal
} from 'react-native';

import {
    Appbar,
    Text,
    TextInput,
    Button,
    Surface,
    Divider,
    Portal,
    Card,
    Modal,
    List,
    useTheme,
    Dialog,
    Paragraph,
    ActivityIndicator
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';

import {
    getSegnalazioneById,
    startRevisione,
    approvaSegnalazione,
    rifiutaSegnalazione,
    type SegnalazioneResponse,
    type UnitaMisura
} from '../../../src/services/segnalazioniService';

import { createLotto, deleteLotto, invalidateCache } from '../../../src/services/lottiService';

import { router } from 'expo-router';
import { useRoute } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { PRIMARY_COLOR , STORAGE_KEYS } from '../../../src/config/constants';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';

import { api } from '../../../src/api/api';
import logger from '../../../src/utils/logger';

import notificheService from '../../../src/services/notificheService';
import { useNotifiche } from '../../../src/context/NotificheContext';
import { pushNotificationService } from '../../../src/services/pushNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/src/context/AuthContext';

// Definizione delle unità di misura disponibili, raggruppate per tipo
const UNITA_MISURA_GROUPS: Record<string, UnitaMisura[]> = {
    Peso: ['kg', 'g'],
    Volume: ['l', 'ml'],
    Quantità: ['pz'],
};

const NuovaSegnalazioneScreen = () => {
    // Recupera il tema (dark/light)
    const theme = useTheme();
    const isDark = theme.dark;

    const backgroundColor = isDark ? '#121212' : '#f5f5f5';
    const textColor = isDark ? '#fff' : '#000';

    const route = useRoute();
    const segnalazioneId = Number((route.params as any)?.id);
    const invalidId = !Number.isFinite(segnalazioneId);

    const { refreshNotifiche } = useNotifiche();

    // stato remoto
    const [loading, setLoading] = useState(true);
    const [segn, setSegn] = useState<SegnalazioneResponse | null>(null);

    const { user } = useAuth();

    // Stati del form
    const [nome, setNome] = useState('');
    const [descrizione, setDescrizione] = useState('');
    const [quantita, setQuantita] = useState('');
    const [unitaMisura, setUnitaMisura] = useState<UnitaMisura>('kg');
    const [prezzo, setPrezzo] = useState('');
    const [indirizzoCentro, setIndirizzoCentro] = useState('');
    const [shelflife, setShelflife] = useState<Date | null>(addDays(new Date(), 7));

    // immagini (solo preview, niente aggiunta/rimozione)
    const [modalVisible, setModalVisible] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    // Stati per gestire i modal
    const [showUnitaPicker, setShowUnitaPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showNativeCalendar, setShowNativeCalendar] = useState(false);

    // Stati per bottone conferma
    const [showPublishConfirm, setShowPublishConfirm] = useState(false);
    const [busyPublish, setBusyPublish] = useState(false);

    // Stati per bottone rifiuta
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [busyReject, setBusyReject] = useState(false);

    // Stati per gestire gli errori
    const [errors, setErrors] = useState({
        nome: false,
        descrizione: false,
        quantita: false,
        prezzo: false,
        indirizzoCentro: false,
        shelflife: false
    });

    const isAmministratore = user?.ruolo === 'Amministratore';

    // Valida un campo specifico
    const validateField = (field: string, value: any) => {
        let isValid = true;

        switch (field) {
            case 'nome':
                isValid = value.trim().length > 0;
                break;
            case 'descrizione':
                isValid = value.trim().length > 0;
                break;
            case 'quantita':
                isValid = !isNaN(parseFloat(value)) && parseFloat(value) > 0;
                break;
            case 'indirizzoCentro':
                isValid = value.trim().length > 0;
                break;
            case 'prezzo':
                // Prezzo può essere vuoto (null) o un numero positivo
                isValid = value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0);
                break;
            case 'shelflife':
                // Non blocchiamo più date nel passato per permettere
                // l'inserimento di lotti già scaduti
                isValid = value instanceof Date && !isNaN(value.getTime());

                // Se la data è nel passato, mostriamo un'avvertenza ma permettiamo l'invio
                if (isValid && value < new Date()) {
                    // Mostriamo un Toast di avviso
                    Toast.show({
                        type: 'info',
                        text1: 'Data nel passato',
                        text2: 'Stai inserendo un prodotto con shelf-life già passata.',
                        visibilityTime: 5000,
                    });
                }
                break;
        }
        setErrors(prev => ({ ...prev, [field]: !isValid }));
        return isValid;
    };

    // Valida l'intero form
    const validateForm = () => {
        const nomeValid = validateField('nome', nome);
        const descValid = validateField('descrizione', descrizione);
        const imgLenghtValid = images.length > 0;
        const quantitaValid = validateField('quantita', quantita);
        const prezzoValid = validateField('prezzo', prezzo);
        const indirizzoCentroValid = validateField('indirizzoCentro', indirizzoCentro);
        const shelflifeValid = validateField('shelflife', shelflife);

        return nomeValid && descValid && imgLenghtValid && quantitaValid && prezzoValid && indirizzoCentroValid && shelflifeValid;
    };

    async function handleConfermaPubblicaComeLotto() {
        if (!validateForm()) {
            Toast.show({ type: 'error', text1: 'Campi non validi', text2: 'Controlla i dati della segnalazione.' });
            return;
        }

        setBusyPublish(true);
        try {
            // 1) PRE-FLIGHT: leggo la segnalazione aggiornata
            const current = await getSegnalazioneById(Number(segnalazioneId));
            if (!current) {
                Toast.show({ type: 'error', text1: 'Segnalazione non trovata' });
                return;
            }
            if (current.stato === 'chiusa') {
                Toast.show({ type: 'error', text1: 'Segnalazione già chiusa', text2: 'Non è più possibile approvarla.' });
                return;
            }
            const lastAgg = current.aggiornato_il || null;

            // 2) CREO IL LOTTO (dai valori del form)
            const lottoData = {
                nome: nome.trim(),
                descrizione: (descrizione?.trim() || null),
                indirizzo: (indirizzoCentro?.trim() || null),
                quantita: parseFloat(quantita),
                unita_misura: unitaMisura,
                data_scadenza: formatLocalDateForInput(shelflife!),
                prezzo: prezzo ? parseFloat(prezzo) : 0,
                centro_id: 1,
            };

            const createRes = await createLotto(lottoData);

            if (!createRes.success || !createRes.lotto?.id) {
                Toast.show({
                    type: 'error',
                    text1: 'Creazione lotto fallita',
                    text2: createRes.message || 'Riprovare più tardi.',
                });
                return;
            }

            const lottoId = createRes.lotto.id;

            // 3) APPROVO LA SEGNALAZIONE (con controllo di concorrenza)
            try {
                await approvaSegnalazione(Number(segnalazioneId), {
                    nome: nome.trim(),
                    descrizione: (descrizione?.trim() || null),
                    indirizzoCentro: (indirizzoCentro?.trim() || null),
                    quantita: parseFloat(quantita),
                    unitaMisura,
                    shelflife: formatLocalDateForInput(shelflife!),
                    prezzo: prezzo ? parseFloat(prezzo) : null,
                    if_unmodified_at: lastAgg,
                });
            } catch (err: any) {
                // COMPENSAZIONE: se l’approvazione fallisce (409/400), rimuovi il lotto creato
                try {
                    if (lottoId) await deleteLotto(lottoId);
                } catch (rollbackError) {
                    console.warn('Rollback del lotto fallito', rollbackError);
                }

                const status = err?.response?.status;
                if (status === 409 || status === 400) {
                    Toast.show({
                        type: 'error',
                        text1: 'Operazione bloccata',
                        text2: 'La segnalazione è stata aggiornata/chiusa da un altro admin.',
                    });
                } else {
                    Toast.show({
                        type: 'error',
                        text1: 'Errore approvazione',
                        text2: err?.response?.data?.message || err?.message || 'Riprovare più tardi.',
                    });
                }
                return; // stop flow
            }

            // Tutto ok
            invalidateCache?.(); // se la usi per invalidare le liste lotti
            Toast.show({
                type: 'success',
                text1: 'Segnalazione approvata',
                text2: 'Lotto creato',
            });

            // Gestione notifiche in background per non bloccare l'utente
            setTimeout(async () => {
                try {
                    // Ottieni info sull'utente corrente
                    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
                    const user = userData ? JSON.parse(userData) : null;
                    const userNomeCompleto = user ? `${user.nome} ${user.cognome}` : 'Operatore';

                    // Invia notifica agli amministratori del centro e crea notifica locale per l'operatore
                    if (createRes.lotto?.id) {
                        await notificheService.addNotificaToAmministratori(
                            createRes.lotto.id,
                            'Nuovo lotto creato',
                            `Hai creato un nuovo lotto: ${nome} (${quantita} ${unitaMisura}), con scadenza: ${formatDate(shelflife)}`,
                            userNomeCompleto
                        );

                        logger.log(`Notifica inviata agli amministratori del lotto ${createRes.lotto.id}`);
                    } else {
                        logger.warn('Impossibile inviare notifica agli amministratori: lotto_id mancante');
                    }

                    // Invia anche la notifica push locale
                    await pushNotificationService.sendLocalNotification(
                        'Nuovo lotto creato',
                        `Hai creato un nuovo lotto: ${nome} (${quantita} ${unitaMisura})`,
                        {
                            type: 'notifica',
                            subtype: 'lotto_creato',
                            lottoId: createRes.lotto?.id || 0
                        }
                    );
                    logger.log('Notifica push locale inviata per il nuovo lotto');

                    // Aggiorna le notifiche
                    if (refreshNotifiche) {
                        refreshNotifiche();
                    }
                } catch (notificationError) {
                    logger.error('Errore nell\'invio della notifica:', notificationError);
                }
            }, 0);

            // Chiudi modale, naviga sulla lista segnalazioni
            setShowPublishConfirm(false);
            router.replace('/(tabs)/lotti');

        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Errore',
                text2: error?.response?.data?.message || error?.message || 'Impossibile completare l’operazione.',
            });
        } finally {
            setBusyPublish(false);
        }
    }

    async function handleConfermaRifiuta() {
        if (!rejectReason.trim()) {
            Toast.show({ type: 'error', text1: 'Motivo obbligatorio', text2: 'Inserisci la motivazione del rifiuto.' });
            return;
        }
        setBusyReject(true);
        try {
            // Pre-flight: ricontrollo la segnalazione e lo stato
            const current = await getSegnalazioneById(Number(segnalazioneId));
            if (!current) {
                Toast.show({ type: 'error', text1: 'Segnalazione non trovata' });
                return;
            }
            if (current.stato === 'chiusa') {
                Toast.show({ type: 'error', text1: 'Segnalazione già chiusa' });
                return;
            }

            await rifiutaSegnalazione(Number(segnalazioneId), {
                messaggio_esito: rejectReason.trim(),
                if_unmodified_at: current.aggiornato_il || null,
            });

            Toast.show({ type: 'success', text1: 'Segnalazione rifiutata' });
            setShowRejectDialog(false);

            // Torna alla lista segnalazioni
            router.replace('/(tabs)/segnalazioni');
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 409) {
                Toast.show({
                    type: 'error',
                    text1: 'Conflitto',
                    text2: 'La segnalazione è stata aggiornata/chiusa da un altro admin.',
                });
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Errore',
                    text2: err?.response?.data?.message || err?.message || 'Impossibile rifiutare.',
                });
            }
        } finally {
            setBusyReject(false);
        }
    }

    const imgBase = useMemo(() => {
        // http://localhost:3000
        return (api.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '') || 'http://localhost:3000';
    }, []);

    const images = useMemo(() => (segn?.images ?? []).map(i => imgBase + i.url), [segn, imgBase]);
    const selectedImage = images[activeIndex];

    useEffect(() => {
        if (!isAmministratore) {
            return;
        }
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                const s = await getSegnalazioneById(segnalazioneId);

                // idempotente: se è "inviata", avvia revisione
                if (s.stato === 'inviata') {
                    try { await startRevisione(segnalazioneId); } catch { /* no-op */ }
                    // ricarica
                    const s2 = await getSegnalazioneById(segnalazioneId);
                    if (mounted) setSegn(s2);
                } else {
                    if (mounted) setSegn(s);
                }

                // prefill form
                const src = s.stato === 'inviata' ? s : (await getSegnalazioneById(segnalazioneId));
                // se il backend manda solo "YYYY-MM-DD", forziamo T00:00 per sicurezza:
                const date = src.shelflife ? new Date(`${src.shelflife}T00:00:00`) : null;
                if (mounted) {
                    setNome(src.nome || '');
                    setDescrizione(src.descrizione || '');
                    setQuantita(String(src.quantita ?? ''));
                    setUnitaMisura(src.unita_misura);
                    setPrezzo(src.prezzo != null ? String(src.prezzo) : '');
                    setIndirizzoCentro(src.indirizzo_centro || '');
                    setShelflife(isNaN(date?.getTime() ?? NaN) ? null : date);
                }
            } catch (e: any) {
                Toast.show({ type: 'error', text1: 'Errore', text2: e?.response?.data?.message || e?.message || 'Caricamento fallito' });
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [segnalazioneId, isAmministratore]);

    if (!isAmministratore) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor }]}>
                <Text style={[styles.loadingText, { color: textColor }]}>Non hai il permesso per accedere a questa pagina</Text>
                <Button mode="contained" onPress={() => router.push('/')} style={{ marginTop: 12, backgroundColor: PRIMARY_COLOR }}>
                    Torna indietro
                </Button>
            </View>
        );
    }

    if (invalidId) {
        return <View style={{ flex: 1 }} />;
    }

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor }]}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={[styles.loadingText, { color: textColor, marginTop: 16 }]}>Caricamento segnalazione...</Text>
            </View>
        );
    }

    if (!segn) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor }]}>
                <Text style={[styles.loadingText, { color: textColor }]}>Segnalazione non trovata</Text>
                <Button mode="contained" onPress={() => router.push('/(tabs)/segnalazioni')} style={{ marginTop: 12, backgroundColor: PRIMARY_COLOR }}>
                    Torna indietro
                </Button>
            </View>
        );
    }

    // Funzione per formattare le date in modo sicuro
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

    // Funzione per validare e convertire stringhe di data (per web datepicker)
    const validateAndParseWebDate = (dateString: string) => {
        try {
            // Verifica la format YYYY-MM-DD
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                throw new Error('Formato data non valido');
            }

            const parts = dateString.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-based in JavaScript
            const day = parseInt(parts[2], 10);

            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                throw new Error('Componenti data non validi');
            }

            const date = new Date(year, month, day);

            // Verifica validità data
            if (isNaN(date.getTime())) {
                throw new Error('Data risultante non valida');
            }

            return date;
        } catch (error) {
            console.error('Errore nel parsing della data web:', error);
            return new Date(); // Fallback alla data corrente
        }
    };

    // Formattatore per input date in locale
    // Restituisce "YYYY-MM-DD" usando il fuso locale
    function formatLocalDateForInput(d: Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    // Funzione per incrementare la data del numero di giorni specificato
    const incrementDate = (days: number) => {
        try {
            // Verifica che shelflife sia un oggetto Date valido
            if (shelflife && !isNaN(shelflife.getTime())) {
                // Crea una nuova data basata su shelflife per evitare mutazioni
                const newDate = new Date(shelflife);
                // Usa setDate che gestisce automaticamente il cambio di mese/anno
                newDate.setDate(newDate.getDate() + days);

                // Verifica che la nuova data sia valida
                if (!isNaN(newDate.getTime())) {
                    console.log(`Data incrementata di ${days} giorni:`, newDate);
                    setShelflife(newDate);
                    validateField('shelflife', newDate);
                    return;
                }
            }

            // Fallback in caso di errore: usa la data di oggi + incremento
            console.warn('Utilizzo data fallback per incrementDate');
            const today = new Date();
            today.setDate(today.getDate() + days);
            setShelflife(today);
            validateField('shelflife', today);
        } catch (error) {
            console.error('Errore nell\'incremento della data:', error);
            // Fallback in caso di errore: usa la data di oggi
            const today = new Date();
            today.setDate(today.getDate() + days);
            setShelflife(today);
            validateField('shelflife', today);
        }
    };

    // --- RENDER COMPONENT ---
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: isDark ? '#181A20' : '#f5f5f5' }]}
        >
            {/* Appbar con titolo e pulsante indietro */}
            <Appbar.Header style={{ backgroundColor: isDark ? '#181A20' : '#fff' }}>
                <Appbar.BackAction onPress={() => router.back()} color={isDark ? '#fff' : '#000'} />
                <Appbar.Content title="Revisione Segnalazione" titleStyle={{ color: isDark ? '#fff' : '#000' }} />
            </Appbar.Header>

            {/* Contenuto scrollabile */}
            <ScrollView style={[styles.container, { backgroundColor: isDark ? '#181A20' : '#f5f5f5' }]}>

                {/* Form principale */}
                <Card style={[styles.formCard, { backgroundColor: isDark ? '#23262F' : '#fff' }]}>
                    <Card.Title title="Dati del Prodotto" titleStyle={{ color: isDark ? '#fff' : '#000', fontWeight: 'bold' }} />
                    <Card.Content>

                        {/* Campo per il nome del prodotto da segnalare */}
                        <TextInput
                            label="Nome del prodotto"
                            value={nome}
                            onChangeText={(text) => {
                                setNome(text);
                                validateField('nome', text);
                            }}
                            style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
                            error={errors.nome}
                            mode="outlined"
                            left={<TextInput.Icon icon="tag" color={PRIMARY_COLOR} />}
                            theme={{
                                colors: {
                                    text: isDark ? '#fff' : '#000',
                                    placeholder: isDark ? '#b0b0b0' : undefined,
                                    onSurfaceVariant: isDark ? '#b0b0b0' : undefined,
                                    primary: PRIMARY_COLOR,
                                    background: isDark ? '#181A20' : '#fff',
                                    onSurface: isDark ? '#fff' : '#000',
                                },
                            }}
                            underlineColor={PRIMARY_COLOR}
                            selectionColor={PRIMARY_COLOR}
                            inputMode="text"
                            editable
                            autoCapitalize="sentences"
                        />
                        {errors.nome && <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                            Il nome è obbligatorio
                        </Text>}

                        {/* PREVIEW IMMAGINI (solo lettura) */}
                        {(images.length > 0) && (
                            <View style={styles.imageGrid}>
                                {images.map((uri, i) => (
                                    <View key={i} style={styles.imageItem}>
                                        <Pressable
                                            onPress={() => { setActiveIndex(i); setModalVisible(true); }}
                                            style={styles.imageWrapper}
                                        >
                                            <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Campo descrizione */}
                        <TextInput
                            label="Descrizione"
                            value={descrizione}
                            onChangeText={(text) => {
                                const v = text.slice(0, 400);      // difensivo: tronca eventuali incolla >400
                                setDescrizione(v);
                                validateField('descrizione', v);
                            }}
                            onBlur={() => validateField('descrizione', descrizione)}
                            style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
                            mode="outlined"
                            multiline
                            numberOfLines={3}
                            left={<TextInput.Icon icon="text" color={PRIMARY_COLOR} />}
                            right={<TextInput.Affix text={`${(descrizione?.length ?? 0)}/400`} />}
                            error={!!errors.descrizione}
                            activeOutlineColor={errors.descrizione ? '#F44336' : PRIMARY_COLOR}
                            theme={{
                                colors: {
                                    text: isDark ? '#fff' : '#000',
                                    placeholder: isDark ? '#b0b0b0' : undefined,
                                    onSurfaceVariant: isDark ? '#b0b0b0' : undefined,
                                    primary: PRIMARY_COLOR,
                                    background: isDark ? '#181A20' : '#fff',
                                    onSurface: isDark ? '#fff' : '#000',
                                },
                            }}
                            selectionColor={PRIMARY_COLOR}
                            inputMode="text"
                            editable
                            maxLength={400}
                        />

                        {/* Campo quantità */}
                        <View style={styles.row}>
                            <TextInput
                                label="Quantità"
                                value={quantita}
                                onChangeText={(text) => {
                                    setQuantita(text);
                                    validateField('quantita', text);
                                }}
                                keyboardType="numeric"
                                style={[styles.input, styles.flex1, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
                                error={errors.quantita}
                                mode="outlined"
                                left={<TextInput.Icon icon="scale" color={PRIMARY_COLOR} />}
                                theme={{
                                    colors: {
                                        text: isDark ? '#fff' : '#000',
                                        placeholder: isDark ? '#b0b0b0' : undefined,
                                        onSurfaceVariant: isDark ? '#b0b0b0' : undefined,
                                        primary: PRIMARY_COLOR,
                                        background: isDark ? '#181A20' : '#fff',
                                        onSurface: isDark ? '#fff' : '#000',
                                    },
                                }}
                                underlineColor={PRIMARY_COLOR}
                                selectionColor={PRIMARY_COLOR}
                                inputMode="decimal"
                                editable
                            />

                            <Pressable
                                style={styles.unitSelector}
                                onPress={() => setShowUnitaPicker(true)}
                            >
                                <Surface style={[styles.unitDisplay, { borderColor: PRIMARY_COLOR, backgroundColor: isDark ? '#23262F' : '#fff' }]}>
                                    <Text style={[styles.unitText, { color: isDark ? '#fff' : PRIMARY_COLOR }]}>{unitaMisura}</Text>
                                    <MaterialCommunityIcons name="chevron-down" size={20} color={PRIMARY_COLOR} />
                                </Surface>
                            </Pressable>
                        </View>
                        {errors.quantita && <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                            Inserisci una quantità valida
                        </Text>}

                        {/* Campo Prezzo */}
                        <TextInput
                            label="Prezzo (€)"
                            value={prezzo}
                            onChangeText={(text) => {
                                setPrezzo(text);
                                validateField('prezzo', text);
                            }}
                            keyboardType="numeric"
                            style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
                            error={errors.prezzo}
                            mode="outlined"
                            left={<TextInput.Icon icon="currency-eur" color={PRIMARY_COLOR} />}
                            placeholder="(opzionale)"
                            theme={{
                                colors: {
                                    text: isDark ? '#fff' : '#000',
                                    placeholder: isDark ? '#b0b0b0' : undefined,
                                    onSurfaceVariant: isDark ? '#b0b0b0' : undefined,
                                    primary: PRIMARY_COLOR,
                                    background: isDark ? '#181A20' : '#fff',
                                    onSurface: isDark ? '#fff' : '#000',
                                },
                            }}
                            underlineColor={PRIMARY_COLOR}
                            selectionColor={PRIMARY_COLOR}
                            placeholderTextColor={isDark ? '#b0b0b0' : undefined}
                            inputMode="decimal"
                        />
                        {errors.prezzo && <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                            Il prezzo deve essere un numero positivo o vuoto
                        </Text>}

                        {/* Campo indirizzo del centro */}
                        <TextInput
                            label="Indirizzo del centro"
                            value={indirizzoCentro}
                            onChangeText={(text) => {
                                setIndirizzoCentro(text);
                                validateField('indirizzoCentro', text);
                            }}
                            style={[styles.input, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
                            error={errors.indirizzoCentro}
                            mode="outlined"
                            left={<TextInput.Icon icon="map-marker" color={PRIMARY_COLOR} />}
                            theme={{
                                colors: {
                                    text: isDark ? '#fff' : '#000',
                                    placeholder: isDark ? '#b0b0b0' : undefined,
                                    onSurfaceVariant: isDark ? '#b0b0b0' : undefined,
                                    primary: PRIMARY_COLOR,
                                    background: isDark ? '#181A20' : '#fff',
                                    onSurface: isDark ? '#fff' : '#000',
                                },
                            }}
                            underlineColor={PRIMARY_COLOR}
                            selectionColor={PRIMARY_COLOR}
                            inputMode="text"
                        />
                        {errors.indirizzoCentro && <Text style={{ color: '#F44336', marginBottom: 8, textAlign: 'center' }}>
                            L'indirizzo è obbligatorio.
                        </Text>}
                    </Card.Content>
                </Card>

                {/* Campo Shelf-Life */}
                <Card style={[styles.formCard, { backgroundColor: isDark ? '#23262F' : '#fff' }]}>
                    <Card.Title title="Shelf-Life" titleStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }} />
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
                            <Surface style={[styles.dateSurface, { backgroundColor: isDark ? '#181A20' : '#fff', borderColor: PRIMARY_COLOR }, errors.shelflife && styles.dateError]}>
                                <Ionicons name="calendar" size={24} color={PRIMARY_COLOR} style={styles.dateIcon} />
                                <View style={styles.dateTextContainer}>
                                    <Text style={[styles.dateValue, { color: isDark ? '#fff' : PRIMARY_COLOR }]}>{formatDate(shelflife)}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={24} color={PRIMARY_COLOR} />
                            </Surface>
                        </Pressable>
                        <Text style={[styles.infoText, { color: isDark ? '#b0b0b0' : '#666' }]}>
                            Inserire una stima della "scadenza" del prodotto sulla base delle foto e informazioni.
                        </Text>
                    </Card.Content>
                </Card>

            </ScrollView>

            {/* Footer azioni */}
            <View style={[styles.footer, { backgroundColor: isDark ? '#23262F' : '#fff', borderTopColor: isDark ? '#23262F' : '#e0e0e0' }]}>
                <Button
                    mode="contained"
                    onPress={() => setShowRejectDialog(true)}
                    style={[styles.button, { backgroundColor: '#F44336' }]}
                    icon="close"
                    labelStyle={{ color: isDark ? '#000' : '#fff', fontWeight: 'bold' }}
                >
                    Rifiuta segnalazione
                </Button>
                <Button
                    mode="contained"
                    onPress={() => setShowPublishConfirm(true)}
                    style={[styles.button, { backgroundColor: PRIMARY_COLOR }]}
                    icon="check"
                    disabled={busyPublish}
                    labelStyle={{ color: isDark ? '#181A20' : '#fff', fontWeight: 'bold' as const }}
                >
                    Pubblica come Lotto
                </Button>
            </View>

            {/* Dialog conferma "Pubblica come Lotto" */}
            <Portal>
                <Dialog visible={showPublishConfirm} onDismiss={() => setShowPublishConfirm(false)}>
                    <Dialog.Title style={{ color: isDark ? '#fff' : '#181A20' }}>Pubblica come Lotto</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph style={{ color: isDark ? '#fff' : '#181A20' }} >Confermi la pubblicazione come lotto di questa segnalazione?</Paragraph>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button
                            onPress={() => setShowPublishConfirm(false)} disabled={busyPublish}
                            style={{ borderColor: PRIMARY_COLOR }}
                            buttonColor='rgba(0,151,74,0.12)'
                        >
                            Indietro
                        </Button>
                        <Button
                            mode="contained"
                            onPress={handleConfermaPubblicaComeLotto}
                            loading={busyPublish}
                            disabled={busyPublish}
                        >
                            Conferma
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <Portal>
                <Dialog visible={showRejectDialog} onDismiss={() => setShowRejectDialog(false)}>
                    <Dialog.Title style={{ color: isDark ? '#fff' : '#181A20' }}>Rifiuta segnalazione</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph style={{ color: isDark ? '#fff' : '#181A20' }}>Inserire una motivazione per il rifiuto:</Paragraph>
                        <TextInput
                            mode="outlined"
                            placeholder="(obbligatoria)"
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            multiline
                            numberOfLines={3}
                            style={[{ marginTop: 12 }, { backgroundColor: isDark ? '#181A20' : '#fff' }]}
                            theme={{
                                colors: {
                                    text: isDark ? '#fff' : '#000',
                                    placeholder: isDark ? '#b0b0b0' : undefined,
                                    onSurfaceVariant: isDark ? '#b0b0b0' : undefined,
                                    primary: PRIMARY_COLOR,
                                    background: isDark ? '#181A20' : '#fff',
                                    onSurface: isDark ? '#fff' : '#000',
                                },
                            }}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button
                            onPress={() => setShowRejectDialog(false)} disabled={busyReject}
                            style={{ borderColor: PRIMARY_COLOR }}
                            buttonColor='rgba(0,151,74,0.12)'
                        >
                            Indietro
                        </Button>
                        <Button
                            mode="contained"
                            onPress={handleConfermaRifiuta}
                            loading={busyReject}
                            disabled={busyReject}
                        >
                            Conferma
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            {/* Modal fullscreen per visualizzare immagini */}
            <RNModal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <Image source={{ uri: selectedImage || '' }} style={styles.fullscreenImage} resizeMode="contain" />
                    {activeIndex > 0 && (
                        <TouchableOpacity
                            onPress={() => setActiveIndex(activeIndex - 1)}
                            style={[styles.navButton, styles.navLeft]}
                        >
                            <MaterialCommunityIcons name="chevron-left" size={32} color="#fff" />
                        </TouchableOpacity>
                    )}
                    {activeIndex < images.length - 1 && (
                        <TouchableOpacity
                            onPress={() => setActiveIndex(activeIndex + 1)}
                            style={[styles.navButton, styles.navRight]}
                        >
                            <MaterialCommunityIcons name="chevron-right" size={32} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <Button icon="close" mode="contained" onPress={() => setModalVisible(false)} style={styles.closeButton}>
                        Chiudi
                    </Button>
                </View>
            </RNModal>

            {/* Modal per selezionare l'unità di misura */}
            <Portal>
                <Modal
                    visible={showUnitaPicker}
                    onDismiss={() => setShowUnitaPicker(false)}
                    contentContainerStyle={styles.modalContainer}
                >
                    <Surface style={[styles.modalContent, { backgroundColor: isDark ? '#23262F' : '#fff', maxHeight: '95%', minHeight: 320, justifyContent: 'space-between' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : undefined }]}>Seleziona unità di misura</Text>
                        </View>
                        <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />
                        <ScrollView style={styles.modalScroll}>
                            {Object.entries(UNITA_MISURA_GROUPS).map(([group, units]) => (
                                <View key={group}>
                                    <Text style={[styles.modalGroup, { color: isDark ? '#b0b0b0' : '#666', backgroundColor: isDark ? '#181A20' : '#f5f5f5' }]}>{group}</Text>
                                    {units.map(unit => (
                                        <List.Item
                                            key={unit}
                                            title={unit}
                                            titleStyle={{ color: isDark ? '#fff' : PRIMARY_COLOR, fontWeight: unit === unitaMisura ? 'bold' as const : undefined }}
                                            onPress={() => {
                                                setUnitaMisura(unit);
                                                setShowUnitaPicker(false);
                                            }}
                                            left={props => <List.Icon {...props} icon={
                                                unit === unitaMisura ? "check-circle" : "circle-outline"
                                            } color={PRIMARY_COLOR} />}
                                            style={unit === unitaMisura ? [styles.selectedItem, { backgroundColor: isDark ? '#263238' : '#e8f5e9' }] : undefined}
                                        />
                                    ))}
                                </View>
                            ))}
                        </ScrollView>
                        <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />
                        <View style={styles.modalFooter}>
                            <Button
                                mode="text"
                                onPress={() => setShowUnitaPicker(false)}
                                labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}
                            >
                                Chiudi
                            </Button>
                        </View>
                    </Surface>
                </Modal>
            </Portal>

            {/* Modale per il selettore di data */}
            <Portal>
                <Modal
                    visible={showDatePicker}
                    onDismiss={() => setShowDatePicker(false)}
                    contentContainerStyle={styles.modalContainer}
                >
                    <Surface style={[styles.modalContent, { backgroundColor: isDark ? '#23262F' : '#fff', maxHeight: 480, minHeight: 320, justifyContent: 'space-between' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : undefined }]}>Seleziona una data di shelf-life</Text>
                        </View>
                        <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />
                        <View style={[styles.datePickerContainer, { flex: 1, minHeight: 180, justifyContent: 'flex-start' }]}>
                            {Platform.OS === 'web' ? (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <label htmlFor="shelflifeWeb" style={{ color: isDark ? '#fff' : '#000', fontWeight: 'bold', marginBottom: 8, alignSelf: 'flex-start' }}>

                                    </label>
                                    <input
                                        id="shelflifeWeb"
                                        type="date"
                                        style={{
                                            border: `1px solid ${errors.shelflife ? '#B00020' : (isDark ? '#333' : '#ccc')}`,
                                            borderRadius: 4,
                                            padding: 12,
                                            fontSize: 16,
                                            width: '75%',
                                            display: 'block',
                                            marginLeft: 'auto',
                                            marginRight: 'auto',
                                            background: isDark ? PRIMARY_COLOR : '#fff',
                                            color: isDark ? '#fff' : '#000',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            height: 48,
                                            minHeight: 48,
                                            maxHeight: 48,
                                            marginBottom: 8,
                                        }}
                                        // PRIMA: min={new Date().toISOString().split('T')[0]}
                                        min={formatLocalDateForInput(new Date())}
                                        // PRIMA: value={shelflife?.toISOString().split('T')[0]}
                                        value={shelflife ? formatLocalDateForInput(shelflife) : ''}
                                        onChange={(e) => {
                                            try {
                                                console.log('Input web datestring:', e.target.value);
                                                if (e.target.value) {
                                                    const date = validateAndParseWebDate(e.target.value);
                                                    setShelflife(date);
                                                    validateField('shelflife', date);
                                                }
                                            } catch (error) {
                                                console.error('Errore nel date picker web:', error);
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <View style={styles.dateButtonsContainer}>
                                    <Text style={[styles.dateSelectionText, { color: isDark ? '#fff' : undefined }]}>
                                        Data selezionata: {formatDate(shelflife || new Date())}
                                    </Text>
                                    <View style={styles.dateButtonsRow}>
                                        <Button
                                            mode="outlined"
                                            icon="arrow-left"
                                            onPress={() => incrementDate(-1)}
                                            style={styles.dateButton}
                                            labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}
                                        >
                                            -1 giorno
                                        </Button>
                                        <Button
                                            mode="outlined"
                                            icon="calendar-today"
                                            onPress={() => {
                                                setShelflife(new Date());
                                                validateField('shelflife', new Date());
                                            }}
                                            style={styles.dateButton}
                                            labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}
                                        >
                                            Oggi
                                        </Button>
                                        <Button
                                            mode="outlined"
                                            icon="arrow-right"
                                            onPress={() => incrementDate(1)}
                                            style={styles.dateButton}
                                            labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}
                                        >
                                            +1 giorno
                                        </Button>
                                    </View>
                                    <View style={styles.dateButtonsRow}>
                                        <Button
                                            mode="outlined"
                                            onPress={() => incrementDate(7)}
                                            style={styles.dateButton}
                                            labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}
                                        >
                                            +1 settimana
                                        </Button>
                                        <Button
                                            mode="outlined"
                                            onPress={() => incrementDate(30)}
                                            style={styles.dateButton}
                                            labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}
                                        >
                                            +1 mese
                                        </Button>
                                    </View>
                                    <Button
                                        mode="contained"
                                        icon="calendar"
                                        onPress={() => setShowNativeCalendar(true)}
                                        style={[styles.nativeCalendarButton, { backgroundColor: PRIMARY_COLOR }]}
                                        labelStyle={{ color: isDark ? '#181A20' : '#fff', fontWeight: 'bold' as const }}
                                    >
                                        Apri calendario
                                    </Button>
                                </View>
                            )}
                        </View>
                        <Divider style={{ backgroundColor: isDark ? '#444' : undefined }} />
                        <View style={[styles.modalFooter, { paddingBottom: 16, paddingTop: 8, backgroundColor: 'transparent', justifyContent: 'flex-end', flexGrow: 0, flexShrink: 0 }]}>
                            <Button
                                mode="text"
                                onPress={() => setShowDatePicker(false)}
                                labelStyle={{ color: PRIMARY_COLOR, fontWeight: 'bold' as const }}
                                style={{ marginRight: 8 }}
                            >
                                Chiudi
                            </Button>
                            <Button
                                mode="contained"
                                onPress={() => setShowDatePicker(false)}
                                style={{ backgroundColor: PRIMARY_COLOR }}
                                labelStyle={{ color: isDark ? '#181A20' : '#fff', fontWeight: 'bold' as const }}
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
                    date={(shelflife && !isNaN(shelflife.getTime()) ? shelflife : addDays(new Date(), 1)) || addDays(new Date(), 1)}
                    onDismiss={() => setShowNativeCalendar(false)}
                    onConfirm={({ date }) => {
                        if (date) {
                            const normalized = new Date(date.setHours(0, 0, 0, 0));
                            setShelflife(normalized);
                            validateField('shelflife', normalized);
                        }
                        setShowNativeCalendar(false);
                        setShowDatePicker(false);
                    }}
                    validRange={{ startDate: new Date() }}
                    saveLabel="Conferma"
                    label="Seleziona data di shelf-life"
                />
            )}
        </KeyboardAvoidingView>
    );
};

export default NuovaSegnalazioneScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    formCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        elevation: 2,
        borderRadius: 8,
    },
    infoCard: {
        margin: 16,
        padding: 16,
        borderRadius: 8,
        elevation: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoIcon: {
        marginRight: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
    },
    input: {
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    dateSelector: {
        marginBottom: 16,
    },
    dateSurface: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        backgroundColor: '#fff',
    },
    dateIcon: {
        marginRight: 12,
    },
    dateTextContainer: {
        flex: 1,
    },
    dateLabel: {
        fontSize: 12,
        color: '#666',
    },
    dateValue: {
        fontSize: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    button: {
        flex: 1,
        marginHorizontal: 4,
    },
    buttonContent: {
        paddingVertical: 8,
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 16,
    },
    previewImage: {
        width: 200,
        height: 200,
        borderRadius: 8,
        backgroundColor: '#ccc',
    },
    imageItem: {
        alignItems: 'center',
        marginBottom: 12,
        marginHorizontal: 5,
    },
    imageWrapper: {
        borderRadius: 8,
        overflow: 'hidden',
        marginRight: 10,
        marginBottom: 10,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transitionDuration: '200ms',
            },
        }),
    },
    imageHovered: {
        ...Platform.select({
            web: {
                transform: [{ scale: 1.05 }],
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
            },
        }),
    },
    removeButton: {
        marginTop: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#F44336',
        borderRadius: 6,
    },
    removeButtonText: {
        color: '#fff',
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    fullscreenImage: {
        width: '100%',
        height: '80%',
        borderRadius: 8,
    },
    closeButton: {
        marginTop: 16,
        backgroundColor: '#F44336',
    },
    navButton: {
        position: 'absolute',
        top: '50%',
        transform: [{ translateY: -16 }],
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 30,
        zIndex: 20,
    },
    navLeft: {
        left: 16,
    },
    navRight: {
        right: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    } as any,
    flex1: {
        flex: 1,
    } as any,
    unitSelector: {
        marginLeft: 8,
        alignSelf: 'flex-end',
        marginBottom: 16,
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
    modalContainer: {
        margin: 20,
        borderRadius: 8,
        overflow: 'hidden',
    } as any,
    modalContent: {
        backgroundColor: '#fff',
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
        maxHeight: 300,
    } as any,
    modalGroup: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#666',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        backgroundColor: '#f5f5f5',
    } as any,
    selectedItem: {
        backgroundColor: '#e8f5e9',
    } as any,
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 8,
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: 'transparent',
        minHeight: 56,
    } as any,
    primaryButton: {
        backgroundColor: PRIMARY_COLOR,
    } as any,
    dateError: {
        borderColor: '#B00020',
    } as any,
    datePickerContainer: {
        padding: 16,
        flexGrow: 1,
        minHeight: 180,
        justifyContent: 'flex-start',
    } as any,
    dateButtonsContainer: {
        padding: 16,
        alignItems: 'center',
    } as any,
    dateSelectionText: {
        fontSize: 16,
        marginBottom: 16,
    } as any,
    dateButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        width: '100%',
    } as any,
    dateButton: {
        flex: 1,
        marginHorizontal: 4,
    } as any,
    nativeCalendarButton: {
        marginTop: 12,
        alignSelf: 'flex-start',
    } as any,
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16
    },
});
