const express = require('express');
const router = express.Router();
const batchController = require('../controller/batchController');

/**
 * Batch Routes
 * Defines all batch-related API endpoints
 */

// GET /readBatch?batchId=xxx
router.get('/readBatch', batchController.readBatch);

// GET /batchHistory?batchId=xxx
router.get('/batchHistory', batchController.getBatchHistory);

// POST /uploadBatch
router.post('/uploadBatch', batchController.uploadBatch);

// POST api/batch/updateBatch
router.post('api/batch/updateBatch', batchController.updateBatch);

module.exports = router;