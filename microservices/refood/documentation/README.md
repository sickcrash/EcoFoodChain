# ReFood - Documentazione

Questa cartella contiene le guide aggiornate per installare, testare e distribuire la piattaforma. Se e' la prima volta che configuri ReFood, scorri i riferimenti in ordine dalla sezione "Setup" e completa i collegamenti indicati.

## Setup
- `SETUP_LOCAL.md`: prerequisiti, gestione degli `.env`, installazione dipendenze e avvio manuale di backend/front-end senza Docker.
- `DB_SETUP.md`: provisioning PostgreSQL, script `pg_init_full.js`, verifiche sullo schema e seed iniziali.
- `DOCKER_GUIDE.md`: istruzioni per utilizzare lo stack containerizzato gia' pronto nella cartella `docker/` (non modificare i file di quella cartella, limitarsi a leggerli/eseguirli).
- `GOOGLE_MAPS_SETUP.md`: procedura aggiornata per creare, limitare e configurare la chiave Google Maps/Geocoding.

## Test e qualita'
- `QA_PLAN.md`: orchestrazione delle suite (Jest, k6, monitoraggio) partendo dagli script in `tests/`.
- `TEST_RESULTS.md`: stato attuale dei report presenti in `tests/results/` e checklist per archiviare correttamente un ciclo di test.

## Deployment e operazioni
- `DEPLOY_SMOKE.md`: checklist staging/produzione e smoke test manuali post deploy.
- `documentation/_archive/README_REFOOD_HANDOFF_IT.md`: materiale legacy per handoff esteso, insieme a roadmap e note storiche.

## Risorse aggiuntive
- Cartella `scheme/`: diagrammi, ERD e schemi di integrazione.
- Cartella `documentation/_archive/`: guide specialistiche non piu' aggiornate (es. memo demo, roadmap, handoff storico).

Tutti i documenti riportano solo procedure verificate su questo repository. Se aggiorni i flussi (nuovi script, nuove porte, ecc.) ricordati di modificare anche i riferimenti in questa cartella per mantenere coerente l'intera documentazione.
