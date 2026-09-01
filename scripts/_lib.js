require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");

/*
 * Shared plumbing for the one-off migration scripts.
 *
 * Every migration records its name in a `migrations` collection and refuses to
 * run twice. That matters most for the money migration: running it a second
 * time would multiply every price by a hundred again, and nothing about the
 * data itself would say it had already happened.
 */

const LEDGER = "migrations";

const connect = async () => {
  if (!process.env.MONGO_DB_URL) {
    throw new Error("MONGO_DB_URL is not set");
  }
  await mongoose.connect(process.env.MONGO_DB_URL, {
    serverSelectionTimeoutMS: 10000,
  });
  return mongoose.connection;
};

const ledger = () => mongoose.connection.collection(LEDGER);

const alreadyApplied = async (name) =>
  Boolean(await ledger().findOne({ name }));

const markApplied = async (name, detail = {}) => {
  await ledger().updateOne(
    { name },
    { $set: { name, detail, appliedAt: new Date() } },
    { upsert: true }
  );
};

/**
 * Wraps a migration: connects, guards against a repeat run, records the
 * result, and always closes the connection so the process exits.
 *
 * Pass --force to re-run one deliberately.
 */
const run = async (name, fn) => {
  const force = process.argv.includes("--force");
  let code = 0;

  try {
    await connect();

    if (!force && (await alreadyApplied(name))) {
      console.log(`${name}: already applied — nothing to do.`);
      return;
    }

    const detail = (await fn(mongoose.connection)) || {};
    await markApplied(name, detail);
    console.log(`${name}: done.`, detail);
  } catch (error) {
    console.error(`${name}: failed —`, error.message);
    code = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(code);
  }
};

module.exports = { run };
