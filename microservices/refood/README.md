# ReFood

Applicazione completa per la gestione del recupero alimentare: backend Node.js/Express, frontend Expo Router e suite di test (Jest/k6/Playwright). Questo README fornisce tutto il necessario per installare il progetto in locale o avviarlo tramite Docker, con rimandi puntuali alla documentazione dettagliata.

## Funzionalità principali
- API REST con autenticazione JWT, scheduler per job ricorrenti e WebSocket per notifiche in tempo reale.
- Frontend Expo (React Native + web) già integrato con l'API tramite `EXPO_PUBLIC_API_URL`.
- Script di provisioning PostgreSQL (`pg_create_db_if_missing.js`, `pg_init_full.js`) e set di dati/demo pronti all'uso.
- Pipeline di test automatizzata (Jest, k6, monitor CPU/RAM) eseguibile da PowerShell/Bash.
- Stack Docker completo (db + backend + frontend) con immagini buildabili tramite script dedicati in `docker/`.

## Struttura del repository
| Percorso | Descrizione |
|---------|-------------|
| `backend/` | API Express, scheduler, WebSocket, script PostgreSQL e configurazioni Jest. |
| `frontend/` | App Expo Router (dev via Metro/Webpack, export SPA per produzione). |
| `tests/` | Suite Jest/k6/Playwright più gli script PowerShell/Bash (`run-tests.ps1`, ecc.). |
| `documentation/` | Guide aggiornate: setup locale, Docker, QA, deploy, Google Maps. |
| `docker/` | Stack containerizzato (Dockerfile, compose e script di build/reset). |
| `documentation/_archive/` | Materiale storico (handoff espanso, roadmap, appunti). |

## Requisiti
- **Locale**: Node.js >= 18 (npm >= 8), PostgreSQL >= 13, PowerShell 5.1+ su Windows o Bash su Linux/macOS. Per il geocoding è richiesta una chiave Google Maps (vedi guida dedicata).
- **Docker**: Docker Engine 24+ con Compose plugin; almeno 4 GB di RAM disponibili.
- **Optional**: Expo CLI, k6, Playwright per scenari avanzati e2e/performance.

Dettagli e prerequisiti completi sono descritti in `documentation/SETUP_LOCAL.md` e `documentation/DOCKER_GUIDE.md`.

## Avvio rapido in locale (npm)
1. **Clona il repository** e spostati nella cartella `REFOOD_FINAL`.
2. **Configura gli `.env`:**
   ```powershell
   # backend
   cd backend
   copy .env.example .env    # imposta PG*, JWT_SECRET, GOOGLE_MAPS_API_KEY ecc.

   # root (per frontend/script)
   cd ..
   copy .env.example .env    # EXPO_PUBLIC_API_URL, TEST_API_BASE_URL, variabili PG

   # frontend
   cd frontend
   echo EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 > .env
   ```
   Per creare e restringere la chiave Google, segui `documentation/GOOGLE_MAPS_SETUP.md`.
3. **Installa le dipendenze:**
   ```powershell
   cd backend && npm ci
   cd ../frontend && npm install
   ```
4. **Provisiona PostgreSQL** (legge `backend/.env`):
   ```powershell
   cd backend
   node src/scripts/pg_create_db_if_missing.js   # facoltativo
   npm run pg:init:full
   ```
5. **Avvia servizi di sviluppo:**
   ```powershell
   # backend (porta 3000, Swagger su /api-docs)
   cd backend
   npm run dev

   # frontend (nuovo terminale, Expo Web di default su http://localhost:19006)
   cd frontend
   npm run web
   ```

Guida completa, troubleshooting e script automatici sono descritti in `documentation/SETUP_LOCAL.md`.

## Avvio con Docker
1. Copia `docker/.env.example` in `docker/.env` e imposta almeno:
   - `JWT_SECRET`, `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`
   - `PGPORT`, `BACKEND_PORT`, `FRONTEND_PORT`
   - `EXPO_PUBLIC_API_URL`, `GOOGLE_MAPS_API_KEY` (se devi abilitare il geocoding)
2. Costruisci le immagini:
   ```bash
   bash docker/build-images.sh              # Linux/macOS
   # oppure
   .\docker\build-images.ps1 [-NoCache]     # Windows PowerShell
   ```
3. Avvia lo stack:
   ```bash
   docker compose --env-file docker/.env up -d
   ```
   - API: `http://localhost:${BACKEND_PORT}` (default 3000) – Swagger su `/api-docs`
   - Frontend: `http://localhost:${FRONTEND_PORT}` (default 8080, esposta anche la porta 80)
   - PostgreSQL: `localhost:${PGPORT}` (default 5432)
4. I volumi `db_data` e `backend_uploads` mantengono dati e file caricati. Usa `docker compose down -v` solo se vuoi ripartire da zero.

Il manuale completo per lo stack containerizzato è `documentation/DOCKER_GUIDE.md` (non modificare i file nella cartella `docker/`, il setup è già funzionante).

## Testing e qualità
- `npm run test:local` (root) → esegue Jest sul backend puntando a `http://localhost:3000/api/v1`.
- `npm --prefix backend test -- --coverage` → genera `backend/coverage/` (HTML + summary).
- `powershell -NoProfile -File tests/run-tests.ps1` → orchestratore completo (Jest + k6 + monitoraggio risorse) con output in `tests/results/<timestamp>/`. Configurazione variabili e verifica dei log sono descritti in `documentation/QA_PLAN.md`.
- Lo stato dei report inclusi nel repo è documentato in `documentation/TEST_RESULTS.md`.

## Documentazione di riferimento
- `documentation/SETUP_LOCAL.md` – guida dettagliata all’ambiente locale e agli script automatici.
- `documentation/DB_SETUP.md` – provisioning PostgreSQL, migrazioni idempotenti e verifiche post-schema.
- `documentation/GOOGLE_MAPS_SETUP.md` – creazione, restrizione e installazione della chiave Google Maps/Geocoding.
- `documentation/DOCKER_GUIDE.md` – istruzioni per build/avvio/manutenzione dello stack containerizzato.
- `documentation/QA_PLAN.md` – orchestrazione test, parametri ambiente e checklist post-run.
- `documentation/DEPLOY_SMOKE.md` – checklist per staging/produzione e smoke test manuali.
- `documentation/_archive/` – materiale storico (handoff esteso, roadmap, appunti) non più aggiornato ma utile come riferimento.

## Manutenzione e contributi
- Aggiorna sempre le variabili sensibili (`PGPASSWORD`, `JWT_SECRET`, chiavi Google) prima di una consegna o di un deploy.
- Archivia la cartella `tests/results/<timestamp>/` prodotta dagli script di test insieme alla documentazione aggiornata.
- Per richieste o bug apri una issue/PR includendo i comandi eseguiti e i log rilevanti.

Buon lavoro con ReFood! Per qualsiasi approfondimento consulta la cartella `documentation/` o contatta il team tramite GitHub issues.
