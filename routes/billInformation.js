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

router.use(requireAuth);

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
    const { products, totalproductsprice } = priceBill(req.body);
    if (!products.length) {
      return res
        .status(422)
        .json({ success: false, message: "Add at least one product" });
    }

    // Take the stock first: if anything is short the bill is never created.
    const wanted = await tallyByProduct(products);
    await applyStockDelta(stockDelta(new Map(), wanted));

    try {
      const id = await getNextCounterId("BillInformation");
      const billinfo = await BillInformation.create({
        ...pickCustomer(req.body),
        products,
        totalproductsprice,
        id,
      });

      res.status(201).json({
        success: true,
        billinfo,
        message: "Create Bill Information Successfully",
      });
    } catch (error) {
      // The bill failed to save — hand the stock back.
      await applyStockDelta(stockDelta(wanted, new Map())).catch(() => {});
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const billinfo = await BillInformation.find({}).sort({
      createdAt: -1,
      _id: -1,
    });
    res.json({
      success: true,
      billinfo,
      message: "Bill Information Successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const bill = await BillInformation.findById(id);

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
    const id = await isIDGood(req.params.id);
    const existing = await BillInformation.findById(id);

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
    const before = await tallyByProduct(existing.products);
    const after = await tallyByProduct(products);
    const delta = stockDelta(before, after);
    await applyStockDelta(delta);

    try {
      const bill = await BillInformation.findByIdAndUpdate(
        id,
        { $set: { ...pickCustomer(req.body), products, totalproductsprice } },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        bill,
        message: "Bill Information Updated Successfully",
      });
    } catch (error) {
      await applyStockDelta(stockDelta(after, before)).catch(() => {});
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = await isIDGood(req.params.id);
    const billinfo = await BillInformation.findByIdAndDelete(id);

    if (!billinfo) {
      return res
        .status(404)
        .json({ success: false, message: "Not found Bill Information" });
    }

    // Cancelling a bill returns its units to the shelf.
    const released = await tallyByProduct(billinfo.products);
    await applyStockDelta(stockDelta(released, new Map())).catch((error) =>
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
