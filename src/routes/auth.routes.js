const express = require("express");
const authController = require("../controller/auth.controller");
const { authenticate, requireAdminSecret } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", authController.login);
router.get("/me", authenticate, authController.getMe);
router.post("/users", requireAdminSecret, authController.createUser);

module.exports = router;
