const express = require("express");
const router = express.Router();
const invoiceController = require("../controller/invoice.controller");

router.post("/", invoiceController.createInvoice);
router.get("/", invoiceController.getAllInvoices);
router.get("/stats", invoiceController.getInvoiceStats);
router.get("/generate-number", invoiceController.generateInvoiceNumber);
router.get("/:id", invoiceController.getInvoiceById);
router.put("/:id", invoiceController.updateInvoice);
router.delete("/:id", invoiceController.deleteInvoice);

module.exports = router;
