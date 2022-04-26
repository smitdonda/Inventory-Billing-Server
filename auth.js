var bcrypt = require("bcryptjs");
var saltRound = 10;
var JWT = require("jsonwebtoken");
var JWTD = require("jwt-decode");
var secret = "snksknfjbekjb@nkj*&153";

var hashPassword = async (pwd) => {
  let salt = await bcrypt.genSalt(saltRound);
  let hash = await bcrypt.hash(pwd, salt);
  return hash;
};

var hashCompare = async (pwd, hash) => {
  let result = await bcrypt.compare(pwd, hash);
  return result;
};

var createToken = async (email, username) => {
  let token = await JWT.sign(
    {
      email,
      username,
    },
    secret,
    {
      expiresIn: "3h",
    }
  );
  return token;
};

var verifyToken = async (req, res, next) => {
  let decodeData = JWTD(req.headers.token);
  if (new Date() / 1000 < decodeData.exp) {
    next();
  } else {
    res.json({
      statusCode: 401,
      message: "Session Expired Login again!",
    });
  }
};

module.exports = { hashPassword, hashCompare, createToken, verifyToken };
