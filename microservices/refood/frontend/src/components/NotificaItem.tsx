import React from 'react';
import { View, StyleSheet, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { Card, Title, Paragraph, Text, IconButton, useTheme } from 'react-native-paper';
import { PRIMARY_COLOR } from '../config/constants';
import { Notifica, TipoNotifica } from '../types/notification';
import { useNotifiche } from '../context/NotificheContext';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import Toast from 'react-native-toast-message';
import logger from '../utils/logger';


interface NotificaItemProps {
  notifica: Notifica;
  onPress: (notifica: Notifica) => void;
}

const NotificaItem: React.FC<NotificaItemProps> = ({ notifica, onPress }) => {
  const { segnaComeLetta, eliminaNotifica } = useNotifiche();
  const theme = useTheme();
  const isDarkMode = theme.dark;



  // Card: bianca in chiaro, scura in dark, indicatori blu
  const cardBgColor = isDarkMode ? '#181A20' : '#fff';
  // Più chiara per "nuovo lotto" o "prenotato" in dark mode
  const isLottoAlbicocche = notifica.messaggio && notifica.messaggio.toLowerCase().includes('albicocche');
  const isNuovoLotto = notifica.titolo?.toLowerCase().includes('nuovo lotto') || notifica.messaggio?.toLowerCase().includes('nuovo lotto');
  const isPrenotatoLotto = notifica.titolo?.toLowerCase().includes('prenotato') || notifica.messaggio?.toLowerCase().includes('prenotato');
  // Considera "creato" e "prenotato" anche se la frase è "hai creato" o simili
  const isCreatoLotto = notifica.messaggio?.toLowerCase().includes('creato') || notifica.messaggio?.toLowerCase().includes('hai creato');
  const isPrenotatoMsg = notifica.messaggio?.toLowerCase().includes('prenotato') || notifica.messaggio?.toLowerCase().includes('hai prenotato');
  const isSpecialLotto = isLottoAlbicocche && (isNuovoLotto || isPrenotatoLotto || isCreatoLotto || isPrenotatoMsg);
  // Ancora più chiaro per "nuovo/prenotato lotto albicocche" in dark mode
  const unreadBgColor = isDarkMode && isSpecialLotto ? '#3b5d47' : isDarkMode ? '#263e2b' : '#f5f5f5';
  const borderColor = PRIMARY_COLOR;
  const iconColor = isDarkMode ? '#fff' : PRIMARY_COLOR;

  // Ottieni l’icona in base al tipo di notifica
  const getIconByType = (tipo: TipoNotifica | string): string => {
    switch (tipo) {
      case 'CambioStato':
        return 'sync';
      case 'Prenotazione':
        return 'shopping';
      case 'Alert':
        return 'alert-circle';
      default:
        return 'bell';
    }
  };


  // Tutte le icone e indicatori usano PRIMARY_COLOR (verde)
  const getColorByPriority = (): string => PRIMARY_COLOR;

  // Formatta la data della notifica
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return format(date, 'dd/MM/yyyy, HH:mm', { locale: it });
    } catch (error) {
      logger.error('Errore nel formato data:', error);
      return dateString;
    }
  };

  // Gestisce il click sul pulsante di lettura
  const handleMarkAsRead = async (event?: GestureResponderEvent) => {
    event?.stopPropagation();
    const success = await segnaComeLetta(notifica.id);
    if (success) {
      Toast.show({
        type: 'success',
        text1: 'Notifica aggiornata',
        text2: 'Segnata come letta',
        visibilityTime: 2000,
      });
    }
  };

  // Gestisce il click sul pulsante di eliminazione
  const handleDelete = async (event?: GestureResponderEvent) => {
    event?.stopPropagation();
    const success = await eliminaNotifica(notifica.id);
    if (success) {
      Toast.show({
        type: 'success',
        text1: 'Notifica eliminata',
        visibilityTime: 2000,
      });
    }
  };

  return (
    <TouchableOpacity 
      onPress={() => onPress(notifica)}
      style={styles.container}
      activeOpacity={0.7}
    >
      <Card 
        style={[
          styles.card,
          { backgroundColor: cardBgColor },
          !notifica.letta && [styles.unreadCard, { backgroundColor: unreadBgColor, borderLeftColor: borderColor }]
        ]}
      >
        <View style={styles.contentContainer}>
          <View style={[styles.priorityIndicator, { backgroundColor: getColorByPriority() }]} />
          
          <View style={styles.iconContainer}>
            <IconButton
              icon={getIconByType(notifica.tipo)}
              size={24}
              iconColor={iconColor}
            />
          </View>
          
          <View style={styles.textContent}>
            <Title style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>{notifica.titolo}</Title>
            {/* Messaggio custom per nuovo/prenotato lotto albicocche */}
            {isSpecialLotto ? (
              <Paragraph style={[
                styles.message,
                isDarkMode && { color: '#e0ffe0', fontWeight: 'bold' }
              ]}>
                {isNuovoLotto || isCreatoLotto ? 'È stato creato' : 'È stato prenotato'} un nuovo lotto: albicocche
              </Paragraph>
            ) : (
              <Paragraph style={[
                styles.message,
                isDarkMode && { color: '#e0ffe0' }
              ]}>{
                // Sostituisci sempre "hai creato"/"hai prenotato" con la forma impersonale
                notifica.messaggio
                  ?.replace(/hai creato/gi, 'È stato creato')
                  ?.replace(/hai prenotato/gi, 'È stato prenotato')
              }</Paragraph>
            )}
            <Text style={styles.date}>{formatDateTime(notifica.data)}</Text>
          </View>
          
          <View style={styles.actionsContainer}>
            {!notifica.letta && (
              <IconButton
                icon="check"
                size={20}
                iconColor={PRIMARY_COLOR}
                onPress={handleMarkAsRead}
                style={styles.actionButton}
              />
            )}
            <IconButton
              icon="delete"
              size={20}
              iconColor={isDarkMode ? '#ff5252' : '#d32f2f'}
              onPress={handleDelete}
              style={styles.actionButton}
            />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    elevation: 2,
  },
  unreadCard: {
    borderLeftWidth: 5,
  },
  contentContainer: {
    flexDirection: 'row',
    padding: 12,
  },
  priorityIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  iconContainer: {
    marginRight: 8,
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#777',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    margin: 0,
  },
});

export default NotificaItem; 
