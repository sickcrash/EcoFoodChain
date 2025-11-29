# ReFood - Frontend Smoke Test

Questa checklist verifica rapidamente i flussi base dopo una build o una consegna. Segui i passaggi per ciascun ruolo e annota eventuali anomalie (errori console, API 4xx/5xx, UI bloccata).

## Prerequisiti
- Backend attivo e raggiungibile (es. http://localhost:3000/api/v1 o endpoint remoto configurato).
- Frontend Expo avviato (comando consigliato: `npm run web`) o build web servita dal web server di riferimento.
- Utenti di prova per tutti i ruoli: Amministratore, Operatore, Operatore Centro, Utente (Privato/Sociale/Riciclo).
- Browser con console aperta (Chrome DevTools o equivalente).

## Giro fumo per ruolo
### Amministratore
- [ ] Login e reindirizzamento alla home con contatori.
- [ ] Tab Lotti: pulsanti "Dettagli" e "Elimina", assenza "Prenota".
- [ ] Tab Prenotazioni: le card mostrano pulsante "Elimina" solo per stati ammessi.
- [ ] Tab Segnalazioni: elenco completo, azioni di revisione disponibili.
- [ ] Tab Mappe: centri visibili e filtri funzionanti.
- [ ] Logout senza errori console.

### Operatore
- [ ] Login con arrivo alla home operativa.
- [ ] Tab Lotti: pulsante "+" per creare, pulsanti "Dettagli" e "Elimina" sulle card.
- [ ] Tab Prenotazioni: disponibili i pulsanti di workflow (Accetta, Rifiuta, Pronto per ritiro); assenza "Elimina".
- [ ] Tab Mappe: visibile.
- [ ] Logout.

### Operatore Centro (associato)
- [ ] Login e conferma della barra azioni dedicata.
- [ ] Tab Lotti: sola consultazione (nessuno "+" e nessun "Prenota"/"Elimina").
- [ ] Tab Segnalazioni: pulsante "Nuova segnalazione" funzionante; verifica creazione e presenza in lista.
- [ ] Tab Prenotazioni: lettura sola (nessun pulsante azione).
- [ ] Tab Mappe: accesso OK.
- [ ] Logout.

### Utente (Privato, Canale sociale, Centro riciclo)
- [ ] Login con atterraggio ai lotti filtrati sul proprio colore.
- [ ] Prenota un lotto disponibile e verifica che appaia nella tab Prenotazioni con stato iniziale "Richiesta" o "Confermato".
- [ ] Controlla che il pulsante "Annulla" sia visibile solo per richieste appena create.
- [ ] Tab Mappe disponibile e coerente con i filtri.
- [ ] Logout.

## Consolle e follow-up
- Durante ogni giro osserva la console Metro/Expo: nessun warning o errore ricorrente.
- Verifica che i toast di conferma compaiano e che le notifiche si aggiornino.
- Se trovi una regressione apri ticket, allega screenshot/log e ripeti il giro dopo la fix.
