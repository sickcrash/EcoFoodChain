# ReFood - Guida al Testing

Questa guida descrive come eseguire i test automatici del progetto in locale e in ambienti integrati, oltre alle prove di performance con k6.

## 1. Panoramica
- Test unitari e di integrazione (backend) con Jest.
- Verifiche manuali della UI seguendo `documentation/SMOKE_TEST_FRONTEND.md`.
- Script k6 per test di carico (steady, spike, soak, websocket, upload).

Variabili comuni:
- `TEST_API_BASE_URL`: URL dell'API su cui girano i test Jest.
- `K6_BASE_URL`: URL target per k6 (default ereditato dagli script).

## 2. Backend Jest

### 2.1 Modalita locale
1. Avvia Postgres e applica lo schema (`npm run pg:init:full`).
2. Avvia il backend in un terminale (`npm run dev`).
3. Dal root del repo esegui:
```
npm run test:local
```
Il comando imposta `TEST_API_BASE_URL=http://localhost:3000/api/v1`, esegue Jest con coverage e stampa un riepilogo a schermo. I report dettagliati si trovano in `tests/results/<timestamp>/`.

### 2.2 Interpretazione risultati
- Successo: tutte le suite verdi, richieste 2xx. Alcuni test accettano `409` (utente gia presente) come esito valido.
- Errori tipici:
  - `ECONNREFUSED`: backend non raggiungibile (controlla porta e `TEST_API_BASE_URL`).
  - `401/403`: credenziali errate o schema non inizializzato.
  - Errori DB: verifica credenziali nel `.env` e i log di Postgres.

## 3. Performance con k6

### 3.1 Requisiti
- Installare k6 (Windows: `winget install k6.k6`, macOS: `brew install k6`).
- Backend raggiungibile sull'URL che userai come base.

### 3.2 Esecuzione
```
# Steady load su backend locale
npm run perf:local

# Spike o soak
npm run perf:local:spike
npm run perf:local:soak
```
Gli script `tests/performance/run-k6.ps1` e `tests/performance/k6/*.js` accettano variabili opzionali (`K6_BASE_URL`, `K6_VUS`, `K6_DURATION`, `K6_SPIKE_VUS`, `K6_RAMP_UP`, `K6_RAMP_DOWN`, `K6_HOLD`).

### 3.3 Output
- Risultati a terminale con statistiche su durata e error rate.
- Soglie predefinite (steady): `http_req_failed < 1%`, `http_req_duration p(95) < 600ms`, `p(99) < 1200ms`.
- Exit code non zero se le soglie non sono rispettate.

## 4. Script ausiliari
- `tests/run-tests.ps1`: orchestratore Windows che avvia il backend on demand, esegue Jest e genera report HTML.
- `tests/performance/scheduler-runner.js`: misura i job dello scheduler (utile per verificare lotti e notifiche automatiche).

## 5. Suggerimenti pratici
- Prima di rilasciare: `npm run test:local` e completa uno smoke manuale lato frontend (vedi `documentation/SMOKE_TEST_FRONTEND.md`).
- Dopo modifiche su lotti/prenotazioni: aggiungi `npm run perf:local` per validare i tempi di risposta.
- Gli script automatici creano utenti di prova: ripulisci periodicamente le anagrafiche o riutilizza utenti esistenti.

Seguendo questi flussi ottieni feedback rapido su regressioni funzionali e sul comportamento sotto carico.
