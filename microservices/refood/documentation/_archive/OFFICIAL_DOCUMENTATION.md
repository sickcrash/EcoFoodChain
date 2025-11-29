# ReFood - Documentazione Ufficiale

## 1. Visione d''insieme
- Obiettivo: ridurre lo spreco alimentare mettendo in contatto cooperativa, centri associati e utenti autorizzati.
- Componenti: backend REST Node.js/Express, frontend Expo (target web per lo sviluppo), database PostgreSQL, notifiche websocket.
- Principi: semplicita operativa per gli operatori, tracciabilita completa dei lotti, sicurezza out-of-the-box, supporto a installazioni on-premise o in cloud.

## 2. Ruoli e permessi principali
- **Amministratore**: governa utenti e tipologie, revisiona segnalazioni, accede a statistiche, report e impostazioni di sistema.
- **Operatore**: gestisce i lotti interni e il ciclo vita delle prenotazioni, monitora le statistiche operative.
- **Operatore Centro**: crea segnalazioni per le eccedenze del proprio centro, gestisce foto e monitoraggio esito.
- **Utente tipizzato**: Privato (verde), Canale sociale (arancione), Centro riciclo (rosso). Prenota i lotti consentiti dal proprio colore e segue le notifiche dello stato.

Regole chiave:
- Gli utenti vedono solo i lotti compatibili con il proprio colore.
- La schermata segnalazioni e accessibile solo al centro che ha creato la segnalazione.
- Tutti i ruoli possono consultare le statistiche aggregate, mentre la home dashboard rimane limitata a amministratori e operatori.

## 3. Architettura tecnica
- **Backend** (`backend/`): Express, middleware helmet/cors/compressione, logger Winston, Swagger su `/api-docs`, websocket dedicato a `/api/v1/notifications/ws`. Lo scheduler basato su node-cron aggiorna automaticamente lo stato dei lotti e gestisce la manutenzione (cleanup segnalazioni chiuse, statistiche periodiche).
- **Frontend** (`frontend/`): Expo Router (React Native 0.81), supporto Expo web (Metro o Webpack). Le chiamate API usano `process.env.EXPO_PUBLIC_API_URL`.
- **Database**: PostgreSQL con pool `pg` e adapter custom (`backend/src/config/db/postgres.js`) che traduce i placeholder `?` in `$1`, gestisce transazioni e savepoint.
- **Storage file**: foto segnalazioni salvate in `backend/uploads/segnalazioni`, elaborate con `sharp`.
- **Notifiche realtime**: websocket che distribuisce eventi a destinatari singoli o a tutte le tipologie.

## 4. Flussi applicativi
1. **Creazione lotto interno**
   - Operatore o amministratore registra un lotto indicando prodotto, quantita, unita di misura, scadenza, eventuale prezzo.
   - Il sistema calcola automaticamente la fascia colore in base alla shelf life (verde, arancione, rosso).
   - Gli utenti idonei possono prenotare il lotto, gli operatori ne gestiscono gli stati fino a `Consegnato`.
2. **Prenotazione e ritiro**
   - Stato iniziale `Richiesta`. Transizioni consentite: `Richiesta -> Confermato -> ProntoPerRitiro -> InTransito -> Consegnato`.
   - Ramificazioni: `Rifiutato`, `Annullato`, `Eliminato` (gestite da operatore o amministratore).
   - Ogni cambio stato invia notifiche e sincronizza il lotto collegato.
3. **Segnalazione da centro associato**
   - Operatore Centro invia descrizione e foto del prodotto.
   - Amministratore avvia la revisione, approva o rifiuta.
   - In caso positivo viene creato automaticamente un nuovo lotto con le stesse regole del flusso interno.
4. **Statistiche e report**
   - `/statistiche/counters` restituisce i contatori di impatto, `/statistiche/complete` fornisce serie temporali mensili.
   - `/report/lotti-completati` esporta CSV o JSON con i lotti consegnati.

## 5. Modello dati (estratto)
- `Attori`: utenti del sistema con ruolo, credenziali, dati anagrafici e flag di disabilitazione.
- `Tipo_Utente`: descrive centri o enti, include indirizzo, contatti e coordinate.
- `AttoriTipoUtente`: relazione molti-a-molti tra attori e tipologie.
- `Lotti`: informazioni logistiche del lotto, stato colore e riferimento all'inseritore.
- `Prenotazioni`: state machine con date e note operative.
- `Segnalazioni` e `SegnalazioneFoto`: gestione segnalazioni provenienti dai centri.
- `Notifiche`: messaggi persistenti con priorita, riferimenti e dati extra opzionali.
- Tabelle di supporto: `TokenAutenticazione`, `TokenRevocati`, `LogCambioStato`, parametri di sistema per soglie e durata token.

Lo schema completo e versionato in `backend/src/database/postgres/schema_full.sql`.

## 6. API principali
- **Autenticazione**: `/auth/register`, `/auth/login`, `/auth/refresh-token`, `/auth/logout`, `/auth/logout-all`, gestione sessioni attive e revoca.
- **Lotti**: CRUD con filtri per stato, creazione da segnalazione, aggiornamento stato, upload foto (collegato a segnalazioni).
- **Prenotazioni**: creazione, aggiornamento stato, eliminazione, validazioni automatizzate.
- **Segnalazioni**: creazione multipart, revisione (`start`, `approva`, `rifiuta`), allegati e chiusura.
- **Notifiche**: elenco, conteggio non letti, marcatura come lette, websocket per push.
- **Statistiche e report**: counters, serie temporali, export dei lotti completati.
- **Utility**: geocoding (`/geocoding/address`), health check (`/health-check`), swagger (`/api-docs`).

Per payload di esempio e codici di risposta consulta lo swagger generato o gli integration test in `tests/integration/`.

## 7. Configurazione e ambienti
- Variabili fondamentali (`backend/.env`): `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PORT`, `API_PREFIX`, `CORS_ORIGIN`, `JWT_SECRET`, `ACCESS_TOKEN_EXPIRATION`, `REFRESH_TOKEN_EXPIRATION`, `SEGNALAZIONI_CLEANUP_CRON`, `SEGNALAZIONI_RETENTION_DAYS`, `GOOGLE_MAPS_API_KEY`.
- Il frontend usa `EXPO_PUBLIC_API_URL` (impostato nel `.env` di root) per indirizzare le API.
- Script rapidi: `setup_windows_pg.ps1` e `setup_unix.sh` creano gli environment di sviluppo.

## 8. Sicurezza e osservabilita
- Password cifrate con bcrypt, token JWT firmati con `JWT_SECRET`, refresh token salvati con hash.
- Revoca token centralizzata (`TokenRevocati`) con script `invalidate_refresh_tokens.js` per reset forzati.
- Upload protetti da validazioni MIME e dimensione, con salvataggio in folder isolato.
- Logging strutturato con Winston (stdout + file), livelli configurabili via `LOG_LEVEL`.
- Health check su `/api-docs` e `/health-check` per monitoraggio esterno.

## 9. Documentazione correlata
- `PROJECT_SETUP.md`: setup completo, init DB, troubleshooting.
- `README_REFOOD_HANDOFF_IT.md`: guida per handoff operativo e deploy.
- `GOOGLE_MAPS_API_KEY_SETUP.md`: generazione e protezione della chiave Geocoding.
- `TESTING.md`: esecuzione di test Jest e k6.
- Cartella `scheme/`: panoramica attori/casi d'uso e struttura DB con riferimenti alle immagini UML.

Questa pagina fornisce la bussola generale; segui i documenti specifici per istruzioni operative.
