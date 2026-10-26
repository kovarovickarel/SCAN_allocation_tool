import { test, expect } from "@playwright/test";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import { getDefaultMilestones } from "../src/utils/helpers";
import { buildPlanningExport } from "../src/utils/portfolioPlanning";

for (const count of [1, 4, 5, 8, 9, 11, 12, 13, 18]) test(`all-project workbook preserves calendars, colours and shifted totals (${count} projects)`, async ({ page }) => {
  const data = historyWorkspace();
  data.projects = Array.from({ length: count }, (_, index) => ({ ...data.projects[0], id: `p${index}`, name: `Project ${index}`,
    projectClass: index % 2 ? "P2" : "P1", startDate: index === 0 ? "2026-03" : "2026-01", duration: count === 5 ? 72 : 6,
    milestones: getDefaultMilestones(count === 5 ? 72 : 6), mgmtMemberMonthlyAssignments: {} }));
  data.workpackages = data.projects.flatMap(project => [
    { ...data.workpackages[0], id: `${project.id}-fte`, projectId: project.id, otherStartMonth: 1, otherFinishMilestone: null },
    { ...data.workpackages[1], id: `${project.id}-purchase`, projectId: project.id, name: `Purchase ${project.id}` },
  ]);
  await page.goto("/");
  const result = await page.evaluate(async ({ data, count }) => {
    // @ts-ignore Vite serves these source modules to the browser.
    const { createProjectPlanningXlsx } = await import("/src/utils/projectPlanningXlsx.ts");
    // @ts-ignore Browser module, not a Node filesystem import.
    const { buildPlanningExport } = await import("/src/utils/portfolioPlanning.ts");
    // @ts-ignore Browser module supplied by Vite.
    const { unzipSync, strFromU8 } = await import("/tests/fixtures/planningExport.ts");
    const template = new Uint8Array(await (await fetch("/templates/project-planning.xlsx")).arrayBuffer());
    const options = { projects: data.projects, cards: data.workpackages, members: data.teamMembers, configuration: data.configuration };
    const original = JSON.stringify(options), now = new Date("2026-10-26T10:05:00Z"), signal = new AbortController().signal;
    const output = await createProjectPlanningXlsx(options, template, signal, now);
    const plan = await buildPlanningExport(options, signal, now);
    const archive = unzipSync(output.bytes);
    const parse = (name: string) => new DOMParser().parseFromString(strFromU8(archive[name]), "application/xml");
    const resource = parse("xl/worksheets/sheet1.xml"), expenses = parse("xl/worksheets/sheet2.xml"), styles = parse("xl/styles.xml");
    const cell = (sheet: Document, ref: string) => Array.from(sheet.getElementsByTagName("c")).find(cell => cell.getAttribute("r") === ref)!;
    const strings = Array.from(parse("xl/sharedStrings.xml").getElementsByTagName("si")).map(entry => entry.textContent ?? "");
    const text = (sheet: Document, ref: string) => {
      const entry = cell(sheet, ref);
      return entry?.getAttribute("t") === "s" ? strings[Number(entry.textContent)] : entry?.textContent ?? "";
    };
    const fill = (sheet: Document, ref: string) => {
      const xf = styles.getElementsByTagName("cellXfs")[0].children[Number(cell(sheet, ref)?.getAttribute("s"))];
      return styles.getElementsByTagName("fills")[0].children[Number(xf?.getAttribute("fillId"))]?.getElementsByTagName("fgColor")[0]?.getAttribute("rgb");
    };
    const rs = Math.max(0, count - 12), es = Math.max(0, count - 8), first = 19 + rs, expenseFirst = 14 + es;
    const colours = plan.projects.map((_: unknown, index: number) => fill(resource, `${index === 0 && count > 1 ? "V" : "T"}${index + 3}`));
    const namesMatch = plan.resource.rows.every((row: any, index: number) => fill(resource, `H${first + index}`) === colours[row.projectIndex]
      && text(resource, `H${first + index}`) === plan.projects[row.projectIndex].label);
    const expensesMatch = plan.expenses.rows.every((row: any, index: number) => fill(expenses, `G${expenseFirst + index}`) === colours[row.projectIndex]
      && text(expenses, `G${expenseFirst + index}`) === plan.projects[row.projectIndex].label);
    // The first project begins two months after the earliest project when exporting multiple projects.
    const early = count > 1 ? { grey: cell(resource, "T3").getAttribute("s"), blank: text(resource, "T3"), kickoff: text(resource, "V3") } : null;
    const column = (index: number) => {
      let result = "";
      while (index > 0) { index--; result = String.fromCharCode(65 + index % 26) + result; index = Math.floor(index / 26); }
      return result;
    };
    const unusedRowsGrey = [resource, expenses].every((sheet, index) => {
      const lastRow = index ? 10 + es : 14 + rs;
      const firstColumn = index ? 17 : 20;
      const calendar = index ? plan.expenses.calendar : plan.resource.calendar;
      for (let row = 3 + count; row <= lastRow; row++) for (let month = 0; month < calendar.length; month++) {
        if (fill(sheet, `${column(firstColumn + month)}${row}`) !== "FFADB9CA") return false;
      }
      return true;
    });
    return { unusedRowsGrey, fileName: output.fileName, unchanged: original === JSON.stringify(options), colours, namesMatch, expensesMatch, early,
      hours: Number(cell(resource, `Q${16 + rs}`).getElementsByTagName("v")[0].textContent),
      expectedHours: plan.resource.rows.reduce((sum: number, row: any) => sum + row.hours, 0),
      resourceFormula: cell(resource, `Q${16 + rs}`).getElementsByTagName("f")[0].textContent,
      expenseFormula: cell(expenses, `P${11 + es}`).getElementsByTagName("f")[0].textContent,
      expenseTotal: Number(cell(expenses, `P${11 + es}`).getElementsByTagName("v")[0].textContent),
      purchaseMonth: Number(cell(expenses, `${count > 1 ? "T" : "R"}${expenseFirst}`).getElementsByTagName("v")[0]?.textContent),
      panes: [resource, expenses].map(sheet => sheet.getElementsByTagName("pane")[0].getAttribute("topLeftCell")),
      resourceRows: plan.resource.rows.length, expenseRows: plan.expenses.rows.length,
      noteRange: Array.from(resource.getElementsByTagName("mergeCell")).map(merge => merge.getAttribute("ref")).find(ref => ref?.startsWith("G")),
      noteText: text(resource, `G${Math.max(14, count + 3)}`),
      blueBelow: fill(resource, `G${Math.max(7, count + 3)}`),
      clearOverlap: count > 4 ? fill(resource, `G${count + 2}`) : null,
      jTop: styles.getElementsByTagName("borders")[0].children[Number(styles.getElementsByTagName("cellXfs")[0]
        .children[Number(cell(resource, `J${17 + rs}`).getAttribute("s"))].getAttribute("borderId"))].getElementsByTagName("top")[0]?.getAttribute("style"),
      siteLookup: cell(resource, `S${first}`).getElementsByTagName("f")[0].textContent,
      validations: Array.from(resource.getElementsByTagName("dataValidation")).map(item => item.getAttribute("sqref")),
      headerHeights: [resource, expenses].map((sheet, index) => Number(Array.from(sheet.getElementsByTagName("row"))
        .find(row => row.getAttribute("r") === String(index ? 13 + es : 18 + rs))?.getAttribute("ht"))),
      wrappedHeaders: [resource, expenses].every((sheet, index) => Array.from(sheet.getElementsByTagName("row"))
        .find(row => row.getAttribute("r") === String(index ? 13 + es : 18 + rs))!.children.length > 0 &&
        Array.from(Array.from(sheet.getElementsByTagName("row")).find(row => row.getAttribute("r") === String(index ? 13 + es : 18 + rs))!.children)
          .every(cell => styles.getElementsByTagName("cellXfs")[0].children[Number(cell.getAttribute("s"))].getElementsByTagName("alignment")[0]?.getAttribute("wrapText") === "1")),
    };
  }, { data, count });
  const rs = Math.max(0, count - 12), es = Math.max(0, count - 8);
  expect(result.fileName).toBe("SCAN_Projects-26_10_2026_11-05.xlsx");
  expect(result.unchanged).toBe(true);
  expect(result.unusedRowsGrey).toBe(true);
  expect(new Set(result.colours).size).toBe(count);
  expect(result.namesMatch && result.expensesMatch).toBe(true);
  if (count > 1) {
    expect(result.early.grey).toBe("17"); expect(result.early.blank).toBe(""); expect(result.early.kickoff).toContain("KICK OFF");
  }
  expect(result.hours).toBeCloseTo(result.expectedHours, 8);
  expect(result.expenseTotal).toBe(1000 * count);
  expect(result.purchaseMonth).toBe(1000);
  expect(result.resourceFormula).toBe(`SUM(Q${19 + rs}:Q${18 + rs + result.resourceRows})`);
  expect(result.expenseFormula).toBe(`SUM(P${14 + es}:P${13 + es + result.expenseRows})`);
  expect(result.panes).toEqual([`T${19 + rs}`, `Q${14 + es}`]);
  expect(result.noteRange).toBe(`G${Math.max(14, count + 3)}:I${16 + rs}`);
  expect(result.noteText).toBe("NEW\nFILL THIS MANDATORY");
  expect(result.blueBelow).toBe("FF0000FF");
  if (count > 4) expect(result.clearOverlap).toBeUndefined();
  expect(result.jTop).toBe("thin");
  expect(result.siteLookup).toContain("'Site hourly rates'!$C$5:$C$10");
  expect(result.validations).toContain(`H${19 + rs}:I${18 + rs + result.resourceRows}`);
  expect(result.wrappedHeaders).toBe(true);
  expect(result.headerHeights.every(height => height > 15.75)).toBe(true);
});

test("single-project naming and deferred external payments survive shared export planning", async () => {
  const data = historyWorkspace();
  const project = { ...data.projects[0], projectClass: "P2" as const };
  const member = { ...data.teamMembers[0], isExternal: true, monthlySalaryCost: 1000, monthlySalaryCurrency: "EUR",
    deferredPayment: true, paymentDelayMonths: 24 };
  const options = { project, cards: data.workpackages, members: [member], configuration: data.configuration };
  const signal = new AbortController().signal;
  const plan = await buildPlanningExport(options, signal, new Date("2026-10-26T10:05:00Z"));
  expect(plan.exportName).toBe("History project_P2-26_10_2026_11-05");
  expect(plan.projects[0].colour).toBe("E6CFF2");
  expect(plan.resource.calendar).toHaveLength(18);
  expect(plan.expenses.calendar.length).toBeGreaterThan(24);
  const external = plan.expenses.rows.filter(row => row.expenseType === "Contracted Workpackage");
  expect(external.length).toBeGreaterThan(0);
  expect(external.every(row => row.months.slice(0, 24).every(value => value === 0))).toBe(true);
  expect(external.reduce((sum, row) => sum + row.months.reduce((a, b) => a + b, 0), 0)).toBeGreaterThan(0);
});

test("individual exports match portfolio colours for every project position", async () => {
  const data = historyWorkspace();
  const projects = Array.from({ length: 15 }, (_, index) => ({ ...data.projects[0], id: `colour-${index}`,
    name: `Colour ${index}`, projectClass: index % 2 ? "P1" as const : "P2" as const }));
  const common = { cards: [], members: data.teamMembers, configuration: data.configuration };
  const signal = new AbortController().signal, now = new Date();
  const portfolio = await buildPlanningExport({ ...common, projects }, signal, now);
  expect(portfolio.projects.slice(0, 3).map(project => project.colour)).toEqual(["E6CFF2", "FFC8AA", "BFE1F6"]);
  for (const [projectIndex, project] of projects.entries()) {
    const individual = await buildPlanningExport({ ...common, project, projectIndex }, signal, now);
    expect(individual.projects[0].colour).toBe(portfolio.projects[projectIndex].colour);
  }
});

test("empty portfolios and cancelled exports stop without generating a workbook", async () => {
  const data = historyWorkspace();
  const options = { projects: [], cards: data.workpackages, members: data.teamMembers, configuration: data.configuration };
  await expect(buildPlanningExport(options, new AbortController().signal, new Date())).rejects.toThrow("Add a project");
  const controller = new AbortController(); controller.abort();
  await expect(buildPlanningExport({ ...options, projects: data.projects }, controller.signal, new Date())).rejects.toThrow("Export cancelled");
});

test("Export all downloads an XLSX workbook from the main toolbar", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Export all", exact: true });
  await expect(button).toBeVisible();
  const download = page.waitForEvent("download");
  await button.click();
  expect((await download).suggestedFilename()).toMatch(/^SCAN_Projects-\d{2}_\d{2}_\d{4}_\d{2}-\d{2}\.xlsx$/);
  await expect(page.getByRole("button", { name: "Add Project", exact: true })).toBeVisible();
});
