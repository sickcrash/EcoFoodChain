# ReFood - Attori e Casi d'Uso

Questo documento sintetizza i ruoli coinvolti nella piattaforma e i casi d'uso principali che devono essere supportati.

## 1. Attori e responsabilita

### Amministratore
- Gestisce utenti, tipologie e centri (CRUD completo).
- Revisiona le segnalazioni inviate dai centri, approvando o rifiutando.
- Consulta statistiche, esporta report, monitora le notifiche globali.
- Puo intervenire sugli stati dei lotti e delle prenotazioni in qualsiasi momento.

Endpoint tipici: /auth/*, /attori/*, /segnalazioni/*, /lotti/*, /prenotazioni/*, /statistiche/*, /report/*.

### Operatore
- Registra lotti interni, aggiorna scadenze e quantita.
- Gestisce il flusso di prenotazione e consegna (transizioni stato).
- Consulta statistiche operative e notifiche rilevanti.

Endpoint tipici: /lotti/*, /prenotazioni/*, /statistiche/*.

### Operatore Centro
- Crea segnalazioni di eccedenze con allegati fotografici.
- Monitora gli stati delle proprie segnalazioni (in revisione, approvata, rifiutata).
- Riceve notifiche su esito e trasformazione in lotto.

Endpoint tipici: POST /segnalazioni, GET /segnalazioni, GET /segnalazioni/:id, DELETE /segnalazioni/:id.

### Utente tipizzato (Privato, Canale sociale, Centro riciclo)
- Visualizza solo lotti compatibili con il colore del proprio tipo.
- Prenota lotti disponibili, segue il loro avanzamento.
- Riceve notifiche personalizzate su cambi stato, annulli, messaggi operatore.

Endpoint tipici: /lotti/disponibili, /prenotazioni, /notifiche, /notifiche/conteggio.

## 2. Regole di visibilita
- Lotti: visibili a tutti gli operatori; agli utenti finali solo per colore e solo se non gia prenotati/consegnati.
- Segnalazioni: visibili al centro creatore e agli amministratori.
- Notifiche: filtrate per destinatario, ruolo o tipo utente.
- Mappa centri e statistiche: consultabili da ogni ruolo autenticato.

## 3. Casi d'uso chiave

### CU1 - Login e gestione sessioni
1. Utente invia POST /auth/login e riceve token access/refresh.
2. Puo rinnovare il token via POST /auth/refresh-token.
3. Logout singolo (POST /auth/logout) o globale (POST /auth/logout-all).
4. Amministratore puo visualizzare e revocare sessioni attive (GET /auth/active-sessions, DELETE /auth/revoke-session/:id).

### CU2 - Registrazione e associazione centri
1. POST /auth/register crea un attore con ruolo e, se necessario, associa un record Tipo_Utente.
2. Se presente la chiave Google viene tentato il geocoding dell'indirizzo (best effort).
3. Campi opzionali vengono normalizzati (coordinate nullable, cognome non obbligatorio per alcuni tipi).

### CU3 - Gestione lotti
1. Operatore crea un lotto (POST /lotti).
2. Il sistema calcola e aggiorna automaticamente lo stato colore quando cambia la shelf life (scheduler).
3. Operatore modifica o elimina (PUT/DELETE /lotti/:id).
4. Consultazione tramite filtri (GET /lotti, /lotti/disponibili).

### CU4 - Prenotazioni
1. Utente abilita prenotazione (POST /prenotazioni).
2. Operatore applica le transizioni consentite (PUT /prenotazioni/:id con nuovo stato).
3. Stato finale Consegnato chiude il lotto; esistono rami Rifiutato, Annullato, Eliminato.
4. Notifiche vengono emesse ad ogni cambio stato.

### CU5 - Segnalazioni con foto
1. Operatore Centro invia POST /segnalazioni (multipart) con metadati e immagini.
2. Amministratore avvia revisione (POST /segnalazioni/:id/revisione/start).
3. Approvazione (POST /segnalazioni/:id/revisione/approva) genera un lotto e notifica gli interessati.
4. Rifiuto (.../rifiuta) invia feedback al centro.

### CU6 - Notifiche e realtime
1. Backend salva notifiche su Notifiche con priorita e riferimenti.
2. Gli utenti aprono il websocket wss://{host}/api/v1/notifications/ws?token=JWT per ricevere messaggi push.
3. La UI consente di segnare le notifiche come lette (PATCH /notifiche/:id/letto).

### CU7 - Statistiche e reportistica
- Consultazione contatori /statistiche/counters e serie temporali /statistiche/complete.
- Esportazione report lotti consegnati /report/lotti-completati?from=...&to=...&formato=csv.

## 4. Supporto e manutenibilita
- Logger correlati con X-Request-Id per tracciare le operazioni critiche.
- Scheduler giornaliero aggiorna stati lotti e ripulisce segnalazioni chiuse dopo SEGNALAZIONI_RETENTION_DAYS.
- Le immagini UML nella cartella uml/ illustrano i casi d'uso principali e il deployment suggerito.

Questo documento puo essere fornito ad analisti e nuovi sviluppatori per comprendere rapidamente l'ambito funzionale di ReFood.