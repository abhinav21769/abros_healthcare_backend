/**
 * Rebuilds customer gstin/dlNo indexes as sparse unique so multiple
 * customers can omit those fields.
 *
 * Usage: node scripts/fix-customer-indexes.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function rebuildIndex(collection, key, name) {
  const indexes = await collection.indexes();
  const existing = indexes.find((index) => index.name === name);

  if (existing && !existing.sparse) {
    console.log(`Dropping non-sparse index ${name}`);
    await collection.dropIndex(name);
  }

  await collection.createIndex(key, { unique: true, sparse: true, name });
  console.log(`Ensured sparse unique index ${name}`);
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.collection("customers");

  await rebuildIndex(collection, { gstin: 1 }, "gstin_1");
  await rebuildIndex(collection, { dlNo: 1 }, "dlNo_1");

  await mongoose.disconnect();
  console.log("Customer indexes updated.");
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
