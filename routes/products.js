const express = require("express");
const router = express.Router();
const Product = require("../models/products");
const { isIDGood } = require("../utils/isIDGood");
const { getNextCounterId } = require("../utils/counterId");
const { requireAuth } = require("../config/requireAuth");

router.use(requireAuth);

/** Whitelist of writable fields — `id` stays under the counter's control. */
const pickBody = (body = {}) => {
  const values = {};
  if (typeof body.productname === "string")
    values.productname = body.productname;
  if (body.availableproductqty !== undefined) {
    values.availableproductqty = Math.trunc(Number(body.availableproductqty));
  }
  if (body.unitprice !== undefined) values.unitprice = Number(body.unitprice);
  return values;
};

const invalidNumbers = (values) =>
  Object.entries(values).some(
    ([key, value]) =>
      key !== "productname" && (!Number.isFinite(value) || value < 0)
  );

router.post("/", async (req, res, next) => {
  try {
    const values = pickBody(req.body);
    if (!values.productname) {
      return res
        .status(422)
        .json({ success: false, message: "Product name is required" });
    }
    if (invalidNumbers(values)) {
      return res.status(422).json({
        success: false,
        message: "Quantity and unit price must be zero or more",
      });
    }

    const id = await getNextCounterId("Product");
    const product = await Product.create({ ...values, id });

    res.status(201).json({
      success: true,
      data: product,
      message: "Create Product successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const products = await Product.find({}).sort({ updatedAt: -1, _id: -1 });
    res.json({
      success: true,
      products,
      message: "Get Product data successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const values = pickBody(req.body);

    if (invalidNumbers(values)) {
      return res.status(422).json({
        success: false,
        message: "Quantity and unit price must be zero or more",
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: values },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Not found product" });
    }

    res.json({
      success: true,
      product,
      message: "Product updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Not found product" });
    }

    res.json({
      success: true,
      product,
      message: "Delete Successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
