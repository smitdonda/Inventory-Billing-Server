const mongoose = require("mongoose");
const Product = require("../models/products");

const round2 = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Recompute a line item from its inputs.
 * Totals are never taken from the request body — a client that posts its own
 * `gsttex` could otherwise bill any amount it likes.
 */
const priceLine = (line = {}) => {
  const unitprice = Math.max(0, Number(line.unitprice) || 0);
  const quantity = Math.max(0, Math.trunc(Number(line.quantity) || 0));
  const pandqtotal = round2(unitprice * quantity);

  const gst = (Array.isArray(line.gst) ? line.gst : []).map((slab) => {
    const value = Math.max(0, Number(slab?.value) || 0);
    return {
      title: String(slab?.title || "").slice(0, 40),
      value,
      taxAmount: round2((pandqtotal / 100) * value),
    };
  });

  const gsttex = round2(
    gst.reduce((sum, slab) => sum + slab.taxAmount, pandqtotal)
  );

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

  const totalproductsprice = round2(
    products.reduce((sum, line) => sum + line.gsttex, 0)
  );

  return { products, totalproductsprice };
};

/**
 * Map a bill's line items to `{ productId -> units }`.
 * Bills written before line items carried a productId are matched by their
 * catalogue number, then by name, so old records still adjust stock.
 */
const tallyByProduct = async (lines = []) => {
  const tally = new Map();

  for (const line of lines) {
    const quantity = Number(line?.quantity) || 0;
    if (quantity <= 0) continue;

    let productId = null;
    if (mongoose.Types.ObjectId.isValid(line?.productId)) {
      productId = String(line.productId);
    } else {
      const filter = Number.isFinite(Number(line?.id))
        ? { id: Number(line.id) }
        : { productname: line?.productname };
      // eslint-disable-next-line no-await-in-loop
      const match = await Product.findOne(filter).select("_id").lean();
      if (match) productId = String(match._id);
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
 */
const applyStockDelta = async (delta) => {
  const applied = [];

  for (const [productId, consume] of delta) {
    const filter =
      consume > 0
        ? { _id: productId, availableproductqty: { $gte: consume } }
        : { _id: productId };

    // eslint-disable-next-line no-await-in-loop
    const result = await Product.updateOne(filter, {
      $inc: { availableproductqty: -consume },
    });

    if (result.matchedCount === 0) {
      for (const [doneId, doneQty] of applied) {
        // eslint-disable-next-line no-await-in-loop
        await Product.updateOne(
          { _id: doneId },
          { $inc: { availableproductqty: doneQty } }
        );
      }

      // eslint-disable-next-line no-await-in-loop
      const product = await Product.findById(productId)
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
  round2,
  priceLine,
  priceBill,
  tallyByProduct,
  stockDelta,
  applyStockDelta,
};
