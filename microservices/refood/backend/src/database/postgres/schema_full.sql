-- ReFood PostgreSQL Schema (Consolidated)
-- Consolidates all tables and migrations into a single script.

BEGIN;

-- =====================
-- Core entities
-- =====================
CREATE TABLE IF NOT EXISTS Attori (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nome TEXT NOT NULL,
  cognome_old TEXT NOT NULL,
  ruolo TEXT NOT NULL CHECK (ruolo IN ('Operatore', 'Amministratore', 'Utente', 'OperatoreCentro')),
  ultimo_accesso TIMESTAMPTZ,
  creato_da INTEGER REFERENCES Attori(id),
  creato_il TIMESTAMPTZ DEFAULT NOW(),
  cognome TEXT
);

-- Soft-delete / disabilitazione account
ALTER TABLE Attori ADD COLUMN IF NOT EXISTS disabilitato BOOLEAN DEFAULT FALSE;
ALTER TABLE Attori ADD COLUMN IF NOT EXISTS eliminato_il TIMESTAMPTZ;
ALTER TABLE Attori ADD COLUMN IF NOT EXISTS eliminato_motivo TEXT;

-- Tipi di utente (categorie)
CREATE TABLE IF NOT EXISTS Tipo_UtenteTipi (
  id SERIAL PRIMARY KEY,
  descrizione TEXT NOT NULL UNIQUE
);

-- Entità dei centri/utenti tipizzati con metadati di contatto e coordinate
CREATE TABLE IF NOT EXISTS Tipo_Utente (
  id SERIAL PRIMARY KEY,
  nome TEXT,
  tipo TEXT NOT NULL,
  tipo_id INTEGER REFERENCES Tipo_UtenteTipi(id),
  indirizzo TEXT,
  email TEXT,
  telefono TEXT,
  latitudine REAL,
  longitudine REAL,
  creato_il TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill tipologie standard (idempotente)
INSERT INTO Tipo_UtenteTipi (descrizione) VALUES
  ('Privato'),
  ('Canale sociale'),
  ('centro riciclo')
ON CONFLICT (descrizione) DO NOTHING;

-- Migrazioni idempotenti per allineare eventuali installazioni precedenti
ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS nome TEXT;
ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS tipo_id INTEGER REFERENCES Tipo_UtenteTipi(id);
ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS indirizzo TEXT;
ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS latitudine REAL;
ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS longitudine REAL;
ALTER TABLE Tipo_Utente ADD COLUMN IF NOT EXISTS creato_il TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE Tipo_Utente
  ADD CONSTRAINT tipo_utente_tipo_key UNIQUE (tipo);


CREATE TABLE IF NOT EXISTS ParametriSistema (
  id SERIAL PRIMARY KEY,
  chiave TEXT NOT NULL UNIQUE,
  valore TEXT NOT NULL,
  descrizione TEXT,
  modificabile BOOLEAN DEFAULT TRUE,
  modificato_da INTEGER REFERENCES Attori(id),
  modificato_il TIMESTAMPTZ,
  creato_il TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens / sessioni
CREATE TABLE IF NOT EXISTS TokenAutenticazione (
  id SERIAL PRIMARY KEY,
  attore_id INTEGER NOT NULL REFERENCES Attori(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  access_token_scadenza TIMESTAMPTZ NOT NULL,
  refresh_token_scadenza TIMESTAMPTZ NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  revocato BOOLEAN DEFAULT FALSE,
  revocato_il TIMESTAMPTZ,
  creato_il TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS TokenRevocati (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  revocato_il TIMESTAMPTZ DEFAULT NOW(),
  motivo TEXT,
  scadenza_originale TIMESTAMPTZ,
  revocato_da INTEGER REFERENCES Attori(id)
);

-- =====================
-- Dominio: Lotti / Prenotazioni / Notifiche / Log
-- =====================
CREATE TABLE IF NOT EXISTS Notifiche (
  id SERIAL PRIMARY KEY,
  titolo TEXT NOT NULL,
  messaggio TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('CambioStato','Prenotazione','Alert','LottoCreato','LottoModificato')),
  priorita TEXT NOT NULL DEFAULT 'Media' CHECK (priorita IN ('Bassa','Media','Alta')),
  destinatario_id INTEGER NOT NULL REFERENCES Attori(id),
  letto BOOLEAN DEFAULT FALSE,
  data_lettura TIMESTAMPTZ,
  eliminato BOOLEAN DEFAULT FALSE,
  riferimento_id INTEGER,
  riferimento_tipo TEXT,
  origine_id INTEGER REFERENCES Attori(id),
  tipo_utente_id INTEGER REFERENCES Tipo_Utente(id),
  creato_il TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Lotti (
  id SERIAL PRIMARY KEY,
  prodotto TEXT NOT NULL,
  quantita REAL NOT NULL,
  unita_misura TEXT NOT NULL,
  data_scadenza DATE NOT NULL,
  giorni_permanenza INTEGER NOT NULL,
  -- Include 'Prenotato' to be tolerant with legacy flows that set booking state
  stato TEXT NOT NULL CHECK (stato IN ('Verde', 'Arancione', 'Rosso', 'Prenotato')),
  inserito_da INTEGER NOT NULL REFERENCES Attori(id),
  creato_il TIMESTAMPTZ DEFAULT NOW(),
  aggiornato_il TIMESTAMPTZ,
  tipo_utente_origine_id INTEGER REFERENCES Tipo_Utente(id),
  prezzo REAL,
  descrizione TEXT,
  indirizzo TEXT
);

-- Moved after Lotti to satisfy FK dependency
CREATE TABLE IF NOT EXISTS LogCambioStato (
  id SERIAL PRIMARY KEY,
  lotto_id INTEGER NOT NULL REFERENCES Lotti(id),
  stato_precedente TEXT NOT NULL,
  stato_nuovo TEXT NOT NULL,
  cambiato_il TIMESTAMPTZ DEFAULT NOW(),
  cambiato_da INTEGER NOT NULL REFERENCES Attori(id)
);

CREATE TABLE IF NOT EXISTS Prenotazioni (
  id SERIAL PRIMARY KEY,
  lotto_id INTEGER NOT NULL REFERENCES Lotti(id),
  tipo_utente_ricevente_id INTEGER NOT NULL REFERENCES Tipo_Utente(id),
  stato TEXT NOT NULL CHECK (
    stato IN ('Prenotato','InAttesa','Confermato','ProntoPerRitiro','Rifiutato','InTransito','Consegnato','Annullato','Eliminato')
  ),
  data_prenotazione TIMESTAMPTZ DEFAULT NOW(),
  data_ritiro TIMESTAMPTZ,
  data_consegna TIMESTAMPTZ,
  note TEXT,
  tipo_pagamento TEXT,
  ritirato_da TEXT,
  documento_ritiro TEXT,
  data_ritiro_effettivo TIMESTAMPTZ,
  note_ritiro TEXT,
  operatore_ritiro INTEGER,
  transizioni_stato TEXT,
  attore_id INTEGER REFERENCES Attori(id),
  updated_at TIMESTAMPTZ,
  indirizzo_ritiro TEXT,
  telefono_ritiro TEXT,
  email_ritiro TEXT
);

-- (deduped) Notifiche and LogCambioStato definitions appear earlier

-- =====================
-- Segnalazioni & Foto
-- =====================
CREATE TABLE IF NOT EXISTS Segnalazioni (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descrizione TEXT,
  quantita REAL NOT NULL CHECK (quantita > 0),
  unita_misura TEXT NOT NULL CHECK (unita_misura IN ('kg','g','l','ml','pz')),
  prezzo REAL CHECK (prezzo IS NULL OR prezzo >= 0),
  indirizzo_centro TEXT NOT NULL,
  shelflife TEXT NOT NULL,
  stato TEXT NOT NULL DEFAULT 'inviata' CHECK (stato IN ('inviata','in_lavorazione','chiusa')),
  esito TEXT CHECK (esito IN ('approvata','rifiutata')),
  messaggio_esito TEXT,
  creato_da INTEGER NOT NULL REFERENCES Attori(id) ON DELETE RESTRICT,
  creato_il TIMESTAMPTZ DEFAULT NOW(),
  aggiornato_il TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_segnalazioni_stato ON Segnalazioni(stato);
CREATE INDEX IF NOT EXISTS idx_segnalazioni_shelflife ON Segnalazioni(shelflife);
CREATE INDEX IF NOT EXISTS idx_segnalazioni_creato_da ON Segnalazioni(creato_da);

CREATE TABLE IF NOT EXISTS SegnalazioneFoto (
  id SERIAL PRIMARY KEY,
  segnalazione_id INTEGER NOT NULL REFERENCES Segnalazioni(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  size INTEGER,
  creato_il TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segnalazionefoto_fk ON SegnalazioneFoto(segnalazione_id);

-- =====================
-- Categorie / Origini / Impatto / Trasformazioni / Trasporti / Statistiche
-- =====================
CREATE TABLE IF NOT EXISTS CategorieProdotti (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descrizione TEXT,
  tempo_medio_permanenza INTEGER,
  creato_il TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS LottiCategorie (
  lotto_id INTEGER NOT NULL REFERENCES Lotti(id),
  categoria_id INTEGER NOT NULL REFERENCES CategorieProdotti(id),
  PRIMARY KEY (lotto_id, categoria_id)
);

CREATE TABLE IF NOT EXISTS OriginiProdotti (
  id SERIAL PRIMARY KEY,
  lotto_id INTEGER NOT NULL REFERENCES Lotti(id),
  produttore TEXT,
  localita_origine TEXT,
  km_percorsi INTEGER,
  metodo_produzione TEXT CHECK (metodo_produzione IN ('Biologico','Convenzionale','Biodinamico','Altro'))
);

-- AttoriTipoUtente (composita)
CREATE TABLE IF NOT EXISTS AttoriTipoUtente (
  attore_id INTEGER NOT NULL REFERENCES Attori(id),
  tipo_utente_id INTEGER NOT NULL REFERENCES Tipo_Utente(id),
  ruolo_specifico TEXT,
  data_inizio TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (attore_id, tipo_utente_id)
);

CREATE TABLE IF NOT EXISTS ImpattoCO2 (
  id SERIAL PRIMARY KEY,
  lotto_id INTEGER NOT NULL REFERENCES Lotti(id),
  co2_risparmiata_kg REAL,
  valore_economico REAL,
  metodo_calcolo TEXT,
  data_calcolo TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Trasformazioni (
  id SERIAL PRIMARY KEY,
  lotto_origine_id INTEGER NOT NULL REFERENCES Lotti(id),
  tipo_trasformazione TEXT NOT NULL CHECK (tipo_trasformazione IN ('Compost','Biogas','Alimentazione animale','Altro')),
  note TEXT
);

CREATE TABLE IF NOT EXISTS Trasporti (
  id SERIAL PRIMARY KEY,
  prenotazione_id INTEGER NOT NULL REFERENCES Prenotazioni(id),
  mezzo TEXT NOT NULL,
  distanza_km REAL,
  emissioni_co2 REAL,
  costo REAL,
  autista TEXT,
  telefono_autista TEXT,
  orario_partenza TIMESTAMPTZ,
  orario_arrivo TIMESTAMPTZ,
  stato TEXT NOT NULL CHECK (stato IN ('Pianificato','InCorso','Completato','Annullato')),
  latitudine_origine REAL,
  longitudine_origine REAL,
  indirizzo_origine TEXT,
  latitudine_destinazione REAL,
  longitudine_destinazione REAL,
  indirizzo_destinazione TEXT
);

-- =====================
-- Tabelle di archivio (opzionali per job scheduler)
-- =====================
CREATE TABLE IF NOT EXISTS LottiArchivio (
  LIKE Lotti INCLUDING ALL,
  data_archiviazione TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS PrenotazioniArchivio (
  LIKE Prenotazioni INCLUDING ALL,
  data_archiviazione TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS LogCambioStatoArchivio (
  LIKE LogCambioStato INCLUDING ALL,
  data_archiviazione TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS StatisticheSettimanali (
  id SERIAL PRIMARY KEY,
  tipo_utente_id INTEGER NOT NULL REFERENCES Tipo_Utente(id),
  settimana INTEGER NOT NULL,
  anno INTEGER NOT NULL,
  quantita_salvata REAL,
  peso_totale_kg REAL,
  co2_risparmiata_kg REAL,
  valore_economico REAL,
  numero_lotti INTEGER
);

-- Statistiche giornaliere per grafici/time-series
CREATE TABLE IF NOT EXISTS StatisticheGiornaliere (
  data_statistica DATE PRIMARY KEY,
  totale_lotti INTEGER,
  lotti_verdi INTEGER,
  lotti_arancioni INTEGER,
  lotti_rossi INTEGER,
  quantita_totale REAL,
  totale_prenotazioni INTEGER,
  prenotazioni_attive INTEGER,
  prenotazioni_consegnate INTEGER,
  prenotazioni_annullate INTEGER,
  totale_utenti INTEGER,
  utenti_operatori INTEGER,
  utenti_amministratori INTEGER,
  utenti_utenti INTEGER,
  co2_risparmiata_kg REAL,
  acqua_risparmiata_l REAL,
  valore_economico REAL
);

CREATE TABLE IF NOT EXISTS MigrazioniSchema (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  applicata_il TIMESTAMPTZ DEFAULT NOW(),
  descrizione TEXT
);

-- =====================
-- Seed di default
-- =====================
INSERT INTO ParametriSistema (chiave, valore, descrizione) VALUES
('soglia_stato_arancione','3','Giorni alla scadenza per passare allo stato arancione'),
('soglia_stato_rosso','1','Giorni alla scadenza per passare allo stato rosso'),
('jwt_access_token_durata','3600','Durata in secondi del token JWT di accesso'),
('jwt_refresh_token_durata','604800','Durata in secondi del refresh token (7 giorni)')
ON CONFLICT (chiave) DO NOTHING;

COMMIT;

-- Recommended indexes for performance and integrity
-- (executed safely when schema applied from scratch)
-- Note: use IF NOT EXISTS to be idempotent when applied multiple times
DO $$ BEGIN
  -- Prenotazioni: speed up common lookups
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_prenotazioni_lotto_id'
  ) THEN
    CREATE INDEX idx_prenotazioni_lotto_id ON Prenotazioni(lotto_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='idx_prenotazioni_stato'
  ) THEN
    CREATE INDEX idx_prenotazioni_stato ON Prenotazioni(stato);
  END IF;

  -- Ensure single active reservation per lotto (optional partial unique)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='i' AND c.relname='ux_prenotazioni_lotto_attiva'
  ) THEN
    CREATE UNIQUE INDEX ux_prenotazioni_lotto_attiva
    ON Prenotazioni(lotto_id)
    WHERE stato IN ('Prenotato','InAttesa','Confermato','InTransito','ProntoPerRitiro');
  END IF;
END $$;
