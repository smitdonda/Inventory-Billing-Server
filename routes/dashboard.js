const express = require("express");
const router = express.Router();
const Customer = require("../models/customers");
const BillInformation = require("../models/BilIInfo");
const Product = require("../models/products");
const { requireAuth } = require("../config/requireAuth");

router.use(requireAuth);

/** A product at or below this many units is called out on the dashboard. */
const LOW_STOCK_AT = 5;
const LOW_STOCK_SHOWN = 6;
const CHART_ITEMS = 8;
const RECENT_BILLS = 5;

router.get("/count", async (req, res, next) => {
  try {
    const user = req.user._id;

    // count() is deprecated in Mongoose 7; countDocuments() is the replacement.
    // Run them together rather than one round trip after another.
    const [customer, product, billInformation] = await Promise.all([
      Customer.countDocuments({ user }),
      Product.countDocuments({ user }),
      BillInformation.countDocuments({ user }),
    ]);

    res.json({ success: true, customer, product, billInformation });
  } catch (error) {
    next(error);
  }
});

/*
 * Everything the dashboard draws, in one request.
 *
 * It used to fetch every product and every bill and add them up in the
 * browser, which meant the page got slower with every invoice ever raised.
 * The sums and the top-N lists are the database's job; what crosses the wire
 * is now a fixed handful of rows whatever the account holds.
 *
 * All money is in paise.
 */
router.get("/summary", async (req, res, next) => {
  try {
    const user = req.user._id;

    const [
      customerCount,
      productCount,
      billCount,
      billTotals,
      stockTotals,
      lowStock,
      lowStockCount,
      chart,
      recentBills,
    ] = await Promise.all([
      Customer.countDocuments({ user }),
      Product.countDocuments({ user }),
      BillInformation.countDocuments({ user }),

      BillInformation.aggregate([
        { $match: { user } },
        { $group: { _id: null, billed: { $sum: "$totalproductsprice" } } },
      ]),

      Product.aggregate([
        { $match: { user } },
        {
          $group: {
            _id: null,
            value: {
              $sum: { $multiply: ["$unitprice", "$availableproductqty"] },
            },
            units: { $sum: "$availableproductqty" },
          },
        },
      ]),

      Product.find({ user, availableproductqty: { $lte: LOW_STOCK_AT } })
        .select("productname availableproductqty unitprice")
        .sort({ availableproductqty: 1, _id: 1 })
        .limit(LOW_STOCK_SHOWN)
        .lean(),

      Product.countDocuments({
        user,
        availableproductqty: { $lte: LOW_STOCK_AT },
      }),

      Product.find({ user })
        .select("productname availableproductqty")
        .sort({ availableproductqty: -1, _id: 1 })
        .limit(CHART_ITEMS)
        .lean(),

      BillInformation.aggregate([
        { $match: { user } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: RECENT_BILLS },
        {
          $project: {
            id: 1,
            name: 1,
            createdAt: 1,
            totalproductsprice: 1,
            // The line items themselves are never rendered here, only counted.
            productCount: { $size: { $ifNull: ["$products", []] } },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      counts: {
        customer: customerCount,
        product: productCount,
        billInformation: billCount,
      },
      billed: billTotals[0]?.billed || 0,
      stockValue: stockTotals[0]?.value || 0,
      stockUnits: stockTotals[0]?.units || 0,
      lowStockAt: LOW_STOCK_AT,
      lowStockCount,
      lowStock,
      chart: chart.map((product) => ({
        label: product.productname,
        value: product.availableproductqty,
      })),
      recentBills,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
