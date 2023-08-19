const bcrypt = require("bcryptjs");
const JWT = require("jsonwebtoken");
const JWTD = require("jwt-decode");
require("dotenv").config();

const secret = process.env.JWT_SECRET;
const saltRound = 10;

const hashPassword = async (pwd) => {
  const salt = await bcrypt.genSalt(saltRound);
  const hash = await bcrypt.hash(pwd, salt);
  return hash;
};

const hashCompare = async (pwd, hash) => {
  const result = await bcrypt.compare(pwd, hash);
  return result;
};

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
