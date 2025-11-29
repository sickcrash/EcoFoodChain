-- Manutenzione integrità dati (PostgreSQL)
-- Corregge riferimenti FK non validi e riallinea lo stato Lotti in base alla scadenza.

BEGIN;

-- Log modifiche
CREATE TEMP TABLE IF NOT EXISTS LogManutenzione (
  tabella TEXT,
  campo TEXT,
  righe_corrette INTEGER,
  ts TIMESTAMPTZ DEFAULT NOW()
);

-- Seleziona un admin valido da usare come fallback per riferimenti orfani
WITH admin_id AS (
  SELECT COALESCE(
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1),
    (SELECT MIN(id) FROM Attori)
  ) AS admin_id
)
-- 1) LogCambioStato.cambiato_da
, updated_lcs AS (
  UPDATE LogCambioStato SET cambiato_da = (SELECT admin_id FROM admin_id)
  WHERE cambiato_da NOT IN (SELECT id FROM Attori)
  RETURNING 1
)
INSERT INTO LogManutenzione(tabella, campo, righe_corrette)
SELECT 'LogCambioStato', 'cambiato_da', COUNT(*) FROM updated_lcs;

-- 2) Prenotazioni.attore_id
WITH admin_id AS (
  SELECT COALESCE(
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1),
    (SELECT MIN(id) FROM Attori)
  ) AS admin_id
), updated_pr AS (
  UPDATE Prenotazioni SET attore_id = (SELECT admin_id FROM admin_id)
  WHERE attore_id IS NOT NULL AND attore_id NOT IN (SELECT id FROM Attori)
  RETURNING 1
)
INSERT INTO LogManutenzione(tabella, campo, righe_corrette)
SELECT 'Prenotazioni', 'attore_id', COUNT(*) FROM updated_pr;

-- 3) Lotti.inserito_da
WITH admin_id AS (
  SELECT COALESCE(
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1),
    (SELECT MIN(id) FROM Attori)
  ) AS admin_id
), updated_lt AS (
  UPDATE Lotti SET inserito_da = (SELECT admin_id FROM admin_id)
  WHERE inserito_da NOT IN (SELECT id FROM Attori)
  RETURNING 1
)
INSERT INTO LogManutenzione(tabella, campo, righe_corrette)
SELECT 'Lotti', 'inserito_da', COUNT(*) FROM updated_lt;

-- 4) Notifiche.destinatario_id
WITH admin_id AS (
  SELECT COALESCE(
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1),
    (SELECT MIN(id) FROM Attori)
  ) AS admin_id
), updated_nd AS (
  UPDATE Notifiche SET destinatario_id = (SELECT admin_id FROM admin_id)
  WHERE destinatario_id NOT IN (SELECT id FROM Attori)
  RETURNING 1
)
INSERT INTO LogManutenzione(tabella, campo, righe_corrette)
SELECT 'Notifiche', 'destinatario_id', COUNT(*) FROM updated_nd;

-- 5) Notifiche.origine_id
WITH admin_id AS (
  SELECT COALESCE(
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1),
    (SELECT MIN(id) FROM Attori)
  ) AS admin_id
), updated_no AS (
  UPDATE Notifiche SET origine_id = (SELECT admin_id FROM admin_id)
  WHERE origine_id IS NOT NULL AND origine_id NOT IN (SELECT id FROM Attori)
  RETURNING 1
)
INSERT INTO LogManutenzione(tabella, campo, righe_corrette)
SELECT 'Notifiche', 'origine_id', COUNT(*) FROM updated_no;

-- 6) Riallinea stato Lotti in base alla scadenza e parametri
WITH s AS (
  SELECT 
    CAST((SELECT valore FROM ParametriSistema WHERE chiave='soglia_stato_rosso' LIMIT 1) AS INTEGER) AS soglia_rosso,
    CAST((SELECT valore FROM ParametriSistema WHERE chiave='soglia_stato_arancione' LIMIT 1) AS INTEGER) AS soglia_arancione
), updated_ls AS (
  UPDATE Lotti l SET stato = (
    SELECT CASE 
      WHEN l.data_scadenza::date - CURRENT_DATE <= s.soglia_rosso THEN 'Rosso'
      WHEN l.data_scadenza::date - CURRENT_DATE <= s.soglia_arancione THEN 'Arancione'
      ELSE 'Verde' END
    FROM s
  )
  WHERE l.stato IS DISTINCT FROM (
    SELECT CASE 
      WHEN l.data_scadenza::date - CURRENT_DATE <= s.soglia_rosso THEN 'Rosso'
      WHEN l.data_scadenza::date - CURRENT_DATE <= s.soglia_arancione THEN 'Arancione'
      ELSE 'Verde' END
    FROM s
  )
  RETURNING 1
)
INSERT INTO LogManutenzione(tabella, campo, righe_corrette)
SELECT 'Lotti', 'stato', COUNT(*) FROM updated_ls;

-- 7) TokenRevocati.revocato_da
WITH admin_id AS (
  SELECT COALESCE(
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1),
    (SELECT MIN(id) FROM Attori)
  ) AS admin_id
), updated_tr AS (
  UPDATE TokenRevocati SET revocato_da = (SELECT admin_id FROM admin_id)
  WHERE revocato_da IS NOT NULL AND revocato_da NOT IN (SELECT id FROM Attori)
  RETURNING 1
)
INSERT INTO LogManutenzione(tabella, campo, righe_corrette)
SELECT 'TokenRevocati', 'revocato_da', COUNT(*) FROM updated_tr;

-- 8) ParametriSistema.modificato_da
WITH admin_id AS (
  SELECT COALESCE(
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' ORDER BY ultimo_accesso DESC NULLS LAST LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Amministratore' LIMIT 1),
    (SELECT id FROM Attori WHERE ruolo = 'Operatore' LIMIT 1),
    (SELECT MIN(id) FROM Attori)
  ) AS admin_id
), updated_ps AS (
  UPDATE ParametriSistema SET modificato_da = (SELECT admin_id FROM admin_id)
  WHERE modificato_da IS NOT NULL AND modificato_da NOT IN (SELECT id FROM Attori)
  RETURNING 1
)
INSERT INTO LogManutenzione(tabella, campo, righe_corrette)
SELECT 'ParametriSistema', 'modificato_da', COUNT(*) FROM updated_ps;

-- Report
SELECT 'RAPPORTO DI MANUTENZIONE' AS Rapporto;
SELECT NOW() AS esecuzione;
SELECT * FROM LogManutenzione;
SELECT 'Totale correzioni' AS label, COALESCE(SUM(righe_corrette),0) AS totale FROM LogManutenzione;

-- Verifica finale residui orfani
SELECT 'LogCambioStato.cambiato_da' AS voce, COUNT(*) AS residui
FROM LogCambioStato WHERE cambiato_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Prenotazioni.attore_id', COUNT(*) FROM Prenotazioni WHERE attore_id IS NOT NULL AND attore_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Lotti.inserito_da', COUNT(*) FROM Lotti WHERE inserito_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Notifiche.destinatario_id', COUNT(*) FROM Notifiche WHERE destinatario_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'Notifiche.origine_id', COUNT(*) FROM Notifiche WHERE origine_id IS NOT NULL AND origine_id NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'TokenRevocati.revocato_da', COUNT(*) FROM TokenRevocati WHERE revocato_da IS NOT NULL AND revocato_da NOT IN (SELECT id FROM Attori)
UNION ALL
SELECT 'ParametriSistema.modificato_da', COUNT(*) FROM ParametriSistema WHERE modificato_da IS NOT NULL AND modificato_da NOT IN (SELECT id FROM Attori);

COMMIT;

