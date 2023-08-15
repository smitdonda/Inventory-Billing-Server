const express = require("express");
const router = express.Router();
const MyProfile = require("../models/myprofile");
const { isIDGood } = require("../utils/isIDGood");

// My Profile Routes
router.post("/", async (req, res) => {
  try {
    const company = new MyProfile(req.body);
    await company.save();
    res.json({
      success: true,
      data: company,
      message: "Create My profile data successfully",
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
    const profile = await MyProfile.find();
    res.json({
      success: true,
      profile,
      message: "My profile data successfully",
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
    const product = await MyProfile.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (product) {
      res.json({
        success: true,
        product,
        message: "My profile updated successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Not found",
      });
    }
  } catch (error) {
    console.log(error);
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
