// src/utils/normalizeCounters.ts

// ---------- util ----------
const toNumber = (v: any): number | undefined => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    // "3.722", "4,5" -> 3722, 4.5
    const s = v.replace(/\./g, '').replace(',', '.').trim();
    const n = Number(s);
    return isFinite(n) ? n : undefined;
  }
  return undefined;
};

const pickFirstNumber = (...vals: any[]) => {
  for (const v of vals) {
    const n = toNumber(v);
    if (typeof n === 'number') return n;
  }
  return 0;
};

const sumObjectNumbers = (obj: any): number | undefined => {
  if (!obj || typeof obj !== 'object') return undefined;
  let any = false;
  let sum = 0;
  for (const k of Object.keys(obj)) {
    const n = toNumber((obj as any)[k]);
    if (typeof n === 'number') {
      any = true;
      sum += n;
    }
  }
  return any ? sum : undefined;
};

const firstArrayLen = (...cands: any[]) => {
  for (const c of cands) {
    if (Array.isArray(c)) return c.length;
    if (c && typeof c === 'object') {
      if (Array.isArray((c as any).items))   return (c as any).items.length;
      if (Array.isArray((c as any).data))    return (c as any).data.length;
      if (Array.isArray((c as any).records)) return (c as any).records.length;
      if (Array.isArray((c as any).rows))    return (c as any).rows.length;
      if (Array.isArray((c as any).list))    return (c as any).list.length;
    }
  }
  return undefined;
};

// per i "conteggi" scegliamo il candidato più plausibile (minimo > 0)
const bestCountCandidate = (...cands: (number | undefined)[]) => {
  const vals = cands.filter((x): x is number => typeof x === 'number' && x > 0);
  if (vals.length === 0) return 0;
  return Math.min(...vals);
};

const normalizeNumericObject = (obj: any): Record<string, number> | undefined => {
  if (!obj || typeof obj !== 'object') return undefined;
  const out: Record<string, number> = {};
  let any = false;
  for (const k of Object.keys(obj)) {
    const n = toNumber(obj[k]);
    if (typeof n === 'number') { any = true; out[k] = n; }
  }
  return any ? out : undefined;
};

const OPEN_STATUS_HINTS = [
  /inviat/i,
  /lavor/i,
  /attesa/i,
  /pend/i,
  /apert/i,
  /gest/i,
  /progress/i,
  /review/i,
  /verific/i,
  /controll/i,
  /nuov/i,
];

const CLOSED_STATUS_HINTS = [
  /chius/i,
  /risolt/i,
  /complet/i,
  /archiv/i,
  /annull/i,
  /rifiut/i,
  /reject/i,
  /respint/i,
  /scart/i,
  /eliminat/i,
];

const sumOpenStatusesFromMap = (map?: Record<string, number>) => {
  if (!map) return undefined;
  let openSum = 0;
  let matchedOpen = false;
  for (const [key, value] of Object.entries(map)) {
    if (typeof value !== 'number' || !isFinite(value)) continue;
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (OPEN_STATUS_HINTS.some((pattern) => pattern.test(normalizedKey))) {
      openSum += value;
      matchedOpen = true;
    }
  }
  if (matchedOpen) return openSum;

  let fallbackSum = 0;
  let matchedFallback = false;
  for (const [key, value] of Object.entries(map)) {
    if (typeof value !== 'number' || !isFinite(value)) continue;
    const normalizedKey = key.toLowerCase();
    if (CLOSED_STATUS_HINTS.some((pattern) => pattern.test(normalizedKey))) continue;
    fallbackSum += value;
    matchedFallback = true;
  }
  return matchedFallback ? fallbackSum : undefined;
};

// ---------- tipi ----------
export type NormalizedCounters = {
  lotti: {
    attivi: number;
    inScadenza: number;
    totale: number;
    per_stato?: Record<string, number>;
  };
  prenotazioni: {
    attive: number;
    consegnate: number;
    totale: number;
  };
  segnalazioni: { aperte: number; per_stato?: Record<string, number>; };
  attivita?: {
    lotti_inseriti_oggi: number;
    prenotazioni_oggi: number;
    cambi_stato: number;
    oggi?: number; // opzionale se il backend lo fornisce già aggregato
  };
  operatore?: {
    lotti_inseriti: number;
    lotti_attivi: number;
    lotti_della_settimana?: number;
    kg_salvati?: number;
  };
};

// ---------- pick root / sezioni ----------
const pickRoot = (raw: any) => {
  if (!raw || typeof raw !== 'object') return {};
  const cands = [
    raw,
    raw.data, raw.result, raw.payload, raw.response,
    raw.counters, raw.counts, raw.metrics,
    raw.kpi, raw.kpis,
    raw.statistiche, raw.statistic, raw.stats,
    raw.overview, raw.summary,
  ];
  return cands.find((o) => o && typeof o === 'object') ?? {};
};

const findSection = (base: any, aliases: string[]) => {
  const containers = [
    base,
    base.counters, base.counts, base.metrics,
    base.kpi, base.kpis,
    base.statistiche, base.stats,
    base.overview, base.summary,
  ].filter(Boolean);

  for (const box of containers) {
    for (const key of aliases) {
      if (box && Object.prototype.hasOwnProperty.call(box, key)) {
        return box[key];
      }
    }
  }
  return undefined;
};

// ---------- normalizzazione ----------
export function normalizeCounters(raw: any): NormalizedCounters {
  const root = pickRoot(raw);

  const LOTTI_KEYS = ['lotti', 'lots', 'batches'];
  const PREN_KEYS  = ['prenotazioni', 'bookings', 'reservations', 'orders'];
  const SEGN_KEYS  = ['segnalazioni', 'alerts', 'issues', 'reports', 'tickets'];
  const ATTI_KEYS  = ['attivita', 'activity', 'activities', 'kpi_oggi', 'today'];
  const OPER_KEYS  = ['operatore', 'operator', 'utente', 'user', 'me'];

  const lotti = findSection(root, LOTTI_KEYS) ?? {};
  const pren  = findSection(root, PREN_KEYS) ?? {};
  let segn    = findSection(root, SEGN_KEYS);
  const atti  = findSection(root, ATTI_KEYS) ?? {};
  const oper  = findSection(root, OPER_KEYS) ?? {};

  // segnalazioni come array/numero
  if (Array.isArray(segn)) segn = { aperte: segn.length };
  if (typeof segn === 'number') segn = { aperte: segn };
  if (!segn || typeof segn !== 'object') segn = {};

  // ---- Lotti ----
  const perStatoRaw = (lotti.per_stato ?? lotti.by_state ?? lotti.perStato) || {};
  const perStatoSum = sumObjectNumbers(perStatoRaw);
  const listLen     = firstArrayLen(lotti, lotti.list, lotti.items, lotti.data, lotti.records);

  const attiviFromKeys = pickFirstNumber(
    lotti.attivi_count, lotti.count_attivi, lotti.distinct_attivi,
    lotti.active_count, lotti.active, lotti.attivi
  );

  const lottiAttivi = bestCountCandidate(
    attiviFromKeys,
    toNumber(perStatoSum),
    toNumber(listLen)
  );

  const inScadenza = pickFirstNumber(
    lotti.in_scadenza_count, lotti.count_in_scadenza,
    lotti.expiring_count, lotti.expiring, lotti.in_scadenza
  );

  const lottiTot = pickFirstNumber(
    lotti.totale_count, lotti.count_totale, lotti.distinct_totale,
    lotti.total, lotti.count, lotti.totale
  );

  // ---- Prenotazioni ----
  const prenStati    = (pren.per_stato ?? pren.by_state ?? pren.perStato) || {};
  const prenStatiSum = sumObjectNumbers(prenStati);
  const prenListLen  = firstArrayLen(pren, pren.items, pren.data, pren.records, pren.list);

  const prenAttiveFromKeys = pickFirstNumber(
    pren.attive_count, pren.count_attive, pren.totale_attive,
    pren.active_count, pren.active, pren.attive
  );

  const prenAttive = bestCountCandidate(
    prenAttiveFromKeys,
    toNumber(prenStatiSum),
    toNumber(prenListLen)
  );

  const prenConsegnate = pickFirstNumber(
    pren.consegnate_count, pren.count_consegnate,
    pren.delivered_count, pren.completed_count, pren.consegnate
  );

  const prenTot = pickFirstNumber(
    pren.totale_count, pren.count_totale, pren.distinct_totale,
    pren.total, pren.count, pren.totale
  );

  // ---- Segnalazioni ----
  const segnPerStatoRaw = (segn.per_stato ?? segn.by_state ?? segn.perStato) || {};
  const segnPerStato = normalizeNumericObject(segnPerStatoRaw);
  const segnOpenCandidates = [
    (segn as any).aperte,
    (segn as any).aperte_count,
    (segn as any).aperteTotali,
    (segn as any).aperti,
    (segn as any).aperti_count,
    (segn as any).open,
    (segn as any).open_count,
    (segn as any).openCount,
    (segn as any).total_open,
    (segn as any).totale_open,
    (segn as any).totale_aperte,
    (segn as any).totale_aperti,
    (segn as any).non_risolte,
    (segn as any).pending,
    (segn as any).da_gestire,
    (segn as any).attive,
    (segn as any).in_lavorazione,
    (segn as any).inviate,
    (segn as any).in_revisione,
    (segn as any).inReview,
  ];
  let segnAperte = pickFirstNumber(...segnOpenCandidates);
  const hasDirectSegnalazioni = segnOpenCandidates.some((value) => toNumber(value) !== undefined);
  if (!hasDirectSegnalazioni) {
    const openFromStates = sumOpenStatusesFromMap(segnPerStato);
    if (typeof openFromStates === "number") {
      segnAperte = openFromStates;
    } else {
      const segnListLen = firstArrayLen(
        segn,
        (segn as any).items,
        (segn as any).data,
        (segn as any).records,
        (segn as any).rows,
        (segn as any).list
      );
      if (typeof segnListLen === "number" && segnListLen > 0) {
        segnAperte = segnListLen;
      } else {
        const perStatoTotal = sumObjectNumbers(segnPerStato);
        if (typeof perStatoTotal === "number" && perStatoTotal > 0) {
          segnAperte = perStatoTotal;
        } else {
          const totalFallback = pickFirstNumber(
            (segn as any).totale,
            (segn as any).totale_segnalazioni,
            (segn as any).total,
            (segn as any).count
          );
          if (totalFallback > 0) segnAperte = totalFallback;
        }
      }
    }
  }

  // ---- Attività oggi ----
  const attivita = {
    lotti_inseriti_oggi: pickFirstNumber(
      atti.lotti_inseriti_oggi, atti.created_today, atti.lotti_oggi, atti.nuovi_oggi
    ),
    prenotazioni_oggi: pickFirstNumber(
      atti.prenotazioni_oggi, atti.bookings_today, atti.pren_oggi
    ),
    cambi_stato: pickFirstNumber(
      atti.cambi_stato, atti.status_changes_today
    ),
    oggi: pickFirstNumber(atti.oggi, atti.totale_oggi, atti.total_today),
  };

  // ---- Operatore (card personale) ----
  const operatore = {
    lotti_inseriti: pickFirstNumber(
      oper.lotti_inseriti, oper.inserted, oper.created, oper.created_lots, oper.created_count,
      firstArrayLen(oper.lotti, oper.my_lots, oper.items)
    ),
    lotti_attivi: pickFirstNumber(
      oper.lotti_attivi, oper.active_lots, oper.attivi
    ),
    lotti_della_settimana: pickFirstNumber(
      oper.lotti_della_settimana, oper.this_week, oper.week_lots
    ),
    kg_salvati: pickFirstNumber(
      oper.kg_salvati, oper.cibo_salvato_kg, oper.saved_kg, oper.food_saved_kg
    ),
  };

  const lottiPerStato = normalizeNumericObject(perStatoRaw);

  return {
    lotti: { attivi: lottiAttivi, inScadenza, totale: lottiTot, per_stato: lottiPerStato },
    prenotazioni: { attive: prenAttive, consegnate: prenConsegnate, totale: prenTot },
    segnalazioni: { aperte: segnAperte, per_stato: segnPerStato },
    attivita,
    operatore,
  };
}
