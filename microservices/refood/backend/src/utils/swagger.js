const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Refood API',
      version: '1.0.0',
      description: 'API per l\'app Refood contro lo spreco alimentare',
      contact: {
        name: 'Refood Team',
        url: 'https://refood.org',
        email: 'info@refood.org',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}${process.env.API_PREFIX || '/api/v1'}`,
        description: 'Server di sviluppo',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js',
  ],
};

const specs = swaggerJsDoc(options);

module.exports = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));
};

/**
 * @swagger
 * tags:
 *   name: WebSocket
 *   description: API WebSocket per notifiche in tempo reale
 */

/**
 * @swagger
 * /api/notifications/ws:
 *   get:
 *     summary: Endpoint WebSocket per notifiche in tempo reale
 *     description: >
 *       Questo endpoint stabilisce una connessione WebSocket per ricevere notifiche in tempo reale.
 *       La connessione deve essere stabilita con un token JWT valido come parametro query.
 *       Es. `/api/notifications/ws?token=jwt_token_here`
 *     tags: [WebSocket]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Token JWT per autenticare la connessione WebSocket
 *     responses:
 *       101:
 *         description: Switching Protocols - Connessione WebSocket stabilita
 *       401:
 *         description: Non autorizzato - Token JWT mancante o non valido
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     WebSocketMessage:
 *       type: object
 *       required:
 *         - type
 *         - timestamp
 *       properties:
 *         type:
 *           type: string
 *           description: Tipo di messaggio WebSocket
 *           enum:
 *             - connect
 *             - disconnect
 *             - message
 *             - error
 *             - notification
 *             - lotto_update
 *             - prenotazione_update
 *         payload:
 *           type: object
 *           description: Contenuto del messaggio, varia in base al tipo
 *         timestamp:
 *           type: integer
 *           format: int64
 *           description: Timestamp in millisecondi del messaggio
 *       example:
 *         type: notification
 *         payload:
 *           id: 123
 *           tipo: "warning"
 *           titolo: "Lotto in scadenza"
 *           messaggio: "Il lotto Mele è in scadenza tra 2 giorni"
 *           data_creazione: "2023-07-15T10:30:00.000Z"
 *           letto: false
 *           link: "/lotti/456"
 *         timestamp: 1689418200000
 */ 