const express = require('express');
const router = express.Router();
const customerController = require('../controller/customer.controller');

// Customer routes
router.post('/', customerController.createCustomer);
router.get('/', customerController.getAllCustomers);
router.get('/stats', customerController.getCustomerStats);
router.get('/dl/:dlNo', customerController.getCustomerByDlNo);
router.get('/:id', customerController.getCustomerById);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;

