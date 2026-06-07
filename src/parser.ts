import Papa from "papaparse";

const RENDER_ROW_LIMIT = 10000;

export type DelimiterKind = "comma" | "semicolon" | "tab";

export interface WarningItem {
  label: string;
  message: string;
}

export interface ParsedTable {
  rows: string[][];
  renderedRows: string[][];
  columnCount: number;
  dataRowCount: number;
  skippedRows: number;
  delimiter: string;
  delimiterKind: DelimiterKind;
  warnings: WarningItem[];
}

export function parseTable(data: string, extension: string): ParsedTable {
  const delimiter = delimiterFor(data, extension);
  const result = Papa.parse<string[]>(data, {
    delimiter,
    dynamicTyping: false,
    header: false,
    skipEmptyLines: "greedy",
  });

  const rows = normalizeRows(result.data);
  const columnCount = maxColumnCount(rows);
  const warnings = warningsFor(data, rows, result.errors, columnCount);
  const renderedRows = rows.slice(0, RENDER_ROW_LIMIT);
  const skippedRows = Math.max(0, rows.length - renderedRows.length);

  if (skippedRows > 0) {
    warnings.push({
      label: "Render cap",
      message: `${skippedRows} rows are not rendered to keep the view responsive.`,
    });
  }

  return {
    rows,
    renderedRows,
    columnCount,
    dataRowCount: rows.length,
    skippedRows,
    delimiter,
    delimiterKind: delimiterKind(delimiter),
    warnings,
  };
}

function delimiterFor(data: string, extension: string): string {
  if (extension.toLowerCase() === "tsv") return "\t";
  const sample = firstNonEmptyLines(data, 20).join("\n");
  if (!sample) return ",";

  const commaScore = delimiterScore(sample, ",");
  const semicolonScore = delimiterScore(sample, ";");
  return semicolonScore > commaScore ? ";" : ",";
}

function delimiterScore(sample: string, delimiter: string): number {
  const result = Papa.parse<string[]>(sample, {
    delimiter,
    dynamicTyping: false,
    header: false,
    preview: 20,
    skipEmptyLines: "greedy",
  });
  const rows = normalizeRows(result.data);
  if (rows.length === 0) return 0;

  const widths = rows.map((row) => row.length);
  const max = Math.max(...widths);
  const multiColumnRows = widths.filter((width) => width > 1).length;
  const consistency = widths.filter((width) => width === max).length;
  return max * 5 + multiColumnRows * 3 + consistency - result.errors.length * 4;
}

function warningsFor(
  data: string,
  rows: string[][],
  errors: Papa.ParseError[],
  columnCount: number,
): WarningItem[] {
  const warnings: WarningItem[] = [];

  if (data.charCodeAt(0) === 0xfeff) {
    warnings.push({
      label: "BOM",
      message: "The file starts with a byte order mark. It was kept in the parsed data.",
    });
  }

  errors.forEach((error) => {
    warnings.push({
      label: error.code,
      message: `Row ${rowNumber(error.row)}: ${error.message}`,
    });
  });

  rows.forEach((row, index) => {
    if (columnCount > 0 && row.length !== columnCount) {
      warnings.push({
        label: "Uneven row",
        message: `Row ${index + 1} has ${row.length} cells; expected ${columnCount}.`,
      });
    }
  });

  return warnings;
}

function rowNumber(row: number | undefined): number {
  return typeof row === "number" ? row + 1 : 1;
}

function normalizeRows(data: unknown[]): string[][] {
  return data
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => formatCell(cell)));
}

function formatCell(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  return String(cell);
}

function maxColumnCount(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function firstNonEmptyLines(data: string, limit: number): string[] {
  const lines: string[] = [];
  for (const line of data.split(/\r?\n/)) {
    if (!line.trim()) continue;
    lines.push(line);
    if (lines.length >= limit) break;
  }
  return lines;
}

function delimiterKind(delimiter: string): DelimiterKind {
  if (delimiter === "\t") return "tab";
  if (delimiter === ";") return "semicolon";
  return "comma";
}
