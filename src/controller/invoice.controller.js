const Invoice = require("../models/invoice.model");

const calculateItemAmount = (quantity, rate) =>
  Math.round(quantity * rate * 100) / 100;

const buildInvoiceTotals = (items) => {
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    return {
      ...item,
      quantity,
      rate,
      amount: calculateItemAmount(quantity, rate),
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
  return {
    items: normalizedItems,
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(subtotal * 100) / 100,
  };
};

const createInvoice = async (req, res) => {
  try {
    const { items, ...rest } = req.body;
    const { items: normalizedItems, subtotal, total } = buildInvoiceTotals(items);

    const invoice = new Invoice({
      ...rest,
      items: normalizedItems,
      subtotal,
      total,
    });

    await invoice.save();
    await invoice.populate("customer", "name address contact gstin dlNo");
    await invoice.populate("items.medicine", "name mrp packagingType");

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Invoice with this number already exists",
        error: error.message,
      });
    }
    res.status(400).json({
      success: false,
      message: "Failed to create invoice",
      error: error.message,
    });
  }
};

const getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      status,
      invoiceNumber,
      customer,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (invoiceNumber) {
      filter.invoiceNumber = { $regex: invoiceNumber, $options: "i" };
    }
    if (customer) filter.customer = customer;

    const skip = (page - 1) * limit;
    const sortOrder = order === "asc" ? 1 : -1;

    const invoices = await Invoice.find(filter)
      .populate("customer", "name address contact gstin dlNo")
      .sort({ [sortBy]: sortOrder })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Invoice.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: invoices,
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
      message: "Failed to fetch invoices",
      error: error.message,
    });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer", "name address contact gstin dlNo")
      .populate("items.medicine", "name mrp packagingType batchNumber");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice",
      error: error.message,
    });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.items) {
      const { items, subtotal, total } = buildInvoiceTotals(updateData.items);
      updateData.items = items;
      updateData.subtotal = subtotal;
      updateData.total = total;
    }

    const invoice = await Invoice.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("customer", "name address contact gstin dlNo")
      .populate("items.medicine", "name mrp packagingType");

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data: invoice,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Invoice with this number already exists",
        error: error.message,
      });
    }
    res.status(400).json({
      success: false,
      message: "Failed to update invoice",
      error: error.message,
    });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete invoice",
      error: error.message,
    });
  }
};

const getInvoiceStats = async (req, res) => {
  try {
    const totalInvoices = await Invoice.countDocuments();
    const pendingInvoices = await Invoice.countDocuments({ status: "pending" });
    const paidInvoices = await Invoice.countDocuments({ status: "paid" });
    const cancelledInvoices = await Invoice.countDocuments({ status: "cancelled" });

    const revenueResult = await Invoice.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
    ]);
    const totalRevenue =
      revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    const pendingResult = await Invoice.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: null, pendingAmount: { $sum: "$total" } } },
    ]);
    const pendingAmount =
      pendingResult.length > 0 ? pendingResult[0].pendingAmount : 0;

    res.status(200).json({
      success: true,
      message: "Invoice statistics",
      stats: {
        totalInvoices,
        pendingInvoices,
        paidInvoices,
        cancelledInvoices,
        totalRevenue: totalRevenue.toFixed(2),
        pendingAmount: pendingAmount.toFixed(2),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice stats",
      error: error.message,
    });
  }
};

const generateInvoiceNumber = async (req, res) => {
  try {
    const count = await Invoice.countDocuments();
    const year = new Date().getFullYear();
    const invoiceNumber = `AH-${year}-${String(count + 1).padStart(4, "0")}`;

    res.status(200).json({
      success: true,
      data: { invoiceNumber },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate invoice number",
      error: error.message,
    });
  }
};

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats,
  generateInvoiceNumber,
};
