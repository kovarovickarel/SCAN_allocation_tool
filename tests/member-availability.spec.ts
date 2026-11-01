import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { absoluteMonth, applyMemberAbsenceEdits, isWorkingDay, memberMonthAvailability, memberYearAbsenceTotals, membersWithHolidays, validCalendarDate } from "../src/utils/memberAvailability";
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
  const data = workspace(); data.teamMembers[0] = { ...member, tool: "Other", absences: {} };
  if (multiSite) data.teamMembers.push({ ...member, id: "bie", firstName: "Site", lastName: "Member", tool: "Other", footprint: "BIE", fte: .5, absences: {} });
  data.view.activeToolView = "Other"; data.view.theme = theme;
  await page.goto('/');
  await page.getByLabel("Workspace file", { exact: true }).setInputFiles({ name: "calendar.json", mimeType: "application/json", buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole("button", { name: "Import & Replace", exact: true }).click();
  await page.getByRole("button", { name: "Open Other member availability", exact: true }).click();
  return page.getByRole('dialog', { name: 'Other member availability' });
}

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
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-07: Weekend', exact: true }).press('Space');
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
  expect(saved.teamMembers[0].absences['2026-02-07']).toBe('other');
  expect(saved.teamMembers[0].absences['2026-02-05']).toBeUndefined();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Other leave', exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Erase', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-07: Other leave', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-07: Weekend', exact: true })).toHaveCount(1);
});

for (const kind of ['member', 'site', 'header'] as const) test(`dragging outside the ${kind} row follows horizontal position and remains on the original row`, async ({ page }) => {
  const dialog = await load(page, 'vibrant', true);
  const cell = (day: string, status = 'Available') => dialog.getByRole('button', { name: kind === 'header'
    ? `Apply public holiday to shown sites on 2026-02-${day}`
    : `${kind === 'site' ? 'Prague public holiday' : 'Test Member'}, 2026-02-${day}: ${status}`, exact: true });
  await cell('06').scrollIntoViewIfNeeded();
  const first = await cell('02').boundingBox(), last = await cell('06').boundingBox(), middle = await cell('03').boundingBox();
  await page.mouse.move(first.x + 12, first.y + first.height / 2); await page.mouse.down();
  await page.mouse.move(last.x + 12, page.viewportSize()!.height - 3, { steps: 10 });
  const marked = kind === 'member' ? 'Vacation' : 'Public holiday';
  await expect(dialog.getByRole('button', { name: `Test Member, 2026-02-06: ${marked}`, exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: `Site Member, 2026-02-06: ${kind === 'header' ? 'Public holiday' : 'Available'}`, exact: true })).toHaveCount(1);
  await page.mouse.move(middle.x + 12, 3, { steps: 10 });
  await expect(dialog.getByRole('button', { name: `Test Member, 2026-02-03: ${marked}`, exact: true })).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-06: Available', exact: true })).toHaveCount(1);
  await page.mouse.up();
  await page.mouse.move(last.x + 12, first.y + first.height / 2);
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-06: Available', exact: true })).toHaveCount(1);
});

test("removing public holidays never restores overwritten leave, including members in other teams at that site", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined }));
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
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Download JSON', exact: true }).click();
  const stream = await (await pending).createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const saved = parseWorkspaceFile(Buffer.concat(chunks).toString('utf8')).data;
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
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined }));
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
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Download JSON', exact: true }).click();
  const stream = await (await download).createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const holidays = parseWorkspaceFile(Buffer.concat(chunks).toString('utf8')).data.configuration.sitePublicHolidays;
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
  await dialog.getByLabel('Calendar year').fill('2024');
  await dialog.getByRole('button', { name: 'Next month from February', exact: true }).click();
  await expect.poll(position).toBe(60 * 24);
});

test("annual leave counters use the requested vacation thresholds, bold overflow and sick-leave colours", async ({ page }) => {
  const data = workspace(); data.workpackages = []; data.view.activeToolView = "Other";
  const working = Array.from({ length: 300 }, (_, day) => new Date(Date.UTC(2026, 0, day + 1)).toISOString().slice(0, 10)).filter(date => isWorkingDay(date, "PRA"));
  const bands: [number, string][] = [[0, 'rgb(239, 68, 68)'], [10, 'rgb(239, 68, 68)'], [11, 'rgb(249, 115, 22)'], [20, 'rgb(249, 115, 22)'],
    [21, 'rgb(234, 179, 8)'], [25, 'rgb(234, 179, 8)'], [26, 'rgb(134, 239, 172)'], [29, 'rgb(134, 239, 172)'], [30, 'rgb(22, 163, 74)'], [31, 'rgb(239, 68, 68)']];
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
  await expect(dialog.getByLabel('Calendar year')).toHaveValue('2027');
  await expect(dialog.getByRole('group', { name: 'Test Member leave totals for 2027', exact: true })).toHaveText('V: 0S: 0');
  await dialog.getByRole('button', { name: 'Previous year', exact: true }).click();
  await dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-09: Available', exact: true }).press('Space');
  await expect(dialog.getByRole('button', { name: 'Test Member, 2026-02-09: Public holiday', exact: true })).toBeVisible();
  const occupiedSiteDay = dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-09: Public holiday', exact: true });
  const emptySiteDay = dialog.getByRole('button', { name: 'Prague public holiday, 2026-02-11: Available', exact: true });
  await emptySiteDay.scrollIntoViewIfNeeded();
  const fromHoliday = await occupiedSiteDay.boundingBox(), toEmpty = await emptySiteDay.boundingBox();
  await page.mouse.move(fromHoliday.x + 12, fromHoliday.y + 10); await page.mouse.down();
  await expect(dialog.getByRole('button', { name: 'Erase', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.move(toEmpty.x + 12, toEmpty.y + 10, { steps: 8 });
  await expect(dialog.getByRole('button', { name: 'Erase', exact: true })).toHaveAttribute('aria-pressed', 'true');
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
  await dialog.getByRole('button', { name: 'Erase', exact: true }).click();
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
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined }));
  const dialog = await load(page, 'vibrant');
  await dialog.getByRole('button', { name: 'Sick leave', exact: true }).click();
  await dialog.getByRole('button', { name: 'Test Member, 2026-02-02: Available', exact: true }).press('Space');
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other Combined Team Timeline', exact: true }).click();
  await expect(page.locator('[title*="Leave / public holidays: 0.05 FTE; available capacity: 0.95 FTE"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTitle('Edit Test Member', { exact: true }).click();
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Download JSON', exact: true }).click();
  const stream = await (await pending).createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const data = parseWorkspaceFile(Buffer.concat(chunks).toString('utf8')).data;
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
  await dialog.getByRole('button', { name: 'Erase', exact: true }).click();
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
