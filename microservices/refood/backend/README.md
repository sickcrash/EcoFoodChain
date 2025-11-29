Backend ReFood - Setup PostgreSQL

Requisiti
- Node.js v16+
- PostgreSQL 13+

Variabili d'ambiente (`backend/.env`)
PORT=3000
NODE_ENV=development

# PostgreSQL connection
PGHOST=localhost
PGPORT=5432
PGDATABASE=refood
PGUSER=postgres
PGPASSWORD=
PGPOOL_MAX=10
PGPOOL_IDLE=30000

# JWT / Auth
JWT_SECRET=your_secret_key
ACCESS_TOKEN_EXPIRATION=2h
REFRESH_TOKEN_EXPIRATION=7d

# App config
CORS_ORIGIN=*
LOG_LEVEL=debug
API_PREFIX=/api/v1
ENABLE_SCHEDULER=true
ENABLE_WEBSOCKET=true
HTTP_DEBUG_LOG=false
LOG_TO_FILES=false
LOG_FILES_DIR=./logs
ENABLE_DEBUG_ROUTES=false
UPLOADS_DIR=

# Schedulers
SEGNALAZIONI_CLEANUP_CRON=0 3 * * *
SEGNALAZIONI_RETENTION_DAYS=7

# Geocoding (Google)
GOOGLE_MAPS_API_KEY=

Nota: imposta `GOOGLE_MAPS_API_KEY` per abilitare il servizio di geocoding. Vedi anche `documentation/GOOGLE_MAPS_API_KEY_SETUP.md` per creare e proteggere correttamente la chiave (restrizioni IP e API).

Importante: non committare file `.env` con credenziali reali.
- Usa `backend/.env.example` come modello e crea un file `backend/.env` locale.
- Ruota immediatamente eventuali chiavi/API credentials che fossero finite in repository.

Inizializzazione database
1) Crea il database (da psql o GUI):
   CREATE DATABASE refood;

2) Applica lo schema completo Postgres:
   cd backend
   npm run pg:init:full

Avvio server
cd backend
npm install
npm run dev

Note di migrazione da SQLite
- Il backend ora usa esclusivamente l'adapter Postgres in `src/config/database.js`.
- Query con placeholder `?` vengono convertite automaticamente in `$1, $2, ...`.
- Le funzioni `datetime('now', ...)` sono tradotte a `NOW()` tramite `src/config/db/sqlTranslator.js`.
- Gli script di migrazione storici per SQLite rimangono in repo ma non sono più usati.