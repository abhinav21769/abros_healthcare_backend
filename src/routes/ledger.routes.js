const express = require("express");
const ledgerController = require("../controller/ledger.controller");

const router = express.Router();

router.get("/", ledgerController.getLedgerEntries);

module.exports = router;
