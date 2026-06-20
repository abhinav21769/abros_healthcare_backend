require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const connectDB = require("./src/config/database");
const swaggerDocument = require("./src/config/swagger");
const medicineRoutes = require("./src/routes/medicine.routes");
const customerRoutes = require("./src/routes/customer.routes");
const invoiceRoutes = require("./src/routes/invoice.routes");

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Abros Healthcare - Medicine Inventory Management System",
    version: "1.0.0",
    endpoints: {
      swagger: "/api-docs",
      medicines: "/api/medicines",
      customers: "/api/customers",
      invoices: "/api/invoices",
    },
  });
});

app.use("/api/medicines", medicineRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/invoices", invoiceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
