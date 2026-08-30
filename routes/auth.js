const express = require("express");
const router = express.Router();
const User = require("../models/users");
const {
  hashPassword,
  hashCompare,
  createToken,
} = require("../utils/authHepler");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/signup", async (req, res, next) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    const username = String(req.body.username || "").trim();

    if (!EMAIL_RE.test(email)) {
      return res
        .status(422)
        .json({ success: false, message: "Enter a valid email address" });
    }
    if (password.length < 8) {
      return res.status(422).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }
    if (!username) {
      return res
        .status(422)
        .json({ success: false, message: "Username is required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(422)
        .json({ success: false, message: "User Already Exists" });
    }

    await User.create({
      email,
      username,
      password: await hashPassword(password),
    });

    res.status(201).json({
      success: true,
      message: "User SignUp Successful",
    });
  } catch (error) {
    // A racing signup trips the unique index instead of the check above.
    if (error?.code === 11000) {
      return res
        .status(422)
        .json({ success: false, message: "User Already Exists" });
    }
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    // `password` is `select: false` on the model, so ask for it explicitly.
    const user = await User.findOne({ email }).select("+password");

    // One message for both "no such user" and "wrong password" — telling them
    // apart lets an attacker enumerate which emails are registered.
    const ok = user ? await hashCompare(password, user.password) : false;
    if (!ok) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
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
    next(error);
  }
});

module.exports = router;
