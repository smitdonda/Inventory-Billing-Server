const jwt = require("jsonwebtoken");
const User = require("../models/users");

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers?.authorization?.replace("Bearer ", "").trim();
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decode = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decode.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    } else if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired, please sign in again",
      });
    } else {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
};
module.exports = { requireAuth };
