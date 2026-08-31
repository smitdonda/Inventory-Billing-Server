const jwt = require("jsonwebtoken");
const User = require("../models/users");

/** The bearer token on a request, with or without the scheme prefix. */
const readToken = (req) => {
  const header = req.headers?.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
};

/**
 * The signed-in user, or null. Never sends a response and never throws, so a
 * route can ask "is anyone signed in?" and still decide for itself what to do
 * with the answer.
 */
const resolveUser = async (req) => {
  const token = readToken(req);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return await User.findById(decoded.userId);
  } catch {
    return null;
  }
};

const requireAuth = async (req, res, next) => {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired, please sign in again",
      });
    }
    if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    return next(error);
  }
};

module.exports = { requireAuth, resolveUser };
