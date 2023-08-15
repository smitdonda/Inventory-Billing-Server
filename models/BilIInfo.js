const mongoose = require("mongoose");

const ProductsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
    },
    phoneNo: {
      type: String,
    },
    date: {
      type: String,
    },
    gstNo: {
      type: String,
    },
    totalproductsprice: {
      type: Number,
    },
    products: [
      {
        productname: { type: String },
        availableproductqty: { type: Number },
        unitprice: { type: Number },
        quantity: { type: Number },
        gsttex: { type: Number },
        pandqtotal: { type: Number },
        gst: { type: Array },
      },
    ],
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.model("BillInfo", ProductsSchema);