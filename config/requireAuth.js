const jwt = require("jsonwebtoken");
const User = require("../models/users");

const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers?.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7).trim()
      : header.trim();

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

module.exports = { requireAuth };
