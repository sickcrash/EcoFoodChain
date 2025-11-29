# ReFood Test Suite

Questa cartella raccoglie tutti i test del progetto e gli script di orchestrazione per generare report e log.

## Struttura
- `unit/`: test unitari (Jest) che non richiedono il database.
- `integration/`: test di integrazione (Jest) che richiedono un PostgreSQL configurato.
- `performance/`: scenari k6, utility per i job schedulati e script di monitoraggio risorse (`cpu-ram.test.ps1`).
- `notification/`: stub server e script per verificare le push Expo.
- `results/`: cartella in cui confluiscono i report (coverage HTML, log Jest, summary k6, metriche CPU/RAM).

## Esecuzione automatica
PowerShell:
```
./tests/run-tests.ps1
```
CMD:
```
tests\run-tests.bat
```

Lo script esegue nell''ordine:
1. Test Jest (unit + integration) del backend con coverage HTML.
2. Uno scenario di performance k6 (`tests/performance/scenarios/main.js`) se k6 e'' installato.
3. La generazione di `tests/results/<timestamp>/index.html` con link rapidi ai report.

Requisiti minimi:
- Dipendenze backend installate (`cd backend && npm install`).
- Variabili in `backend/.env` valorizzate per puntare al DB di test.
- (Opzionale) k6 installato per includere la parte performance.
- (Opzionale) definire `RESOURCE_MONITOR_PROCESS` per raccogliere metriche di risorsa.

## Monitoraggio CPU/RAM (opzionale)
Per salvare le metriche del processo backend durante i test:
```
$Env:RESOURCE_MONITOR_PROCESS = 'node'
$Env:RESOURCE_MONITOR_DURATION = '120'   # secondi
$Env:RESOURCE_MONITOR_INTERVAL = '5'     # secondi
./tests/run-tests.ps1
```
Valori aggiuntivi opzionali:
- `RESOURCE_MONITOR_PID`: PID esplicito da monitorare.
- `RESOURCE_MONITOR_CPU_THRESHOLD`: soglia di picco CPU (percentuale) per fallire il test.
- `RESOURCE_MONITOR_MEMORY_THRESHOLD_MB`: soglia di picco RAM (MB) per fallire il test.
- `RESOURCE_MONITOR_LABEL`: etichetta personalizzata per il file JSON prodotto.

L''output viene salvato in `tests/results/<timestamp>/performance/cpu-ram-<label>.json`.

## Area notification
```
cd tests/notification
npm install
node stub-notification-server.js
```
Per inviare una push Expo:
1. Inserisci il token Expo in `tests/notification/test-push.js`.
2. `node tests/notification/test-push.js`.

## Output
Dopo ogni run trovi i risultati in `tests/results/<timestamp>/`:
- `index.html`: indice aggregato con link ai report.
- `coverage/`: report HTML di coverage Jest.
- `jest-output.txt`: log completo dei test Jest.
- `performance/k6-output.txt`: log k6 (se presente).
- `performance/results/`: summary JSON generati dagli script k6.
- `performance/cpu-ram-*.json`: metriche CPU/RAM raccolte durante i test.
