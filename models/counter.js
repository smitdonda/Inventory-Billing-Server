const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema(
  {
    model: {
      type: String,
    },
    seq: {
      type: Number,
    },
  },
  { strict: false }
);

module.exports = mongoose.model("Counter", CounterSchema);
