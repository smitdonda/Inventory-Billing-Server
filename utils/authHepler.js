const bcrypt = require("bcryptjs");
const JWT = require("jsonwebtoken");

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


module.exports = { hashPassword, hashCompare, createToken };
