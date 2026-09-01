const test = require("node:test");
const assert = require("node:assert/strict");

const {
  startTestApp,
  stopTestApp,
  clearDatabase,
  signIn,
  createProduct,
  lineFor,
  stockOf,
} = require("../../test-helpers/app");

let app;
let agent;

test.before(async () => {
  app = await startTestApp();
});
test.after(async () => {
  await stopTestApp();
});
test.beforeEach(async () => {
  await clearDatabase();
  agent = await signIn(app, "biller@example.com", { username: "biller" });
});

const CUSTOMER = {
  name: "Acme Traders",
  email: "billing@acme.example",
  phoneNo: "9876543210",
  gstNo: "24AAAAA0000A1Z5",
};

const postBill = (products, extra = {}) =>
  agent.post("/billInformation").send({ ...CUSTOMER, ...extra, products });

/* ------------------------------------------------------------------ */
/*  pricing                                                            */
/* ------------------------------------------------------------------ */

test("the server prices the bill and ignores the totals the client sent", async () => {
  const product = await createProduct(agent, {
    unitprice: 100000, // Rs 1,000.00
    availableproductqty: 50,
  });

  const res = await postBill(
    [
      {
        ...lineFor(product, 7, [
          { title: "S GST 2.5%", value: 2.5 },
          { title: "C GST 2.5%", value: 2.5 },
        ]),
        // A client that could name its own total could bill anything it liked.
        pandqtotal: 1,
        gsttex: 1,
      },
    ],
    { totalproductsprice: 1 }
  ).expect(201);

  const [line] = res.body.billinfo.products;
  assert.equal(line.pandqtotal, 700000); // Rs 7,000.00
  assert.deepEqual(
    line.gst.map((slab) => slab.taxAmount),
    [17500, 17500]
  );
  assert.equal(line.gsttex, 735000); // Rs 7,350.00
  assert.equal(res.body.billinfo.totalproductsprice, 735000);
});

test("every stored amount on a bill is a whole number of paise", async () => {
  const product = await createProduct(agent, {
    unitprice: 333,
    availableproductqty: 10,
  });

  const res = await postBill([
    lineFor(product, 3, [{ title: "S GST 9%", value: 9 }]),
  ]).expect(201);

  const [line] = res.body.billinfo.products;
  assert.equal(line.pandqtotal, 999);
  assert.equal(line.gst[0].taxAmount, 90); // 89.91 rounded to the paisa
  assert.equal(line.gsttex, 1089);

  for (const value of [
    line.unitprice,
    line.pandqtotal,
    line.gsttex,
    res.body.billinfo.totalproductsprice,
  ]) {
    assert.ok(Number.isInteger(value), `${value} is not whole paise`);
  }
});

test("a bill needs at least one usable line", async () => {
  const product = await createProduct(agent);

  await postBill([]).expect(422);
  // Zero quantity and a nameless line are both dropped, leaving nothing.
  await postBill([{ ...lineFor(product, 0) }]).expect(422);
  await postBill([{ ...lineFor(product, 1), productname: "" }]).expect(422);
});

/* ------------------------------------------------------------------ */
/*  stock movement                                                     */
/* ------------------------------------------------------------------ */

test("creating a bill takes its units off the shelf", async () => {
  const product = await createProduct(agent, { availableproductqty: 20 });

  await postBill([lineFor(product, 6)]).expect(201);

  assert.equal(await stockOf(agent, product._id), 14);
});

test("editing a bill moves stock by the difference, not the whole quantity", async () => {
  /*
   * The bug this replaces: saving an edit decremented the full quantity again,
   * so opening a bill and pressing save twice drained the shelf twice.
   */
  const product = await createProduct(agent, { availableproductqty: 20 });

  const bill = (await postBill([lineFor(product, 3)]).expect(201)).body
    .billinfo;
  assert.equal(await stockOf(agent, product._id), 17);

  // Raised to 5: take 2 more, not 5.
  await agent
    .put(`/billInformation/${bill._id}`)
    .send({ ...CUSTOMER, products: [lineFor(product, 5)] })
    .expect(200);
  assert.equal(await stockOf(agent, product._id), 15);

  // Lowered to 1: give 4 back.
  await agent
    .put(`/billInformation/${bill._id}`)
    .send({ ...CUSTOMER, products: [lineFor(product, 1)] })
    .expect(200);
  assert.equal(await stockOf(agent, product._id), 19);

  // Saved again unchanged: nothing moves.
  await agent
    .put(`/billInformation/${bill._id}`)
    .send({ ...CUSTOMER, products: [lineFor(product, 1)] })
    .expect(200);
  assert.equal(await stockOf(agent, product._id), 19);
});

test("taking a product off a bill returns its units", async () => {
  const kept = await createProduct(agent, {
    productname: "Kept",
    availableproductqty: 10,
  });
  const dropped = await createProduct(agent, {
    productname: "Dropped",
    availableproductqty: 10,
  });

  const bill = (
    await postBill([lineFor(kept, 2), lineFor(dropped, 4)]).expect(201)
  ).body.billinfo;

  assert.equal(await stockOf(agent, dropped._id), 6);

  await agent
    .put(`/billInformation/${bill._id}`)
    .send({ ...CUSTOMER, products: [lineFor(kept, 2)] })
    .expect(200);

  assert.equal(await stockOf(agent, dropped._id), 10);
  assert.equal(await stockOf(agent, kept._id), 8);
});

test("deleting a bill puts everything it took back", async () => {
  const a = await createProduct(agent, {
    productname: "A",
    availableproductqty: 10,
  });
  const b = await createProduct(agent, {
    productname: "B",
    availableproductqty: 10,
  });

  const bill = (await postBill([lineFor(a, 3), lineFor(b, 2)]).expect(201)).body
    .billinfo;

  await agent.delete(`/billInformation/${bill._id}`).expect(200);

  assert.equal(await stockOf(agent, a._id), 10);
  assert.equal(await stockOf(agent, b._id), 10);
});

/* ------------------------------------------------------------------ */
/*  running out                                                        */
/* ------------------------------------------------------------------ */

test("a bill for more than there is, is refused and creates nothing", async () => {
  const product = await createProduct(agent, {
    productname: "Scarce",
    availableproductqty: 4,
  });

  const res = await postBill([lineFor(product, 5)]).expect(409);
  assert.match(res.body.message, /not enough stock/i);
  assert.match(res.body.message, /Scarce/);

  assert.equal(await stockOf(agent, product._id), 4);
  const bills = await agent.get("/billInformation").expect(200);
  assert.equal(bills.body.meta.total, 0);
});

test("a line that runs short hands back the stock the earlier lines took", async () => {
  const plenty = await createProduct(agent, {
    productname: "Plenty",
    availableproductqty: 20,
  });
  const scarce = await createProduct(agent, {
    productname: "Scarce",
    availableproductqty: 1,
  });

  await postBill([lineFor(plenty, 5), lineFor(scarce, 3)]).expect(409);

  // Without the compensation, Plenty would sit at 15 with no bill to show for it.
  assert.equal(await stockOf(agent, plenty._id), 20);
  assert.equal(await stockOf(agent, scarce._id), 1);
});

test("a failed edit leaves stock where it was", async () => {
  const product = await createProduct(agent, { availableproductqty: 10 });
  const bill = (await postBill([lineFor(product, 2)]).expect(201)).body
    .billinfo;
  assert.equal(await stockOf(agent, product._id), 8);

  await agent
    .put(`/billInformation/${bill._id}`)
    .send({ ...CUSTOMER, products: [lineFor(product, 50)] })
    .expect(409);

  assert.equal(await stockOf(agent, product._id), 8);

  const unchanged = await agent.get(`/billInformation/${bill._id}`).expect(200);
  assert.equal(unchanged.body.bill.products[0].quantity, 2);
});

/* ------------------------------------------------------------------ */
/*  listing                                                            */
/* ------------------------------------------------------------------ */

test("the billed total is summed over every matching bill, not the page", async () => {
  const product = await createProduct(agent, {
    unitprice: 1000,
    availableproductqty: 100,
  });

  for (let n = 0; n < 5; n += 1) {
    await postBill([lineFor(product, 1, [])]).expect(201); // 1000 paise each, no tax
  }

  const res = await agent
    .get("/billInformation")
    .query({ limit: 2 })
    .expect(200);
  assert.equal(res.body.billinfo.length, 2);
  assert.equal(res.body.meta.total, 5);
  assert.equal(res.body.meta.totalBilled, 5000);
});

test("bills can be searched by the products on them", async () => {
  const paper = await createProduct(agent, {
    productname: "Copier Paper",
    availableproductqty: 10,
  });
  const pens = await createProduct(agent, {
    productname: "Gel Pens",
    availableproductqty: 10,
  });

  await postBill([lineFor(paper, 1)], { name: "One" }).expect(201);
  await postBill([lineFor(pens, 1)], { name: "Two" }).expect(201);

  const res = await agent
    .get("/billInformation")
    .query({ search: "Gel Pens" })
    .expect(200);
  assert.equal(res.body.meta.total, 1);
  assert.equal(res.body.billinfo[0].name, "Two");
});

test("bills come back newest first by default", async () => {
  const product = await createProduct(agent, { availableproductqty: 100 });

  await postBill([lineFor(product, 1)], { name: "Older" }).expect(201);
  await postBill([lineFor(product, 1)], { name: "Newer" }).expect(201);

  const res = await agent.get("/billInformation").expect(200);
  assert.equal(res.body.billinfo[0].name, "Newer");
});

/* ------------------------------------------------------------------ */
/*  dashboard                                                          */
/* ------------------------------------------------------------------ */

test("the dashboard summary answers with sums the browser used to compute", async () => {
  const stocked = await createProduct(agent, {
    productname: "Stocked",
    availableproductqty: 10,
    unitprice: 2000,
  });
  const low = await createProduct(agent, {
    productname: "Nearly Out",
    availableproductqty: 2,
    unitprice: 5000,
  });

  await agent.post("/customers").send({ name: "A Customer" }).expect(201);
  await postBill([lineFor(stocked, 1, [])]).expect(201); // 2000 paise

  const res = await agent.get("/dashboard/summary").expect(200);

  assert.deepEqual(res.body.counts, {
    customer: 1,
    product: 2,
    billInformation: 1,
  });
  assert.equal(res.body.billed, 2000);
  // 9 left at 2000 after the bill, plus 2 at 5000.
  assert.equal(res.body.stockValue, 9 * 2000 + 2 * 5000);

  assert.equal(res.body.lowStockCount, 1);
  assert.equal(res.body.lowStock[0].productname, "Nearly Out");
  assert.equal(res.body.lowStock[0]._id, low._id);

  assert.equal(res.body.recentBills.length, 1);
  assert.equal(res.body.recentBills[0].productCount, 1);
  assert.equal(res.body.recentBills[0].totalproductsprice, 2000);

  assert.deepEqual(
    res.body.chart.map((row) => row.label),
    ["Stocked", "Nearly Out"]
  );
});

test("the dashboard chart is capped, so it stays one screenful", async () => {
  for (let n = 1; n <= 12; n += 1) {
    await createProduct(agent, {
      productname: `P${n}`,
      availableproductqty: n,
    });
  }

  const res = await agent.get("/dashboard/summary").expect(200);
  assert.equal(res.body.chart.length, 8);
  assert.equal(
    res.body.chart[0].value,
    12,
    "the chart should lead with the fullest shelf"
  );
});

test("an account with nothing in it gets zeros rather than errors", async () => {
  const res = await agent.get("/dashboard/summary").expect(200);
  assert.equal(res.body.billed, 0);
  assert.equal(res.body.stockValue, 0);
  assert.equal(res.body.lowStockCount, 0);
  assert.deepEqual(res.body.lowStock, []);
  assert.deepEqual(res.body.recentBills, []);
});
