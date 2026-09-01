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
const { requireAuth } = require("../config/requireAuth");
const {
  TOKEN_COOKIE,
  sessionCookieOptions,
  clearCookieOptions,
} = require("../config/cookie");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same shape for both throttled routes: 429 plus how long to wait. */
const tooManyAttempts = (res, retryAfter, message) => {
  res.set("Retry-After", String(retryAfter));
  return res.status(429).json({ success: false, message });
};

/** The account as the client is allowed to see it. Never includes the token. */
const publicUser = (user, expiresAt) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  ...(expiresAt ? { expiresAt } : {}),
});

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

    /*
     * The token goes in an httpOnly cookie and nowhere else. Handing it to
     * JavaScript — the old behaviour, stored with js-cookie — meant any
     * injected script on the page could read a seven-day session and walk off
     * with it.
     */
    res.cookie(TOKEN_COOKIE, token, sessionCookieOptions(expiresIn));

    res.json({
      success: true,
      user: publicUser(user, expiresIn),
    });
  } catch (error) {
    next(error);
  }
});

/** Who the cookie belongs to. The client bootstraps its session from this. */
router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

/*
 * Logging out has to happen server-side now: the client cannot delete an
 * httpOnly cookie itself. Always 200 — an expired session logging out is not
 * an error, and telling the caller otherwise only leaks whether it was valid.
 */
router.post("/logout", (req, res) => {
  res.clearCookie(TOKEN_COOKIE, clearCookieOptions());
  res.json({ success: true, message: "Signed out" });
});

module.exports = router;
