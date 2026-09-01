const mongoose = require("mongoose");

/*
 * On Vercel every warm lambda re-imports this module, and a fresh
 * mongoose.connect() per invocation opens a fresh pool. A few hundred cold
 * starts is enough to exhaust an Atlas connection quota, so the connection —
 * and the in-flight promise for it — is parked on globalThis, which survives
 * module re-evaluation inside one instance.
 */
const cached =
  globalThis.__inventoryMongo__ ||
  (globalThis.__inventoryMongo__ = { conn: null, promise: null });

/** True once the connection is usable. */
const isConnected = () => mongoose.connection.readyState === 1;

/**
 * Resolves once the connection is usable. Concurrent callers share one
 * attempt; a failed attempt is dropped so the next request can retry rather
 * than being stuck behind a rejected promise forever.
 */
const connectMongo = () => {
  if (cached.conn && isConnected()) return Promise.resolve(cached.conn);

  if (!cached.promise) {
    mongoose.set("strictQuery", true);

    cached.promise = mongoose
      .connect(process.env.MONGO_DB_URL, {
        // Fail the request instead of hanging the whole lambda when the
        // cluster is unreachable.
        serverSelectionTimeoutMS: Number(
          process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 8000
        ),
        // Serverless wants many small pools, not a few large ones.
        maxPoolSize: Number(process.env.MONGO_POOL_SIZE || 5),
        minPoolSize: 0,
      })
      .then((connection) => {
        cached.conn = connection;
        return connection;
      })
      .catch((error) => {
        cached.promise = null;
        cached.conn = null;
        throw error;
      });
  }

  return cached.promise;
};

mongoose.connection.on("error", (err) =>
  console.error("MongoDB error:", err.message)
);

// The driver reconnects on its own; the old "disconnected" -> connect()
// listener stacked a fresh connection attempt on every blip.
mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected — driver will retry");
  cached.conn = null;
});

/**
 * Express gate: nothing downstream runs against a database that is not up.
 * Without it a cold request queues on Mongoose's buffer and dies ten seconds
 * later as an opaque 500.
 */
const requireMongo = async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (error) {
    console.error("MongoDB unavailable:", error.message);
    res
      .status(503)
      .json({ success: false, message: "Database unavailable, try again" });
  }
};

module.exports = { connectMongo, requireMongo, isConnected };
