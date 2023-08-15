const express = require("express");
const router = express.Router();
const BillInformation = require("../models/BilIInfo");
const { isIDGood } = require("../utils/isIDGood");

// Bill Information Routes
router.post("/", async (req, res) => {
  try {
    const billinfo = new BillInformation(req.body);
    await billinfo.save();
    res.json({
      success: true,
      billinfo,
      message: "Create Bill Information Successfully",
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
    const billinfo = await BillInformation.find();
    res.json({
      success: true,
      billinfo,
      message: "Bill Information Successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = await isIDGood(req.params.id);
    const bill = await BillInformation.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (bill) {
      res.json({
        success: true,
        bill,
        message: "Bill Information Updated Successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Not found Bill Information",
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

router.delete("/:id", async (req, res) => {
  try {
    const id = await isIDGood(req.params.id);
    const billinfo = await BillInformation.findByIdAndDelete(id);

    if (billinfo) {
      res.json({
        success: true,
        billinfo,
        message: "Delete Successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Not found Bill Information",
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
