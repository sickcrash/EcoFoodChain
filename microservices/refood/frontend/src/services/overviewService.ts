// src/services/overviewService.ts
import axios from 'axios';
import { API_URL } from '../config/constants';

export type OverviewGenerali = {
  utentiRegistrati: number;
  lottiTotali: number;
  prenotazioniTotali: number;
  ciboSalvatoKg: number;
  co2RisparmiataKg: number;
  acquaRisparmiataL: number;
  valoreEconomicoEur: number;
  tonnellateRiciclate: number;
  alberiSalvati: number;
};

// Converte numeri o stringhe localizzate ("3.722", "4,5") in number
const toNum = (v: any) => {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (v == null) return 0;
  const s = String(v).replace(/\./g, '').replace(',', '.').trim();
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

export async function fetchOverviewGenerali(token: string): Promise<OverviewGenerali> {
  // 1) Statistiche complete (per serie/periodi e alcuni totali)
  const completeRes = await axios.get(`${API_URL}/statistiche/complete`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { periodo: 'ultimi_12_mesi' },
  });
  const complete = completeRes.data || {};

  // 2) Counters per KPI (totali aggregati)
  const countersRes = await axios.get(`${API_URL}/statistiche/counters`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const counters = countersRes.data || {};

  // 3) Impatto (CO2, acqua, valore, kg cibo)
  const impRes = await axios.get(`${API_URL}/statistiche/impatto`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const impatto = impRes.data || {};

  const utentiRegistrati = toNum(counters?.utenti?.totale);
  const lottiTotali = toNum(counters?.lotti?.totale);
  const prenotazioniTotali = toNum(counters?.prenotazioni?.totale);

  const ciboSalvatoKg = toNum(impatto?.cibo_salvato_kg || complete?.generali?.totaleAlimentiSalvati);
  const co2RisparmiataKg = toNum(impatto?.co2_risparmiata_kg || complete?.generali?.co2Risparmiata);
  const acquaRisparmiataL = toNum(impatto?.acqua_risparmiata_litri);
  const valoreEconomicoEur = toNum(impatto?.valore_economico_risparmiato || complete?.generali?.valoreEconomicoRisparmiato);
  const tonnellateRiciclate = Math.round((ciboSalvatoKg / 1000) * 100) / 100;
  const alberiSalvati = Math.round(co2RisparmiataKg / 22);

  return {
    utentiRegistrati,
    lottiTotali,
    prenotazioniTotali,
    ciboSalvatoKg,
    co2RisparmiataKg,
    acquaRisparmiataL,
    valoreEconomicoEur,
    tonnellateRiciclate,
    alberiSalvati,
  };
}
