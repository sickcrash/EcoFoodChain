const express = require('express');
const router = express.Router();
const productController = require('../controller/productController');

/**
 * Product Routes
 * Defines all product-related API endpoints
 */

// GET /readProduct?productId=xxx
router.get('/readProduct', productController.readProduct);

// GET /productHistory?productId=xxx
router.get('/productHistory', productController.getProductHistory);

// POST /uploadProduct
router.post('/uploadProduct', productController.uploadProduct);

// POST api/product/updateProduct
router.post('api/product/updateProduct', productController.updateProduct);

// POST api/product/sensor
router.post('api/product/sensor', productController.addSensorData);

// POST api/product/certification
router.post('api/product/certification', productController.addCertification);

// GET api/product/getSensorData?productId=xxx
router.get('api/product/getSensorData', productController.getSensorData);

// GET api/product/getCertifications?productId=xxx
router.get('api/product/getCertifications', productController.getCertifications);

module.exports = router;