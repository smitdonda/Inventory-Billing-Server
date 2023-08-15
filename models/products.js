const mongoose = require("mongoose");

const ProductsSchema = new mongoose.Schema(
  {
    productname: {
      type: String,
    },
    availableproductqty: {
      type: Number,
    },
    unitprice: {
      type: Number,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.model("Products", ProductsSchema);
