const Medicine = require('../models/medicine.model');

// Create a new medicine
const createMedicine = async (req, res) => {
    try {
        const medicine = new Medicine(req.body);
        await medicine.save();
        res.status(201).json({
            success: true,
            message: 'Medicine created successfully',
            data: medicine
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to create medicine',
            error: error.message
        });
    }
};

// Get all medicines
const getAllMedicines = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            sortBy = 'createdAt', 
            order = 'desc',
            name,
            packagingType,
            expired
        } = req.query;

        // Build filter object
        const filter = {};
        
        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }
        
        if (packagingType) {
            filter.packagingType = packagingType;
        }

        if (expired === 'true') {
            filter.expiryDate = { $lt: new Date() };
        } else if (expired === 'false') {
            filter.expiryDate = { $gte: new Date() };
        }

        // Calculate pagination
        const skip = (page - 1) * limit;
        const sortOrder = order === 'asc' ? 1 : -1;

        // Get medicines with pagination
        const medicines = await Medicine.find(filter)
            .sort({ [sortBy]: sortOrder })
            .limit(parseInt(limit))
            .skip(skip);

        // Get total count for pagination
        const total = await Medicine.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: medicines,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch medicines',
            error: error.message
        });
    }
};

// Get a single medicine by ID
const getMedicineById = async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        
        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'Medicine not found'
            });
        }

        res.status(200).json({
            success: true,
            data: medicine
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch medicine',
            error: error.message
        });
    }
};

// Update a medicine
const updateMedicine = async (req, res) => {
    try {
        const medicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            req.body,
            { 
                new: true, 
                runValidators: true 
            }
        );

        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'Medicine not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Medicine updated successfully',
            data: medicine
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Failed to update medicine',
            error: error.message
        });
    }
};

// Delete a medicine
const deleteMedicine = async (req, res) => {
    try {
        const medicine = await Medicine.findByIdAndDelete(req.params.id);

        if (!medicine) {
            return res.status(404).json({
                success: false,
                message: 'Medicine not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Medicine deleted successfully',
            data: medicine
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete medicine',
            error: error.message
        });
    }
};

// Get medicines expiring soon (within specified days)
const getMedicinesExpiringSoon = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        const medicines = await Medicine.find({
            expiryDate: {
                $gte: today,
                $lte: futureDate
            }
        }).sort({ expiryDate: 1 });

        res.status(200).json({
            success: true,
            message: `Medicines expiring within ${days} days`,
            count: medicines.length,
            data: medicines
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expiring medicines',
            error: error.message
        });
    }
};

// Get expired medicines
const getExpiredMedicines = async (req, res) => {
    try {
        const medicines = await Medicine.find({
            expiryDate: { $lt: new Date() }
        }).sort({ expiryDate: -1 });

        res.status(200).json({
            success: true,
            count: medicines.length,
            data: medicines
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expired medicines',
            error: error.message
        });
    }
};

// Get inventory dashboard/stats - Total, Expired, Expiring stock
const getInventoryStats = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        // Get total count
        const totalStock = await Medicine.countDocuments();

        // Get expired count
        const expiredStock = await Medicine.countDocuments({
            expiryDate: { $lt: today }
        });

        // Get expiring soon count
        const expiringStock = await Medicine.countDocuments({
            expiryDate: {
                $gte: today,
                $lte: futureDate
            }
        });

        // Get active/valid stock count
        const activeStock = await Medicine.countDocuments({
            expiryDate: { $gte: today }
        });

        // Get total quantity in stock
        const totalQuantityResult = await Medicine.aggregate([
            { $group: { _id: null, totalQuantity: { $sum: '$quantity' } } }
        ]);
        const totalQuantity = totalQuantityResult.length > 0 ? totalQuantityResult[0].totalQuantity : 0;

        // Get total inventory value (MRP * Quantity)
        const totalValueResult = await Medicine.aggregate([
            { 
                $group: { 
                    _id: null, 
                    totalValue: { $sum: { $multiply: ['$mrp', '$quantity'] } } 
                } 
            }
        ]);
        const totalInventoryValue = totalValueResult.length > 0 ? totalValueResult[0].totalValue : 0;

        // Get expired medicines list
        const expiredMedicines = await Medicine.find({
            expiryDate: { $lt: today }
        })
        .select('name expiryDate quantity mrp manufacturer')
        .sort({ expiryDate: -1 })
        .limit(10);

        // Get expiring medicines list
        const expiringMedicines = await Medicine.find({
            expiryDate: {
                $gte: today,
                $lte: futureDate
            }
        })
        .select('name expiryDate quantity mrp manufacturer')
        .sort({ expiryDate: 1 })
        .limit(10);

        // Get low stock medicines (quantity < 10)
        const lowStockCount = await Medicine.countDocuments({
            quantity: { $lt: 10 }
        });

        res.status(200).json({
            success: true,
            message: 'Inventory statistics',
            stats: {
                totalStock: totalStock,
                activeStock: activeStock,
                expiredStock: expiredStock,
                expiringStock: expiringStock,
                expiringWithinDays: days,
                lowStockCount: lowStockCount,
                totalQuantity: totalQuantity,
                totalInventoryValue: totalInventoryValue.toFixed(2)
            },
            expiredMedicines: {
                count: expiredStock,
                list: expiredMedicines
            },
            expiringMedicines: {
                count: expiringStock,
                withinDays: days,
                list: expiringMedicines
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inventory stats',
            error: error.message
        });
    }
};

module.exports = {
    createMedicine,
    getAllMedicines,
    getMedicineById,
    updateMedicine,
    deleteMedicine,
    getMedicinesExpiringSoon,
    getExpiredMedicines,
    getInventoryStats
};

