const LoginAttempt = require("../models/loginAttempt");

const WINDOW_MS = 15 * 60 * 1000;

/*
 * Two independent budgets, because they stop different attacks:
 *
 *  - per email  — someone guessing one account's password. Tight.
 *  - per IP     — someone spraying one password across many accounts. Looser,
 *                 since a shop behind one NAT is many staff on one address.
 */
const LIMITS = { email: 5, ip: 20 };

/**
 * The caller's address. Vercel sets `x-real-ip` itself at the edge, so prefer
 * it; `x-forwarded-for` is a client-supplied header everywhere else and only
 * its first entry is worth reading.
 */
const clientIp = (req) => {
  const real = req.headers["x-real-ip"];
  if (real) return String(real).trim();

  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();

  return req.ip || req.socket?.remoteAddress || "unknown";
};

/** The keys one login request spends budget against. */
const keysFor = (req, email) => {
  const keys = [{ key: `ip:${clientIp(req)}`, limit: LIMITS.ip }];
  if (email) keys.unshift({ key: `email:${email}`, limit: LIMITS.email });
  return keys;
};

/**
 * Whether this request may attempt a login at all.
 * Returns `{ blocked, retryAfter }` — seconds until the tightest window ends.
 */
const checkLimit = async (keys) => {
  const now = new Date();
  const records = await LoginAttempt.find({
    key: { $in: keys.map((k) => k.key) },
    expiresAt: { $gt: now },
  }).lean();

  const byKey = new Map(records.map((record) => [record.key, record]));

  let retryAfter = 0;
  for (const { key, limit } of keys) {
    const record = byKey.get(key);
    if (record && record.attempts >= limit) {
      const seconds = Math.ceil((record.expiresAt - now) / 1000);
      retryAfter = Math.max(retryAfter, seconds);
    }
  }

  return { blocked: retryAfter > 0, retryAfter };
};

/** Charge one failure to every key, opening a fresh window where none is live. */
const recordFailure = async (keys) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);

  await Promise.all(
    keys.map(async ({ key }) => {
      // A window already running: add to it, keeping its original end time so
      // failures cannot extend the lockout indefinitely.
      const live = await LoginAttempt.findOneAndUpdate(
        { key, expiresAt: { $gt: now } },
        { $inc: { attempts: 1 } }
      );
      if (live) return;

      // No live window — start one. Overwrites any expired document still
      // waiting on the TTL sweep.
      await LoginAttempt.findOneAndUpdate(
        { key },
        { $set: { attempts: 1, expiresAt } },
        { upsert: true }
      );
    })
  );
};

/** A correct password wipes the slate for that email and address. */
const clearAttempts = async (keys) => {
  await LoginAttempt.deleteMany({ key: { $in: keys.map((k) => k.key) } });
};

module.exports = {
  keysFor,
  checkLimit,
  recordFailure,
  clearAttempts,
};
