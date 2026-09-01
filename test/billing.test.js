const test = require("node:test");
const assert = require("node:assert/strict");

const { priceLine, priceBill, stockDelta } = require("../utils/billing");

/*
 * Every amount in these tests is in paise: ₹1,000.00 is 100000.
 * See utils/money.js for why.
 */

/* ------------------------------------------------------------------ */
/*  priceLine                                                          */
/* ------------------------------------------------------------------ */

test("priceLine applies each slab to the pre-tax subtotal", () => {
  const line = priceLine({
    productname: "Rolex",
    unitprice: 100000, // ₹1,000.00
    quantity: 7,
    gst: [
      { title: "S GST 2.5%", value: 2.5 },
      { title: "C GST 2.5%", value: 2.5 },
    ],
  });

  assert.equal(line.pandqtotal, 700000); // ₹7,000.00
  assert.deepEqual(
    line.gst.map((slab) => slab.taxAmount),
    [17500, 17500]
  );
  // Both slabs charge on the subtotal, never on each other.
  assert.equal(line.gsttex, 735000); // ₹7,350.00
});

test("priceLine keeps every amount a whole number of paise", () => {
  const line = priceLine({
    productname: "Odd lot",
    unitprice: 333,
    quantity: 3,
    gst: [{ title: "S GST 9%", value: 9 }],
  });

  assert.equal(line.pandqtotal, 999);
  assert.equal(line.gst[0].taxAmount, 90); // 89.91 -> 90
  assert.equal(line.gsttex, 1089);

  for (const value of [line.unitprice, line.pandqtotal, line.gsttex]) {
    assert.ok(Number.isInteger(value), `${value} is not whole paise`);
  }
});

test("priceLine treats a line with no tax slabs as tax free", () => {
  const line = priceLine({ productname: "Bag", unitprice: 50000, quantity: 2 });
  assert.equal(line.pandqtotal, 100000);
  assert.equal(line.gsttex, 100000);
  assert.deepEqual(line.gst, []);
});

test("priceLine floors negatives and truncates fractional inputs", () => {
  const line = priceLine({
    productname: "Odd",
    unitprice: -50,
    quantity: 2.9,
    gst: [{ title: "S GST 9%", value: -9 }],
  });

  assert.equal(line.unitprice, 0);
  assert.equal(line.quantity, 2);
  assert.equal(line.gst[0].value, 0);
  assert.equal(line.gsttex, 0);
});

test("priceLine truncates a fractional paisa rather than storing it", () => {
  const line = priceLine({
    productname: "Sliver",
    unitprice: 100.9,
    quantity: 1,
  });
  assert.equal(line.unitprice, 100);
  assert.equal(line.pandqtotal, 100);
});

test("priceLine ignores a client-supplied total", () => {
  const line = priceLine({
    productname: "Rolex",
    unitprice: 10000,
    quantity: 1,
    gsttex: 99999900,
    pandqtotal: 99999900,
  });

  assert.equal(line.pandqtotal, 10000);
  assert.equal(line.gsttex, 10000);
});

test("priceLine drops a productId that is not a valid ObjectId", () => {
  const line = priceLine({
    productId: "not-an-id",
    productname: "Rolex",
    unitprice: 1000,
    quantity: 1,
  });
  assert.equal(line.productId, undefined);
});

/* ------------------------------------------------------------------ */
/*  priceBill                                                          */
/* ------------------------------------------------------------------ */

test("priceBill totals its lines and recomputes the bill total", () => {
  const { products, totalproductsprice } = priceBill({
    totalproductsprice: 1,
    products: [
      {
        productname: "Rolex",
        unitprice: 100000,
        quantity: 7,
        gst: [
          { title: "S GST 2.5%", value: 2.5 },
          { title: "C GST 2.5%", value: 2.5 },
        ],
      },
      {
        productname: "Bag",
        unitprice: 50000,
        quantity: 2,
        gst: [{ title: "S GST 9%", value: 9 }],
      },
    ],
  });

  assert.equal(products.length, 2);
  assert.equal(totalproductsprice, 735000 + 109000);
  assert.ok(Number.isInteger(totalproductsprice));
});

test("priceBill stays exact across many small lines", () => {
  // A hundred lines of ten paise each. In rupees this drifts; in paise it
  // lands on exactly ₹10.00.
  const { totalproductsprice } = priceBill({
    products: Array.from({ length: 100 }, () => ({
      productname: "Sweet",
      unitprice: 10,
      quantity: 1,
    })),
  });

  assert.equal(totalproductsprice, 1000);
});

test("priceBill discards lines with no quantity or no name", () => {
  const { products, totalproductsprice } = priceBill({
    products: [
      { productname: "Ghost", unitprice: 1000, quantity: 0 },
      { productname: "", unitprice: 1000, quantity: 5 },
      { productname: "Real", unitprice: 1000, quantity: 5 },
    ],
  });

  assert.deepEqual(
    products.map((line) => line.productname),
    ["Real"]
  );
  assert.equal(totalproductsprice, 5000);
});

test("priceBill copes with a missing or non-array products field", () => {
  assert.deepEqual(priceBill({}), { products: [], totalproductsprice: 0 });
  assert.deepEqual(priceBill({ products: "nope" }), {
    products: [],
    totalproductsprice: 0,
  });
});

/* ------------------------------------------------------------------ */
/*  stockDelta — the bug that drained stock twice on every edit         */
/* ------------------------------------------------------------------ */

const map = (entries) => new Map(entries);

test("stockDelta on a new bill consumes the full quantity", () => {
  const delta = stockDelta(map([]), map([["a", 3]]));
  assert.deepEqual([...delta], [["a", 3]]);
});

test("stockDelta on an edit moves only the difference", () => {
  // 3 units already reserved, bill raised to 5 -> take 2 more, not 5.
  assert.deepEqual(
    [...stockDelta(map([["a", 3]]), map([["a", 5]]))],
    [["a", 2]]
  );
  // Lowered to 1 -> give 2 back.
  assert.deepEqual(
    [...stockDelta(map([["a", 3]]), map([["a", 1]]))],
    [["a", -2]]
  );
});

test("stockDelta returns nothing for an unchanged line", () => {
  assert.equal(stockDelta(map([["a", 3]]), map([["a", 3]])).size, 0);
});

test("stockDelta releases a product removed from the bill", () => {
  assert.deepEqual([...stockDelta(map([["a", 4]]), map([]))], [["a", -4]]);
});

test("stockDelta handles several products changing at once", () => {
  const delta = stockDelta(
    map([
      ["a", 2],
      ["b", 5],
    ]),
    map([
      ["b", 1],
      ["c", 7],
    ])
  );

  assert.equal(delta.get("a"), -2); // dropped
  assert.equal(delta.get("b"), -4); // reduced
  assert.equal(delta.get("c"), 7); // added
});

test("deleting a bill returns exactly what it took", () => {
  const taken = map([
    ["a", 3],
    ["b", 2],
  ]);
  const onCreate = stockDelta(map([]), taken);
  const onDelete = stockDelta(taken, map([]));

  for (const [id, consumed] of onCreate) {
    assert.equal(consumed + onDelete.get(id), 0);
  }
});
