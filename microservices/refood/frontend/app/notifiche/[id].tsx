import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Text, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Appbar, Button, Card, Paragraph, useTheme } from 'react-native-paper';
import notificheService from '../../src/services/notificheService';
import { PRIMARY_COLOR } from '../../src/config/constants';
import { Ionicons } from '@expo/vector-icons';
import { useNotifiche } from '../../src/context/NotificheContext';
import { Toast } from 'react-native-toast-message/lib/src/Toast';
import logger from '../../src/utils/logger';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Data non disponibile';
  
  try {
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) {
      return 'Data non valida';
    }
    return format(dateObj, "d/MM/yyyy 'alle' HH:mm", { locale: it });
  } catch (error) {
    console.error('Errore nella formattazione della data:', error);
    return 'Errore nel formato data';
  }
};

export default function DettaglioNotifica() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [notifica, setNotifica] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshNotifiche } = useNotifiche();
  const theme = useTheme();
  const palette = useMemo(
    () => ({
      background: theme.dark ? '#111217' : '#f4f4f4',
      card: theme.dark ? '#1f2127' : '#ffffff',
      text: theme.dark ? '#ffffff' : '#1a1a1a',
      subText: theme.dark ? '#c5c7ce' : '#5f6368',
      border: theme.dark ? '#2c2f36' : '#e0e0e0',
      delete: '#d32f2f',
    }),
    [theme.dark]
  );

  useEffect(() => {
    if (!id) {
      logger.warn('DettaglioNotifica: ID non fornito');
      return;
    }
    
    const loadNotifica = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const notificaId = parseInt(id, 10);
        if (isNaN(notificaId)) {
          throw new Error(`ID notifica non valido: ${id}`);
        }
        
        const result = await notificheService.getNotifica(notificaId);
        setNotifica(result.data);
        
        if (!result.data.letta) {
          await notificheService.segnaComeLetta(notificaId);
          refreshNotifiche();
        }
      } catch (err: any) {
        logger.error('Errore caricamento notifica:', err);
        setError(err.message || 'Errore durante il caricamento della notifica');
      } finally {
        setLoading(false);
      }
    };
    
    loadNotifica();
  }, [id, refreshNotifiche]);

  const handleGoBack = () => {
    router.back();
  };

  const handleDelete = async () => {
    if (!notifica) return;
    
    try {
      await notificheService.eliminaNotifica(notifica.id);
      Toast.show({
        type: 'success',
        text1: 'Notifica eliminata',
        text2: "La notifica e' stata eliminata con successo",
      });
      refreshNotifiche();
      router.back();
    } catch (err: any) {
      logger.error('Errore eliminazione notifica:', err);
      Toast.show({
        type: 'error',
        text1: 'Errore',
        text2: err.message || 'Errore durante l\'eliminazione della notifica',
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}> 
      <Appbar.Header statusBarHeight={Platform.OS === 'android' ? 0 : undefined} style={{ backgroundColor: PRIMARY_COLOR }} elevated>
        <Appbar.BackAction onPress={handleGoBack} color="#fff" />
        <Appbar.Content title="Dettaglio notifica" titleStyle={styles.appbarTitle} color="#fff" />
        <Appbar.Action icon="delete" color="#fff" onPress={handleDelete} />
      </Appbar.Header>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={[styles.loadingText, { color: palette.subText }]}>Caricamento in corso...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={palette.delete} />
          <Text style={[styles.errorText, { color: palette.text }]}>{error}</Text>
          <Button mode="contained" onPress={handleGoBack} style={styles.errorButton} buttonColor={PRIMARY_COLOR}>
            Torna alla lista
          </Button>
        </View>
      ) : notifica ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card style={[styles.card, { backgroundColor: palette.card }]}>
            <Card.Content>
              <Text style={[styles.title, { color: palette.text }]}>{notifica.titolo}</Text>
              <Paragraph style={[styles.date, { color: palette.subText }]}>
                {formatDate(notifica.dataCreazione)}
              </Paragraph>

              <View style={[styles.separator, { backgroundColor: palette.border }]} />

              <Paragraph style={[styles.content, { color: palette.text }]}>
                {notifica.messaggio}
              </Paragraph>

              {notifica.link && (
                <View style={styles.additionalInfo}>
                  <Text style={[styles.infoLabel, { color: palette.text }]}>Link associato</Text>
                  <Text style={[styles.infoValue, { color: palette.subText }]} numberOfLines={2}>
                    {notifica.link}
                  </Text>
                </View>
              )}

              {notifica.idRiferimento && (
                <View style={styles.additionalInfo}>
                  <Text style={[styles.infoLabel, { color: palette.text }]}>Riferimento</Text>
                  <Text style={[styles.infoValue, { color: palette.subText }]}>{notifica.idRiferimento}</Text>
                </View>
              )}
            </Card.Content>

            <Card.Actions style={styles.actions}>
              <Button
                mode="outlined"
                onPress={handleGoBack}
                style={styles.backButton}
                textColor={PRIMARY_COLOR}
                icon="arrow-left"
              >
                Indietro
              </Button>

              <Button
                mode="contained"
                onPress={handleDelete}
                buttonColor={palette.delete}
                style={styles.deleteButton}
                icon="delete"
              >
                Elimina
              </Button>
            </Card.Actions>
          </Card>
        </ScrollView>
      ) : (
        <View style={styles.errorContainer}>
          <Ionicons name="help-circle" size={48} color={palette.subText} />
          <Text style={[styles.errorText, { color: palette.text }]}>Nessuna notifica trovata</Text>
          <Button mode="contained" onPress={handleGoBack} style={styles.errorButton} buttonColor={PRIMARY_COLOR}>
            Torna alla lista
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appbarTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  date: {
    fontSize: 14,
    marginBottom: 12,
  },
  separator: {
    height: 1,
    marginBottom: 16,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  additionalInfo: {
    marginTop: 12,
  },
  infoLabel: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  errorButton: {
    paddingHorizontal: 24,
  },
}); 
