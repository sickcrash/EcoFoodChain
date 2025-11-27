const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Import routes
const productRoutes = require('./routes/productRoutes');
const batchRoutes = require('./routes/batchRoutes');

/**
 * Express Application Server
 * Configures and creates the Express application with middleware and routes
 */
class AppServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Body parser middleware
        /*
            Trasformare da string a oggetto usabile i json
         */
        this.app.use(bodyParser.json({ limit: '10mb' }));
        this.app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

        // CORS middleware
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        }));

        // Request logging middleware
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            if (req.method === 'POST' || req.method === 'PUT') {
                console.log('Request body:', req.body);
            }
            next();
        });

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development'
            });
        });

        // API info endpoint
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Hyperledger Fabric REST API',
                version: '1.0.0',
                description: 'REST API for Hyperledger Fabric blockchain interaction',
                endpoints: {
                    products: 'api/products',
                    batches: 'api/batches',
                    health: '/health'
                }
            });
        });
    }

    /**
     * Setup application routes
     */
    setupRoutes() {
        // Mount product routes
        this.app.use('/', productRoutes);

        // Mount batch routes
        this.app.use('/', batchRoutes);

        // 404 handler for undefined routes
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Route not found',
                message: `The requested route ${req.method} ${req.originalUrl} was not found on this server.`,
                availableEndpoints: [
                    'GET /health',
                    'GET /api',
                    'GET /readProduct?productId=xxx',
                    'GET /readBatch?batchId=xxx',
                    'POST /uploadProduct',
                    'POST /uploadBatch'
                ]
            });
        });
    }

    /**
     * Setup error handling middleware
     */
    setupErrorHandling() {
        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Global error handler:', err);

            // Default error response
            const errorResponse = {
                error: 'Internal Server Error',
                message: err.message || 'An unexpected error occurred',
                timestamp: new Date().toISOString(),
                path: req.path
            };

            // Add stack trace in development
            if (process.env.NODE_ENV === 'development') {
                errorResponse.stack = err.stack;
            }

            // Determine status code
            const statusCode = err.status || err.statusCode || 500;

            res.status(statusCode).json(errorResponse);
        });
    }

    /**
     * Start the server
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    console.log(`JavaScript server running on port ${this.port}`);
                    resolve(this.server);
                });

                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        console.error(`Port ${this.port} is already in use`);
                    } else {
                        console.error('Server error:', error);
                    }
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Stop the server
     */
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('Server stopped successfully');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Get Express app instance
     */
    getApp() {
        return this.app;
    }
}

module.exports = AppServer;