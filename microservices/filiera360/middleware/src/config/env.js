const path = require('node:path');
const fs = require('node:fs');

/**
 * Environment configuration utility
 * Provides default values for environment variables
 */
function envOrDefault(key, defaultValue) {
    return process.env[key] || defaultValue;
}

// Channel and chaincode configuration
const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'filiera360');
const mspId = envOrDefault('MSP_ID', 'Org1MSP');

// Determinazione del Path Base (Locale vs Kubernetes)
// Se esiste la cartella /fabric, siamo nel cluster K8s. Altrimenti siamo in locale.
const isK8s = fs.existsSync('/fabric');
const basePath = isK8s 
    ? '/fabric/crypto-config/peerOrganizations/org1.example.com'
    : path.resolve(__dirname, '..', '..', 'blockchain', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com');

console.log(`[Config] Environment: ${isK8s ? 'KUBERNETES' : 'LOCAL'}`);
console.log(`[Config] Base Path: ${basePath}`);

// 3. Path dei Materiali Crittografici (Crypto Materials)
const cryptoPath = envOrDefault('CRYPTO_PATH', basePath);
// Path alla chiave privata dell'utente (User1)
const keyDirectoryPath = envOrDefault(
    'KEY_DIRECTORY_PATH',
    path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore')
);

// Path al certificato dell'utente (User1)
const certDirectoryPath = envOrDefault(
    'CERT_DIRECTORY_PATH',
    path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts')
);

// Path al certificato TLS del Peer (per verificare la connessione sicura)
const tlsCertPath = envOrDefault(
    'TLS_CERT_PATH',
    // Cambia il path da /peers/.../ca.crt a /tlsca/.../tlsca.org1.example.com-cert.pem
    path.resolve(cryptoPath, 'tlsca', 'tlsca.org1.example.com-cert.pem') 
);

// 4. Configurazione Endpoint Peer
// In K8s usiamo il nome DNS del servizio (peer0-org1) e la porta 7051
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'peer0-org1:7051');

// Host Alias per TLS (deve combaciare con il SANS del certificato)
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

/**
 * Display input parameters for debugging
 */
function displayInputParameters() {
    console.log(`channelName:       ${channelName}`);
    console.log(`chaincodeName:     ${chaincodeName}`);
    console.log(`mspId:             ${mspId}`);
    console.log(`cryptoPath:        ${cryptoPath}`);
    console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
    console.log(`certDirectoryPath: ${certDirectoryPath}`);
    console.log(`tlsCertPath:       ${tlsCertPath}`);
    console.log(`peerEndpoint:      ${peerEndpoint}`);
    console.log(`peerHostAlias:     ${peerHostAlias}`);
}

module.exports = {
    envOrDefault,
    channelName,
    chaincodeName,
    mspId,
    cryptoPath,
    keyDirectoryPath,
    certDirectoryPath,
    tlsCertPath,
    peerEndpoint,
    peerHostAlias,
    displayInputParameters
};