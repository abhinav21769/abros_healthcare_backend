const Medicine = require("../models/medicine.model");
const Customer = require("../models/customer.model");
const Invoice = require("../models/invoice.model");

const facetCount = (arr) => arr[0]?.count ?? 0;
const facetSum = (arr) => arr[0]?.total ?? 0;

const getInventoryStatsData = async (days = 30) => {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const [facetResult, expiredMedicines, expiringMedicines] = await Promise.all([
    Medicine.aggregate([
      {
        $facet: {
          totalStock: [{ $count: "count" }],
          expiredStock: [
            { $match: { expiryDate: { $lt: today } } },
            { $count: "count" },
          ],
          expiringStock: [
            {
              $match: {
                expiryDate: { $gte: today, $lte: futureDate },
              },
            },
            { $count: "count" },
          ],
          activeStock: [
            { $match: { expiryDate: { $gte: today } } },
            { $count: "count" },
          ],
          lowStockCount: [
            { $match: { quantity: { $lt: 10 } } },
            { $count: "count" },
          ],
          totalQuantity: [
            { $group: { _id: null, total: { $sum: "$quantity" } } },
          ],
          totalInventoryValue: [
            {
              $group: {
                _id: null,
                total: { $sum: { $multiply: ["$rate", "$quantity"] } },
              },
            },
          ],
        },
      },
    ]),
    Medicine.find({ expiryDate: { $lt: today } })
      .select("name expiryDate quantity mrp manufacturer")
      .sort({ expiryDate: -1 })
      .limit(10)
      .lean(),
    Medicine.find({
      expiryDate: { $gte: today, $lte: futureDate },
    })
      .select("name expiryDate quantity mrp manufacturer")
      .sort({ expiryDate: 1 })
      .limit(10)
      .lean(),
  ]);

  const facet = facetResult[0];
  const expiredStock = facetCount(facet.expiredStock);
  const expiringStock = facetCount(facet.expiringStock);

  return {
    stats: {
      totalStock: facetCount(facet.totalStock),
      activeStock: facetCount(facet.activeStock),
      expiredStock,
      expiringStock,
      expiringWithinDays: days,
      lowStockCount: facetCount(facet.lowStockCount),
      totalQuantity: facetSum(facet.totalQuantity),
      totalInventoryValue: facetSum(facet.totalInventoryValue).toFixed(2),
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
  };
};

const getCustomerStatsData = async () => {
  const totalCustomers = await Customer.countDocuments();
  return {
    stats: {
      totalCustomers,
    },
  };
};

const getInvoiceStatsData = async () => {
  const [facetResult] = await Invoice.aggregate([
    {
      $facet: {
        totalInvoices: [{ $count: "count" }],
        pendingInvoices: [
          { $match: { status: "pending" } },
          { $count: "count" },
        ],
        paidInvoices: [{ $match: { status: "paid" } }, { $count: "count" }],
        cancelledInvoices: [
          { $match: { status: "cancelled" } },
          { $count: "count" },
        ],
        totalRevenue: [
          { $match: { status: "paid" } },
          { $group: { _id: null, total: { $sum: "$total" } } },
        ],
        pendingAmount: [
          { $match: { status: "pending" } },
          { $group: { _id: null, total: { $sum: "$total" } } },
        ],
      },
    },
  ]);

  return {
    stats: {
      totalInvoices: facetCount(facetResult.totalInvoices),
      pendingInvoices: facetCount(facetResult.pendingInvoices),
      paidInvoices: facetCount(facetResult.paidInvoices),
      cancelledInvoices: facetCount(facetResult.cancelledInvoices),
      totalRevenue: facetSum(facetResult.totalRevenue).toFixed(2),
      pendingAmount: facetSum(facetResult.pendingAmount).toFixed(2),
    },
  };
};

const getDashboardStatsData = async (days = 30) => {
  const [inventory, customers, invoices] = await Promise.all([
    getInventoryStatsData(days),
    getCustomerStatsData(),
    getInvoiceStatsData(),
  ]);

  return { inventory, customers, invoices };
};

module.exports = {
  getInventoryStatsData,
  getCustomerStatsData,
  getInvoiceStatsData,
  getDashboardStatsData,
};
