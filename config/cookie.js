/*
 * The session cookie is httpOnly, so no script on the page can read the token
 * even if something manages to inject one.
 *
 * SameSite is configurable because it depends on how the app is deployed:
 *
 *  - Same origin (the frontend proxies /api to this server, which is the
 *    recommended setup) -> "lax". First-party, unaffected by third-party
 *    cookie blocking.
 *  - Separate domains (frontend on one vercel.app host, API on another)
 *    -> COOKIE_SAMESITE=none plus COOKIE_SECURE=true. Note that Safari and
 *    Chrome restrict third-party cookies, so that setup can stop working in
 *    browsers the app has no control over. Prefer the proxy.
 */
const TOKEN_COOKIE = "token";

const sameSite = () =>
  (process.env.COOKIE_SAMESITE || "lax").toLowerCase().trim();

const secure = () => {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === "true";
  }
  // SameSite=None is rejected by browsers unless the cookie is also Secure.
  return sameSite() === "none" || process.env.NODE_ENV === "production";
};

const baseOptions = () => ({
  httpOnly: true,
  sameSite: sameSite(),
  secure: secure(),
  path: "/",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

/** Options for setting the session cookie, expiring with the token itself. */
const sessionCookieOptions = (expiresAt) => ({
  ...baseOptions(),
  ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
});

/** Clearing has to repeat the same attributes or the browser keeps the cookie. */
const clearCookieOptions = () => baseOptions();

module.exports = { TOKEN_COOKIE, sessionCookieOptions, clearCookieOptions };
