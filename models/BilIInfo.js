const mongoose = require("mongoose");

/*
 * A line item is a snapshot: the name and price are frozen at billing time so
 * later catalogue edits never rewrite history. `productId` is the live link
 * back to the catalogue and is what stock adjustments are keyed on.
 */
const LineItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Products" },
    id: { type: Number },
    productname: { type: String, trim: true },
    unitprice: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    pandqtotal: { type: Number, default: 0 },
    gsttex: { type: Number, default: 0 },
    gst: [
      {
        _id: false,
        title: { type: String },
        value: { type: Number },
        taxAmount: { type: Number },
      },
    ],
  },
  { _id: false }
);

const BillInfoSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, index: true },
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phoneNo: { type: String, trim: true },
    gstNo: { type: String, trim: true, uppercase: true },
    totalproductsprice: { type: Number, default: 0 },
    products: [LineItemSchema],
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.model("BillInfo", BillInfoSchema);
