const express = require("express");
const purchaseController = require("../controller/purchase.controller");

const router = express.Router();

router.get("/generate-number", purchaseController.generatePurchaseNumber);
router.post("/", purchaseController.createPurchase);
router.get("/", purchaseController.getAllPurchases);
router.get("/:id", purchaseController.getPurchaseById);

module.exports = router;
