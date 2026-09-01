// quiet: dotenv 17 otherwise prints a promo banner into the server logs on
// every cold start.
require("dotenv").config({ quiet: true });
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const { requireMongo, isConnected } = require("./config/mongo");

// Fail at boot rather than at the first login with an unhelpful stack trace.
["MONGO_DB_URL", "JWT_SECRET"].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Vercel terminates TLS and proxies one hop, so the socket address is theirs,
// not the caller's. Trusting that single hop is what makes req.ip and the
// login throttle read the real client address.
app.set("trust proxy", 1);

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

/*
 * CORS is an allowlist, and an empty allowlist now means "refuse every
 * cross-origin browser request" rather than "allow anyone". The session lives
 * in a cookie, so a wildcard origin would hand any site on the internet an
 * authenticated channel into this API.
 *
 * The intended production shape is same-origin: the frontend rewrites /api to
 * this server (see inventory-billing/vercel.json), so no cross-origin request
 * is made at all and this list stays empty.
 */
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!allowedOrigins.length && !isProduction) {
  // The CRA dev server, which is where a local frontend talks from.
  allowedOrigins.push("http://localhost:3000");
}

if (!allowedOrigins.length && isProduction) {
  console.warn(
    "CORS_ORIGIN is not set — cross-origin browser requests will be refused. " +
      "That is correct when the frontend proxies /api to this server."
  );
}

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header: same-origin navigation, curl, a health probe.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Carry a status, or the handler below logs a rejected origin as a 500
      // and any passer-by can fill the logs with stack traces.
      const error = new Error("Not allowed by CORS");
      error.status = 403;
      return callback(error);
    },
    // Required for the browser to send and store the session cookie.
    credentials: true,
  })
);
app.use(logger(isProduction ? "combined" : "dev"));
// Cap the body so a single request cannot buffer an unbounded payload.
app.use(express.json({ limit: "1mb" }));
/*
 * No urlencoded parser on purpose. A cross-site HTML form can POST
 * form-encoded data without a preflight, which — now that the session rides in
 * a cookie — is exactly the shape a CSRF attempt takes. JSON bodies are
 * preflighted, so refusing to parse anything else closes that door. Nothing in
 * this API has ever accepted a form post.
 */
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/*
 * Liveness and readiness in one place, answered before the database gate so it
 * still reports when the database is what is broken.
 */
app.get("/healthz", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const ready = isConnected();

  res.status(ready ? 200 : 503).json({
    success: ready,
    uptime: Math.round(process.uptime()),
    db: states[mongoose.connection.readyState] || "unknown",
  });
});

/*
 * Nothing past this point runs without a live database connection. Previously
 * a failed connection was logged and the process carried on serving requests
 * that queued in Mongoose's buffer and died as opaque 500s ten seconds later.
 */
app.use(requireMongo);

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
      status >= 500 && isProduction
        ? "Internal Server Error"
        : err.message || "Internal Server Error",
  });
});

module.exports = app;
