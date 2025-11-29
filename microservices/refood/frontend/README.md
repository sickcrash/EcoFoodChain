# Refood Mobile App

Applicazione mobile per la gestione dello spreco alimentare, progettata per connettere centri di riciclaggio e centri sociali.

## Descrizione

Refood Mobile è un'applicazione React Native sviluppata con Expo che permette di gestire lotti di cibo in eccesso, facilitando la donazione da centri di riciclaggio a centri sociali.

## Prerequisiti

- [Node.js](https://nodejs.org/) (versione 14 o superiore)
- [npm](https://www.npmjs.com/) o [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Un emulatore Android/iOS o un dispositivo fisico con l'app Expo Go installata

## Installazione

1. Clona questo repository
2. Installa le dipendenze:

```bash
cd frontend
npm install
```

3. Avvia l'applicazione:

```bash
npm start
```

4. Usa l'app Expo Go sul tuo dispositivo per scansionare il QR code, oppure premi `a` nella console per aprire l'app su un emulatore Android

## Problemi comuni

### Problemi di cache

Se riscontri problemi all'avvio dell'applicazione, prova a cancellare la cache:

```bash
npm run start:clear
```

### Errori di compilazione TypeScript

Se vedi errori relativi a moduli non trovati, assicurati di aver installato tutte le dipendenze correttamente.

## Informazioni aggiuntive

- L'applicazione utilizza Expo Router per la navigazione
- Il backend dell'applicazione deve essere in esecuzione per poter utilizzare le funzionalità di autenticazione e gestione dati
- L'URL del backend può essere configurato in `src/config/constants.ts`

## Contatti

Per informazioni o supporto, contattare il team di sviluppo.
