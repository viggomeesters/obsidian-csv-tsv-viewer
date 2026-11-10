import Papa from "papaparse";

const RENDER_ROW_LIMIT = 10000;

export type DelimiterKind = "comma" | "semicolon" | "tab" | "pipe";

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

export function parseTable(data: string, extension: string, ignoreComments = false): ParsedTable {
  const comments = ignoreComments ? "#" : false;
  const delimiter = delimiterFor(data, extension, comments);
  const result = Papa.parse<string[]>(data, {
    delimiter,
    comments,
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

function delimiterFor(data: string, extension: string, comments: string | false): string {
  if (extension.toLowerCase() === "tsv") return "\t";

  const scores = [",", ";", "|"].map((delimiter) => ({
    delimiter,
    score: delimiterScore(data, delimiter, comments),
  }));
  return scores.reduce((best, candidate) => candidate.score > best.score ? candidate : best).delimiter;
}

function delimiterScore(data: string, delimiter: string, comments: string | false): number {
  const frequencies = new Map<number, number>();
  let rowCount = 0;
  let errorCount = 0;
  Papa.parse<string[]>(data, {
    delimiter,
    comments,
    dynamicTyping: false,
    fastMode: false,
    header: false,
    skipEmptyLines: "greedy",
    step: (result, parser) => {
      const width = result.data.length;
      if (width > 1) frequencies.set(width, (frequencies.get(width) ?? 0) + 1);
      errorCount += result.errors.length;
      rowCount += 1;
      if (rowCount >= 20) parser.abort();
    },
  });
  if (rowCount === 0) return 0;

  let score = 0;
  for (const [width, count] of frequencies) {
    score = Math.max(score, (count / rowCount) * 100 + count * 3 + Math.min(width, 20));
  }
  return score - errorCount * 4;
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
  if (typeof cell === "string") return cell;
  if (typeof cell === "number" || typeof cell === "boolean" || typeof cell === "bigint") return String(cell);
  return JSON.stringify(cell) ?? "";
}

function maxColumnCount(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function delimiterKind(delimiter: string): DelimiterKind {
  if (delimiter === "\t") return "tab";
  if (delimiter === ";") return "semicolon";
  if (delimiter === "|") return "pipe";
  return "comma";
}
