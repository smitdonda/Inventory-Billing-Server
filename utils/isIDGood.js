const mongoose = require("mongoose");

/*
 * Rejects with a real Error carrying an HTTP status, so route handlers and the
 * express error handler can both read `err.status` / `err.message`.
 */
const isIDGood = async (id = "") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid Id");
    error.status = 422;
    throw error;
  }
  return id;
};

module.exports = { isIDGood };
