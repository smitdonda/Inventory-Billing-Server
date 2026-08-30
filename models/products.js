const mongoose = require("mongoose");

const ProductsSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, index: true },
    productname: {
      type: String,
      trim: true,
      index: true,
    },
    availableproductqty: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot go below zero"],
    },
    unitprice: {
      type: Number,
      default: 0,
      min: [0, "Unit price cannot be negative"],
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.model("Products", ProductsSchema);
