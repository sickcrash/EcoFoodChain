const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const {
    keyDirectoryPath,
    certDirectoryPath,
    tlsCertPath,
    peerEndpoint,
    peerHostAlias,
    mspId
} = require('../config/env');

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

        // The gRPC client connection should be shared by all Gateway connections to this endpoint
        this.client = await this.createGrpcConnection();

        this.gateway = connect({
            client: this.client,
            identity: await this.createIdentity(),
            signer: await this.createSigner(),
            // Default timeouts for different gRPC calls
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
    async createGrpcConnection() {
        const tlsRootCert = await fs.readFile(tlsCertPath);
        const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
        return new grpc.Client(peerEndpoint, tlsCredentials, {
            'grpc.ssl_target_name_override': peerHostAlias,
        });
    }

    /**
     * Create identity for authentication
     */
    async createIdentity() {
        const certPath = await this.getFirstDirFileName(certDirectoryPath);
        const credentials = await fs.readFile(certPath);
        return { mspId, credentials };
    }

    /**
     * Create signer for transactions
     */
    async createSigner() {
        const keyPath = await this.getFirstDirFileName(keyDirectoryPath);
        const privateKeyPem = await fs.readFile(keyPath);
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        return signers.newPrivateKeySigner(privateKey);
    }

    /**
     * Get first file name from directory
     */
    async getFirstDirFileName(dirPath) {
        const files = await fs.readdir(dirPath);
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