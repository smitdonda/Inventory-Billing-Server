const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const initMongo = require("./config/mongo");
const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const customerRouter = require("./routes/customers");
const productsRouter = require("./routes/products");
const billInformationRouter = require("./routes/billInformation");
const MyProfileRouter = require("./routes/myprofile");
const DashboardRouter = require("./routes/dashboard");
const app = express();

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

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
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
