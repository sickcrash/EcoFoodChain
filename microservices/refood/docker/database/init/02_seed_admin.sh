#!/bin/sh
set -eu

if [ -z "${DEFAULT_ADMIN_EMAIL:-}" ] || [ -z "${DEFAULT_ADMIN_PASSWORD:-}" ]; then
  echo "Skipping default admin seed: DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD not set."
  exit 0
fi

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=default_admin_email="$DEFAULT_ADMIN_EMAIL" \
  --set=default_admin_password="$DEFAULT_ADMIN_PASSWORD" <<'SQL'
  INSERT INTO Attori (email, password, nome, cognome_old, cognome, ruolo, creato_il)
  VALUES (
    :'default_admin_email',
    crypt(:'default_admin_password', gen_salt('bf', 10)),
    'Admin',
    'Default',
    'Default',
    'Amministratore',
    NOW()
  )
  ON CONFLICT (email) DO NOTHING;
SQL
