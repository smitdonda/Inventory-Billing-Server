const express = require("express");
const router = express.Router();
const User = require("../models/users");
const {
  hashPassword,
  hashCompare,
  createToken,
} = require("../utils/authHepler");
const {
  keysFor,
  checkLimit,
  recordFailure,
  clearAttempts,
} = require("../config/loginLimiter");
const { resolveUser } = require("../config/requireAuth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same shape for both throttled routes: 429 plus how long to wait. */
const tooManyAttempts = (res, retryAfter, message) => {
  res.set("Retry-After", String(retryAfter));
  return res.status(429).json({ success: false, message });
};

router.post("/signup", async (req, res, next) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    const username = String(req.body.username || "").trim();

    // Throttled on the address alone: creating accounts is the thing being
    // limited here, so every attempt counts, not only the failures.
    const throttleKeys = keysFor(req).map(({ key, limit }) => ({
      key: `signup:${key}`,
      limit,
    }));
    const { blocked, retryAfter } = await checkLimit(throttleKeys);
    if (blocked) {
      return tooManyAttempts(
        res,
        retryAfter,
        `Too many sign-ups from this address. Try again in ${Math.ceil(retryAfter / 60)} minutes.`
      );
    }
    await recordFailure(throttleKeys);

    /*
     * Accounts are not self-service. Every account sees the same customers,
     * products and bills, so handing one out is handing over the whole book —
     * an open /signup let anyone on the internet read it.
     *
     * The exception is the very first account on a fresh install: there is
     * nobody yet who could authorise it. After that, only someone already
     * signed in may create an account.
     */
    if ((await User.estimatedDocumentCount()) > 0) {
      const invitedBy = await resolveUser(req);
      if (!invitedBy) {
        return res.status(401).json({
          success: false,
          message:
            "Sign-ups are closed. Ask someone with an account to create yours.",
        });
      }
    }

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

    // Budget is spent per email and per address. Checked before the password
    // is ever compared, so a locked-out guesser gets no timing signal either.
    const throttleKeys = keysFor(req, email);
    const { blocked, retryAfter } = await checkLimit(throttleKeys);
    if (blocked) {
      return tooManyAttempts(
        res,
        retryAfter,
        `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`
      );
    }

    // `password` is `select: false` on the model, so ask for it explicitly.
    const user = await User.findOne({ email }).select("+password");

    // One message for both "no such user" and "wrong password" — telling them
    // apart lets an attacker enumerate which emails are registered.
    const ok = user ? await hashCompare(password, user.password) : false;
    if (!ok) {
      await recordFailure(throttleKeys);
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    // Proving the password clears the lockout for this email and address.
    await clearAttempts(throttleKeys);

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
