const mongoose = require("mongoose");

const myprofileSchema = new mongoose.Schema(
  {
    companyname: { type: String, trim: true },
    cemail: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    // Identifiers, not quantities — keep them as text.
    pinno: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

module.exports = mongoose.model("myprofile", myprofileSchema);
