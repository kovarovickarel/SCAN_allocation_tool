export { unzipSync, strFromU8 } from "fflate";
import { unzipSync, strFromU8 } from "fflate";
import { createProjectPlanningXlsx } from "../../src/utils/projectPlanningXlsx";
import type { PlanningExportOptions } from "../../src/utils/portfolioPlanning";

/** Inspect the actual download, not just the intermediate planning model. */
export async function inspectPlanningExport(options: PlanningExportOptions, addresses: string[], now = "2026-10-26T10:05:00Z") {
  const source = JSON.stringify(options);
  const template = new Uint8Array(await (await fetch("/templates/project-planning.xlsx")).arrayBuffer());
  const output = await createProjectPlanningXlsx(options, template, new AbortController().signal, new Date(now));
  const archive = unzipSync(output.bytes);
  const xml = (path: string) => {
    const result = new DOMParser().parseFromString(strFromU8(archive[path]), "application/xml");
    if (result.getElementsByTagName("parsererror").length) throw new Error(`Invalid XML: ${path}: ${result.getElementsByTagName("parsererror")[0].textContent}`);
    return result;
  };
  const strings = Array.from(xml("xl/sharedStrings.xml").getElementsByTagName("si")).map(item => item.textContent ?? "");
  const styles = xml("xl/styles.xml"), workbook = xml("xl/workbook.xml");
  const sheets = ["sheet1.xml", "sheet2.xml", "siteHourlyRates.xml"].map(path => {
    const document = xml(`xl/worksheets/${path}`);
    const cells = Object.fromEntries(Array.from(document.getElementsByTagName("c")).filter(cell => addresses.includes(cell.getAttribute("r")!)).map(cell => {
      const raw = cell.getElementsByTagName("v")[0]?.textContent;
      const xf = styles.getElementsByTagName("cellXfs")[0].children[Number(cell.getAttribute("s") ?? 0)];
      const fill = styles.getElementsByTagName("fills")[0].children[Number(xf.getAttribute("fillId"))];
      const font = styles.getElementsByTagName("fonts")[0].children[Number(xf.getAttribute("fontId"))];
      const border = styles.getElementsByTagName("borders")[0].children[Number(xf.getAttribute("borderId"))];
      const type = cell.getAttribute("t");
      const value = type === "s" ? strings[Number(raw)] : type === "inlineStr" ? cell.getElementsByTagName("is")[0]?.textContent
        : raw !== undefined && raw !== "" ? Number(raw) : null;
      return [cell.getAttribute("r"), { value, formula: cell.getElementsByTagName("f")[0]?.textContent ?? null,
        type, fill: fill.getElementsByTagName("fgColor")[0]?.getAttribute("rgb") ?? null,
        font: font.getElementsByTagName("color")[0]?.getAttribute("rgb") ?? null,
        top: border.getElementsByTagName("top")[0]?.getAttribute("style") ?? null,
        bottom: border.getElementsByTagName("bottom")[0]?.getAttribute("style") ?? null }];
    }));
    return { cells, rows: Array.from(document.getElementsByTagName("row")).map(row => ({ index: Number(row.getAttribute("r")),
      height: Number(row.getAttribute("ht")), group: Number(row.getAttribute("outlineLevel")), hidden: row.getAttribute("hidden") === "1" })),
      columns: Array.from(document.getElementsByTagName("col")).map(col => ({ min: col.getAttribute("min"), max: col.getAttribute("max"),
        group: col.getAttribute("outlineLevel"), hidden: col.getAttribute("hidden"), collapsed: col.getAttribute("collapsed") })),
      validations: Array.from(document.getElementsByTagName("dataValidation")).map(item => ({ range: item.getAttribute("sqref"),
        source: item.getElementsByTagName("formula1")[0]?.textContent, arrow: item.getAttribute("showDropDown") })),
      merges: Array.from(document.getElementsByTagName("mergeCell")).map(item => item.getAttribute("ref")),
      pane: document.getElementsByTagName("pane")[0]?.getAttribute("topLeftCell"),
    };
  });
  return { fileName: output.fileName, missingSites: output.missingSites, unchanged: source === JSON.stringify(options), sheets,
    invalidColours: Array.from(styles.getElementsByTagName("*")).filter(element => element.hasAttribute("rgb") && !/^[A-Fa-f0-9]{8}$/.test(element.getAttribute("rgb")!)).map(element => element.getAttribute("rgb")),
    sheetNames: Array.from(workbook.getElementsByTagName("sheet")).map(sheet => sheet.getAttribute("name")),
    names: Object.fromEntries(Array.from(workbook.getElementsByTagName("definedName")).map(name => [name.getAttribute("name"), name.textContent])),
    title: archive["docProps/core.xml"] ? xml("docProps/core.xml").getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "title")[0]?.textContent : null,
  };
}
