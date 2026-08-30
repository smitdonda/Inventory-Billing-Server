const express = require("express");
const router = express.Router();
const Customer = require("../models/customers");
const { isIDGood } = require("../utils/isIDGood");
const { getNextCounterId } = require("../utils/counterId");
const { requireAuth } = require("../config/requireAuth");

// Customer data is business data — every verb needs a signed-in user.
router.use(requireAuth);

/** Only these fields are writable; `id` is owned by the counter. */
const pickBody = (body = {}) => ({
  name: typeof body.name === "string" ? body.name : undefined,
  email: typeof body.email === "string" ? body.email : undefined,
  phoneNo: body.phoneNo != null ? String(body.phoneNo) : undefined,
  gstNo: typeof body.gstNo === "string" ? body.gstNo : undefined,
});

const clean = (values) =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  );

router.post("/", async (req, res, next) => {
  try {
    const values = clean(pickBody(req.body));
    if (!values.name) {
      return res
        .status(422)
        .json({ success: false, message: "Customer name is required" });
    }

    const id = await getNextCounterId("Customer");
    const customer = await Customer.create({ ...values, id });

    res.status(201).json({
      success: true,
      data: customer,
      message: "Create Customer Successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const customers = await Customer.find({}).sort({ updatedAt: -1, _id: -1 });
    res.json({
      success: true,
      customers,
      message: "Get customers",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const customer = await Customer.findByIdAndUpdate(
      id,
      { $set: clean(pickBody(req.body)) },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Not Found Customer" });
    }

    res.json({
      success: true,
      customer,
      message: "Customer Updated Successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const customer = await Customer.findByIdAndDelete(id);

    // Without this branch a missing customer left the request hanging.
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Not Found Customer" });
    }

    res.json({
      success: true,
      customer,
      message: "Delete Successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
