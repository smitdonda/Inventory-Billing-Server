const express = require("express");
const router = express.Router();
const Customer = require("../models/customers");
const BillInformation = require("../models/BilIInfo");
const Product = require("../models/products");
const { requireAuth } = require("../config/requireAuth");

router.get("/count", requireAuth, async (req, res) => {
  try {
    const customer = await Customer.count();
    const product = await Product.count();
    const billInformation = await BillInformation.count();
    res.json({
      success: true,
      customer,
      product,
      billInformation,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// products chart data
router.get("/products-chart-1", requireAuth, async (req, res) => {
  try {
    const productChart = await Product.find({}).select({
      _id: 0,
      productname: 1,
      availableproductqty: 1,
    });
    res.json({
      success: true,
      productChart,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

module.exports = router;
