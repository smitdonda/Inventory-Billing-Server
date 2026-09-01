const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");

/*
 * Boots the real Express app against a throwaway in-memory MongoDB.
 *
 * These are route tests, not unit tests: they go through the actual
 * middleware stack — CORS, the database gate, requireAuth, the error handler —
 * because that stack is where the interesting bugs live. Ownership scoping in
 * particular cannot be proved anywhere else: it is a property of what the
 * queries filter on, not of any function you can call in isolation.
 *
 * This directory sits outside test/ on purpose, so the runner does not try to
 * execute the helper as a test file.
 */

let mongod = null;

/** Boots a fresh database and returns the app wired to it. */
async function startTestApp() {
  mongod = await MongoMemoryServer.create();

  /*
   * Set before requiring app.js: it reads these at require time and exits the
   * process without them. dotenv does not overwrite variables that are already
   * set, so these win over whatever .env holds.
   */
  const throwawayUri = mongod.getUri("billbook-test");
  process.env.MONGO_DB_URL = throwawayUri;
  process.env.JWT_SECRET = "test-only-secret-not-used-anywhere-real";
  process.env.NODE_ENV = "test";
  process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS = "5000";
  delete process.env.CORS_ORIGIN;
  delete process.env.COOKIE_SAMESITE;
  delete process.env.COOKIE_SECURE;
  delete process.env.COOKIE_DOMAIN;

  const app = require("../app");

  /*
   * A test suite that quietly connected to the real cluster would delete a
   * live shop's data on its first clearDatabase(). Refuse to go on unless the
   * URL is still the throwaway one.
   */
  if (process.env.MONGO_DB_URL !== throwawayUri) {
    throw new Error(
      "Refusing to run: MONGO_DB_URL is not the in-memory server. " +
        "Something overwrote it after startTestApp() set it."
    );
  }

  const { connectMongo } = require("../config/mongo");
  await connectMongo();

  // Unique indexes have to be built before a test can prove one bites.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init())
  );

  return app;
}

async function stopTestApp() {
  await mongoose.disconnect().catch(() => {});
  if (mongod) await mongod.stop();
  mongod = null;
}

/** Empties every collection, leaving the indexes in place. */
async function clearDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

const DEFAULT_PASSWORD = "Password1!";

/**
 * A signed-in agent. supertest agents keep cookies between requests, which is
 * exactly what a browser does with the httpOnly session cookie — so this is
 * the real login path, not a hand-forged token.
 */
async function signIn(app, email, { username = "tester" } = {}) {
  const agent = request.agent(app);

  await agent
    .post("/signup")
    .send({ email, username, password: DEFAULT_PASSWORD })
    .expect(201);

  await agent
    .post("/login")
    .send({ email, password: DEFAULT_PASSWORD })
    .expect(200);

  return agent;
}

/** Creates a product and returns the saved document. Prices are in paise. */
async function createProduct(agent, values = {}) {
  const res = await agent
    .post("/products")
    .send({
      productname: "Widget",
      availableproductqty: 10,
      unitprice: 10000,
      ...values,
    })
    .expect(201);

  return res.body.data;
}

/** One priced line item pointing at a product, ready to post to a bill. */
function lineFor(
  product,
  quantity = 1,
  gst = [{ title: "S GST 9%", value: 9 }]
) {
  return {
    productId: product._id,
    id: product.id,
    productname: product.productname,
    unitprice: product.unitprice,
    quantity,
    gst,
  };
}

/** Stock on hand for a product, straight from the database. */
async function stockOf(agent, productId) {
  const res = await agent.get("/products").query({ limit: 500 }).expect(200);
  const product = res.body.products.find((p) => p._id === String(productId));
  return product ? product.availableproductqty : null;
}

module.exports = {
  startTestApp,
  stopTestApp,
  clearDatabase,
  signIn,
  createProduct,
  lineFor,
  stockOf,
  DEFAULT_PASSWORD,
};
