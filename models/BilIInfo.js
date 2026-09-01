const mongoose = require("mongoose");
const { isPaise } = require("../utils/money");

const paiseField = (label) => ({
  type: Number,
  default: 0,
  min: [0, `${label} cannot be negative`],
  validate: {
    validator: isPaise,
    message: `${label} must be a whole number of paise`,
  },
});

/*
 * A line item is a snapshot: the name and price are frozen at billing time so
 * later catalogue edits never rewrite history. `productId` is the live link
 * back to the catalogue and is what stock adjustments are keyed on.
 *
 * Every amount below is in paise — see utils/money.js.
 */
const LineItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Products" },
    id: { type: Number },
    productname: { type: String, trim: true },
    unitprice: paiseField("Unit price"),
    quantity: { type: Number, default: 0, min: 0 },
    pandqtotal: paiseField("Line subtotal"),
    gsttex: paiseField("Line total"),
    gst: [
      {
        _id: false,
        title: { type: String },
        // A percentage, not money — 2.5 means 2.5%.
        value: { type: Number },
        taxAmount: paiseField("Tax amount"),
      },
    ],
  },
  { _id: false }
);

const BillInfoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    id: { type: Number, required: true },
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phoneNo: { type: String, trim: true },
    gstNo: { type: String, trim: true, uppercase: true },
    totalproductsprice: paiseField("Bill total"),
    products: [LineItemSchema],
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

BillInfoSchema.index({ user: 1, id: 1 }, { unique: true });
BillInfoSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("BillInfo", BillInfoSchema);
