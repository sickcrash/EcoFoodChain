/**
 * Server stub per testare le notifiche
 * Questo server simula gli endpoint dell'API per le notifiche
 * 
 * Esegui con: node stub-notification-server.js
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3030;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database in memoria per le notifiche
let notifiche = [
  {
    id: 1,
    titolo: 'Benvenuto in ReFood',
    messaggio: 'Grazie per aver installato ReFood! Qui riceverai notifiche su eventi importanti come cambiamenti di stato dei lotti, prenotazioni, e altro.',
    tipo: 'Alert',
    priorita: 'Alta',
    letta: false,
    data: new Date().toISOString(),
    dataCreazione: new Date().toISOString()
  },
  {
    id: 2,
    titolo: 'Nuovo lotto disponibile',
    messaggio: 'Un nuovo lotto di prodotti è disponibile. Controlla la lista dei lotti per maggiori dettagli.',
    tipo: 'CambioStato',
    priorita: 'Media',
    letta: false,
    data: new Date(Date.now() - 3600000).toISOString(), // 1 ora fa
    dataCreazione: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 3,
    titolo: 'La tua prenotazione è stata confermata',
    messaggio: 'La tua prenotazione per il lotto #1234 è stata confermata dal sistema.',
    tipo: 'Prenotazione',
    priorita: 'Bassa',
    letta: true,
    data: new Date(Date.now() - 7200000).toISOString(), // 2 ore fa
    dataCreazione: new Date(Date.now() - 7200000).toISOString()
  }
];

let nextId = notifiche.length + 1;

// Endpoint per ottenere tutte le notifiche
app.get('/api/v1/notifiche', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const tipo = req.query.tipo;
  const priorita = req.query.priorita;
  const letta = req.query.letta !== undefined ? req.query.letta === 'true' : undefined;
  
  console.log(`GET /api/v1/notifiche - Query params:`, req.query);
  
  // Filtraggio
  let risultati = [...notifiche];
  
  if (tipo) {
    risultati = risultati.filter(n => n.tipo === tipo);
  }
  
  if (priorita) {
    risultati = risultati.filter(n => n.priorita === priorita);
  }
  
  if (letta !== undefined) {
    risultati = risultati.filter(n => n.letta === letta);
  }
  
  // Paginazione
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedResults = risultati.slice(startIndex, endIndex);
  
  res.json({
    data: paginatedResults,
    pagination: {
      total: risultati.length,
      currentPage: page,
      totalPages: Math.ceil(risultati.length / limit)
    }
  });
});

// Endpoint per ottenere il conteggio delle notifiche non lette
app.get('/api/v1/notifiche/conteggio', (req, res) => {
  console.log('GET /api/v1/notifiche/conteggio');
  
  const nonLette = notifiche.filter(n => !n.letta).length;
  
  res.json({
    count: nonLette
  });
});

// Endpoint per ottenere una singola notifica per ID
app.get('/api/v1/notifiche/:id', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`GET /api/v1/notifiche/${id}`);
  
  const notifica = notifiche.find(n => n.id === id);
  
  if (!notifica) {
    return res.status(404).json({ 
      message: 'Notifica non trovata',
      error: true 
    });
  }
  
  res.json({ data: notifica });
});

// Endpoint per segnare una notifica come letta
app.put('/api/v1/notifiche/:id/letta', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`PUT /api/v1/notifiche/${id}/letta`);
  
  const index = notifiche.findIndex(n => n.id === id);
  
  if (index === -1) {
    return res.status(404).json({ 
      message: 'Notifica non trovata',
      error: true 
    });
  }
  
  notifiche[index].letta = true;
  
  res.json({ 
    success: true,
    data: notifiche[index]
  });
});

// Endpoint per segnare tutte le notifiche come lette
app.put('/api/v1/notifiche/lette', (req, res) => {
  console.log('PUT /api/v1/notifiche/lette');
  
  notifiche = notifiche.map(n => ({ ...n, letta: true }));
  
  res.json({ 
    success: true,
    message: 'Tutte le notifiche sono state segnate come lette'
  });
});

// Endpoint per eliminare una notifica
app.delete('/api/v1/notifiche/:id', (req, res) => {
  const id = parseInt(req.params.id);
  console.log(`DELETE /api/v1/notifiche/${id}`);
  
  const index = notifiche.findIndex(n => n.id === id);
  
  if (index === -1) {
    return res.status(404).json({ 
      message: 'Notifica non trovata',
      error: true 
    });
  }
  
  notifiche.splice(index, 1);
  
  res.json({ 
    success: true,
    message: 'Notifica eliminata con successo'
  });
});

// Endpoint per creare una nuova notifica (utile per testare)
app.post('/api/v1/notifiche', (req, res) => {
  console.log('POST /api/v1/notifiche', req.body);
  
  const { titolo, messaggio, tipo, priorita } = req.body;
  
  if (!titolo || !messaggio) {
    return res.status(400).json({
      message: 'Titolo e messaggio sono campi obbligatori',
      error: true
    });
  }
  
  const nuovaNotifica = {
    id: nextId++,
    titolo,
    messaggio,
    tipo: tipo || 'Alert',
    priorita: priorita || 'Media',
    letta: false,
    data: new Date().toISOString(),
    dataCreazione: new Date().toISOString()
  };
  
  notifiche.unshift(nuovaNotifica); // Aggiungi all'inizio dell'array
  
  res.status(201).json({
    success: true,
    data: nuovaNotifica
  });
});

// Avvia il server
app.listen(port, () => {
  console.log(`Server stub notifiche in esecuzione su http://localhost:${port}`);
  console.log(`Endpoint disponibili:`);
  console.log(`- GET /api/v1/notifiche`);
  console.log(`- GET /api/v1/notifiche/conteggio`);
  console.log(`- GET /api/v1/notifiche/:id`);
  console.log(`- PUT /api/v1/notifiche/:id/letta`);
  console.log(`- PUT /api/v1/notifiche/lette`);
  console.log(`- DELETE /api/v1/notifiche/:id`);
  console.log(`- POST /api/v1/notifiche`);
}); 

