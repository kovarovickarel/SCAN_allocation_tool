import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { FOOTPRINTS, FOOTPRINT_MAP } from "../constants";
import { fetchLatestExchangeRate } from "./currencyRates";
import { buildResourcePlanning, projectPlanningExportName, resourceLocation, type ResourcePlanningOptions } from "./projectResourcePlanning";
import { buildExpensesPlanning } from "./projectExpensesPlanning";

// Patch the original OOXML package instead of rebuilding the template through a
// lossy spreadsheet serializer. Outlines, panes, comments and historical styles survive.
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const readXml = (bytes: Uint8Array) => {
  const document = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("The project planning template could not be read.");
  return document;
};
const xmlBytes = (document: Document) => strToU8(new XMLSerializer().serializeToString(document));
const elements = (parent: Element | Document, name: string) => Array.from(parent.getElementsByTagNameNS(NS, name));
function column(index: number): string {
  let name = "";
  while (index > 0) { index--; name = String.fromCharCode(65 + index % 26) + name; index = Math.floor(index / 26); }
  return name;
}
function colIndex(address: string) {
  return [...address.replace(/\d/g, "")].reduce((index, char) => index * 26 + char.charCodeAt(0) - 64, 0);
}
function node(document: Document, name: string, attributes: Record<string, string | number> = {}) {
  const element = document.createElementNS(NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}
function value(cell: Element, input: string | number | null) {
  cell.replaceChildren(); cell.removeAttribute("t");
  if (input === null) return;
  const document = cell.ownerDocument;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("The project contains a non-finite planning value.");
    const v = node(document, "v"); v.textContent = String(input); cell.append(v);
  } else {
    cell.setAttribute("t", "inlineStr");
    const inline = node(document, "is"), text = node(document, "t");
    text.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    text.textContent = input; inline.append(text); cell.append(inline);
  }
}
function formula(cell: Element, expression: string, cached: number | null) {
  cell.replaceChildren(); cell.removeAttribute("t");
  const f = node(cell.ownerDocument, "f"), v = node(cell.ownerDocument, "v");
  f.textContent = expression; v.textContent = cached === null ? "" : String(cached);
  if (cached === null) cell.setAttribute("t", "str");
  cell.append(f, v);
}

class Sheet {
  document: Document;
  data: Element;
  rows = new Map<number, Element>();
  constructor(bytes: Uint8Array) {
    this.document = readXml(bytes); this.data = elements(this.document, "sheetData")[0];
    elements(this.data, "row").forEach(row => this.rows.set(Number(row.getAttribute("r")), row));
  }
  row(index: number) {
    if (!this.rows.has(index)) {
      const row = node(this.document, "row", { r: index, ht: 15.75, customHeight: 1 });
      const next = [...this.rows.entries()].find(([number]) => number > index)?.[1];
      this.data.insertBefore(row, next ?? null); this.rows.set(index, row);
    }
    return this.rows.get(index)!;
  }
  cell(address: string, style?: number | string) {
    const row = this.row(Number(address.replace(/\D/g, "")));
    let cell = Array.from(row.children).find(cell => cell.getAttribute("r") === address);
    if (!cell) {
      cell = node(this.document, "c", { r: address });
      const next = Array.from(row.children).find(c => colIndex(c.getAttribute("r")!) > colIndex(address));
      row.insertBefore(cell, next ?? null);
    }
    if (style !== undefined) cell.setAttribute("s", String(style));
    return cell;
  }
  set(address: string, input: string | number | null, style?: number | string) { value(this.cell(address, style), input); }
  removeColumnsAfter(last: number) {
    for (const cell of elements(this.data, "c")) if (colIndex(cell.getAttribute("r")!) > last) cell.remove();
  }
  removeRowsFrom(first: number) {
    for (const [index, row] of this.rows) if (index >= first) { row.remove(); this.rows.delete(index); }
  }
  finish(lastColumn: number, lastRow: number) {
    const dimension = elements(this.document, "dimension")[0];
    if (dimension) dimension.setAttribute("ref", `A1:${column(lastColumn)}${lastRow}`);
    return xmlBytes(this.document);
  }
}

class Styles {
  document: Document;
  xfs: Element;
  cache = new Map<string, number>();
  constructor(bytes: Uint8Array) { this.document = readXml(bytes); this.xfs = elements(this.document, "cellXfs")[0]; }
  variant(base: number | string, changes: { format?: string; fill?: string; wrap?: boolean; font?: number; fontColour?: string; border?: number } = {}) {
    const key = JSON.stringify([base, changes]);
    if (this.cache.has(key)) return this.cache.get(key)!;
    const xf = this.xfs.children[Number(base)].cloneNode(true) as Element;
    if (changes.border !== undefined) { xf.setAttribute("borderId", String(changes.border)); xf.setAttribute("applyBorder", "1"); }
    if (changes.format) {
      const formats = elements(this.document, "numFmts")[0];
      let format = Array.from(formats.children).find(f => f.getAttribute("formatCode") === changes.format);
      if (!format) {
        const id = Math.max(163, ...Array.from(formats.children).map(f => Number(f.getAttribute("numFmtId")))) + 1;
        format = node(this.document, "numFmt", { numFmtId: id, formatCode: changes.format }); formats.append(format);
        formats.setAttribute("count", String(formats.children.length));
      }
      xf.setAttribute("numFmtId", format.getAttribute("numFmtId")!); xf.setAttribute("applyNumberFormat", "1");
    }
    if (changes.fill) {
      const fills = elements(this.document, "fills")[0];
      const fill = node(this.document, "fill"), pattern = node(this.document, "patternFill", { patternType: "solid" });
      pattern.append(node(this.document, "fgColor", { rgb: `FF${changes.fill}` }), node(this.document, "bgColor", { rgb: `FF${changes.fill}` }));
      fill.append(pattern); xf.setAttribute("fillId", String(fills.children.length)); fills.append(fill);
      fills.setAttribute("count", String(fills.children.length)); xf.setAttribute("applyFill", "1");
    }
    if (changes.font !== undefined) { xf.setAttribute("fontId", String(changes.font)); xf.setAttribute("applyFont", "1"); }
    if (changes.fontColour) {
      const fonts = elements(this.document, "fonts")[0];
      const font = fonts.children[Number(xf.getAttribute("fontId"))].cloneNode(true) as Element;
      elements(font, "color").forEach(colour => colour.remove());
      font.append(node(this.document, "color", { rgb: `FF${changes.fontColour}` }));
      xf.setAttribute("fontId", String(fonts.children.length)); fonts.append(font);
      fonts.setAttribute("count", String(fonts.children.length)); xf.setAttribute("applyFont", "1");
    }
    if (changes.wrap !== undefined) {
      let alignment = elements(xf, "alignment")[0];
      if (!alignment) { alignment = node(this.document, "alignment"); xf.append(alignment); }
      alignment.setAttribute("wrapText", changes.wrap ? "1" : "0"); alignment.setAttribute("vertical", "center");
      xf.setAttribute("applyAlignment", "1");
    }
    const index = this.xfs.children.length; this.xfs.append(xf); this.xfs.setAttribute("count", String(this.xfs.children.length));
    this.cache.set(key, index); return index;
  }
}

export async function createProjectPlanningXlsx(options: ResourcePlanningOptions, template: Uint8Array, signal: AbortSignal, exportedAt = new Date()) {
  const model = buildResourcePlanning(options);
  const expensePlan = await buildExpensesPlanning(options, signal);
  const exportName = projectPlanningExportName(options.project, exportedAt);
  const { fteCosts } = options.configuration;
  const needsConversion = fteCosts.currency !== "EUR" && Object.values(fteCosts.hourlyRates).some(rate => typeof rate === "number" && rate > 0);
  const exchange = needsConversion ? await fetchLatestExchangeRate(fteCosts.currency, "EUR", signal) : null;
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
  const factor = exchange?.rate ?? 1;
  const sites = [...new Set([...FOOTPRINTS.map(site => site.code), ...model.rows.flatMap(row => row.site ? [row.site] : []),
    ...options.members.filter(member => expensePlan.rows.some(row => row.location === resourceLocation(member.footprint || "PRA")))
      .map(member => member.footprint || "PRA")])];
  const eurRates = sites.map(site => {
    const rate = fteCosts.hourlyRates[site];
    return typeof rate === "number" && Number.isFinite(rate) && rate >= 0 ? rate * factor : null;
  });
  const archive = unzipSync(template);
  const styles = new Styles(archive["xl/styles.xml"]);
  const sheet = new Sheet(archive["xl/worksheets/sheet1.xml"]);
  const rowStyles = Array.from(sheet.row(19).children).filter(cell => colIndex(cell.getAttribute("r")!) <= 19)
    .map(cell => [column(colIndex(cell.getAttribute("r")!)), cell.getAttribute("s")!] as const);
  const lastRow = Math.max(19, 18 + model.rows.length), lastColumn = 19 + model.calendar.length;
  sheet.removeRowsFrom(19); sheet.removeColumnsAfter(lastColumn);
  // Keep the template's historic coloured J column, merges, outline controls and empty A.
  for (const address of ["I3", "N3"]) sheet.set(address, model.projectLabel);
  const projectColour = model.projectClass === "P2" ? "7030A0" : "0000FF";
  const milestoneStyle = styles.variant(18, { fill: projectColour, wrap: true, fontColour: "FFFFFF" });
  const projectNameStyle = styles.variant(53, { fill: projectColour, fontColour: "FFFFFF" });
  for (const address of ["I3", "N3"]) sheet.cell(address, styles.variant(13, { fill: projectColour, fontColour: "FFFFFF" }));
  for (const col of ["O", "P", "Q", "R", "S"]) {
    const cell = sheet.cell(`${col}3`);
    sheet.cell(`${col}3`, styles.variant(cell.getAttribute("s") ?? 15, { fill: projectColour }));
  }
  const years = [...new Set(expensePlan.calendar.map(month => month.year))];
  const colours = ["E6B8AF", "00FFFF", "B7E1CD", "FFFFFF99", "D9D2E9", "C9DAF8", "F9CB9C", "D9EAD3", "F4CCCC", "CFE2F3", "EAD1DC", "D0E0E3", "FFF2CC", "B6D7A8", "D5A6BD", "A2C4C9"];
  const numeric = styles.variant(61, { format: "0.###" });
  const totalFte = styles.variant(30, { format: "0.###" });
  const headers = years.map((_, index) => styles.variant(44, { fill: colours[index % colours.length], format: "mm/yyyy" }));
  for (let month = 0; month < model.calendar.length; month++) {
    const col = column(20 + month), period = model.calendar[month];
    for (let index = 1; index <= 16; index++) sheet.set(`${col}${index}`, null);
    sheet.set(`${col}1`, period.month, 3); sheet.set(`${col}2`, period.year, 9);
    sheet.set(`${col}3`, period.events.length ? period.events.join("\n") : null, milestoneStyle);
    sheet.set(`${col}17`, "FTE", 34); sheet.set(`${col}18`, period.date, headers[years.indexOf(period.year)]);
    formula(sheet.cell(`${col}15`, totalFte), `SUM(${col}19:${col}${lastRow})`, model.rows.reduce((sum, row) => sum + row.months[month], 0));
  }
  sheet.row(3).setAttribute("ht", sheet.row(2).getAttribute("ht") ?? "15.75");
  sheet.row(3).setAttribute("customHeight", "1");
  const rateLast = sites.length + 4;
  model.rows.forEach((row, index) => {
    const number = 19 + index;
    rowStyles.forEach(([col, style]) => sheet.set(`${col}${number}`, null, style));
    const fields: Record<string, string | number | null> = { B: row.status, C: row.keyword, D: "1 Base", E: "SystemValidation", F: "6 SystemValidation", G: "SysVal",
      H: model.projectLabel, I: model.projectLabel, J: model.projectClass, K: "2-SYS2xx", L: row.activity, M: row.location,
      N: row.management ? "SYV-Lead" : "SYV-General", O: "Internal", P: row.costClass, Q: row.hours, R: "no" };
    Object.entries(fields).forEach(([col, input]) => sheet.set(`${col}${number}`, input));
    for (const col of ["H", "I"]) sheet.cell(`${col}${number}`, projectNameStyle);
    sheet.cell(`B${number}`, row.status === "OK" ? 48 : row.status === "no FTE planned" ? 65 : 74);
    for (let month = 0; month < row.months.length; month++) sheet.set(`${column(month + 20)}${number}`, row.months[month] > 1e-9 ? row.months[month] : null, numeric);
    if (row.site) {
      const lookup = `INDEX('Site hourly rates'!$C$5:$C$${rateLast},MATCH(M${number},'Site hourly rates'!$A$5:$A$${rateLast},0))`;
      const rate = eurRates[sites.indexOf(row.site)];
      formula(sheet.cell(`S${number}`), `IF(COUNT(${lookup})=0,"",Q${number}*${lookup})`, rate === null ? null : row.hours * rate);
    }
  });
  const totalHours = model.rows.reduce((sum, row) => sum + row.hours, 0);
  const priced = model.rows.filter(row => row.site);
  const missingRates = priced.some(row => eurRates[sites.indexOf(row.site!)] === null);
  formula(sheet.cell("Q16"), `SUM(Q19:Q${lastRow})`, totalHours);
  formula(sheet.cell("S16"), `IF(COUNT(S19:S${lastRow})<COUNTIF(B19:B${lastRow},"OK"),"",SUM(S19:S${lastRow}))`,
    missingRates ? null : priced.reduce((sum, row) => sum + row.hours * eurRates[sites.indexOf(row.site!)]!, 0));
  // Replace the template's broken source-list references with self-contained dropdowns.
  const validations = elements(sheet.document, "dataValidations")[0]; validations.replaceChildren();
  function list(range: string, choices: string[] | string) {
    // In OOXML showDropDown=1 hides the arrow; explicitly keep it visible.
    const validation = node(sheet.document, "dataValidation", { type: "list", allowBlank: 1, showDropDown: 0, showErrorMessage: 1, errorStyle: "stop", sqref: range });
    const f = node(sheet.document, "formula1"); f.textContent = typeof choices === "string" ? choices : `"${choices.join(",")}"`;
    validation.append(f); validations.append(validation);
  }
  const keywordOptions = [...new Set(["KPI", "Trace checker", "SIL", "PIL", "HIL", "RCC", "Pipeline", "System test", "System integration test", "Visualization", "Vehicle tooling", "Operations", "Other", "Simulations", "Range & Accuracy", ...model.rows.map(row => row.keyword), ...expensePlan.rows.map(row => row.keyword)])];
  list(`C19:C${lastRow}`, "ExportToolKeywords");
  list(`D19:D${lastRow}`, ["1 Base"]); list(`G19:G${lastRow}`, ["SysVal"]);
  list(`H19:I${lastRow}`, "ExportProjectName"); list(`J19:J${lastRow}`, ["P1", "P2"]);
  list(`K19:K${lastRow}`, ["1-SYS1xx", "2-SYS2xx", "3-SYS3xx", "4-SYS4xx", "5-SYS5xx"]);
  list(`M19:M${lastRow}`, "ExportSites"); list(`N19:N${lastRow}`, ["SYV-General", "SYV-Lead"]);
  list(`O19:O${lastRow}`, ["Internal", "External"]); list(`P19:P${lastRow}`, ["HCC", "LCC"]); list(`R19:R${lastRow}`, ["yes", "no"]);
  validations.setAttribute("count", String(validations.children.length));
  archive["xl/worksheets/sheet1.xml"] = sheet.finish(lastColumn, lastRow);

  // Preserve Expenses outlines/panes, replacing only its example data and calendar.
  const expenses = new Sheet(archive["xl/worksheets/sheet2.xml"]);
  const expenseRowStyles = Array.from(expenses.row(14).children).filter(cell => colIndex(cell.getAttribute("r")!) <= 16)
    .map(cell => [column(colIndex(cell.getAttribute("r")!)), cell.getAttribute("s")!] as const);
  const expenseLastRow = Math.max(14, 13 + expensePlan.rows.length), expenseLastColumn = 16 + expensePlan.calendar.length;
  expenses.removeRowsFrom(14);
  for (const cell of elements(expenses.data, "c")) {
    const row = Number(cell.getAttribute("r")!.replace(/\D/g, ""));
    if (row <= 11 && colIndex(cell.getAttribute("r")!) >= 17) value(cell, null);
  }
  expenses.removeColumnsAfter(expenseLastColumn);
  expenses.set("O3", model.projectLabel, styles.variant(13, { fill: projectColour, fontColour: "FFFFFF" }));
  expenses.cell("P3", styles.variant(15, { fill: projectColour }));
  const expenseMoney = styles.variant(108, { format: "#,##0.00" });
  const expenseTotal = styles.variant(107, { format: "#,##0.00" });
  const expenseSum = styles.variant(28, { format: "#,##0.00", fontColour: "000000", fill: "FFFFFF" });
  const expenseCurrency = styles.variant(92, { border: 2 });
  const expenseActivity = styles.variant(106, { border: 2 });
  expenses.cell("O13", styles.variant(95, { border: 2 }));
  for (let index = 0; index < expensePlan.calendar.length; index++) {
    const col = column(17 + index), period = expensePlan.calendar[index];
    expenses.set(`${col}1`, period.month, 3); expenses.set(`${col}2`, period.year, 9);
    const events = model.calendar[index]?.events ?? [];
    expenses.set(`${col}3`, events.length ? events.join("\n") : null, index < options.project.duration ? milestoneStyle : 17);
    expenses.set(`${col}12`, "EUR", expenseCurrency); expenses.set(`${col}13`, period.date, headers[years.indexOf(period.year)]);
    formula(expenses.cell(`${col}11`, expenseSum), `SUM(${col}14:${col}${expenseLastRow})`, expensePlan.rows.reduce((sum, row) => sum + row.months[index], 0));
  }
  expenses.row(3).setAttribute("ht", expenses.row(2).getAttribute("ht") ?? "15.75");
  expenses.row(3).setAttribute("customHeight", "1");
  expenses.set("O12", "EUR");
  expensePlan.rows.forEach((row, index) => {
    const number = 14 + index, total = row.months.reduce((sum, amount) => sum + amount, 0);
    expenseRowStyles.forEach(([col, style]) => expenses.set(`${col}${number}`, null, style));
    const fields: Record<string, string | number> = { A: total > 0 ? "OK" : "no Expenses planned", B: row.keyword, C: "1 Base", D: "SystemValidation", E: "6 SystemValidation", F: "SysVal",
      G: model.projectLabel, H: model.projectLabel, I: model.projectClass, J: "2-SYS2xx", K: row.location, L: row.expenseType,
      M: row.outsourced, N: row.deferred, O: row.activity };
    Object.entries(fields).forEach(([col, input]) => expenses.set(`${col}${number}`, input));
    expenses.cell(`O${number}`, expenseActivity);
    expenses.cell(`A${number}`, total > 0 ? 48 : 115);
    for (const col of ["G", "H"]) expenses.cell(`${col}${number}`, projectNameStyle);
    row.months.forEach((amount, month) => expenses.set(`${column(17 + month)}${number}`, amount > 0 ? amount : null, expenseMoney));
    formula(expenses.cell(`P${number}`, expenseTotal), `SUM(Q${number}:${column(expenseLastColumn)}${number})`, total);
  });
  formula(expenses.cell("P11"), `SUM(P14:P${expenseLastRow})`, expensePlan.rows.reduce((sum, row) => sum + row.months.reduce((a, b) => a + b, 0), 0));
  const expenseTypes = [...new Set(["License", "Workstation", "Hardware", "Contracted Workpackage", "Travel", ...expensePlan.rows.map(row => row.expenseType)])];
  const delays = ["NO", ...Array.from({ length: 120 }, (_, index) => `YES_${index + 1} months`)];
  const expenseValidations = elements(expenses.document, "dataValidations")[0]; expenseValidations.replaceChildren();
  function expenseList(range: string, choices: string[] | string) {
    const validation = node(expenses.document, "dataValidation", { type: "list", allowBlank: 1, showDropDown: 0, showErrorMessage: 1, errorStyle: "stop", sqref: range });
    const f = node(expenses.document, "formula1"); f.textContent = typeof choices === "string" ? choices : `"${choices.join(",")}"`;
    validation.append(f); expenseValidations.append(validation);
  }
  expenseList(`B14:B${expenseLastRow}`, "ExportToolKeywords"); expenseList(`C14:C${expenseLastRow}`, ["1 Base"]);
  expenseList(`F14:F${expenseLastRow}`, ["SysVal"]); expenseList(`G14:H${expenseLastRow}`, "ExportProjectName");
  expenseList(`I14:I${expenseLastRow}`, ["P1", "P2"]); expenseList(`J14:J${expenseLastRow}`, ["1-SYS1xx", "2-SYS2xx", "3-SYS3xx", "4-SYS4xx", "5-SYS5xx"]);
  expenseList(`K14:K${expenseLastRow}`, "ExportSites"); expenseList(`L14:L${expenseLastRow}`, "ExportExpenseTypes");
  expenseList(`M14:M${expenseLastRow}`, ["yes", "no"]); expenseList(`N14:N${expenseLastRow}`, "ExportPaymentDelays"); expenseList("O12", ["EUR"]);
  expenseValidations.setAttribute("count", String(expenseValidations.children.length));
  archive["xl/worksheets/sheet2.xml"] = expenses.finish(expenseLastColumn, expenseLastRow);

  const rateDocument = document.implementation.createDocument(NS, "worksheet");
  rateDocument.documentElement.append(node(rateDocument, "sheetViews"), node(rateDocument, "sheetFormatPr", { defaultRowHeight: 18 }), node(rateDocument, "cols"), node(rateDocument, "sheetData"));
  const view = node(rateDocument, "sheetView", { workbookViewId: 0, showGridLines: 0 });
  view.append(node(rateDocument, "pane", { ySplit: 4, topLeftCell: "A5", state: "frozen", activePane: "bottomLeft" }));
  elements(rateDocument, "sheetViews")[0].append(view);
  const rateCols = elements(rateDocument, "cols")[0];
  [29, 15, 18, 13, 18, 32, 29, 29, 24].forEach((width, index) => rateCols.append(node(rateDocument, "col", { min: index + 1, max: index + 1, width, customWidth: 1 })));
  const rates = new Sheet(xmlBytes(rateDocument));
  const heading = styles.variant(39, { fill: "D9E2F3", wrap: false });
  const rateStyle = styles.variant(59, { format: "0.00" });
  rates.set("A1", "Site hourly rates", 32); rates.row(1).setAttribute("ht", "25");
  rates.set("A2", "Source currency", 23); rates.set("B2", fteCosts.currency, 23);
  rates.set("C2", "EUR conversion", 23); rates.set("D2", factor, styles.variant(59, { format: "0.000000" }));
  rates.set("E2", "Rate date", 23); rates.set("F2", exchange?.date ?? "Not required", 23);
  ["Site", "Cost class", "EUR / hour", "Site code", "Source / hour", "Project"].forEach((label, index) => rates.set(`${column(index + 1)}4`, label, heading));
  sites.forEach((site, index) => {
    const number = index + 5;
    rates.set(`A${number}`, resourceLocation(site), 53); rates.set(`B${number}`, ["BIE", "TRO"].includes(site) ? "HCC" : "LCC", 53);
    rates.set(`C${number}`, eurRates[index], rateStyle); rates.set(`D${number}`, site, 53);
    rates.set(`E${number}`, fteCosts.hourlyRates[site] ?? null, rateStyle);
  });
  rates.set("F5", model.projectLabel, 53);
  for (const [col, title, values] of [["G", "Tool keywords", keywordOptions], ["H", "Expense types", expenseTypes], ["I", "Payment delays", delays]] as const) {
    rates.set(`${col}4`, title, heading); values.forEach((entry, index) => rates.set(`${col}${5 + index}`, entry, 53));
  }
  rates.set(`A${rateLast + 3}`, "Edit EUR / hour to update Resource Planning costs. An empty rate is unpriced.", 23);
  archive["xl/worksheets/siteHourlyRates.xml"] = rates.finish(9, Math.max(rateLast + 3, 4 + delays.length, 4 + keywordOptions.length, 4 + expenseTypes.length));

  const workbook = readXml(archive["xl/workbook.xml"]), relations = readXml(archive["xl/_rels/workbook.xml.rels"]), contentTypes = readXml(archive["[Content_Types].xml"]);
  const sheets = elements(workbook, "sheets")[0];
  const rateId = "rIdSiteHourlyRates";
  const newSheet = node(workbook, "sheet", { name: "Site hourly rates", sheetId: Math.max(...elements(workbook, "sheet").map(sheet => Number(sheet.getAttribute("sheetId")))) + 1 });
  newSheet.setAttributeNS(REL, "r:id", rateId); sheets.append(newSheet);
  const relationship = relations.createElementNS(relations.documentElement.namespaceURI, "Relationship");
  relationship.setAttribute("Id", rateId); relationship.setAttribute("Type", `${REL}/worksheet`); relationship.setAttribute("Target", "worksheets/siteHourlyRates.xml");
  relations.documentElement.append(relationship);
  const override = contentTypes.createElementNS(contentTypes.documentElement.namespaceURI, "Override");
  override.setAttribute("PartName", "/xl/worksheets/siteHourlyRates.xml"); override.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml");
  contentTypes.documentElement.append(override);
  let names = elements(workbook, "definedNames")[0];
  if (!names) { names = node(workbook, "definedNames"); workbook.documentElement.insertBefore(names, elements(workbook, "calcPr")[0] ?? null); }
  for (const [name, reference] of [["ExportProjectName", "'Site hourly rates'!$F$5"], ["ExportSites", `'Site hourly rates'!$A$5:$A$${rateLast}`],
    ["ExportToolKeywords", `'Site hourly rates'!$G$5:$G$${4 + keywordOptions.length}`], ["ExportExpenseTypes", `'Site hourly rates'!$H$5:$H$${4 + expenseTypes.length}`],
    ["ExportPaymentDelays", `'Site hourly rates'!$I$5:$I$${4 + delays.length}`]]) {
    const definition = node(workbook, "definedName", { name }); definition.textContent = reference; names.append(definition);
  }
  const calc = elements(workbook, "calcPr")[0] ?? node(workbook, "calcPr");
  calc.setAttribute("calcMode", "auto"); calc.setAttribute("fullCalcOnLoad", "1"); calc.setAttribute("forceFullCalc", "1");
  if (!calc.parentElement) workbook.documentElement.append(calc);
  archive["xl/workbook.xml"] = xmlBytes(workbook); archive["xl/_rels/workbook.xml.rels"] = xmlBytes(relations); archive["[Content_Types].xml"] = xmlBytes(contentTypes);
  archive["xl/styles.xml"] = xmlBytes(styles.document);
  if (archive["docProps/core.xml"]) {
    const core = readXml(archive["docProps/core.xml"]), dc = "http://purl.org/dc/elements/1.1/";
    let title = core.getElementsByTagNameNS(dc, "title")[0];
    if (!title) { title = core.createElementNS(dc, "dc:title"); core.documentElement.append(title); }
    title.textContent = exportName; archive["docProps/core.xml"] = xmlBytes(core);
  }
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
  const bytes = zipSync(archive, { level: 6 });
  return { bytes, fileName: `${exportName}.xlsx`, missingSites: sites.filter((site, index) => eurRates[index] === null && priced.some(row => row.site === site))
    .map(site => FOOTPRINT_MAP[site]?.name ?? site) };
}
