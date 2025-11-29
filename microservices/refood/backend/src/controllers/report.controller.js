const db = require('../config/database');
const { ApiError } = require('../middlewares/errorHandler');

function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => escape(r[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

/**
 * GET /report/lotti-completati
 * Query:
 *  - from (YYYY-MM-DD)
 *  - to (YYYY-MM-DD)
 *  - formato (csv|json) default csv
 *  - download=true per Content-Disposition
 */
async function lottiCompletati(req, res, next) {
  try {
    const { from, to, formato = 'csv', download } = req.query;
    const params = [];
    const where = ["p.stato = 'Consegnato'"];
    if (from) { params.push(from); where.push(`p.data_consegna >= $${params.length}`); }
    if (to) { params.push(to); where.push(`p.data_consegna <= $${params.length}`); }

    const sql = `
      SELECT
        p.id AS prenotazione_id,
        p.data_consegna,
        l.id AS lotto_id,
        l.prodotto,
        l.quantita,
        l.unita_misura,
        ROUND(CASE
          WHEN l.unita_misura = 'kg' THEN l.quantita
          WHEN l.unita_misura = 'g' THEN l.quantita / 1000.0
          WHEN l.unita_misura = 'l' THEN l.quantita * 1.0
          WHEN l.unita_misura = 'ml' THEN l.quantita / 1000.0
          WHEN l.unita_misura = 'pz' THEN l.quantita * 0.5
          ELSE l.quantita
        END::numeric, 3) AS quantita_kg,
        l.prezzo,
        tu.id AS centro_id,
        tu.nome AS centro_nome,
        tu.tipo AS centro_tipo
      FROM Prenotazioni p
      JOIN Lotti l ON l.id = p.lotto_id
      LEFT JOIN Tipo_Utente tu ON tu.id = p.tipo_utente_ricevente_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.data_consegna ASC, p.id ASC
    `;

    const rows = await db.all(sql, params);
    const mapped = rows.map(r => ({
      prenotazione_id: r.prenotazione_id,
      data_consegna: r.data_consegna ? new Date(r.data_consegna).toISOString() : null,
      lotto_id: r.lotto_id,
      prodotto: r.prodotto,
      quantita: r.quantita,
      unita_misura: r.unita_misura,
      quantita_kg: r.quantita_kg,
      prezzo: r.prezzo,
      centro_id: r.centro_id,
      centro_nome: r.centro_nome,
      centro_tipo: r.centro_tipo,
    }));

    if (String(formato).toLowerCase() === 'json') {
      return res.json({ count: mapped.length, rows: mapped });
    } else {
      const csv = toCSV(mapped);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      if (download === 'true') {
        res.setHeader('Content-Disposition', 'attachment; filename="lotti_completati.csv"');
      }
      return res.status(200).send(csv);
    }
  } catch (err) {
    next(new ApiError(500, `Errore generazione report: ${err.message}`));
  }
}

module.exports = {
  lottiCompletati,
};

