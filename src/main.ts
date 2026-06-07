import {
  Notice,
  Plugin,
  TFile,
  TextFileView,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";
import { ParsedTable, WarningItem, parseTable } from "./parser";

const VIEW_TYPE_CSV_TSV_VIEWER = "csv-tsv-viewer";
const TABULAR_EXTENSIONS = ["csv", "tsv"];

type ViewMode = "table" | "source";

export default class CsvTsvViewerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(
      VIEW_TYPE_CSV_TSV_VIEWER,
      (leaf) => new CsvTsvViewerView(leaf),
    );
    this.registerExtensions(TABULAR_EXTENSIONS, VIEW_TYPE_CSV_TSV_VIEWER);

    this.addCommand({
      id: "open-current-csv-tsv-in-viewer",
      name: "Open current CSV or TSV file in viewer",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!isTabularFile(file)) return false;

        if (!checking) {
          void this.openTabularFile(file);
        }
        return true;
      },
    });
  }

  async openTabularFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.setViewState({
      type: VIEW_TYPE_CSV_TSV_VIEWER,
      state: { file: file.path },
      active: true,
    });
  }
}

class CsvTsvViewerView extends TextFileView {
  private mode: ViewMode = "table";
  private filterValue = "";

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CSV_TSV_VIEWER;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "CSV TSV viewer";
  }

  getIcon(): string {
    return "table-2";
  }

  setViewData(data: string): void {
    this.data = data;
    this.render();
  }

  getViewData(): string {
    return this.data;
  }

  clear(): void {
    this.data = "";
    this.contentEl.empty();
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("csv-tsv-viewer");

    const header = container.createDiv({ cls: "csv-tsv-viewer__header" });
    this.renderTitle(header);
    this.renderToolbar(header);

    if (!this.file) {
      renderMessage(container, "No CSV or TSV file is attached to this viewer.");
      return;
    }

    if (!isTabularFile(this.file)) {
      renderMessage(container, "This viewer only supports .csv and .tsv files.");
      return;
    }

    const parsed = parseTable(this.data, this.file.extension);
    renderSummary(container, parsed);
    renderWarnings(container, parsed.warnings);

    if (!this.data.trim()) {
      renderMessage(container, "This file is empty.");
      return;
    }

    if (this.mode === "source") {
      renderSource(container, this.data, parsed.delimiter);
      return;
    }

    renderTable(container, parsed, this.filterValue);
  }

  private renderTitle(parent: HTMLElement): void {
    const title = parent.createDiv({ cls: "csv-tsv-viewer__title" });
    title.createDiv({
      cls: "csv-tsv-viewer__filename",
      text: this.file?.name ?? "CSV or TSV file",
    });
    title.createDiv({
      cls: "csv-tsv-viewer__path",
      text: this.file?.path ?? "",
    });
  }

  private renderToolbar(parent: HTMLElement): void {
    const toolbar = parent.createDiv({ cls: "csv-tsv-viewer__toolbar" });

    const searchWrap = toolbar.createDiv({ cls: "csv-tsv-viewer__search" });
    setIcon(searchWrap.createSpan({ cls: "csv-tsv-viewer__search-icon" }), "search");
    const searchInput = searchWrap.createEl("input", {
      attr: {
        "aria-label": "Filter rows",
        placeholder: "Filter",
        spellcheck: "false",
        type: "search",
        value: this.filterValue,
      },
    });
    searchInput.addEventListener("input", () => {
      this.filterValue = searchInput.value;
      this.render();
    });

    const modeGroup = toolbar.createDiv({
      cls: "csv-tsv-viewer__segmented",
      attr: { "aria-label": "View mode" },
    });
    const tableButton = createTextButton(modeGroup, "Table");
    const sourceButton = createTextButton(modeGroup, "Source");
    tableButton.toggleClass("is-active", this.mode === "table");
    sourceButton.toggleClass("is-active", this.mode === "source");

    tableButton.addEventListener("click", () => {
      this.mode = "table";
      this.render();
    });
    sourceButton.addEventListener("click", () => {
      this.mode = "source";
      this.render();
    });

    const refreshButton = createIconButton(toolbar, "refresh-cw", "Refresh file");
    refreshButton.addEventListener("click", () => {
      void this.reloadFile();
    });
  }

  private async reloadFile(): Promise<void> {
    if (!this.file) {
      new Notice("No CSV or TSV file to refresh");
      return;
    }

    try {
      this.data = await this.app.vault.read(this.file);
      this.render();
    } catch (error) {
      this.contentEl.empty();
      this.contentEl.addClass("csv-tsv-viewer");
      renderMessage(this.contentEl, `Unable to read file: ${getErrorMessage(error)}`);
    }
  }
}

function delimiterLabel(delimiter: string): string {
  if (delimiter === "\t") return "tab";
  if (delimiter === ";") return "semicolon";
  return "comma";
}

function renderSummary(parent: HTMLElement, parsed: ParsedTable): void {
  const summary = parent.createDiv({ cls: "csv-tsv-viewer__summary" });
  summary.createSpan({
    cls: "csv-tsv-viewer__pill",
    text: `${parsed.dataRowCount} rows`,
  });
  summary.createSpan({
    cls: "csv-tsv-viewer__pill",
    text: `${parsed.columnCount} columns`,
  });
  summary.createSpan({
    cls: "csv-tsv-viewer__pill",
    text: `${delimiterLabel(parsed.delimiter)} delimiter`,
  });
  if (parsed.skippedRows > 0) {
    summary.createSpan({
      cls: "csv-tsv-viewer__note",
      text: `${parsed.renderedRows.length} rows rendered`,
    });
  }
}

function renderWarnings(parent: HTMLElement, warnings: WarningItem[]): void {
  if (warnings.length === 0) return;

  const box = parent.createDiv({ cls: "csv-tsv-viewer__warnings" });
  box.createDiv({ cls: "csv-tsv-viewer__warnings-title", text: "Parse warnings" });
  warnings.slice(0, 12).forEach((warning) => {
    box.createDiv({
      cls: "csv-tsv-viewer__warning",
      text: `${warning.label}: ${warning.message}`,
    });
  });
  if (warnings.length > 12) {
    box.createDiv({
      cls: "csv-tsv-viewer__warning-more",
      text: `${warnings.length - 12} additional warnings hidden`,
    });
  }
}

function renderTable(parent: HTMLElement, parsed: ParsedTable, query: string): void {
  if (parsed.renderedRows.length === 0) {
    renderMessage(parent, "No rows to display.");
    return;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const rows = normalizedQuery
    ? parsed.renderedRows.filter((row) => row.join(" ").toLowerCase().includes(normalizedQuery))
    : parsed.renderedRows;

  if (rows.length === 0) {
    renderMessage(parent, "No rows match the current filter.");
    return;
  }

  const wrap = parent.createDiv({ cls: "csv-tsv-viewer__table-wrap" });
  const table = wrap.createEl("table", { cls: "csv-tsv-viewer__table" });
  const head = table.createEl("thead");
  const headRow = head.createEl("tr");
  headRow.createEl("th", { cls: "csv-tsv-viewer__row-number", text: "#" });
  for (let column = 0; column < parsed.columnCount; column += 1) {
    headRow.createEl("th", { text: `Column ${column + 1}` });
  }

  const body = table.createEl("tbody");
  rows.forEach((row, index) => {
    const tr = body.createEl("tr");
    tr.createEl("th", {
      cls: "csv-tsv-viewer__row-number",
      text: String(index + 1),
    });
    for (let column = 0; column < parsed.columnCount; column += 1) {
      tr.createEl("td", { text: row[column] ?? "" });
    }
  });
}

function renderSource(parent: HTMLElement, data: string, delimiter: string): void {
  const source = parent.createDiv({ cls: "csv-tsv-viewer__source" });
  const pre = source.createEl("pre");
  data.split("\n").forEach((line, index) => {
    const lineEl = pre.createDiv({ cls: "csv-tsv-viewer__source-line" });
    lineEl.createSpan({ cls: "csv-tsv-viewer__line-number", text: String(index + 1) });
    const code = lineEl.createSpan({ cls: "csv-tsv-viewer__source-code" });
    highlightDelimitedLine(code, line, delimiter);
  });
}

function highlightDelimitedLine(parent: HTMLElement, line: string, delimiter: string): void {
  let cursor = 0;
  let inQuotes = false;
  let cellStart = 0;

  const flushCell = (end: number): void => {
    const value = line.slice(cellStart, end);
    parent.createSpan({
      cls: value.startsWith("\"") ? "csv-tsv-viewer__tok-quoted" : "csv-tsv-viewer__tok-cell",
      text: value,
    });
  };

  while (cursor < line.length) {
    const char = line[cursor];
    if (char === "\"") {
      if (inQuotes && line[cursor + 1] === "\"") {
        cursor += 2;
        continue;
      }
      inQuotes = !inQuotes;
      cursor += 1;
      continue;
    }

    if (!inQuotes && line.startsWith(delimiter, cursor)) {
      flushCell(cursor);
      parent.createSpan({
        cls: "csv-tsv-viewer__tok-delimiter",
        text: delimiter === "\t" ? "→" : delimiter,
      });
      cursor += delimiter.length;
      cellStart = cursor;
      continue;
    }

    cursor += 1;
  }

  flushCell(line.length);
}

function createIconButton(parent: HTMLElement, icon: string, label: string): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: "clickable-icon csv-tsv-viewer__button",
    attr: { "aria-label": label, title: label, type: "button" },
  });
  setIcon(button, icon);
  return button;
}

function createTextButton(parent: HTMLElement, label: string): HTMLButtonElement {
  return parent.createEl("button", {
    cls: "csv-tsv-viewer__text-button",
    text: label,
    attr: { type: "button" },
  });
}

function renderMessage(parent: HTMLElement, message: string): void {
  parent.createDiv({ cls: "csv-tsv-viewer__message", text: message });
}

function isTabularFile(file: TFile | null): file is TFile {
  return Boolean(file && TABULAR_EXTENSIONS.includes(file.extension.toLowerCase()));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
