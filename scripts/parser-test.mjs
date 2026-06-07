import assert from "node:assert/strict";
import fs from "node:fs";
import esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  entryPoints: ["src/parser.ts"],
  format: "esm",
  outfile: ".tmp-parser-test.mjs",
  platform: "node",
  target: "node20",
});

const { parseTable } = await import(new URL("../.tmp-parser-test.mjs", import.meta.url));

function readFixture(name) {
  return fs.readFileSync(new URL(`../test-fixtures/${name}`, import.meta.url), "utf8");
}

const simple = parseTable(readFixture("simple.csv"), "csv");
assert.equal(simple.delimiterKind, "comma");
assert.equal(simple.dataRowCount, 3);
assert.equal(simple.columnCount, 3);
assert.equal(simple.rows[1][0], "alpha");

const semicolon = parseTable(readFixture("semicolon.csv"), "csv");
assert.equal(semicolon.delimiterKind, "semicolon");
assert.equal(semicolon.columnCount, 3);

const tsv = parseTable(readFixture("sample.tsv"), "tsv");
assert.equal(tsv.delimiterKind, "tab");
assert.equal(tsv.rows[2][2], "86");

const quoted = parseTable(readFixture("quoted.csv"), "csv");
assert.equal(quoted.rows[1][1], "contains, comma");
assert.equal(quoted.rows[2][1], "contains \"quote\"");
assert.equal(quoted.rows[3][1], "multiline\ncell");

const uneven = parseTable(readFixture("uneven.csv"), "csv");
assert.ok(uneven.warnings.some((warning) => warning.label === "Uneven row"));

const malformed = parseTable(readFixture("malformed.csv"), "csv");
assert.ok(malformed.warnings.some((warning) => warning.label === "MissingQuotes"));

const empty = parseTable(readFixture("empty.csv"), "csv");
assert.equal(empty.dataRowCount, 0);

const largeCsv = `a,b\n${Array.from({ length: 10005 }, (_, index) => `${index},${index + 1}`).join("\n")}`;
const large = parseTable(largeCsv, "csv");
assert.equal(large.renderedRows.length, 10000);
assert.equal(large.skippedRows, 6);
assert.ok(large.warnings.some((warning) => warning.label === "Render cap"));

fs.rmSync(new URL("../.tmp-parser-test.mjs", import.meta.url));
console.log("CSV TSV parser fixture tests passed.");
