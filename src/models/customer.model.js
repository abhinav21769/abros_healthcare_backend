const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
        index: true
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true
    },
    contact: {
        type: String,
        required: [true, 'Contact number is required'],
        trim: true
    },
    gstin: {
        type: String,
        required: [true, 'GSTIN is required'],
        trim: true,
        uppercase: true,
        unique: true
    },
    dlNo: {
        type: String,
        required: [true, 'D.L NO is required'],
        trim: true,
        uppercase: true,
        unique: true
    }
}, {
    timestamps: true
});

// Index for efficient searching
customerSchema.index({ name: 1, contact: 1 });
customerSchema.index({ dlNo: 1 });
customerSchema.index({ gstin: 1 });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;

