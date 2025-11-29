#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
ENV_FILE="${SCRIPT_DIR}/.env"

if [ ! -f "${ENV_FILE}" ]; then
  echo "File ${ENV_FILE} mancante. Copia docker/.env.example in docker/.env e aggiorna le variabili richieste." >&2
  exit 1
fi

NO_CACHE_FLAG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-cache)
      NO_CACHE_FLAG="--no-cache"
      shift
      ;;
    *)
      echo "Parametro non riconosciuto: $1" >&2
      echo "Uso: bash docker/build-images.sh [--no-cache]" >&2
      exit 2
      ;;
  esac
done

echo "Costruzione immagini Docker (backend, frontend, db)..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build ${NO_CACHE_FLAG} backend frontend db
