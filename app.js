require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');
const medicineRoutes = require('./src/routes/medicine.routes');
const customerRoutes = require('./src/routes/customer.routes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.json({ 
        message: 'Abros Healthcare - Medicine Inventory Management System',
        version: '1.0.0',
        endpoints: {
            medicines: '/api/medicines',
            customers: '/api/customers'
        }
    });
});

app.use('/api/medicines', medicineRoutes);
app.use('/api/customers', customerRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
