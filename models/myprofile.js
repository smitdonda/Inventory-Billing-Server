const mongoose = require("mongoose");

const myprofileSchema = new mongoose.Schema({
  companyname: {
    type: String,
  },
  cemail: {
    type: String,
  },
  address: {
    type: String,
  },
  city: {
    type: String,
  },
  pinno: {
    type: String,
  },
  phone: {
    type: Number,
  },
  country: {
    type: String,
  },
  state: {
    type: String,
  },
});

module.exports = mongoose.model("myprofile", myprofileSchema);
