const jwt = require("jsonwebtoken");
const User = require("../models/users");
const { TOKEN_COOKIE } = require("./cookie");

/**
 * The session token, preferring the httpOnly cookie the browser sends on its
 * own. The Authorization header is still read so non-browser API clients keep
 * working.
 */
const readToken = (req) => {
  const cookie = req.cookies?.[TOKEN_COOKIE];
  if (cookie) return String(cookie).trim();

  const header = req.headers?.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
};

const requireAuth = async (req, res, next) => {
  try {
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Only the fields the app needs downstream — the hash is `select: false`
    // anyway, but there is no reason to carry the rest of the document either.
    const user = await User.findById(decoded.userId).select(
      "_id username email"
    );

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

module.exports = { requireAuth, readToken };
