const express = require("express");
const { ObjectId } = require("mongodb");
const router = express.Router();
const { MongoClient, dburl } = require("../dbSchema");
const { hashPassword, hashCompare, createToken, verifyToken } = require("../auth");

const connectToDb = async () => {
  return await MongoClient.connect(dburl);
};

// Customer Routes
router.post("/postcustomers", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const customer = await db.collection("customer").insertOne(req.body);
    res.json({
      statusCode: 200,
      data: customer,
      message: "Customer Data Successfully",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.get("/getcustomers", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const customers = await db.collection("customer").find().toArray();
    res.json({ 
      statusCode: 200,
      customers,
      message: "Get Inventory Bill",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.put("/putcustomers/:id", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db.collection("customer").find().toArray();
    if (user.length > 0) {
      const customer = await db
        .collection("customer")
        .updateOne({ _id: ObjectId(req.params.id) }, { $set: { ...req.body } });
      res.json({
        statusCode: 200,
        customer,
        message: "Customer Updated Successfully",
      });
    } else {
      res.status(400).json({
        statusCode: 400,
        message: "Invalid User ID",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.delete("/deletecustomer/:id", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db.collection("customer").find().toArray();
    if (user) {
      const customer = await db
        .collection("customer")
        .deleteOne({ _id: ObjectId(req.params.id) });
      res.json({
        statusCode: 200,
        customer,
        message: "Delete Successfully",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Delete failed",
    });
  } finally {
    client.close();
  }
});

// Product Routes
router.post("/postproducts", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const product = await db.collection("product").insertOne(req.body);
    res.json({
      statusCode: 200,
      data: product,
      message: "Post Product data successfully",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.get("/getproducts", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const products = await db.collection("product").find().toArray();
    res.json({
      statusCode: 200,
      products,
      message: "Get Product data successfully",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Error getting product",
    });
  } finally {
    client.close();
  }
});

router.put("/putproducts/:id", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db.collection("product").find().toArray();
    if (user.length > 0) {
      const product = await db
        .collection("product")
        .updateOne({ _id: ObjectId(req.params.id) }, { $set: { ...req.body } });
      res.json({
        statusCode: 200,
        product,
        message: "Product updated successfully",
      });
    } else {
      res.status(400).json({
        statusCode: 400,
        message: "Invalid User ID",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.delete("/deleteproduct/:id", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db.collection("product").find().toArray();
    if (user) {
      const product = await db
        .collection("product")
        .deleteOne({ _id: ObjectId(req.params.id) });
      res.json({
        statusCode: 200,
        product,
        message: "Delete Successfully",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Delete Failed",
    });
  } finally {
    client.close();
  }
});

// Bill Information Routes
router.post("/addbillinformation", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const billinfo = await db.collection("billinformation").insertOne(req.body);
    res.json({
      statusCode: 200,
      billinfo,
      message: "Post Add Bill Information Data Successfully",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.get("/getbillinformation", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const billinfo = await db.collection("billinformation").find().toArray();
    res.json({
      statusCode: 200,
      billinfo,
      message: "GET Bill Information Data Successfully",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.put("/updatebillinfo/:id", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db.collection("billinformation").find().toArray();
    if (user.length > 0) {
      const bill = await db
        .collection("billinformation")
        .updateOne({ _id: ObjectId(req.params.id) }, { $set: { ...req.body } });
      res.json({
        statusCode: 200,
        bill,
        message: "Update Bill Information Data Successfully",
      });
    } else {
      res.status(400).json({
        statusCode: 400,
        message: "Invalid User ID",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.delete("/deletebillinfo/:id", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db.collection("billinformation").find().toArray();
    if (user) {
      const billinfo = await db
        .collection("billinformation")
        .deleteOne({ _id: ObjectId(req.params.id) });
      res.json({
        statusCode: 200,
        billinfo,
        message: "Delete Successfully",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Delete Failed",
    });
  } finally {
    client.close();
  }
});

// My Profile Routes
router.post("/myprofilepost", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const company = await db.collection("myprofile").insertOne(req.body);
    res.json({
      statusCode: 200,
      data: company,
      message: "Post My profile data successfully",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.get("/getmyprofile", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const profile = await db.collection("myprofile").find().toArray();
    res.json({
      statusCode: 200,
      profile,
      message: "Get My profile data successfully",
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.put("/putmyprofile/:id", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db.collection("myprofile").find().toArray();
    if (user.length > 0) {
      const product = await db
        .collection("myprofile")
        .updateOne({ _id: ObjectId(req.params.id) }, { $set: { ...req.body } });
      res.json({
        statusCode: 200,
        product,
        message: "My profile updated successfully",
      });
    } else {
      res.status(400).json({
        statusCode: 400,
        message: "Invalid User ID",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

// Authentication Routes
router.post("/signup", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db.collection("users").findOne({ email: req.body.email });
    if (user) {
      res.status(400).json({
        statusCode: 400,
        message: "User Already Exists",
      });
    } else {
      const hashedPassword = await hashPassword(req.body.password, req.body.cpassword);
      req.body.password = hashedPassword;
      req.body.cpassword = hashedPassword;
      await db.collection("users").insertOne(req.body);
      res.json({
        statusCode: 200,
        message: "User SignUp Successful",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.post("/login", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db.collection("users").findOne({ email: req.body.email });
    if (user) {
      const compare = await hashCompare(req.body.password, user.password);
      if (compare) {
        const token = await createToken(user.email, user.username);
        res.json({
          statusCode: 200,
          email: user.email,
          username: user.username,
          token,
        });
      } else {
        res.status(400).json({
          statusCode: 400,
          message: "Invalid Password",
        });
      }
    } else {
      res.status(404).json({
        statusCode: 404,
        message: "User Not Found",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
    });
  } finally {
    client.close();
  }
});

router.post("/auth", verifyToken, async (req, res) => {
  res.json({
    statusCode: 200,
    message: req.body.purpose,
  });
});

module.exports = router;
