import { expect } from "@playwright/test";
import { test, readDownloadedBytes } from "./fixtures/downloadCapture";
import { availabilityWorkspace } from "./fixtures/availabilityWorkspace";
import { serializeWorkspace } from "../src/utils/workspaceFile";
import { availabilityCalendarDays, availabilityDayEntry, availabilityExportMembers, availabilityExportYears,
  availabilityProjectNames, type AvailabilityExportOptions } from "../src/utils/availabilityExport";
import { createAvailabilityXlsx } from "../src/utils/availabilityXlsx";
import { unzipSync, strFromU8 } from "fflate";
import { writeFile } from "node:fs/promises";

function fixture(tool?: string) {
  const data = availabilityWorkspace();
  data.teamMembers[0].absences = { "2026-01-05": "vacation", "2026-01-06": { type: "vacation", halfDay: true },
    "2026-01-07": "sick", "2026-01-08": { type: "sick", halfDay: true }, "2026-01-09": "other",
    "2026-01-10": "vacation", "2026-01-12": "vacation", "2026-01-13": { type: "working", halfDay: true } };
  data.teamMembers[1].absences = { ...data.teamMembers[0].absences };
  data.teamMembers[1].isExternal = true;
  data.teamMembers[1].monthlySalaryCost = 10000;
  data.teamMembers[1].monthlySalaryCurrency = "EUR";
  data.teamMembers[1].supplierId = "supplier-luxoft";
  data.configuration.sitePublicHolidays = { PRA: ["2026-01-12", "2026-01-13"], CAI: ["2035-04-01"] };
  const options: AvailabilityExportOptions = { ...data, members: data.teamMembers, tool };
  return { data, options };
}

test("availability export always includes current plus four years; only calendar data adds others", () => {
  const { options } = fixture();
  options.members[0].absences["2020-01-01"] = "vacation";
  options.members[0].absences["2037-01-01"] = "other";
  options.projects[0].startDate = "2010-01";
  expect(availabilityExportYears(options, new Date(2026, 0, 1))).toEqual([2020, 2026, 2027, 2028, 2029, 2030, 2035, 2037]);
  expect(availabilityExportYears({ ...options, members: [], configuration: { ...options.configuration, sitePublicHolidays: {} } }, new Date(2026, 0, 1)))
    .toEqual([2026, 2027, 2028, 2029, 2030]);
});

test("team export excludes other teams' extra years and sites", () => {
  const { options } = fixture("Data Factory");
  options.members[1].absences["2040-01-01"] = "vacation";
  expect(availabilityExportYears(options, new Date(2026, 0, 1))).toEqual([2026, 2027, 2028, 2029, 2030]);
});

test("global people use silhouette team once; team export retains cross-functional membership labels", () => {
  const { options } = fixture();
  const people = availabilityExportMembers(options);
  expect(people).toHaveLength(2);
  const shared = people.find(person => person.firstName === "Shared")!;
  expect(shared.tool).toBe("KPI"); expect(shared.teams).toEqual(["KPI", "Data Factory"]);
  expect(shared.isExternal).toBe(true);
  const team = availabilityExportMembers({ ...options, tool: "Data Factory" });
  expect(team).toHaveLength(2); expect(team.find(person => person.firstName === "Shared")!.tool).toBe("Data Factory");
  expect(team.find(person => person.firstName === "Shared")!.teams).toEqual(["Data Factory", "KPI"]);
});

test("silhouette ties use the same alphabetical ranking as the global calendar", () => {
  const { options } = fixture(); options.members[0].fte = .5; options.members[1].fte = .5;
  expect(availabilityExportMembers(options).find(person => person.firstName === "Shared")!.tool).toBe("Data Factory");
});

test("availability locations use the requested three-letter labels", () => {
  const { options } = fixture();
  options.members = ["PRA", "BIE", "TOK", "TRO", "CHE", "CAI"].map((footprint, index) =>
    ({ ...options.members[0], id: `site-${index}`, firstName: `Person ${index}`, footprint }));
  expect(availabilityExportMembers(options).map(member => member.location)).toEqual(["Pra", "Bie", "Tok", "Tro", "Che", "Cai"]);
});

test("calendar has all days including leap day and site-specific weekends", () => {
  expect(availabilityCalendarDays(2028)).toHaveLength(366);
  expect(availabilityCalendarDays(2028)[59].date).toBe("2028-02-29");
  const member = fixture().options.members[0];
  expect(availabilityDayEntry(member, "2026-01-09", new Set()).working).toBe(true);
  expect(availabilityDayEntry({ ...member, footprint: "CAI" }, "2026-01-09", new Set()).working).toBe(false);
  expect(availabilityDayEntry({ ...member, footprint: "CAI" }, "2026-01-11", new Set()).working).toBe(true);
});

test("full/half leave codes, holidays and working exceptions preserve app eligibility", () => {
  const { options } = fixture(), member = options.members[0], holidays = new Set(options.configuration.sitePublicHolidays.PRA);
  expect(availabilityDayEntry(member, "2026-01-06", holidays).code).toBe("h/2");
  expect(availabilityDayEntry(member, "2026-01-08", holidays).code).toBe("s/2");
  expect(availabilityDayEntry(member, "2026-01-12", holidays)).toMatchObject({ code: "P", holiday: true, eligible: false });
  expect(availabilityDayEntry(member, "2026-01-13", holidays)).toMatchObject({ code: "W/2", eligible: false });
  expect(availabilityDayEntry(member, "2026-01-10", holidays).eligible).toBe(false);
});

test("project labels use actual allocations in the year and exclude zero, inactive and unallocated projects", () => {
  const { options } = fixture();
  const names = availabilityProjectNames(options).get("shared_person")!;
  expect([...names.get(2026)!].sort()).toEqual(["History project", "Offset project"]);
  expect(names.has(2028)).toBe(false);
  options.workpackages.forEach(card => { card.memberAssignments = {}; card.memberMonthlyAssignments = {}; });
  expect(availabilityProjectNames(options).size).toBe(0);
});

test("management-only allocation contributes project labels", () => {
  const { options } = fixture();
  Object.assign(options.configuration.management, { threshold: .1 });
  options.projects[0].mgmtMemberMonthlyAssignments = { KPI: { idle: { 0: .1 } } };
  options.workpackages.forEach(card => { card.memberAssignments = {}; card.memberMonthlyAssignments = {}; });
  expect(availabilityProjectNames(options).get("free_member")?.get(2026)?.has("History project")).toBe(true);
});

test("cross-team project list includes the person's other memberships and export can be cancelled", async () => {
  const { options } = fixture("Data Factory");
  options.workpackages = options.workpackages.filter(card => card.tool === "KPI");
  expect(availabilityProjectNames(options).get("shared_person")?.get(2026)?.size).toBe(2);
  const controller = new AbortController(); controller.abort();
  await expect(createAvailabilityXlsx(options, new Date(2026, 0, 1), controller.signal)).rejects.toThrow();
});

for (const tool of [undefined, "Data Factory"] as const) test(`actual availability workbook: structure, formulas, styles and scope (${tool ?? "global"})`, async ({ page }, info) => {
  const { options } = fixture(tool), original = JSON.stringify(options);
  const output = await createAvailabilityXlsx(options, new Date(2026, 10, 2, 9, 7));
  expect(JSON.stringify(options)).toBe(original);
  expect(output.fileName).toBe(`SCAN_Availability_${tool ?? "All_Teams"}-02_11_2026_09-07.xlsx`);
  const archive = unzipSync(output.bytes);
  expect(strFromU8(archive["docProps/core.xml"])).toContain(`<dc:title>${tool ?? "SCAN"} Members Availability</dc:title>`);
  expect(strFromU8(archive["_rels/.rels"])).toContain('Target="docProps/core.xml"');
  await writeFile(info.outputPath("availability.xlsx"), output.bytes);
  await page.goto("/");
  const result = await page.evaluate(files => {
    const docs = Object.fromEntries(Object.entries(files).map(([name, text]) => [name, new DOMParser().parseFromString(text, "application/xml")]));
    for (const doc of Object.values(docs)) if (doc.getElementsByTagName("parsererror").length) throw new Error("Malformed XLSX XML");
    const workbook = docs["xl/workbook.xml"], sheet = docs["xl/worksheets/sheet1.xml"], styles = docs["xl/styles.xml"];
    const cells = Array.from(sheet.getElementsByTagName("c"));
    const value = (address: string) => { const cell = cells.find(cell => cell.getAttribute("r") === address)!;
      return { text: cell.textContent, formula: cell.getElementsByTagName("f")[0]?.textContent, cached: cell.getElementsByTagName("v")[0]?.textContent }; };
    const names = cells.filter(cell => /^A\d+$/.test(cell.getAttribute("r")!)).map(cell => cell.textContent!);
    const row = cells.find(cell => cell.textContent?.startsWith("Shared Person"))!.getAttribute("r")!.replace(/\D/g, "");
    const at = (col: string) => value(`${col}${row}`);
    const appearance = (address: string) => {
      const cell = cells.find(cell => cell.getAttribute("r") === address)!;
      const xf = styles.getElementsByTagName("cellXfs")[0].children[Number(cell.getAttribute("s"))];
      const border = styles.getElementsByTagName("borders")[0].children[Number(xf.getAttribute("borderId"))];
      const fill = styles.getElementsByTagName("fills")[0].children[Number(xf.getAttribute("fillId"))];
      const font = styles.getElementsByTagName("fonts")[0].children[Number(xf.getAttribute("fontId"))];
      return { alignment: xf.getElementsByTagName("alignment")[0]?.getAttribute("horizontal"), rotation: xf.getElementsByTagName("alignment")[0]?.getAttribute("textRotation"), bold: font.getElementsByTagName("b").length > 0, borders: Array.from(border.children).map(side => [side.localName, side.getAttribute("style"), side.firstElementChild?.getAttribute("rgb")]),
        fill: fill.getElementsByTagName("fgColor")[0]?.getAttribute("rgb"), font: font.getElementsByTagName("color")[0]?.getAttribute("rgb") };
    };
    return { years: Array.from(workbook.getElementsByTagName("sheet")).map(sheet => sheet.getAttribute("name")), names, row,
      blank: ["B", "C", "F"].map(col => at(col).text), teams: at("D").text, projects: at("E").text, location: at("G").text,
      tp: at("H"), th: at("I"), uh: at("J"), re: at("K"), sl: at("L"),
      merges: Array.from(sheet.getElementsByTagName("mergeCell")).map(cell => cell.getAttribute("ref")),
      weekday: value("M4").text, jan1: value("M3").text,
      calendarLabels: ["K1", "K2", "K3", "K4"].map(address => ({ text: value(address).text, ...appearance(address) })),
      width: Array.from(sheet.getElementsByTagName("col")).find(col => col.getAttribute("min") === "13")?.getAttribute("width"),
      metadataWidths: Array.from(sheet.getElementsByTagName("col")).slice(0, 4).map(col => col.getAttribute("width")),
      sectionHeight: Array.from(sheet.getElementsByTagName("row")).find(r => r.getAttribute("r") === "8")?.getAttribute("ht"),
      headerHeight: Array.from(sheet.getElementsByTagName("row")).find(r => r.getAttribute("r") === "7")?.getAttribute("ht"),
      height: Array.from(sheet.getElementsByTagName("row")).find(r => r.getAttribute("r") === row)?.getAttribute("ht"),
      gradients: styles.getElementsByTagName("gradientFill").length,
      ruleColors: Array.from(styles.getElementsByTagName("dxfs")[0].children).map(rule => ({
        foreground: rule.getElementsByTagName("fgColor")[0]?.getAttribute("rgb"),
        background: rule.getElementsByTagName("bgColor")[0]?.getAttribute("rgb"),
        font: rule.getElementsByTagName("font")[0]?.getElementsByTagName("color")[0]?.getAttribute("rgb"),
        bold: rule.getElementsByTagName("font")[0]?.getElementsByTagName("b")[0]?.getAttribute("val") !== "0" && rule.getElementsByTagName("b").length > 0,
      })),
      notes: Array.from(workbook.getElementsByTagName("sheet")).map((_, index) => {
        const comments = docs[`xl/comments${index + 1}.xml`];
        const sheet = docs[`xl/worksheets/sheet${index + 1}.xml`];
        const relationships = docs[`xl/worksheets/_rels/sheet${index + 1}.xml.rels`];
        const vml = docs[`xl/drawings/comments${index + 1}.vml`];
        return { comments: Array.from(comments.getElementsByTagName("comment")).map(comment => [comment.getAttribute("ref"), comment.textContent]),
          drawing: sheet.getElementsByTagName("legacyDrawing")[0]?.getAttribute("r:id"),
          targets: Array.from(relationships.getElementsByTagName("Relationship")).map(rel => rel.getAttribute("Target")),
          anchors: Array.from(vml.getElementsByTagNameNS("urn:schemas-microsoft-com:office:excel", "Column")).map(col => col.textContent) };
      }),
      conditional: Array.from(sheet.getElementsByTagName("cfRule")).map(rule => rule.textContent),
      pane: sheet.getElementsByTagName("pane")[0]?.getAttribute("topLeftCell"),
      appearance: { header: appearance("M3"), weekday: appearance("M4"), day: appearance(`M${row}`), weekend: appearance(`O${row}`),
        details: appearance(`A${row}`), team: appearance("M8"), teamDetails: appearance("B8"), teamLabel: appearance("A8"), vacation: appearance(`Q${row}`),
        sickLegend: appearance("A1"), trainingLegend: appearance("A4"), legendText: appearance("B1"), workingLegend: appearance("A5"), holidayCell: appearance(`X${row}`), workingHalfCell: appearance(`Y${row}`), vacationHalfCell: appearance(`R${row}`), sickHalfCell: appearance(`T${row}`), teamHeader: appearance("D7"), nameHeader: appearance("A7"), calendarFilters: ["M7", "LZ7", "NM7"].map(appearance) },
      noLegacy: !cells.some(cell => ["hv", "OF", "HO", "fv"].includes(cell.textContent ?? "")) };
  }, Object.fromEntries(Object.entries(archive).map(([path, bytes]) => [path, strFromU8(bytes)])));
  expect(result.years).toEqual(["Vacation 2026", "Vacation 2027", "Vacation 2028", "Vacation 2029", "Vacation 2030", ...(!tool ? ["Vacation 2035"] : [])]);
  expect(result.names.filter(name => name.startsWith("Shared Person"))).toHaveLength(1);
  expect(result.names.some(name => name === "Shared Person (Ext)")).toBe(!tool);
  expect(result.names.includes("Team Other")).toBe(!tool);
  expect(result.names.includes("Team KPI")).toBe(!tool);
  expect(result.blank).toEqual(["", "", ""]); expect(result.teams).toBe(tool ? "Data Factory, KPI" : "KPI, Data Factory");
  expect(result.projects).toBe("History project, Offset project");
  expect(result.location).toBe("Pra");
  result.notes.forEach((notes, index) => {
    expect(notes.comments).toEqual([
      ["H7", "Transferred holidays from previous year"], ["I7", "no. of your total holidays"],
      ["J7", "no. of holidays that you already used"], ["K7", "no. of your remaining holidays"],
      ["L7", "no. of sick leaves that you used"],
    ]);
    expect(notes.drawing).toBe("commentsVml");
    expect(notes.targets).toEqual([`../comments${index + 1}.xml`, `../drawings/comments${index + 1}.vml`]);
    expect(notes.anchors).toEqual(["7", "8", "9", "10", "11"]);
  });
  expect(result.tp.cached).toBe("0"); expect(result.th.formula).toBe(`30+H${result.row}`);
  expect(result.uh.cached).toBe("1.5"); expect(result.sl.cached).toBe("1.5"); expect(result.re.cached).toBe("28.5");
  expect(result.uh.formula).toContain('="h/2"'); expect(result.sl.formula).toContain('="s/2"');
  expect(result.merges).toContain("M4:M6"); expect(result.merges).toContain("LZ4:LZ6");
  for (const range of ["K1:L1", "K2:L2", "K3:L3", "K4:L6"]) expect(result.merges).toContain(range);
  expect(result.calendarLabels.map(label => label.text)).toEqual(["Month", "Calendar Week", "Day of Month", "Weekday"]);
  expect(result.calendarLabels.every(label => label.alignment === "center")).toBe(true);
  expect(result.calendarLabels[3].rotation).toBe("45");
  expect(result.calendarLabels[3].fill).toBe("FFFFFFFF");
  expect(result.weekday).toBe("Thu"); expect(result.jan1).toBe("1");
  expect(result.width).toBe("3.38"); expect(result.height).toBe("15.75"); expect(result.gradients).toBe(0);
  expect(result.ruleColors.map(rule => rule.foreground)).toEqual([
    "FFCC0000", "FF38761D", "FFA64D79", "FF8E7CC3", "FFF4CCCC",
    "FFE68080", "FF9CBB8E", "FFD3A6BC", "FFC7BEE1", "FFF4CCCC",
    "FFFFFFFF", "FFD9D9D9", "FFF4CCCC", "FFF4CCCC",
  ]);
  expect(result.ruleColors.every(rule => rule.foreground === rule.background)).toBe(true);
  for (const index of [5, 6]) {
    expect(result.ruleColors[index].font).toBe("FFFFFFFF");
    expect(result.ruleColors[index].bold).toBe(true);
  }
  for (const half of [result.appearance.vacationHalfCell, result.appearance.sickHalfCell]) {
    expect(half.font).toBe("FFFFFFFF"); expect(half.bold).toBe(true);
  }
  expect(result.ruleColors[13].font).toBe(result.ruleColors[13].background); // P stays stored, but is invisible in the cell.
  expect(result.conditional).toContain(`M${result.row}="t"`);
  expect(result.conditional).toContain(`M${result.row}="W"`);
  expect(result.conditional).toContain(`M${result.row}="W/2"`);
  expect(result.conditional).toContain(`M${result.row}="P"`);
  expect(result.appearance.holidayCell.font).toBe(result.appearance.holidayCell.fill);
  expect(result.appearance.holidayCell.fill).toBe("FFF4CCCC");
  expect(result.appearance.workingHalfCell.fill).toBe("FFF4CCCC"); expect(result.noLegacy).toBe(true); expect(result.pane).toBe("E8");
  expect(result.conditional).toContain(`Q${result.row}=""`); // Clearing exported leave restores its ordinary background.
  const edges = ["left", "right", "top", "bottom"];
  expect(result.appearance.day.borders).toEqual(edges.map(side => [side, "thin", "FFE0E0E0"]));
  expect(result.appearance.header.borders).toEqual(edges.map(side => [side, "thin", "FF000000"]));
  expect(result.appearance.weekday.borders).toEqual(result.appearance.header.borders);
  expect(result.appearance.details.borders).toEqual(edges.map(side => [side, "thin", "FF0E4C84"]));
  expect(result.appearance.team.fill).toBe("FF666666");
  expect(result.merges).not.toContain("A8:L8");
  expect(result.metadataWidths).toEqual(["22.5", "24.75", "18.5", "24.75"]);
  expect(result.sectionHeight).toBe("15.75"); expect(result.headerHeight).toBe("28");
  expect(result.appearance.teamLabel.alignment).toBe("center");
  expect(result.appearance.teamDetails.borders).toEqual(edges.map(side => [side, "thin", "FF5C5C5C"]));
  expect(result.appearance.team.borders).toEqual(edges.map(side => [side, "thin", side === "top" ? "FF000000" : "FF595959"]));
  expect(result.appearance.weekend.borders).toEqual(edges.map(side => [side, "thin", "FFBFBFBF"]));
  expect(result.appearance.vacation.font).toBe("FFFFFFFF");
  expect(result.appearance.sickLegend.fill).toBe("FF38761D");
  expect(result.appearance.trainingLegend.fill).toBe("FF8E7CC3");
  expect(result.appearance.sickLegend.alignment).toBe("left");
  expect(result.appearance.sickLegend.font).toBe("FFFFFFFF");
  expect(result.appearance.workingLegend.bold).toBe(true);
  expect(result.appearance.legendText.alignment).toBe("left");
  expect(result.merges).not.toContain("B1:F1");
  expect(result.appearance.teamHeader.rotation).toBe("60");
  for (const filter of result.appearance.calendarFilters) {
    expect(filter.fill).toBe("FFF3F3F3");
    expect(filter.borders).toEqual(edges.map(side => [side, "thin", side === "bottom" ? "FF000000" : "FFC7C7C7"]));
  }
  expect(result.appearance.nameHeader.borders).toEqual(edges.map(side => [side, "thin", side === "bottom" ? "FF000000" : "FF0E4C84"]));
});

for (const global of [false, true]) test(`availability Export downloads current drafts without saving (${global ? "global" : "team"})`, async ({ page }) => {
  const { data } = fixture();
  await page.addInitScript(() => {
    localStorage.setItem("scan-availability-position:Global", JSON.stringify({ year: 2026, left: 0, top: 0 }));
    localStorage.setItem("scan-availability-position:Data Factory", JSON.stringify({ year: 2026, left: 0, top: 0 }));
  });
  await page.goto("/");
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "availability.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await page.getByRole("button", { name: global ? "Open Global Team Availability" : "Open Data Factory member availability", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `${global ? "Global" : "Data Factory"} member availability`, exact: true });
  await dialog.getByRole("button", { name: "Shared Person, 2026-01-14: Available", exact: true }).press("Space");
  const pending = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export team availability", exact: true }).click();
  const download = await pending, bytes = await readDownloadedBytes(page, download);
  expect(download.suggestedFilename()).toMatch(new RegExp(`^SCAN_Availability_${global ? "All_Teams" : "Data Factory"}-.*\\.xlsx$`));
  const files = unzipSync(bytes), sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  expect(sheet.includes("Team Other")).toBe(global);
  expect(sheet).toContain('>h</t>');
  expect(sheet).toMatch(/<c r="Z\d+" s="8" t="inlineStr"><is><t xml:space="preserve">h<\/t>/);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: global ? "Open Global Team Availability" : "Open Data Factory member availability", exact: true }).click();
  await expect(page.getByRole("button", { name: "Shared Person, 2026-01-14: Available", exact: true })).toBeVisible();
});

test("a failed availability download reports an error and can be retried", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Global Team Availability", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Global member availability", exact: true });
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL); let fail = true;
    URL.createObjectURL = blob => {
      if (fail && blob instanceof Blob && blob.type.includes("spreadsheetml")) { fail = false; throw new Error("Test download failure"); }
      return original(blob);
    };
  });
  const button = dialog.getByRole("button", { name: "Export team availability", exact: true });
  await button.click();
  await expect(dialog.getByRole("alert")).toHaveText("Test download failure");
  await expect(button).toBeEnabled();
  const pending = page.waitForEvent("download"); await button.click();
  expect((await pending).suggestedFilename()).toContain("SCAN_Availability_All_Teams-");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});
