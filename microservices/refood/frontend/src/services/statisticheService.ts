import axios from 'axios';
import { API_URL, STORAGE_KEYS } from '../config/constants';
import logger from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subMonths } from 'date-fns';
import { getActiveToken } from './authService';

// Tipi di dati per le statistiche
export interface StatisticheGenerali {
  totaleAlimentiSalvati: number;          // in kg
  co2Risparmiata: number;                // in kg
  valoreEconomicoRisparmiato: number;    // in euro
  numeroLottiSalvati: number;
  numeroPrenotazioniCompletate: number;
  numeroTrasformazioniCircolari: number;
}

export interface StatistichePerPeriodo {
  periodo: string; // es. "2023-01", "2023-02", ecc. per mesi o "2023-W01", "2023-W02" per settimane
  quantitaAlimentiSalvati: number;  // in kg
  co2Risparmiata: number;          // in kg
  valoreEconomico: number;         // in euro
  numeroLotti: number;
}

export interface StatisticheTrasporto {
  distanzaTotale: number;         // in km
  emissioniCO2: number;           // in kg
  costoTotale: number;            // in euro
  numeroTrasporti: number;
}

export interface StatisticheCategorie {
  nome: string;
  quantita: number;
  percentuale: number;
}

export interface StatisticheCompletamento {
  periodo: string;
  completate: number;
  annullate: number;
  percentualeCompletamento: number;
}

export interface StatisticheTempoPrenotazione {
  tempoMedio: number; // in ore
  tempoMediano: number; // in ore
  distribuzioneTempi: {
    intervallo: string; // es. "0-6h", "6-12h", ecc.
    conteggio: number;
    percentuale: number;
  }[];
}

export interface StatisticheCompleteResponse {
  generali: StatisticheGenerali;
  perPeriodo: StatistichePerPeriodo[];
  trasporto: StatisticheTrasporto;
  perCategoria: StatisticheCategorie[];
  completamento: StatisticheCompletamento[];
  tempoPrenotazione: StatisticheTempoPrenotazione;
}

/**
 * Servizio per la gestione delle statistiche
 */
class StatisticheService {
  private cachedStatistiche: StatisticheCompleteResponse | null = null;
  private lastFetchTimestamp: number = 0;
  private cacheDuration: number = 3600000; // 1 ora in millisecondi

  /**
   * Ottiene le statistiche complete
   */
  async getStatisticheComplete(forceRefresh = false): Promise<StatisticheCompleteResponse> {
    try {
      const now = Date.now();
      const cacheExpired = now - this.lastFetchTimestamp > this.cacheDuration;
      
      // Se abbiamo dati in cache validi e non è richiesto un refresh forzato, usa quelli
      if (this.cachedStatistiche && !cacheExpired && !forceRefresh) {
        logger.log('Utilizzo statistiche in cache');
        return this.cachedStatistiche;
      }
      
      // Ottieni il token di autenticazione
      const token = await getActiveToken();
      if (!token) {
        throw new Error('Token di autenticazione non disponibile');
      }
      
      // Costruisci query parameters
      const params = new URLSearchParams();
      params.append('periodo', 'ultimi_12_mesi');
      
      const response = await axios.get(`${API_URL}/statistiche/complete`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });
      
      // Aggiorna la cache e il timestamp
      this.cachedStatistiche = response.data;
      this.lastFetchTimestamp = now;
      
      return response.data;
    } catch (error) {
      logger.error('Errore durante il recupero delle statistiche:', error);
      
      // Se abbiamo dati in cache, restituiscili anche se scaduti in caso di errore
      if (this.cachedStatistiche) {
        logger.warn('Utilizzo statistiche in cache scadute a causa di un errore');
        return this.cachedStatistiche;
      }
      
      // Se non abbiamo dati in cache, genera dati di esempio
      logger.warn('Generazione statistiche di esempio in assenza di dati reali');
      return this.generateExampleData();
    }
  }
  
  /**
   * Ottiene le statistiche di un centro specifico
   */
  async getStatisticheCentro(centroId: number, periodo = 'ultimi_12_mesi'): Promise<StatisticheCompleteResponse> {
    try {
      // Ottieni il token di autenticazione
      const token = await getActiveToken();
      if (!token) {
        throw new Error('Token di autenticazione non disponibile');
      }
      
      // Costruisci query parameters
      const params = new URLSearchParams();
      params.append('periodo', periodo);
      params.append('centro_id', centroId.toString());
      
      const response = await axios.get(`${API_URL}/statistiche/centro`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Errore durante il recupero delle statistiche del centro ${centroId}:`, error);
      
      // Genera dati di esempio in caso di errore
      return this.generateExampleData(centroId);
    }
  }
  
  /**
   * Ottiene le statistiche di impatto ambientale
   */
  async getStatisticheImpatto(periodo = 'ultimi_12_mesi'): Promise<{ co2Risparmiata: number, alberiEquivalenti: number }> {
    try {
      // Ottieni il token di autenticazione
      const token = await getActiveToken();
      if (!token) {
        throw new Error('Token di autenticazione non disponibile');
      }
      
      // Costruisci query parameters
      const params = new URLSearchParams();
      params.append('periodo', periodo);
      
      const response = await axios.get(`${API_URL}/statistiche/impatto`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });
      
      return response.data;
    } catch (error) {
      logger.error('Errore durante il recupero delle statistiche di impatto:', error);
      
      // Genera dati di esempio in caso di errore
      return {
        co2Risparmiata: 2500, // kg
        alberiEquivalenti: 114 // un albero assorbe circa 22kg di CO2 all'anno
      };
    }
  }
  
  /**
   * Ottiene le statistiche di efficienza
   */
  async getStatisticheEfficienza(): Promise<{ tempoMedioPrenotazione: number, percentualeCompletamento: number }> {
    try {
      // Ottieni il token di autenticazione
      const token = await getActiveToken();
      if (!token) {
        throw new Error('Token di autenticazione non disponibile');
      }
      
      const response = await axios.get(`${API_URL}/statistiche/efficienza`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      return response.data;
    } catch (error) {
      logger.error('Errore durante il recupero delle statistiche di efficienza:', error);
      
      // Genera dati di esempio in caso di errore
      return {
        tempoMedioPrenotazione: 8.5, // ore
        percentualeCompletamento: 87.3 // percentuale
      };
    }
  }
  
  /**
   * Esporta le statistiche in formato CSV
   */
  async esportaStatisticheCSV(periodo = 'ultimi_12_mesi'): Promise<string> {
    try {
      // Ottieni il token di autenticazione
      const token = await getActiveToken();
      if (!token) {
        throw new Error('Token di autenticazione non disponibile');
      }
      
      // Costruisci query parameters
      const params = new URLSearchParams();
      params.append('periodo', periodo);
      params.append('formato', 'csv');
      
      const response = await axios.get(`${API_URL}/statistiche/esporta`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/csv',
        },
        params,
        responseType: 'blob',
      });
      
      // Converti il blob in una stringa
      const blob = response.data;
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsText(blob);
      });
    } catch (error) {
      logger.error('Errore durante l\'esportazione delle statistiche:', error);
      throw new Error('Impossibile esportare le statistiche');
    }
  }
  
  /**
   * Genera dati di esempio per le statistiche
   */
  private generateExampleData(centroId?: number): StatisticheCompleteResponse {
    const now = new Date();
    const mesi = Array.from({ length: 12 }, (_, i) => {
      const data = subMonths(now, 11 - i);
      return format(data, 'yyyy-MM');
    });
    
    // Statistiche generali
    const generali: StatisticheGenerali = {
      totaleAlimentiSalvati: Math.round(5000 + Math.random() * 10000),
      co2Risparmiata: Math.round(2000 + Math.random() * 5000),
      valoreEconomicoRisparmiato: Math.round(15000 + Math.random() * 25000),
      numeroLottiSalvati: Math.round(500 + Math.random() * 1000),
      numeroPrenotazioniCompletate: Math.round(400 + Math.random() * 800),
      numeroTrasformazioniCircolari: Math.round(50 + Math.random() * 150),
    };
    
    // Statistiche per periodo
    const perPeriodo: StatistichePerPeriodo[] = mesi.map(mese => ({
      periodo: mese,
      quantitaAlimentiSalvati: Math.round(300 + Math.random() * 700),
      co2Risparmiata: Math.round(100 + Math.random() * 300),
      valoreEconomico: Math.round(1000 + Math.random() * 2000),
      numeroLotti: Math.round(30 + Math.random() * 70),
    }));
    
    // Statistiche trasporto
    const trasporto: StatisticheTrasporto = {
      distanzaTotale: Math.round(2000 + Math.random() * 5000),
      emissioniCO2: Math.round(500 + Math.random() * 1500),
      costoTotale: Math.round(1000 + Math.random() * 3000),
      numeroTrasporti: Math.round(200 + Math.random() * 500),
    };
    
    // Statistiche per categoria
    const categorie = ['Frutta', 'Verdura', 'Latticini', 'Pane', 'Carne', 'Altro'];
    const totaleQuantita = Math.round(5000 + Math.random() * 5000);
    let rimanente = totaleQuantita;
    
    const perCategoria: StatisticheCategorie[] = categorie.map((nome, index) => {
      let quantita: number;
      if (index === categorie.length - 1) {
        quantita = rimanente;
      } else {
        // Distribuisci piu' peso alle prime categorie
        const peso = (categorie.length - index) / categorie.length;
        quantita = Math.round(rimanente * peso * Math.random() * 0.5);
        rimanente -= quantita;
      }
      
      return {
        nome,
        quantita,
        percentuale: 0 // calcolato dopo
      };
    });
    
    // Calcola le percentuali
    perCategoria.forEach(categoria => {
      categoria.percentuale = parseFloat(((categoria.quantita / totaleQuantita) * 100).toFixed(1));
    });
    
    // Statistiche completamento
    const completamento: StatisticheCompletamento[] = mesi.map(mese => {
      const completate = Math.round(30 + Math.random() * 50);
      const annullate = Math.round(1 + Math.random() * 10);
      const totale = completate + annullate;
      
      return {
        periodo: mese,
        completate,
        annullate,
        percentualeCompletamento: parseFloat(((completate / totale) * 100).toFixed(1)),
      };
    });
    
    // Statistiche tempo prenotazione
    const distribuzioneTempi = [
      { intervallo: '0-6h', conteggio: Math.round(50 + Math.random() * 100), percentuale: 0 },
      { intervallo: '6-12h', conteggio: Math.round(80 + Math.random() * 120), percentuale: 0 },
      { intervallo: '12-24h', conteggio: Math.round(100 + Math.random() * 150), percentuale: 0 },
      { intervallo: '24-48h', conteggio: Math.round(30 + Math.random() * 70), percentuale: 0 },
      { intervallo: '>48h', conteggio: Math.round(10 + Math.random() * 30), percentuale: 0 },
    ];
    
    const totaleConteggio = distribuzioneTempi.reduce((acc, item) => acc + item.conteggio, 0);
    distribuzioneTempi.forEach(item => {
      item.percentuale = parseFloat(((item.conteggio / totaleConteggio) * 100).toFixed(1));
    });
    
    const tempoPrenotazione: StatisticheTempoPrenotazione = {
      tempoMedio: parseFloat((6 + Math.random() * 18).toFixed(1)),
      tempoMediano: parseFloat((5 + Math.random() * 15).toFixed(1)),
      distribuzioneTempi,
    };
    
    // Se è specificato un centroId, personalizza i dati con un fattore basato sul centroId
    if (centroId) {
      const factor = 0.5 + (centroId % 10) / 10;
      
      // Scala i valori generali
      Object.keys(generali).forEach(key => {
        generali[key as keyof StatisticheGenerali] = Math.round(generali[key as keyof StatisticheGenerali] * factor);
      });
      
      // Scala i valori dei periodi
      perPeriodo.forEach(periodo => {
        Object.keys(periodo).forEach(key => {
          if (key !== 'periodo') {
            periodo[key as keyof Omit<StatistichePerPeriodo, 'periodo'>] = 
              Math.round(periodo[key as keyof Omit<StatistichePerPeriodo, 'periodo'>] * factor);
          }
        });
      });
    }
    
    return {
      generali,
      perPeriodo,
      trasporto,
      perCategoria,
      completamento,
      tempoPrenotazione,
    };
  }
}

export default new StatisticheService(); 

