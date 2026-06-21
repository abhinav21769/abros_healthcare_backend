const Invoice = require("../models/invoice.model");
const { ERROR_CODES, sendSuccess, sendError } = require("../utils/response");
const { SUCCESS, ERRORS, getUserMessage } = require("../utils/messages");

const { buildInvoiceTotals } = require("../utils/invoiceTax");
const {
  InsufficientStockError,
  addStockForItems,
  applyInvoiceStockChanges,
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

const normalizeInvoiceType = (value) =>
  value === "purchase" ? "purchase" : "sale";

const createInvoice = async (req, res) => {
  try {
    const { items, invoiceDate, invoiceType, ...rest } = req.body;
    const type = normalizeInvoiceType(invoiceType);
    const {
      items: normalizedItems,
      subtotal,
      total,
    } = buildInvoiceTotals(items);
    const status = rest.status || "pending";

    const invoice = await withTransaction(async (session) => {
      const created = new Invoice({
        ...rest,
        invoiceType: type,
        status,
        invoiceDate: normalizeInvoiceDate(invoiceDate),
        items: normalizedItems,
        subtotal,
        total,
      });

      await created.save({ session });

      if (isInvoiceStockActive(status, type)) {
        const ledgerMeta = {
          referenceType: "invoice",
          referenceId: created._id,
          referenceLabel: created.invoiceNumber,
        };

        if (type === "purchase") {
          await addStockForItems(normalizedItems, session, {
            type: "purchase",
            ...ledgerMeta,
          });
        } else {
          await deductStockForItems(normalizedItems, session, {
            type: "sale",
            ...ledgerMeta,
          });
        }
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
      invoiceType,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (invoiceType) {
      const type = normalizeInvoiceType(invoiceType);
      if (type === "purchase") {
        filter.invoiceType = "purchase";
      } else {
        filter.invoiceType = { $ne: "purchase" };
      }
    }
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

    delete updateData.invoiceType;

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
        existing.invoiceType || "sale",
      );
      await applyInvoiceStockChanges(
        existing.invoiceType || "sale",
        stockChanges,
        session,
        {
          referenceType: "invoice",
          referenceId: existing._id,
          referenceLabel: existing.invoiceNumber,
        },
      );

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

      if (
        isInvoiceStockActive(
          existing.status,
          existing.invoiceType || "sale",
        )
      ) {
        const ledgerMeta = {
          referenceType: "invoice",
          referenceId: existing._id,
          referenceLabel: existing.invoiceNumber,
          notes: "Invoice deleted",
        };

        if ((existing.invoiceType || "sale") === "purchase") {
          await deductStockForItems(existing.items, session, {
            type: "purchase",
            ...ledgerMeta,
          });
        } else {
          await restoreStockForItems(existing.items, session, {
            type: "sale",
            ...ledgerMeta,
          });
        }
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
    const invoiceType = normalizeInvoiceType(req.query.invoiceType);
    const year = Number(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
      }).format(new Date()),
    );
    const shortYear = String(year).slice(-2);
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (invoiceType === "purchase") {
      const prefix = `PO-${shortYear}-`;
      const legacyPrefixes = [prefix, `PUR-${shortYear}-`, `PAH-${shortYear}-`];

      const count = await Invoice.countDocuments({
        invoiceType: "purchase",
        $or: legacyPrefixes.map((legacyPrefix) => ({
          invoiceNumber: {
            $regex: `^${escapeRegex(legacyPrefix)}`,
            $options: "i",
          },
        })),
      });
      const invoiceNumber = `${prefix}${String(count + 1).padStart(2, "0")}`;

      return sendSuccess(res, {
        data: { invoiceNumber, invoiceType: "purchase" },
      });
    }

    const prefix = `AH-${shortYear}-`;
    const legacyPrefix = `AH-${year}-`;

    const count = await Invoice.countDocuments({
      invoiceType: { $in: ["sale", null] },
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
      data: { invoiceNumber, invoiceType: "sale" },
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
