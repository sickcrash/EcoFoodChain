# ReFood - Deployment e Smoke Test

Questa guida descrive come promuovere il progetto in ambiente staging o produzione e come eseguire i controlli manuali immediatamente dopo il deploy.

## 1. Prerequisiti
- Pacchetto applicativo verificato: test automatizzati completati con successo (`documentation/QA_PLAN.md`).
- Database di destinazione pronto e allineato (`documentation/DB_SETUP.md`).
- Variabili d ambiente per l ambiente target impostate (segreti nel vault o file `.env`).
- Accesso al server (o ai server) su cui verranno pubblicati backend e frontend.

## 2. Checklist pre-deploy
1. Conferma commit/tag da rilasciare (es. `git tag vX.Y.Z`).
2. Verifica versioni Node/Postgres del target (seguendo i requisiti di `documentation/SETUP_LOCAL.md`).
3. Aggiorna `backend/.env` e `.env` con endpoint e credenziali del nuovo ambiente (non committare segreti).
4. Esegui `npm run pg:init:full` sull ambiente target per applicare migrazioni idempotenti.
5. Prepara dump di backup del database (se ambiente gia attivo): `pg_dump -Fc -d refood > backup_before_release.dump`.
6. Prepara gli artefatti da pubblicare:
   - Backend: installa le dipendenze (`npm ci` in `backend/`) e valida che `npm run start` funzioni con le variabili del target.
   - Frontend: esegui `npx expo export --platform web` dalla cartella `frontend/` per ottenere l output statico (`dist/`).

## 3. Deployment Staging
1. Copia gli artefatti (backend pronto all esecuzione, bundle frontend) sul server di staging.
2. Aggiorna i file di configurazione (`.env`, file di servizio, web server) con le impostazioni di staging.
3. Riavvia i servizi applicativi (es. `systemctl restart refood-backend`, `pm2 restart`, reload del web server per la parte frontend).
4. Verifica che i processi siano attivi (`systemctl status`, `pm2 status`, log applicativi).
5. Controlla i log iniziali del backend e del web server frontend per individuare rapidamente eventuali errori.

## 4. Deployment Produzione
1. Replica i passi di staging usando variabili e credenziali di produzione.
2. Se necessario imposta `CORS_ORIGIN` e `EXPO_PUBLIC_API_URL` con il dominio pubblico definitivo.
3. Migra DNS o aggiorna load balancer per puntare alle nuove istanze.
4. Monitora l avvio: health check `GET /api/v1/health-check` e `GET /api-docs` devono rispondere 200.
5. In caso di rollback mantieni il backup `pg_dump` e gli artefatti precedenti pronti alla ripubblicazione.

## 5. Smoke Test Manuale
Eseguire immediatamente dopo il deploy (staging e produzione):

1. **Autenticazione**
   - Login come amministratore.
   - Verifica caricamento dashboard e grafici principali.
2. **Lotti**
   - Crea un nuovo lotto (stato Verde) e salva.
   - Controlla che compaia nella lista con i valori corretti.
3. **Prenotazioni**
   - Effettua una prenotazione per il lotto creato (uso di account utente idoneo).
   - Cambia stato fino a `Consegnato` verificando notifiche.
4. **Segnalazioni**
   - Invia una segnalazione come Operatore Centro con foto allegata.
   - Approva da admin e verifica generazione lotto collegato.
5. **Notifiche**
   - Controlla la campanella notifiche per tutti i ruoli coinvolti.
6. **API Pubbliche**
   - `GET /api/v1/health-check` -> 200.
   - `GET /api-docs` -> Swagger visibile.
7. **Monitoraggio risorse**
   - Se possibile, esegui `tests/performance/cpu-ram.test.ps1 -ProcessName node -DurationSeconds 180` su uno dei nodi per verificare picchi.
8. **Logs**
   - Verifica assenza di errori 5xx e stacktrace nei log backend/frontend nei primi minuti.

Documentare ogni passaggio (timestamp, utente usato, esito) nel verbale di consegna.

## 6. Post-deploy
- Ripristina eventuali feature flag o configurazioni temporanee usate durante il test.
- Pulisci dati di prova creati durante lo smoke test (lotti, prenotazioni, segnalazioni).
- Aggiorna le metriche/alert nel sistema di monitoraggio (Grafana, CloudWatch, ecc.).
- Notifica il completamento al team con link ai log e al report `tests/results/<timestamp>/` piu recente.

Seguendo questi passaggi si garantisce un rilascio controllato e verificabile in ambienti staging e produzione.
