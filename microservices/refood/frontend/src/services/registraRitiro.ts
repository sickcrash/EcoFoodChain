import axios, { isAxiosError } from 'axios';
import { API_URL } from '../config/constants';
import { getAuthHeader } from './prenotazioniService';

/**
 * Registra il ritiro effettivo di un lotto prenotato
 * @param id ID della prenotazione
 * @param ritiroDa Nome della persona che ritira il lotto
 * @param documentoRitiro Documento di identità (opzionale)
 * @param noteRitiro Note sul ritiro (opzionale)
 * @param indirizzo Indirizzo di chi ritira (opzionale)
 * @param telefono Telefono di chi ritira (opzionale)
 * @param email Email di chi ritira (opzionale)
 * @returns Risposta API
 */
export const registraRitiro = async (
  id: number,
  ritiroDa: string,
  documentoRitiro: string = '',
  noteRitiro: string = '',
  indirizzo: string = '',
  telefono: string = '',
  email: string = ''
): Promise<any> => {
  try {
    console.log(`Registrando ritiro per prenotazione ${id}...`);
    
    const headers = await getAuthHeader();
    if (!headers) {
      throw new Error('Non autorizzato. Effettua il login per continuare.');
    }
    
    const response = await axios.put(
      `${API_URL}/prenotazioni/${id}/registra-ritiro`,
      {
        ritirato_da: ritiroDa || null,
        documento_ritiro: documentoRitiro || null,
        note_ritiro: noteRitiro || null,
        indirizzo_ritiro: indirizzo || null,
        telefono_ritiro: telefono || null,
        email_ritiro: email || null
      },
      { headers }
    );
    
    return {
      success: true,
      message: 'Ritiro registrato con successo',
      data: response.data
    };
  } catch (error: any) {
    console.error('Errore nella registrazione del ritiro:', error);
    
    if (isAxiosError(error) && error.response) {
      return {
        success: false,
        message: error.response.data?.message || 'Errore durante la registrazione del ritiro',
        error: error.response.data
      };
    }
    
    return {
      success: false,
      message: error.message || 'Errore di rete durante la registrazione del ritiro',
      error
    };
  }
};

export default registraRitiro; 