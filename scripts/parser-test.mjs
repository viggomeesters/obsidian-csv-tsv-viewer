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

const pipe = parseTable('# export metadata\ndate|duration|apps\n2026-01-01|1|one;two;three;four\n2026-01-02|2|one;two\n', 'csv');
assert.equal(pipe.delimiter, '|', 'consistent pipes must beat semicolons embedded in cells');
assert.equal(pipe.rows[2][2], 'one;two;three;four');
assert.equal(pipe.rows[0][0], '# export metadata', 'hash-prefixed values must not be silently discarded');

const exportText = "# report; one; two\r\n".repeat(25)
  + 'date|detail|apps\r\n2026-01-01|"line 1\r\n# quoted content"|one;two;three\r\n'
  + '# trailing comment\r\n2026-01-02|other|one;two\r\n';
const commented = parseTable(exportText, "csv", true);
assert.equal(commented.delimiterKind, "pipe");
assert.deepEqual(commented.rows, [
  ["date", "detail", "apps"],
  ["2026-01-01", "line 1\r\n# quoted content", "one;two;three"],
  ["2026-01-02", "other", "one;two"],
]);
assert.deepEqual(commented.warnings, []);
assert.deepEqual(parseTable('# note\n"#literal"\tvalue\n', "tsv", true).rows, [["#literal", "value"]]);
for (const ignoreComments of [false, true]) {
  const leadingBlankRows = parseTable(" \n\n".repeat(25) + "a|b\nc|d\n", "csv", ignoreComments);
  assert.equal(leadingBlankRows.delimiterKind, "pipe");
  assert.deepEqual(leadingBlankRows.rows, [["a", "b"], ["c", "d"]]);
}

fs.rmSync(new URL("../.tmp-parser-test.mjs", import.meta.url));
console.log("CSV TSV parser fixture tests passed.");
