const mongoose = require("mongoose");

/*
 * The company letterhead printed on invoices. Exactly one per account, which
 * the unique index on `user` enforces rather than leaving it to the route.
 */
const myprofileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
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
