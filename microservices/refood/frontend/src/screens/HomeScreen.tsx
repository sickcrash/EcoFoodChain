import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { Text, Card, ActivityIndicator, useTheme } from 'react-native-paper';
import { api } from '../services/api';
import logger from '../utils/logger';

const HomeScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any[]>([]);

  const theme = useTheme();
  const isDarkMode = theme.dark;

  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const textColor = isDarkMode ? '#ffffff' : '#000000';

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/statistiche/counters');
      setStats(response.data || []);
    } catch (error) {
      setError('Errore nel recupero delle statistiche');
      logger.error('Errore nel recupero delle statistiche:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor }]}>
      <Text style={[styles.title, { color: textColor }]}>Statistiche</Text>

      {loading ? (
        <ActivityIndicator animating={true} size="large" style={styles.loading} />
      ) : error ? (
        <Text style={[styles.errorText, { color: '#f44336' }]}>{error}</Text>
      ) : (
        stats.map((item, index) => (
          <Card key={index} style={[styles.card, { backgroundColor: isDarkMode ? '#1e1e1e' : '#fff' }]}>
            <Card.Content>
              <Text style={{ color: textColor }}>{JSON.stringify(item, null, 2)}</Text>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  loading: {
    marginTop: 32,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
  },
  card: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
});

export default HomeScreen;
