# ReFood - Stato dei Test

Questa pagina documenta i report attualmente presenti in `tests/results/` e spiega come produrre una sessione valida in modo ripetibile.

## Report presenti nel repository
Nel repository sono inclusi tre tentativi del 2025-10-05 (`20251005_192413`, `20251005_201803`, `20251005_202505`). Li abbiamo ispezionati e tutti mostrano lo stesso stato:
- `jest-output.txt` contiene l'errore `Unknown command: "pm"`, quindi Jest non e' partito e non esiste un log PASS/FAIL.
- `performance/k6-output.txt` e i file `cpu-ram-*.json` (quando presenti) sono incompleti: le esecuzioni sono state interrotte entro il primo minuto e non riportano le soglie finali.
- In `20251005_202505` e' stato generato l'`index.html`, ma anch'esso rimanda solo a log incompleti.

Questi file non sono sufficienti per certificare un ciclo di test. Prima di una consegna ufficiale e' necessario rigenerare i report seguendo la procedura sotto.

## Come produrre un report valido
1. Prepara l'ambiente come descritto in `documentation/SETUP_LOCAL.md` e assicurati che il backend sia raggiungibile su `http://localhost:3000/api/v1`.
2. Imposta le variabili richieste dal runner (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `USERNAME`, `PASSWORD`, ecc.) e avvia `powershell -NoProfile -File tests/run-tests.ps1` come indicato in `documentation/QA_PLAN.md`.
3. A fine esecuzione verifica che `jest-output.txt` termini con `PASS`, che `performance/k6-output.txt` riporti le soglie e che `index.html` linki almeno la coverage HTML o i log principali.
4. Archivia la cartella `tests/results/<timestamp>/` prodotta (compressa o allegata) insieme a questo documento aggiornato con i dettagli del run.

## Cosa registrare in questo file
Quando disponi di un ciclo valido, aggiungi una sezione in alto con:
- Data/ora della run e commit testato.
- Comandi/parametri usati.
- Esito sintetico (PASS/FAIL) delle suite eseguite.
- Percorso alla cartella `tests/results/<timestamp>/`.

In assenza di questi dati, considera i report qui presenti solo materiale storico non certificato.
