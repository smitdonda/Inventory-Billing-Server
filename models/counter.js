const mongoose = require("mongoose");

/*
 * One document per (user, model name), holding the last handed-out sequence
 * number. Counters are per user because the human-facing ids they feed are per
 * user: two accounts both start at Product #1.
 *
 * The unique compound index is what makes concurrent upserts safe — two
 * requests can never create a second counter for the same pair.
 *
 * Migrating from the old global counter: scripts/migrate-assign-owner.js
 * rebuilds these and drops the old unique index on `type` alone.
 */
const CounterSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

CounterSchema.index({ user: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Counter", CounterSchema);
