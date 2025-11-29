// Lightweight SQL translator to adapt common SQLite syntax to PostgreSQL
// This aims to keep controllers unchanged during migration.

function replacePlaceholders(sql) {
  // Replace each unescaped '?' with $1, $2, ...
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let out = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      out += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += ch;
      continue;
    }
    if (ch === '?' && !inSingle && !inDouble) {
      index += 1;
      out += `$${index}`;
    } else {
      out += ch;
    }
  }
  return { sql: out, paramCount: index };
}

function translateDateTimeNow(sql) {
  return sql
    .replace(/datetime\(\s*(['"])now\1\s*\)/gi, 'NOW()')
    .replace(/date\(\s*(['"])now\1\s*\)/gi, 'CURRENT_DATE')
    .replace(/CURRENT_TIMESTAMP/gi, 'CURRENT_TIMESTAMP');
}

// Translate simple sqlite datetime('now', '-N unit') patterns
function translateDatetimeOffset(sql) {
  return sql.replace(/datetime\(\s*(['"])now\1\s*,\s*'-(\d+)\s+(seconds|minutes|hours|days)'\s*\)/gi, (_m, quote, n, unit) => {
    const u = unit.toLowerCase();
    const mapping = { seconds: 'seconds', minutes: 'minutes', hours: 'hours', days: 'days' };
    const pgUnit = mapping[u] || 'seconds';
    return `NOW() - interval '${n} ${pgUnit}'`;
  });
}

// Translate sqlite date('now', '-N unit') and a few common date modifiers
function translateDateOffset(sql) {
  // Offsets like date('now','-7 days')
  sql = sql.replace(/date\(\s*(['"])now\1\s*,\s*'-(\d+)\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)'\s*\)/gi,
    (_m, quote, n, unit) => {
      const u = (unit || '').toLowerCase();
      const mapping = {
        second: 'seconds', seconds: 'seconds',
        minute: 'minutes', minutes: 'minutes',
        hour: 'hours', hours: 'hours',
        day: 'days', days: 'days',
        week: 'weeks', weeks: 'weeks',
        month: 'months', months: 'months',
        year: 'years', years: 'years',
      };
      const pgUnit = mapping[u] || 'days';
      return `(CURRENT_DATE - interval '${n} ${pgUnit}')::date`;
    }
  );

  // Start of month
  sql = sql.replace(/date\(\s*(['"])now\1\s*,\s*'start of month'\s*\)/gi, "date_trunc('month', CURRENT_DATE)::date");

  // Start of day
  sql = sql.replace(/date\(\s*(['"])now\1\s*,\s*'start of day'\s*\)/gi, "CURRENT_DATE");

  return sql;
}

function translate(sql) {
  let out = sql;
  // Normalize only "INSERT OR IGNORE" (do not touch generic INSERTs)
  if (/insert\s+or\s+ignore\s+into/i.test(out)) {
    out = out.replace(/insert\s+or\s+ignore\s+into/gi, 'insert into');
    out = out.replace(/;\s*$/,'');
    out = `${out} ON CONFLICT DO NOTHING`;
  }
  out = translateDateTimeNow(out);
  out = translateDatetimeOffset(out);
  out = translateDateOffset(out);
  // Normalize common boolean fields written as 0/1 to PostgreSQL booleans
  out = out
    .replace(/\b(revocato|letto|eliminato)\s*=\s*1\b/gi, '$1 = TRUE')
    .replace(/\b(revocato|letto|eliminato)\s*=\s*0\b/gi, '$1 = FALSE');
  return out;
}

module.exports = {
  translate,
  replacePlaceholders,
};
