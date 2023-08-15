const mongoose = require("mongoose");
const validator = require("validator");

const CustomersSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      lowercase: true,
    },
    phoneNo: {
      type: Number,
    },
    gstNo: {
      type: String,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.model("Customers", CustomersSchema);
