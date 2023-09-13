const express = require("express");
const router = express.Router();
const User = require("../models/users");
const {
  hashPassword,
  hashCompare,
  createToken,
} = require("../utils/authHepler");

// Authentication Routes
router.post("/signup", async (req, res) => {
  try {
    const existingUser = await User.findOne({ email: req.body.email });

    if (existingUser) {
      return res.status(422).json({
        success: false,
        message: "User Already Exists",
      });
    }

    const hashedPassword = await hashPassword(req.body.password);
    const newUser = new User({
      email: req.body.email,
      password: hashedPassword,
      username: req.body.username,
    });

    await newUser.save();

    res.json({
      success: true,
      message: "User SignUp Successful",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User does not exist",
      });
    }

    const compare = await hashCompare(req.body.password, user.password);

    if (!compare) {
      return res.status(422).json({
        success: false,
        message: "Wrong password",
      });
    }

    const { token, expiresIn } = await createToken(user._id);

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        expiresAt: expiresIn,
      },
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

module.exports = router;
