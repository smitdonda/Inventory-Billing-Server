/*
 * Every money value in this system is an integer number of paise.
 *
 * The reason is that a bill is a sum. Floating point rupees survive one
 * multiplication and lose the argument at the twentieth: 0.1 + 0.2 is not 0.3,
 * and rounding each line to two decimals only hides where the drift starts.
 * Whole paise are exact under addition and under multiplication by a quantity,
 * which is all the arithmetic a bill actually does.
 *
 * Rupees exist only at the two edges: what a person types in, and what a
 * person reads back.
 */

/** A valid stored amount: a whole, finite, non-negative number of paise. */
const isPaise = (value) => Number.isInteger(value) && value >= 0;

/** Coerce whatever a client sent into a safe paise amount. */
const toPaise = (value) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/*
 * Converting between rupees and paise happens at the two edges, and neither
 * of them is here: the browser does it in Components/ui/format.js when someone
 * types a price or reads one, and the money migration does it inside MongoDB
 * as a pipeline. This module never needed a rupee.
 */

/** A percentage of an amount, rounded to the nearest whole paisa. */
const percentOf = (amountPaise, percent) => {
  const pct = Number(percent);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.round((amountPaise * pct) / 100);
};

module.exports = { isPaise, toPaise, percentOf };
