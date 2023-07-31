const { MongoClient } = require("mongodb");
require("dotenv").config();

var dburl = process.env.MONGO_DB_URL;
const connectToDb = async () => {
  try {
    const client = await MongoClient.connect(dburl);
    return client;
  } catch (error) {
    console.error("Error connecting to the database:", error);
    throw error;
  }
};

module.exports = { connectToDb };
