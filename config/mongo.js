const mongoose = require("mongoose");
const DB_URL = process.env.MONGO_DB_URL;

module.exports = () => {
  const connect = async () => {
    mongoose.Promise = global.Promise;

    try {
      await mongoose.connect(DB_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // useCreateIndex: true,
        // useFindAndModify: false,
      });

      let dbStatus = `*    DB Connection: OK\n****************************\n`;

      console.log("****************************");
      console.log("*    Starting Server");
      console.log(`*    Port: ${process.env.PORT || 3000}`);
      console.log(`*    Database: MongoDB`);
      console.log(dbStatus);
    } catch (err) {
      let dbStatus = `*    Error connecting to DB : ${err}\n****************************\n`;

      // Prints initialization
      console.log("****************************");
      console.log("*    Starting Server");
      console.log(`*    Port: ${process.env.PORT || 3000}`);
      console.log(`*    Database: MongoDB`);
      console.log(dbStatus);
    }

    // Other event listeners
    mongoose.connection.on("error", console.log);
    mongoose.connection.on("disconnected", connect);
  };

  connect();
};
