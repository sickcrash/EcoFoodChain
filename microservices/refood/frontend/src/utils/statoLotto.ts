// Calcola lo stato del lotto in base ai giorni alla scadenza
// Allinea la logica al backend: Rosso se scaduto/oggi, Arancione se entro 7 giorni, Verde altrimenti
export function calcolaStatoLotto(dataScadenza: string): 'Verde' | 'Arancione' | 'Rosso' {
  // Parse sicuro di date tipo YYYY-MM-DD come data locale (no UTC shift)
  let scadenza: Date;
  try {
    const [y, m, d] = (dataScadenza || '').split('T')[0].split('-').map((v) => parseInt(v, 10));
    scadenza = new Date(y, (m || 1) - 1, d || 1);
  } catch {
    scadenza = new Date(dataScadenza);
  }

  const today = new Date();
  // Azzeriamo ore/min/sec per confronto a giorni
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const s = startOfDay(scadenza).getTime();
  const o = startOfDay(today).getTime();
  const diffGiorni = Math.floor((s - o) / (1000 * 60 * 60 * 24));

  if (diffGiorni <= 1) return 'Rosso';
  if (diffGiorni <= 3) return 'Arancione';
  return 'Verde';
}
