const Counter = require("../models/counter");

/*
 * Hands out the next human-facing id for a collection.
 * findOneAndUpdate + $inc + upsert is atomic, so two concurrent creates can
 * never receive the same number.
 */
const getNextCounterId = async (model = "") => {
  const counter = await Counter.findOneAndUpdate(
    { type: model },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();

  return counter.seq;
};

module.exports = { getNextCounterId };
