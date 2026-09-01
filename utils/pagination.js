/*
 * List endpoints hand back one page, never a whole collection. The old routes
 * returned every document, so a dashboard on an account with a few thousand
 * bills shipped megabytes to the browser to render five rows of it.
 */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 500;

/** Regex-escape user input before it reaches a $regex search. */
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `?page` and `?limit`, clamped to something a server can afford to serve. */
const parsePaging = (query = {}) => {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const requested = Math.trunc(Number(query.limit)) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, requested));

  return { page, limit, skip: (page - 1) * limit };
};

/** What the client needs to render a pager. */
const pageMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  pageCount: Math.max(1, Math.ceil(total / limit)),
});

/**
 * A `$or` of case-insensitive matches across `fields`, plus an exact match on
 * the numeric `id` when the term parses as a number. Returns null when there
 * is nothing to search for, so callers can spread it away.
 */
const searchFilter = (term, fields = [], { numericField = "id" } = {}) => {
  const trimmed = String(term || "").trim();
  if (!trimmed) return null;

  const pattern = new RegExp(escapeRegex(trimmed), "i");
  const or = fields.map((field) => ({ [field]: pattern }));

  const asNumber = Number(trimmed);
  if (numericField && Number.isFinite(asNumber)) {
    or.push({ [numericField]: asNumber });
  }

  return or.length ? { $or: or } : null;
};

/**
 * `?sort` / `?dir` against an allowlist. Anything unrecognised falls back,
 * which keeps a hand-written query string from sorting on an unindexed field.
 * `_id` is appended as a tiebreaker so paging never repeats or skips a row.
 */
const parseSort = (query = {}, allowed = [], fallback = { updatedAt: -1 }) => {
  const key = String(query.sort || "");
  const direction = String(query.dir || "").toLowerCase() === "asc" ? 1 : -1;

  if (allowed.includes(key)) return { [key]: direction, _id: direction };
  return { ...fallback, _id: -1 };
};

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  escapeRegex,
  parsePaging,
  pageMeta,
  searchFilter,
  parseSort,
};
