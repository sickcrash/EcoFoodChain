/**
 * Definizione dei tipi per il sistema di notifiche
 */

// Tipi di notifiche supportati
export type TipoNotifica = 'CambioStato' | 'Prenotazione' | 'Alert';

// Livelli di priorità delle notifiche
export type PrioritaNotifica = 'Bassa' | 'Media' | 'Alta';

// Interfaccia principale per le notifiche
export interface Notifica {
  id: number;
  titolo: string;
  messaggio: string;
  tipo: string;
  priorita: string;
  letta: boolean;
  data: string;
  dataCreazione: string;
  dataLettura?: string;
}

// Filtri per le notifiche
export interface NotificaFiltri {
  tipo?: string;
  priorita?: string;
  letta?: boolean;
}

// Tipo per la risposta API delle notifiche
export interface NotificheResponse {
  data: Notifica[];
  pagination: {
    total: number;
    // Formato vecchio
    page?: number;
    limit?: number;
    pages?: number;
    // Formato nuovo
    currentPage?: number;
    totalPages?: number;
  };
} 