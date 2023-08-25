const bcrypt = require("bcryptjs");
const JWT = require("jsonwebtoken");
const JWTD = require("jwt-decode");

const secret = process.env.JWT_SECRET;
const saltRound = 10;

// write a function to convert password into hash
const hashPassword = async (pwd) => {
  const salt = await bcrypt.genSalt(saltRound);
  const hash = await bcrypt.hash(pwd, salt);
  return hash;
};

//write a function compare the hashpwd and pwd
const hashCompare = async (pwd, hash) => {
  const result = await bcrypt.compare(pwd, hash);
  return result;
};

// write a function to create token
const createToken = async (id) => {
  const token = await JWT.sign(
    {
      userId: id,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRATION_TIME,
    }
  );
  return token;
};

// Write funciton to verifytoken
const verifyToken = async (req, res, next) => {
  const decodeData = JWTD(req.headers.token);
  if (Date.now() < decodeData.exp * 1000) {
    next();
  } else {
    res.json({
      success: false,
      message: "Session Expired. Please login again!",
    });
  }
};

module.exports = { hashPassword, hashCompare, createToken, verifyToken };
