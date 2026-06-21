const Medicine = require("../models/medicine.model");
const { ERROR_CODES, sendSuccess, sendError } = require("../utils/response");
const { SUCCESS, ERRORS, getUserMessage } = require("../utils/messages");

const createMedicine = async (req, res) => {
  try {
    const medicine = new Medicine(req.body);
    await medicine.save();
    return sendSuccess(res, {
      message: SUCCESS.medicine.created,
      data: medicine,
      statusCode: 201,
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.saveFailed.medicine,
      code: ERROR_CODES.VALIDATION_ERROR,
      errorMessage: getUserMessage(error, ERRORS.saveFailed.medicine),
      statusCode: 400,
    });
  }
};

const getAllMedicines = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      name,
      packagingType,
      expired,
    } = req.query;

    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    if (packagingType) {
      filter.packagingType = packagingType;
    }

    if (expired === "true") {
      filter.expiryDate = { $lt: new Date() };
    } else if (expired === "false") {
      filter.expiryDate = { $gte: new Date() };
    }

    const skip = (page - 1) * limit;
    const sortOrder = order === "asc" ? 1 : -1;

    const medicines = await Medicine.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Medicine.countDocuments(filter);

    return sendSuccess(res, {
      data: {
        items: medicines,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.loadFailed.medicines,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.medicines,
      statusCode: 500,
    });
  }
};

const getMedicineById = async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return sendError(res, {
        message: ERRORS.notFound.medicine,
        code: ERROR_CODES.NOT_FOUND,
        errorMessage: ERRORS.notFound.medicine,
        statusCode: 404,
      });
    }

    return sendSuccess(res, { data: medicine });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.loadFailed.medicine,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.medicine,
      statusCode: 500,
    });
  }
};

const updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!medicine) {
      return sendError(res, {
        message: ERRORS.notFound.medicine,
        code: ERROR_CODES.NOT_FOUND,
        errorMessage: ERRORS.notFound.medicine,
        statusCode: 404,
      });
    }

    return sendSuccess(res, {
      message: SUCCESS.medicine.updated,
      data: medicine,
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.saveFailed.medicine,
      code: ERROR_CODES.VALIDATION_ERROR,
      errorMessage: getUserMessage(error, ERRORS.saveFailed.medicine),
      statusCode: 400,
    });
  }
};

const deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndDelete(req.params.id);

    if (!medicine) {
      return sendError(res, {
        message: ERRORS.notFound.medicine,
        code: ERROR_CODES.NOT_FOUND,
        errorMessage: ERRORS.notFound.medicine,
        statusCode: 404,
      });
    }

    return sendSuccess(res, {
      message: SUCCESS.medicine.deleted,
      data: medicine,
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.deleteFailed.medicine,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.deleteFailed.medicine,
      statusCode: 500,
    });
  }
};

const getMedicinesExpiringSoon = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const medicines = await Medicine.find({
      expiryDate: {
        $gte: today,
        $lte: futureDate,
      },
    }).sort({ expiryDate: 1 });

    return sendSuccess(res, {
      data: {
        count: medicines.length,
        items: medicines,
      },
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.loadFailed.expiringMedicines,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.expiringMedicines,
      statusCode: 500,
    });
  }
};

const getExpiredMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.find({
      expiryDate: { $lt: new Date() },
    }).sort({ expiryDate: -1 });

    return sendSuccess(res, {
      data: {
        count: medicines.length,
        items: medicines,
      },
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.loadFailed.expiredMedicines,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.expiredMedicines,
      statusCode: 500,
    });
  }
};

const getInventoryStats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const totalStock = await Medicine.countDocuments();

    const expiredStock = await Medicine.countDocuments({
      expiryDate: { $lt: today },
    });

    const expiringStock = await Medicine.countDocuments({
      expiryDate: {
        $gte: today,
        $lte: futureDate,
      },
    });

    const activeStock = await Medicine.countDocuments({
      expiryDate: { $gte: today },
    });

    const totalQuantityResult = await Medicine.aggregate([
      { $group: { _id: null, totalQuantity: { $sum: "$quantity" } } },
    ]);
    const totalQuantity =
      totalQuantityResult.length > 0 ? totalQuantityResult[0].totalQuantity : 0;

    const totalValueResult = await Medicine.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ["$rate", "$quantity"] } },
        },
      },
    ]);
    const totalInventoryValue =
      totalValueResult.length > 0 ? totalValueResult[0].totalValue : 0;

    const expiredMedicines = await Medicine.find({
      expiryDate: { $lt: today },
    })
      .select("name expiryDate quantity mrp manufacturer")
      .sort({ expiryDate: -1 })
      .limit(10);

    const expiringMedicines = await Medicine.find({
      expiryDate: {
        $gte: today,
        $lte: futureDate,
      },
    })
      .select("name expiryDate quantity mrp manufacturer")
      .sort({ expiryDate: 1 })
      .limit(10);

    const lowStockCount = await Medicine.countDocuments({
      quantity: { $lt: 10 },
    });

    return sendSuccess(res, {
      data: {
        stats: {
          totalStock,
          activeStock,
          expiredStock,
          expiringStock,
          expiringWithinDays: days,
          lowStockCount,
          totalQuantity,
          totalInventoryValue: totalInventoryValue.toFixed(2),
        },
        expiredMedicines: {
          count: expiredStock,
          list: expiredMedicines,
        },
        expiringMedicines: {
          count: expiringStock,
          withinDays: days,
          list: expiringMedicines,
        },
      },
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.loadFailed.inventoryStats,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.inventoryStats,
      statusCode: 500,
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
  getInventoryStats,
};
