# Struttura Database e Configurazione

Questo documento orienta alla struttura dati di ReFood, agli script SQL disponibili e alle configurazioni applicative correlate.

## 1. Panoramica
- Database: PostgreSQL 13+ (testato anche su 16-alpine).
- Driver: `pg` con adapter custom in `backend/src/config/db/postgres.js` che espone i metodi `run`, `get`, `all`, `transaction` e converte i placeholder `?` in `$1`.
- Storage file: cartella `backend/uploads/segnalazioni` (filesystem locale). In produzione montare un volume persistente o integrare con storage esterno.

## 2. Schema SQL
Il file di riferimento e `backend/src/database/postgres/schema_full.sql`. Eseguendolo vengono create tutte le tabelle, indici e vincoli necessari.

Estratto tabelle principali:
```
Attori (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nome TEXT NOT NULL,
  cognome TEXT,
  ruolo TEXT NOT NULL CHECK (ruolo IN ('Operatore','Amministratore','Utente','OperatoreCentro')),
  ultimo_accesso TIMESTAMPTZ,
  disabilitato BOOLEAN DEFAULT FALSE,
  creato_da INTEGER REFERENCES Attori(id),
  creato_il TIMESTAMPTZ DEFAULT NOW()
)

Tipo_Utente (
  id SERIAL PRIMARY KEY,
  nome TEXT,
  tipo TEXT NOT NULL,
  indirizzo TEXT,
  email TEXT,
  telefono TEXT,
  latitudine DOUBLE PRECISION,
  longitudine DOUBLE PRECISION,
  creato_il TIMESTAMPTZ DEFAULT NOW()
)

AttoriTipoUtente (
  attore_id INTEGER REFERENCES Attori(id),
  tipo_utente_id INTEGER REFERENCES Tipo_Utente(id),
  ruolo_specifico TEXT,
  data_inizio TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (attore_id, tipo_utente_id)
)

Lotti (
  id SERIAL PRIMARY KEY,
  prodotto TEXT NOT NULL,
  quantita DOUBLE PRECISION NOT NULL,
  unita_misura TEXT NOT NULL,
  data_scadenza DATE NOT NULL,
  stato TEXT NOT NULL,
  inserito_da INTEGER REFERENCES Attori(id),
  descrizione TEXT,
  prezzo NUMERIC,
  indirizzo TEXT,
  creato_il TIMESTAMPTZ DEFAULT NOW(),
  aggiornato_il TIMESTAMPTZ
)

Prenotazioni (
  id SERIAL PRIMARY KEY,
  lotto_id INTEGER NOT NULL REFERENCES Lotti(id),
  tipo_utente_ricevente_id INTEGER REFERENCES Tipo_Utente(id),
  stato TEXT NOT NULL,
  data_prenotazione TIMESTAMPTZ DEFAULT NOW(),
  data_ritiro TIMESTAMPTZ,
  data_consegna TIMESTAMPTZ,
  note TEXT
)

Segnalazioni (
  id SERIAL PRIMARY KEY,
  creato_da INTEGER REFERENCES Attori(id),
  nome TEXT NOT NULL,
  descrizione TEXT,
  quantita DOUBLE PRECISION,
  unita_misura TEXT,
  prezzo NUMERIC,
  indirizzo TEXT,
  stato TEXT NOT NULL,
  esito TEXT,
  creato_il TIMESTAMPTZ DEFAULT NOW()
)

Notifiche (
  id SERIAL PRIMARY KEY,
  titolo TEXT NOT NULL,
  messaggio TEXT NOT NULL,
  tipo TEXT NOT NULL,
  priorita TEXT NOT NULL DEFAULT 'Media',
  destinatario_id INTEGER REFERENCES Attori(id),
  tipo_utente_id INTEGER REFERENCES Tipo_Utente(id),
  riferimento_id INTEGER,
  riferimento_tipo TEXT,
  dati_extra JSONB,
  letto BOOLEAN DEFAULT FALSE,
  creato_il TIMESTAMPTZ DEFAULT NOW()
)
```

Tabelle ausiliarie includono `TokenAutenticazione`, `TokenRevocati`, `LogCambioStato`, `ParametriSistema`.

## 3. Script applicativi
- `backend/src/scripts/pg_init_full.js`: esegue lo schema completo e applica alter idempotenti.
- `backend/src/scripts/pg_create_db_if_missing.js`: crea il database se le credenziali lLo consentono.
- `backend/src/scripts/migrate_utenti_to_attori.js`: supporto legacy per database precedenti alla migrazione.
- `backend/src/scripts/invalidate_refresh_tokens.js`: svuota `TokenAutenticazione` e `TokenRevocati` costringendo tutti gli utenti a riloggarsi.

Esecuzione tipica:
```
cd backend
npm run pg:init:full
node src/scripts/invalidate_refresh_tokens.js
```

## 4. Configurazione connessione (`backend/.env`)
```
PGHOST=localhost
PGPORT=5432
PGDATABASE=refood
PGUSER=postgres
PGPASSWORD=
PGPOOL_MAX=10
PGPOOL_IDLE=30000
```
Oppure usa `DATABASE_URL=postgres://user:password@host:5432/refood` (con eventuale `sslmode=require`).

## 5. Integrazione nel codice
- Import: `const db = require('../config/database');`
- Query: `db.run(sql, params)` per insert/update, `db.get` per record singoli, `db.all` per elenchi.
- Transazioni: `db.transaction(async (trx) => { ... })` con supporto a `trx.savepoint()` per rollback puntuali.
- Repository e controller si trovano in `backend/src/controllers/` e `backend/src/repositories/`.

## 6. Configurazioni accessorie
- Scheduler (`backend/src/utils/scheduler.js`): legge `SEGNALAZIONI_CLEANUP_CRON`, `SEGNALAZIONI_RETENTION_DAYS`, `SCHEDULER_SYSTEM_USER_ID` per eseguire i job.
- Geocoding: `GOOGLE_MAPS_API_KEY` abilita l'arricchimento indirizzi (best effort, mai bloccante se assente).
- Upload: middleware `uploadSegnalazioni.js` impone controlli su estensione e dimensione delle immagini.

## 7. Esecuzione manuale dello schema
```
psql -h <host> -p <port> -U <user> -d <db> -f backend/src/database/postgres/schema_full.sql
```
Dopo l'esecuzione manuale e consigliato lanciare `node backend/src/scripts/pg_init_full.js` per uniformare eventuali alter idempotenti gestiti a runtime.

Queste informazioni consentono di comprendere come il backend persiste i dati e quali elementi controllare in fase di deploy o manutenzione.