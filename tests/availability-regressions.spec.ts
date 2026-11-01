import { test, expect } from '@playwright/test';
import { availabilityWorkspace } from './fixtures/availabilityWorkspace';
import { reconcileAvailability } from '../src/utils/availabilityAllocations';
import { applyMemberAbsenceEdits, memberMonthAvailability, membersWithHolidays, absoluteMonth } from '../src/utils/memberAvailability';
import { globalAvailabilityDrafts, globalAvailabilityMembers } from '../src/utils/globalAvailability';
import { calculatePortfolioSalaryTotals, calculateProjectSpending } from '../src/utils/projectSpending';
import { externalSalaryUtilization, salaryCostsByCurrency } from '../src/utils/externalSalaries';
import { sumWorkpackageAllocationCosts } from '../src/utils/allocationCosts';

test('cross-team leap-day leave maps into different project offsets without changing neighbouring months', () => {
  const data = availabilityWorkspace(); data.projects[0].startDate = '2027-12'; data.projects[1].startDate = '2028-01';
  const rows = globalAvailabilityMembers(data.teamMembers);
  const shared = rows.find(m => m.firstName === 'Shared')!;
  const drafts = { [shared.id]: { '2028-02-29': { type: 'vacation' as const, halfDay: true as const } } };
  const result = reconcileAvailability({ ...data, teamMembers: applyMemberAbsenceEdits(data.teamMembers, globalAvailabilityDrafts(data.teamMembers, rows, drafts)) });
  for (const [tool, id, fte, assigned] of [['Data Factory', 'member', .4, .2], ['KPI', 'kpi', .6, .3]] as const) {
    // February 2028 has 21 Mon-Fri working days. Only half a day is unavailable.
    expect(result.workpackages.find(w => w.id === `p-${tool}`)!.memberMonthlyAssignments![id][2]).toBeCloseTo(assigned * 20.5 / 21, 7);
    expect(result.workpackages.find(w => w.id === `p2-${tool}`)!.memberMonthlyAssignments![id][1]).toBeCloseTo(assigned * 20.5 / 21, 7);
    for (const month of [0, 1, 3]) expect(result.workpackages.find(w => w.id === `p-${tool}`)!.memberMonthlyAssignments![id][month]).toBe(assigned);
    expect(memberMonthAvailability(result.teamMembers.find(m => m.id === id), absoluteMonth('2028-02')).capacity).toBeCloseTo(fte * 20.5 / 21);
  }
  expect(data.teamMembers.every(m => !Object.keys(m.absences!).length)).toBe(true);
});

test('a full month of leave zeros all allocations and cancellation never refills them', () => {
  const data = availabilityWorkspace();
  const weekdays = [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27];
  const absences = Object.fromEntries(weekdays.map(day => [`2026-02-${String(day).padStart(2, '0')}`, 'other' as const]));
  const result = reconcileAvailability({ ...data, teamMembers: applyMemberAbsenceEdits(data.teamMembers, { member: absences }) });
  for (const [tool, id] of [['Data Factory', 'member'], ['KPI', 'kpi']]) {
    expect(result.workpackages.find(w => w.id === `p-${tool}`)!.memberMonthlyAssignments![id][1]).toBe(0);
    expect(result.workpackages.find(w => w.id === `p2-${tool}`)!.memberMonthlyAssignments![id][0]).toBe(0);
    expect(memberMonthAvailability(result.teamMembers.find(m => m.id === id), absoluteMonth('2026-02')).capacity).toBe(0);
  }
  const restored = reconcileAvailability({ ...result, teamMembers: applyMemberAbsenceEdits(result.teamMembers, { kpi: {} }) });
  expect(restored.workpackages).toEqual(result.workpackages);
  expect(restored.teamMembers.every(m => !Object.keys(m.absences!).length)).toBe(true);
});

test('one monthly limit proportionally reduces engineering and management over two offset projects', () => {
  const data = availabilityWorkspace(); Object.assign(data.configuration.management, { threshold: .5, ftePerCard: .2 });
  data.teamMembers = data.teamMembers.map(m => ({ ...m, role: 'both' }));
  for (const project of data.projects) {
    project.mgmtMemberAssignments = { 'Data Factory': { member: .2 } };
    project.mgmtMemberMonthlyAssignments = { 'Data Factory': { member: Object.fromEntries(Array.from({ length: 18 }, (_, m) => [m, .2])) } };
  }
  const days = Object.fromEntries([2, 3, 4, 5, 6].map(day => [`2026-02-0${day}`, 'sick' as const]));
  const result = reconcileAvailability({ ...data, teamMembers: applyMemberAbsenceEdits(data.teamMembers, { member: days }) });
  const februaryAllocations = [result.workpackages.find(w => w.id === 'p-Data Factory')!.memberMonthlyAssignments!.member[1],
    result.workpackages.find(w => w.id === 'p2-Data Factory')!.memberMonthlyAssignments!.member[0],
    result.projects[0].mgmtMemberMonthlyAssignments!['Data Factory'].member[1], result.projects[1].mgmtMemberMonthlyAssignments!['Data Factory'].member[0]];
  for (const allocation of februaryAllocations) expect(allocation).toBeCloseTo(.075, 7);
  expect(februaryAllocations.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(.3);
  expect(result.projects[0].mgmtMemberMonthlyAssignments!['Data Factory'].member[0]).toBe(.2);
});

for (const [site, workdays, absent] of [['PRA', 22, 2], ['CAI', 21, 1.5]] as const) test(`January leave and holiday overlap follow ${site}'s actual work week`, () => {
  const member = { ...availabilityWorkspace().teamMembers[0], footprint: site, fte: .6,
    absences: { '2026-01-01': 'vacation' as const, '2026-01-04': { type: 'other' as const, halfDay: true as const } }, _siteHolidays: ['2026-01-01', '2026-01-02'] };
  const result = memberMonthAvailability(member, absoluteMonth('2026-01'));
  expect(result.workingDays).toBe(workdays); expect(result.absentDays).toBe(absent);
  expect(result.capacity).toBeCloseTo(.6 * (workdays - absent) / workdays);
});

test('leave reduces paid external capacity once across projects and does not inflate unused salary', () => {
  const data = availabilityWorkspace(); data.teamMembers = [{ ...data.teamMembers[0], fte: 1, isExternal: true, supplierId: 'supplier-luxoft', monthlySalaryCost: 1000, monthlySalaryCurrency: 'EUR' }];
  data.workpackages = data.workpackages.filter(w => w.tool === 'Data Factory');
  data.teamMembers[0].absences = Object.fromEntries([2, 3, 4, 5, 6].map(day => [`2026-02-0${day}`, 'vacation' as const]));
  data.configuration.sitePublicHolidays = { PRA: ['2026-02-10'] };
  const next = reconcileAvailability(data);
  const options = { cards: next.workpackages, projects: next.projects, members: membersWithHolidays(next.teamMembers, next.configuration.sitePublicHolidays),
    fteCosts: next.configuration.fteCosts, fteRates: next.configuration.fteRates, toolFteRates: next.configuration.toolFteRates,
    reusabilityFactors: next.configuration.reusabilityFactors, stabilityFactors: next.configuration.stabilityFactors, mgmtSettings: next.configuration.management,
    deferExternalPayments: false };
  const totals = calculatePortfolioSalaryTotals(options);
  const results = next.projects.map(project => calculateProjectSpending({ ...options, salaryAllocationTotals: totals, project, overheads: [] }));
  const february = sumWorkpackageAllocationCosts([results[0].monthlyCosts[1], results[1].monthlyCosts[0]], 'EUR');
  const paid = externalSalaryUtilization(february);
  expect(paid.paidFTE).toBeCloseTo(.7); expect(paid.allocatedFTE).toBeCloseTo(.4); expect(paid.unusedFTE).toBeCloseTo(.3);
  expect(salaryCostsByCurrency(february).EUR).toBeCloseTo(400);
  expect(salaryCostsByCurrency(paid.unusedCost).EUR).toBeCloseTo(300);
  expect(next.workpackages).toEqual(data.workpackages);
});
