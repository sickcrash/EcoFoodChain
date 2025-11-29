# ReFood - Guida Docker

Questa guida descrive come avviare l'applicativo ReFood (backend, frontend e database PostgreSQL) in ambiente container sia su sistemi Linux/macOS sia su Windows.

## 1. Prerequisiti
- Docker Engine 24+ e Docker Compose Plugin.
- Almeno 4 GB di RAM disponibile per i container.
- (Windows) PowerShell 7+ consigliato per eseguire gli script `.ps1`.

## 2. Preparazione variabili d'ambiente
1. Copia il file di esempio:
   ```bash
   cp docker/.env.example docker/.env
   ```
   > PowerShell: `Copy-Item docker/.env.example docker/.env`
2. Aggiorna `docker/.env` impostando:
   - `JWT_SECRET`: chiave forte per i token JWT.
   - `DEFAULT_ADMIN_EMAIL` e `DEFAULT_ADMIN_PASSWORD`: credenziali iniziali (l'utente viene creato automaticamente alla prima inizializzazione del database).
   - `EXPO_PUBLIC_API_URL`: URL pubblico del backend visto dal browser (default `http://localhost:3000/api/v1`).
   - Eventuali chiavi Google Maps/Geocoding.

## 3. Build delle immagini
Gli script creano tre immagini:
- `refood-backend`: API Node.js/Express.
- `refood-frontend`: build Expo Web servita da Nginx.
- `refood-db`: PostgreSQL 15 con schema e admin di default.

### Linux/macOS
```bash
bash docker/build-images.sh
```
Opzioni aggiuntive passate dopo il comando verranno inoltrate a `docker compose build` (es. `--no-cache`).

### Windows (PowerShell)
```powershell
.\docker\build-images.ps1         # build con cache
.\docker\build-images.ps1 -NoCache
```

## 4. Avvio dei container
```bash
docker compose --env-file docker/.env up -d
```
Servizi esposti:
- Backend API: `http://localhost:${BACKEND_PORT}` (default 3000)
- Swagger: `http://localhost:${BACKEND_PORT}/api-docs`
- Frontend SPA: `http://localhost:${FRONTEND_PORT}` (default 8080)
- PostgreSQL: `localhost:${PGPORT}` (default 5432)

> Il comando usa le stesse variabili definite in `docker/.env`. Modificare le porte se già occupate.

## 5. Inizializzazione database
- Alla prima esecuzione il container `refood-db` applica automaticamente `schema_full.sql`, abilita `pgcrypto` e crea l'amministratore con le credenziali definite in `docker/.env`.
- I dati persistono nei volumi Docker:
  - `db_data`: cluster PostgreSQL.
  - `backend_uploads`: file caricati dal backend (`/data/uploads`).

Per rigenerare lo schema da zero eliminare i volumi:
```bash
docker compose down -v
```
(attenzione: cancella dati e file caricati).

## 6. Arresto, log e manutenzione
- Arresto servizi: `docker compose down`
- Log runtime:
  ```bash
  docker compose logs -f backend
  docker compose logs -f frontend
  docker compose logs -f db
  ```
- Ricostruzione immagini dopo modifiche al codice:
  1. Rieseguire lo script di build.
  2. `docker compose up -d --build backend frontend`

## 7. Note operative
- Il frontend è una SPA statica; se cambi `EXPO_PUBLIC_API_URL` è necessario ricostruire l'immagine `refood-frontend`.
- Per montare directory locali alternative (es. export `uploads`) modificare il volume `backend_uploads` nel `docker-compose.yml`.
- Scheduler e WebSocket del backend sono abilitati di default; impostare `ENABLE_SCHEDULER=false` o `ENABLE_WEBSOCKET=false` nel file `.env` per disattivarli.
- Le chiavi Google sono facoltative ma richieste per funzioni di geocoding: definirle prima della build per includerle nel container.

Seguendo questi passaggi il sistema funziona in modo equivalente all'installazione locale, con immagini riutilizzabili su qualsiasi host Docker compatibile.
