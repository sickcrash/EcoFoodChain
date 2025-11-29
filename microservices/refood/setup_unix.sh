#!/bin/bash
# Script di setup per Linux/macOS (PostgreSQL)

set -euo pipefail

echo "==================================="
echo "Setup Refood (PostgreSQL)"
echo "==================================="
echo

# Colori per l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

error() { echo -e "${RED}ERRORE: $1${NC}"; exit 1; }
success() { echo -e "${GREEN}$1${NC}"; }
warning() { echo -e "${YELLOW}AVVISO: $1${NC}"; }

# 1) Install deps backend
echo "1. Installazione dipendenze backend..."
pushd backend >/dev/null
npm install
popd >/dev/null
success "Dipendenze backend installate."
echo

# 2) Configurazione ambiente backend (.env)
echo "2. Configurazione ambiente backend (.env)..."
# Preserva GOOGLE_MAPS_API_KEY se presente in backend/.env o root .env, altrimenti usa env corrente
EXISTING_GMAPS_KEY=""
EXISTING_GGEOCODE_KEY=""
ROOT_GMAPS_KEY=""
ROOT_GGEOCODE_KEY=""
if [ -f backend/.env ]; then
  EXISTING_GMAPS_KEY=$(grep -E '^GOOGLE_MAPS_API_KEY=' backend/.env | head -n1 | cut -d= -f2- || true)
  EXISTING_GGEOCODE_KEY=$(grep -E '^GOOGLE_GEOCODING_API_KEY=' backend/.env | head -n1 | cut -d= -f2- || true)
fi
if [ -f .env ]; then
  ROOT_GMAPS_KEY=$(grep -E '^GOOGLE_MAPS_API_KEY=' .env | head -n1 | cut -d= -f2- || true)
  ROOT_GGEOCODE_KEY=$(grep -E '^GOOGLE_GEOCODING_API_KEY=' .env | head -n1 | cut -d= -f2- || true)
fi
GMAPS_KEY="${GOOGLE_MAPS_API_KEY:-${EXISTING_GMAPS_KEY:-$ROOT_GMAPS_KEY}}"
GGEOCODE_KEY="${GOOGLE_GEOCODING_API_KEY:-${EXISTING_GGEOCODE_KEY:-$ROOT_GGEOCODE_KEY}}"
[ -z "$GGEOCODE_KEY" ] && GGEOCODE_KEY="$GMAPS_KEY"
cat > backend/.env << EOL
PORT=3000
NODE_ENV=development

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGDATABASE=refood
PGUSER=postgres
PGPASSWORD=
PGPOOL_MAX=10
PGPOOL_IDLE=30000

# JWT
JWT_SECRET=refood_secure_key_auto_generated
ACCESS_TOKEN_EXPIRATION=2h
REFRESH_TOKEN_EXPIRATION=7d

# App
CORS_ORIGIN=*
LOG_LEVEL=info
API_PREFIX=/api/v1

# Schedulers
SEGNALAZIONI_CLEANUP_CRON=0 3 * * *
SEGNALAZIONI_RETENTION_DAYS=7
GOOGLE_MAPS_API_KEY=$GMAPS_KEY
GOOGLE_GEOCODING_API_KEY=$GGEOCODE_KEY
EOL
success "backend/.env creato."
echo

# 3) Creazione database (se psql presente) e inizializzazione schema PostgreSQL
echo "3. Creazione DB (se psql disponibile) e inizializzazione schema..."
PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGDATABASE=${PGDATABASE:-refood}
PGUSER=${PGUSER:-postgres}
PGPASSWORD=${PGPASSWORD:-}

if command -v psql >/dev/null 2>&1; then
  echo "psql rilevato. Controllo esistenza DB $PGDATABASE..."
  if ! PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -U "$PGUSER" -p "$PGPORT" -tAc "SELECT 1 FROM pg_database WHERE datname='${PGDATABASE}';" | grep -q 1; then
    echo "Creazione database $PGDATABASE..."
    PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -U "$PGUSER" -p "$PGPORT" -c "CREATE DATABASE \"$PGDATABASE\";" || warning "Impossibile creare il database (psql)."
  else
    echo "Database $PGDATABASE gia' esistente."
  fi
else
  warning "psql non trovato: salto creazione automatica DB."
fi

echo "Inizializzazione schema PostgreSQL..."
pushd backend >/dev/null
npm run pg:init:full || error "Inizializzazione schema fallita (verifica Postgres/credenziali)."
popd >/dev/null
success "Schema PostgreSQL inizializzato."
echo

# 4) Configurazione ambiente frontend (root .env per API_URL)
echo "4. Configurazione ambiente frontend (.env in root)..."
echo "Rilevamento indirizzo IP locale..."
if [[ "${OSTYPE:-}" == "darwin"* ]]; then
  IP=$(ipconfig getifaddr en0 || true)
  [[ -z "$IP" ]] && IP=$(ipconfig getifaddr en1 || true)
else
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [[ -z "${IP:-}" ]]; then
  warning "Impossibile rilevare IP automaticamente. Userò 127.0.0.1"
  IP="127.0.0.1"
fi
cat > .env <<EOL
# Configurazione API per il frontend mobile
# Modifica questo indirizzo se necessario per dispositivi fisici
API_URL=http://$IP:3000/api/v1
EOL
success "File .env di root creato (API_URL=$IP)."
echo

echo "==================================="
echo "Setup completato."
echo "- Avvio backend e frontend..."
(cd backend && npm run dev) &
if [ -d "refood-mobile" ]; then
  (cd refood-mobile && npm install && npx expo start)
elif [ -d "frontend" ]; then
  (cd frontend && npm install && npx expo start)
else
  echo "Directory frontend non trovata: salta avvio frontend."
fi
echo "==================================="
