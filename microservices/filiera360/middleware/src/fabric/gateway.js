const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('node:fs');          // Modulo base (per existsSync)
const fsPromises = require('node:fs/promises'); // Modulo Promise (per await readFile)
const path = require('node:path');

// Variabili env rimosse perché usiamo il CCP

/**
 * Fabric Gateway management class
 */
class FabricGateway {
    constructor() {
        this.gateway = null;
        this.client = null;
    }

    /**
     * Initialize the gateway connection
     */
    async initialize() {
        console.log('Initializing Fabric Gateway...');

        // 1. Definisci il percorso del CCP (Connection Profile)
        const ccpPath = path.resolve('/fabric', 'connection-org1.json');
        
        // Verifica se il file esiste (Sincrono va bene qui)
        if (!fs.existsSync(ccpPath)) {
            console.error(`ERROR: Connection profile not found at ${ccpPath}. Check volume mount.`);
            throw new Error(`CCP file not found.`);
        }

        // 2. Leggi il file JSON (CORREZIONE: Aggiunto await)
        const ccpJson = await fsPromises.readFile(ccpPath, 'utf-8');
        const ccp = JSON.parse(ccpJson);

        // 3. Crea il client gRPC usando i dati del CCP
        this.client = await this.createGrpcConnection(ccp);

        // 4. Connetti il Gateway (CORREZIONE: Decommentato e ripristinato)
        this.gateway = connect({
            client: this.client,
            identity: await this.createIdentity(),
            signer: await this.createSigner(),
            // --- AGGIUNGI QUESTO BLOCCO ---
            discovery: { 
                enabled: true, 
                asLocalhost: false // <--- CRUCIALE: Dice all'SDK di usare i nomi DNS reali (K8s)
            },
            // ------------------------------
            // Default timeouts
            evaluateOptions: () => {
                return { deadline: Date.now() + 5000 }; // 5 seconds
            },
            endorseOptions: () => {
                return { deadline: Date.now() + 15000 }; // 15 seconds
            },
            submitOptions: () => {
                return { deadline: Date.now() + 5000 }; // 5 seconds
            },
            commitStatusOptions: () => {
                return { deadline: Date.now() + 60000 }; // 1 minute
            },
        });

        console.log('Fabric Gateway initialized successfully');
        return this.gateway;
    }

    /**
     * Create gRPC connection
     */
    async createGrpcConnection(ccp) {
        // Estrazione delle informazioni necessarie dal CCP
        const peerKey = Object.keys(ccp.peers)[0];
        const peerConfig = ccp.peers[peerKey];
        
        // 1. CARICAMENTO CERTIFICATO TLS ROOT (il path è corretto nel CCP)
        const tlsRootCertPath = path.resolve('/fabric', peerConfig.tlsCACerts.path); 
        
        // CORREZIONE: Uso fsPromises invece di fs
        const tlsRootCert = await fsPromises.readFile(tlsRootCertPath);
        const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
        
        // 2. ESTRAZIONE ENDPOINT K8S E FQDN PER L'OVERRIDE TLS
        const peerEndpoint = peerConfig.url.replace('grpcs://', ''); 
        const requiredTargetName = peerConfig.grpcOptions['ssl-target-name-override']; 

        // 3. COSTRUZIONE DELLA CONNESSIONE
        return new grpc.Client(peerEndpoint, tlsCredentials, {
            'grpc.ssl_target_name_override': requiredTargetName, 
        });
    }

    /**
     * Create identity for authentication
     */
    async createIdentity() {
        // Importiamo le variabili necessarie qui o le leggiamo dal CCP/Config. 
        // Per semplicità, leggiamo dai file mappati in env.js ma usando i path corretti
        // Nota: Assicurati che env.js esporti ancora queste variabili o hardcodale qui se preferisci
        const { certDirectoryPath, mspId } = require('../config/env');

        const certPath = await this.getFirstDirFileName(certDirectoryPath);
        // CORREZIONE: Uso fsPromises
        const credentials = await fsPromises.readFile(certPath);
        return { mspId, credentials };
    }

    /**
     * Create signer for transactions
     */
    async createSigner() {
        const { keyDirectoryPath } = require('../config/env');

        const keyPath = await this.getFirstDirFileName(keyDirectoryPath);
        // CORREZIONE: Uso fsPromises
        const privateKeyPem = await fsPromises.readFile(keyPath);
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        return signers.newPrivateKeySigner(privateKey);
    }

    /**
     * Get first file name from directory
     */
    async getFirstDirFileName(dirPath) {
        // CORREZIONE: Uso fsPromises
        const files = await fsPromises.readdir(dirPath);
        const file = files[0];
        if (!file) {
            throw new Error(`No files in directory: ${dirPath}`);
        }
        return path.join(dirPath, file);
    }

    /**
     * Get the gateway instance
     */
    getGateway() {
        if (!this.gateway) {
            throw new Error('Gateway not initialized. Call initialize() first.');
        }
        return this.gateway;
    }

    /**
     * Close gateway and client connections
     */
    close() {
        if (this.gateway) {
            this.gateway.close();
        }
        if (this.client) {
            this.client.close();
        }
        console.log('Fabric Gateway connections closed');
    }
}

// Export singleton instance
module.exports = new FabricGateway();