const mongoose = require("mongoose");

const CustomersSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    id: { type: Number, required: true },
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

CustomersSchema.index({ user: 1, id: 1 }, { unique: true });
CustomersSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model("Customers", CustomersSchema);
