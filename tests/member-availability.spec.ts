import { installWorkspaceSaveCapture, savedWorkspace } from "./fixtures/workspaceSaveCapture";
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { absoluteMonth, applyMemberAbsenceEdits, isWorkingDay, memberMonthAvailability, memberYearAbsenceTotals, membersWithHolidays, removeHolidayAbsences, validCalendarDate } from "../src/utils/memberAvailability";
import { reconcileAvailability } from "../src/utils/availabilityAllocations";
import { externalSalaryCharge, externalSalaryUtilization } from "../src/utils/externalSalaries";
import { allocateTeamByProjectPriority } from "../src/utils/automaticAllocation";
import { createWorkspaceFile, parseWorkspaceFile, serializeWorkspace } from "../src/utils/workspaceFile";
import { getDefaultMilestones } from "../src/utils/helpers";
import { WorkspaceHistory } from "../src/utils/workspaceHistory";
import { calculateProjectSpending } from "../src/utils/projectSpending";
import { historyWorkspace } from "./fixtures/historyWorkspace";
import type { TeamMemberRecord } from "../src/types";

const feb = absoluteMonth("2026-02");
const week = Object.fromEntries([2, 3, 4, 5, 6].map(day => [`2026-02-0${day}`, "vacation" as const]));
const member: TeamMemberRecord = { id: "m", firstName: "Test", lastName: "Member", fte: 1, tool: "KPI", footprint: "PRA", role: "both", absences: week };

test("working-day capacity uses weekday denominators, unions holidays/leave and ignores weekends", () => {
  expect(memberMonthAvailability(member, feb)).toEqual({ capacity: .75, unavailable: .25, factor: .75, workingDays: 20, absentDays: 5 });
  const overlapping = membersWithHolidays([{ ...member, absences: { ...week, "2026-02-07": "sick" } }], { PRA: ["2026-02-02", "2026-02-07", "2026-02-09"] })[0];
  expect(memberMonthAvailability(overlapping, feb).capacity).toBe(.7);
  expect(memberMonthAvailability({ ...member, fte: .6 }, feb).capacity).toBeCloseTo(.45);
  expect(memberMonthAvailability({ ...member, absences: {} }, feb).capacity).toBe(1);
});

test("Cairo works Sunday through Thursday; leap dates and month/year boundaries are exact", () => {
  expect(isWorkingDay("2026-02-01", "CAI")).toBe(true);
  expect(isWorkingDay("2026-02-06", "CAI")).toBe(false);
  expect(isWorkingDay("2026-02-01", "PRA")).toBe(false);
  expect(memberMonthAvailability({ ...member, footprint: "CAI", absences: week }, feb).absentDays).toBe(4);
  expect(validCalendarDate("2024-02-29")).toBe(true);
  expect(validCalendarDate("2026-02-29")).toBe(false);
  expect(memberMonthAvailability({ ...member, absences: { "2024-02-29": "sick" } }, absoluteMonth("2024-02")).absentDays).toBe(1);
  expect(absoluteMonth("2026-12", 1)).toBe(absoluteMonth("2027-01"));
});

test("annual absence totals respect site work weeks, selected year and overlapping public holidays", () => {
  const person = { ...member, absences: { ...week, "2026-02-01": "sick" as const, "2026-02-09": "sick" as const, "2027-02-01": "vacation" as const } };
  expect(memberYearAbsenceTotals(person, 2026)).toEqual({ vacation: 5, sick: 1 });
  expect(memberYearAbsenceTotals({ ...person, footprint: "CAI" }, 2026)).toEqual({ vacation: 4, sick: 2 });
  expect(memberYearAbsenceTotals({ ...person, _siteHolidays: ["2026-02-02", "2026-02-09"] }, 2026)).toEqual({ vacation: 4, sick: 0 });
  expect(memberYearAbsenceTotals(person, 2027)).toEqual({ vacation: 1, sick: 0 });
});

test("other leave reduces available and paid external capacity without consuming vacation or sick days", () => {
  const other = Object.fromEntries(Object.keys(week).map(date => [date, 'other' as const]));
  const person = { ...member, isExternal: true, monthlySalaryCost: 1000, absences: { ...other, '2026-02-07': 'other' as const } };
  expect(memberMonthAvailability(person, feb).capacity).toBe(.75);
  expect(memberYearAbsenceTotals(person, 2026)).toEqual({ vacation: 0, sick: 0 });
  const charge = externalSalaryCharge(person, .25, 'EUR', feb)!;
  expect(charge.capacityFTE).toBe(.75); expect(charge.salary).toBe(750);
  const usage = externalSalaryUtilization({ currency: 'EUR', totalCost: 0, allocatedHours: 40, unpricedHours: 0, missingLocations: [], externalSalaryCharges: { m: charge } });
  expect(usage.unusedFTE).toBe(.5);
  const sibling = { ...person, id: 'sibling', tool: 'Other', absences: {} };
  expect(applyMemberAbsenceEdits([sibling, { ...person, absences: {} }], { m: other })[0].absences).toEqual(other);
  const data = workspace(); data.teamMembers = [{ ...person, isExternal: false }];
  expect(parseWorkspaceFile(serializeWorkspace(data)).data.teamMembers[0].absences['2026-02-02']).toBe('other');
});

test("working-day overrides restore holiday availability and paid salary without counting as leave", () => {
  const person = { ...member, absences: { '2026-02-02': 'working' as const }, _siteHolidays: ['2026-02-02'], isExternal: true, monthlySalaryCost: 1000 };
  expect(memberMonthAvailability(person, feb).capacity).toBe(1);
  expect(memberMonthAvailability({ ...person, absences: {} }, feb).capacity).toBe(.95);
  expect(memberYearAbsenceTotals(person, 2026)).toEqual({ vacation: 0, sick: 0 });
  const charge = externalSalaryCharge(person, .25, 'EUR', feb)!;
  expect(charge.capacityFTE).toBe(1); expect(charge.salary).toBe(1000);
  const result = removeHolidayAbsences([person], { m: person.absences }, { PRA: ['2026-02-02'] });
  expect(result.m['2026-02-02']).toBe('working');
  expect(removeHolidayAbsences([person], { m: person.absences }, { PRA: ['2026-02-02'] }, true).m['2026-02-02']).toBeUndefined();
  const sibling = { ...person, id: 'sibling', tool: 'Other', absences: {} };
  expect(applyMemberAbsenceEdits([sibling, { ...person, absences: {} }], { m: person.absences })[0].absences['2026-02-02']).toBe('working');
  const data = workspace(); data.teamMembers = [{ ...person, isExternal: false }]; data.configuration.sitePublicHolidays = { PRA: ['2026-02-02'] };
  const parsed = parseWorkspaceFile(serializeWorkspace(data)).data;
  expect(parsed.teamMembers[0].absences['2026-02-02']).toBe('working');
  expect(memberMonthAvailability(membersWithHolidays(parsed.teamMembers, parsed.configuration.sitePublicHolidays)[0], feb).capacity).toBe(1);
});

function workspace() {
  const data = historyWorkspace();
  data.projects[0] = { ...data.projects[0], startDate: "2026-02", duration: 12, milestones: getDefaultMilestones(12), mgmtMemberMonthlyAssignments: {} };
  data.teamMembers = [member];
  data.workpackages = [{ id: "a", name: "A", projectId: "p", tool: "Other", otherEffort: 1, otherDuration: 3, otherStartMonth: 1, reusability: "New",
    memberAssignments: { m: .4 }, memberMonthlyAssignments: { m: { 0: .4, 1: .4 } } }];
  return data;
}

test("cross-team leave edits share changed dates, including sickness and erasure, without replacing unrelated leave", () => {
  const members = [{ ...member, absences: {} }, { ...member, id: "sibling", firstName: " test ", lastName: " MEMBER ", tool: "Other",
    absences: { "2027-01-04": "sick" as const } }, { ...member, id: "unrelated", lastName: "Different", absences: {} }];
  const saved = applyMemberAbsenceEdits(members, { m: week });
  expect(saved[0].absences).toEqual(week);
  expect(saved[1].absences).toEqual({ ...week, "2027-01-04": "sick" });
  expect(saved[2]).toBe(members[2]);
  const sick = applyMemberAbsenceEdits(saved, { sibling: { ...saved[1].absences, "2026-02-02": "sick" } });
  expect(sick[0].absences["2026-02-02"]).toBe("sick");
  const draft = { ...sick[0].absences }; delete draft["2026-02-02"];
  const erased = applyMemberAbsenceEdits(sick, { m: draft });
  expect(erased[1].absences["2026-02-02"]).toBeUndefined();
  expect(erased[1].absences["2027-01-04"]).toBe("sick");
  expect(erased[0].absences["2027-01-04"]).toBeUndefined();
});

test("cross-team vacation reduces each team's dedicated FTE and allocations without restoring cancelled leave", () => {
  const data = workspace();
  data.teamMembers = [{ ...member, fte: .4, absences: {} }, { ...member, id: "sibling", tool: "Other", fte: .6, absences: {} }];
  data.workpackages.push({ ...data.workpackages[0], id: "b", memberAssignments: { sibling: .6 }, memberMonthlyAssignments: { sibling: { 0: .6 } } });
  const next = reconcileAvailability({ ...data, teamMembers: applyMemberAbsenceEdits(data.teamMembers, { m: week }) });
  expect(next.workpackages[0].memberMonthlyAssignments.m[0]).toBeCloseTo(.3);
  expect(next.workpackages[1].memberMonthlyAssignments.sibling[0]).toBeCloseTo(.45);
  const cancelled = reconcileAvailability({ ...next, teamMembers: applyMemberAbsenceEdits(next.teamMembers, { sibling: {} }) });
  expect(cancelled.teamMembers.every(value => !Object.keys(value.absences).length)).toBe(true);
  expect(cancelled.workpackages).toEqual(next.workpackages);
});

test("leave proportionally frees every project only when total allocations exceed capacity", () => {
  const data = workspace();
  data.projects.push({ ...data.projects[0], id: "p2", startDate: "2026-01" });
  data.workpackages.push({ ...data.workpackages[0], id: "b", projectId: "p2", memberAssignments: { m: .6 }, memberMonthlyAssignments: { m: { 0: .6, 1: .6, 2: .6 } } });
  const result = reconcileAvailability(data);
  expect(result.workpackages[0].memberMonthlyAssignments.m[0]).toBeCloseTo(.3);
  expect(result.workpackages[1].memberMonthlyAssignments.m[1]).toBeCloseTo(.45);
  expect(result.workpackages[0].memberMonthlyAssignments.m[1]).toBe(.4);
  expect(data.workpackages[0].memberMonthlyAssignments.m[0]).toBe(.4);
  const cancelled = reconcileAvailability({ ...result, teamMembers: [{ ...member, absences: {} }] });
  expect(cancelled.workpackages).toEqual(result.workpackages);
  const under = reconcileAvailability(workspace());
  expect(under.workpackages[0]).toEqual(workspace().workpackages[0]);
});

test("legacy scalar allocations are materialized and site holidays affect all teams at that site", () => {
  const data = workspace(); data.workpackages[0].memberMonthlyAssignments = {};
  data.workpackages[0].memberAssignments = { m: 1 };
  data.teamMembers = [{ ...member, absences: undefined }, { ...member, id: "other", tool: "Other", absences: undefined }];
  data.workpackages.push({ ...data.workpackages[0], id: "other-wp", memberAssignments: { other: 1 } });
  data.configuration.sitePublicHolidays = { PRA: Object.keys(week) };
  const result = reconcileAvailability(data);
  expect(result.workpackages[0].memberMonthlyAssignments.m[0]).toBeCloseTo(.75);
  expect(result.workpackages[1].memberMonthlyAssignments.other[0]).toBeCloseTo(.75);
});

test("salary leave is unpaid rather than unused; allocated cost keeps the original unit rate and delay", () => {
  const external = { ...member, isExternal: true, monthlySalaryCost: 1000, deferredPayment: true, paymentDelayMonths: 12 };
  const charge = externalSalaryCharge(external, .25, "EUR", feb)!;
  expect(charge.salary).toBe(750); expect(charge.capacityFTE).toBe(.75); expect(charge.paymentDelayMonths).toBe(12);
  expect(charge.salary * charge.allocatedFTE / charge.capacityFTE).toBeCloseTo(250);
  const usage = externalSalaryUtilization({ currency: "EUR", totalCost: 0, allocatedHours: 40, unpricedHours: 0, missingLocations: [], externalSalaryCharges: { m: charge } });
  expect(usage.unusedFTE).toBe(.5); expect(usage.unusedCost.externalSalaryCharges.m.salary).toBe(750);
  expect(externalSalaryCharge(external, 0, "EUR", feb)).toBeUndefined();
});

test("spending derives reduced paid capacity in the work month before deferring the salary", () => {
  const data = workspace();
  data.teamMembers[0] = { ...member, isExternal: true, monthlySalaryCost: 1000, monthlySalaryCurrency: "EUR", deferredPayment: true, paymentDelayMonths: 12 };
  data.workpackages[0].memberMonthlyAssignments.m[0] = .25;
  const result = calculateProjectSpending({ project: data.projects[0], cards: data.workpackages, members: data.teamMembers,
    fteCosts: data.configuration.fteCosts, overheads: [] });
  const charge = Object.values(result.monthlyCosts[12].externalSalaryCharges)[0];
  expect(charge.capacityFTE).toBe(.75); expect(charge.salary).toBe(750);
  expect(charge.salary * charge.allocatedFTE / charge.capacityFTE).toBeCloseTo(250);
  expect(result.monthlyCosts[0].allocatedHours).toBe(0);
});

test("automatic allocation uses calendar availability before reserving other project commitments", () => {
  const target = { id: "wp", role: "engineering" as const, months: [{ requiredFTE: 1, isMaintenance: false }], assignments: {} };
  const result = allocateTeamByProjectPriority([{ id: "p", monthOffset: 0, duration: 1, targets: [target] }], [member], 1, { p: 1 }, undefined, feb);
  expect(result.allocations.get("wp").m[0]).toBeCloseTo(.75);
});

test("availability exports, validates and travels in one history action without changing old fixtures", () => {
  const data = workspace(); data.configuration.sitePublicHolidays = { CAI: ["2026-02-01"] };
  const parsed = parseWorkspaceFile(serializeWorkspace(data)).data;
  expect(parsed.teamMembers[0].absences).toEqual(week);
  expect(parsed.configuration.sitePublicHolidays).toEqual(data.configuration.sitePublicHolidays);
  expect(serializeWorkspace({ ...data, teamMembers: membersWithHolidays(data.teamMembers, { PRA: ["2026-02-01"] }) })).not.toContain('_siteHolidays');
  const invalid = createWorkspaceFile(data); invalid.data.teamMembers[0].absences = { "2026-02-30": "sick" };
  expect(() => parseWorkspaceFile(JSON.stringify(invalid))).toThrow(/Member absences/);
  invalid.data.teamMembers[0].absences = {}; invalid.data.configuration.sitePublicHolidays = { PRA: ["not-a-date"] };
  expect(() => parseWorkspaceFile(JSON.stringify(invalid))).toThrow(/Site public holidays/);
  const historical = parseWorkspaceFile(readFileSync('tests/fixtures/workspace-compatibility/baseline-v1.json', 'utf8'));
  expect(historical.data.teamMembers.every(value => !value.absences)).toBe(true);
  const { view, ...before } = workspace(); before.teamMembers = [{ ...member, absences: {} }]; before.workpackages[0].memberAssignments = { m: 1 }; before.workpackages[0].memberMonthlyAssignments = {};
  const history = new WorkspaceHistory(before);
  history.run("Save member availability", () => {
    const next = reconcileAvailability({ ...history.present, teamMembers: [member] });
    history.set("teamMembers", next.teamMembers, ""); history.set("workpackages", next.workpackages, "");
  });
  expect(history.past).toHaveLength(1); expect(history.present.workpackages[0].memberMonthlyAssignments.m[0]).toBeCloseTo(.75);
  history.undo(); expect(history.present.teamMembers[0].absences).toEqual({});
  history.redo(); expect(history.present.teamMembers[0].absences).toEqual(week);
});

async function load(page: Page, theme: "vibrant" | "basic" | "retro", multiSite = false) {
  // Existing interaction scenarios start from a remembered January 2026 view.
  await page.addInitScript(() => localStorage.setItem("scan-availability-position:Other", JSON.stringify({ year: 2026, left: 0, top: 0 })));
  const data = workspace(); data.teamMembers[0] = { ...member, tool: "Other", absences: {} };
  if (multiSite) data.teamMembers.push({ ...member, id: "bie", firstName: "Site", lastName: "Member", tool: "Other", footprint: "BIE", fte: .5, absences: {} });
  data.view.activeToolView = "Other"; data.view.theme = theme;
  await page.goto('/');
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "calendar.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await page.getByRole("button", { name: "Open Other member availability", exact: true }).click();
  return page.getByRole('dialog', { name: 'Other member availability' });
}

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`working on a public holiday is marked, shared across teams and undoable (${theme})`, async ({ page }) => {
  const data = workspace(); data.view.activeToolView = 'Other';
  data.teamMembers = [{ ...member, tool: 'Other', absences: {} }, { ...member, id: 'sibling', tool: 'KPI', absences: {} }];
  data.configuration.sitePublicHolidays = { PRA: ['2026-02-02', '2026-02-03'] };
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'holiday-work.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Other member availability' });
  await dialog.getByRole('button', { name: 'Working day', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Public holiday', exact: true }).press('Space');
  const exception = dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Working on public holiday', exact: true });
  await expect(exception).toHaveText('W');
  await expect(exception).toHaveCSS('box-shadow', 'none');
  await expect(exception).toHaveCSS('color', 'rgb(22, 101, 52)');
  await expect(exception).toHaveCSS('background-color', 'rgb(134, 239, 172)');
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Public holiday', exact: true })).toHaveCount(1);
  await exception.press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Public holiday', exact: true })).toHaveCount(1);
  // Drag across two holidays, outside the row, retaining the individual exception scope.
  const first = dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Public holiday', exact: true });
  const last = dialog.getByRole('button', { name: 'Test Member, 2026-02-03: Public holiday', exact: true });
  await last.scrollIntoViewIfNeeded();
  const from = await first.boundingBox(), to = await last.boundingBox();
  await page.mouse.move(from.x + 12, from.y + 12); await page.mouse.down();
  await page.mouse.move(to.x + 12, page.viewportSize()!.height - 5, { steps: 8 }); await page.mouse.up();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-03: Working on public holiday', exact: true })).toHaveCount(1);
  await expect(dialog.locator('[title^="Test Member · both"]')).toHaveAttribute('title', /2: 1\.00 FTE/);
  // Turning a site holiday off and back on must not restore its working exception.
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Public holiday', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Available', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Public holiday', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Public holiday', exact: true }).press('Space');
  // The all-sites header follows the same reset rule.
  await dialog.getByRole('button', { name: 'Remove public holiday from shown sites on 2026-02-03', exact: true }).click();
  await dialog.getByRole('button', { name: 'Apply public holiday to shown sites on 2026-02-03', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-03: Public holiday', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-03: Public holiday', exact: true }).press('Space');
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByRole('button', { name: 'KPI Team View', exact: true }).click();
  await page.getByRole('button', { name: 'Open KPI member availability', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'KPI member availability' });
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Working on public holiday', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Open KPI member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Public holiday', exact: true })).toHaveCount(1);
});

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`other leave is individual, retains JSON/history and uses the leave palette (${theme})`, async ({ page }) => {
  await page.addInitScript(() => {
    let saved = '';
    Object.defineProperty(window, '__otherLeaveSavedJson', { get: () => saved });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => ({ createWritable: async () => ({
      write: async (blob: Blob) => { saved = await blob.text(); }, close: async () => {}, abort: async () => {},
    }) }) });
  });
  const dialog = await load(page, theme);
  await dialog.getByRole('button', { name: 'Other leave', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Available', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Apply public holiday to shown sites on 2026-02-02', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-07: Weekend', exact: true })).toBeDisabled();
  const friday = dialog.getByRole('button', { name: 'Test Member, 2026-02-06: Available', exact: true });
  const monday = dialog.getByRole('button', { name: 'Test Member, 2026-02-09: Available', exact: true });
  await monday.scrollIntoViewIfNeeded();
  const from = await friday.boundingBox(), to = await monday.boundingBox();
  await page.mouse.move(from.x + 12, from.y + 12); await page.mouse.down();
  await page.mouse.move(to.x + 12, to.y + 12, { steps: 12 }); await page.mouse.up();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-09: Other leave', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-07: Weekend', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-08: Weekend', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Other leave', exact: true })).toHaveCSS('background-color', 'rgb(254, 215, 170)');
  await expect(dialog.getByRole('group', { name: 'Test Member leave totals for 2026', exact: true })).toHaveText('V: 0S: 0');
  await dialog.getByRole('button', { name: 'Vacation', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-03: Available', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-03: Vacation', exact: true })).toHaveCSS('background-color', 'rgb(251, 113, 133)');
  await dialog.getByRole('button', { name: 'Sick leave', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-04: Available', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-04: Sick leave', exact: true })).toHaveCSS('background-color', 'rgb(56, 189, 248)');
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-05: Available', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-05: Public holiday', exact: true })).toHaveCSS('background-color', 'rgb(134, 239, 172)');
  await dialog.getByRole('button', { name: 'Other leave', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-05: Public holiday', exact: true }).press('Space');
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  const savedJson = () => page.evaluate(() => Reflect.get(window, '__otherLeaveSavedJson') as string);
  await expect.poll(savedJson).not.toBe('');
  const saved = parseWorkspaceFile(await savedJson()).data;
  expect(saved.teamMembers[0].absences['2026-02-02']).toBe('other');
  expect(saved.teamMembers[0].absences['2026-02-07']).toBeUndefined();
  expect(saved.teamMembers[0].absences['2026-02-08']).toBeUndefined();
  expect(saved.teamMembers[0].absences['2026-02-09']).toBe('other');
  expect(saved.teamMembers[0].absences['2026-02-05']).toBeUndefined();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Other leave', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Working day', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-09: Other leave', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-09: Available', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-07: Weekend', exact: true })).toHaveCount(1);
});

test("Other leave skips Cairo Friday/Saturday weekends and allows Sunday", async ({ page }) => {
  const data = workspace(); data.view.activeToolView = 'Other'; data.teamMembers = [{ ...member, footprint: 'CAI', tool: 'Other', absences: {} }];
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'cairo-calendar.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Other member availability' });
  await dialog.getByRole('button', { name: 'Other leave', exact: true }).click();
  for (const day of ['06', '07']) await expect(dialog.getByRole('button', { name: `Test Member, 2026-02-${day}: Weekend`, exact: true })).toBeDisabled();
  const first = dialog.getByRole('button', { name: 'Test Member, 2026-02-05: Available', exact: true });
  const last = dialog.getByRole('button', { name: 'Test Member, 2026-02-08: Available', exact: true });
  await last.scrollIntoViewIfNeeded();
  const from = await first.boundingBox(), to = await last.boundingBox();
  await page.mouse.move(from.x + 12, from.y + 12); await page.mouse.down();
  await page.mouse.move(to.x + 12, to.y + 12, { steps: 12 }); await page.mouse.up();
  for (const day of ['05', '08']) await expect(dialog.getByRole('button', { name: `Test Member, 2026-02-${day}: Other leave`, exact: true })).toHaveCount(1);
  for (const day of ['06', '07']) await expect(dialog.getByRole('button', { name: `Test Member, 2026-02-${day}: Weekend`, exact: true })).toHaveCount(1);
});

for (const kind of ['member', 'site', 'header'] as const) test(`edge dragging automatically scrolls the ${kind} calendar selection and stops on release`, async ({ page }) => {
  const dialog = await load(page, 'vibrant', true);
  const calendar = dialog.getByTestId('availability-calendar');
  const initial = dialog.getByRole('button', { name: kind === 'header' ? 'Apply public holiday to shown sites on 2026-01-20'
    : `${kind === 'site' ? 'Prague public holiday' : 'Test Member'}, 2026-01-20: Available`, exact: true });
  const start = await initial.boundingBox(), frame = await calendar.boundingBox();
  const position = () => calendar.evaluate(el => el.scrollLeft);
  await page.mouse.move(start.x + 12, start.y + start.height / 2); await page.mouse.down();
  // Above/below the calendar alone is not horizontal exit.
  for (const [x, y] of [[frame.x + frame.width / 2, 3], [frame.x + frame.width / 2, frame.y + frame.height + 5]]) {
    await page.mouse.move(x, y); await page.waitForTimeout(120);
    expect(await position()).toBe(0);
  }
  const rightX = Math.min(page.viewportSize()!.width - 2, frame.x + frame.width + 15);
  await page.mouse.move(rightX, 3, { steps: 8 });
  await expect.poll(position).toBeGreaterThan(120);
  // A stationary pointer must continue extending the original row as scrolling advances.
  await expect(dialog.getByRole('button', { name: `Test Member, 2026-02-12: ${kind === 'member' ? 'Vacation' : 'Public holiday'}`, exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: `Site Member, 2026-02-12: ${kind === 'header' ? 'Public holiday' : 'Available'}`, exact: true })).toHaveCount(1);
  // Entering the member-label column already crosses the left day-grid boundary.
  await page.mouse.move(frame.x + 280, 3, { steps: 8 });
  await expect.poll(position).toBe(0);
  await page.mouse.move(rightX, 3, { steps: 8 });
  await expect.poll(position).toBeGreaterThan(120);
  await page.mouse.up();
  const stoppedAt = await position();
  await page.waitForTimeout(150); // Verify no animation frame continues scrolling after release.
  expect(await position()).toBe(stoppedAt);
});

for (const kind of ['member', 'site', 'header'] as const) test(`dragging outside the ${kind} row follows horizontal position and remains on the original row`, async ({ page }) => {
  const dialog = await load(page, 'vibrant', true);
  const cell = (day: string, status = 'Available') => dialog.getByRole('button', { name: kind === 'header'
    ? `Apply public holiday to shown sites on 2026-02-${day}`
    : `${kind === 'site' ? 'Prague public holiday' : 'Test Member'}, 2026-02-${day}: ${status}`, exact: true });
  await cell('06').scrollIntoViewIfNeeded();
  const first = await cell('02').boundingBox(), last = await cell('06').boundingBox();
  await page.mouse.move(first.x + 12, first.y + first.height / 2); await page.mouse.down();
  await page.mouse.move(last.x + 12, page.viewportSize()!.height - 3, { steps: 10 });
  const marked = kind === 'member' ? 'Vacation' : 'Public holiday';
  await expect(dialog.getByRole('button', { name: `Test Member, 2026-02-06: ${marked}`, exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: `Site Member, 2026-02-06: ${kind === 'header' ? 'Public holiday' : 'Available'}`, exact: true })).toHaveCount(1);
  const middle = await cell('03', marked).boundingBox();
  await page.mouse.move(middle.x + 12, 3, { steps: 10 });
  await expect(dialog.getByRole('button', { name: `Test Member, 2026-02-03: ${marked}`, exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-06: Available', exact: true })).toHaveCount(1);
  await page.mouse.up();
  await page.mouse.move(last.x + 12, first.y + first.height / 2);
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-06: Available', exact: true })).toHaveCount(1);
});

for (const [kind, label] of [['vacation', 'Vacation'], ['sick', 'Sick leave'], ['other', 'Other leave']] as const) test(`starting on existing ${kind} clears mixed leave during the drag without changing public holidays`, async ({ page }) => {
  const data = workspace(); data.view.activeToolView = 'Other';
  data.teamMembers = [{ ...member, tool: 'Other', absences: { '2026-02-02': kind, '2026-02-03': kind === 'sick' ? 'vacation' : 'sick',
    '2026-02-04': kind === 'other' ? 'vacation' : 'other', '2026-02-09': 'working' } }];
  data.configuration.sitePublicHolidays = { PRA: ['2026-02-05', '2026-02-09'] };
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'mixed-leave.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Other member availability' });
  await dialog.getByRole('button', { name: label, exact: true }).click();
  const cell = (day: string, status: string) => dialog.getByRole('button', { name: `Test Member, 2026-02-${day}: ${status}`, exact: true });
  await cell('02', label).press('Space');
  await expect(cell('02', 'Available')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Working day', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await cell('02', 'Available').press('Space');
  const last = cell('09', 'Working on public holiday'); await last.scrollIntoViewIfNeeded();
  const from = await cell('02', label).boundingBox(), to = await last.boundingBox();
  await page.mouse.move(from.x + 12, from.y + 12); await page.mouse.down();
  await expect(dialog.getByRole('button', { name: 'Working day', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.move(to.x + 12, page.viewportSize()!.height - 5, { steps: 20 });
  await expect(dialog.getByRole('button', { name: 'Working day', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  for (const day of ['02', '03', '04', '06']) await expect(cell(day, 'Available')).toHaveCount(1);
  await expect(cell('05', 'Public holiday')).toHaveCount(1);
  await expect(cell('09', 'Working on public holiday')).toHaveCount(1);
  for (const day of ['07', '08']) await expect(cell(day, 'Weekend')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
  // The next gesture adds leave again rather than retaining the automatic erase mode.
  await cell('06', 'Available').press('Space');
  await expect(cell('06', label)).toHaveCount(1);
});

test("Working day keeps public-holiday click and drag toggling while clearing individual leave", async ({ page }) => {
  const dialog = await load(page, 'vibrant', true);
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true }).press('Space');
  await dialog.getByRole('button', { name: 'Working day', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Vacation', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Available', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Public holiday', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Public holiday', exact: true }).press('Space');
  const add = dialog.getByRole('button', { name: 'Apply public holiday to shown sites on 2026-02-03', exact: true });
  await add.click();
  for (const site of ['Prague', 'Bietigheim']) await expect(dialog.getByRole('button', { name: `${site} public holiday, 2026-02-03: Public holiday`, exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Remove public holiday from shown sites on 2026-02-03', exact: true }).click();
  for (const site of ['Prague', 'Bietigheim']) await expect(dialog.getByRole('button', { name: `${site} public holiday, 2026-02-03: Available`, exact: true })).toHaveCount(1);
  const dragSite = async (status: string) => {
    const first = dialog.getByRole('button', { name: `Prague public holiday, 2026-02-09: ${status}`, exact: true });
    const last = dialog.getByRole('button', { name: `Prague public holiday, 2026-02-11: ${status}`, exact: true });
    await last.scrollIntoViewIfNeeded();
    const from = await first.boundingBox(), to = await last.boundingBox();
    await page.mouse.move(from.x + 12, from.y + 10); await page.mouse.down();
    await page.mouse.move(to.x + 12, to.y + 10, { steps: 8 }); await page.mouse.up();
  };
  await dragSite('Available');
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-10: Public holiday', exact: true })).toHaveCount(1);
  await dragSite('Public holiday');
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-10: Available', exact: true })).toHaveCount(1);
});

test("removing public holidays never restores overwritten leave, including members in other teams at that site", async ({ page }) => {
  await installWorkspaceSaveCapture(page);
  const data = workspace(); data.view.activeToolView = 'Other';
  data.teamMembers = [{ ...member, tool: 'Other', absences: { '2026-02-02': 'vacation', '2026-02-03': 'sick' } },
    { ...member, id: 'bie', firstName: 'BIE', tool: 'Other', footprint: 'BIE', absences: { '2026-02-02': 'vacation', '2026-02-03': 'vacation' } },
    { ...member, id: 'hidden', firstName: 'Other', tool: 'KPI', absences: { '2026-02-02': 'sick' } }];
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'overwritten-leave.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Other member availability' });
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Available', exact: true }).press('Space');
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Public holiday', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'BIE Member, 2026-02-02: Vacation', exact: true })).toHaveCount(1);
  const allSites = dialog.getByRole('button', { name: 'Apply public holiday to shown sites on 2026-02-03', exact: true });
  await allSites.click(); await allSites.click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-03: Available', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'BIE Member, 2026-02-03: Available', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  const saved = await savedWorkspace(page);
  expect(saved.teamMembers.find(person => person.id === 'm').absences).toEqual({});
  expect(saved.teamMembers.find(person => person.id === 'hidden').absences).toEqual({});
  expect(saved.teamMembers.find(person => person.id === 'bie').absences).toEqual({ '2026-02-02': 'vacation' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Vacation', exact: true })).toHaveCount(1);
});

test("availability names abbreviate first and then last names around tags without ellipsis", async ({ page }) => {
  const data = workspace(); data.workpackages = []; data.view.activeToolView = 'Other';
  data.teamMembers = [{ ...member, id: 'short', firstName: 'Elena', lastName: 'Russo', tool: 'Other', absences: {} },
    { ...member, id: 'first', firstName: 'Alexandrianna', lastName: 'Novak', tool: 'Other', absences: {} },
    { ...member, id: 'both', firstName: 'Alexandrianna', lastName: 'Vonderlangenbergh', tool: 'Other', absences: {}, isExternal: true, supplierId: 'supplier-luxoft', monthlySalaryCost: 5000 }];
  data.teamMembers.push(...data.teamMembers.slice(1).map(person => ({ ...person, id: `${person.id}-other`, tool: 'KPI' })));
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'availability-names.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Other member availability' });
  for (const [full, shortened] of [['Elena Russo', 'Elena Russo'], ['Alexandrianna Novak', 'A. Novak'], ['Alexandrianna Vonderlangenbergh', 'A. V.']]) {
    const name = dialog.locator(`span[aria-label="${full}"]`);
    await expect.poll(() => name.evaluate(el => el.firstChild?.textContent)).toBe(shortened);
    await expect(name).toHaveAttribute('title', full);
    expect(await name.evaluate(el => {
      const range = document.createRange(); range.selectNode(el.firstChild!);
      return range.getBoundingClientRect().width <= el.getBoundingClientRect().width + .1;
    })).toBe(true);
  }
});

test("header days drag to apply and erase holidays only for shown sites, including collapsed sites", async ({ page }) => {
  await installWorkspaceSaveCapture(page);
  const data = workspace(); data.view.activeToolView = 'Other';
  data.teamMembers = [{ ...member, tool: 'Other', absences: {} }, { ...member, id: 'bie', firstName: 'BIE', tool: 'Other', footprint: 'BIE', absences: {} },
    { ...member, id: 'cai', firstName: 'CAI', tool: 'KPI', footprint: 'CAI', absences: {} }];
  data.configuration.sitePublicHolidays = { TOK: ['2026-02-02'], CAI: ['2026-01-01'], PRA: ['2026-01-01'], BIE: ['2026-02-10'] };
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'header-holidays.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Other member availability' });
  await dialog.getByRole('button', { name: 'Toggle Bietigheim members', exact: true }).click();
  const headerDay = dialog.getByRole('button', { name: 'Apply public holiday to shown sites on 2026-02-02', exact: true });
  const partial = dialog.getByRole('button', { name: 'Apply public holiday to shown sites on 2026-01-01', exact: true });
  await expect(partial).toHaveAttribute('aria-pressed', 'mixed');
  const neutralColor = await headerDay.evaluate(el => getComputedStyle(el).color);
  expect(await partial.evaluate(el => getComputedStyle(el).color)).toBe(neutralColor);
  const dragHeader = async (verb: string) => {
    const from = dialog.getByRole('button', { name: `${verb} public holiday ${verb === 'Apply' ? 'to' : 'from'} shown sites on 2026-02-02`, exact: true });
    const to = dialog.getByRole('button', { name: `${verb} public holiday ${verb === 'Apply' ? 'to' : 'from'} shown sites on 2026-02-08`, exact: true });
    await to.scrollIntoViewIfNeeded();
    const first = await from.boundingBox(), last = await to.boundingBox();
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2); await page.mouse.down();
    await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 16 }); await page.mouse.up();
  };
  await dragHeader('Apply'); await expect(headerDay).toHaveAttribute('aria-pressed', 'true');
  expect(await headerDay.evaluate(el => getComputedStyle(el).color)).not.toBe(neutralColor);
  for (const site of ['Prague', 'Bietigheim']) await expect(dialog.getByRole('button', { name: `${site} public holiday, 2026-02-02: Public holiday`, exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  const holidays = (await savedWorkspace(page)).configuration.sitePublicHolidays;
  const range = Array.from({ length: 7 }, (_, index) => `2026-02-0${index + 2}`);
  expect(holidays).toEqual({ PRA: ['2026-01-01', ...range], BIE: [...range, '2026-02-10'], TOK: ['2026-02-02'], CAI: ['2026-01-01'] });
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Other member availability' });
  await dragHeader('Apply'); // Starting on an occupied header cell latches erase for the drag.
  for (const site of ['Prague', 'Bietigheim']) await expect(dialog.getByRole('button', { name: `${site} public holiday, 2026-02-02: Available`, exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-08: Weekend', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Bietigheim public holiday, 2026-02-10: Public holiday', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Apply public holiday to shown sites on 2026-02-02', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test("month arrows scroll to adjacent months, respect year boundaries and keep labels fixed", async ({ page }) => {
  const dialog = await load(page, 'vibrant');
  const calendar = dialog.getByTestId('availability-calendar');
  const position = () => calendar.evaluate(el => el.scrollLeft);
  await expect(dialog.getByRole('button', { name: 'Previous month from January', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Next month from December', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Next month from January', exact: true }).click();
  await expect.poll(position).toBe(31 * 24);
  await expect(dialog.locator('[title^="Test Member · both"]')).toBeInViewport();
  await dialog.getByRole('button', { name: 'Next month from February', exact: true }).click();
  await expect.poll(position).toBe(59 * 24);
  await dialog.getByRole('button', { name: 'Previous month from March', exact: true }).click();
  await expect.poll(position).toBe(31 * 24);
  await dialog.getByRole('button', { name: 'Previous month from February', exact: true }).click();
  await expect.poll(position).toBe(0);
  await dialog.getByRole('button', { name: 'Previous year', exact: true }).click();
  await dialog.getByRole('button', { name: 'Previous year', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next month from February', exact: true }).click();
  await expect.poll(position).toBe(60 * 24);
});

test("annual leave counters use the requested vacation thresholds, bold overflow and sick-leave colours", async ({ page }) => {
  const data = workspace(); data.workpackages = []; data.view.activeToolView = "Other";
  const working = Array.from({ length: 300 }, (_, day) => new Date(Date.UTC(2026, 0, day + 1)).toISOString().slice(0, 10)).filter(date => isWorkingDay(date, "PRA"));
  const bands: [number, string][] = [[0, 'rgb(239, 68, 68)'], [10, 'rgb(239, 68, 68)'], [11, 'rgb(249, 115, 22)'], [20, 'rgb(249, 115, 22)'],
    [21, 'rgb(234, 179, 8)'], [25, 'rgb(234, 179, 8)'], [26, 'rgb(134, 239, 172)'], [29, 'rgb(134, 239, 172)'], [30, 'rgb(22, 163, 74)'], [31, 'rgb(153, 27, 27)']];
  data.teamMembers = bands.map(([count]) => ({ ...member, id: `band-${count}`, firstName: 'Days', lastName: String(count), tool: 'Other',
    absences: Object.fromEntries([...working.slice(0, count).map(date => [date, 'vacation' as const]), ...working.slice(100, 100 + Math.min(count, 11)).map(date => [date, 'sick' as const])]) }));
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'leave-bands.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  for (const [count, color] of bands) {
    const group = page.getByRole('group', { name: `Days ${count} leave totals for 2026`, exact: true });
    const vacation = group.locator('> span').nth(0).locator('span');
    const sick = group.locator('> span').nth(1).locator('span');
    await expect(vacation).toHaveText(String(count)); await expect(vacation).toHaveCSS('color', color);
    await expect(vacation).toHaveCSS('font-weight', count > 30 ? '900' : '700');
    await expect(vacation).toHaveCSS('font-size', '13px');
    await expect(sick).toHaveText(String(Math.min(count, 11)));
    await expect(sick).toHaveCSS('color', count <= 10 ? 'rgb(56, 189, 248)' : 'rgb(29, 78, 216)');
  }
});

for (const theme of ["vibrant", "basic", "retro"] as const) test(`calendar selects ranges, switches years, saves/cancels and shares holidays (${theme})`, async ({ page }, testInfo) => {
  const dialog = await load(page, theme, true);
  await expect(dialog.locator('[title^="Test Member · both"] svg polygon')).toHaveCount(0);
  const prague = dialog.getByRole('button', { name: 'Toggle Prague members', exact: true });
  const bietigheim = dialog.getByRole('button', { name: 'Toggle Bietigheim members', exact: true });
  expect(await prague.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(await bietigheim.evaluate(el => getComputedStyle(el).backgroundColor));
  const pragueTint = await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Available', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor);
  const bieTint = await dialog.getByRole('button', { name: 'Bietigheim public holiday, 2026-02-02: Available', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(pragueTint).not.toBe(bieTint);
  const first = dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true });
  const last = dialog.getByRole('button', { name: 'Test Member, 2026-02-06: Available', exact: true });
  const start = await first.boundingBox(), end = await last.boundingBox();
  expect(start.width).toBe(24); expect(start.height).toBe(24);
  const memberRow = await first.locator('..').boundingBox();
  expect(memberRow.height).toBe(start.height); expect(memberRow.y).toBe(start.y);
  await page.mouse.move(start.x + 8, start.y + 8); await page.mouse.down(); await page.mouse.move(end.x + 8, end.y + 8, { steps: 12 }); await page.mouse.up();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-04: Vacation', exact: true })).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Test Member leave totals for 2026', exact: true })).toHaveText('V: 5S: 0');
  await dialog.getByRole('button', { name: 'Next year', exact: true }).click();
  await expect(dialog.getByLabel('Calendar year')).toHaveText('2027');
  await expect(dialog.getByRole('group', { name: 'Test Member leave totals for 2027', exact: true })).toHaveText('V: 0S: 0');
  await dialog.getByRole('button', { name: 'Previous year', exact: true }).click();
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-09: Available', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-09: Public holiday', exact: true })).toBeVisible();
  const occupiedSiteDay = dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-09: Public holiday', exact: true });
  const emptySiteDay = dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-11: Available', exact: true });
  await emptySiteDay.scrollIntoViewIfNeeded();
  const fromHoliday = await occupiedSiteDay.boundingBox(), toEmpty = await emptySiteDay.boundingBox();
  await page.mouse.move(fromHoliday.x + 12, fromHoliday.y + 10); await page.mouse.down();
  await expect(dialog.getByRole('button', { name: 'Working day', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.move(toEmpty.x + 12, toEmpty.y + 10, { steps: 8 });
  await expect(dialog.getByRole('button', { name: 'Working day', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-09: Available', exact: true })).toHaveCount(1);
  await expect(emptySiteDay).toHaveCount(1); // Crossing an empty cell must keep erasing, rather than paint it.
  await expect(dialog.getByRole('button', { name: 'Vacation', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-09: Available', exact: true }).press('Space');
  const weekend = dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-07: Weekend', exact: true });
  const siteCell = await weekend.boundingBox();
  expect(siteCell.width).toBe(24); expect(siteCell.height).toBe(20);
  const siteRow = await weekend.locator('..').boundingBox();
  expect(siteRow.height).toBe(siteCell.height); expect(siteRow.y).toBe(siteCell.y);
  await weekend.press('Space');
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-07: Public holiday', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-07: Public holiday', exact: true })).toBeDisabled();
  await expect(dialog.locator('[title^="Test Member · both"]')).toBeInViewport();
  const calendar = dialog.getByTestId('availability-calendar');
  expect(await calendar.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(await calendar.evaluate(el => {
    const bounds = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(bounds.left - 2, bounds.top + 80));
  })).toBe(false);
  const frame = await calendar.boundingBox(), fixedLabel = await prague.boundingBox();
  expect(fixedLabel.x - frame.x).toBeGreaterThanOrEqual(0);
  expect(fixedLabel.x - frame.x).toBeLessThanOrEqual(2);
  await prague.click(); await expect(prague).toHaveAttribute('aria-expanded', 'false');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-04: Vacation', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Site Member, 2026-02-04: Available', exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-07: Public holiday', exact: true })).toHaveCount(1);
  await prague.click(); await expect(prague).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-04: Vacation', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Collapse All', exact: true }).click();
  await expect(prague).toHaveAttribute('aria-expanded', 'false');
  await expect(bietigheim).toHaveAttribute('aria-expanded', 'false');
  await expect(dialog.getByRole('button', { name: 'Site Member, 2026-02-04: Available', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-07: Public holiday', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Expand All', exact: true }).click();
  await expect(prague).toHaveAttribute('aria-expanded', 'true');
  await expect(bietigheim).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-04: Vacation', exact: true })).toHaveCount(1);
  if (theme === 'vibrant') await dialog.screenshot({ path: testInfo.outputPath('availability-calendar.png') });
  await page.mouse.click(2, 2); await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveAttribute('title', 'Undo: Save member availability');
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-04: Vacation', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-07: Public holiday', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Working day', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-04: Vacation', exact: true }).press('Space');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-04: Vacation', exact: true })).toBeVisible();
});


test("management and engineering share the same reduced personal capacity", () => {
  const data = workspace(); Object.assign(data.configuration.management, { threshold: .1, ftePerCard: .1 });
  data.workpackages[0] = { ...data.workpackages[0], tool: "KPI", complexity: "Perception", otherStartMonth: undefined,
    customCoreFTE: { 0: 2 }, memberAssignments: { m: .4 }, memberMonthlyAssignments: { m: { 0: .4 } } };
  data.projects[0].mgmtMemberAssignments = { KPI: { m: .6 } };
  data.projects[0].mgmtMemberMonthlyAssignments = { KPI: { m: { 0: .6 } } };
  const result = reconcileAvailability(data);
  expect(result.workpackages[0].memberMonthlyAssignments.m[0]).toBeCloseTo(.3);
  expect(result.projects[0].mgmtMemberMonthlyAssignments.KPI.m[0]).toBeCloseTo(.45);
});

test("saved leave appears as occupied personal capacity and survives member edits, JSON and Undo", async ({ page }) => {
  await installWorkspaceSaveCapture(page);
  const dialog = await load(page, 'vibrant');
  await dialog.getByRole('button', { name: 'Sick leave', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true }).press('Space');
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other Combined Team Timeline', exact: true }).click();
  await expect(page.locator('[title*="Leave / public holidays: 0.05 FTE; available capacity: 0.95 FTE"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTitle('Edit Test Member', { exact: true }).click();
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  const data = await savedWorkspace(page);
  expect(data.teamMembers[0].absences).toEqual({ '2026-02-02': 'sick' });
  expect(JSON.stringify(data)).not.toContain('_siteHolidays');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  if (await undo.getAttribute('title') === 'Undo: Edit team member') await undo.click();
  await expect(undo).toHaveAttribute('title', 'Undo: Save member availability');
  await undo.click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true })).toBeVisible();
});

test("production calendar shares vacation and its removal across team views with atomic Undo", async ({ page }) => {
  const data = workspace(); data.view.activeToolView = "Other";
  data.teamMembers = [{ ...member, tool: "Other", fte: .4, absences: {} }, { ...member, id: "sibling", tool: "KPI", fte: .6, absences: {} }];
  await page.goto('/');
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "cross-team.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Other member availability' });
  await expect(dialog.locator('[title^="Test Member · both"] svg polygon')).toHaveCount(1);
  await expect(dialog.getByTitle('Cross-Team Member', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true }).press('Space');
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByRole('button', { name: 'KPI Team View', exact: true }).click();
  await page.getByRole('button', { name: 'Open KPI member availability', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'KPI member availability' });
  await expect(dialog.locator('[title^="Test Member · both"] svg polygon')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Vacation', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Working day', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Vacation', exact: true }).press('Space');
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Open KPI member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Vacation', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Open KPI member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true })).toBeVisible();
});

test('half-day leave scales capacity, salary, annual totals and cross-team edits', () => {
  const person: TeamMemberRecord = { ...member, absences: {
    '2026-02-02': { type: 'vacation', halfDay: true },
    '2026-02-03': { type: 'sick', halfDay: true },
    '2026-02-04': { type: 'other', halfDay: true },
    '2026-02-07': { type: 'vacation', halfDay: true },
  } };
  expect(memberMonthAvailability(person, feb).absentDays).toBe(1.5);
  expect(memberMonthAvailability(person, feb).capacity).toBeCloseTo(.925);
  expect(memberMonthAvailability({ ...person, fte: .4 }, feb).capacity).toBeCloseTo(.37);
  expect(memberYearAbsenceTotals(person, 2026)).toEqual({ vacation: .5, sick: .5 });
  const holiday = membersWithHolidays([person], { PRA: ['2026-02-02'] })[0];
  expect(memberMonthAvailability(holiday, feb).absentDays).toBe(2);
  expect(memberMonthAvailability({ ...holiday, absences: { ...holiday.absences, '2026-02-02': 'working' } }, feb).absentDays).toBe(1);
  const charge = externalSalaryCharge({ ...person, isExternal: true, monthlySalaryCost: 1000 }, .25, 'EUR', feb)!;
  expect(charge.salary).toBeCloseTo(925); expect(charge.capacityFTE).toBeCloseTo(.925);
  expect(charge.salary * charge.allocatedFTE / charge.capacityFTE).toBeCloseTo(250);
  const shared = applyMemberAbsenceEdits([{ ...person, absences: {} }, { ...person, id: 'sibling', tool: 'Other', absences: {} }], { m: person.absences! });
  expect(shared[1].absences).toEqual(person.absences);
  expect(applyMemberAbsenceEdits(shared, { m: { ...person.absences, '2026-02-02': 'vacation' } })[1].absences!['2026-02-02']).toBe('vacation');
  const data = workspace(); data.teamMembers = [person];
  expect(parseWorkspaceFile(serializeWorkspace(data)).data.teamMembers[0].absences).toEqual(person.absences);
  data.workpackages[0].memberAssignments = { m: 1 }; data.workpackages[0].memberMonthlyAssignments = { m: { 0: 1 } };
  expect(reconcileAvailability(data).workpackages[0].memberMonthlyAssignments!.m[0]).toBeCloseTo(.925);
});

test('half-day JSON rejects invalid durations and unsupported leave types', () => {
  for (const reason of [{ type: 'vacation', halfDay: false }, { type: 'holiday', halfDay: true }, { type: 'sick' }, null]) {
    const file = createWorkspaceFile(workspace());
    (file.data.teamMembers[0].absences as Record<string, unknown>)['2026-02-02'] = reason;
    expect(() => parseWorkspaceFile(JSON.stringify(file))).toThrow(/Member absences/);
  }
});

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`half-day calendar paints triangles and keeps site holidays full-day (${theme})`, async ({ page }) => {
  const dialog = await load(page, theme);
  const half = dialog.getByRole('checkbox', { name: 'Half-day', exact: true });
  await expect(half).not.toBeChecked(); await half.check();
  for (const [day, tool, status] of [['02', 'Vacation', 'Vacation'], ['03', 'Sick leave', 'Sick leave'], ['04', 'Other leave', 'Other leave']]) {
    await dialog.getByRole('button', { name: tool, exact: true }).click();
    await dialog.getByRole('button', { name: `Test Member, 2026-02-${day}: Available`, exact: true }).press('Space');
    await expect(dialog.getByRole('button', { name: `Test Member, 2026-02-${day}: ${status}`, exact: true })).toHaveCSS('background-image', /linear-gradient\(135deg.*50%.*rgb\(255, 255, 255\) 50%/);
  }
  await expect(dialog.getByRole('group', { name: 'Test Member leave totals for 2026', exact: true })).toHaveText('V: ½S: ½');
  await dialog.getByRole('button', { name: 'Vacation', exact: true }).click();
  await half.uncheck();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Vacation', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Vacation', exact: true })).toHaveCSS('background-image', 'none');
  await half.check();
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-05: Available', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-05: Public holiday', exact: true })).toHaveCSS('background-image', 'none');
  await dialog.getByRole('button', { name: 'Working day', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-05: Public holiday', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-05: Working on public holiday', exact: true })).toHaveCSS('background-image', /linear-gradient/);
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Half-day', exact: true })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Test Member, 2026-02-03: Sick leave', exact: true })).toHaveCSS('background-image', /linear-gradient/);
});

test('half-day holiday work restores half capacity and pay, transfers and clears with the holiday', () => {
  const half = { type: 'working', halfDay: true } as const;
  const person = { ...member, absences: { '2026-02-02': half }, _siteHolidays: ['2026-02-02'], isExternal: true, monthlySalaryCost: 1000 };
  expect(memberMonthAvailability(person, feb).absentDays).toBe(.5);
  expect(memberMonthAvailability(person, feb).capacity).toBeCloseTo(.975);
  expect(memberYearAbsenceTotals(person, 2026)).toEqual({ vacation: 0, sick: 0 });
  expect(externalSalaryCharge(person, .25, 'EUR', feb)!.salary).toBeCloseTo(975);
  expect(memberMonthAvailability({ ...person, _siteHolidays: [] }, feb).capacity).toBe(1);
  const sibling = { ...person, id: 'sibling', tool: 'Other', absences: {} };
  const shared = applyMemberAbsenceEdits([{ ...person, absences: {} }, sibling], { m: person.absences });
  expect(shared[1].absences!['2026-02-02']).toEqual(half);
  expect(applyMemberAbsenceEdits(shared, { m: { '2026-02-02': 'working' } })[1].absences!['2026-02-02']).toBe('working');
  expect(removeHolidayAbsences([person], { m: person.absences }, { PRA: ['2026-02-02'] }).m['2026-02-02']).toEqual(half);
  expect(removeHolidayAbsences([person], { m: person.absences }, { PRA: ['2026-02-02'] }, true).m['2026-02-02']).toBeUndefined();
  const data = workspace(); data.teamMembers = [{ ...person, isExternal: false }]; data.configuration.sitePublicHolidays = { PRA: ['2026-02-02'] };
  const parsed = parseWorkspaceFile(serializeWorkspace(data)).data;
  expect(parsed.teamMembers[0].absences!['2026-02-02']).toEqual(half);
  expect(memberMonthAvailability(membersWithHolidays(parsed.teamMembers, parsed.configuration.sitePublicHolidays)[0], feb).capacity).toBeCloseTo(.975);
});

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`half Working day restores leave and toggles partial holiday work (${theme})`, async ({ page }) => {
  const dialog = await load(page, theme);
  const cell = (day: string, status: string) => dialog.getByRole('button', { name: `Test Member, 2026-02-${day}: ${status}`, exact: true });
  const half = dialog.getByRole('checkbox', { name: 'Half-day', exact: true });
  for (const [day, tool] of [['02', 'Vacation'], ['03', 'Sick leave'], ['04', 'Other leave']]) {
    await dialog.getByRole('button', { name: tool, exact: true }).click();
    await cell(day, 'Available').press('Space');
  }
  await dialog.getByRole('button', { name: 'Working day', exact: true }).click(); await half.check();
  await cell('02', 'Vacation').scrollIntoViewIfNeeded();
  const start = await cell('02', 'Vacation').boundingBox(), end = await cell('04', 'Other leave').boundingBox();
  await page.mouse.move(start!.x + 12, start!.y + 12); await page.mouse.down();
  await page.mouse.move(end!.x + 12, end!.y + 12, { steps: 8 }); await page.mouse.up();
  for (const [day, status] of [['02', 'Vacation'], ['03', 'Sick leave'], ['04', 'Other leave']]) {
    await expect(cell(day, status)).toHaveCSS('background-image', /linear-gradient/);
  }
  await expect(dialog.getByRole('group', { name: 'Test Member leave totals for 2026', exact: true })).toHaveText('V: ½S: ½');
  await cell('02', 'Vacation').press('Space'); await expect(cell('02', 'Available')).toHaveCount(1);
  const holiday = dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-05: Available', exact: true });
  await holiday.press('Space'); await cell('05', 'Public holiday').press('Space');
  await expect(cell('05', 'Working on public holiday')).toHaveCSS('background-image', /linear-gradient/);
  await expect(cell('05', 'Working on public holiday')).toHaveCSS('color', 'rgb(22, 101, 52)');
  await half.uncheck(); await cell('05', 'Working on public holiday').press('Space');
  await expect(cell('05', 'Working on public holiday')).toHaveCSS('background-image', 'none');
  await half.check(); await cell('05', 'Working on public holiday').press('Space');
  await expect(cell('05', 'Working on public holiday')).toHaveCSS('background-image', /linear-gradient/);
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(cell('05', 'Working on public holiday')).toHaveCSS('background-image', /linear-gradient/);
  await dialog.getByRole('button', { name: 'Working day', exact: true }).click();
  await half.check(); await cell('05', 'Working on public holiday').press('Space');
  await expect(cell('05', 'Public holiday')).toHaveCSS('background-image', 'none');
});

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`availability opens at today and remembers position on Save Cancel and Close (${theme})`, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T12:00:00') });
  const data = workspace(); data.view.activeToolView = 'Other'; data.view.theme = theme;
  data.teamMembers = Array.from({ length: 35 }, (_, index) => ({ ...member, id: index ? `extra-${index}` : 'm', firstName: `Member${index}`, tool: 'Other', absences: {} }));
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'calendar.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  const open = () => page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await open();
  const dialog = page.getByRole('dialog', { name: 'Other member availability' });
  const calendar = dialog.getByTestId('availability-calendar');
  await expect(dialog.getByLabel('Calendar year')).toHaveText('2026');
  await expect.poll(() => calendar.evaluate(el => el.scrollLeft)).toBe(304 * 24);
  const today = dialog.getByRole('button', { name: 'Apply public holiday to shown sites on 2026-11-15', exact: true });
  await expect(today).toHaveAttribute('aria-current', 'date');
  await expect(dialog.getByRole('img', { name: 'Today', exact: true })).toBeVisible();
  for (const [index, exit] of ['Save & Close', 'Cancel', 'Close member availability'].entries()) {
    await calendar.evaluate((el, value) => { el.scrollLeft = value; el.scrollTop = 130; }, 900 + index * 240);
    await dialog.getByRole('button', { name: exit, exact: true }).click();
    await open();
    await expect.poll(() => calendar.evaluate(el => el.scrollLeft)).toBe(900 + index * 240);
    await expect.poll(() => calendar.evaluate(el => el.scrollTop)).toBe(130);
  }
  await dialog.getByRole('button', { name: 'Next year', exact: true }).click();
  await expect(dialog.getByRole('img', { name: 'Today', exact: true })).toHaveCount(0);
  await calendar.evaluate(el => { el.scrollLeft = 1600; });
  await page.keyboard.press('Escape'); await open();
  await expect(dialog.getByLabel('Calendar year')).toHaveText('2027');
  await expect.poll(() => calendar.evaluate(el => el.scrollLeft)).toBe(1600);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scan-availability-position:Other')!).year)).toBe(2027);
});
