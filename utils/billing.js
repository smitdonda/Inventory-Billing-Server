const mongoose = require("mongoose");
const Product = require("../models/products");
const { toPaise, percentOf } = require("./money");

/**
 * Recompute a line item from its inputs.
 *
 * Totals are never taken from the request body — a client that posts its own
 * `gsttex` could otherwise bill any amount it likes. Amounts in and out are
 * whole paise, so every value here stays an exact integer.
 */
const priceLine = (line = {}) => {
  const unitprice = toPaise(line.unitprice);
  const quantity = Math.max(0, Math.trunc(Number(line.quantity)) || 0);
  const pandqtotal = unitprice * quantity;

  const gst = (Array.isArray(line.gst) ? line.gst : []).map((slab) => {
    const value = Math.max(0, Number(slab?.value) || 0);
    return {
      title: String(slab?.title || "").slice(0, 40),
      value,
      taxAmount: percentOf(pandqtotal, value),
    };
  });

  const gsttex = gst.reduce((sum, slab) => sum + slab.taxAmount, pandqtotal);

  return {
    productId: mongoose.Types.ObjectId.isValid(line.productId)
      ? line.productId
      : undefined,
    id: Number.isFinite(Number(line.id)) ? Number(line.id) : undefined,
    productname: String(line.productname || "").trim(),
    unitprice,
    quantity,
    pandqtotal,
    gsttex,
    gst,
  };
};

/** Normalise a whole bill body: clean line items plus a trustworthy total. */
const priceBill = (body = {}) => {
  const products = (Array.isArray(body.products) ? body.products : [])
    .map(priceLine)
    .filter((line) => line.quantity > 0 && line.productname);

  const totalproductsprice = products.reduce(
    (sum, line) => sum + line.gsttex,
    0
  );

  return { products, totalproductsprice };
};

/**
 * Map a bill's line items to `{ productId -> units }`, within one account.
 *
 * Bills written before line items carried a productId are matched by their
 * catalogue number, then by name, so old records still adjust stock. Those
 * fallbacks are resolved in a single query rather than one per line.
 */
const tallyByProduct = async (lines = [], userId) => {
  if (!userId) throw new Error("tallyByProduct needs a user id");

  const usable = (Array.isArray(lines) ? lines : []).filter(
    (line) => (Number(line?.quantity) || 0) > 0
  );

  const needsLookup = usable.filter(
    (line) => !mongoose.Types.ObjectId.isValid(line?.productId)
  );

  // One round trip for every line that has to be matched the old way.
  const lookup = { byNumber: new Map(), byName: new Map() };
  if (needsLookup.length) {
    const numbers = [
      ...new Set(
        needsLookup
          .map((line) => Number(line?.id))
          .filter((value) => Number.isFinite(value))
      ),
    ];
    const names = [
      ...new Set(
        needsLookup
          .map((line) => line?.productname)
          .filter((value) => typeof value === "string" && value)
      ),
    ];

    const or = [];
    if (numbers.length) or.push({ id: { $in: numbers } });
    if (names.length) or.push({ productname: { $in: names } });

    if (or.length) {
      const matches = await Product.find({ user: userId, $or: or })
        .select("_id id productname")
        .lean();

      for (const match of matches) {
        if (!lookup.byNumber.has(match.id)) {
          lookup.byNumber.set(match.id, String(match._id));
        }
        if (!lookup.byName.has(match.productname)) {
          lookup.byName.set(match.productname, String(match._id));
        }
      }
    }
  }

  const tally = new Map();

  for (const line of usable) {
    const quantity = Number(line.quantity) || 0;

    let productId = null;
    if (mongoose.Types.ObjectId.isValid(line.productId)) {
      productId = String(line.productId);
    } else {
      const number = Number(line.id);
      productId =
        (Number.isFinite(number) ? lookup.byNumber.get(number) : null) ||
        lookup.byName.get(line.productname) ||
        null;
    }

    // A product deleted after billing has no stock left to adjust.
    if (!productId) continue;
    tally.set(productId, (tally.get(productId) || 0) + quantity);
  }

  return tally;
};

/** How many units each product must give up (negative = give back). */
const stockDelta = (before = new Map(), after = new Map()) => {
  const delta = new Map();
  const ids = new Set([...before.keys(), ...after.keys()]);
  for (const id of ids) {
    const change = (after.get(id) || 0) - (before.get(id) || 0);
    if (change !== 0) delta.set(id, change);
  }
  return delta;
};

/**
 * Apply a stock delta with a guard on each decrement, undoing what was already
 * applied if any product turns out to be short. Mongo standalone deployments
 * have no transactions, so compensation is the portable way to stay consistent.
 *
 * Every write is scoped to the owning account, so a forged productId belonging
 * to someone else matches nothing and is reported as missing.
 */
const applyStockDelta = async (delta, userId) => {
  if (!userId) throw new Error("applyStockDelta needs a user id");

  const applied = [];

  for (const [productId, consume] of delta) {
    const filter =
      consume > 0
        ? {
            _id: productId,
            user: userId,
            availableproductqty: { $gte: consume },
          }
        : { _id: productId, user: userId };

    // eslint-disable-next-line no-await-in-loop
    const result = await Product.updateOne(filter, {
      $inc: { availableproductqty: -consume },
    });

    if (result.matchedCount === 0) {
      for (const [doneId, doneQty] of applied) {
        // eslint-disable-next-line no-await-in-loop
        await Product.updateOne(
          { _id: doneId, user: userId },
          { $inc: { availableproductqty: doneQty } }
        );
      }

      // eslint-disable-next-line no-await-in-loop
      const product = await Product.findOne({ _id: productId, user: userId })
        .select("productname availableproductqty")
        .lean();

      const error = new Error(
        product
          ? `Not enough stock for "${product.productname}" — ${product.availableproductqty} in stock, ${consume} needed`
          : "A product on this bill no longer exists"
      );
      error.status = 409;
      throw error;
    }

    applied.push([productId, consume]);
  }
};

module.exports = {
  priceLine,
  priceBill,
  tallyByProduct,
  stockDelta,
  applyStockDelta,
};
