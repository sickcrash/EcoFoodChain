import React, { useContext } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Chip, Text, Button, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { PRIMARY_COLOR } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../../src/context/ThemeContext';
import cardActionStyles from '../styles/cardActionButtons';

/** Tipi */
export type StatoSegnalazione = 'inviata' | 'in_lavorazione' | 'chiusa';

export type Segnalazione = {
    id: number;
    nome: string;
    descrizione?: string | null;
    quantita: number;
    unita_misura: 'kg' | 'g' | 'l' | 'ml' | 'pz';
    prezzo?: number | null;
    shelflife: string; // YYYY-MM-DD
    stato: StatoSegnalazione;
};

interface SegnalazioneCardProps {
    segnalazione: Segnalazione;
    onPress: (s: Segnalazione) => void;
    /** opzionale: visibile agli admin (step futuri) */
    onRevision?: (s: Segnalazione) => void;
}

/** Mappa colori/label per stato (coerente con stile lotti) */
const STATO_COLOR: Record<StatoSegnalazione, string> = {
    inviata: '#1E88E5',        // blu
    in_lavorazione: '#FB8C00', // arancio
    chiusa: '#E53935',         // verde
};
const STATO_LABEL: Record<StatoSegnalazione, string> = {
    inviata: 'Inviata',
    in_lavorazione: 'In lavorazione',
    chiusa: 'Chiusa',
};

const SegnalazioneCard: React.FC<SegnalazioneCardProps> = ({ segnalazione, onPress, onRevision }) => {
    const { user } = useAuth();
    const { isDarkMode } = useContext(ThemeContext);

    const nome = segnalazione.nome || 'Segnalazione senza nome';
    const quantita = isNaN(Number(segnalazione.quantita)) ? '0' : String(segnalazione.quantita);
    const unita = segnalazione.unita_misura || 'pz';
    const descrizione = segnalazione.descrizione?.trim() || 'Nessuna descrizione disponibile';
    const prezzo = segnalazione.prezzo || 0;

    const stateColor = STATO_COLOR[segnalazione.stato];
    const stateLabel = STATO_LABEL[segnalazione.stato];

    const isAdmin = user?.ruolo === 'Amministratore';
    const canRevision =
        isAdmin &&
        (segnalazione.stato === 'inviata' || segnalazione.stato === 'in_lavorazione') &&
        typeof onRevision === 'function';

    const showDettagli = !isAdmin || segnalazione.stato === 'chiusa';

    return (
        <TouchableOpacity onPress={() => onPress(segnalazione)} activeOpacity={0.7}>
            <Card style={[styles.card, isDarkMode && { backgroundColor: '#232323' }]}>
                {/* Badge in alto a destra (stile LottoCard) */}
                <View style={styles.statusBadge}>
                    <Badge size={12} style={{ backgroundColor: stateColor }} />
                </View>

                <Card.Content>
                    {/* Header: titolo a sinistra, quantità a destra */}
                    <View style={styles.header}>
                        <View style={styles.titleContainer}>
                            <Title style={[styles.title, isDarkMode && { color: '#fff' }]} numberOfLines={2}>
                                {nome}
                            </Title>
                        </View>
                        <View style={[styles.quantityContainer, isDarkMode && { backgroundColor: '#333' }]}>
                            <Text style={[styles.quantity, isDarkMode && { color: '#fff' }]}>{quantita}</Text>
                            <Text style={[styles.unit, isDarkMode && { color: '#ccc' }]}>{unita}</Text>
                        </View>
                    </View>

                    {/* Descrizione (2 righe) */}
                    <Paragraph style={[styles.description, isDarkMode && { color: '#ccc' }]} numberOfLines={2}>
                        {descrizione}
                    </Paragraph>

                    {/* Footer: shelf-life a sx + chip stato a dx */}
                    <View style={styles.footer}>
                        <View style={styles.dateContainer}>
                            <Ionicons name="calendar-outline" size={16} color={isDarkMode ? PRIMARY_COLOR : '#666'} />
                            <Text style={[styles.date, isDarkMode && { color: '#ccc' }]}>
                                Shelf-Life: {formatDate(segnalazione.shelflife)}
                            </Text>
                        </View>

                        <View style={styles.statusContainer}>
                            <Chip
                                style={[styles.statusChip, { backgroundColor: stateColor + '30' }]}
                                textStyle={[styles.statusChipText, { color: stateColor }]}
                            >
                                {stateLabel}
                            </Chip>
                        </View>
                    </View>

                    {/* Prezzo (se presente) sotto al footer, a sinistra */}
                    {prezzo !== undefined && prezzo !== null && (
                        <View style={styles.priceContainer}>
                            <Ionicons name="pricetag-outline" size={16} color={isDarkMode ? PRIMARY_COLOR : '#666'} />
                            <Text style={[styles.price, isDarkMode && { color: '#fff' }]}>
                                Prezzo: {prezzo.toFixed(2)} €
                            </Text>
                        </View>
                    )}

                    {/* CTA a destra: Dettagli (e, per admin, Revisiona) */}
                    <View style={[styles.buttonContainer, cardActionStyles.wrapper]}>
                        {canRevision && (
                            <Button
                                mode="contained"
                                onPress={(e) => {
                                    e.stopPropagation?.();
                                    onRevision?.(segnalazione);
                                }}
                                style={[cardActionStyles.button, cardActionStyles.buttonFullWidth, styles.ctaButtonDanger]}
                                labelStyle={[cardActionStyles.label, styles.ctaLabel]}
                                contentStyle={cardActionStyles.content}
                                uppercase={false}
                            >
                                Revisiona
                            </Button>
                        )}

                        {showDettagli && (
                            <Button
                                mode="contained"
                                onPress={() => onPress(segnalazione)}
                                style={[
                                    cardActionStyles.button,
                                    !canRevision && cardActionStyles.buttonFullWidth,
                                    styles.ctaButtonPrimary,
                                ]}
                                labelStyle={[cardActionStyles.label, styles.ctaLabel]}
                                contentStyle={cardActionStyles.content}
                                uppercase={false}
                            >
                                Dettagli
                            </Button>
                        )}
                    </View>
                </Card.Content>
            </Card>
        </TouchableOpacity>
    );
};

/** Helpers */
function formatDate(yyyyMmDd: string | undefined) {
    if (!yyyyMmDd) return 'N/D';
    const [y, m, d] = yyyyMmDd.split('-');
    if (!y || !m || !d) return yyyyMmDd;
    return `${d}/${m}/${y}`;
}

/** Stili (ricalcati dalla LottoCard per continuità visiva) */
const styles = StyleSheet.create({
    card: {
        marginVertical: 8,
        marginHorizontal: 16,
        borderRadius: 12,
        elevation: 4,
        position: 'relative',
        overflow: 'hidden',
    },
    statusBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    titleContainer: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    quantityContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 8,
        minWidth: 60,
    },
    quantity: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    unit: {
        fontSize: 12,
        color: '#666',
    },
    description: {
        marginBottom: 12,
        color: '#444',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    date: {
        marginLeft: 4,
        fontSize: 12,
        color: '#666',
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
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    price: {
        marginLeft: 4,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#666',
    },
    buttonContainer: {
        marginTop: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        alignItems: 'stretch',
        marginHorizontal: -4,
    },
    ctaButton: {
        flexGrow: 1,
        flexShrink: 1,
        borderRadius: 14,
        marginHorizontal: 4,
        marginVertical: 4,
        elevation: 2,
    },
    ctaButtonPrimary: {
        backgroundColor: PRIMARY_COLOR,
    },
    ctaButtonDanger: {
        backgroundColor: '#F44336',
    },
    ctaContent: {
        height: 42,
        justifyContent: 'center',
    },
    ctaLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
    },
});

export default SegnalazioneCard;
