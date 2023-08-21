const express = require("express");
const router = express.Router();
const Customer = require("../models/customers");
const BillInformation = require("../models/BilIInfo");
const Product = require("../models/products");
const { requireAuth } = require("../config/requireAuth");

router.get("/", requireAuth, async (req, res) => {
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

module.exports = router;
