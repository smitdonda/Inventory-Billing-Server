const mongoose = require("mongoose");

/*
 * One document per model name, holding the last handed-out sequence number.
 * `type` is what utils/counterId.js queries on, and it is unique so two
 * concurrent upserts can never create a second counter for the same model.
 */
const CounterSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Counter", CounterSchema);
