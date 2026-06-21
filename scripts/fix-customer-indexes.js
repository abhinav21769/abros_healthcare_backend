/**
 * Cleans empty gstin/dlNo values and rebuilds customer unique indexes.
 *
 * Usage: node scripts/fix-customer-indexes.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function dropIfExists(collection, name) {
  const indexes = await collection.indexes();
  if (indexes.some((index) => index.name === name)) {
    await collection.dropIndex(name);
    console.log(`Dropped index ${name}`);
  }
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.collection("customers");

  const gstinCleanup = await collection.updateMany(
    { gstin: "" },
    { $unset: { gstin: "" } },
  );
  const dlCleanup = await collection.updateMany(
    { dlNo: "" },
    { $unset: { dlNo: "" } },
  );
  console.log(
    `Unset empty gstin on ${gstinCleanup.modifiedCount} customer(s), empty dlNo on ${dlCleanup.modifiedCount} customer(s).`,
  );

  await dropIfExists(collection, "gstin_1");
  await dropIfExists(collection, "dlNo_1");

  await collection.createIndex(
    { gstin: 1 },
    {
      unique: true,
      name: "gstin_1",
      partialFilterExpression: {
        gstin: { $exists: true, $type: "string", $gt: "" },
      },
    },
  );
  await collection.createIndex(
    { dlNo: 1 },
    {
      unique: true,
      name: "dlNo_1",
      partialFilterExpression: {
        dlNo: { $exists: true, $type: "string", $gt: "" },
      },
    },
  );

  console.log("Customer indexes rebuilt.");
  console.log(JSON.stringify(await collection.indexes(), null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
