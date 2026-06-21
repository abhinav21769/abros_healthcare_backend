const express = require("express");
const dashboardController = require("../controller/dashboard.controller");

const router = express.Router();

router.get("/stats", dashboardController.getDashboardStats);

module.exports = router;
