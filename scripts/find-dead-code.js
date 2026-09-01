/*
 * Reports exports that nothing imports.
 *
 *   npm run deadcode
 *
 * ESLint already catches an unused binding *inside* a file. What it cannot see
 * is a function that is exported, correct, tested — and called by nobody. That
 * is the shape dead code usually takes here: a helper written for a caller
 * that was never built, or one that outlived the code that used it.
 *
 * This is a report, not a gate. It matches on names rather than parsing, so a
 * short or common name can hide behind an unrelated word elsewhere, and it
 * cannot know that something is only reachable by hand. Read what it says and
 * decide; do not wire it into CI.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".github",
  ".vercel",
  "backups",
  "coverage",
  "views",
]);

/** Things nothing is supposed to import: entry points, tests, migrations. */
const ENTRY_POINTS = [
  /^app\.js$/,
  /^bin[\\/]/,
  /^eslint\.config\.js$/,
  /^test[\\/]/,
  /^scripts[\\/]/,
];

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
};

const exportedNames = (code) => {
  const names = new Set();
  const block = code.match(/module\.exports\s*=\s*\{([\s\S]*?)\}/);
  if (!block) return names;

  for (const part of block[1].split(",")) {
    const name = part.split(":")[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
  }
  return names;
};

const isTestFile = (relative) =>
  /^(test|test-helpers)[\\/]/.test(relative) ||
  ENTRY_POINTS.some((pattern) => pattern.test(relative));

const files = walk(ROOT);
const sources = new Map(
  files.map((file) => [
    path.relative(ROOT, file),
    fs.readFileSync(file, "utf8"),
  ])
);

const unused = [];
const testOnly = [];

for (const [file, code] of sources) {
  for (const name of exportedNames(code)) {
    const pattern = new RegExp("\\b" + name + "\\b");
    let inProduction = false;
    let inTests = false;

    for (const [other, otherCode] of sources) {
      if (other === file || !pattern.test(otherCode)) continue;
      if (/^(test|test-helpers)[\\/]/.test(other)) inTests = true;
      else inProduction = true;
    }

    if (!inProduction && !inTests) unused.push(`${file} -> ${name}`);
    else if (!inProduction && !isTestFile(file)) {
      testOnly.push(`${file} -> ${name}`);
    }
  }
}

const report = (title, rows, note) => {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log("  none");
    return;
  }
  rows.forEach((row) => console.log(`  ${row}`));
  if (note) console.log(`\n  ${note}`);
};

report("Exported, imported nowhere", unused, "Usually safe to stop exporting.");
report(
  "Exported, and only tests import it",
  testOnly,
  "Fine when the export is the unit under test. Suspicious otherwise."
);

console.log(`\nScanned ${sources.size} files.`);
