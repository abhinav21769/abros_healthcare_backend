const Invoice = require("../models/invoice.model");
const { ERROR_CODES, sendSuccess, sendError } = require("../utils/response");
const { SUCCESS, ERRORS, getUserMessage } = require("../utils/messages");

const { buildInvoiceTotals } = require("../utils/invoiceTax");
const {
  InsufficientStockError,
  applyStockChanges,
  computeStockChanges,
  deductStockForItems,
  isInvoiceStockActive,
  restoreStockForItems,
  withTransaction,
} = require("../services/inventory.service");

const MEDICINE_POPULATE_FIELDS =
  "name mrp rate packagingType batchNumber expiryDate manufacturer hsn gstRate";

const normalizeInvoiceDate = (value) => {
  if (!value) return undefined;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+05:30`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  const istDate = date.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  return new Date(`${istDate}T00:00:00+05:30`);
};

const createInvoice = async (req, res) => {
  try {
    const { items, invoiceDate, ...rest } = req.body;
    const {
      items: normalizedItems,
      subtotal,
      total,
    } = buildInvoiceTotals(items);
    const status = rest.status || "pending";

    const invoice = await withTransaction(async (session) => {
      const created = new Invoice({
        ...rest,
        status,
        invoiceDate: normalizeInvoiceDate(invoiceDate),
        items: normalizedItems,
        subtotal,
        total,
      });

      await created.save({ session });

      if (isInvoiceStockActive(status)) {
        await deductStockForItems(normalizedItems, session);
      }

      return created;
    });

    await invoice.populate("customer", "name address contact gstin dlNo");
    await invoice.populate("items.medicine", MEDICINE_POPULATE_FIELDS);

    return sendSuccess(res, {
      message: SUCCESS.invoice.created,
      data: invoice,
      statusCode: 201,
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.saveFailed.invoice,
      code:
        error instanceof InsufficientStockError
          ? ERROR_CODES.VALIDATION_ERROR
          : error.code === 11000
            ? ERROR_CODES.DUPLICATE_KEY
            : ERROR_CODES.VALIDATION_ERROR,
      errorMessage: getUserMessage(error, ERRORS.saveFailed.invoice),
      statusCode: 400,
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

    return sendSuccess(res, {
      data: {
        items: invoices,
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
      message: ERRORS.loadFailed.invoices,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.invoices,
      statusCode: 500,
    });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer", "name address contact gstin dlNo")
      .populate("items.medicine", MEDICINE_POPULATE_FIELDS);

    if (!invoice) {
      return sendError(res, {
        message: ERRORS.notFound.invoice,
        code: ERROR_CODES.NOT_FOUND,
        errorMessage: ERRORS.notFound.invoice,
        statusCode: 404,
      });
    }

    return sendSuccess(res, { data: invoice });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.loadFailed.invoice,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.invoice,
      statusCode: 500,
    });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const updateData = { ...req.body };
    let normalizedItems;

    if (updateData.items) {
      const totals = buildInvoiceTotals(updateData.items);
      normalizedItems = totals.items;
      updateData.items = totals.items;
      updateData.subtotal = totals.subtotal;
      updateData.total = totals.total;
    }

    if (updateData.invoiceDate) {
      updateData.invoiceDate = normalizeInvoiceDate(updateData.invoiceDate);
    }

    const invoice = await withTransaction(async (session) => {
      const existing = await Invoice.findById(req.params.id).session(session);

      if (!existing) {
        return null;
      }

      const oldStatus = existing.status;
      const newStatus = updateData.status ?? oldStatus;
      const oldItems = existing.items;
      const newItems = normalizedItems ?? oldItems;

      const stockChanges = computeStockChanges(
        oldItems,
        oldStatus,
        newItems,
        newStatus,
      );
      await applyStockChanges(stockChanges, session);

      return Invoice.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
        session,
      });
    });

    if (!invoice) {
      return sendError(res, {
        message: ERRORS.notFound.invoice,
        code: ERROR_CODES.NOT_FOUND,
        errorMessage: ERRORS.notFound.invoice,
        statusCode: 404,
      });
    }

    await invoice.populate("customer", "name address contact gstin dlNo");
    await invoice.populate("items.medicine", MEDICINE_POPULATE_FIELDS);

    return sendSuccess(res, {
      message: SUCCESS.invoice.updated,
      data: invoice,
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.saveFailed.invoice,
      code:
        error instanceof InsufficientStockError
          ? ERROR_CODES.VALIDATION_ERROR
          : error.code === 11000
            ? ERROR_CODES.DUPLICATE_KEY
            : ERROR_CODES.VALIDATION_ERROR,
      errorMessage: getUserMessage(error, ERRORS.saveFailed.invoice),
      statusCode: 400,
    });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const invoice = await withTransaction(async (session) => {
      const existing = await Invoice.findById(req.params.id).session(session);

      if (!existing) {
        return null;
      }

      if (isInvoiceStockActive(existing.status)) {
        await restoreStockForItems(existing.items, session);
      }

      await Invoice.findByIdAndDelete(req.params.id, { session });
      return existing;
    });

    if (!invoice) {
      return sendError(res, {
        message: ERRORS.notFound.invoice,
        code: ERROR_CODES.NOT_FOUND,
        errorMessage: ERRORS.notFound.invoice,
        statusCode: 404,
      });
    }

    return sendSuccess(res, {
      message: SUCCESS.invoice.deleted,
      data: invoice,
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.deleteFailed.invoice,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.deleteFailed.invoice,
      statusCode: 500,
    });
  }
};

const { getInvoiceStatsData } = require("../services/stats.service");

const getInvoiceStats = async (req, res) => {
  try {
    const data = await getInvoiceStatsData();

    return sendSuccess(res, { data });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.loadFailed.invoiceStats,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.invoiceStats,
      statusCode: 500,
    });
  }
};

const generateInvoiceNumber = async (req, res) => {
  try {
    const year = Number(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
      }).format(new Date()),
    );
    const shortYear = String(year).slice(-2);
    const prefix = `AH-${shortYear}-`;
    const legacyPrefix = `AH-${year}-`;
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const count = await Invoice.countDocuments({
      $or: [
        {
          invoiceNumber: {
            $regex: `^${escapeRegex(prefix)}`,
            $options: "i",
          },
        },
        {
          invoiceNumber: {
            $regex: `^${escapeRegex(legacyPrefix)}`,
            $options: "i",
          },
        },
      ],
    });
    const invoiceNumber = `${prefix}${String(count + 1).padStart(2, "0")}`;

    return sendSuccess(res, {
      data: { invoiceNumber },
    });
  } catch (error) {
    return sendError(res, {
      message: ERRORS.loadFailed.invoiceNumber,
      code: ERROR_CODES.INTERNAL_ERROR,
      errorMessage: ERRORS.loadFailed.invoiceNumber,
      statusCode: 500,
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
