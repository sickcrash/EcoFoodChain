import { api } from './api';

export type UnitaMisura = 'kg' | 'g' | 'l' | 'ml' | 'pz';

export type SegnalazioneInput = {
    nome: string;
    descrizione?: string;
    quantita: number;
    unitaMisura: UnitaMisura;
    prezzo?: number | null;
    indirizzoCentro: string;
    shelflife: string; // YYYY-MM-DD
    images?: { uri: string; name?: string; type?: string }[];
};

export type SegnalazioneImage = {
    id: number;
    filename: string;
    url: string;
    original_name: string | null;
    mime_type: string | null;
    size: number | null;
    creato_il: string;
};

export type SegnalazioneResponse = {
    id: number;
    nome: string;
    descrizione: string | null;
    quantita: number;
    unita_misura: UnitaMisura;
    prezzo: number | null;
    indirizzo_centro: string;
    shelflife: string; // YYYY-MM-DD
    stato: 'inviata' | 'in_lavorazione' | 'chiusa';
    esito: 'approvata' | 'rifiutata' | null;
    messaggio_esito: string | null;
    creato_da: number;
    creato_il: string;
    aggiornato_il: string | null;
    images: SegnalazioneImage[];
    creato_da_info?: { id: number; nome: string | null; cognome: string | null; ruolo: string | null };
};

/**
 * Crea una segnalazione con upload multipart.
 * NB: il backend legge i campi con queste chiavi:
 *  - nome, descrizione, quantita, unitaMisura, prezzo, indirizzoCentro, shelflife
 *  - immagini nel campo "images" (fino a 6)
 */
export async function createSegnalazione(input: SegnalazioneInput): Promise<SegnalazioneResponse> {
    // Validazioni rapide lato client (coerenti col backend)
    if (!input.nome?.trim()) throw new Error('Inserisci un nome.');
    if (!['kg', 'g', 'l', 'ml', 'pz'].includes(input.unitaMisura)) throw new Error('Unità di misura non valida.');
    if (!(input.quantita > 0)) throw new Error('La quantità deve essere > 0.');
    if (!input.indirizzoCentro?.trim()) throw new Error('Inserisci un indirizzo centro.');
    if (!input.shelflife?.trim()) throw new Error('Inserisci la data di shelf-life.');

    const imgs = input.images ?? [];
    if (imgs.length > 6) throw new Error('Puoi allegare al massimo 6 immagini.');

    // subito prima di creare il FormData, dopo la guardia max 6 immagini
    const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const blocked = imgs.find(img => {
        const t = (img.type || '').toLowerCase();
        const u = (img.uri || '').toLowerCase();
        const isExplicitlyBlocked = t.includes('heic') || t.includes('heif') || t.includes('gif')
            || u.endsWith('.heic') || u.endsWith('.heif') || u.endsWith('.gif');
        const hasTypeAndNotAllowed = t && ![...ALLOWED].some(a => t.startsWith(a));
        return isExplicitlyBlocked || hasTypeAndNotAllowed;
    });
    if (blocked) {
        throw new Error('Formato immagine non supportato. Usa JPEG / PNG / WEBP.');
    }

    const fd = new FormData();

    // Campi testuali:
    fd.append('nome', input.nome);
    if (input.descrizione) fd.append('descrizione', input.descrizione);
    fd.append('quantita', String(input.quantita));
    fd.append('unitaMisura', input.unitaMisura);
    if (input.prezzo !== undefined && input.prezzo !== null) {
        fd.append('prezzo', String(input.prezzo));
    }
    fd.append('indirizzoCentro', input.indirizzoCentro);
    fd.append('shelflife', input.shelflife);


    // Immagini
    for (let i = 0; i < (input.images?.length ?? 0); i++) {
        const { uri, name, type } = input.images![i];
        const fallback = `photo-${i + 1}.jpg`;

        // Se puoi, riusa i campi; altrimenti deduci
        const lower = (uri || '').toLowerCase();
        const ext =
            lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'jpg' :
                lower.endsWith('.png') ? 'png' :
                    lower.endsWith('.webp') ? 'webp' : 'jpg';
        const finalName = name || fallback.replace(/\.[^.]+$/, '') + '.' + ext;
        const finalType = type || (ext === 'png' ? 'image/png' :
            ext === 'webp' ? 'image/webp' : 'image/jpeg');

        // WEB → Blob
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            const resp = await fetch(uri);
            const blob = await resp.blob();

            const MAX_BYTES = 21 * 1024 * 1024; // 21MB
            if (blob.size > MAX_BYTES) {
                throw new Error('Immagine troppo grande (max 20 MB).'); // verrà intercettato dal catch del form
            }

            // terzo argomento = nome file → fondamentale per Multer
            fd.append('images', blob, finalName);
        } else {
            // Native (iOS/Android) → oggetto { uri, name, type }
            fd.append('images', { uri, name: finalName, type: finalType } as any);
        }
    }

    const { data } = await api.post<SegnalazioneResponse>('/segnalazioni', fd);

    return data;

}

export type StatoSegnalazione = 'inviata' | 'in_lavorazione' | 'chiusa';
export type EsitoSegnalazione = 'approvata' | 'rifiutata' | null;

export type SegnalazioneListItem = {
    id: number;
    nome: string;
    descrizione: string | null;
    quantita: number;
    unita_misura: UnitaMisura;
    prezzo: number | null;
    indirizzo_centro: string;
    shelflife: string;            // YYYY-MM-DD
    stato: StatoSegnalazione;
    esito: EsitoSegnalazione;
    messaggio_esito: string | null;
    creato_da: number;
    creato_il: string;
    aggiornato_il: string | null;
    images?: SegnalazioneImage[];
};

/**
 * Lista segnalazioni.
 * Parametri opzionali (se supportati dal backend):
 *  - stato: 'inviata' | 'in_lavorazione' | 'chiusa'
 *  - creato_da: id utente (per mostrare solo le mie)
 * Normalizza sia risposte in forma array che { items, count }.
 */
export async function listSegnalazioni(params?: {
    stato?: StatoSegnalazione;
    creato_da?: number;
}): Promise<SegnalazioneListItem[]> {
    const { data } = await api.get<SegnalazioneListItem[] | { items: SegnalazioneListItem[]; count?: number }>(
        '/segnalazioni',
        { params }
    );
    return Array.isArray(data) ? data : (data.items ?? []);
}

/** Dettaglio singola segnalazione (con images) */
export async function getSegnalazioneById(id: number): Promise<SegnalazioneResponse> {
    const { data } = await api.get<SegnalazioneResponse>(`/segnalazioni/${id}`);
    return data;
}

export async function startRevisione(id: number): Promise<{ success: boolean }> {
  const { data } = await api.post(`/segnalazioni/${id}/revisione/start`);
  return data;
}

// --- APPROVAZIONE (con controllo if_unmodified_at) ---
export async function approvaSegnalazione(
  id: number,
  payload: {
    nome: string;
    descrizione: string | null;
    indirizzoCentro: string | null;
    quantita: number;
    unitaMisura: 'kg' | 'g' | 'l' | 'ml' | 'pz';
    shelflife: string; // YYYY-MM-DD
    prezzo: number | null;
    if_unmodified_at?: string | null; // passiamo l’ultimo aggiornamento letto
  }
) {
  const { data } = await api.post(`/segnalazioni/${id}/revisione/approva`, payload);
  return data;
}

// --- RIFIUTO (con controllo if_unmodified_at) ---
export async function rifiutaSegnalazione(
  id: number,
  payload: { messaggio_esito: string; if_unmodified_at?: string | null }
) {
  const { data } = await api.post(`/segnalazioni/${id}/revisione/rifiuta`, payload);
  return data;
}

export async function deleteSegnalazione(id: number): Promise<void> {
  await api.delete(`/segnalazioni/${id}`);
}


