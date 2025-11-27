#!/usr/bin/env bash
# Script per fermare i container senza eliminare rete e dati

# Determina la directory base dello script
BASE_DIR=$(cd "$(dirname "$0")" && pwd)
COMPOSE_DIR="$BASE_DIR/compose"
DOCKER_COMPOSE_DIR="$COMPOSE_DIR/docker"

# Imposta DOCKER_SOCK se non definita
if [ -z "$DOCKER_SOCK" ]; then
  export DOCKER_SOCK="/var/run/docker.sock"
fi

# Seleziona il comando per docker-compose
CONTAINER_CLI="docker"
if command -v ${CONTAINER_CLI}-compose > /dev/null 2>&1; then
  COMPOSE_CMD="${CONTAINER_CLI}-compose"
else
  COMPOSE_CMD="${CONTAINER_CLI} compose"
fi

# File di compose per i nodi (peer e orderer)
NETWORK_COMPOSE_FILES="-f ${COMPOSE_DIR}/compose-test-net.yaml -f ${DOCKER_COMPOSE_DIR}/docker-compose-test-net.yaml"

# File di compose per le CA
CA_COMPOSE_FILES="-f ${COMPOSE_DIR}/compose-ca.yaml -f ${DOCKER_COMPOSE_DIR}/docker-compose-ca.yaml"

echo "Fermando i container dei nodi..."
${COMPOSE_CMD} ${NETWORK_COMPOSE_FILES} stop

echo "Fermando i container delle CA..."
${COMPOSE_CMD} ${CA_COMPOSE_FILES} stop

echo "Tutti i container sono stati fermati. La rete e i dati rimangono intatti."
