const contractService = require('../fabric/contract');

/**
 * Product Controller
 * Handles all product-related HTTP requests
 */
class ProductController {
    /**
     * Read product by ID
     */
    async readProduct(req, res) {
        const { productId } = req.query;

        try {
            console.log("Init read product");
            const result = await contractService.readProductByID(productId);
            res.json(result);
        } catch (error) {
            console.error('Error reading product by ID:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get product history
     */
    async getProductHistory(req, res) {
        const { productId } = req.query;

        try {
            const result = await contractService.getProductHistoryByID(productId);
            res.json(result);
        } catch (error) {
            console.error('Error reading product history by ID:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Upload (create) new product
     */
    async uploadProduct(req, res) {
        const productData = req.body;
        console.log('Received product data:', productData);

        const { ID } = productData;

        try {
            // Check if product already exists
            try {
                const existingProduct = await contractService.readProductByID(ID);
                if (existingProduct) {
                    return res.status(400).json({
                        message: `Product with ID ${ID} already exists.`
                    });
                }
            } catch (error) {
                if (error.message.includes(`The product ${ID} does not exist`)) {
                    // This is expected if the product doesn't exist, so we can continue
                    console.log('Product not found, proceeding to create it.');
                } else {
                    // Unexpected error
                    console.error('Error checking for existing product:', error);
                    return res.status(500).json({
                        message: 'Failed to check for existing product.'
                    });
                }
            }

            await contractService.createProduct(productData);
            res.json({ message: 'Product created successfully' });
            console.log('Product created successfully');
        } catch (error) {
            console.error('Error creating product:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update existing product
     */
    async updateProduct(req, res) {
        console.log('Update product request:', req.body);
        const productData = req.body;
        console.log('Received product data:', productData);

        try {
            console.log('Starting product update...');
            await contractService.updateProduct(productData);
            res.status(200).json({ message: 'Product updated successfully' });
        } catch (error) {
            console.error(`Failed to update product: ${error}`);
            res.status(500).json({
                error: `Failed to update product: ${error.message}`
            });
        }
    }

    /**
     * Add sensor data to product
     */
    async addSensorData(req, res) {
        try {
            const { id, SensorId, Signals } = req.body;
            await contractService.addSensorData(id, SensorId, Signals);

            res.status(200).json({
                message: `Sensor data added to product ${id}`
            });
        } catch (error) {
            console.error(`Failed to add sensor data: ${error}`);
            res.status(500).json({
                error: `Error adding sensor data: ${error.message}`
            });
        }
    }

    /**
     * Add certification to product
     */
    async addCertification(req, res) {
        try {
            const { id, certificationType, certifyingBody, issueDate } = req.body;
            console.log('Adding certification:', req.body);

            await contractService.addCertification(id, certificationType, certifyingBody, issueDate);

            res.status(200).json({
                message: `Certification added to product ${id}`
            });
        } catch (error) {
            console.error(`Failed to add certification: ${error}`);
            res.status(500).json({
                error: `Error adding certification: ${error.message}`
            });
        }
    }

    /**
     * Get all sensor data for a product
     */
    async getSensorData(req, res) {
        try {
            const id = req.query.productId;
            const resultJson = await contractService.getAllSensorData(id);
            res.json(resultJson);
        } catch (error) {
            console.error(`Failed to retrieve all sensor data: ${error}`);
            res.status(500).json({
                error: `Failed to retrieve all sensor data: ${error.message}`
            });
        }
    }

    /**
     * Get all certifications for a product
     */
    async getCertifications(req, res) {
        try {
            const id = req.query.productId;
            const resultJson = await contractService.getAllCertifications(id);
            res.json(resultJson);
        } catch (error) {
            console.error(`Failed to retrieve all certification data: ${error}`);
            res.status(500).json({
                error: `Failed to retrieve all certification data: ${error.message}`
            });
        }
    }
}

module.exports = new ProductController();