const test = require("node:test");
const assert = require("node:assert/strict");

const {
  startTestApp,
  stopTestApp,
  clearDatabase,
  signIn,
  createProduct,
  lineFor,
} = require("../../test-helpers/app");

/*
 * Before ownership existed, requireAuth proved that *someone* was signed in
 * and then every route ran find({}). A second account saw, edited and deleted
 * the first account's stock, customers and invoices.
 *
 * This file is the standing proof that it cannot happen again. Each test sets
 * up two accounts and checks that the second one is answered as though the
 * first one's records simply are not there.
 */

let app;
let alice;
let bob;

test.before(async () => {
  app = await startTestApp();
});
test.after(async () => {
  await stopTestApp();
});
test.beforeEach(async () => {
  await clearDatabase();
  alice = await signIn(app, "alice@example.com", { username: "alice" });
  bob = await signIn(app, "bob@example.com", { username: "bob" });
});

/** Everything one account can own, created in one go. */
async function seedAlice() {
  const product = await createProduct(alice, {
    productname: "Alice Widget",
    availableproductqty: 20,
    unitprice: 50000,
  });

  const customer = (
    await alice
      .post("/customers")
      .send({
        name: "Alice Customer",
        email: "cust@example.com",
        phoneNo: "9876543210",
        gstNo: "24AAAAA0000A1Z5",
      })
      .expect(201)
  ).body.data;

  const bill = (
    await alice
      .post("/billInformation")
      .send({
        name: "Alice Customer",
        email: "cust@example.com",
        phoneNo: "9876543210",
        gstNo: "24AAAAA0000A1Z5",
        products: [lineFor(product, 2)],
      })
      .expect(201)
  ).body.billinfo;

  const profile = (
    await alice
      .post("/my-profile")
      .send({ companyname: "Alice Trading", cemail: "hq@alice.example" })
      .expect(201)
  ).body.data;

  return { product, customer, bill, profile };
}

/* ------------------------------------------------------------------ */
/*  reading                                                            */
/* ------------------------------------------------------------------ */

test("one account's lists never contain another's records", async () => {
  await seedAlice();

  for (const [path, key] of [
    ["/products", "products"],
    ["/customers", "customers"],
    ["/billInformation", "billinfo"],
  ]) {
    const mine = await alice.get(path).expect(200);
    assert.equal(mine.body[key].length, 1, `alice should see her own ${key}`);

    const theirs = await bob.get(path).expect(200);
    assert.deepEqual(theirs.body[key], [], `bob must not see alice's ${key}`);
    assert.equal(theirs.body.meta.total, 0);
  }

  const profile = await bob.get("/my-profile").expect(200);
  assert.deepEqual(profile.body.profile, []);
});

test("fetching another account's bill by id is a 404, not a peek", async () => {
  const { bill } = await seedAlice();

  await alice.get(`/billInformation/${bill._id}`).expect(200);
  const res = await bob.get(`/billInformation/${bill._id}`).expect(404);
  assert.match(res.body.message, /not found/i);
});

test("the dashboard counts only what the caller owns", async () => {
  await seedAlice();

  const hers = await alice.get("/dashboard/summary").expect(200);
  assert.equal(hers.body.counts.product, 1);
  assert.equal(hers.body.counts.customer, 1);
  assert.equal(hers.body.counts.billInformation, 1);
  assert.ok(hers.body.billed > 0);
  assert.ok(hers.body.stockValue > 0);

  const his = await bob.get("/dashboard/summary").expect(200);
  assert.deepEqual(his.body.counts, {
    customer: 0,
    product: 0,
    billInformation: 0,
  });
  assert.equal(his.body.billed, 0);
  assert.equal(his.body.stockValue, 0);
  assert.deepEqual(his.body.recentBills, []);
  assert.deepEqual(his.body.chart, []);

  const count = await bob.get("/dashboard/count").expect(200);
  assert.equal(count.body.product, 0);
});

/* ------------------------------------------------------------------ */
/*  writing                                                            */
/* ------------------------------------------------------------------ */

test("another account cannot edit or delete a product", async () => {
  const { product } = await seedAlice();

  await bob
    .put(`/products/${product._id}`)
    .send({ productname: "Stolen", unitprice: 1 })
    .expect(404);

  await bob.delete(`/products/${product._id}`).expect(404);

  const still = await alice.get("/products").expect(200);
  assert.equal(still.body.products.length, 1);
  assert.equal(still.body.products[0].productname, "Alice Widget");
  assert.equal(still.body.products[0].unitprice, 50000);
});

test("another account cannot edit or delete a customer", async () => {
  const { customer } = await seedAlice();

  await bob
    .put(`/customers/${customer._id}`)
    .send({ name: "Stolen" })
    .expect(404);
  await bob.delete(`/customers/${customer._id}`).expect(404);

  const still = await alice.get("/customers").expect(200);
  assert.equal(still.body.customers[0].name, "Alice Customer");
});

test("another account cannot edit or delete a bill", async () => {
  const { bill, product } = await seedAlice();

  await bob
    .put(`/billInformation/${bill._id}`)
    .send({ name: "Stolen", products: [lineFor(product, 1)] })
    .expect(404);

  await bob.delete(`/billInformation/${bill._id}`).expect(404);

  const still = await alice.get(`/billInformation/${bill._id}`).expect(200);
  assert.equal(still.body.bill.name, "Alice Customer");
});

test("another account cannot overwrite the company letterhead", async () => {
  const { profile } = await seedAlice();

  await bob
    .put(`/my-profile/${profile._id}`)
    .send({ companyname: "Stolen Ltd" })
    .expect(404);

  const still = await alice.get("/my-profile").expect(200);
  assert.equal(still.body.profile[0].companyname, "Alice Trading");
});

test("each account gets its own company profile, not a shared one", async () => {
  await seedAlice();

  await bob
    .post("/my-profile")
    .send({ companyname: "Bob Supplies" })
    .expect(201);

  const hers = await alice.get("/my-profile").expect(200);
  const his = await bob.get("/my-profile").expect(200);

  assert.equal(hers.body.profile[0].companyname, "Alice Trading");
  assert.equal(his.body.profile[0].companyname, "Bob Supplies");
});

test("posting the profile twice updates the one document instead of adding another", async () => {
  await alice.post("/my-profile").send({ companyname: "First" }).expect(201);
  await alice.post("/my-profile").send({ companyname: "Second" }).expect(200);

  const res = await alice.get("/my-profile").expect(200);
  assert.equal(res.body.profile.length, 1);
  assert.equal(res.body.profile[0].companyname, "Second");
});

/* ------------------------------------------------------------------ */
/*  stock                                                              */
/* ------------------------------------------------------------------ */

test("a bill cannot consume stock belonging to another account", async () => {
  const { product } = await seedAlice();

  const before = (await alice.get("/products").expect(200)).body.products[0]
    .availableproductqty;

  // A real product id, posted by someone who does not own it.
  const res = await bob
    .post("/billInformation")
    .send({ name: "Bob", products: [lineFor(product, 5)] })
    .expect(409);

  assert.match(res.body.message, /no longer exists/i);

  const after = (await alice.get("/products").expect(200)).body.products[0]
    .availableproductqty;
  assert.equal(after, before, "alice's stock moved for someone else's bill");

  const bills = await bob.get("/billInformation").expect(200);
  assert.equal(bills.body.meta.total, 0, "the bill must not have been created");
});

/* ------------------------------------------------------------------ */
/*  numbering                                                          */
/* ------------------------------------------------------------------ */

test("human-facing ids start at 1 for every account", async () => {
  const hers = await createProduct(alice, { productname: "Hers" });
  const his = await createProduct(bob, { productname: "His" });

  assert.equal(hers.id, 1);
  assert.equal(his.id, 1);

  const second = await createProduct(alice, { productname: "Hers again" });
  assert.equal(second.id, 2);

  // Bob's own sequence is untouched by Alice creating two.
  const hisSecond = await createProduct(bob, { productname: "His again" });
  assert.equal(hisSecond.id, 2);
});

test("bills and customers keep separate sequences from products", async () => {
  await createProduct(alice, { productname: "P" });

  const customer = (
    await alice.post("/customers").send({ name: "C" }).expect(201)
  ).body.data;
  assert.equal(customer.id, 1);

  const product = await createProduct(alice, { productname: "Q" });
  const bill = (
    await alice
      .post("/billInformation")
      .send({ name: "C", products: [lineFor(product, 1)] })
      .expect(201)
  ).body.billinfo;

  assert.equal(bill.id, 1);
});

/* ------------------------------------------------------------------ */
/*  input trust                                                        */
/* ------------------------------------------------------------------ */

test("an owner sent in the request body is ignored", async () => {
  const aliceMe = (await alice.get("/me").expect(200)).body.user;

  // Bob tries to file a product under Alice's account.
  const res = await bob
    .post("/products")
    .send({
      productname: "Planted",
      availableproductqty: 1,
      unitprice: 100,
      user: aliceMe._id,
    })
    .expect(201);

  assert.notEqual(String(res.body.data.user), String(aliceMe._id));

  const hers = await alice.get("/products").expect(200);
  assert.equal(
    hers.body.meta.total,
    0,
    "the product landed in alice's account"
  );
});

test("an id sent in the request body does not override the counter", async () => {
  const res = await alice
    .post("/products")
    .send({
      productname: "Chosen",
      availableproductqty: 1,
      unitprice: 100,
      id: 9999,
    })
    .expect(201);

  assert.equal(res.body.data.id, 1);
});
