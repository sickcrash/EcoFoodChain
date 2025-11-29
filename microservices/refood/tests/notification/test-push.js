// Script per testare l'invio di notifiche push tramite Expo Push API
const axios = require('axios');

// Inserisci qui il token ottenuto dall'app
const EXPO_PUSH_TOKEN = 'ExponentPushToken[SOSTITUISCI_CON_IL_TUO_TOKEN]';

// Funzione per inviare una notifica push di test
async function sendTestPushNotification() {
  try {
    const message = {
      to: EXPO_PUSH_TOKEN,
      sound: 'default',
      title: 'Test Notifica ReFood',
      body: 'Questa è una notifica di test inviata dallo script test-push.js',
      data: {
        type: 'notifica',
        id: 1,
        customKey: 'customValue',
      },
    };

    console.log('Invio notifica push di test...');
    console.log('Messaggio:', JSON.stringify(message, null, 2));

    const response = await axios.post('https://exp.host/--/api/v2/push/send', message, {
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });

    console.log('Risposta:', response.data);
    console.log('Notifica inviata con successo!');
  } catch (error) {
    console.error('Errore durante l\'invio della notifica:', error);
    if (error.response) {
      console.error('Dettagli errore:', error.response.data);
    }
  }
}

// Esegui la funzione
sendTestPushNotification(); 

