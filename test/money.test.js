const test = require("node:test");
const assert = require("node:assert/strict");

const { isPaise, toPaise, percentOf } = require("../utils/money");

test("isPaise accepts whole non-negative amounts only", () => {
  assert.equal(isPaise(0), true);
  assert.equal(isPaise(735000), true);
  assert.equal(isPaise(1.5), false);
  assert.equal(isPaise(-1), false);
  assert.equal(isPaise(NaN), false);
  assert.equal(isPaise("100"), false);
});

test("toPaise truncates anything a client might send", () => {
  assert.equal(toPaise(100), 100);
  assert.equal(toPaise("250"), 250);
  assert.equal(toPaise(100.9), 100);
  assert.equal(toPaise(-50), 0);
  assert.equal(toPaise("nonsense"), 0);
  assert.equal(toPaise(undefined), 0);
  assert.equal(toPaise(Infinity), 0);
});

test("percentOf rounds to a whole paisa and refuses nonsense rates", () => {
  assert.equal(percentOf(700000, 2.5), 17500);
  assert.equal(percentOf(333, 9), 30); // 29.97 -> 30
  assert.equal(percentOf(100000, 0), 0);
  assert.equal(percentOf(100000, -9), 0);
  assert.equal(percentOf(100000, "nope"), 0);
});
