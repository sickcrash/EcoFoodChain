# ReFood - Setup Locale

Questa guida unifica prerequisiti, creazione degli `.env`, installazione delle dipendenze e avvio manuale dell'ambiente sviluppo senza ricorrere a Docker. Usa `documentation/DB_SETUP.md` per i dettagli sullo schema Postgres e `documentation/QA_PLAN.md` per la parte test.

## 1. Prerequisiti
- **Sistema operativo**: Windows (PowerShell 5.1+ consigliato 7), Linux o macOS.
- **Node.js**: versione >= 18 (il backend funziona anche con >=14, ma Expo richiede 18+).
- **npm**: versione >= 8 (distribuita con Node 18+).
- **PostgreSQL**: versione 13 o superiore raggiungibile con credenziali `CREATE DATABASE`.
- **Hardware**: almeno 2 vCPU e 4 GB di RAM disponibili per lo sviluppo quotidiano.
- **Facoltativi**: Expo CLI (`npm install -g expo-cli`) per debug mobile e `k6` per gli scenari di carico (`k6 version`).

## 2. Struttura del repository
- `backend/`: API Express, job pianificati, WebSocket e script Postgres (`src/scripts`).
- `frontend/`: app Expo Router (Metro/Webpack in sviluppo, build SPA per prod).
- `tests/`: suite Jest, scenari k6 e script PowerShell/Bash per orchestrare i cicli.
- `documentation/`: le guide aggiornate (questo file, QA, DB, deploy, Docker).
- `docker/`: stack containerizzato completo (non modificare, usa solo per il setup Docker).

## 3. Setup automatico (consigliato)
Gli script inclusi automatizzano quasi tutti i passaggi:

| Sistema | Script | Attivita' principali |
| --- | --- | --- |
| Windows | `.\setup_windows_pg.ps1` | Esegue `npm ci` nel backend, genera `backend/.env` e `.env` root, tenta `pg_create_db_if_missing.js`, applica lo schema con `pg_init_full.js`. |
| Linux/macOS | `bash ./setup_unix.sh` | Equivalente allo script PowerShell sopra. |

Prima di eseguirli imposta (eventualmente come parametri/variabili d'ambiente) `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` affinche' gli script possano creare il database e applicare lo schema. Se `pg_init_full.js` non riesce, ripeti il comando manualmente una volta verificata la reachability del database.

## 4. Setup manuale passo passo
1. **Clona il repository** ed entra nella cartella `REFOOD_FINAL`.
2. **File `.env`:**
   - Copia `backend/.env.example` in `backend/.env` e aggiorna almeno `PG*`, `JWT_SECRET`, `GOOGLE_MAPS_API_KEY` (vedi `documentation/GOOGLE_MAPS_SETUP.md` per la procedura completa) e `DEFAULT_ADMIN_*` se vuoi credenziali diverse.
   - Copia `docker/.env.example` solo se userai Docker (vedi `documentation/DOCKER_GUIDE.md`).
   - Copia `.env.example` (root) in `.env` e imposta `EXPO_PUBLIC_API_URL`, le stesse variabili Postgres usate dal backend e i parametri per gli script di test (`TEST_API_BASE_URL`).
   - Crea `frontend/.env` e aggiungi `EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1` (o l'URL pubblico del backend).
3. **Installa le dipendenze Node:**
   ```powershell
   cd backend
   npm ci
   cd ../frontend
   npm install
   ```
   Se `npm ci` fallisce per file bloccati su Windows, elimina `backend/node_modules`, riapri il terminale come amministratore e ripeti.
4. **Inizializza il database:**
   ```powershell
   cd backend
   node src/scripts/pg_create_db_if_missing.js   # facoltativo, ma utile su ambienti nuovi
   npm run pg:init:full
   ```
   I due script leggono le credenziali da `backend/.env` e applicano `src/database/postgres/schema_full.sql` in modo idempotente.
5. **Avvia i servizi in sviluppo:**
   ```powershell
   cd backend
   npm run dev        # http://localhost:3000/api/v1 e Swagger su /api-docs

   # Nuovo terminale
   cd frontend
   npm run web        # Expo Web (default http://localhost:19006)
   ```
   Il backend usa Nodemon, quindi si riavvia sui cambi. Expo puo' usare Metro; se preferisci Webpack imposta l'opzione nel `app.json`.

## 5. Variabili chiave
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`: sempre coerenti tra `.env` root e `backend/.env`.
- `JWT_SECRET`, `ACCESS_TOKEN_EXPIRATION`, `REFRESH_TOKEN_EXPIRATION`: sicurezza token.
- `ENABLE_SCHEDULER`, `ENABLE_WEBSOCKET`, `LOG_TO_FILES`, `UPLOADS_DIR`: feature flag del backend (`backend/.env`).
- `EXPO_PUBLIC_API_URL`: URL base che il frontend utilizza per tutte le chiamate API (build-time).
- `TEST_API_BASE_URL`: endpoint usato dagli script Jest/PowerShell nella cartella `tests/`.

## 6. Verifiche rapide
1. Con il backend attivo visita `http://localhost:3000/api-docs` e `http://localhost:3000/api/v1/health-check`.
2. Usa le credenziali di default (`adminBartolo@gmail.com` / `adminBartolo`) solo in ambienti di test e cambiale in produzione.
3. Se servono dati demo aggiuntivi, utilizza gli script in `backend/src/scripts` o crea record via Swagger.

## 7. Test essenziali
- `npm run test:local` (dalla root) avvia Jest nel backend puntando automaticamente al backend locale (`TEST_API_BASE_URL`).
- `npm --prefix backend test -- --coverage` genera il report HTML in `backend/coverage/`.
- `powershell -File tests/run-tests.ps1` esegue il flusso completo (Jest + k6 + monitor) generando output in `tests/results/<timestamp>/`. I prerequisiti e i passi di review del report sono descritti in `documentation/QA_PLAN.md`.

## 8. Collegamenti utili
- `documentation/DB_SETUP.md`: dettagli sullo schema, script SQL e verifiche post-migrazione.
- `documentation/DOCKER_GUIDE.md`: alternativa containerizzata, condivisa con gli script presenti in `docker/`.
- `documentation/QA_PLAN.md`: orchestrazione dei test e raccolta dei risultati.
- `documentation/DEPLOY_SMOKE.md`: checklist per staging/prod e smoke test manuali.
- `documentation/GOOGLE_MAPS_SETUP.md`: guida passo passo per creare, restringere e installare la chiave Google Maps/Geocoding.

Seguendo questa sequenza ottieni un ambiente locale identico a quello previsto dagli script automatici e coerente con la pipeline Docker gia' pronta nel repository.
