var express = require("express");
const { ObjectId } = require("mongodb");
var router = express.Router();
var { mongodb, MongoClient, dburl } = require("../dbSchema");
var {
  hashPassword,
  hashCompare,
  createToken,
  verifyToken,
} = require("../auth");

// Add customer Form  getData
// post mthod
router.post("/postcustomers", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let customer = await db.collection("customer").insertOne(req.body);
    if (customer) {
      res.json({
        statusCode: 200,
        data: customer,
        message: "Customer Data Successfully",
      });
    }
  } catch {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});
// get customer
router.get("/getcustomers", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("customer");
    if (user) {
      let customer = await db.collection("customer").find().toArray();
      res.json({ 
        statusCode: 200,
        customer,
        message: "Get Inventory Bill",
      });
    }
  } catch (err) {
    console.log(err);
  }
});

// Put customer
router.put("/putcustomers/:id", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("customer").find().toArray();
    if (user.length > 0) {
      let customer = await db
        .collection("customer")
        .updateOne({ _id: ObjectId(req.params.id) }, { $set: { ...req.body } });
      res.json({
        statusCode: 200,
        customer,
        message: "Customer Updated Successfully",
      });
    } else {
      res.json({
        statusCode: 400,
        message: "Invalid User ID",
      });
    }
  } catch {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});

// Delete Customer Data
router.delete("/deletecustomer/:id", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("customer").find().toArray();
    if (user) {
      let customer = await db
        .collection("customer")
        .deleteOne({ _id: ObjectId(req.params.id) });
      res.json({
        statusCode: 200,
        customer,
        message: "Delete Successfully",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Delete failed",
    });
  }
});
// ---------------------------------------------------------------------------
// Product billing information
//Post Method
router.post("/postproducts", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let product = await db.collection("product").insertOne(req.body);
    if (product) {
      res.json({
        statusCode: 200,
        data: product,
        message: "Post Product data successfully",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});
// Get Products method
router.get("/getproducts", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("product");
    if (user) {
      let product = await db.collection("product").find().toArray();
      res.json({
        statusCode: 200,
        product,
        message: "Get Product data successfully",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Error getting product",
    });
  }
});

// Put Method products
router.put("/putproducts/:id", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("product").find().toArray();
    if (user.length > 0) {
      let product = await db
        .collection("product")
        .updateOne({ _id: ObjectId(req.params.id) }, { $set: { ...req.body } });
      res.json({
        statusCode: 200,
        product,
        message: "Product updated successfully",
      });
    } else {
      res.json({
        statusCode: 400,
        message: "Invalid User ID",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});

// Delete Product method
router.delete("/deleteproduct/:id", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("product").find().toArray();
    if (user) {
      let product = await db
        .collection("product")
        .deleteOne({ _id: ObjectId(req.params.id) });
      res.json({
        statusCode: 200,
        product,
        message: "Delete Successfully",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Delete failed",
    });
  }
});
// -----------------------------------------------------------------------------------
// Bill information

// Post bill information
router.post("/addbillinformation", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let billinfo = await db.collection("billinformation").insertOne(req.body);
    if (billinfo) {
      res.json({
        statusCode: 200,
        billinfo,
        message: "Post Add Bill Information Data Successfully",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});

//  Get bill information
router.get("/getbillinformation", async (req, res) => {
  const Client = await MongoClient.connect(dburl);
  try {
    let db = await Client.db("inventorybilling");
    let user = await db.collection("billinformation");
    if (user) {
      let billinfo = await db.collection("billinformation").find().toArray();
      res.json({
        statusCode: 200,
        billinfo,
        message: "GET Bill Information Data Successfully",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});

// Put Bill Information
router.put("/updatebillinfo/:id", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("billinformation").find().toArray();
    if (user.length > 0) {
      let bill = await db
        .collection("billinformation")
        .updateOne({ _id: ObjectId(req.params.id) }, { $set: { ...req.body } });
      res.json({
        statusCode: 200,
        bill,
        message: "Upadate Bill Information Data Successfully",
      });
    } else {
      res.json({
        statusCode: 400,
        message: "Invaild User ID",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});

// Delete Bill Information
router.delete("/deletebillinfo/:id", async (req, res) => {
  const Client = await MongoClient.connect(dburl);
  try {
    let db = await Client.db("inventorybilling");
    let user = await db.collection("billinformation").find().toArray();
    if (user) {
      let billinfo = await db
        .collection("billinformation")
        .deleteOne({ _id: ObjectId(req.params.id) });
      res.json({
        statusCode: 200,
        billinfo,
        message: "Delete Successfully",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Delete Failed",
    });
  }
});

// my profile ----------------------------------------------------------------------------------------
//  Post My products
router.post("/myprofilepost", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let company = await db.collection("myprofile").insertOne(req.body);
    if (company) {
      res.json({
        statusCode: 200,
        data: company,
        message: "Post My profile data successfully",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});

// Get My profile method
router.get("/getmyprofile", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("myprofile");
    if (user) {
      let profile = await db.collection("myprofile").find().toArray();
      res.json({
        statusCode: 200,
        profile,
        message: "Get My profile data successfully",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});

// Put Method Myprofile
router.put("/putmyprofile/:id", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("myprofile").find().toArray();
    if (user.length > 0) {
      let product = await db
        .collection("myprofile")
        .updateOne({ _id: ObjectId(req.params.id) }, { $set: { ...req.body } });
      res.json({
        statusCode: 200,
        product,
        message: "My profile updated successfully",
      });
    } else {
      res.json({
        statusCode: 400,
        message: "Invalid User ID",
      });
    }
  } catch (err) {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  }
});

// --------------------------------------------------
// signup
router.post("/signup", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("users").find({ email: req.body.email });
    if (user.length > 0) {
      res.json({
        statusCode: 400,
        message: "User Already Exists",
      });
    } else {
      let hashedPassword = await hashPassword(
        req.body.password,
        req.body.cpassword
      );
      req.body.password = hashedPassword;
      req.body.cpassword = hashedPassword;
      let users = await db.collection("users").insertOne(req.body);
      res.json({
        statusCode: 200,
        message: "User SignUp Successfull",
      });
    }
  } catch (error) {
    console.log(error);
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

// Login

router.post("/login", async (req, res) => {
  const client = await MongoClient.connect(dburl);
  try {
    let db = await client.db("inventorybilling");
    let user = await db.collection("users").findOne({ email: req.body.email });
    if (user) {
      let compare = await hashCompare(req.body.password, user.password);
      if (compare) {
        let token = await createToken(user.email, user.username);
        res.json({
          statusCode: 200,
          email: user.email,
          username: user.username,
          token,
        });
      } else {
        res.json({
          statusCode: 400,
          message: "Invalid Password",
        });
      }
    } else {
      res.json({
        statusCode: 404,
        message: "User Not Found",
      });
    }
  } catch (error) {
    res.json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});
// varify token
router.post("/auth", verifyToken, async (req, res) => {
  res.json({
    statusCode: 200,
    message: req.body.purpose,
  });
});

module.exports = router;
