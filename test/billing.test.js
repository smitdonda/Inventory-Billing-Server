const test = require("node:test");
const assert = require("node:assert/strict");

const {
  round2,
  priceLine,
  priceBill,
  stockDelta,
} = require("../utils/billing");

/* ------------------------------------------------------------------ */
/*  round2                                                             */
/* ------------------------------------------------------------------ */

test("round2 keeps two decimals and kills float drift", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(7350), 7350);
  assert.equal(round2(2.675), 2.68);
});

/* ------------------------------------------------------------------ */
/*  priceLine                                                          */
/* ------------------------------------------------------------------ */

test("priceLine applies each slab to the pre-tax subtotal", () => {
  const line = priceLine({
    productname: "Rolex",
    unitprice: 1000,
    quantity: 7,
    gst: [
      { title: "S GST 2.5%", value: 2.5 },
      { title: "C GST 2.5%", value: 2.5 },
    ],
  });

  assert.equal(line.pandqtotal, 7000);
  assert.deepEqual(
    line.gst.map((slab) => slab.taxAmount),
    [175, 175]
  );
  // Both slabs charge on the subtotal, never on each other.
  assert.equal(line.gsttex, 7350);
});

test("priceLine treats a line with no tax slabs as tax free", () => {
  const line = priceLine({ productname: "Bag", unitprice: 500, quantity: 2 });
  assert.equal(line.pandqtotal, 1000);
  assert.equal(line.gsttex, 1000);
  assert.deepEqual(line.gst, []);
});

test("priceLine floors negatives and truncates fractional quantities", () => {
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

test("priceLine ignores a client-supplied total", () => {
  const line = priceLine({
    productname: "Rolex",
    unitprice: 100,
    quantity: 1,
    gsttex: 999999,
    pandqtotal: 999999,
  });

  assert.equal(line.pandqtotal, 100);
  assert.equal(line.gsttex, 100);
});

test("priceLine drops a productId that is not a valid ObjectId", () => {
  const line = priceLine({
    productId: "not-an-id",
    productname: "Rolex",
    unitprice: 10,
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
        unitprice: 1000,
        quantity: 7,
        gst: [
          { title: "S GST 2.5%", value: 2.5 },
          { title: "C GST 2.5%", value: 2.5 },
        ],
      },
      {
        productname: "Bag",
        unitprice: 500,
        quantity: 2,
        gst: [{ title: "S GST 9%", value: 9 }],
      },
    ],
  });

  assert.equal(products.length, 2);
  assert.equal(totalproductsprice, 7350 + 1090);
});

test("priceBill discards lines with no quantity or no name", () => {
  const { products, totalproductsprice } = priceBill({
    products: [
      { productname: "Ghost", unitprice: 10, quantity: 0 },
      { productname: "", unitprice: 10, quantity: 5 },
      { productname: "Real", unitprice: 10, quantity: 5 },
    ],
  });

  assert.deepEqual(
    products.map((line) => line.productname),
    ["Real"]
  );
  assert.equal(totalproductsprice, 50);
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
