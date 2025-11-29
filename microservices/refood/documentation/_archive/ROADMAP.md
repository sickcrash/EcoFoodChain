# ReFood - Roadmap Operativa

Questa roadmap riassume lo stato attuale del progetto e le attivita consigliate per mantenere l'app stabile dopo il handoff.

## Completato
- Migrazione completa da SQLite a PostgreSQL con schema consolidato (`pg_init_full.js`).
- Allineamento frontend su `EXPO_PUBLIC_API_URL` (nessun URL hardcoded in produzione).
- Revisione permessi e visibilita tab (dashboard riservata a admin e operatori, segnalazioni solo per i centri interessati).
- Pipeline di notifiche basata su websocket con priorita e riferimento a lotti/prenotazioni.
- Script di automazione: `setup_windows_pg.ps1`, `setup_unix.sh`, reset token (`invalidate_refresh_tokens.js`).
- Documentazione aggiornata (setup, testing, casi d'uso, struttura DB).

## In corso / prossimo sprint
1. **Verifica navigazione frontend**: completare uno smoke manuale seguendo `documentation/SMOKE_TEST_FRONTEND.md` prima di ogni consegna per intercettare regressioni di UI.
2. **Pulizia immagini upload**: valutare una retention policy (es. script schedulato) per evitare crescita non controllata di `uploads/segnalazioni`.
3. **Deployment automatizzato**: preparare pipeline CI/CD che crea e distribuisce i pacchetti backend/frontend con esecuzione dei test.
4. **Monitoraggio**: integrare i log del backend con un sistema centralizzato (Grafana Loki, ELK, CloudWatch) e impostare alert su errori 5xx e tempi di risposta anomali.
5. **UX**: completare una revisione accessibilita (contrast ratio, label) e aggiornare documentazione se cambiano le interazioni.

## Backlog osservato
- Localizzazione testi complessa (al momento UI in italiano). Definire se servono lingue aggiuntive.
- Integrazione con push notification native (Expo) per future versioni mobile.
- Metriche aggiuntive per analisi impatto (es. valore economico aggregato per mese) nel modulo statistiche.

## Manutenzione continuativa
- Rieseguire `pg_init_full.js` dopo merge di nuove migrazioni.
- Ruotare periodicamente `JWT_SECRET` e chiavi terze parti.
- Aggiornare dipendenze Node (backend e frontend) almeno ogni trimestre.
- Rieseguire i test di carico (`npm run perf:steady`) prima di eventi con traffico elevato.

Aggiorna questa roadmap dopo ogni iterazione per tenere allineato lo stato dei lavori.
