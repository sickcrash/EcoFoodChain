import React, { useContext } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Chip, Text, Badge, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Lotto } from '../services/lottiService';
import { STATUS_COLORS, PRIMARY_COLOR } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../../src/context/ThemeContext';
import cardActionStyles from '../styles/cardActionButtons';
import logger from '../utils/logger';

interface LottoCardProps {
  lotto: Lotto;
  onPress: (lotto: Lotto) => void;
  onElimina?: (lotto: Lotto) => void;
}

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'N/D';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Data non valida';
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (error) {
    logger.error('Errore nel parsing della data:', error);
    return 'Errore data';
  }
};

const formatCurrency = (value: number) => {
  try {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    logger.error('Errore nel formato valuta:', error);
    return `${value.toFixed(2)} EUR`;
  }
};

const getStatusColorByState = (stato: string | undefined) => {
  switch (stato) {
    case 'Verde':
      return STATUS_COLORS.SUCCESS;
    case 'Arancione':
      return STATUS_COLORS.WARNING;
    case 'Rosso':
      return STATUS_COLORS.ERROR;
    default:
      return STATUS_COLORS.INFO;
  }
};

const getStatusColor = (lotto: Lotto | string) => {
  if (typeof lotto !== 'string') {
    if (lotto.stato_prenotazione === 'Prenotato') {
      return STATUS_COLORS.INFO;
    }
    return getStatusColorByState(lotto.stato);
  }
  return getStatusColorByState(lotto);
};

const getStatusText = (lotto: Lotto | string) => {
  if (typeof lotto !== 'string') {
    if (lotto.stato_prenotazione === 'Prenotato') {
      return 'Prenotato';
    }
    return lotto.stato || 'Stato non disponibile';
  }
  return lotto || 'Stato non disponibile';
};

const LottoCard: React.FC<LottoCardProps> = ({ lotto, onPress, onElimina }) => {
  const { user } = useAuth();
  const { isDarkMode } = useContext(ThemeContext);
  const ruolo = user?.ruolo ?? '';
  const isOrganizzazione = ['Amministratore', 'Operatore', 'OperatoreCentro'].includes(ruolo);
  const canPrenotare = ruolo ? !isOrganizzazione : true;
  const canEliminare = ['Amministratore', 'Operatore'].includes(ruolo);
  const showElimina = canEliminare && typeof onElimina === 'function';

  const nome = lotto.nome || 'Lotto senza nome';
  const quantita = isNaN(Number(lotto.quantita)) ? '0' : lotto.quantita.toString();
  const unitaMisura = lotto.unita_misura || 'pz';
  const descrizione = lotto.descrizione || 'Nessuna descrizione disponibile';

  const displayState = getStatusText(lotto);
  const stateColor = getStatusColor(lotto);

  const handlePrenotaClick = () => {
    onPress(lotto);
  };

  return (
    <TouchableOpacity onPress={() => onPress(lotto)} activeOpacity={0.7}>
      <Card style={[styles.card, isDarkMode && { backgroundColor: '#232323' }]}>
        <View style={styles.statusBadge}>
          <Badge size={12} style={{ backgroundColor: stateColor }} />
        </View>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Title style={[styles.title, isDarkMode && { color: '#fff' }]}>{nome}</Title>
            </View>
            <View style={[styles.quantityContainer, isDarkMode && { backgroundColor: '#333' }]}>
              <Text style={[styles.quantity, isDarkMode && { color: '#fff' }]}>{quantita}</Text>
              <Text style={[styles.unit, isDarkMode && { color: '#ccc' }]}>{unitaMisura}</Text>
            </View>
          </View>

          <Paragraph style={[styles.description, isDarkMode && { color: '#ccc' }]} numberOfLines={2}>
            {descrizione}
          </Paragraph>

          <View style={styles.footer}>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={16} color={isDarkMode ? PRIMARY_COLOR : '#666'} />
              <Text style={[styles.date, isDarkMode && { color: '#ccc' }]}>Scadenza: {formatDate(lotto.data_scadenza)}</Text>
            </View>
            <View style={styles.statusContainer}>
              <Chip
                style={[styles.statusChip, { backgroundColor: stateColor + '30' }]}
                textStyle={[styles.statusChipText, { color: stateColor }]}
              >
                {displayState}
              </Chip>
            </View>
          </View>

          {lotto.prezzo !== undefined && lotto.prezzo !== null && (
            <View style={styles.priceContainer}>
              <Ionicons name="pricetag-outline" size={16} color={isDarkMode ? PRIMARY_COLOR : '#666'} />
              <Text style={[styles.price, isDarkMode && { color: '#fff' }]}>Prezzo: {formatCurrency(lotto.prezzo)}</Text>
            </View>
          )}

          <View style={[styles.buttonContainer, cardActionStyles.wrapper]}>
            <Button
              mode="contained"
              onPress={handlePrenotaClick}
              style={[
                cardActionStyles.button,
                !showElimina && cardActionStyles.buttonFullWidth,
                styles.actionPrimary,
              ]}
              labelStyle={[cardActionStyles.label, styles.actionLabel]}
              contentStyle={cardActionStyles.content}
              uppercase={false}
            >
              {canPrenotare ? 'Prenota' : 'Dettagli'}
            </Button>
            {showElimina && (
              <Button
                mode="contained"
                onPress={(e) => {
                  e.stopPropagation?.();
                  onElimina?.(lotto);
                }}
                style={[cardActionStyles.button, styles.actionDanger]}
                labelStyle={[cardActionStyles.label, styles.actionLabel]}
                contentStyle={cardActionStyles.content}
                uppercase={false}
              >
                Elimina
              </Button>
            )}
          </View>

          {lotto.stato_prenotazione === 'Prenotato' && (user?.ruolo === 'Amministratore' || user?.ruolo === 'Operatore') && (
            <View style={[styles.prenotatoContainer, isDarkMode && { backgroundColor: '#1a2633', borderLeftColor: stateColor }]}>
              <View style={styles.prenotatoRow}>
                <Ionicons name="information-circle" size={16} color={stateColor} style={{ marginRight: 6 }} />
                <Text style={[styles.prenotatoText, isDarkMode && { color: '#fff' }]}>Questo lotto è già stato prenotato</Text>
              </View>
              {lotto.stato === 'Verde' && lotto.prezzo !== undefined && lotto.prezzo !== null && (
                <View style={styles.prenotatoRow}>
                  <Ionicons name="pricetag-outline" size={16} color={stateColor} style={{ marginRight: 6 }} />
                  <Text style={[styles.prenotatoText, isDarkMode && { color: '#fff' }]}>Prezzo: {formatCurrency(lotto.prezzo)}</Text>
                </View>
              )}
            </View>
          )}

        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

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
  },
  actionPrimary: {
    backgroundColor: PRIMARY_COLOR,
  },
  actionDanger: {
    backgroundColor: '#F44336',
  },
  actionLabel: {
    color: '#fff',
  },
  prenotatoContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: `${STATUS_COLORS.INFO}15`,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: STATUS_COLORS.INFO,
  },
  prenotatoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  prenotatoText: {
    fontSize: 12,
    color: '#444',
  },
});

export default LottoCard;



