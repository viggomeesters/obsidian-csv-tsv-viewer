import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const releasePackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const releaseVersions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
const main = fs.readFileSync("src/main.ts", "utf8");
const parser = fs.readFileSync("src/parser.ts", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

const assertions = [
  [manifest.id === "csv-tsv-viewer", "manifest id is csv-tsv-viewer"],
  [manifest.version === releasePackage.version && /^\d+\.\d+\.\d+$/.test(manifest.version) && releaseVersions[manifest.version] === manifest.minAppVersion, "release version matches package and supported app version"],
  [!/obsidian/i.test(manifest.description), "manifest description avoids product name"],
  [main.includes("registerExtensions(TABULAR_EXTENSIONS"), "extensions are registered"],
  [main.includes("type ViewMode = \"table\" | \"source\""), "table/source mode exists"],
  [main.includes("renderTable(container, parsed, this.filterValue)"), "table view code path exists"],
  [main.includes("renderSource(container, this.data, parsed.delimiter)"), "source view code path exists"],
  [parser.includes("RENDER_ROW_LIMIT = 10000"), "render cap exists"],
  [parser.includes("Papa.parse"), "Papa Parse is used"],
  [!main.includes("navigator.clipboard") && !parser.includes("navigator.clipboard"), "no clipboard access"],
  [!main.includes("fetch(") && !parser.includes("fetch("), "no fetch usage"],
  [!styles.includes("!important"), "styles do not use important overrides"],
];

const failures = assertions.filter(([passes]) => !passes).map(([, label]) => label);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log("CSV TSV Viewer smoke checks passed.");
