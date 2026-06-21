const StockLedger = require("../models/stockLedger.model");

async function recordLedgerEntry(entry, session) {
  const payload = Array.isArray(entry) ? entry : [entry];
  if (!payload.length) return;

  await StockLedger.insertMany(payload, { session });
}

module.exports = {
  recordLedgerEntry,
};
