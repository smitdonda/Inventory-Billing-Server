require("dotenv").config();
// const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const initMongo = require("./config/mongo");

const app = express();

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

// Middleware
app.use(helmet());
app.use(cors());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Routes
const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const customerRouter = require("./routes/customers");
const productsRouter = require("./routes/products");
const billInformationRouter = require("./routes/billInformation");
const MyProfileRouter = require("./routes/myprofile");
const DashboardRouter = require("./routes/dashboard");

// Middleware
app.use(cors());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use(indexRouter);
app.use(authRouter);
app.use("/dashboard", DashboardRouter);
app.use("/customers", customerRouter);
app.use("/products", productsRouter);
app.use("/billInformation", billInformationRouter);
app.use("/my-profile", MyProfileRouter);

/*
 * Handle 404 error
 */
app.use(function (req, res, next) {
  res.status(404).json({
    error: {
      message: "URL_NOT_FOUND",
    },
  });
  // next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // Send error response
  res.status(err.status || 500);
  res.json({
    error: {
      message: err.message,
    },
  });
});

// Init MongoDB
initMongo();

module.exports = app;
