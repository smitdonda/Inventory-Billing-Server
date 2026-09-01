/*
 * Backfills the `user` field that products, customers, bills and the company
 * profile now require.
 *
 * Before this change every signed-in account could read and delete every other
 * account's records, because nothing was owned by anyone. Existing data has no
 * owner recorded anywhere, so one has to be named:
 *
 *   npm run migrate:owner -- owner@example.com
 *
 * Everything ownerless is assigned to that account. Run it once, before
 * anybody else signs up.
 */
const { run } = require("./_lib");

const User = require("../models/users");
const Product = require("../models/products");
const Customer = require("../models/customers");
const BillInfo = require("../models/BilIInfo");
const MyProfile = require("../models/myprofile");
const Counter = require("../models/counter");

const OWNED = [
  ["products", Product, "Product"],
  ["customers", Customer, "Customer"],
  ["bills", BillInfo, "BillInformation"],
];

const emailArg = () => {
  const email = process.argv.slice(2).find((arg) => arg.includes("@"));
  if (!email) {
    throw new Error(
      "Pass the owner's email: npm run migrate:owner -- owner@example.com"
    );
  }
  return email.trim().toLowerCase();
};

run("2026-09-assign-owner", async (connection) => {
  const email = emailArg();
  const owner = await User.findOne({ email }).select("_id email");
  if (!owner) throw new Error(`No account found for ${email}`);

  const assigned = {};

  for (const [label, Model] of OWNED) {
    const result = await Model.collection.updateMany(
      { user: { $exists: false } },
      { $set: { user: owner._id } }
    );
    assigned[label] = result.modifiedCount;
  }

  /*
   * The profile is one-per-account now. If the old data somehow grew a second
   * document, only the first can be kept — the rest were unreachable anyway,
   * since the app has only ever read profile[0].
   */
  const profiles = await MyProfile.collection
    .find({ user: { $exists: false } })
    .sort({ _id: 1 })
    .toArray();

  if (profiles.length) {
    await MyProfile.collection.updateOne(
      { _id: profiles[0]._id },
      { $set: { user: owner._id } }
    );
    assigned.profile = 1;

    if (profiles.length > 1) {
      const stranded = profiles.slice(1).map((doc) => String(doc._id));
      console.warn(
        `Left ${stranded.length} extra company profile(s) unowned — the app ` +
          `only ever read the first. Delete them by hand if they are junk: ` +
          stranded.join(", ")
      );
    }
  }

  // What the old global counters had handed out, read before they are removed.
  const previousSeq = new Map(
    (await Counter.collection.find({ user: { $exists: false } }).toArray()).map(
      (doc) => [doc.type, doc.seq || 0]
    )
  );

  /*
   * The old counters were unique on `type` alone. That index has to go before
   * a per-user counter is written, or inserting {user, type: "Product"}
   * collides with the global {type: "Product"} still sitting there.
   */
  try {
    await Counter.collection.dropIndex("type_1");
  } catch (error) {
    // IndexNotFound (27) — a fresh database, or the script ran before.
    if (error.code !== 27) throw error;
  }

  /*
   * Counters were global and are now per account.
   *
   * Each one carries on from whichever is higher: the largest id still in use,
   * or where the old global counter had got to. Taking only the former would
   * step back over numbers freed by deleted records — and an invoice number
   * that gets issued twice is not a number anyone can rely on.
   */
  const counters = {};
  for (const [, Model, counterType] of OWNED) {
    const [highest] = await Model.collection
      .find({ user: owner._id })
      .sort({ id: -1 })
      .limit(1)
      .toArray();

    const seq = Math.max(highest?.id || 0, previousSeq.get(counterType) || 0);
    await Counter.collection.updateOne(
      { user: owner._id, type: counterType },
      { $set: { user: owner._id, type: counterType, seq } },
      { upsert: true }
    );
    counters[counterType] = seq;
  }

  // The old global counters keyed only by `type` are dead weight now.
  const removed = await Counter.collection.deleteMany({
    user: { $exists: false },
  });

  /*
   * Finally bring the indexes in line with the schemas: the new compound
   * {user, id} uniques have to exist, and syncIndexes drops whatever the
   * schema no longer declares.
   */
  const indexed = [];
  const models = [Product, Customer, BillInfo, Counter];

  /*
   * The profile index is unique on `user`, and a document with no `user` is
   * indexed as null — so two stranded profiles would collide on null and the
   * build would fail. Leave the index alone until they are dealt with, rather
   * than deleting someone's data to make an index fit.
   */
  const strandedProfiles = Math.max(0, profiles.length - 1);
  if (strandedProfiles) {
    console.warn(
      `Skipping the company-profile index: ${strandedProfiles} extra ` +
        `profile(s) have no owner. Remove them, then run this again with ` +
        `--force to finish.`
    );
  } else {
    models.push(MyProfile);
  }

  for (const Model of models) {
    await Model.syncIndexes();
    indexed.push(Model.collection.collectionName);
  }

  return {
    owner: owner.email,
    assigned,
    counters,
    oldCountersRemoved: removed.deletedCount,
    reindexed: indexed,
    ...(strandedProfiles ? { strandedProfiles } : {}),
    database: connection.name,
  };
});
