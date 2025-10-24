const express = require('express');
const router = express.Router();
const medicineController = require('../controller/medicine.controller');

// Basic CRUD routes
router.post('/', medicineController.createMedicine);
router.get('/', medicineController.getAllMedicines);
router.get('/stats', medicineController.getInventoryStats);
router.get('/expiring-soon', medicineController.getMedicinesExpiringSoon);
router.get('/expired', medicineController.getExpiredMedicines);
router.get('/:id', medicineController.getMedicineById);
router.put('/:id', medicineController.updateMedicine);
router.delete('/:id', medicineController.deleteMedicine);

module.exports = router;

