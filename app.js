require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const connectDB = require("./src/config/database");
const swaggerDocument = require("./src/config/swagger");
const medicineRoutes = require("./src/routes/medicine.routes");
const customerRoutes = require("./src/routes/customer.routes");
const invoiceRoutes = require("./src/routes/invoice.routes");
const { ERROR_CODES, sendSuccess, sendError } = require("./src/utils/response");
const { ERRORS } = require("./src/utils/messages");

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
  return sendSuccess(res, {
    message: "Abros Healthcare - Medicine Inventory Management System",
    data: {
      version: "1.0.0",
      endpoints: {
        swagger: "/api-docs",
        medicines: "/api/medicines",
        customers: "/api/customers",
        invoices: "/api/invoices",
      },
    },
  });
});

app.use("/api/medicines", medicineRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/invoices", invoiceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  return sendError(res, {
    message: ERRORS.generic,
    code: ERROR_CODES.INTERNAL_ERROR,
    errorMessage: ERRORS.generic,
    statusCode: 500,
  });
});

// 404 handler
app.use((req, res) => {
  return sendError(res, {
    message: ERRORS.notFound.route,
    code: ERROR_CODES.ROUTE_NOT_FOUND,
    errorMessage: ERRORS.notFound.route,
    statusCode: 404,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
