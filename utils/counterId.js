const Counter = require("../models/counter");

const getNextCounterId = async (model = "") => {
  const updatedCounter = await Counter.findOneAndUpdate(
    { type: model },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).exec();

  return updatedCounter.seq;
};

module.exports = { getNextCounterId };
