const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isPaise,
  toPaise,
  rupeesToPaise,
  paiseToRupees,
  percentOf,
} = require("../utils/money");

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

test("rupeesToPaise rounds to the nearest paisa", () => {
  assert.equal(rupeesToPaise(1000), 100000);
  assert.equal(rupeesToPaise(1000.5), 100050);
  assert.equal(rupeesToPaise(0.015), 2);
  assert.equal(rupeesToPaise(-5), 0);
  assert.equal(rupeesToPaise(""), 0);
});

test("paise survive the addition that broke floating rupees", () => {
  // 0.1 + 0.2 !== 0.3 in rupees. In paise it is just 10 + 20.
  assert.equal(rupeesToPaise(0.1) + rupeesToPaise(0.2), 30);
  assert.equal(paiseToRupees(30), 0.3);

  // A thousand ten-paisa lines add up to exactly one hundred rupees.
  let total = 0;
  for (let i = 0; i < 1000; i += 1) total += rupeesToPaise(0.1);
  assert.equal(total, 10000);
  assert.equal(paiseToRupees(total), 100);
});

test("percentOf rounds to a whole paisa and refuses nonsense rates", () => {
  assert.equal(percentOf(700000, 2.5), 17500);
  assert.equal(percentOf(333, 9), 30); // 29.97 -> 30
  assert.equal(percentOf(100000, 0), 0);
  assert.equal(percentOf(100000, -9), 0);
  assert.equal(percentOf(100000, "nope"), 0);
});
