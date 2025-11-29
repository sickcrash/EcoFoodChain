const db = require('../src/config/database');
const bcrypt = require('bcryptjs');
const { computeLotImpact } = require('../src/utils/impactCalculator');

async function ensureOperatore() {
  const email = 'seed.operatore@refood.local';
  const existing = await db.get('SELECT id FROM Attori WHERE email = ?', [email]);
  if (existing) {
    return existing.id;
  }
  const hash = await bcrypt.hash('SeedPass123!', 10);
  const result = await db.run(
    'INSERT INTO Attori (email, password, nome, cognome_old, ruolo, cognome) VALUES (?, ?, ?, ?, ?, ?)',
    [email, hash, 'Operatore', 'Seed', 'Operatore', 'Seed']
  );
  return result.lastID;
}

async function ensureTipoUtente(descrizione, nome, extra) {
  const existing = await db.get('SELECT id FROM Tipo_Utente WHERE nome = ?', [nome]);
  if (existing) {
    return existing.id;
  }
  const tipoTipi = await db.get('SELECT id FROM Tipo_UtenteTipi WHERE descrizione = ?', [descrizione]);
  if (!tipoTipi) {
    throw new Error('Tipo_UtenteTipi non trovato per ' + descrizione);
  }
  const data = Object.assign({
    indirizzo: 'Via Demo 123, Bari',
    email: nome.toLowerCase().replace(/\s+/g, '.') + '@example.com',
    telefono: '+39 080 0000000',
    latitudine: 41.12,
    longitudine: 16.868,
  }, extra || {});
  const result = await db.run(
    'INSERT INTO Tipo_Utente (nome, tipo, tipo_id, indirizzo, email, telefono, latitudine, longitudine) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [nome, descrizione, tipoTipi.id, data.indirizzo, data.email, data.telefono, data.latitudine, data.longitudine]
  );
  return result.lastID;
}

async function seed() {
  const existing = await db.get("SELECT id FROM Lotti WHERE descrizione = 'Seed demo batch ottobre 2025'");
  if (existing) {
    console.log('Dati demo già presenti.');
    return;
  }

  const operatoreId = await ensureOperatore();
  const origineId = await ensureTipoUtente('Privato', 'Orto Solidale Demo');
  const riceventeId = await ensureTipoUtente('Canale sociale', 'Emporio Alimentare Demo');

  const baseDate = new Date();
  const lottiData = [
    { prodotto: 'Mele Fuji', quantita: 320, prezzo: 1.8, stato: 'Verde', giorni: 5 },
    { prodotto: 'Zucchine', quantita: 210, prezzo: 1.4, stato: 'Verde', giorni: 4 },
    { prodotto: 'Carote', quantita: 180, prezzo: 1.2, stato: 'Arancione', giorni: 3 },
    { prodotto: 'Arance', quantita: 260, prezzo: 1.6, stato: 'Verde', giorni: 6 },
    { prodotto: 'Basilico fresco', quantita: 35, prezzo: 12.0, stato: 'Verde', giorni: 2 }
  ];

  const insertedLots = [];
  for (let i = 0; i < lottiData.length; i++) {
    const lote = lottiData[i];
    const scadenza = new Date(baseDate.getTime());
    scadenza.setDate(scadenza.getDate() + 7 + i);
    const result = await db.run(
      'INSERT INTO Lotti (prodotto, quantita, unita_misura, data_scadenza, giorni_permanenza, stato, inserito_da, tipo_utente_origine_id, prezzo, descrizione) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        lote.prodotto,
        lote.quantita,
        'kg',
        scadenza.toISOString().slice(0, 10),
        lote.giorni,
        lote.stato,
        operatoreId,
        origineId,
        lote.prezzo,
        'Seed demo batch ottobre 2025'
      ]
    );
    insertedLots.push({ id: result.lastID, data: lote });
  }

  const now = new Date();
  for (const item of insertedLots) {
    const info = item.data;
    const prenotazioneData = new Date(now.getTime());
    prenotazioneData.setDate(prenotazioneData.getDate() - 14);
    const consegnaData = new Date(prenotazioneData.getTime());
    consegnaData.setDate(consegnaData.getDate() + 2);

    await db.run(
      'INSERT INTO Prenotazioni (lotto_id, tipo_utente_ricevente_id, stato, data_prenotazione, data_consegna, note, tipo_pagamento, attore_id) VALUES (?, ?, \'Consegnato\', ?, ?, ?, ?, ?)',
      [
        item.id,
        riceventeId,
        prenotazioneData.toISOString(),
        consegnaData.toISOString(),
        'Consegna demo per valutazione dashboard',
        'Solidale',
        operatoreId
      ]
    );

    const impact = computeLotImpact({
      quantita: info.quantita,
      unita_misura: 'kg',
      prezzo: info.prezzo,
      categoriaNome: null,
      prodotto: info.prodotto
    });

    await db.run(
      'INSERT INTO ImpattoCO2 (lotto_id, co2_risparmiata_kg, valore_economico, metodo_calcolo) VALUES (?, ?, ?, ?)',
      [item.id, impact.co2, impact.valore, 'seed_demo_script']
    );
  }

  console.log('Inseriti ' + insertedLots.length + ' lotti e prenotazioni demo.');
}

seed()
  .catch((err) => {
    console.error('Errore seed demo:', err);
  })
  .finally(async () => {
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    }
    process.exit(0);
  });
