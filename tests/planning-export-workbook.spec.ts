import { test, expect, type Page } from "@playwright/test";
import { planningWorkspace, exportMember, exportPurchase } from "./fixtures/planningWorkspace";
import type { PlanningExportOptions } from "../src/utils/portfolioPlanning";

async function workbook(page: Page, options: PlanningExportOptions, addresses: string[]) {
  await page.goto("/");
  return page.evaluate(async ({ options, addresses }) => {
    // @ts-ignore Vite test-only browser inspector.
    const { inspectPlanningExport } = await import("/tests/fixtures/planningExport.ts");
    return inspectPlanningExport(options, addresses);
  }, { options, addresses });
}

test("resource workbook contains the agreed columns, EUR formulas and independently calculated totals", async ({ page }) => {
  const options = planningWorkspace(); options.members = [exportMember("a", "BIE")];
  options.cards[0].memberMonthlyAssignments = { a: { 0: 1, 1: 1 } };
  const addresses = "BCDEFGHIJKLMNOPQRS".split("").map(col => `${col}19`).concat(["Q16", "S16", "T19", "U19", "V19", "F5", "C6"]);
  const result = await workbook(page, options, addresses);
  const cells = result.sheets[0].cells;
  const values = Object.fromEntries("BCDEFGHIJKLMNOPQR".split("").map(col => [col, cells[`${col}19`].value]));
  expect(values).toEqual({ B: "OK", C: "Trace checker", D: "1 Base", E: "SystemValidation", F: "6 SystemValidation", G: "SysVal",
    H: "P1 Export project", I: "P1 Export project", J: "P1", K: "1-SYS1xx", L: "Data factory TC", M: "LIDAR_Bietigheim",
    N: "SYV-General", O: "Internal", P: "HCC", Q: 320, R: "no" });
  expect(cells.S19.value).toBe(25600); expect(cells.Q16.value).toBe(320); expect(cells.S16.value).toBe(25600);
  expect(cells.S19.formula).toContain("Q19*INDEX('Site hourly rates'!$C$5:$C$10,MATCH(M19");
  expect([cells.T19.value, cells.U19.value, cells.V19.value]).toEqual([1, 1, null]);
  expect(result.missingSites).toEqual([]); expect(result.unchanged).toBe(true);
  expect(result.invalidColours).toEqual([]);
  expect(result.sheetNames).toEqual(["Resource Planning", "Expenses Proj Spec", "Site hourly rates"]);
  expect(result.fileName).toBe("Export project_P1-26_10_2026_11-05.xlsx");
  expect(result.sheets[0].validations.some(item => item.range?.startsWith("B19"))).toBe(false);
  expect(result.sheets[0].validations.every(item => item.arrow === "0")).toBe(true);
  expect(result.names.ExportSites).toBe("'Site hourly rates'!$A$5:$A$10");
});

for (const rate of [null, 0]) test(`hourly rate ${rate} stays distinct from an unavailable or zero cost`, async ({ page }) => {
  const options = planningWorkspace(); options.members = [exportMember("a", "BIE")];
  options.cards[0].memberMonthlyAssignments = { a: { 0: 1, 1: 1 } };
  options.configuration.fteCosts.hourlyRates.BIE = rate;
  const result = await workbook(page, options, ["S19", "S16", "C6"]);
  expect(result.sheets[0].cells.S19.value).toBe(rate === null ? null : 0);
  expect(result.sheets[0].cells.S16.value).toBe(rate === null ? null : 0);
  expect(result.sheets[2].cells.C6.value).toBe(rate);
  expect(result.missingSites).toEqual(rate === null ? ["Bietigheim"] : []);
  expect(result.sheets[0].cells.S19.formula).toContain("COUNT(INDEX");
});

test("unallocated rows retain hours but leave location and cost empty", async ({ page }) => {
  const result = await workbook(page, planningWorkspace(), ["B19", "M19", "P19", "Q19", "S19"]);
  expect(result.sheets[0].cells.B19.value).toBe("no Allocation done");
  expect(result.sheets[0].cells.M19.value).toBe(""); expect(result.sheets[0].cells.P19.value).toBe("");
  expect(result.sheets[0].cells.Q19.value).toBe(320);
  expect(result.sheets[0].cells.S19.value).toBeNull(); expect(result.sheets[0].cells.S19.formula).toBeNull();
});

test("expense workbook preserves currency/header borders, white monthly totals, grouped timeplan and dropdown sources", async ({ page }) => {
  const options = planningWorkspace(); options.cards = [exportPurchase({ purchasePaymentOverrides: { 2: 123.45, 5: 876.55 } })];
  const result = await workbook(page, options, ["A14", "B14", "G14", "H14", "I14", "K14", "L14", "M14", "N14", "O14", "P14", "R14", "U14", "R11", "R12", "R13", "P11"]);
  const expenses = result.sheets[1], cells = expenses.cells;
  expect(cells.A14.value).toBe("OK"); expect(cells.B14.value).toBe("Pipeline");
  expect(cells.G14.value).toBe("P1 Export project"); expect(cells.G14.fill).toBe(cells.H14.fill);
  expect(cells.I14.value).toBe("P1"); expect(cells.K14.value).toBe("");
  expect(cells.L14.value).toBe("License"); expect(cells.M14.value).toBe("no"); expect(cells.N14.value).toBe("NO");
  expect(cells.O14.value).toBe("Export purchase"); expect(cells.O14.top).toBe("thin"); expect(cells.O14.bottom).toBe("thin");
  expect(cells.R14.value).toBe(123.45); expect(cells.U14.value).toBe(876.55);
  expect(cells.P14.value).toBe(1000); expect(cells.P11.value).toBe(1000);
  expect(cells.R11).toMatchObject({ value: 123.45, fill: "FFFFFFFF", font: "FF000000" });
  expect(cells.R12.bottom).toBe("thin");
  expect(expenses.rows.filter(row => row.index <= 11).every(row => row.group === 1 && !row.hidden)).toBe(true);
  expect(expenses.rows.find(row => row.index === 12)!.group).toBe(0);
  expect(expenses.validations).toContainEqual(expect.objectContaining({ range: "G14:H14", source: "ExportProjectName" }));
  expect(result.sheets[0].columns.some(col => col.group === "1" && col.hidden === "1")).toBe(true);
});

test("empty projects produce a usable three-sheet workbook with zero totals", async ({ page }) => {
  const options = planningWorkspace(); options.cards = [];
  const result = await workbook(page, options, ["Q16", "S16", "P11", "T3", "Q3"]);
  expect(result.sheets[0].cells.Q16.value).toBe(0); expect(result.sheets[0].cells.S16.value).toBe(0);
  expect(result.sheets[1].cells.P11.value).toBe(0);
  expect(result.sheetNames).toHaveLength(3); expect(result.missingSites).toEqual([]);
});

test("project and activity text cannot become spreadsheet formulas", async ({ page }) => {
  const options = planningWorkspace(); options.project.name = '=HYPERLINK("https://example.invalid")';
  options.cards = [exportPurchase({ name: '=SUM(1,2) <&> "quoted"' })];
  const result = await workbook(page, options, ["H19", "G14", "O14"]);
  expect(result.sheets[1].cells.G14).toMatchObject({ value: `P1 ${options.project.name}`, formula: null, type: "inlineStr" });
  expect(result.sheets[1].cells.O14).toMatchObject({ value: options.cards[0].name, formula: null, type: "inlineStr" });
});

test("foreign location rates are converted once to editable EUR rates without exposing plan data", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://api.frankfurter.dev/**", route => {
    requests.push(route.request().url());
    return route.fulfill({ json: { base: "CHF", quote: "EUR", rate: 0.5, date: "2026-10-23" } });
  });
  const options = planningWorkspace(); options.configuration.fteCosts.currency = "CHF";
  options.members = [exportMember("a", "BIE")]; options.cards[0].memberMonthlyAssignments = { a: { 0: 1, 1: 1 } };
  const result = await workbook(page, options, ["S19", "B2", "D2", "F2", "C6", "E6"]);
  expect(result.sheets[0].cells.S19.value).toBe(12800);
  expect(result.sheets[2].cells.C6.value).toBe(40); expect(result.sheets[2].cells.E6.value).toBe(80);
  expect(result.sheets[2].cells.B2.value).toBe("CHF"); expect(result.sheets[2].cells.D2.value).toBe(0.5);
  expect(requests).toEqual(["https://api.frankfurter.dev/v2/rate/CHF/EUR"]);
});

for (const invalid of ["unavailable", "zero", "wrong currency"] as const) test(`invalid currency conversion (${invalid}) rejects the workbook`, async ({ page }) => {
  await page.route("https://api.frankfurter.dev/**", route => invalid === "unavailable" ? route.fulfill({ status: 503, body: "Unavailable" })
    : route.fulfill({ json: { base: invalid === "wrong currency" ? "USD" : "CHF", quote: "EUR", rate: invalid === "zero" ? 0 : 1, date: "2026-10-23" } }));
  const options = planningWorkspace(); options.configuration.fteCosts.currency = "CHF";
  await expect(workbook(page, options, [])).rejects.toThrow(/Exchange rate unavailable|Invalid exchange rate/);
});

test("foreign external salary is converted in cash months while the internal sheet excludes that effort", async ({ page }) => {
  await page.route("https://api.frankfurter.dev/**", route => route.fulfill({ json: { base: "USD", quote: "EUR", rate: 0.5, date: "2026-10-23" } }));
  const options = planningWorkspace(); options.members = [exportMember("ext", "PRA", { isExternal: true, monthlySalaryCost: 1000,
    monthlySalaryCurrency: "USD", deferredPayment: true, paymentDelayMonths: 6 })];
  options.cards[0].memberMonthlyAssignments = { ext: { 0: 1, 1: 1 } };
  const result = await workbook(page, options, ["Q16", "P11", "P14", "Q14", "W14", "X14", "V3", "W3"]);
  expect(result.sheets[0].cells.Q16.value).toBe(0);
  expect(result.sheets[1].cells.P14.value).toBe(1000); expect(result.sheets[1].cells.P11.value).toBe(1000);
  expect(result.sheets[1].cells.Q14.value).toBeNull(); expect(result.sheets[1].cells.W14.value).toBe(500); expect(result.sheets[1].cells.X14.value).toBe(500);
  expect(result.sheets[1].cells.V3.value).toContain("SOP"); expect(result.sheets[1].cells.W3.fill).toBe("FFADB9CA");
});

for (const [release, expected] of [[120, "1-SYS1xx"], [290, "2-SYS2xx"], [310, "3-SYS3xx"], [450, "4-SYS4xx"], [590, "5-SYS5xx"]] as const) test(`both workbook tabs export the assigned release series ${release}`, async ({ page }) => {
  const options = planningWorkspace();
  options.cards[0].systemRelease = release;
  options.cards = [...options.cards, exportPurchase({ systemRelease: release, purchaseMilestone: "REQF" })];
  const result = await workbook(page, options, ["K19", "J14"]);
  expect(result.sheets[0].cells.K19.value).toBe(expected);
  expect(result.sheets[1].cells.J14.value).toBe(expected);
  expect(result.unchanged).toBe(true);
});
test("both workbook tabs fall back to their milestone or SYS1xx", async ({ page }) => {
  const options = planningWorkspace();
  options.cards[0].finishMilestone = "SSSR";
  options.cards = [...options.cards, exportPurchase({ purchaseMilestone: "AFV" })];
  let result = await workbook(page, options, ["K19", "J14"]);
  expect(result.sheets[0].cells.K19.value).toBe("5-SYS5xx");
  expect(result.sheets[1].cells.J14.value).toBe("4-SYS4xx");
  options.cards[0].finishMilestone = null; options.cards[1].purchaseMilestone = null;
  result = await workbook(page, options, ["K19", "J14"]);
  expect(result.sheets[0].cells.K19.value).toBe("1-SYS1xx");
  expect(result.sheets[1].cells.J14.value).toBe("1-SYS1xx");
});
