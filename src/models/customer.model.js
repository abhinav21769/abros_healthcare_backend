const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    contact: {
      type: String,

      trim: true,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
    },
    dlNo: {
      type: String,
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
  },
);

customerSchema.index({ name: 1, contact: 1 });
customerSchema.index({ gstin: 1 }, { unique: true, sparse: true });
customerSchema.index({ dlNo: 1 }, { unique: true, sparse: true });

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
