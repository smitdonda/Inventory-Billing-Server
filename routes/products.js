const express = require("express");
const router = express.Router();
const Product = require("../models/products");
const { isIDGood } = require("../utils/isIDGood");
const { requireAuth } = require("../config/requireAuth");

// Product Routes
router.post("/", requireAuth, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json({
      success: true,
      data: product,
      message: "Create Product successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const products = await Product.find({}).sort({
      updatedAt: -1,
      createdAt: -1,
    });
    res.json({
      success: true,
      products,
      message: "Get Product data successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting product",
    });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = await isIDGood(req.params.id);
    const product = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (product) {
      res.json({
        success: true,
        product,
        message: "Product updated successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Not found product",
      });
    }
  } catch (error) {
    if (error.message === "Invalid Id") {
      res.status(422).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = await isIDGood(req.params.id);
    const product = await Product.findByIdAndDelete(id);
    if (product) {
      res.json({
        success: true,
        product,
        message: "Delete Successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid Product ID",
      });
    }
  } catch (error) {
    if (error.message === "Invalid Id") {
      res.status(422).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
});

module.exports = router;
