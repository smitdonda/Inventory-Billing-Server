const mongoose = require("mongoose");
const { isPaise } = require("../utils/money");

const ProductsSchema = new mongoose.Schema(
  {
    // Every record belongs to exactly one account. Nothing reads a product
    // without filtering on this, so one user can never see another's stock.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    id: { type: Number, required: true },
    productname: {
      type: String,
      trim: true,
    },
    availableproductqty: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot go below zero"],
    },
    // Money is stored in paise as a whole number. Rupees as a float silently
    // lose fractions of a paisa once totals are summed — see utils/money.js.
    unitprice: {
      type: Number,
      default: 0,
      min: [0, "Unit price cannot be negative"],
      validate: {
        validator: isPaise,
        message: "Unit price must be a whole number of paise",
      },
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

ProductsSchema.index({ user: 1, id: 1 }, { unique: true });
ProductsSchema.index({ user: 1, productname: 1 });
ProductsSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model("Products", ProductsSchema);
