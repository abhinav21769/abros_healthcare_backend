const Customer = require("../models/customer.model");

// Create a new customer
const createCustomer = async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer,
    });
  } catch (error) {
    // Handle duplicate DL NO or GSTIN error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Customer with this ${duplicateField.toUpperCase()} already exists`,
        error: error.message,
      });
    }
    res.status(400).json({
      success: false,
      message: "Failed to create customer",
      error: error.message,
    });
  }
};

// Get all customers
const getAllCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      name,
      contact,
      dlNo,
      gstin,
    } = req.query;

    // Build filter object
    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    if (contact) {
      filter.contact = { $regex: contact, $options: "i" };
    }

    if (dlNo) {
      filter.dlNo = { $regex: dlNo, $options: "i" };
    }

    if (gstin) {
      filter.gstin = { $regex: gstin, $options: "i" };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOrder = order === "asc" ? 1 : -1;

    // Get customers with pagination
    const customers = await Customer.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count for pagination
    const total = await Customer.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: customers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};

// Get a single customer by ID
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: error.message,
    });
  }
};

// Search customer by DL NO
const getCustomerByDlNo = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      dlNo: req.params.dlNo.toUpperCase(),
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found with this DL NO",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: error.message,
    });
  }
};

// Update a customer
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: customer,
    });
  } catch (error) {
    // Handle duplicate DL NO or GSTIN error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Customer with this ${duplicateField.toUpperCase()} already exists`,
        error: error.message,
      });
    }
    res.status(400).json({
      success: false,
      message: "Failed to update customer",
      error: error.message,
    });
  }
};

// Delete a customer
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message,
    });
  }
};

// Get customer statistics
const getCustomerStats = async (req, res) => {
  try {
    // Get total customers
    const totalCustomers = await Customer.countDocuments();

    res.status(200).json({
      success: true,
      message: "Customer statistics",
      stats: {
        totalCustomers: totalCustomers,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer stats",
      error: error.message,
    });
  }
};

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  getCustomerByDlNo,
  updateCustomer,
  deleteCustomer,
  getCustomerStats,
};
