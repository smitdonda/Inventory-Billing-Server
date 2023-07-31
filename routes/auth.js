const express = require("express");
const router = express.Router();
const { connectToDb } = require("../dbSchema");
const {
  hashPassword,
  hashCompare,
  createToken,
  verifyToken,
} = require("../authHepler");

// Authentication Routes
router.post("/signup", async (req, res) => {
  const client = await connectToDb();
  try {
    const db = client.db("inventorybilling");
    const user = await db
      .collection("users")
      .findOne({ email: req.body.email });
    if (user) {
      res.status(400).json({
        statusCode: 400,
        message: "User Already Exists",
      });
    } else {
      const hashedPassword = await hashPassword(
        req.body.password,
        req.body.cpassword
      );
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
    const user = await db
      .collection("users")
      .findOne({ email: req.body.email });
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
