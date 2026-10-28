import { test, expect } from "@playwright/test";
import { planningWorkpackage } from "../src/utils/planningWorkpackage";
import { buildResourcePlanning } from "../src/utils/projectResourcePlanning";
import { buildExpensesPlanning } from "../src/utils/projectExpensesPlanning";
import { planningWorkspace, exportMember, exportPurchase } from "./fixtures/planningWorkspace";
import type { WorkpackageCard } from "../src/types";

const milestones = ["REQF", "FFV", "EFV", "AFV", "SSSR"];
for (const kind of ["fte", "other", "non-fte"] as const) {
  const card = (): WorkpackageCard => ({ id: "test", name: "Test", tool: kind === "other" ? "Other" : "KPI", kind: kind === "non-fte" ? "non-fte" : undefined });
  const targetField = kind === "non-fte" ? "purchaseMilestone" : kind === "other" ? "otherFinishMilestone" : "finishMilestone";
  for (const [index, milestone] of milestones.entries()) {
    test(`planning code follows ${milestone} for ${kind}`, () => {
      expect(planningWorkpackage({ ...card(), [targetField]: milestone })).toBe(`${index + 1}-SYS${index + 1}xx`);
    });
    test(`release series ${index + 1} overrides target for ${kind}`, () => {
      for (const offset of [0, 20, 90]) expect(planningWorkpackage({ ...card(), [targetField]: "EFV", systemRelease: (index + 1) * 100 + offset })).toBe(`${index + 1}-SYS${index + 1}xx`);
    });
  }
  test(`unbound or null release defaults to SYS1xx for ${kind}`, () => {
    expect(planningWorkpackage(card())).toBe("1-SYS1xx");
    expect(planningWorkpackage({ ...card(), systemRelease: null, [targetField]: null })).toBe("1-SYS1xx");
    expect(planningWorkpackage({ ...card(), systemRelease: null, [targetField]: "AFV" })).toBe("4-SYS4xx");
  });
}
test("internal rows split by resolved SYS series and merge releases within the same series, preserving hours", () => {
  const options = planningWorkspace(); options.members = [exportMember("a")];
  options.cards = [120, 190, 590].map((systemRelease, i) => ({ ...options.cards[0], id: `wp${i}`, systemRelease, memberMonthlyAssignments: { a: { 0: 0.5, 1: 0.5 } } }));
  const before = JSON.stringify(options);
  const plan = buildResourcePlanning(options);
  const engineering = plan.rows.filter(row => !row.management);
  expect(engineering).toHaveLength(4); // allocated and unmet, for each SYS group
  expect(engineering.filter(row => row.workpackage === "1-SYS1xx").reduce((sum, row) => sum + row.hours, 0)).toBe(640);
  expect(engineering.filter(row => row.workpackage === "5-SYS5xx").reduce((sum, row) => sum + row.hours, 0)).toBe(320);
  expect(JSON.stringify(options)).toBe(before);
});
test("external salary rows split by SYS series while purchases follow their own target or release", async () => {
  const options = planningWorkspace(); options.members = [exportMember("ext", "PRA", { isExternal: true, monthlySalaryCost: 1000, monthlySalaryCurrency: "EUR" })];
  const source = options.cards[0];
  options.cards = [120, 190, 590].map((systemRelease, i) => ({ ...source, id: `wp${i}`, systemRelease, memberMonthlyAssignments: { ext: { 0: 0.25, 1: 0.25 } } }));
  options.cards = [...options.cards, exportPurchase({ id: "purchase1", purchaseMilestone: "AFV" }), exportPurchase({ id: "purchase2", purchaseMilestone: "FFV", systemRelease: 590 })];
  const before = JSON.stringify(options);
  const plan = await buildExpensesPlanning(options, new AbortController().signal);
  const salaries = plan.rows.filter(row => row.outsourced === "yes");
  expect(salaries).toHaveLength(2);
  expect(salaries.find(row => row.workpackage === "1-SYS1xx")!.months.reduce((a, b) => a + b, 0)).toBe(1000);
  expect(salaries.find(row => row.workpackage === "5-SYS5xx")!.months.reduce((a, b) => a + b, 0)).toBe(500);
  expect(plan.rows.filter(row => row.expenseType === "License").map(row => row.workpackage).sort()).toEqual(["4-SYS4xx", "5-SYS5xx"]);
  expect(JSON.stringify(options)).toBe(before);
});
