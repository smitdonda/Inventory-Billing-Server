const mongoose = require("mongoose");

module.exports = () => {
  const connect = async () => {
    mongoose.Promise = global.Promise;

    try {
      // useNewUrlParser / useUnifiedTopology are no-ops in the Mongo driver 4+
      // that Mongoose 7 ships with, and warn if passed.
      await mongoose.connect(process.env.MONGO_DB_URL);

      console.log("****************************");
      console.log("*    Starting Server");
      console.log(`*    Port: ${process.env.PORT || 5000}`);
      console.log("*    Database: MongoDB");
      console.log("*    DB Connection: OK");
      console.log("****************************");
    } catch (err) {
      console.log("****************************");
      console.log("*    Starting Server");
      console.log(`*    Port: ${process.env.PORT || 5000}`);
      console.log("*    Database: MongoDB");
      console.log(`*    Error connecting to DB: ${err.message}`);
      console.log("****************************");
    }

    mongoose.connection.on("error", (err) =>
      console.error("MongoDB error:", err.message)
    );
  };

  // The driver reconnects on its own; the old "disconnected" -> connect()
  // listener stacked a fresh connection attempt on every blip.
  mongoose.connection.on("disconnected", () =>
    console.warn("MongoDB disconnected — driver will retry")
  );

  connect();
};
