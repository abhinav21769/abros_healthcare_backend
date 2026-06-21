/**
 * Migrates legacy Purchase entries (PUR-*) into Invoice documents
 * with invoiceType "purchase". Does not change stock — stock was
 * already applied when the purchase entry was created.
 *
 * Usage: node scripts/migrate-purchases-to-invoices.js [--dry-run]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Purchase = require("../src/models/purchase.model");
const Invoice = require("../src/models/invoice.model");
const Medicine = require("../src/models/medicine.model");
const StockLedger = require("../src/models/stockLedger.model");
const { buildInvoiceTotals } = require("../src/utils/invoiceTax");

const dryRun = process.argv.includes("--dry-run");

async function enrichItems(items) {
  const enriched = [];

  for (const item of items) {
    const med = await Medicine.findById(item.medicine).lean();

    enriched.push({
      medicine: item.medicine,
      medicineName: item.medicineName,
      quantity: item.quantity,
      free: 0,
      rate: item.rate,
      hsn: med?.hsn || undefined,
      gstRate: med?.gstRate ?? 5,
    });
  }

  return enriched;
}

async function migratePurchase(purchase) {
  const invoiceNumber = purchase.purchaseNumber.toUpperCase();

  const existing = await Invoice.findOne({ invoiceNumber });
  if (existing) {
    console.log(`Skip ${invoiceNumber} — invoice already exists`);
    return { skipped: true };
  }

  const enrichedItems = await enrichItems(purchase.items);
  const { items, subtotal, total } = buildInvoiceTotals(enrichedItems);

  const invoiceDoc = {
    invoiceNumber,
    invoiceType: "purchase",
    supplier: purchase.supplier?.trim() || "Not specified",
    items,
    subtotal,
    total,
    status: "paid",
    paymentType: "credit",
    invoiceDate: purchase.purchaseDate,
    notes: purchase.notes || undefined,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
  };

  if (dryRun) {
    console.log(`[dry-run] Would create invoice ${invoiceNumber}`, {
      supplier: invoiceDoc.supplier,
      total: invoiceDoc.total,
      items: items.length,
    });
    return { dryRun: true };
  }

  const invoice = await Invoice.create(invoiceDoc);

  const ledgerResult = await StockLedger.updateMany(
    {
      referenceType: "purchase",
      referenceId: purchase._id,
    },
    {
      $set: {
        referenceType: "invoice",
        referenceId: invoice._id,
        referenceLabel: invoice.invoiceNumber,
      },
    },
  );

  await Purchase.findByIdAndDelete(purchase._id);

  console.log(
    `Migrated ${invoiceNumber} → invoice ${invoice._id} (ledger updated: ${ledgerResult.modifiedCount})`,
  );

  return { migrated: true, invoiceId: invoice._id };
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const purchases = await Purchase.find().sort({
    purchaseDate: 1,
    createdAt: 1,
  });
  console.log(
    `${dryRun ? "[dry-run] " : ""}Found ${purchases.length} purchase entr${purchases.length === 1 ? "y" : "ies"} to migrate`,
  );

  let migrated = 0;
  let skipped = 0;

  for (const purchase of purchases) {
    const result = await migratePurchase(purchase);
    if (result?.skipped) skipped += 1;
    else if (result?.migrated || result?.dryRun) migrated += 1;
  }

  console.log(`Done. Processed: ${migrated}, skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
