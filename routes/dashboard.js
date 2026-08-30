const express = require("express");
const router = express.Router();
const Customer = require("../models/customers");
const BillInformation = require("../models/BilIInfo");
const Product = require("../models/products");
const { requireAuth } = require("../config/requireAuth");

router.use(requireAuth);

router.get("/count", async (req, res, next) => {
  try {
    // count() is deprecated in Mongoose 7; countDocuments() is the replacement.
    // Run them together rather than one round trip after another.
    const [customer, product, billInformation] = await Promise.all([
      Customer.countDocuments(),
      Product.countDocuments(),
      BillInformation.countDocuments(),
    ]);

    res.json({ success: true, customer, product, billInformation });
  } catch (error) {
    next(error);
  }
});

router.get("/products-chart-1", async (req, res, next) => {
  try {
    const productChart = await Product.find({})
      .select({ _id: 0, productname: 1, availableproductqty: 1 })
      .lean();

    res.json({ success: true, productChart });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
