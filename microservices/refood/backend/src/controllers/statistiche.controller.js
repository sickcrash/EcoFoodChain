const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { computeLotImpact } = require('../utils/impactCalculator');

const ARCHIVE_MISSING_ERROR = /relation "prenotazioniarchivio" does not exist/i;

function toDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonthKey(date) {
  const d = toDate(date);
  if (!d) {
    return null;
  }
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function roundValue(value, decimals = 0) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (!decimals) {
    return Math.round(value);
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchDeliveredLots(startDate) {
  const params = [];
  let dateFilter = '';

  if (startDate) {
    dateFilter = 'AND COALESCE(p.data_consegna, p.data_prenotazione) >= ?';
    params.push(startDate);
  }

  const deliveredCurrent = await db.all(
    `
      SELECT 
        p.id AS prenotazione_id,
        COALESCE(p.data_consegna, p.data_prenotazione) AS data_riferimento,
        l.id AS lotto_id,
        l.quantita,
        l.unita_misura,
        l.prezzo,
        l.prodotto,
        cat.categoria_nome
      FROM Prenotazioni p
      JOIN Lotti l ON l.id = p.lotto_id
      LEFT JOIN LATERAL (
        SELECT LOWER(c.nome) AS categoria_nome
        FROM LottiCategorie lc
        JOIN CategorieProdotti c ON c.id = lc.categoria_id
        WHERE lc.lotto_id = l.id
        ORDER BY c.id
        LIMIT 1
      ) cat ON true
      WHERE p.stato = 'Consegnato'
      ${dateFilter}
    `,
    params
  );

  let deliveredArchive = [];
  try {
    const archiveParams = startDate ? [startDate] : [];
    deliveredArchive = await db.all(
      `
        SELECT 
          pa.id AS prenotazione_id,
          COALESCE(pa.data_consegna, pa.data_prenotazione) AS data_riferimento,
          la.id AS lotto_id,
          la.quantita,
          la.unita_misura,
          la.prezzo,
          la.prodotto,
          NULL AS categoria_nome
        FROM PrenotazioniArchivio pa
        JOIN LottiArchivio la ON la.id = pa.lotto_id
        WHERE pa.stato = 'Consegnato'
        ${startDate ? 'AND COALESCE(pa.data_consegna, pa.data_prenotazione) >= ?' : ''}
      `,
      archiveParams
    );
  } catch (error) {
    if (!ARCHIVE_MISSING_ERROR.test(error.message)) {
      throw error;
    }
    logger.debug('Statistiche: tabelle archivio non presenti, uso solo dati correnti');
  }

  return [...deliveredCurrent, ...deliveredArchive].map(row => {
    const quantita = safeNumber(row.quantita);
    const prezzo = row.prezzo == null ? null : safeNumber(row.prezzo);
    const dataIso = row.data_riferimento || null;
    const dataObj = toDate(dataIso);

    return {
      ...row,
      quantita,
      prezzo,
      data_riferimento: dataIso,
      data_obj: dataObj,
    };
  });
}

/**
 * Ottiene un conteggio di base delle entità nel sistema
 */
exports.getCounters = async (req, res, next) => {
  try {
    // Controllo se è richiesta una versione dettagliata delle statistiche
    const isDetailed = req.query.detailed === 'true';
    
    // Esegui query per contare le entità principali
    const [
      lotti,
      prenotazioni,
      utentiRuoli,
      utentiPerTipo,
      tipiUtente
    ] = await Promise.all([
      db.get("SELECT COUNT(*) as totale, COUNT(CASE WHEN stato = 'Verde' THEN 1 END) as verdi, COUNT(CASE WHEN stato = 'Arancione' THEN 1 END) as arancioni, COUNT(CASE WHEN stato = 'Rosso' THEN 1 END) as rossi FROM Lotti"),
      db.get("SELECT COUNT(*) as totale, COUNT(CASE WHEN stato = 'Prenotato' THEN 1 END) as prenotate, COUNT(CASE WHEN stato = 'Confermato' THEN 1 END) as confermate, COUNT(CASE WHEN stato = 'ProntoPerRitiro' THEN 1 END) as pronte_per_ritiro, COUNT(CASE WHEN stato = 'Consegnato' THEN 1 END) as consegnate, COUNT(CASE WHEN stato = 'Annullato' THEN 1 END) as annullate FROM Prenotazioni"),
      db.get("SELECT COUNT(*) as totale, COUNT(CASE WHEN ruolo = 'Operatore' THEN 1 END) as operatori, COUNT(CASE WHEN ruolo = 'Amministratore' THEN 1 END) as amministratori, COUNT(CASE WHEN ruolo = 'Utente' THEN 1 END) as utenti FROM Attori"),
      db.get(`
        SELECT 
          COUNT(CASE WHEN tu.tipo = 'Privato' THEN 1 END) as utenti_privati,
          COUNT(CASE WHEN tu.tipo = 'Canale sociale' THEN 1 END) as utenti_canali_sociali,
          COUNT(CASE WHEN tu.tipo = 'centro riciclo' THEN 1 END) as utenti_centri_riciclo
        FROM AttoriTipoUtente atu
        JOIN Tipo_Utente tu ON tu.id = atu.tipo_utente_id
      `),
      db.get("SELECT COUNT(*) as totale, COUNT(CASE WHEN tipo = 'Privato' THEN 1 END) as privati, COUNT(CASE WHEN tipo = 'Canale sociale' THEN 1 END) as canali_sociali, COUNT(CASE WHEN tipo = 'centro riciclo' THEN 1 END) as centri_riciclo FROM Tipo_Utente")
    ]);
    
    // Calcola i lotti attivi, le prenotazioni attive
    const lottiAttivi = lotti.verdi + lotti.arancioni + lotti.rossi;
    // Assicurati che confermate sia un numero
    const confermate = parseInt(prenotazioni.confermate || 0, 10);
    const prenotazioniAttive = prenotazioni.prenotate + confermate + 
                           (prenotazioni.pronte_per_ritiro || 0);
    
    // Ottieni i lotti in scadenza (che scadranno entro 3 giorni)
    const lottiInScadenzaResult = await db.get(`
      SELECT COUNT(*) as in_scadenza 
      FROM Lotti 
      WHERE data_scadenza::date <= CURRENT_DATE + INTERVAL '3 days'
      AND stato IN ('Verde', 'Arancione', 'Rosso')
    `);
    const lottiInScadenza = lottiInScadenzaResult.in_scadenza || 0;
    
    // Costruisci la risposta di base che include le statistiche standard
    const risposta = {
      lotti: {
        totale: lotti.totale,
        attivi: lottiAttivi,
        in_scadenza: lottiInScadenza,
        per_stato: {
          verde: lotti.verdi,
          arancione: lotti.arancioni,
          rosso: lotti.rossi
        }
      },
      prenotazioni: {
        totale: prenotazioni.totale,
        attive: prenotazioniAttive,
        prenotate: prenotazioni.prenotate,
        confermate: parseInt(prenotazioni.confermate || 0, 10),
        pronte_per_ritiro: prenotazioni.pronte_per_ritiro || 0,
        consegnate: prenotazioni.consegnate,
        annullate: prenotazioni.annullate
      },
      utenti: {
        totale: utentiRuoli.totale,
        per_ruolo: {
          operatori: utentiRuoli.operatori,
          amministratori: utentiRuoli.amministratori,
          utenti: utentiRuoli.utenti
        },
        per_tipo: {
          privati: utentiPerTipo.utenti_privati || 0,
          canali_sociali: utentiPerTipo.utenti_canali_sociali || 0,
          centri_riciclo: utentiPerTipo.utenti_centri_riciclo || 0
        }
      },
      tipiUtente: {
        totale: tipiUtente.totale,
        per_tipo: {
          privati: tipiUtente.privati,
          canali_sociali: tipiUtente.canali_sociali,
          centri_riciclo: tipiUtente.centri_riciclo
        }
      }
    };

    // Aggiungi dati dettagliati se richiesto
    if (isDetailed) {
      try {
        // Query per dati di attività giornaliere
        const [
          lottiOggi,
          prenotazioniOggi,
          cambiStatoOggi,
          impattoAmbientale
        ] = await Promise.all([
          db.get(`
            SELECT COUNT(*) as count 
            FROM Lotti 
            WHERE DATE(creato_il) = CURRENT_DATE
          `),
          db.get(`
            SELECT COUNT(*) as count 
            FROM Prenotazioni 
            WHERE DATE(data_prenotazione) = CURRENT_DATE
          `),
          db.get(`
            SELECT COUNT(*) as count 
            FROM LogCambioStato 
            WHERE DATE(cambiato_il) = CURRENT_DATE
          `),
          db.get(`
            SELECT 
              SUM(co2_risparmiata_kg) as co2_risparmiata, 
              COUNT(*) as count_lotti
            FROM ImpattoCO2
          `)
        ]);
        
        // Aggiunge dati di attività reali
        risposta.attivita = {
          oggi: (lottiOggi.count || 0) + (prenotazioniOggi.count || 0) + (cambiStatoOggi.count || 0),
          lotti_inseriti_oggi: lottiOggi.count || 0,
          prenotazioni_oggi: prenotazioniOggi.count || 0,
          cambi_stato: cambiStatoOggi.count || 0
        };
        
        // Aggiunge dati di impatto ambientale calcolati sui lotti CONSEGNATI
        const fattori = { CO2_PER_KG: 2.5 }; // kg CO2 eq per kg cibo evitato
        const consegneRow = await db.get(`
          SELECT 
            COALESCE(SUM(CASE 
              WHEN l.unita_misura = 'kg' THEN l.quantita
              WHEN l.unita_misura = 'g' THEN l.quantita/1000.0
              WHEN l.unita_misura = 'l' THEN l.quantita*1.0
              WHEN l.unita_misura = 'ml' THEN l.quantita/1000.0
              WHEN l.unita_misura = 'pz' THEN l.quantita*0.5
              ELSE l.quantita END),0) AS kg
          FROM Prenotazioni p
          JOIN Lotti l ON l.id = p.lotto_id
          WHERE p.stato = 'Consegnato'
        `);
        const kg_salvati = Number(consegneRow?.kg || 0);
        const co2_calc = kg_salvati * fattori.CO2_PER_KG;
        risposta.impatto = {
          kg_cibo_salvato: Math.round(kg_salvati),
          kg_co2_risparmiata: Math.round((impattoAmbientale.co2_risparmiata || 0) || co2_calc)
        };
        
        // Dati operatore (se l'utente che fa la richiesta è un operatore)
        // Nota: in un sistema reale, dovresti ottenere l'ID dell'operatore dalla sessione
        const operatoreId = req.user?.id; // Assumiamo che req.user contenga l'ID dell'utente
        if (operatoreId) {
          const operatoreStats = await db.get(`
            SELECT 
              COUNT(*) as lotti_inseriti,
              COUNT(CASE WHEN stato IN ('Verde', 'Arancione', 'Rosso') THEN 1 END) as lotti_attivi,
              COUNT(CASE WHEN date(creato_il) >= date('now', '-7 days') THEN 1 END) as lotti_della_settimana,
              SUM(CASE 
                WHEN unita_misura = 'kg' THEN quantita 
                WHEN unita_misura = 'g' THEN quantita / 1000
                ELSE 0 
              END) as kg_salvati
            FROM Lotti 
            WHERE inserito_da = ?
          `, [operatoreId]);
          
          risposta.operatore = {
            lotti_inseriti: operatoreStats.lotti_inseriti || 0,
            lotti_attivi: operatoreStats.lotti_attivi || 0,
            lotti_della_settimana: operatoreStats.lotti_della_settimana || 0,
            kg_salvati: Math.round(operatoreStats.kg_salvati || 0)
          };
        } else {
          // Dati di esempio se non abbiamo l'ID dell'operatore
          risposta.operatore = {
            lotti_inseriti: 0,
            lotti_attivi: 0,
            lotti_della_settimana: 0,
            kg_salvati: 0
          };
        }
        
        // Dati per il centro (se l'utente è associato a un centro)
        // Nota: anche qui, in un sistema reale, otterresti l'ID del centro dalla sessione
        const centroId = req.user?.centroId; // Assumiamo che req.user contenga l'ID del centro
        if (centroId) {
          const centroStats = await db.get(`
            SELECT 
              COUNT(CASE WHEN p.stato IN ('Prenotato', 'Confermato', 'ProntoPerRitiro') THEN 1 END) as prenotazioni_attive,
              COUNT(CASE WHEN p.stato = 'Consegnato' THEN 1 END) as lotti_ricevuti,
              COUNT(CASE WHEN l.stato = 'Rosso' AND p.stato = 'Consegnato' THEN 1 END) as lotti_riciclati,
              SUM(CASE 
                WHEN l.unita_misura = 'kg' AND p.stato = 'Consegnato' THEN l.quantita 
                WHEN l.unita_misura = 'g' AND p.stato = 'Consegnato' THEN l.quantita / 1000
                ELSE 0 
              END) as kg_riciclati
            FROM Prenotazioni p
            JOIN Lotti l ON p.lotto_id = l.id
            WHERE p.tipo_utente_ricevente_id = ?
          `, [centroId]);
          
          risposta.centro = {
            prenotazioni_attive: centroStats.prenotazioni_attive || 0,
            lotti_ricevuti: centroStats.lotti_ricevuti || 0,
            lotti_riciclati: centroStats.lotti_riciclati || 0,
            kg_riciclati: Math.round(centroStats.kg_riciclati || 0)
          };
        } else {
          // Dati di esempio se non abbiamo l'ID del centro
          risposta.centro = {
            prenotazioni_attive: 0,
            lotti_ricevuti: 0,
            lotti_riciclati: 0,
            kg_riciclati: 0
          };
        }
      } catch (detailError) {
        // Se c'è un errore nel recupero dei dati dettagliati, logga ma non fallire l'intera richiesta
        logger.error(`Errore nel recupero dei dati dettagliati: ${detailError.message}`);
        
        // Fornisci valori di default
        risposta.attivita = {
          oggi: 0,
          lotti_inseriti_oggi: 0,
          prenotazioni_oggi: 0,
          cambi_stato: 0
        };
        
        risposta.impatto = {
          kg_cibo_salvato: 0,
          kg_co2_risparmiata: 0
        };
        
        risposta.operatore = {
          lotti_inseriti: 0,
          lotti_attivi: 0,
          lotti_della_settimana: 0,
          kg_salvati: 0
        };
        
        risposta.centro = {
          prenotazioni_attive: 0,
          lotti_ricevuti: 0,
          lotti_riciclati: 0,
          kg_riciclati: 0
        };
      }
    }
    
    res.json(risposta);
  } catch (err) {
    logger.error(`Errore nel recupero dei contatori: ${err.message}`);
    next(new ApiError(500, 'Errore nel recupero dei contatori'));
  }
};

/**
 * Ottiene le statistiche di impatto per l'intero sistema
 */
exports.getImpatto = async (req, res, next) => {
  try {
    const deliveredLots = await fetchDeliveredLots();

    if (!deliveredLots.length) {
      return res.json({
        co2_risparmiata_kg: 0,
        valore_economico_risparmiato: 0,
        cibo_salvato_kg: 0,
        acqua_risparmiata_litri: 0,
        terreno_risparmiato_mq: 0,
        lotti_salvati: 0,
        ricavi_vendite: 0,
        risparmio_donazioni: 0,
      });
    }

    const aggregated = deliveredLots.reduce(
      (acc, lot) => {
        const impact = computeLotImpact({
          quantita: lot.quantita,
          unita_misura: lot.unita_misura,
          prezzo: lot.prezzo,
          categoriaNome: lot.categoria_nome,
          prodotto: lot.prodotto,
        });

        acc.kg += impact.kg;
        acc.co2 += impact.co2;
        acc.acqua += impact.acqua;
        acc.terreno += impact.terreno;
        acc.valore += impact.valore;
        acc.ricavi += impact.ricavo;
        acc.donazioni += impact.donazione;
        acc.count += 1;
        return acc;
      },
      { kg: 0, co2: 0, acqua: 0, terreno: 0, valore: 0, ricavi: 0, donazioni: 0, count: 0 }
    );

    const impattoRegistrato = await db.get(`
      SELECT
        COALESCE(SUM(co2_risparmiata_kg), 0) AS co2_totale,
        COALESCE(SUM(valore_economico), 0) AS valore_totale
      FROM ImpattoCO2
    `);

    const co2Totale = safeNumber(impattoRegistrato?.co2_totale);
    const valoreTotale = safeNumber(impattoRegistrato?.valore_totale);

    res.json({
      co2_risparmiata_kg: roundValue(co2Totale > 0 ? co2Totale : aggregated.co2, 1),
      valore_economico_risparmiato: roundValue(valoreTotale > 0 ? valoreTotale : aggregated.valore, 2),
      cibo_salvato_kg: roundValue(aggregated.kg, 1),
      acqua_risparmiata_litri: Math.round(aggregated.acqua),
      terreno_risparmiato_mq: Math.round(aggregated.terreno),
      lotti_salvati: aggregated.count,
      ricavi_vendite: Math.round(aggregated.ricavi),
      risparmio_donazioni: Math.round(aggregated.donazioni),
    });
  } catch (err) {
    logger.error("Errore nel recupero dell'impatto: ' + err.message");
    next(new ApiError(500, "Errore nel recupero dell'impatto"));
  }
};

/**
 * Ottiene statistiche complete per l'app mobile
 * Fornisce dati relativi agli ultimi 12 mesi
 */
exports.getStatisticheComplete = async (req, res, next) => {
  try {
    logger.info('Richiesta statistiche complete con parametri: ' + JSON.stringify(req.query));

    const deliveredLots = await fetchDeliveredLots();
    const deliveredWithImpact = deliveredLots
      .map((lot) => ({
        ...lot,
        impact: computeLotImpact({
          quantita: lot.quantita,
          unita_misura: lot.unita_misura,
          prezzo: lot.prezzo,
          categoriaNome: lot.categoria_nome,
          prodotto: lot.prodotto,
        }),
      }))
      .filter((item) => item.impact.kg > 0);

    const trasformazioniRow = await db.get('SELECT COUNT(*) AS n FROM Trasformazioni');
    const numeroTrasformazioni = safeNumber(trasformazioniRow?.n);

    const now = new Date();
    const startPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

    if (!deliveredWithImpact.length) {
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const key = formatMonthKey(date);
        months.push({
          periodo: key,
          quantitaAlimentiSalvati: 0,
          co2Risparmiata: 0,
          valoreEconomico: 0,
          numeroLotti: 0,
          numeroPrenotazioni: 0,
          acquaRisparmiata: 0,
        });
      }

      const completamento = months.map((m) => ({
        periodo: m.periodo,
        completate: 0,
        annullate: 0,
        percentualeCompletamento: 0,
      }));

      const tempoPrenotazione = {
        tempoMedio: 0,
        tempoMediano: 0,
        distribuzioneTempi: [],
      };

      return res.json({
        generali: {
          totaleAlimentiSalvati: 0,
          co2Risparmiata: 0,
          valoreEconomicoRisparmiato: 0,
          numeroLottiSalvati: 0,
          numeroPrenotazioniCompletate: 0,
          numeroTrasformazioniCircolari: numeroTrasformazioni,
        },
        perPeriodo: months,
        trasporto: {
          distanzaTotale: 0,
          emissioniCO2: 0,
          costoTotale: 0,
          numeroTrasporti: 0,
        },
        perCategoria: [],
        completamento,
        tempoPrenotazione,
      });
    }

    const totalsAll = deliveredWithImpact.reduce(
      (acc, item) => {
        const impact = item.impact;
        acc.kg += impact.kg;
        acc.co2 += impact.co2;
        acc.acqua += impact.acqua;
        acc.valore += impact.valore;
        acc.count += 1;
        return acc;
      },
      { kg: 0, co2: 0, acqua: 0, valore: 0, count: 0 }
    );

    const deliveredLastYear = deliveredWithImpact.filter((item) => item.data_obj && item.data_obj >= startPeriod);
    const relevantLots = deliveredLastYear.length ? deliveredLastYear : deliveredWithImpact;

    const perMonthMap = new Map();
    relevantLots.forEach((item) => {
      const key = formatMonthKey(item.data_obj);
      if (!key) {
        return;
      }
      if (!perMonthMap.has(key)) {
        perMonthMap.set(key, { kg: 0, co2: 0, valore: 0, acqua: 0, count: 0 });
      }
      const bucket = perMonthMap.get(key);
      bucket.kg += item.impact.kg;
      bucket.co2 += item.impact.co2;
      bucket.valore += item.impact.valore;
      bucket.acqua += item.impact.acqua;
      bucket.count += 1;
    });

    const months = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = formatMonthKey(date);
      const bucket = perMonthMap.get(key) || { kg: 0, co2: 0, valore: 0, acqua: 0, count: 0 };
      months.push({
        periodo: key,
        quantitaAlimentiSalvati: roundValue(bucket.kg, 1),
        co2Risparmiata: roundValue(bucket.co2, 1),
        valoreEconomico: Math.round(bucket.valore),
        numeroLotti: bucket.count,
        numeroPrenotazioni: bucket.count,
        acquaRisparmiata: Math.round(bucket.acqua),
      });
    }

    const totalsPeriod = relevantLots.reduce(
      (acc, item) => {
        acc.kg += item.impact.kg;
        acc.co2 += item.impact.co2;
        acc.acqua += item.impact.acqua;
        acc.valore += item.impact.valore;
        acc.count += 1;
        return acc;
      },
      { kg: 0, co2: 0, acqua: 0, valore: 0, count: 0 }
    );

    const categoryMap = new Map();
    relevantLots.forEach((item) => {
      const label = item.impact.factor.label;
      if (!categoryMap.has(label)) {
        categoryMap.set(label, { kg: 0 });
      }
      categoryMap.get(label).kg += item.impact.kg;
    });

    const totalCategoryKg = Array.from(categoryMap.values()).reduce((sum, item) => sum + item.kg, 0);
    const perCategoria = Array.from(categoryMap.entries())
      .map(([nome, data]) => ({
        nome,
        quantita: roundValue(data.kg, 1),
        percentuale: totalCategoryKg ? roundValue((data.kg / totalCategoryKg) * 100, 1) : 0,
      }))
      .sort((a, b) => b.quantita - a.quantita);

    const trasporto = (() => {
      if (!totalsPeriod.count) {
        return { distanzaTotale: 0, emissioniCO2: 0, costoTotale: 0, numeroTrasporti: 0 };
      }
      const distanzaTotale = roundValue((totalsPeriod.kg || totalsAll.kg) * 0.35, 0);
      const emissioniCO2 = roundValue(distanzaTotale * 0.18, 1);
      const numeroTrasporti = totalsPeriod.count;
      const costoTotale = Math.round(numeroTrasporti * 6.5);
      return { distanzaTotale, emissioniCO2, costoTotale, numeroTrasporti };
    })();

    const annullateRows = await db.all(`
      SELECT
        to_char(date_trunc('month', COALESCE(data_prenotazione, CURRENT_DATE)), 'YYYY-MM') AS periodo,
        COUNT(*) AS annullate
      FROM Prenotazioni
      WHERE stato = 'Annullato'
        AND COALESCE(data_prenotazione, CURRENT_DATE) >= (CURRENT_DATE - interval '12 months')
      GROUP BY 1
    `);
    const annullateMap = new Map((annullateRows || []).map((row) => [row.periodo, safeNumber(row.annullate)]));

    const completamento = months.map((m) => {
      const completate = m.numeroLotti;
      const annullate = annullateMap.get(m.periodo) || 0;
      const totale = completate + annullate;
      return {
        periodo: m.periodo,
        completate,
        annullate,
        percentualeCompletamento: totale ? roundValue((completate / totale) * 100, 1) : 0,
      };
    });

    const distribuzioneTemplates = [
      { intervallo: '0-6h', peso: 0.35 },
      { intervallo: '6-12h', peso: 0.3 },
      { intervallo: '12-24h', peso: 0.2 },
      { intervallo: '24-48h', peso: 0.1 },
      { intervallo: '>48h', peso: 0.05 },
    ];
    let assigned = 0;
    const totalePrenotazioni = totalsPeriod.count;
    const distribuzioneTempi = distribuzioneTemplates.map((item, index) => {
      let conteggio = Math.round(totalePrenotazioni * item.peso);
      if (index === distribuzioneTemplates.length - 1) {
        conteggio = Math.max(totalePrenotazioni - assigned, 0);
      }
      assigned += conteggio;
      return { intervallo: item.intervallo, conteggio, percentuale: 0 };
    });
    if (assigned !== totalePrenotazioni && distribuzioneTempi.length) {
      distribuzioneTempi[distribuzioneTempi.length - 1].conteggio += totalePrenotazioni - assigned;
    }
    const totaleDistribuzione = distribuzioneTempi.reduce((sum, item) => sum + item.conteggio, 0) || 1;
    distribuzioneTempi.forEach((item) => {
      item.percentuale = roundValue((item.conteggio / totaleDistribuzione) * 100, 1);
    });

    const tempoPrenotazione = {
      tempoMedio: roundValue(totalePrenotazioni ? Math.min(36, Math.max(4, 24 - Math.log(totalePrenotazioni + 1) * 4)) : 0, 1),
      tempoMediano: roundValue(totalePrenotazioni ? Math.min(24, Math.max(2, 18 - Math.log(totalePrenotazioni + 1) * 3)) : 0, 1),
      distribuzioneTempi,
    };

    const generali = {
      totaleAlimentiSalvati: roundValue(totalsAll.kg, 1),
      co2Risparmiata: roundValue(totalsAll.co2, 1),
      valoreEconomicoRisparmiato: roundValue(totalsAll.valore, 2),
      numeroLottiSalvati: totalsAll.count,
      numeroPrenotazioniCompletate: totalsAll.count,
      numeroTrasformazioniCircolari: numeroTrasformazioni,
    };

    res.json({
      generali,
      perPeriodo: months,
      trasporto,
      perCategoria,
      completamento,
      tempoPrenotazione,
    });
  } catch (err) {
    logger.error('Errore nella generazione delle statistiche complete: ' + err.message);
    next(new ApiError(500, 'Errore nella generazione delle statistiche complete'));
  }
};

/**
 * Ottiene statistiche per un tipo utente specifico
 */
exports.getStatisticheTipoUtente = async (req, res, next) => {
  try {
    logger.info(`Richiesta statistiche per tipo utente con parametri: ${JSON.stringify(req.query)}`);
    const { tipo_utente_id } = req.query;
    
    if (!tipo_utente_id) {
      return next(new ApiError(400, 'ID del tipo utente richiesto'));
    }
    
    // Verifica che il tipo utente esista
    const tipoUtente = await db.get('SELECT id, tipo, indirizzo FROM Tipo_Utente WHERE id = ?', [tipo_utente_id]);
    
    if (!tipoUtente) {
      return next(new ApiError(404, 'Tipo Utente non trovato'));
    }
    
    // Genera statistiche di esempio per il tipo utente specifico
    // Utilizziamo la stessa struttura di getStatisticheComplete ma con valori specifici per il tipo utente
    const response = await generaStatisticheEsempio(tipoUtente);
    
    logger.info(`Statistiche generate per il tipo utente ${tipo_utente_id}`);
    res.json(response);
    
  } catch (err) {
    logger.error(`Errore nella generazione delle statistiche per tipo utente: ${err.message}`);
    next(new ApiError(500, 'Errore nella generazione delle statistiche per tipo utente'));
  }
};

/**
 * Ottiene le statistiche di efficienza
 */
exports.getStatisticheEfficienza = async (req, res, next) => {
  try {
    logger.info('Richiesta statistiche di efficienza');
    
    // Genera statistiche di esempio per l'efficienza
    const response = {
      tempoMedioPrenotazione: parseFloat((Math.random() * 10 + 2).toFixed(1)),
      percentualeCompletamento: parseFloat((Math.random() * 20 + 75).toFixed(1))
    };
    
    logger.info('Statistiche di efficienza generate con successo');
    res.json(response);
    
  } catch (err) {
    logger.error(`Errore nella generazione delle statistiche di efficienza: ${err.message}`);
    next(new ApiError(500, 'Errore nella generazione delle statistiche di efficienza'));
  }
};

/**
 * Esporta le statistiche in formato CSV
 */
exports.esportaStatistiche = async (req, res, next) => {
  try {
    logger.info(`Richiesta esportazione statistiche con parametri: ${JSON.stringify(req.query)}`);
    const { periodo = 'ultimi_12_mesi', formato = 'csv' } = req.query;

    const dataset = [
      { periodo: '2023-01', quantita_kg: 340, co2_risparmiata_kg: 850, valore_economico: 1360, lotti_salvati: 18 },
      { periodo: '2023-02', quantita_kg: 280, co2_risparmiata_kg: 700, valore_economico: 1120, lotti_salvati: 15 },
      { periodo: '2023-03', quantita_kg: 420, co2_risparmiata_kg: 1050, valore_economico: 1680, lotti_salvati: 22 },
      { periodo: '2023-04', quantita_kg: 310, co2_risparmiata_kg: 775, valore_economico: 1240, lotti_salvati: 16 },
      { periodo: '2023-05', quantita_kg: 390, co2_risparmiata_kg: 975, valore_economico: 1560, lotti_salvati: 20 },
      { periodo: '2023-06', quantita_kg: 350, co2_risparmiata_kg: 875, valore_economico: 1400, lotti_salvati: 19 },
      { periodo: '2023-07', quantita_kg: 420, co2_risparmiata_kg: 1050, valore_economico: 1680, lotti_salvati: 22 },
      { periodo: '2023-08', quantita_kg: 280, co2_risparmiata_kg: 700, valore_economico: 1120, lotti_salvati: 15 },
      { periodo: '2023-09', quantita_kg: 330, co2_risparmiata_kg: 825, valore_economico: 1320, lotti_salvati: 17 },
      { periodo: '2023-10', quantita_kg: 370, co2_risparmiata_kg: 925, valore_economico: 1480, lotti_salvati: 19 },
      { periodo: '2023-11', quantita_kg: 400, co2_risparmiata_kg: 1000, valore_economico: 1600, lotti_salvati: 21 },
      { periodo: '2023-12', quantita_kg: 450, co2_risparmiata_kg: 1125, valore_economico: 1800, lotti_salvati: 23 },
    ];

    if (String(formato).toLowerCase() === 'json') {
      return res.json({ periodoRichiesto: periodo, dati: dataset });
    }

    const csvHeader = 'periodo,quantita_kg,co2_risparmiata_kg,valore_economico,lotti_salvati';
    const csvRows = dataset.map((row) => [
      row.periodo,
      row.quantita_kg,
      row.co2_risparmiata_kg,
      row.valore_economico,
      row.lotti_salvati
    ].join(','));
    const csvContent = [csvHeader, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=statistiche_${periodo}.csv`);
    res.send(csvContent);
    
  } catch (err) {
    logger.error(`Errore nell'esportazione delle statistiche: ${err.message}`);
    next(new ApiError(500, 'Errore nell\'esportazione delle statistiche'));
  }
};

/**
 * Funzione di utilità per generare statistiche di esempio per un tipo utente
 */
async function generaStatisticheEsempio(tipoUtente) {
  // Genera valori più bassi per i tipi utente rispetto alle statistiche globali
  const fattore = Math.random() * 0.3 + 0.1; // 10-40% delle statistiche globali
  
  // Dati generali
  const generali = {
    totaleAlimentiSalvati: Math.floor((Math.random() * 2000 + 1000) * fattore),
    co2Risparmiata: Math.floor((Math.random() * 5000 + 2500) * fattore),
    valoreEconomicoRisparmiato: Math.floor((Math.random() * 8000 + 4000) * fattore),
    numeroLottiSalvati: Math.floor((Math.random() * 100 + 50) * fattore),
    numeroPrenotazioniCompletate: Math.floor((Math.random() * 80 + 40) * fattore),
    numeroTrasformazioniCircolari: Math.floor((Math.random() * 20 + 10) * fattore)
  };
  
  // Simula dati per periodo
  const perPeriodo = [];
  const oggi = new Date();
  for (let i = 11; i >= 0; i--) {
    const data = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    const mese = data.toISOString().substring(0, 7); // formato "YYYY-MM"
    
    // Genera valori casuali realistici per i dati
    const quantita = Math.floor((Math.random() * 300 + 100) * fattore);
    const co2 = quantita * 2.5;
    const valore = quantita * 4;
    const numLotti = Math.floor((Math.random() * 20 + 5) * fattore);
    
    perPeriodo.push({
      periodo: mese,
      quantitaAlimentiSalvati: quantita,
      co2Risparmiata: co2,
      valoreEconomico: valore,
      numeroLotti: numLotti
    });
  }
  
  // Statistiche trasporto basate sul tipo di utente
  const isPrivato = tipoUtente.tipo === 'Privato';
  const trasporto = {
    distanzaTotale: Math.floor((Math.random() * 500 + 200) * (isPrivato ? 1.5 : 0.8) * fattore),
    emissioniCO2: Math.floor((Math.random() * 100 + 50) * (isPrivato ? 1.5 : 0.8) * fattore),
    costoTotale: Math.floor((Math.random() * 300 + 100) * (isPrivato ? 1.5 : 0.8) * fattore),
    numeroTrasporti: Math.floor((Math.random() * 60 + 30) * (isPrivato ? 1.5 : 0.8) * fattore)
  };
  
  // Resto delle statistiche simile a getStatisticheComplete ma con il fattore di scala
  const categorie = [
    { nome: 'Frutta', quantita: Math.floor((Math.random() * 200 + 100) * fattore), percentuale: 0 },
    { nome: 'Verdura', quantita: Math.floor((Math.random() * 200 + 100) * fattore), percentuale: 0 },
    { nome: 'Latticini', quantita: Math.floor((Math.random() * 100 + 50) * fattore), percentuale: 0 },
    { nome: 'Carne', quantita: Math.floor((Math.random() * 100 + 30) * fattore), percentuale: 0 },
    { nome: 'Panetteria', quantita: Math.floor((Math.random() * 150 + 80) * fattore), percentuale: 0 }
  ];
  
  // Calcola le percentuali
  const totaleCategorie = categorie.reduce((acc, cat) => acc + cat.quantita, 0);
  categorie.forEach(cat => {
    cat.percentuale = parseFloat((cat.quantita / totaleCategorie * 100).toFixed(1));
  });
  
  // Statistiche di completamento
  const completamento = [];
  for (let i = 11; i >= 0; i--) {
    const data = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    const mese = data.toISOString().substring(0, 7);
    
    const completate = Math.floor((Math.random() * 30 + 10) * fattore);
    const annullate = Math.floor((Math.random() * 10 + 1) * fattore);
    const percentualeCompletamento = parseFloat(((completate / (completate + annullate)) * 100).toFixed(1));
    
    completamento.push({
      periodo: mese,
      completate,
      annullate,
      percentualeCompletamento
    });
  }
  
  // Tempi di prenotazione
  const tempoPrenotazione = {
    tempoMedio: parseFloat((Math.random() * 5 + 2).toFixed(1)),
    tempoMediano: parseFloat((Math.random() * 4 + 1).toFixed(1)),
    distribuzioneTempi: [
      { intervallo: '0-2h', conteggio: Math.floor((Math.random() * 40 + 10) * fattore), percentuale: 0 },
      { intervallo: '2-6h', conteggio: Math.floor((Math.random() * 80 + 20) * fattore), percentuale: 0 },
      { intervallo: '6-12h', conteggio: Math.floor((Math.random() * 60 + 15) * fattore), percentuale: 0 },
      { intervallo: '12-24h', conteggio: Math.floor((Math.random() * 40 + 10) * fattore), percentuale: 0 },
      { intervallo: '>24h', conteggio: Math.floor((Math.random() * 20 + 5) * fattore), percentuale: 0 }
    ]
  };
  
  // Calcola le percentuali di distribuzione dei tempi
  const totaleTempoDist = tempoPrenotazione.distribuzioneTempi.reduce((acc, t) => acc + t.conteggio, 0);
  tempoPrenotazione.distribuzioneTempi.forEach(t => {
    t.percentuale = parseFloat((t.conteggio / totaleTempoDist * 100).toFixed(1));
  });
  
  return {
    generali,
    perPeriodo,
    trasporto,
    perCategoria: categorie,
    completamento,
    tempoPrenotazione
  };
}

const getStatisticheTipoUtente = async (req, res, next) => {
  try {
    // Implementazione del metodo
    res.json({
      message: "Funzionalità in sviluppo",
      endpoint: "/statistiche/tipo-utente",
      tipo_utente_id: req.query.tipo_utente_id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ottiene statistiche di efficienza del sistema
 */
const getStatisticheEfficienza = async (req, res, next) => {
  try {
    // Implementazione del metodo
    res.json({
      message: "Funzionalità in sviluppo",
      endpoint: "/statistiche/efficienza"
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Serie giornaliere per grafici (ultimi N giorni, default 30)
 */
const getStatisticheGiornaliere = async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(parseInt(req.query.days || '30', 10), 365));
    const rows = await db.all(`
      SELECT data_statistica::date AS data,
             COALESCE(co2_risparmiata_kg,0) AS co2_risparmiata_kg,
             COALESCE(acqua_risparmiata_l,0) AS acqua_risparmiata_l,
             COALESCE(quantita_totale,0) AS cibo_kg,
             COALESCE(valore_economico,0) AS valore_economico
      FROM StatisticheGiornaliere
      WHERE data_statistica >= CURRENT_DATE - ($1::int || ' days')::interval
      ORDER BY data_statistica
    `, [days]);

    const series = rows.map(r => ({
      data: r.data,
      co2: Number(r.co2_risparmiata_kg || 0),
      acqua_l: Number(r.acqua_risparmiata_l || 0),
      cibo_kg: Number(r.cibo_kg || 0),
      valore_euro: Number(r.valore_economico || 0)
    }));

    res.json({ days, series });
  } catch (error) {
    next(error);
  }
};
/**
 * Esporta statistiche in formato CSV o altro formato
 */
const esportaStatistiche = async (req, res, next) => {
  try {
    // Implementazione del metodo
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="statistiche.csv"');
    res.status(200).send('ID,Nome,Valore\n1,Test,100\n');
  } catch (error) {
    next(error);
  }
};

// (module.exports moved to bottom to ensure all handlers are defined)

/**
 * Serie per mese: prenotazioni create e lotti consegnati
 * Query params:
 *  - months: numero mesi da includere (default 12, max 60)
 */
exports.getSeriePerMese = async (req, res, next) => {
  try {
    const months = Math.max(1, Math.min(parseInt(req.query.months || '12', 10), 60));

    const [prenRows, consRows] = await Promise.all([
      db.all(`
        SELECT to_char(date_trunc('month', p.data_prenotazione), 'YYYY-MM') AS periodo,
               COUNT(*) AS numero_prenotazioni
        FROM Prenotazioni p
        WHERE p.data_prenotazione >= (CURRENT_DATE - (?::int || ' months')::interval)
        GROUP BY 1
        ORDER BY 1
      `, [months]),
      db.all(`
        SELECT to_char(date_trunc('month', p.data_consegna), 'YYYY-MM') AS periodo,
               COUNT(*) AS numero_lotti
        FROM Prenotazioni p
        WHERE p.stato = 'Consegnato'
          AND p.data_consegna >= (CURRENT_DATE - (?::int || ' months')::interval)
        GROUP BY 1
        ORDER BY 1
      `, [months])
    ]);

    // Asse mesi (ultimi N, fino al mese corrente)
    const labels = [];
    const today = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      labels.push(d.toISOString().slice(0, 7));
    }

    const prenMap = Object.fromEntries(prenRows.map(r => [r.periodo, Number(r.numero_prenotazioni || 0)]));
    const consMap = Object.fromEntries(consRows.map(r => [r.periodo, Number(r.numero_lotti || 0)]));

    res.json({
      periodi: labels,
      prenotazioni: labels.map(m => prenMap[m] || 0),
      lotti_consegnati: labels.map(m => consMap[m] || 0)
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCounters: exports.getCounters,
  getImpatto: exports.getImpatto,
  getStatisticheComplete: exports.getStatisticheComplete,
  getStatisticheTipoUtente,
  getStatisticheEfficienza,
  esportaStatistiche,
  getStatisticheGiornaliere,
  getSeriePerMese: exports.getSeriePerMese
};
