const express = require("express");
const router = express.Router();
const Product = require("../models/products");
const { isIDGood } = require("../utils/isIDGood");
const { getNextCounterId } = require("../utils/counterId");
const { requireAuth } = require("../config/requireAuth");
const {
  parsePaging,
  pageMeta,
  searchFilter,
  parseSort,
} = require("../utils/pagination");

router.use(requireAuth);

/** Columns a client may sort on — anything else falls back to newest first. */
const SORTABLE = [
  "productname",
  "availableproductqty",
  "unitprice",
  "id",
  "updatedAt",
];

/**
 * Whitelist of writable fields — `id` stays under the counter's control and
 * `user` is never taken from the body.
 *
 * `unitprice` is a whole number of paise, not rupees. See utils/money.js.
 */
const pickBody = (body = {}) => {
  const values = {};
  if (typeof body.productname === "string") {
    values.productname = body.productname.trim();
  }
  if (body.availableproductqty !== undefined) {
    values.availableproductqty = Math.trunc(Number(body.availableproductqty));
  }
  if (body.unitprice !== undefined) {
    values.unitprice = Math.trunc(Number(body.unitprice));
  }
  return values;
};

const invalidNumbers = (values) =>
  Object.entries(values).some(
    ([key, value]) =>
      key !== "productname" && (!Number.isFinite(value) || value < 0)
  );

router.post("/", async (req, res, next) => {
  try {
    const values = pickBody(req.body);
    if (!values.productname) {
      return res
        .status(422)
        .json({ success: false, message: "Product name is required" });
    }
    if (invalidNumbers(values)) {
      return res.status(422).json({
        success: false,
        message: "Quantity and unit price must be zero or more",
      });
    }

    const id = await getNextCounterId("Product", req.user._id);
    const product = await Product.create({ ...values, id, user: req.user._id });

    res.status(201).json({
      success: true,
      data: product,
      message: "Create Product successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePaging(req.query);
    const filter = {
      user: req.user._id,
      ...(searchFilter(req.query.search, ["productname"]) || {}),
    };

    /*
     * The page, the count and the totals all run together — the client needs
     * every one of them to draw the screen and they do not depend on each
     * other. The totals cover everything the filter matches, not just this
     * page, which is what the "units on hand" chip has always meant.
     */
    const [products, total, totals] = await Promise.all([
      Product.find(filter)
        .sort(parseSort(req.query, SORTABLE))
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
      Product.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            units: { $sum: "$availableproductqty" },
            value: {
              $sum: { $multiply: ["$unitprice", "$availableproductqty"] },
            },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      products,
      meta: {
        ...pageMeta({ page, limit, total }),
        stockUnits: totals[0]?.units || 0,
        stockValue: totals[0]?.value || 0,
      },
      message: "Get Product data successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const values = pickBody(req.body);

    if (invalidNumbers(values)) {
      return res.status(422).json({
        success: false,
        message: "Quantity and unit price must be zero or more",
      });
    }

    // Scoped by owner, so another account's id is a 404 rather than an edit.
    const product = await Product.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: values },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Not found product" });
    }

    res.json({
      success: true,
      product,
      message: "Product updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const product = await Product.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Not found product" });
    }

    res.json({
      success: true,
      product,
      message: "Delete Successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
