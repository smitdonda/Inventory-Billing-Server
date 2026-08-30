const mongoose = require("mongoose");

const CustomersSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, index: true },
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    // String, not Number: phone numbers are identifiers, not quantities, and
    // a leading zero must survive the round trip.
    phoneNo: {
      type: String,
      trim: true,
    },
    gstNo: {
      type: String,
      trim: true,
      uppercase: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.model("Customers", CustomersSchema);
