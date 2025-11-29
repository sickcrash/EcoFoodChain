const { Pool } = require('pg');
const logger = require('../../utils/logger');
const { translate, replacePlaceholders } = require('./sqlTranslator');

const rawPassword = process.env.PGPASSWORD;
let normalizedPassword = '';
if (typeof rawPassword === 'string') {
  normalizedPassword = rawPassword;
} else if (rawPassword != null) {
  logger.warn('Variabile PGPASSWORD non è una stringa, conversione automatica applicata');
  normalizedPassword = String(rawPassword);
}

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'refood',
  user: process.env.PGUSER || 'postgres',
  password: normalizedPassword,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PGPOOL_IDLE || 30000),
});

pool.on('error', (err) => {
  logger.error(`Postgres pool error: ${err.message}`);
});

async function _query(sql, params = []) {
  const start = Date.now();
  const translated = translate(sql);
  const { sql: parameterized } = replacePlaceholders(translated);
  const res = await pool.query(parameterized, params);
  const duration = Date.now() - start;
  logger.debug(`PG query ${duration}ms`);
  return res;
}

async function run(sql, params = []) {
  // Try to append RETURNING id for INSERTs when caller expects lastID
  const lower = sql.trim().toLowerCase();
  if (lower.startsWith('insert into') && !/returning\s+\w+/i.test(sql)) {
    try {
      const withReturning = sql.trim().replace(/;\s*$/,'') + ' RETURNING id';
      const res = await _query(withReturning, params);
      return { lastID: res.rows?.[0]?.id ?? undefined, changes: res.rowCount };
    } catch (e) {
      // Fallback if id column doesn't exist
      const res = await _query(sql, params);
      return { lastID: undefined, changes: res.rowCount };
    }
  }
  const res = await _query(sql, params);
  return { lastID: res.rows?.[0]?.id ?? undefined, changes: res.rowCount };
}

async function get(sql, params = []) {
  const res = await _query(sql, params);
  return res.rows?.[0] || null;
}

async function all(sql, params = []) {
  const res = await _query(sql, params);
  return res.rows || [];
}

// Split SQL into statements, respecting quotes, dollar-quoting and comments
function splitSQLStatements(sql) {
  const statements = [];
  let buf = '';
  let inSingle = false;   // '
  let inDouble = false;   // "
  let inLineComment = false; // -- ... \n
  let inBlockComment = false; // /* ... */
  let inDollar = false;   // $$ or $tag$
  let dollarTag = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    // Handle end of line comment
    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }

    // Handle end of block comment
    if (inBlockComment) {
      buf += ch;
      if (ch === '*' && next === '/') {
        buf += next; i += 1; inBlockComment = false;
      }
      continue;
    }

    // Inside dollar-quoted block
    if (inDollar) {
      buf += ch;
      // Check if we are at the end tag
      if (ch === '$') {
        const maybe = sql.slice(i, i + dollarTag.length);
        if (maybe === dollarTag) {
          // Append the rest of the tag and move index
          buf += dollarTag.slice(1); // we already added first '$'
          i += (dollarTag.length - 1);
          inDollar = false;
        }
      }
      continue;
    }

    // Not inside special blocks: check for comment starts
    if (!inSingle && !inDouble) {
      if (ch === '-' && next === '-') {
        buf += ch + next; i += 1; inLineComment = true; continue;
      }
      if (ch === '/' && next === '*') {
        buf += ch + next; i += 1; inBlockComment = true; continue;
      }
    }

    // Handle quote toggling (with doubled quotes inside strings)
    if (!inDouble && ch === "'") {
      buf += ch;
      if (inSingle) {
        // If doubled single-quote, stay inside string and skip one
        if (next === "'") { buf += next; i += 1; }
        else { inSingle = false; }
      } else {
        inSingle = true;
      }
      continue;
    }
    if (!inSingle && ch === '"') {
      buf += ch;
      if (inDouble) {
        if (next === '"') { buf += next; i += 1; }
        else { inDouble = false; }
      } else {
        inDouble = true;
      }
      continue;
    }

    // Detect start of dollar-quoting when not in quotes
    if (!inSingle && !inDouble && ch === '$') {
      // Find next '$' to see if a valid tag $...$
      const end = sql.indexOf('$', i + 1);
      if (end !== -1) {
        const tagContent = sql.slice(i + 1, end);
        // Tag must be empty or identifier-like
        if (/^[a-zA-Z0-9_]*$/.test(tagContent)) {
          dollarTag = '$' + tagContent + '$';
          buf += dollarTag;
          i = end; // we already appended it
          inDollar = true;
          continue;
        }
      }
      // Not a valid dollar tag start, just treat as normal char
    }

    // Statement boundary
    if (ch === ';' && !inSingle && !inDouble) {
      const stmt = buf.trim();
      if (stmt) statements.push(stmt);
      buf = '';
      continue;
    }

    buf += ch;
  }

  const tail = buf.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function exec(sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const statements = splitSQLStatements(sql);
    for (let stmt of statements) {
      // Skip nested transaction control from scripts
      const lowered = stmt.trim().toLowerCase();
      if (lowered === 'begin' || lowered === 'commit' || lowered.startsWith('start transaction') || lowered === 'end') {
        continue;
      }
      const translated = translate(stmt);
      await client.query(translated);
    }
    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error(`Rollback fallito durante exec(): ${rollbackError.message}`);
    }
    throw e;
  } finally {
    client.release();
  }
}

async function testConnection() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (e) {
    return false;
  }
}

async function getConnection() {
  const client = await pool.connect();
  const connection = {
    async beginTransaction() {
      await client.query('BEGIN');
    },
    async commit() {
      await client.query('COMMIT');
    },
    async rollback() {
      await client.query('ROLLBACK');
    },
    async run(sql, params = []) {
      const translated = translate(sql);
      const { sql: parameterized } = replacePlaceholders(translated);
      const res = await client.query(parameterized, params);
      return { lastID: res.rows?.[0]?.id ?? undefined, changes: res.rowCount };
    },
    async get(sql, params = []) {
      const translated = translate(sql);
      const { sql: parameterized } = replacePlaceholders(translated);
      const res = await client.query(parameterized, params);
      return res.rows?.[0] || null;
    },
    async all(sql, params = []) {
      const translated = translate(sql);
      const { sql: parameterized } = replacePlaceholders(translated);
      const res = await client.query(parameterized, params);
      return res.rows || [];
    },
    release() { client.release(); },
  };
  return connection;
}

async function closeDatabase() {
  await pool.end();
}

// Basic prepare emulation for compatibility (runs with provided params)
function prepare(sql) {
  return {
    async run(params) {
      return run(sql, params);
    },
    async finalize() { /* no-op */ },
  };
}

module.exports = {
  client: 'postgres',
  run,
  get,
  all,
  exec,
  testConnection,
  getConnection,
  closeDatabase,
  query: all,
  prepare,
};
