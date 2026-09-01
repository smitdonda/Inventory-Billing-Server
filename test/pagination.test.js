const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_LIMIT,
  DEFAULT_LIMIT,
  escapeRegex,
  parsePaging,
  pageMeta,
  searchFilter,
  parseSort,
} = require("../utils/pagination");

test("parsePaging defaults to the first page", () => {
  assert.deepEqual(parsePaging({}), {
    page: 1,
    limit: DEFAULT_LIMIT,
    skip: 0,
  });
});

test("parsePaging clamps anything a caller invents", () => {
  assert.equal(parsePaging({ limit: "9999" }).limit, MAX_LIMIT);
  assert.equal(parsePaging({ limit: "0" }).limit, DEFAULT_LIMIT);
  assert.equal(parsePaging({ limit: "-5" }).limit, 1);
  assert.equal(parsePaging({ page: "-3" }).page, 1);
  assert.equal(parsePaging({ page: "nonsense" }).page, 1);
});

test("parsePaging skips whole pages", () => {
  assert.deepEqual(parsePaging({ page: "3", limit: "10" }), {
    page: 3,
    limit: 10,
    skip: 20,
  });
});

test("pageMeta always reports at least one page", () => {
  assert.deepEqual(pageMeta({ page: 1, limit: 10, total: 0 }), {
    page: 1,
    limit: 10,
    total: 0,
    pageCount: 1,
  });
  assert.equal(pageMeta({ page: 1, limit: 10, total: 21 }).pageCount, 3);
});

test("escapeRegex neutralises a search term", () => {
  const term = ".*+?^${}()|[]";
  const pattern = new RegExp(escapeRegex(term));
  assert.ok(pattern.test(term));
  assert.ok(!pattern.test("anything else"));
});

test("searchFilter matches text case-insensitively", () => {
  const filter = searchFilter("acme", ["name", "email"]);
  assert.equal(filter.$or.length, 2);
  assert.ok(filter.$or[0].name.test("ACME Traders"));
});

test("searchFilter also matches the numeric id when the term is a number", () => {
  const filter = searchFilter("12", ["name"]);
  assert.deepEqual(filter.$or.at(-1), { id: 12 });
});

test("searchFilter is null when there is nothing to search for", () => {
  assert.equal(searchFilter("", ["name"]), null);
  assert.equal(searchFilter("   ", ["name"]), null);
  assert.equal(searchFilter(undefined, ["name"]), null);
});

test("parseSort refuses a column that is not on the allowlist", () => {
  assert.deepEqual(parseSort({ sort: "password" }, ["name"]), {
    updatedAt: -1,
    _id: -1,
  });
});

test("parseSort honours an allowed column and direction", () => {
  assert.deepEqual(parseSort({ sort: "name", dir: "asc" }, ["name"]), {
    name: 1,
    _id: 1,
  });
  assert.deepEqual(parseSort({ sort: "name", dir: "desc" }, ["name"]), {
    name: -1,
    _id: -1,
  });
});
