# ReFood - Test e Qualita'

Questa guida descrive come eseguire in modo consistente le suite automatiche disponibili nel repository e come archiviare correttamente i risultati in `tests/results/<timestamp>/`.

## 1. Suite disponibili
- **Jest (backend)**  
  - `npm run test:local` (dalla root) esegue Jest in `backend/` puntando all'API locale (`TEST_API_BASE_URL` viene impostato automaticamente su `http://localhost:3000/api/v1` se mancante).  
  - `npm --prefix backend test -- --coverage` genera anche il report HTML in `backend/coverage/`.
- **Orchestratore completo**  
  - `powershell -NoProfile -File tests/run-tests.ps1` avvia Jest, copia la coverage (se esiste), esegue k6 se disponibile e opzionalmente il monitoraggio CPU/RAM. Produce output organizzato per timestamp (log `jest-output.txt`, `performance/k6-output.txt`, eventuali `cpu-ram-*.json` e un `index.html` con link ai file generati).
- **Performance dedicate**  
  - `k6 run tests/performance/scenarios/main.js` (o un altro scenario) richiede che le variabili d'ambiente `USERNAME`, `PASSWORD`, `CENTER_USERNAME`, `CENTER_PASSWORD` siano valorizzate per i login automatici.

## 2. Parametri richiesti dal runner
Lo script `tests/run-tests.ps1` interagisce con l'utente solo per le credenziali:
- Impostare `TEST_USER_EMAIL` e `TEST_USER_PASSWORD` nel terminale evita il prompt interattivo.
- `USERNAME`, `PASSWORD`, `CENTER_USERNAME`, `CENTER_PASSWORD` vengono letti da k6 durante l'esecuzione; definiscili prima di avviare l'orchestratore se usi gli scenari multi-account.
- `RESOURCE_MONITOR_PID` oppure `RESOURCE_MONITOR_PROCESS` (ad es. `node`) attivano automaticamente `tests/performance/cpu-ram.test.ps1`.
- `K6_SCENARIO` consente di scegliere uno script diverso da `tests\performance\scenarios\main.js`.
- Variabili opzionali: `RAMPING_TARGET_RPS`, `K6_STAGE_SECONDS`, `K6_STAGE_COOLDOWN`, `RESOURCE_MONITOR_DURATION`, `RESOURCE_MONITOR_INTERVAL` vengono passate direttamente agli script e devono essere numeriche.

Il runner controlla `TEST_API_BASE_URL` e, se non risponde, avvia provvisoriamente `node backend/src/server.js`. Arresta il processo generato a fine esecuzione e ripristina il valore originale di `TEST_API_BASE_URL`.

## 3. Controlli post-esecuzione
Dopo ogni run verifica i contenuti di `tests/results/<timestamp>/`:
- `jest-output.txt` deve terminare con `PASS` e senza stacktrace.
- `coverage/index.html` viene copiato solo se il comando Jest ha generato la coverage (in caso contrario la cartella non esiste).
- `performance/k6-output.txt` riporta l'output completo di k6; controlla le soglie in coda al file.
- File `cpu-ram-*.json` (uno per label) sono presenti solo se il monitor e' stato richiesto; controlla il campo `Status` per assicurarti che `ExitCode` sia 0.
- Il file `index.html` creato dal runner funge da indice ai log disponibili; aprilo nel browser per un riepilogo rapido.

Se lo script viene interrotto manualmente (es. chiudendo k6), alcuni file potrebbero mancare: in tal caso rimuovi l'intero `tests/results/<timestamp>/` incompleto prima di archiviare.

## 4. Reporting e consegna
Per ogni rilascio documenta all'interno di `documentation/TEST_RESULTS.md` o nel verbale di progetto:
1. Commit/tag testato e timestamp della cartella `tests/results/`.
2. Comandi usati (almeno `npm run test:local` o `tests/run-tests.ps1`), indicando eventuali parametri personalizzati (`RAMPING_TARGET_RPS`, durata monitor ecc.).
3. Esito sintetico di ogni suite (PASS/FAIL) e collegamento ai log salvati.
4. Eventuali deviazioni (suite saltate, soglie modificate, errori di ambiente) con motivazione.

Seguendo questi passaggi chi riceve il progetto puo' riprodurre velocemente il ciclo di test e verificare la tracciabilita' dei risultati.
