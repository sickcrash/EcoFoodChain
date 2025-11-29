# Istruzioni per Testare le Notifiche Push in ReFood Mobile

## Metodo 1: Test Notifiche Locali

Il modo più semplice per verificare il funzionamento delle notifiche è utilizzare il pulsante di test all'interno dell'app:

1. Avvia l'app ReFood Mobile
2. Accedi con le tue credenziali
3. Vai alla sezione "Notifiche"
4. Clicca sul pulsante con l'icona del campanello (verde) in alto a destra
5. Dovresti vedere una notifica locale apparire immediatamente

## Metodo 2: Test Notifiche Remote con Expo

Per testare le notifiche push remote utilizzando il servizio Expo:

### Prerequisiti
- Node.js installato
- npm o yarn installato

### Passi

1. **Ottieni il tuo token Expo Push**:
   - Avvia l'app in modalità sviluppo
   - Dopo l'accesso, controlla i log della console
   - Cerca il messaggio "Token push salvato: ExponentPushToken[...]"
   - Copia questo token

2. **Modifica lo script di test**:
   - Apri il file `test-push.js` in questa directory
   - Sostituisci `SOSTITUISCI_CON_IL_TUO_TOKEN` con il tuo token Expo Push

3. **Installa axios** (se non è già installato):
   ```bash
   npm install axios
   ```

4. **Esegui lo script**:
   ```bash
   node test-push.js
   ```

5. **Verifica**:
   - Dovresti ricevere una notifica push sul tuo dispositivo
   - Se l'app è in background, tocca la notifica per verificare che ti porti alla schermata corretta
   - Se l'app è in primo piano, dovresti vedere un toast con la notifica

## Metodo 3: Test con l'Expo Push Tool (Online)

Puoi anche utilizzare lo strumento online di Expo per inviare notifiche push:

1. Vai a https://expo.dev/notifications
2. Inserisci il tuo token push
3. Personalizza il titolo, il messaggio e i dati della notifica
4. Invia la notifica

## Server Stub per Notifiche ReFood

Questo server stub simula gli endpoint API per le notifiche di ReFood, fornendo un ambiente di test isolato per lo sviluppo dell'app mobile.

### Funzionalità 

- Simula tutti gli endpoint necessari per le notifiche
- Fornisce dati di esempio per testare vari tipi di notifiche
- Supporta operazioni CRUD complete sulle notifiche

### Prerequisiti

- Node.js (v14 o superiore)
- npm

### Installazione

```bash
cd tests/notification
npm install
```

### Utilizzo

```bash
node stub-notification-server.js
```

- Il server sarà in ascolto su `http://localhost:3030`
- Puoi puntare temporaneamente il client mobile a `http://localhost:3030/api/v1`

### Endpoint disponibili

- `GET /api/v1/notifiche` - Recupera l'elenco delle notifiche
- `GET /api/v1/notifiche/conteggio` - Conta le notifiche (supporta filtro per lette/non lette)
- `GET /api/v1/notifiche/:id` - Dettaglio di una notifica specifica
- `PUT /api/v1/notifiche/:id/letta` - Segna una notifica come letta
- `PUT /api/v1/notifiche/lette` - Segna tutte le notifiche come lette
- `DELETE /api/v1/notifiche/:id` - Elimina una notifica
- `POST /api/v1/notifiche` - Crea una nuova notifica

## Nota

Questo server è solo per scopi di test e non deve essere usato in produzione.

