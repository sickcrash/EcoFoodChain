// refood-mobile/app/segnalazioni/dettaglio/[id].tsx
import React, { useEffect, useMemo, useState, useContext } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Modal as RNModal,
} from 'react-native';
import {
    Appbar,
    Card,
    Chip,
    Divider,
    Portal,
    Text,
    Button,
    Surface,
    Dialog,
    Paragraph,

} from 'react-native-paper';
import { router } from 'expo-router';
import { useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PRIMARY_COLOR } from '../../../src/config/constants';
import { getSegnalazioneById, SegnalazioneResponse , deleteSegnalazione } from '../../../src/services/segnalazioniService';
import { api } from '../../../src/api/api';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/src/context/AuthContext';
import { ThemeContext } from '../../../src/context/ThemeContext';

const THUMB_SIZE = 200; // come nel form

type ThemeContextType = { isDarkMode?: boolean };

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
        // Supporta 'YYYY-MM-DD' o 'YYYY-MM-DD HH:mm:ss'
        const [d] = dateStr.split(' ');
        const [y, m, dd] = d.split('-').map(Number);
        const date = new Date(y, (m || 1) - 1, dd || 1);
        if (isNaN(date.getTime())) return '—';
        return format(date, 'dd/MM/yyyy', { locale: it });
    } catch {
        return '—';
    }
};

function formatUtcToLocal(ts?: string | null) {
    if (!ts) return '—';
    const iso = ts.includes('T')
        ? (ts.endsWith('Z') ? ts : ts + 'Z')
        : ts.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('it-IT', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(d);
}

const euro = (n?: number | null) =>
    (n === null || n === undefined) ? '—' : `${Number(n).toFixed(2)} €`;

const statoStyle = (stato?: SegnalazioneResponse['stato']) => {
    // stessi colori della lista: inviata=blu, in_lavorazione=arancione, chiusa=rosso
    switch (stato) {
        case 'in_lavorazione':
            return { color: '#FB8C00', bg: 'rgba(251,140,0,0.12)', label: 'In lavorazione' };
        case 'chiusa':
            return { color: '#E53935', bg: 'rgba(229,57,53,0.12)', label: 'Chiusa' };
        case 'inviata':
        default:
            return { color: '#1E88E5', bg: 'rgba(30,136,229,0.12)', label: 'Inviata' };
    }
};

const esitoStyle = (esito?: SegnalazioneResponse['esito']) => {
    if (esito === 'approvata') return { color: PRIMARY_COLOR, bg: 'rgba(0,151,74,0.12)', label: 'Approvata' };
    if (esito === 'rifiutata') return { color: '#E53935', bg: 'rgba(229,57,53,0.12)', label: 'Rifiutata' };
    return { color: '#FB8C00', bg: 'rgba(251,140,0,0.12)', label: 'In attesa' };
};

// Origin robusto per caricare le immagini su device/emulatore e web
const API_ORIGIN = (() => {
    // 1) prova da axios baseURL assoluta
    try {
        const base = (api as any)?.defaults?.baseURL || '';
        if (base.startsWith('http')) {
            const u = new URL(base);
            return `${u.protocol}//${u.host}`;
        }
    } catch { }

    // 2) Expo: ricava host LAN dal packager (es. 192.168.x.x)
    try {
        const hostUri: string | undefined =
            // SDK nuovi
            (Constants as any)?.expoConfig?.hostUri ||
            // compatibilità SDK precedenti
            (Constants as any)?.manifest?.debuggerHost;

        if (hostUri) {
            const host = hostUri.split(':')[0];
            // ⚠️ Porta del tuo backend (3000). Cambiala se diversa.
            return `http://${host}:3000`;
        }
    } catch { }

    // 3) Web fallback
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }

    return '';
})();

const absUrl = (p: string) => (p?.startsWith('http') ? p : `${API_ORIGIN}${p}`);

export default function DettaglioSegnalazioneScreen() {
    const themeContext = useContext(ThemeContext) as ThemeContextType;
    const isDarkMode = !!themeContext?.isDarkMode;

    const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
    const cardBg = isDarkMode ? '#1e1e1e' : '#fff';
    const textColor = isDarkMode ? '#fff' : '#000';
    const dividerColor = isDarkMode ? '#333' : '#e0e0e0';
    const iconColor = isDarkMode ? PRIMARY_COLOR : '#616161';

    const route = useRoute<any>();
    const id = Number(route?.params?.id);
    const { user } = useAuth();

    const userRole = user?.ruolo;
    const userId = user?.id;

    const [loading, setLoading] = useState(true);
    const [segn, setSegn] = useState<SegnalazioneResponse | null>(null);

    //Bottone elimina
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [busyDelete, setBusyDelete] = useState(false);

    // Modal immagini
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const stato = useMemo(() => statoStyle(segn?.stato), [segn?.stato]);
    const esito = useMemo(() => esitoStyle(segn?.esito), [segn?.esito]);
    const canDelete = segn?.stato === 'chiusa' && userRole === 'OperatoreCentro' && userId === segn?.creato_da;

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const data = await getSegnalazioneById(Number(id));
                setSegn(data);
                console.log('[SEGN DETTAGLIO] images:', data?.images);
                if (data?.images?.length) {
                    console.log('[SEGN DETTAGLIO] example URL:', absUrl(data.images[0].url));
                }
            } catch (e) {
                console.error('Errore caricamento segnalazione:', e);
                router.back();
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const autoreInfo = segn?.creato_da_info;
    const creatorLabel =
        [autoreInfo?.nome ?? '', autoreInfo?.cognome ?? '']
            .map(s => s.trim())
            .filter(Boolean)
            .join(' ')
        || `Operatore #${segn?.creato_da}`;

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor }]}>
                <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                <Text style={[styles.loadingText, { color: textColor }]}>Caricamento...</Text>
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


    const DANGER = '#F44336';
    const SUCCESS = '#4CAF50';
    const INFO = '#FB8C00';

    const esitoIcon = (props: { size: number; color: string }) => {
        if (segn.esito === 'approvata') {
            return <MaterialCommunityIcons name="check-circle-outline" size={props.size} color={SUCCESS} />;
        }
        if (segn.esito === 'rifiutata') {
            return <MaterialCommunityIcons name="close-circle-outline" size={props.size} color={DANGER} />;
        }
        return <MaterialCommunityIcons name="progress-clock" size={props.size} color={INFO} />;
    };

    // Helper: riga "Icona + Label: Valore" inline
    const FieldInline = ({
        icon,
        label,
        value,
    }: { icon: any; label: string; value: React.ReactNode }) => (
        <View style={styles.inlineRow}>
            <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
            <Text style={[styles.inlineText, { color: textColor }]}>
                <Text style={[styles.inlineLabel, { color: textColor }]}>{label}:</Text> {value}
            </Text>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <Appbar.Header style={{ backgroundColor: cardBg }}>
                <Appbar.BackAction onPress={() => router.back()} color={textColor} />
                <Appbar.Content title="Dettaglio Segnalazione" color={textColor} />
            </Appbar.Header>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {segn.esito === "approvata" && segn.stato === "chiusa" && (
                    <Surface style={[styles.infoCard, { backgroundColor: isDarkMode ? '#23262F' : '#e3f2fd' }]}>
                        <MaterialCommunityIcons
                            name="information"
                            size={24}
                            color={isDarkMode ? PRIMARY_COLOR : '#388e3c'}
                            style={styles.infoIcon}
                        />
                        <Text style={[styles.infoCardText, { color: isDarkMode ? PRIMARY_COLOR : '#388e3c' }]}>
                            Eventuali modifiche fatte ai dati inseriti nella segnalazione prima di essere pubblicata come lotto
                            sono riportate in automatico di seguito.
                        </Text>
                    </Surface>
                )}
                <Card style={[styles.card, { backgroundColor: cardBg, borderColor: dividerColor, borderWidth: 1 }]}>
                    <Card.Content>
                        {/* Header: titolo + stato */}

                        {/* Stato */}
                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <MaterialCommunityIcons name="flag-outline" size={20} color={iconColor} />
                                <Text style={[styles.label, styles.labelWithIcon, { color: textColor }]}>
                                    Stato
                                </Text>
                            </View >
                            <View style={styles.statusContainer}>
                                <Chip
                                    style={[styles.statusChip, { backgroundColor: stato.bg }]}
                                    textStyle={[styles.statusChipText, { color: stato.color }]}
                                >
                                    {stato.label}
                                </Chip>
                            </View>
                        </View>
                        <Divider style={[styles.divider, { backgroundColor: dividerColor }]} />

                        {/* Nome */}
                        <FieldInline
                            icon="tag-outline"
                            label="Nome"
                            value={segn.nome || '—'}
                        />

                        {/* Descrizione */}
                        {(segn.descrizione?.trim()?.length ?? 0) > 0 && (
                            <Text style={[styles.esitoMsg, { color: textColor }]}>
                                {segn.descrizione}
                            </Text>
                        )}


                        <Divider style={[styles.divider, { backgroundColor: dividerColor }]} />

                        {/* Immagini */}
                        {segn.images?.length ? (
                            <>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <MaterialCommunityIcons name="image-multiple-outline" size={20} color={iconColor} />
                                    <Text style={[styles.sectionTitle, { marginLeft: 8, color: textColor }]}>
                                        Immagini
                                    </Text>
                                </View>

                                <View style={styles.imageGrid}>
                                    {segn.images.map((img, idx) => (
                                        <TouchableOpacity
                                            key={img.id}
                                            onPress={() => {
                                                setActiveIndex(idx);
                                                setSelectedImage(absUrl(img.url));
                                                setModalVisible(true);
                                            }}
                                            style={styles.imageItem}
                                            activeOpacity={0.85}
                                        >
                                            <Image source={{ uri: absUrl(img.url) }} style={styles.imageThumb} />
                                        </TouchableOpacity>

                                    ))}
                                </View>
                                <Divider style={[styles.divider, { backgroundColor: dividerColor }]} />
                            </>
                        ) : null}

                        {/* Info principali */}
                        {/* Quantità */}
                        <FieldInline
                            icon="scale"
                            label="Quantità"
                            value={`${segn.quantita} ${segn.unita_misura}`}
                        />

                        {/* Prezzo */}
                        <FieldInline
                            icon="cash"
                            label="Prezzo"
                            value={euro(segn.prezzo)}
                        />

                        {/* Shelf-Life */}
                        <FieldInline
                            icon="calendar"
                            label="Shelf-Life"
                            value={formatDate(segn.shelflife)}
                        />

                        {/* Indirizzo */}
                        <FieldInline
                            icon="map-marker"
                            label="Indirizzo"
                            value={segn.indirizzo_centro || '—'}
                        />

                        <Divider style={[styles.divider, { backgroundColor: dividerColor }]} />

                        {/* Autore + date */}
                        {/* Creato da */}
                        <FieldInline
                            icon="account"
                            label="Creato da"
                            value={creatorLabel}
                        />

                        {/* Creato il */}
                        <FieldInline
                            icon="clock-outline"
                            label="Creato il"
                            value={formatUtcToLocal(segn.creato_il)}
                        />

                        {/* Ultimo aggiornamento */}
                        <FieldInline
                            icon="history"
                            label="Ultimo aggiornamento"
                            value={formatUtcToLocal(segn.aggiornato_il)}
                        />


                        <Divider style={[styles.divider, { backgroundColor: dividerColor }]} />

                        <View style={styles.row}>
                            <View style={styles.rowLeft}>
                                <MaterialCommunityIcons name="check-decagram-outline" size={20} color={iconColor} />
                                <Text style={[styles.label, styles.labelWithIcon, { color: textColor }]}>
                                    Esito
                                </Text>
                            </View>
                            <View style={styles.statusContainer}>
                                <Chip
                                    icon={esitoIcon}
                                    style={[styles.statusChip, { backgroundColor: esito.bg }]}
                                    textStyle={[styles.statusChipText, { color: esito.color }]}
                                >
                                    {esito.label}
                                </Chip>
                            </View>
                        </View>
                        <Text style={[styles.esitoMsg, { color: textColor }]}>
                            {segnoEsitoHelpText(segn)}
                        </Text>
                    </Card.Content>
                </Card>

                {canDelete && (
                    <View style={{ padding: 16 }}>
                        <Button
                            mode="contained"
                            icon="delete-outline"
                            onPress={() => setShowDeleteConfirm(true)}
                            disabled={busyDelete}
                            style={{ backgroundColor: '#F44336' }}
                            contentStyle={{ height: 48 }}
                            labelStyle={{ color: isDarkMode ? '#181A20' : '#fff', fontWeight: '700' }}
                        >
                            {busyDelete ? 'Eliminazione…' : 'Elimina segnalazione'}
                        </Button>
                    </View>
                )}

            </ScrollView>

            {/* Modal fullscreen per visualizzare immagini (stile form nuova.tsx) */}
            <RNModal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Image
                        source={{ uri: selectedImage || '' }}
                        style={styles.fullscreenImage}
                        resizeMode="contain"
                    />

                    {/* Navigazione sinistra/destra */}
                    {activeIndex > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                const next = Math.max(activeIndex - 1, 0);
                                setActiveIndex(next);
                                setSelectedImage(absUrl(segn.images![next].url));
                            }}
                            style={[styles.navButton, styles.navLeft]}
                        >
                            <MaterialCommunityIcons name="chevron-left" size={32} color="#fff" />
                        </TouchableOpacity>
                    )}

                    {segn.images && activeIndex < segn.images.length - 1 && (
                        <TouchableOpacity
                            onPress={() => {
                                const next = Math.min(activeIndex + 1, (segn.images!.length - 1));
                                setActiveIndex(next);
                                setSelectedImage(absUrl(segn.images![next].url));
                            }}
                            style={[styles.navButton, styles.navRight]}
                        >
                            <MaterialCommunityIcons name="chevron-right" size={32} color="#fff" />
                        </TouchableOpacity>
                    )}

                    <Button
                        icon="close"
                        mode="contained"
                        onPress={() => setModalVisible(false)}
                        style={styles.closeButton}
                    >
                        Chiudi
                    </Button>
                </View>
            </RNModal>

            <Portal>
                <Dialog visible={showDeleteConfirm} onDismiss={() => (!busyDelete && setShowDeleteConfirm(false))}>
                    <Dialog.Title>Eliminare la segnalazione?</Dialog.Title>
                    <Dialog.Content>
                        <Paragraph>Questa azione è irreversibile.</Paragraph>
                    </Dialog.Content>
                    <Dialog.Actions>
                        {/* Indietro*/}
                        <Button
                            onPress={() => setShowDeleteConfirm(false)}
                            disabled={busyDelete}
                            textColor={DANGER}
                            labelStyle={{ color: DANGER, fontWeight: '600' }}
                        >
                            Indietro
                        </Button>

                        {/* Conferma*/}
                        <Button
                            mode="contained"
                            onPress={async () => {
                                try {
                                    setBusyDelete(true);
                                    await deleteSegnalazione(Number(id));
                                    Toast.show({
                                        type: 'success',
                                        text1: 'Segnalazione eliminata',
                                        text2: 'La segnalazione è stata rimossa con successo.',
                                    });
                                    setShowDeleteConfirm(false);
                                    router.replace('/(tabs)/segnalazioni');
                                } catch (e: any) {
                                    const msg = e?.response?.data?.message || e?.message || 'Errore durante l’eliminazione';
                                    Toast.show({ type: 'error', text1: 'Errore', text2: msg });
                                } finally {
                                    setBusyDelete(false);
                                }
                            }}
                            loading={busyDelete}
                            disabled={busyDelete}
                            style={{ backgroundColor: DANGER }}
                            labelStyle={{ color: '#fff', fontWeight: '700' }}
                        >
                            Conferma
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

        </View>
    );
}

function segnoEsitoHelpText(s: SegnalazioneResponse) {
    // Esito esplicito
    if (s.esito === 'rifiutata') {
        return s.messaggio_esito?.trim() || 'La segnalazione è stata rifiutata.';
    }
    if (s.esito === 'approvata') {
        // Messaggio standard quando promossa a lotto
        return s.messaggio_esito?.trim() || 'La segnalazione è stata approvata e pubblicata come nuovo lotto.';
    }

    // Esito in attesa (null) → messaggi in base allo stato
    if (s.stato === 'in_lavorazione') {
        return 'La segnalazione è in valutazione da parte di un amministratore.';
    }
    if (s.stato === 'inviata') {
        return 'La segnalazione è stata inviata e sarà revisionata presto da un amministratore.';
    }

    // Fallback (es. stato chiusa ma senza esito impostato)
    return 'La segnalazione è in attesa di esito.';
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32
    },
    card: {
        elevation: 2,
        borderRadius: 8,
        overflow: 'hidden'
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    description: {
        marginTop: 8,
        marginBottom: 12,
        fontSize: 14
    },
    divider: {
        marginVertical: 12
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 6
    },
    label: {
        fontSize: 14,
        fontWeight: '600'
    },
    value: {
        fontSize: 14
    },
    esitoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    esitoMsg: {
        marginTop: 8,
        fontSize: 14
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 16,
    },
    imageItem: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        alignItems: 'center',
        marginBottom: 12,
        marginHorizontal: 5,
        borderRadius: 8,
        overflow: 'hidden',
    },
    imageThumb: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
        backgroundColor: '#ccc',
        resizeMode: 'cover',
    },
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
    modalHeader: {
        height: 56,
        paddingHorizontal: 8,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    fullscreenImage: {
        width: '100%',
        height: '80%',
    },
    navButton: {
        position: 'absolute',
        top: '50%',
        marginTop: -24,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 999,
    },
    navLeft: {
        left: 16
    },
    navRight: {
        right: 16
    },
    closeButton: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        backgroundColor: '#F44336',
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    labelWithIcon: {
        marginLeft: 8,
    },
    valueMultiline: {
        flexShrink: 1,
        textAlign: 'right',
    },
    infoCard: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 8,
        elevation: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoIcon: {
        marginRight: 12,
    },
    infoCardText: {
        flex: 1,
        fontSize: 14,
        color: '#0d47a1',
    } as any,
    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
    },
    inlineText: {
        marginLeft: 8,
        fontSize: 14,
        flexShrink: 1,
    },
    inlineLabel: {
        fontWeight: '600',
    },
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
