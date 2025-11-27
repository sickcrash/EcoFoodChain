const { TextDecoder } = require('node:util');
const fabricGateway = require('./gateway');
const { channelName, chaincodeName } = require('../config/env');

const utf8Decoder = new TextDecoder();

/**
 * Contract service for interacting with Hyperledger Fabric chaincode
 */
class ContractService {
    /**
     * Get the smart contract instance
     */
    getContract() {
        const gateway = fabricGateway.getGateway();
        const network = gateway.getNetwork(channelName);
        return network.getContract(chaincodeName);
    }

    /**
     * Initialize the ledger with default data
     */
    async initLedger() {
        console.log('\n--> Submit Transaction: initLedger, function creates the initial set of products on the ledger');

        const contract = this.getContract();
        await contract.submitTransaction('initLedger');

        console.log('✅ *** Transaction committed successfully ***');
    }

    /**
     * Create a new product on the ledger
     */
    async createProduct(productData) {
        console.log('\n--> Submit Transaction: CreateProduct, creates new product with provided arguments');

        if (!productData) {
            console.error("ERROR: productData is undefined or null!");
            throw new Error("Product data is required");
        }

        console.log("Received data:", productData);

        const {
            ID = "",
            Name = "",
            Manufacturer = "",
            HarvestDate = "",
            Ingredients = "",
            Allergens = "",
            Nutritional_information = "",
            SowingDate = "",
            PesticideUse = "",
            FertilizerUse = "",
            CountryOfOrigin = "",
            SensorData = {},
            Certifications = {},
            CustomObject = {}
        } = productData;

        // Validate objects
        this.validateObject(SensorData, 'SensorData');
        this.validateObject(Certifications, 'Certifications');
        this.validateObject(CustomObject, 'CustomObject');

        console.log('\n--> Starting transaction submission');

        try {
            const contract = this.getContract();
            console.log("Parameters passed to transaction:", {
                ID, Name, Manufacturer, HarvestDate, Ingredients, Allergens,
                Nutritional_information, SowingDate, PesticideUse, FertilizerUse,
                CountryOfOrigin, SensorData, Certifications, CustomObject
            });

            await contract.submitTransaction(
                'createProduct',
                ID,
                Name,
                Manufacturer,
                HarvestDate,
                Ingredients,
                Allergens,
                Nutritional_information,
                SowingDate,
                PesticideUse,
                FertilizerUse,
                CountryOfOrigin,
                JSON.stringify(SensorData),
                JSON.stringify(Certifications),
                JSON.stringify(CustomObject)
            );

            console.log('*** Transaction committed successfully ***');
        } catch (error) {
            console.error('Error in submitTransaction:', error);
            throw error;
        }
    }

    /**
     * Create a new batch on the ledger
     */
    async createBatch(batchData) {
        console.log('\n--> Submit Transaction: CreateBatch, creates new batch with provided arguments');

        if (!batchData) {
            console.error("ERROR: batchData is undefined or null!");
            throw new Error("Batch data is required");
        }

        console.log("Received data:", batchData);

        const {
            ID = "",
            ProductId = "",
            Operator = "",
            BatchNumber = "",
            Quantity = "",
            ProductionDate = "",
            State = "",
            CustomObject = {}
        } = batchData;

        // Validate CustomObject
        this.validateObject(CustomObject, 'CustomObject');

        console.log('\n--> Starting transaction submission');

        try {
            const contract = this.getContract();
            console.log("📌 Parameters passed to transaction:", {
                ID, ProductId, Operator, BatchNumber, Quantity, ProductionDate, State, CustomObject
            });

            await contract.submitTransaction(
                'createBatch',
                ID,
                ProductId,
                Operator,
                BatchNumber,
                Quantity,
                ProductionDate,
                State,
                JSON.stringify(CustomObject)
            );

            console.log('*** Transaction committed successfully ***');
        } catch (error) {
            console.error('Error in submitTransaction:', error);
            throw error;
        }
    }

    /**
     * Read product by ID
     */
    async readProductByID(productId) {
        console.log('\n--> Evaluate Transaction: ReadProduct, function returns product attributes');

        const contract = this.getContract();
        const resultBytes = await contract.evaluateTransaction('ReadProduct', productId);
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);

        console.log('*** Result:', result);
        return result;
    }

    /**
     * Read batch by ID
     */
    async readBatchByID(batchId) {
        console.log('\n--> Evaluate Transaction: ReadBatch, function returns batch attributes');

        const contract = this.getContract();
        const resultBytes = await contract.evaluateTransaction('ReadBatch', batchId);
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);

        console.log('*** Result:', result);
        return result;
    }

    /**
     * Get product history by ID
     */
    async getProductHistoryByID(productId) {
        console.log('\n--> Evaluate Transaction: GetProductHistory, function returns product history');

        const contract = this.getContract();
        const resultBytes = await contract.evaluateTransaction('GetProductHistory', productId);
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);

        console.log('*** Result:', result);
        return result;
    }

    /**
     * Get batch history by ID
     */
    async getBatchHistoryByID(batchId) {
        console.log('\n--> Evaluate Transaction: GetBatchHistory, function returns batch history');

        const contract = this.getContract();
        const resultBytes = await contract.evaluateTransaction('GetBatchHistory', batchId);
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);

        console.log('*** Result:', result);
        return result;
    }

    /**
     * Get all products
     */
    async getAllProducts() {
        const contract = this.getContract();
        const resultBytes = await contract.evaluateTransaction('GetAllProducts');
        const resultJson = utf8Decoder.decode(resultBytes);
        const results = JSON.parse(resultJson);

        console.log('*** All Products:', results);
        return results;
    }

    /**
     * Update product
     */
    async updateProduct(productData) {
        console.log("Data sent to chaincode:", productData);

        const contract = this.getContract();
        await contract.submitTransaction(
            'UpdateProduct',
            productData.ID,
            productData.Name,
            productData.Manufacturer,
            productData.HarvestDate,
            productData.Ingredients,
            productData.Allergens,
            productData.Nutritional_information,
            productData.SowingDate,
            productData.PesticideUse,
            productData.FertilizerUse,
            productData.CountryOfOrigin,
            JSON.stringify(productData.SensorData),
            JSON.stringify(productData.Certifications),
            JSON.stringify(productData.CustomObject)
        );
    }

    /**
     * Update batch
     */
    async updateBatch(batchData) {
        console.log("Data sent to chaincode:", batchData);

        const contract = this.getContract();
        await contract.submitTransaction(
            'UpdateBatch',
            batchData.ID,
            batchData.ProductId,
            batchData.Operator,
            batchData.BatchNumber,
            batchData.Quantity,
            batchData.ProductionDate,
            batchData.State,
            JSON.stringify(batchData.CustomObject)
        );
    }

    /**
     * Add sensor data to product
     */
    async addSensorData(id, sensorId, signals) {
        console.log("Received sensor data: " + id + ", " + sensorId + ", " + JSON.stringify(signals));

        const contract = this.getContract();
        await contract.submitTransaction('AddSensorData', id, sensorId, JSON.stringify(signals));
    }

    /**
     * Add certification to product
     */
    async addCertification(id, certificationType, certifyingBody, issueDate) {
        const contract = this.getContract();
        await contract.submitTransaction('AddCertification', id, certificationType, certifyingBody, issueDate);
    }

    /**
     * Get all sensor data for a product
     */
    async getAllSensorData(id) {
        const contract = this.getContract();
        const response = await contract.evaluateTransaction('GetAllSensorData', id);
        const result = utf8Decoder.decode(response);
        console.log(result);
        return JSON.parse(result);
    }

    /**
     * Get all certifications for a product
     */
    async getAllCertifications(id) {
        const contract = this.getContract();
        const response = await contract.evaluateTransaction('GetAllCertifications', id);
        const result = utf8Decoder.decode(response);
        console.log(result);
        return JSON.parse(result);
    }

    /**
     * Validate object structure
     */
    validateObject(obj, name) {
        if (typeof obj !== 'object') {
            console.error(`ERROR: ${name} is not a valid object!`, obj);
            throw new Error(`${name} must be an object`);
        }

        try {
            JSON.stringify(obj);
            console.log(`${name} after JSON.stringify:`, JSON.stringify(obj));
        } catch (error) {
            console.error(`❌ ERROR in ${name} serialization:`, error);
            throw new Error(`${name} serialization failed`);
        }
    }
}

module.exports = new ContractService();