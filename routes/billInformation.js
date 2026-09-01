const express = require("express");
const router = express.Router();
const BillInformation = require("../models/BilIInfo");
const { isIDGood } = require("../utils/isIDGood");
const { getNextCounterId } = require("../utils/counterId");
const { requireAuth } = require("../config/requireAuth");
const {
  priceBill,
  tallyByProduct,
  stockDelta,
  applyStockDelta,
} = require("../utils/billing");
const {
  parsePaging,
  pageMeta,
  searchFilter,
  parseSort,
} = require("../utils/pagination");

router.use(requireAuth);

const SORTABLE = ["id", "name", "totalproductsprice", "createdAt", "updatedAt"];
const SEARCHABLE = [
  "name",
  "email",
  "phoneNo",
  "gstNo",
  "products.productname",
];

/** Customer details on the bill are a snapshot, separate from line items. */
const pickCustomer = (body = {}) => {
  const values = {};
  if (typeof body.name === "string") values.name = body.name;
  if (typeof body.email === "string") values.email = body.email;
  if (body.phoneNo != null) values.phoneNo = String(body.phoneNo);
  if (typeof body.gstNo === "string") values.gstNo = body.gstNo;
  return values;
};

router.post("/", async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { products, totalproductsprice } = priceBill(req.body);
    if (!products.length) {
      return res
        .status(422)
        .json({ success: false, message: "Add at least one product" });
    }

    // Take the stock first: if anything is short the bill is never created.
    const wanted = await tallyByProduct(products, userId);
    await applyStockDelta(stockDelta(new Map(), wanted), userId);

    try {
      const id = await getNextCounterId("BillInformation", userId);
      const billinfo = await BillInformation.create({
        ...pickCustomer(req.body),
        products,
        totalproductsprice,
        id,
        user: userId,
      });

      res.status(201).json({
        success: true,
        billinfo,
        message: "Create Bill Information Successfully",
      });
    } catch (error) {
      // The bill failed to save — hand the stock back.
      await applyStockDelta(stockDelta(wanted, new Map()), userId).catch(
        () => {}
      );
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePaging(req.query);
    const filter = {
      user: req.user._id,
      ...(searchFilter(req.query.search, SEARCHABLE) || {}),
    };

    /*
     * The billed total is summed in the database over everything the filter
     * matches, not over the page. The dashboard used to fetch every bill just
     * to add up this one number in the browser.
     */
    const [billinfo, total, totals] = await Promise.all([
      BillInformation.find(filter)
        .sort(parseSort(req.query, SORTABLE, { createdAt: -1 }))
        .skip(skip)
        .limit(limit)
        .lean(),
      BillInformation.countDocuments(filter),
      BillInformation.aggregate([
        { $match: filter },
        { $group: { _id: null, billed: { $sum: "$totalproductsprice" } } },
      ]),
    ]);

    res.json({
      success: true,
      billinfo,
      meta: {
        ...pageMeta({ page, limit, total }),
        totalBilled: totals[0]?.billed || 0,
      },
      message: "Bill Information Successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const bill = await BillInformation.findOne({ _id: id, user: req.user._id });

    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "Not found Bill Information" });
    }

    res.json({ success: true, bill, message: "Bill Information" });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const userId = req.user._id;
    const id = await isIDGood(req.params.id);
    const existing = await BillInformation.findOne({ _id: id, user: userId });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Not found Bill Information" });
    }

    const { products, totalproductsprice } = priceBill(req.body);
    if (!products.length) {
      return res
        .status(422)
        .json({ success: false, message: "Add at least one product" });
    }

    // Move stock by the difference only. The old code decremented the full
    // quantity again on every save, so editing a bill drained stock twice.
    const before = await tallyByProduct(existing.products, userId);
    const after = await tallyByProduct(products, userId);
    const delta = stockDelta(before, after);
    await applyStockDelta(delta, userId);

    try {
      const bill = await BillInformation.findOneAndUpdate(
        { _id: id, user: userId },
        { $set: { ...pickCustomer(req.body), products, totalproductsprice } },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        bill,
        message: "Bill Information Updated Successfully",
      });
    } catch (error) {
      await applyStockDelta(stockDelta(after, before), userId).catch(() => {});
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user._id;
    const id = await isIDGood(req.params.id);
    const billinfo = await BillInformation.findOneAndDelete({
      _id: id,
      user: userId,
    });

    if (!billinfo) {
      return res
        .status(404)
        .json({ success: false, message: "Not found Bill Information" });
    }

    // Cancelling a bill returns its units to the shelf.
    const released = await tallyByProduct(billinfo.products, userId);
    await applyStockDelta(stockDelta(released, new Map()), userId).catch(
      (error) =>
        console.error("Could not restore stock for bill", id, error.message)
    );

    res.json({
      success: true,
      billinfo,
      message: "Delete Successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
