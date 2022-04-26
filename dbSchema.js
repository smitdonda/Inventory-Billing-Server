var mongodb = require("mongodb");
var MongoClient = mongodb.MongoClient;
var dbName = "inventorybilling";
var dburl = `mongodb+srv://smitdonda7575:smit7575@cluster0.dlzml.mongodb.net/test${dbName}`;
module.exports = { mongodb, MongoClient, dburl };
