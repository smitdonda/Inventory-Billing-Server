const bcrypt = require("bcryptjs");
const JWT = require("jsonwebtoken");

const SALT_ROUNDS = 10;
const DEFAULT_EXPIRY = "7d";

const hashPassword = (pwd) => bcrypt.hash(pwd, SALT_ROUNDS);

const hashCompare = (pwd, hash) => bcrypt.compare(pwd, hash || "");

const createToken = async (id) => {
  const token = JWT.sign({ userId: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRATION_TIME || DEFAULT_EXPIRY,
  });

  // Decoding our own freshly signed token is the cheapest way to get the exact
  // expiry the client should store the cookie against.
  const { exp } = JWT.decode(token);
  return { token, expiresIn: new Date(exp * 1000) };
};

module.exports = { hashPassword, hashCompare, createToken };
