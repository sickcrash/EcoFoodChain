// Interfaccia per i dati utente
export interface Utente {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;
  [key: string]: any; // Per proprietà aggiuntive che potrebbero essere presenti
}

// Tipo per i ruoli utente
export type RuoloUtente = 'Admin' | 'Gestore' | 'Utente' | 'Volontario' | string; 