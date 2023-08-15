const express = require("express");
const router = express.Router();
const User = require("../models/users");
const {
  hashPassword,
  hashCompare,
  createToken,
  verifyToken,
} = require("../authHepler");

// Authentication Routes
router.post("/signup", async (req, res) => {
  try {
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      res.status(422).json({
        success: false,
        message: "User Already Exists",
      });
    } else {
      const hashedPassword = await hashPassword(
        req.body.password,
        req.body.cpassword
      );
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
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      const compare = await hashCompare(req.body.password, user.password);
      if (compare) {
        const token = await createToken(user.email, user.username);
        res.json({
          success: true,
          email: user.email,
          username: user.username,
          token,
        });
      } else {
        res.status(422).json({
          success: false,
          message: "wrong Password",
        });
      }
    } else {
      res.status(404).json({
        success: false,
        message: "User Not exist",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.post("/auth", verifyToken, async (req, res) => {
  res.json({
    success: true,
    message: req.body.purpose,
  });
});

module.exports = router;
