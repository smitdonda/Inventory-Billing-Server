require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const initMongo = require("./config/mongo");

// Fail at boot rather than at the first login with an unhelpful stack trace.
["MONGO_DB_URL", "JWT_SECRET"].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

const app = express();

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

/*
 * CORS: set CORS_ORIGIN to a comma-separated allowlist in production.
 * Left unset it stays open, which is what the deployed setup relied on.
 */
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors(
    allowedOrigins.length
      ? {
          origin: (origin, callback) =>
            !origin || allowedOrigins.includes(origin)
              ? callback(null, true)
              : callback(new Error("Not allowed by CORS")),
        }
      : undefined
  )
);
app.use(logger("dev"));
// Cap the body so a single request cannot buffer an unbounded payload.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use(require("./routes/index"));
app.use(require("./routes/auth"));
app.use("/dashboard", require("./routes/dashboard"));
app.use("/customers", require("./routes/customers"));
app.use("/products", require("./routes/products"));
app.use("/billInformation", require("./routes/billInformation"));
app.use("/my-profile", require("./routes/myprofile"));

// 404 — same envelope as every other response so clients read one shape.
app.use((req, res) => {
  res.status(404).json({ success: false, message: "URL_NOT_FOUND" });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) console.error(err);

  // Mongoose validation and cast failures are the client's fault, not ours.
  if (err.name === "ValidationError") {
    return res.status(422).json({
      success: false,
      message: Object.values(err.errors)[0]?.message || "Validation failed",
    });
  }
  if (err.name === "CastError") {
    return res.status(422).json({ success: false, message: "Invalid value" });
  }

  res.status(status).json({
    success: false,
    message:
      status >= 500 && process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message || "Internal Server Error",
  });
});

// Init MongoDB
initMongo();

module.exports = app;
