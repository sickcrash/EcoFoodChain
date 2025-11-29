const DEFAULT_PIECE_WEIGHT = 0.25; // kg per pezzo in assenza di categoria

const IMPACT_FACTORS = [
  {
    key: 'verdure_foglia',
    label: 'Verdure a Foglia',
    tokens: ['lattuga', 'insalat', 'bietol', 'spinac', 'cavolo', 'verza', 'broccol', 'cavolfior', 'cime', 'rucola', 'pak choi'],
    co2PerKg: 0.7,
    waterPerKg: 180,
    soilPerKg: 0.28,
    valuePerKg: 2.0,
    pieceWeightKg: 0.35,
  },
  {
    key: 'verdure_radice',
    label: 'Radici e Tuberi',
    tokens: ['patat', 'carot', 'barbabiet', 'rapa', 'cipoll', 'scalogno', 'aglio', 'porro', 'sedano rapa'],
    co2PerKg: 0.8,
    waterPerKg: 220,
    soilPerKg: 0.3,
    valuePerKg: 1.9,
    pieceWeightKg: 0.3,
  },
  {
    key: 'verdure_frutto',
    label: 'Ortaggi da Frutto',
    tokens: ['pomodor', 'peperon', 'melanzan', 'zucchin', 'zucca', 'cetriol', 'fagiolin', 'pisell', 'fava'],
    co2PerKg: 1.1,
    waterPerKg: 260,
    soilPerKg: 0.33,
    valuePerKg: 2.4,
    pieceWeightKg: 0.22,
  },
  {
    key: 'frutta_pomacee',
    label: 'Pomacee',
    tokens: ['mela', 'pera', 'cotogna'],
    co2PerKg: 0.5,
    waterPerKg: 150,
    soilPerKg: 0.2,
    valuePerKg: 2.5,
    pieceWeightKg: 0.2,
  },
  {
    key: 'frutta_agrumi',
    label: 'Agrumi',
    tokens: ['aranc', 'limon', 'mandar', 'clementin', 'pompelmo', 'bergamott', 'cedro'],
    co2PerKg: 0.8,
    waterPerKg: 280,
    soilPerKg: 0.27,
    valuePerKg: 2.1,
    pieceWeightKg: 0.22,
  },
  {
    key: 'frutta_drupe',
    label: 'Drupacee',
    tokens: ['pesca', 'albicocc', 'cilieg', 'susina', 'prugna', 'nectarin'],
    co2PerKg: 0.7,
    waterPerKg: 240,
    soilPerKg: 0.26,
    valuePerKg: 2.7,
    pieceWeightKg: 0.18,
  },
  {
    key: 'frutta_bacche',
    label: 'Frutti di Bosco',
    tokens: ['fragol', 'lampone', 'mirtill', 'ribes', 'mora', 'uva'],
    co2PerKg: 0.6,
    waterPerKg: 190,
    soilPerKg: 0.22,
    valuePerKg: 3.4,
    pieceWeightKg: 0.08,
  },
  {
    key: 'frutta_tropicale',
    label: 'Frutta Tropicale',
    tokens: ['banana', 'ananas', 'mango', 'avocado', 'papaya', 'kiwi', 'passion', 'cocco'],
    co2PerKg: 1.5,
    waterPerKg: 520,
    soilPerKg: 0.36,
    valuePerKg: 3.6,
    pieceWeightKg: 0.28,
  },
  {
    key: 'erbe_aromatiche',
    label: 'Erbe Aromatiche',
    tokens: ['basilico', 'prezzemolo', 'rosmarino', 'salvia', 'origano', 'timo', 'maggiorana', 'menta', 'erba cipollina'],
    co2PerKg: 0.4,
    waterPerKg: 140,
    soilPerKg: 0.18,
    valuePerKg: 6.0,
    pieceWeightKg: 0.05,
  },
  {
    key: 'altro',
    label: 'Altra Frutta e Ortaggi',
    tokens: [],
    co2PerKg: 1.2,
    waterPerKg: 320,
    soilPerKg: 0.32,
    valuePerKg: 2.6,
    pieceWeightKg: DEFAULT_PIECE_WEIGHT,
  },
];


function normalizeString(value) {
  return (value || '').toString().toLowerCase();
}

function pickImpactFactor({ categoriaNome, prodotto }) {
  const text = (normalizeString(categoriaNome) + ' ' + normalizeString(prodotto)).trim();
  if (!text) {
    return IMPACT_FACTORS[IMPACT_FACTORS.length - 1];
  }

  for (const factor of IMPACT_FACTORS) {
    if (factor.tokens.some(token => text.includes(token))) {
      return factor;
    }
  }

  return IMPACT_FACTORS[IMPACT_FACTORS.length - 1];
}

function convertToKgQuantity(quantity, unit, pieceWeightKg = DEFAULT_PIECE_WEIGHT) {
  const qty = Number(quantity) || 0;
  const normalizedUnit = normalizeString(unit);

  switch (normalizedUnit) {
    case 'kg':
      return qty;
    case 'g':
      return qty / 1000;
    case 'l':
      return qty;
    case 'ml':
      return qty / 1000;
    case 'pz':
      return qty * (pieceWeightKg || DEFAULT_PIECE_WEIGHT);
    default:
      return qty;
  }
}

function computeLotImpact(lot) {
  const factor = pickImpactFactor(lot);
  const kg = convertToKgQuantity(lot.quantita, lot.unita_misura, factor.pieceWeightKg);
  const co2 = kg * factor.co2PerKg;
  const acqua = kg * factor.waterPerKg;
  const terreno = kg * factor.soilPerKg;

  const prezzo = Number(lot.prezzo);
  const unit = normalizeString(lot.unita_misura);
  const baseQuantity = unit === 'kg' || unit === 'l' ? (Number(lot.quantita) || 0) : kg;
  const ricavo = prezzo > 0 ? prezzo * baseQuantity : 0;
  const donazione = prezzo > 0 ? 0 : kg * factor.valuePerKg;
  const valore = ricavo + donazione;

  return {
    factor,
    kg,
    co2,
    acqua,
    terreno,
    ricavo,
    donazione,
    valore,
  };
}

module.exports = {
  IMPACT_FACTORS,
  computeLotImpact,
  convertToKgQuantity,
  pickImpactFactor,
};
