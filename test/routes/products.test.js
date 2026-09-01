const test = require("node:test");
const assert = require("node:assert/strict");

const {
  startTestApp,
  stopTestApp,
  clearDatabase,
  signIn,
  createProduct,
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
  agent = await signIn(app, "shop@example.com", { username: "shop" });
});

/* ------------------------------------------------------------------ */
/*  create, update, delete                                             */
/* ------------------------------------------------------------------ */

test("a product round-trips through create, list, update and delete", async () => {
  const created = await createProduct(agent, {
    productname: "Copier Paper",
    availableproductqty: 40,
    unitprice: 29900, // Rs 299.00
  });

  assert.equal(created.id, 1);
  assert.equal(created.unitprice, 29900);

  const listed = await agent.get("/products").expect(200);
  assert.equal(listed.body.products[0].productname, "Copier Paper");

  const updated = await agent
    .put(`/products/${created._id}`)
    .send({ unitprice: 31000 })
    .expect(200);
  assert.equal(updated.body.product.unitprice, 31000);
  assert.equal(updated.body.product.productname, "Copier Paper");

  await agent.delete(`/products/${created._id}`).expect(200);
  await agent.delete(`/products/${created._id}`).expect(404);

  const empty = await agent.get("/products").expect(200);
  assert.equal(empty.body.meta.total, 0);
});

test("a product needs a name", async () => {
  const res = await agent
    .post("/products")
    .send({ availableproductqty: 1, unitprice: 100 })
    .expect(422);
  assert.match(res.body.message, /name is required/i);
});

test("negative quantities and prices are refused", async () => {
  for (const body of [
    { productname: "Bad", availableproductqty: -1, unitprice: 100 },
    { productname: "Bad", availableproductqty: 1, unitprice: -100 },
    { productname: "Bad", availableproductqty: 1, unitprice: "nonsense" },
  ]) {
    const res = await agent.post("/products").send(body).expect(422);
    assert.match(res.body.message, /zero or more/i);
  }
});

test("a malformed id is a 422 and an unknown one a 404", async () => {
  await agent
    .put("/products/not-an-object-id")
    .send({ unitprice: 1 })
    .expect(422);
  await agent.delete("/products/not-an-object-id").expect(422);
  await agent
    .put("/products/000000000000000000000000")
    .send({ unitprice: 1 })
    .expect(404);
});

/* ------------------------------------------------------------------ */
/*  money                                                              */
/* ------------------------------------------------------------------ */

test("prices are stored as whole paise, fractions truncated not rounded up", async () => {
  const created = await createProduct(agent, { unitprice: 100.9 });
  assert.equal(created.unitprice, 100);
  assert.ok(Number.isInteger(created.unitprice));
});

test("a fractional quantity is truncated to whole units", async () => {
  const created = await createProduct(agent, { availableproductqty: 7.8 });
  assert.equal(created.availableproductqty, 7);
});

/* ------------------------------------------------------------------ */
/*  paging                                                             */
/* ------------------------------------------------------------------ */

/** Twelve products, priced 100, 200 ... 1200 paise. */
async function seedTwelve() {
  for (let n = 1; n <= 12; n += 1) {
    await createProduct(agent, {
      productname: `Item ${String(n).padStart(2, "0")}`,
      availableproductqty: n,
      unitprice: n * 100,
    });
  }
}

test("a list is one page, with the counts needed to draw a pager", async () => {
  await seedTwelve();

  const first = await agent.get("/products").query({ limit: 5 }).expect(200);
  assert.equal(first.body.products.length, 5);
  assert.deepEqual(
    {
      total: first.body.meta.total,
      pageCount: first.body.meta.pageCount,
      page: first.body.meta.page,
    },
    { total: 12, pageCount: 3, page: 1 }
  );

  const last = await agent
    .get("/products")
    .query({ limit: 5, page: 3 })
    .expect(200);
  assert.equal(last.body.products.length, 2);
});

test("paging through a list yields every row exactly once", async () => {
  await seedTwelve();

  const seen = new Set();
  for (let page = 1; page <= 3; page += 1) {
    const res = await agent
      .get("/products")
      .query({ limit: 5, page })
      .expect(200);
    res.body.products.forEach((p) => seen.add(p._id));
  }

  assert.equal(seen.size, 12, "a row was repeated or skipped across pages");
});

test("a page past the end is empty rather than an error", async () => {
  await seedTwelve();
  const res = await agent
    .get("/products")
    .query({ limit: 5, page: 99 })
    .expect(200);
  assert.deepEqual(res.body.products, []);
  assert.equal(res.body.meta.total, 12);
});

test("limit is clamped so one request cannot ask for the whole database", async () => {
  await seedTwelve();
  const res = await agent.get("/products").query({ limit: 100000 }).expect(200);
  assert.equal(res.body.meta.limit, 500);
});

/* ------------------------------------------------------------------ */
/*  search and sort                                                    */
/* ------------------------------------------------------------------ */

test("search matches the name, case-insensitively", async () => {
  await createProduct(agent, { productname: "Blue Folder" });
  await createProduct(agent, { productname: "Red Binder" });

  const res = await agent
    .get("/products")
    .query({ search: "blue" })
    .expect(200);
  assert.equal(res.body.meta.total, 1);
  assert.equal(res.body.products[0].productname, "Blue Folder");
});

test("search also matches the catalogue number", async () => {
  await createProduct(agent, { productname: "First" });
  const second = await createProduct(agent, { productname: "Second" });

  const res = await agent
    .get("/products")
    .query({ search: String(second.id) })
    .expect(200);
  assert.equal(
    res.body.products.some((p) => p.id === second.id),
    true
  );
});

test("a search term full of regex punctuation is treated as text", async () => {
  await createProduct(agent, { productname: "Plain" });

  // Unescaped, ".*" would match everything.
  const res = await agent.get("/products").query({ search: ".*" }).expect(200);
  assert.equal(res.body.meta.total, 0);
});

test("sorting works on an allowed column in both directions", async () => {
  await seedTwelve();

  const asc = await agent
    .get("/products")
    .query({ sort: "unitprice", dir: "asc", limit: 3 })
    .expect(200);
  assert.deepEqual(
    asc.body.products.map((p) => p.unitprice),
    [100, 200, 300]
  );

  const desc = await agent
    .get("/products")
    .query({ sort: "unitprice", dir: "desc", limit: 3 })
    .expect(200);
  assert.deepEqual(
    desc.body.products.map((p) => p.unitprice),
    [1200, 1100, 1000]
  );
});

test("a column that is not on the allowlist falls back instead of erroring", async () => {
  await seedTwelve();
  const res = await agent
    .get("/products")
    .query({ sort: "user", dir: "asc", limit: 3 })
    .expect(200);
  assert.equal(res.body.products.length, 3);
});

/* ------------------------------------------------------------------ */
/*  totals                                                             */
/* ------------------------------------------------------------------ */

test("stock totals cover the whole catalogue, not the page on screen", async () => {
  await seedTwelve();

  // 1*100 + 2*200 + ... + 12*1200 = 100 * (1+4+9+...+144) = 100 * 650
  const expectedValue = 650 * 100;
  const expectedUnits = 78; // 1..12

  const res = await agent.get("/products").query({ limit: 2 }).expect(200);
  assert.equal(res.body.products.length, 2);
  assert.equal(res.body.meta.stockUnits, expectedUnits);
  assert.equal(res.body.meta.stockValue, expectedValue);
});

test("stock totals follow the active search", async () => {
  await createProduct(agent, {
    productname: "Counted",
    availableproductqty: 3,
    unitprice: 1000,
  });
  await createProduct(agent, {
    productname: "Ignored",
    availableproductqty: 9,
    unitprice: 5000,
  });

  const res = await agent
    .get("/products")
    .query({ search: "Counted" })
    .expect(200);
  assert.equal(res.body.meta.stockUnits, 3);
  assert.equal(res.body.meta.stockValue, 3000);
});

test("an empty catalogue reports zeros, not nulls", async () => {
  const res = await agent.get("/products").expect(200);
  assert.equal(res.body.meta.total, 0);
  assert.equal(res.body.meta.stockUnits, 0);
  assert.equal(res.body.meta.stockValue, 0);
  assert.equal(res.body.meta.pageCount, 1);
});
