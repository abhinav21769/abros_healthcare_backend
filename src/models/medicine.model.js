const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Medicine name is required'],
        trim: true,
        index: true
    },
    expiryDate: {
        type: Date,
        required: [true, 'Expiry date is required'],
        validate: {
            validator: function(value) {
                return value > new Date();
            },
            message: 'Expiry date must be in the future'
        }
    },
    packagingType: {
        type: String,
        required: [true, 'Packaging type is required'],
        enum: {
            values: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Powder', 'Other'],
            message: '{VALUE} is not a valid packaging type'
        }
    },
    mrp: {
        type: Number,
        required: [true, 'MRP is required'],
        min: [0, 'MRP cannot be negative']
    },
    quantity: {
        type: Number,
        default: 0,
        min: [0, 'Quantity cannot be negative']
    },
    batchNumber: {
        type: String,
        trim: true
    },
    manufacturer: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index for efficient querying
medicineSchema.index({ name: 1, expiryDate: 1 });

// Virtual for checking if medicine is expired
medicineSchema.virtual('isExpired').get(function() {
    return this.expiryDate < new Date();
});

// Method to get days until expiry
medicineSchema.methods.getDaysUntilExpiry = function() {
    const today = new Date();
    const diffTime = this.expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

const Medicine = mongoose.model('Medicine', medicineSchema);

module.exports = Medicine;

