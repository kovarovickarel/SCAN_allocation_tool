import { expect, test, type Page } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { availabilityWorkspace } from "./fixtures/availabilityWorkspace";
import { createAvailabilityXlsx } from "../src/utils/availabilityXlsx";
import type { AvailabilityExportOptions } from "../src/utils/availabilityExport";

function options(tool?: string): AvailabilityExportOptions {
  const data = availabilityWorkspace();
  return { ...data, members: data.teamMembers, tool,
    configuration: { ...data.configuration, sitePublicHolidays: {} } };
}

// Inspect actual exported cells and resolve their styles, rather than checking a
// palette that could be correct while the wrong style is applied to the data.
async function inspect(page: Page, source: AvailabilityExportOptions, now = new Date(2026, 0, 1)) {
  const output = await createAvailabilityXlsx(source, now);
  const files = Object.fromEntries(Object.entries(unzipSync(output.bytes)).map(([name, bytes]) => [name, strFromU8(bytes)]));
  return page.evaluate(files => {
    const parse = (name: string) => {
      const doc = new DOMParser().parseFromString(files[name], "application/xml");
      if (doc.querySelector("parsererror")) throw new Error(`Invalid XML: ${name}`);
      return doc;
    };
    const styles = parse("xl/styles.xml");
    const workbook = parse("xl/workbook.xml");
    const sheets = Array.from(workbook.getElementsByTagName("sheet")).map((node, index) => {
      const doc = parse(`xl/worksheets/sheet${index + 1}.xml`);
      const rows = Array.from(doc.getElementsByTagName("row")).map(row => ({
        number: Number(row.getAttribute("r")),
        cells: Array.from(row.getElementsByTagName("c")).map(cell => {
          const xf = styles.getElementsByTagName("cellXfs")[0].children[Number(cell.getAttribute("s"))];
          const fill = styles.getElementsByTagName("fills")[0].children[Number(xf.getAttribute("fillId"))];
          const font = styles.getElementsByTagName("fonts")[0].children[Number(xf.getAttribute("fontId"))];
          return { address: cell.getAttribute("r")!, text: cell.querySelector("t")?.textContent ?? cell.querySelector("v")?.textContent ?? "",
            formula: cell.querySelector("f")?.textContent ?? null, type: cell.getAttribute("t"),
            fill: fill.querySelector("fgColor")?.getAttribute("rgb"), color: font.querySelector("color")?.getAttribute("rgb"),
            bold: !!font.querySelector("b"), style: Number(cell.getAttribute("s")) };
        }),
      }));
      return { name: node.getAttribute("name"), rows, dimension: doc.querySelector("dimension")?.getAttribute("ref"),
        filter: doc.querySelector("autoFilter")?.getAttribute("ref"), merges: Array.from(doc.getElementsByTagName("mergeCell")).map(m => m.getAttribute("ref")) };
    });
    return { sheets, active: Number(workbook.querySelector("workbookView")?.getAttribute("activeTab")),
      recalculate: workbook.querySelector("calcPr")?.getAttribute("fullCalcOnLoad") };
  }, files);
}

for (const site of ["PRA", "BIE", "TOK", "TRO", "CHE", "CAI"]) {
  test(`availability XLSX actual leave colours, vacation counters and weekend mask at ${site}`, async ({ page }) => {
    const source = options("KPI");
    const member = { ...source.members[1], footprint: site, absences: {
      "2026-01-05": "vacation" as const, "2026-01-06": { type: "vacation" as const, halfDay: true as const },
      "2026-01-07": "sick" as const, "2026-01-08": { type: "sick" as const, halfDay: true as const },
      "2026-01-09": "vacation" as const, "2026-01-11": "sick" as const,
      "2026-01-12": "other" as const, "2026-01-13": { type: "other" as const, halfDay: true as const },
      "2026-01-14": "working" as const, "2026-01-15": { type: "working" as const, halfDay: true as const },
      "2026-01-16": "vacation" as const,
    } };
    source.members = [member];
    source.configuration.sitePublicHolidays = { [site]: ["2026-01-14", "2026-01-15", "2026-01-16"] };
    const result = await inspect(page, source);
    const row = result.sheets[0].rows.find(r => r.cells[0].text === "Shared Person")!;
    const day = (number: number) => row.cells[12 + number - 1];
    for (const [number, code, color] of [[5, "h", "FFCC0000"], [6, "h/2", "FFE68080"], [7, "s", "FF38761D"],
      [8, "s/2", "FF9CBB8E"], [12, "o", "FFA64D79"], [13, "o/2", "FFD3A6BC"],
      [14, "W", "FFF4CCCC"], [15, "W/2", "FFF4CCCC"], [16, "P", "FFF4CCCC"]] as const) {
      expect(day(number), `Jan ${number}`).toMatchObject({ text: code, fill: color });
    }
    for (const number of [5, 6, 7, 8]) expect(day(number)).toMatchObject({ color: "FFFFFFFF", bold: true });
    expect(day(16).color).toBe(day(16).fill);
    // Friday/Sunday differ in Cairo. Historical weekend leave stays visible but
    // must not consume the annual budget; public holidays never consume it.
    expect(row.cells[9].text).toBe(site === "CAI" ? "1.5" : "2.5");
    expect(row.cells[11].text).toBe(site === "CAI" ? "2.5" : "1.5");
    expect(row.cells[10].text).toBe(site === "CAI" ? "28.5" : "27.5");
    const mask = row.cells[9].formula!.match(/\{([01,]+)\}/)![1].split(",").map(Number);
    expect(mask).toHaveLength(365);
    expect(mask.slice(8, 11)).toEqual(site === "CAI" ? [0, 0, 1] : [1, 0, 0]);
    expect(result.recalculate).toBe("1");
  });
}

for (const tool of [undefined, "KPI"] as const) {
  test(`availability year boundaries, leap day and allocation-year labels (${tool ?? "global"})`, async ({ page }) => {
    const source = options(tool);
    source.members[1].absences = { "2024-02-29": "vacation", "2033-12-31": "sick" };
    const result = await inspect(page, source, new Date(2026, 11, 31, 23, 59));
    expect(result.sheets.map(s => s.name)).toEqual([2024, 2026, 2027, 2028, 2029, 2030, 2033].map(y => `Vacation ${y}`));
    expect(result.active).toBe(1);
    for (const sheet of result.sheets) {
      const leap = sheet.name === "Vacation 2024" || sheet.name === "Vacation 2028";
      const person = sheet.rows.find(r => r.cells[0].text === "Shared Person")!;
      expect(person.cells).toHaveLength(12 + (leap ? 366 : 365));
      expect(sheet.rows[2].cells.at(-1)?.text).toBe("31");
      expect(sheet.merges.filter(ref => /^[A-Z]+4:[A-Z]+6$/.test(ref!))).toHaveLength((leap ? 366 : 365) + 1);
      expect(sheet.merges.filter(ref => /^[A-Z]+1:[A-Z]+1$/.test(ref!))).toHaveLength(13);
      expect(sheet.filter).toBe(sheet.dimension!.replace("A1:", "A7:"));
      const year = Number(sheet.name!.slice(-4));
      expect(person.cells[4].text).toBe(year === 2026 || year === 2027 ? "History project, Offset project" : "");
      if (year === 2024) expect(person.cells[12 + 59]).toMatchObject({ text: "h", fill: "FFCC0000" });
      if (year === 2033) expect(person.cells.at(-1)).toMatchObject({ text: "s", fill: "FF38761D" });
    }
  });

  test(`availability empty scope remains a usable workbook (${tool ?? "global"})`, async ({ page }) => {
    const source = options(tool); source.members = [];
    const result = await inspect(page, source);
    expect(result.sheets).toHaveLength(5);
    for (const sheet of result.sheets) {
      expect(sheet.rows.filter(row => row.cells[0].text === "Team Other")).toHaveLength(tool ? 0 : 1);
      const manual = sheet.rows.filter(row => row.number > 8);
      expect(manual).toHaveLength(tool ? 0 : 3);
      for (const row of manual) {
        expect(row.cells[0].text).toBe("");
        expect(row.cells[8]).toMatchObject({ formula: `30+H${row.number}`, text: "30" });
        expect(row.cells[9].text).toBe("0"); expect(row.cells[10].text).toBe("30");
      }
    }
  });
}

test("availability exports merge historical cross-team calendars only globally and preserve literal names", async ({ page }) => {
  const source = options();
  source.members = source.members.slice(0, 2).map((m, i) => ({ ...m,
    firstName: '=A1 & <"Person">', lastName: "O'Neil", absences: i ? { "2026-01-05": "sick" } : { "2026-01-05": "vacation", "2026-01-06": "other" } }));
  const original = JSON.stringify(source);
  for (const tool of [undefined, "Data Factory"] as const) {
    const result = await inspect(page, { ...source, tool });
    const people = result.sheets[0].rows.filter(r => r.cells[0].text.startsWith("=A1"));
    expect(people).toHaveLength(1);
    expect(people[0].cells[0]).toMatchObject({ text: '=A1 & <"Person"> O\'Neil', type: "inlineStr", formula: null });
    expect(people[0].cells[16].text).toBe(tool ? "h" : "s");
    expect(people[0].cells[17].text).toBe("o");
  }
  expect(JSON.stringify(source)).toBe(original);
});

test("availability export can be cancelled after generation starts without changing source", async () => {
  const source = options(), before = JSON.stringify(source), controller = new AbortController();
  const pending = createAvailabilityXlsx(source, new Date(2026, 0, 1), controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(JSON.stringify(source)).toBe(before);
});
