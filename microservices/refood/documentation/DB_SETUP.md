# ReFood - Database e Migrazioni

Questa guida descrive come predisporre PostgreSQL per l'applicativo ReFood, applicare lo schema completo e verificare che i dati minimi siano presenti.

## 1. Prerequisiti
- PostgreSQL 13 o superiore raggiungibile (locale o remoto).
- Credenziali con permesso di creare database e schema (`CREATE DATABASE`, `CREATE SCHEMA`, `CREATE TABLE`).
- Variabili di connessione impostate in `backend/.env` o nell'ambiente:
  - `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
  - facoltativo: `DATABASE_URL` (sostituisce i campi singoli).
- Node.js >= 18 installato (necessario per eseguire gli script).

## 2. Provisioning rapido
### 2.1 Manuale
1. Crea il database:
   ```sql
   CREATE DATABASE refood;
   ```
2. Facoltativo: crea un ruolo dedicato e assegna permessi `CONNECT`, `CREATE`, `TEMP` sul database.
3. Aggiorna `backend/.env` con le credenziali definitive e assicurati che il backend punti al database appena creato.

## 3. Script di supporto
Tutti gli script sono in `backend/src/scripts/` e possono essere lanciati con `node` (dopo essersi posizionati nella cartella `backend/`).

| Script | Scopo | Comando |
|--------|-------|---------|
| `pg_create_db_if_missing.js` | Crea il database se non esiste gia. Usa le credenziali di `backend/.env`. | `node src/scripts/pg_create_db_if_missing.js` |
| `pg_init_full.js` | Applica `schema_full.sql` in modo idempotente (crea/aggiorna tabelle, vincoli, seed). | `npm run pg:init:full` |
| `migrate_utenti_to_attori.js` | Migrazione legacy (da eseguire solo se si proviene da versioni con tabella `Utenti`). | `npm run migrate:utenti-to-attori` |
| `invalidate_refresh_tokens.js` | Utility post-deployment per revocare tutte le sessioni. | `node src/scripts/invalidate_refresh_tokens.js` |

> Nota: `npm run pg:init:full` puo essere eseguito piu volte; usa istruzioni `IF NOT EXISTS` e non perde dati esistenti.

## 4. Schema applicato
- Il file `backend/src/database/postgres/schema_full.sql` contiene l'intero modello dati (Attori, Tipo_Utente, Lotti, Prenotazioni, Notifiche, Log, tabelle di archivio e indici).
- L'esecuzione crea la tabella `MigrazioniSchema` per eventuali patch future.
- Seed iniziali inclusi:
  - Valori standard in `ParametriSistema` (`soglia_stato_arancione`, `jwt_*` ecc.).
  - Tipologie utente (`Privato`, `Canale sociale`, `centro riciclo`).

## 5. Procedura consigliata
1. Posizionati in `backend/` e carica le variabili (PowerShell: `Set-Location backend`).
2. (Facoltativo) Assicurati che il database esista:
   ```powershell
   node src/scripts/pg_create_db_if_missing.js
   ```
3. Applica lo schema completo:
   ```powershell
   npm run pg:init:full
   ```
   In caso di errore controlla i log: problemi ricorrenti sono credenziali errate o database non raggiungibile.
4. (Solo installazioni legacy) Esegui la migrazione utenti  attori:
   ```powershell
   npm run migrate:utenti-to-attori
   ```
5. Avvia il backend (`npm run dev`) e verifica l'endpoint `http://localhost:3000/api/v1/health-check`.

## 6. Verifiche post-schema
- Conferma che esistano le tabelle principali:
  ```sql
  \dt
  SELECT COUNT(*) FROM attori;
  SELECT * FROM parametrisistema;
  ```
- Verifica seed dei parametri:
  ```sql
  SELECT chiave, valore FROM parametrisistema WHERE chiave LIKE 'soglia_stato%';
  ```
- Controlla la presenza dell'indice unico prenotazioni attive:
  ```sql
  SELECT indexname FROM pg_indexes WHERE indexname = 'ux_prenotazioni_lotto_attiva';
  ```

## 7. Dati di test (opzionali)
- Usa gli endpoint Swagger (`/api-docs`) o script SQL/requests per inserire: attore amministratore, lotti, prenotazioni.
- Per demo rapide puoi affidarti alle azioni manuali documentate in `documentation/_archive/SMOKE_TEST_FRONTEND.md`.

## 8. Backup e ripristino
- Backup manuale: `pg_dump -Fc -d refood > refood.dump`.
- Ripristino: `pg_restore -d refood --clean refood.dump` (usa con attenzione, sovrascrive dati esistenti).

Seguendo questi passi otterrai un database allineato con l'applicativo e pronto per test e produzione.
