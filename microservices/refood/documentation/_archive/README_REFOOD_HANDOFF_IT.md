# ReFood - Handoff Operativo

Questo documento supporta chi prende in carico il progetto in un nuovo ambiente (laboratorio, cloud o sedi della cooperativa). Riassume la struttura delle componenti, le variabili chiave e le azioni consigliate per il deploy senza ricorrere a immagini o orchestratori preconfigurati.

## 1. Componenti applicativi
- **Backend** (`backend/`): app Node.js/Express, espone le API REST su porta 3000 (configurabile in `backend/.env`). Include Swagger su `/api-docs`, websocket notifiche su `/api/v1/notifications/ws`, scheduler per manutenzioni.
- **Frontend** (`frontend/`): app Expo Router esportabile come SPA (cartella `dist/`). Durante lo sviluppo gira con `npm run web`, in produzione puo essere servita da qualunque web server statico (es. Nginx, Apache, bucket S3).
- **Database**: PostgreSQL 13+ con schema definito in `backend/src/database/postgres/schema_full.sql`.
- **Storage file**: cartella `backend/uploads/segnalazioni` contenente gli allegati caricati dagli operatori.

## 2. File di configurazione essenziali
- `.env` nella root: contiene `EXPO_PUBLIC_API_URL`, parametri Postgres condivisi e `TEST_API_BASE_URL`.
- `backend/.env`: definisce porta HTTP, segreti JWT, parametri DB e impostazioni scheduler.
- `frontend/.env`: imposta `EXPO_PUBLIC_API_URL` per le build Expo locali.

Esempio `.env` per un ambiente integrato:
```
EXPO_PUBLIC_API_URL=https://api.refood.example.com/api/v1
PGHOST=db.refood.example.com
PGPORT=5432
PGDATABASE=refood
PGUSER=refood_admin
PGPASSWORD=<password>
TEST_API_BASE_URL=https://api.refood.example.com/api/v1
```

## 3. Deploy su infrastrutture esterne
1. **Database**: predisporre un'istanza PostgreSQL raggiungibile e aggiornare `backend/.env` con le nuove credenziali. Eseguire `npm run pg:init:full` (da `backend/`) per applicare lo schema idempotente.
2. **Backend**:
   - Installare Node.js LTS sulla macchina target.
   - Copiare il contenuto di `backend/` (escludendo `node_modules/`), installare le dipendenze con `npm ci`.
   - Creare un servizio di avvio (es. `systemd`, PM2 o similare) che esegua `npm run start` o `node scripts/start-with-prompt.js`.
   - Configurare log rotation per i file generati in `backend/logs` se abilitati.
3. **Frontend**:
   - Portarsi nella cartella `frontend/` e generare la build con `npx expo export --platform web`.
   - Pubblicare il contenuto della cartella `dist/` su un web server statico o CDN.
   - Aggiornare `EXPO_PUBLIC_API_URL` nel `.env` (o variabile d'ambiente) per puntare al backend pubblico.
4. **Storage**: assicurarsi che la cartella `backend/uploads/segnalazioni` sia persistente e con permessi adeguati. In cloud puo essere montata su volume dedicato o bucket sincronizzato.
5. **Reverse proxy**: opzionale ma consigliato per terminazione HTTPS (es. Nginx o un load balancer gestito). Instradare `/api` verso il backend e servire la SPA frontend dalla stessa origine per ridurre problemi CORS.

## 4. Variabili chiave
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`: connessione PostgreSQL.
- `PORT`: porta HTTP backend, default 3000.
- `API_PREFIX`: prefisso API (default `/api/v1`).
- `CORS_ORIGIN`: domini autorizzati (impostare `https://app.refood.example.com` in produzione).
- `JWT_SECRET`, `ACCESS_TOKEN_EXPIRATION`, `REFRESH_TOKEN_EXPIRATION`: sicurezza autenticazione.
- `SEGNALAZIONI_CLEANUP_CRON`, `SEGNALAZIONI_RETENTION_DAYS`: manutenzione allegati.
- `EXPO_PUBLIC_API_URL`: URL del backend consumato dal frontend.

## 5. Task ricorrenti
- **Schema DB**: eseguire `npm run pg:init:full` ad ogni release che introduce modifiche strutturali.
- **Reset sessioni**: lanciare `node backend/src/scripts/invalidate_refresh_tokens.js` dopo incidenti di sicurezza.
- **Backup**: pianificare `pg_dump` periodici e verificare il ripristino (`pg_restore`).
- **Monitoraggio**: raccogliere metriche da log backend, impostare alert su errori 5xx e tempi di risposta elevati. Utili anche script `tests/performance/cpu-ram.test.ps1`.

## 6. Sicurezza operativa
- Conservare `JWT_SECRET`, credenziali DB e chiave Google in un secret manager.
- Esporre il backend solo tramite HTTPS e mantenere PostgreSQL su rete privata o VPN.
- Abilitare TLS verso il database quando disponibile.
- Impostare regole firewall che limitino l accesso al backend ai soli proxy autorizzati.
- Ruotare periodicamente password e chiavi API.

## 7. Checklist Handoff
1. Aggiorna `.env` e `backend/.env` con endpoint e credenziali del nuovo ambiente.
2. Inizializza o migra il database con `npm run pg:init:full`.
3. Distribuisci backend (servizio Node) e frontend (bundle statico) sui server target.
4. Verifica: `GET /api-docs`, login, creazione lotto, prenotazione e segnalazione di prova.
5. Configura monitoraggio/logging e politiche di backup.
6. Documenta URL, credenziali operative e canali di supporto consegnandoli al team o al committente.

Questo documento fornisce le informazioni minime per avviare il progetto in ambienti nuovi senza riferimenti alla precedente infrastruttura containerizzata.
