const contractService = require('../fabric/contract');

/**
 * Batch Controller
 * Handles all batch-related HTTP requests
 */
class BatchController {
    /**
     * Read batch by ID
     */
    async readBatch(req, res) {
        console.log('In readBatch controller');
        const { batchId } = req.query;

        try {
            const result = await contractService.readBatchByID(batchId);
            res.json(result);
            console.log('Batch read successfully');
        } catch (error) {
            console.error('Error reading batch by ID:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get batch history
     */
    async getBatchHistory(req, res) {
        const { batchId } = req.query;

        try {
            const result = await contractService.getBatchHistoryByID(batchId);
            res.json(result);
        } catch (error) {
            console.error('Error reading batch history by ID:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Upload (create) new batch
     */
    async uploadBatch(req, res) {
        const batchData = req.body;
        console.log('Received batch data:', batchData);

        const { ID } = batchData;

        try {
            // Check if batch already exists
            try {
                const existingBatch = await contractService.readBatchByID(ID);
                if (existingBatch) {
                    return res.status(400).json({
                        message: `Batch with ID ${ID} already exists.`
                    });
                }
            } catch (error) {
                if (error.message.includes(`The batch ${ID} does not exist`)) {
                    // This is expected if the batch doesn't exist, so we can continue
                    console.log('Batch not found, proceeding to create it.');
                } else {
                    // Unexpected error
                    console.error('Error checking for existing batch:', error);
                    return res.status(500).json({
                        message: 'Failed to check for existing batch.'
                    });
                }
            }

            await contractService.createBatch(batchData);
            res.json({ message: 'Batch created successfully' });
            console.log('Batch created successfully');
        } catch (error) {
            console.error('Error creating batch:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Update existing batch
     */
    async updateBatch(req, res) {
        console.log('Batch update request on server:', req.body);
        const batchData = req.body;
        console.log('Received batch data:', batchData);

        try {
            console.log('Starting batch update...');
            await contractService.updateBatch(batchData);
            res.status(200).json({ message: 'Batch updated successfully' });
        } catch (error) {
            console.error(`Failed to update batch: ${error}`);
            res.status(500).json({
                error: `Failed to update batch: ${error.message}`
            });
        }
    }
}

module.exports = new BatchController();