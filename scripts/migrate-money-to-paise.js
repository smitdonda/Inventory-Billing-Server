/*
 * Converts every stored money value from floating-point rupees to a whole
 * number of paise.
 *
 *   npm run migrate:money
 *
 * Take a backup first. This rewrites amounts in place, and running it twice
 * would multiply every price by a hundred again — which is why it records
 * itself in the `migrations` collection and refuses a second run.
 *
 * The arithmetic happens inside MongoDB as a pipeline update, so nothing has
 * to be pulled into this process and no document is read-modify-written while
 * the app might be touching it. $round returns a double holding an integral
 * value, which is exactly what the schema validators accept.
 */
const { run } = require("./_lib");

const Product = require("../models/products");
const BillInfo = require("../models/BilIInfo");

/** rupees -> paise, rounded to the nearest whole paisa. */
const toPaise = (field) => ({
  $round: [{ $multiply: [{ $ifNull: [field, 0] }, 100] }, 0],
});

run("2026-09-money-to-paise", async () => {
  const products = await Product.collection.updateMany({}, [
    { $set: { unitprice: toPaise("$unitprice") } },
  ]);

  const bills = await BillInfo.collection.updateMany({}, [
    {
      $set: {
        totalproductsprice: toPaise("$totalproductsprice"),
        products: {
          $map: {
            input: { $ifNull: ["$products", []] },
            as: "line",
            in: {
              $mergeObjects: [
                "$$line",
                {
                  unitprice: toPaise("$$line.unitprice"),
                  pandqtotal: toPaise("$$line.pandqtotal"),
                  gsttex: toPaise("$$line.gsttex"),
                  gst: {
                    $map: {
                      input: { $ifNull: ["$$line.gst", []] },
                      as: "slab",
                      in: {
                        $mergeObjects: [
                          "$$slab",
                          { taxAmount: toPaise("$$slab.taxAmount") },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  ]);

  return {
    products: products.modifiedCount,
    bills: bills.modifiedCount,
  };
});
