const fabricGateway = require('./fabric/gateway');
const contractService = require('./fabric/contract');
const { displayInputParameters } = require('./config/env');

/**
 * Bootstrap application
 * Initializes Fabric Gateway and optionally initializes the ledger
 */
class Bootstrap {
    /**
     * Initialize the application
     */
    async initialize() {
        console.log('Starting application initialization...');

        try {
            // Display configuration parameters
            displayInputParameters();

            // Initialize Fabric Gateway
            await fabricGateway.initialize();

            console.log('Application initialization completed successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize application:', error);
            throw error;
        }
    }

    /**
     * Initialize ledger with default data (optional)
     * This should typically only be run once when the application is first deployed
     */
    async initializeLedger() {
        console.log('Initializing ledger with default data...');

        try {
            await contractService.initLedger();
            console.log('Ledger initialized successfully');
        } catch (error) {
            console.error('Failed to initialize ledger:', error);
            throw error;
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('Starting graceful shutdown...');

        try {
            // Close Fabric Gateway connections
            fabricGateway.close();
            console.log('Application shutdown completed successfully');
        } catch (error) {
            console.error('Error during shutdown:', error);
            throw error;
        }
    }

    /**
     * Setup process event handlers for graceful shutdown
     */
    setupGracefulShutdown() {
        // Handle SIGTERM
        // è un segnale inviato dal sistema (es. quando Docker ti chiede di spegnerti).
        process.on('SIGTERM', async () => {
            console.log('Received SIGTERM signal');
            await this.shutdown();
            process.exit(0);
        });

        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', async () => {
            console.log('Received SIGINT signal');
            await this.shutdown();
            process.exit(0);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', async (error) => {
            console.error('Uncaught Exception:', error);
            await this.shutdown();
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', async (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            await this.shutdown();
            process.exit(1);
        });
    }
}

module.exports = new Bootstrap();