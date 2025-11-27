const AppServer = require('./appServer');
const bootstrap = require('./bootstrap');

/**
 * Main server entry point
 * Orchestrates the startup of the entire application
 */
async function main() {
    console.log('Starting Hyperledger Fabric REST API Server...');

    let appServer;

    try {
        // Initialize bootstrap (Fabric Gateway, etc.)
        await bootstrap.initialize();

        // Uncomment the next line if you want to initialize the ledger on startup
        // This should typically only be done once when the application is first deployed
        // await bootstrap.initializeLedger();

        // Setup graceful shutdown handlers
        bootstrap.setupGracefulShutdown();

        // Create and start the Express server
        appServer = new AppServer();
        await appServer.start();

        console.log('Application started successfully!');
        console.log('Ready to handle blockchain transactions');

    } catch (error) {
        console.error('Failed to start application:', error);

        // Cleanup on startup failure
        if (appServer) {
            await appServer.stop();
        }
        await bootstrap.shutdown();

        process.exitCode = 1;
        process.exit(1);
    }
}

// Handle startup errors
main().catch((error) => {
    console.error('Unhandled error during startup:', error);
    process.exitCode = 1;
    process.exit(1);
});

module.exports = { main };