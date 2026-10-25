import { strFromU8, unzipSync } from "fflate";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const children = (parent: Element | Document, name: string) => Array.from(parent.getElementsByTagNameNS(NS, name));
const parse = (bytes: Uint8Array) => {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("The planning layout could not be read.");
  return doc;
};
const columnIndex = (address: string) => [...address.replace(/\d/g, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
function bounds(address: string) {
  const [first, last = first] = address.split(":");
  return { startRowIndex: Number(first.replace(/\D/g, "")) - 1, endRowIndex: Number(last.replace(/\D/g, "")),
    startColumnIndex: columnIndex(first), endColumnIndex: columnIndex(last) + 1 };
}
type JsonObject = Record<string, any>;
function colour(element: Element | undefined): JsonObject | undefined {
  if (!element) return undefined;
  const theme = ["FFFFFF", "000000", "EEECE1", "1F497D", "4F81BD", "C0504D", "9BBB59", "8064A2", "4BACC6", "F79646"];
  const hex = element.getAttribute("rgb")?.slice(-6) ?? theme[Number(element.getAttribute("theme") ?? 1)];
  if (!hex || element.getAttribute("auto") === "1") return undefined;
  const tint = Number(element.getAttribute("tint") ?? 0);
  const channels = [0, 2, 4].map(index => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return tint > 0 ? value + (1 - value) * tint : value * (1 + tint);
  });
  return { red: channels[0], green: channels[1], blue: channels[2] };
}
function cellFormats(doc: Document): JsonObject[] {
  const fonts = children(doc, "fonts")[0], fills = children(doc, "fills")[0], borders = children(doc, "borders")[0];
  const formats = new Map(children(doc, "numFmt").map(format => [Number(format.getAttribute("numFmtId")), format.getAttribute("formatCode")!]));
  const borderStyles = { thin: "SOLID", medium: "SOLID_MEDIUM", thick: "SOLID_THICK", dashed: "DASHED", dotted: "DOTTED", double: "DOUBLE" };
  return Array.from(children(doc, "cellXfs")[0].children).map(xf => {
    const font = fonts.children[Number(xf.getAttribute("fontId") ?? 0)];
    const format: JsonObject = { textFormat: { fontFamily: children(font, "name")[0]?.getAttribute("val") ?? "Arial",
      fontSize: Number(children(font, "sz")[0]?.getAttribute("val") ?? 10), bold: children(font, "b").length > 0,
      italic: children(font, "i").length > 0, foregroundColor: colour(children(font, "color")[0]) ?? { red: 0, green: 0, blue: 0 } } };
    const fill = colour(children(fills.children[Number(xf.getAttribute("fillId") ?? 0)], "fgColor")[0]);
    if (fill) format.backgroundColor = fill;
    const alignment = children(xf, "alignment")[0];
    const horizontal = alignment?.getAttribute("horizontal");
    if (["left", "right", "center"].includes(horizontal!)) format.horizontalAlignment = horizontal!.toUpperCase();
    format.verticalAlignment = ({ top: "TOP", center: "MIDDLE", bottom: "BOTTOM" })[alignment?.getAttribute("vertical") ?? "bottom"] ?? "BOTTOM";
    format.wrapStrategy = alignment?.getAttribute("wrapText") === "1" ? "WRAP" : "OVERFLOW_CELL";
    const border = borders.children[Number(xf.getAttribute("borderId") ?? 0)], edges: JsonObject = {};
    for (const edge of ["top", "bottom", "left", "right"]) {
      const line = children(border, edge)[0], style = borderStyles[line?.getAttribute("style") ?? ""];
      if (style) edges[edge] = { style, color: colour(children(line, "color")[0]) ?? { red: 0, green: 0, blue: 0 } };
    }
    if (Object.keys(edges).length) format.borders = edges;
    const id = Number(xf.getAttribute("numFmtId") ?? 0), pattern = formats.get(id);
    if (pattern) format.numberFormat = /[myd]/i.test(pattern.replace(/"[^"]*"/g, ""))
      ? { type: "DATE", pattern: "MM/yyyy" }
      : { type: "NUMBER", pattern: pattern.includes("_") ? pattern.includes("0.00") ? "#,##0.00" : pattern.includes("0.0") ? "#,##0.0" : "#,##0" : pattern };
    return format;
  });
}
function groups(segments: { start: number; end: number; depth: number; hidden: boolean }[]) {
  const result: JsonObject[] = [];
  const maximum = Math.max(0, ...segments.map(segment => segment.depth));
  for (let depth = 1; depth <= maximum; depth++) {
    let current: { start: number; end: number; collapsed: boolean } | null = null;
    for (const segment of segments.filter(segment => segment.depth >= depth)) {
      if (current && current.end === segment.start) { current.end = segment.end; current.collapsed &&= segment.hidden; }
      else { if (current) result.push({ ...current, depth }); current = { start: segment.start, end: segment.end, collapsed: segment.hidden }; }
    }
    if (current) result.push({ ...current, depth });
  }
  return result;
}

/** Native import data, not a workspace backup. Values/formulas and native layout
 * metadata are transported separately; the Google script never evaluates code. */
export function createGooglePlanningFile(bytes: Uint8Array, fileName: string, exportedAt: Date) {
  const zip = unzipSync(bytes), workbook = parse(zip["xl/workbook.xml"]);
  const styles = cellFormats(parse(zip["xl/styles.xml"]));
  const shared = zip["xl/sharedStrings.xml"] ? children(parse(zip["xl/sharedStrings.xml"]), "si").map(item => children(item, "t").map(t => t.textContent ?? "").join("")) : [];
  const names = Object.fromEntries(children(workbook, "definedName").map(name => [name.getAttribute("name")!, name.textContent!]));
  const sheetFiles = ["xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "xl/worksheets/siteHourlyRates.xml"];
  const sheets = sheetFiles.map((path, index) => {
    const doc = parse(zip[path]), name = ["Resource Planning", "Expenses Proj Spec", "Site hourly rates"][index];
    const cells = children(doc, "c").map(cell => {
      const address = cell.getAttribute("r")!, row = Number(address.replace(/\D/g, "")) - 1, col = columnIndex(address);
      const formula = children(cell, "f")[0], type = cell.getAttribute("t"), raw = children(cell, "v")[0]?.textContent;
      const value = formula ? null : type === "inlineStr" ? children(cell, "t").map(t => t.textContent ?? "").join("")
        : type === "s" ? shared[Number(raw)] : raw === undefined || raw === null || raw === "" ? null
        : type === "str" ? raw : type === "b" ? raw === "1" : Number(raw);
      return { row, col, style: Number(cell.getAttribute("s") ?? 0), value, ...(formula ? { formula: `=${formula.textContent}` } : {}) };
    });
    const pane = children(doc, "pane")[0], format = children(doc, "sheetFormatPr")[0];
    const rows = children(doc, "row").map(row => ({ start: Number(row.getAttribute("r")) - 1, end: Number(row.getAttribute("r")),
      pixels: Math.round(Number(row.getAttribute("ht") ?? format.getAttribute("defaultRowHeight") ?? 15) * 4 / 3),
      hidden: row.getAttribute("hidden") === "1", depth: Number(row.getAttribute("outlineLevel") ?? 0) }));
    const columns = children(doc, "col").map(col => ({ start: Number(col.getAttribute("min")) - 1, end: Number(col.getAttribute("max")),
      pixels: Math.round(Number(col.getAttribute("width") ?? 12.63) * 7 + 5), hidden: col.getAttribute("hidden") === "1", depth: Number(col.getAttribute("outlineLevel") ?? 0) }));
    const headerRow = index === 0 ? 17 : index === 1 ? 12 : 3;
    const rowCount = Math.max(headerRow + 2, ...cells.map(cell => cell.row + 1));
    const colCount = Math.max(1, ...cells.map(cell => cell.col + 1));
    return { name, cells, rows, columns, rowCount, colCount, defaultColumnPixels: Math.round(Number(format.getAttribute("defaultColWidth") ?? 12.63) * 7 + 5),
      frozenRows: Number(pane?.getAttribute("ySplit") ?? 0), frozenColumns: Number(pane?.getAttribute("xSplit") ?? 0),
      rowGroups: groups(rows), columnGroups: groups(columns), merges: children(doc, "mergeCell").map(merge => bounds(merge.getAttribute("ref")!)),
      validations: children(doc, "dataValidation").map(rule => ({ ranges: rule.getAttribute("sqref")!.split(/\s+/).map(bounds), source: children(rule, "formula1")[0]?.textContent ?? "" })),
      chipColumns: index === 0 ? [2, 3, 6, 7, 8, 9] : index === 1 ? [1, 2, 5, 6, 7, 8, 11] : [], headerRow,
      projectColumns: index === 0 ? [7, 8] : index === 1 ? [6, 7] : [] };
  });
  // Resolve named validation sources into plain option strings for the importer.
  function choices(source: string): string[] {
    if (source.startsWith('"') && source.endsWith('"')) return source.slice(1, -1).split(",");
    const reference = names[source] ?? source;
    const match = /^'([^']+)'!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(reference);
    if (!match) throw new Error(`Unsupported dropdown source: ${source}`);
    const sheet = sheets.find(sheet => sheet.name === match[1])!;
    const range = bounds(`${match[2]}${match[3]}:${match[4] ?? match[2]}${match[5] ?? match[3]}`);
    return sheet.cells.filter(cell => cell.row >= range.startRowIndex && cell.row < range.endRowIndex && cell.col >= range.startColumnIndex && cell.col < range.endColumnIndex)
      .map(cell => String(cell.value ?? "")).filter(Boolean);
  }
  const resolved = sheets.map(sheet => ({ ...sheet, validations: sheet.validations.map(rule => ({ ranges: rule.ranges, choices: choices(rule.source) })) }));
  return { format: "scan-google-sheets-planning", schemaVersion: 1, exportedAt: exportedAt.toISOString(),
    title: fileName.replace(/\.xlsx$/i, ""), styles, sheets: resolved,
    notes: ["Native table dropdowns create chips; project option colours may require a final adjustment in Google Sheets."] };
}
