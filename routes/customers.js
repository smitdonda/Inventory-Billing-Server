const express = require("express");
const router = express.Router();
const Customer = require("../models/customers");
const { isIDGood } = require("../utils/isIDGood");
const { getNextCounterId } = require("../utils/counterId");
const { requireAuth } = require("../config/requireAuth");

// Customer Routes
router.post("/", requireAuth, async (req, res) => {
  try {
    const id = await getNextCounterId("Customer");
    const customer = new Customer({ ...req.body, id });
    await customer.save();
    res.json({
      success: true,
      data: customer,
      message: "Create Customer Successfully",
    });
  } catch (error) {
    console.log("error creating customer", error.message);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const customers = await Customer.find({}).sort({
      updatedAt: -1,
      createdAt: -1,
    });
    res.json({
      success: true,
      customers,
      message: "Get Inventory Bill",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = await isIDGood(req.params.id);
    const customer = await Customer.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true }
    );

    if (customer) {
      res.status(200).json({
        success: true,
        customer,
        message: "Customer Updated Successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Not Found Customer",
      });
    }
  } catch (error) {
    console.log("error Updated customer", error.message);
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
    const customer = await Customer.findByIdAndDelete(id);

    if (customer) {
      res.json({
        success: true,
        customer,
        message: "Delete Successfully",
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
