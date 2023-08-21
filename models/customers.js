const mongoose = require("mongoose");

const CustomersSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true},
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
