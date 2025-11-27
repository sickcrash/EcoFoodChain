#!/usr/bin/env bash
set -e

if [ "$#" -ne 1 ]; then
    echo "Uso: $0 <backup_archive.tar.gz>"
    exit 1
fi

FINAL_ARCHIVE="$1"
RESTORE_TEMP_DIR="restore_temp_$(date +"%Y%m%d%H%M%S")"

echo "Creazione della directory temporanea per il ripristino: ${RESTORE_TEMP_DIR}"
mkdir -p "${RESTORE_TEMP_DIR}"

echo "Estrazione dell'archivio di backup: ${FINAL_ARCHIVE}"
tar xzf "${FINAL_ARCHIVE}" -C "${RESTORE_TEMP_DIR}"

# Ripristino dei file di rete
echo "Ripristino dei file di rete..."
tar xzf "${RESTORE_TEMP_DIR}/network/network_backup.tar.gz" -C .

# Ripristino dei volumi Docker
for vol_backup in "${RESTORE_TEMP_DIR}/volumes/"*.tar.gz; do
    # Ottieni il nome base del file
    basefile=$(basename "${vol_backup}")
    # Rimuovi l'estensione .tar.gz
    filename_no_ext="${basefile%.tar.gz}"
    # Rimuovi il suffisso del timestamp (prendi tutto fino all'ultimo underscore)
    vol="${filename_no_ext%_*}"
    echo "Verifica/creazione del volume '${vol}' (se non esiste)..."
    if ! docker volume inspect "${vol}" >/dev/null 2>&1; then
        docker volume create "${vol}"
    fi
    echo "Ripristino del volume '${vol}' da '${basefile}'..."
    docker run --rm \
      -v "${vol}":/volume \
      -v "$(pwd)/${RESTORE_TEMP_DIR}/volumes":/backup \
      busybox tar xzf "/backup/${basefile}" -C /volume
done


echo "Ripristino completato."
rm -rf "${RESTORE_TEMP_DIR}"
