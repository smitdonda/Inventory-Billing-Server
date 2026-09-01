const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const {
  startTestApp,
  stopTestApp,
  clearDatabase,
  signIn,
  DEFAULT_PASSWORD,
} = require("../../test-helpers/app");

let app;

test.before(async () => {
  app = await startTestApp();
});
test.after(async () => {
  await stopTestApp();
});
test.beforeEach(async () => {
  await clearDatabase();
});

/* ------------------------------------------------------------------ */
/*  health                                                             */
/* ------------------------------------------------------------------ */

test("healthz reports the database it is actually connected to", async () => {
  const res = await request(app).get("/healthz").expect(200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.db, "connected");
});

/* ------------------------------------------------------------------ */
/*  signup                                                             */
/* ------------------------------------------------------------------ */

test("signup creates an account", async () => {
  const res = await request(app)
    .post("/signup")
    .send({
      email: "New@Example.com",
      username: "new",
      password: DEFAULT_PASSWORD,
    })
    .expect(201);

  assert.equal(res.body.success, true);
});

test("signup rejects a malformed email, a short password and a missing name", async () => {
  const cases = [
    [
      { email: "not-an-email", username: "x", password: DEFAULT_PASSWORD },
      /valid email/i,
    ],
    [{ email: "a@b.com", username: "x", password: "short" }, /8 characters/i],
    [
      { email: "a@b.com", username: "  ", password: DEFAULT_PASSWORD },
      /username/i,
    ],
  ];

  for (const [body, message] of cases) {
    const res = await request(app).post("/signup").send(body).expect(422);
    assert.match(res.body.message, message);
  }
});

test("signup refuses an address that already has an account, whatever its case", async () => {
  await request(app)
    .post("/signup")
    .send({
      email: "dup@example.com",
      username: "one",
      password: DEFAULT_PASSWORD,
    })
    .expect(201);

  const res = await request(app)
    .post("/signup")
    .send({
      email: "DUP@Example.com",
      username: "two",
      password: DEFAULT_PASSWORD,
    })
    .expect(422);

  assert.match(res.body.message, /already exists/i);
});

test("signup never returns the password hash", async () => {
  const res = await request(app)
    .post("/signup")
    .send({
      email: "quiet@example.com",
      username: "q",
      password: DEFAULT_PASSWORD,
    })
    .expect(201);

  assert.equal(JSON.stringify(res.body).includes("$2"), false);
});

/* ------------------------------------------------------------------ */
/*  login                                                              */
/* ------------------------------------------------------------------ */

test("login puts the token in an httpOnly cookie and not in the body", async () => {
  await request(app)
    .post("/signup")
    .send({
      email: "amy@example.com",
      username: "amy",
      password: DEFAULT_PASSWORD,
    })
    .expect(201);

  const res = await request(app)
    .post("/login")
    .send({ email: "amy@example.com", password: DEFAULT_PASSWORD })
    .expect(200);

  // The whole point of the change: nothing on the page can read the session.
  assert.equal(res.body.token, undefined);
  assert.equal(JSON.stringify(res.body).toLowerCase().includes("eyj"), false);
  assert.equal(res.body.user.email, "amy@example.com");

  const cookie = res.headers["set-cookie"].find((c) => c.startsWith("token="));
  assert.ok(cookie, "no token cookie was set");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//);
  // Outside production, over plain http, a Secure cookie would never be stored.
  assert.doesNotMatch(cookie, /Secure/i);
});

test("a wrong password and an unknown address are answered identically", async () => {
  await request(app)
    .post("/signup")
    .send({
      email: "real@example.com",
      username: "real",
      password: DEFAULT_PASSWORD,
    })
    .expect(201);

  const wrongPassword = await request(app)
    .post("/login")
    .send({ email: "real@example.com", password: "WrongPassword1!" })
    .expect(401);

  const noSuchUser = await request(app)
    .post("/login")
    .send({ email: "ghost@example.com", password: DEFAULT_PASSWORD })
    .expect(401);

  // Telling them apart is what lets someone enumerate registered addresses.
  assert.equal(wrongPassword.body.message, noSuchUser.body.message);
  assert.equal(wrongPassword.headers["set-cookie"], undefined);
});

test("repeated failures lock an address out and say for how long", async () => {
  await request(app)
    .post("/signup")
    .send({
      email: "target@example.com",
      username: "t",
      password: DEFAULT_PASSWORD,
    })
    .expect(201);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await request(app)
      .post("/login")
      .send({ email: "target@example.com", password: "Wrong1234!" })
      .expect(401);
  }

  const blocked = await request(app)
    .post("/login")
    .send({ email: "target@example.com", password: "Wrong1234!" })
    .expect(429);

  assert.ok(Number(blocked.headers["retry-after"]) > 0);
  assert.match(blocked.body.message, /too many/i);

  // Locked out before the password is even compared, so the right one waits too.
  await request(app)
    .post("/login")
    .send({ email: "target@example.com", password: DEFAULT_PASSWORD })
    .expect(429);
});

/* ------------------------------------------------------------------ */
/*  session                                                            */
/* ------------------------------------------------------------------ */

test("me answers 401 without a session and the account with one", async () => {
  await request(app).get("/me").expect(401);

  const agent = await signIn(app, "session@example.com");
  const res = await agent.get("/me").expect(200);

  assert.equal(res.body.user.email, "session@example.com");
  assert.equal(res.body.user.password, undefined);
});

test("logout clears the cookie and the session stops working", async () => {
  const agent = await signIn(app, "bye@example.com");
  await agent.get("/me").expect(200);

  const res = await agent.post("/logout").expect(200);
  const cleared = res.headers["set-cookie"].find((c) => c.startsWith("token="));
  assert.match(cleared, /token=;/);

  await agent.get("/me").expect(401);
});

test("logging out twice is not an error", async () => {
  const agent = await signIn(app, "twice@example.com");
  await agent.post("/logout").expect(200);
  await agent.post("/logout").expect(200);
});

test("a garbled cookie is rejected rather than crashing the request", async () => {
  await request(app)
    .get("/me")
    .set("Cookie", "token=not-a-real-jwt")
    .expect(401);
});

test("business routes refuse an anonymous caller", async () => {
  for (const path of [
    "/products",
    "/customers",
    "/billInformation",
    "/my-profile",
    "/dashboard/summary",
    "/dashboard/count",
  ]) {
    await request(app).get(path).expect(401);
  }
});

/* ------------------------------------------------------------------ */
/*  request shape                                                      */
/* ------------------------------------------------------------------ */

test("an unknown path answers in the same envelope as everything else", async () => {
  const res = await request(app).get("/no-such-route").expect(404);
  assert.deepEqual(res.body, { success: false, message: "URL_NOT_FOUND" });
});

test("a cross-site form post is not parsed, so it cannot ride the cookie", async () => {
  const agent = await signIn(app, "csrf@example.com");

  /*
   * Form-encoded bodies are the shape a cross-site POST can send without a
   * preflight. The app parses JSON only, so the body arrives empty and the
   * write fails validation instead of succeeding on a forged request.
   */
  const res = await agent
    .post("/products")
    .type("form")
    .send({ productname: "Forged", availableproductqty: 1, unitprice: 100 })
    .expect(422);

  assert.match(res.body.message, /name is required/i);

  const list = await agent.get("/products").expect(200);
  assert.equal(list.body.meta.total, 0);
});
