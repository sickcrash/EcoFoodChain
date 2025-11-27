#!/usr/bin/env bash
set -e

# Imposta il timestamp per rendere univoci gli archivi
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
TEMP_BACKUP_DIR="backup_temp_${TIMESTAMP}"
FINAL_ARCHIVE="fabric_backup_${TIMESTAMP}.tar.gz"

echo "Creazione della directory temporanea di backup: ${TEMP_BACKUP_DIR}"
mkdir -p "${TEMP_BACKUP_DIR}/network"
mkdir -p "${TEMP_BACKUP_DIR}/volumes"

echo "Creazione archivio della rete (file e cartelle):"
# Archivia l'intera directory corrente, escludendo eventuali cartelle di backup per evitare duplicati
tar --exclude="${TEMP_BACKUP_DIR}" --exclude="backup" -czf "${TEMP_BACKUP_DIR}/network/network_backup.tar.gz" .

# Backup dei volumi Docker
VOLUMES=("compose_orderer.example.com" "compose_peer0.org1.example.com" "compose_peer0.org2.example.com")
for vol in "${VOLUMES[@]}"; do
    echo "Backup del volume Docker: ${vol}"
    docker run --rm \
      -v "${vol}":/volume \
      -v "$(pwd)/${TEMP_BACKUP_DIR}/volumes":/backup \
      busybox tar czf "/backup/${vol}_${TIMESTAMP}.tar.gz" -C /volume .
done

echo "Creazione dell'archivio finale unico: ${FINAL_ARCHIVE}"
tar czf "${FINAL_ARCHIVE}" -C "${TEMP_BACKUP_DIR}" .
echo "Backup completato. Archivio creato: ${FINAL_ARCHIVE}"

# Rimuove la directory temporanea usata per il backup
rm -rf "${TEMP_BACKUP_DIR}"
