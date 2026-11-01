import { test, expect } from '@playwright/test';
import type { TeamMemberRecord } from '../src/types';
import { globalAvailabilityMembers, globalAvailabilityDrafts } from '../src/utils/globalAvailability';
import { applyMemberAbsenceEdits } from '../src/utils/memberAvailability';
import { historyWorkspace } from './fixtures/historyWorkspace';
import { serializeWorkspace } from '../src/utils/workspaceFile';

const member: TeamMemberRecord = { id: 'member', firstName: 'Shared', lastName: 'Person', tool: 'Other', role: 'engineering', footprint: 'PRA', fte: .4, absences: {} };

test('global rows select highest FTE, break ties alphabetically and aggregate capacity once', () => {
  for (const [shares, teams, winner] of [
    [[.4, .6], ['Other', 'KPI'], 'KPI'],
    [[.5, .5], ['Other', 'KPI'], 'KPI'],
    [[.33, .33, .33], ['Other', 'KPI', 'Data Factory'], 'Data Factory'],
    [[.4, .4, .2], ['Other', 'KPI', 'Data Factory'], 'KPI'],
  ] as const) {
    const records = shares.map((fte, i) => ({ ...member, id: `m${i}`, tool: teams[i], fte }));
    const rows = globalAvailabilityMembers(records);
    expect(rows).toHaveLength(1); expect(rows[0].tool).toBe(winner);
    expect(rows[0].fte).toBeCloseTo(shares.reduce((a, b) => a + b, 0));
    expect(globalAvailabilityMembers([...records].reverse())).toEqual(rows);
    expect(records[0].fte).toBe(shares[0]);
  }
});

test('global edits merge historical dates but only propagate changed dates, including removal', () => {
  const source: TeamMemberRecord[] = [
    { ...member, absences: { '2026-02-02': 'vacation' } },
    { ...member, id: 'kpi', firstName: ' shared ', lastName: 'PERSON', tool: 'KPI', fte: .6, absences: { '2026-02-03': 'sick' } },
  ];
  const rows = globalAvailabilityMembers(source);
  expect(rows[0].absences).toEqual({ '2026-02-02': 'vacation', '2026-02-03': 'sick' });
  const noop = applyMemberAbsenceEdits(source, globalAvailabilityDrafts(source, rows, { kpi: rows[0].absences! }));
  expect(noop).toEqual(source);
  const drafts = globalAvailabilityDrafts(source, rows, { kpi: { '2026-02-03': 'sick', '2026-02-04': { type: 'other', halfDay: true } } });
  const result = applyMemberAbsenceEdits(source, drafts);
  expect(result.every(m => !m.absences!['2026-02-02'])).toBe(true);
  for (const person of result) expect(person.absences!['2026-02-04']).toEqual({ type: 'other', halfDay: true });
  expect(result[0].absences!['2026-02-03']).toBeUndefined();
  expect(result[1].absences!['2026-02-03']).toBe('sick');
});

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`global availability shares edits with teams, holidays, Undo and JSON (${theme})`, async ({ page }) => {
  await page.addInitScript(() => {
    for (const tool of ['Global', 'Other']) localStorage.setItem(`scan-availability-position:${tool}`, JSON.stringify({ year: 2026, left: 0, top: 0 }));
    let saved = '';
    Object.defineProperty(window, '__globalSaved', { get: () => saved });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => ({ createWritable: async () => ({ write: async (blob: Blob) => { saved = await blob.text(); }, close: async () => {}, abort: async () => {} }) }) });
  });
  const data = historyWorkspace(); data.view.activeToolView = 'Other'; data.view.theme = theme;
  data.teamMembers = [{ ...member }, { ...member, id: 'kpi', tool: 'KPI', fte: .6 }, { ...member, id: 'site', firstName: 'Site', tool: 'Other', footprint: 'BIE', fte: .8 }, { ...member, id: 'cairo', firstName: 'Cairo', tool: 'KPI', footprint: 'CAI', fte: .7 }];
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'global.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  const availabilityBounds = await page.getByRole('button', { name: 'Open Global Team Availability', exact: true }).boundingBox();
  const exportBounds = await page.getByRole('button', { name: 'Export all', exact: true }).boundingBox();
  const switcherBounds = await page.getByTitle('KPI Team View', { exact: true }).locator('..').locator('..').locator('..').boundingBox();
  expect(availabilityBounds!.height).toBe(exportBounds!.height);
  expect(availabilityBounds!.x - switcherBounds!.x - switcherBounds!.width).toBeCloseTo(exportBounds!.x - availabilityBounds!.x - availabilityBounds!.width, 0);
  const openGlobal = () => page.getByRole('button', { name: 'Open Global Team Availability', exact: true }).click();
  const global = page.getByRole('dialog', { name: 'Global member availability', exact: true });
  await openGlobal();
  await expect(global.getByRole('heading', { name: 'Global Team Availability' })).toBeVisible();
  await expect(global.getByText('3 members · Global Capacity:', { exact: false })).toContainText('2.50 FTE');
  const row = global.locator('[title^="Shared Person · engineering"]');
  await expect(row).toHaveCount(1);
  if (theme === 'vibrant') await expect(row.locator('svg[aria-label="Engineering Workpackages Only"] path')).toHaveAttribute('fill', '#059669');
  await expect(row.locator('svg polygon')).toHaveCount(1);
  const teams = row.getByRole('group', { name: 'Shared Person teams', exact: true });
  await expect(teams.getByRole('img', { name: 'KPI team', exact: true })).toHaveCount(1);
  await expect(teams.getByRole('img', { name: 'Other team', exact: true })).toHaveCount(1);
  await expect(teams.getByRole('img')).toHaveCount(2);
  await expect(global.getByText('Cross-Team', { exact: true })).toHaveCount(0);
  await expect(global.locator('[title^="Site Person · engineering"]').getByRole('img', { name: 'Other team', exact: true })).toHaveCount(1);

  await global.getByRole('checkbox', { name: 'Half-day' }).check();
  await global.getByRole('button', { name: 'Shared Person, 2026-02-02: Available', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Bietigheim public holiday, 2026-02-04: Available', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Apply public holiday to shown sites on 2026-01-05', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  const team = page.getByRole('dialog', { name: 'Other member availability', exact: true });
  await expect(team.getByText('Cross-Team', { exact: true })).toHaveCount(1);
  await expect(team.getByRole('button', { name: 'Shared Person, 2026-02-02: Vacation', exact: true })).toHaveCSS('background-image', /linear-gradient/);
  await expect(team.getByRole('button', { name: 'Site Person, 2026-02-04: Public holiday', exact: true })).toHaveCount(1);
  await expect(team.getByRole('button', { name: 'Shared Person, 2026-01-05: Public holiday', exact: true })).toHaveCount(1);
  await expect(team.getByRole('button', { name: 'Toggle Cairo members', exact: true })).toHaveCount(0);
  await team.getByRole('button', { name: 'Sick leave', exact: true }).click();
  await team.getByRole('button', { name: 'Shared Person, 2026-02-06: Available', exact: true }).press('Space');
  await team.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await openGlobal();
  await expect(global.getByRole('button', { name: 'Shared Person, 2026-02-06: Sick leave', exact: true })).toHaveCount(1);
  await global.getByRole('button', { name: 'Shared Person, 2026-02-09: Available', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await openGlobal();
  await expect(global.getByRole('button', { name: 'Shared Person, 2026-02-06: Available', exact: true })).toHaveCount(1);
  await global.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__globalSaved'))).not.toBe('');
  const saved = JSON.parse(await page.evaluate(() => Reflect.get(window, '__globalSaved'))).data;
  for (const id of ['member', 'kpi']) {
    const person = saved.teamMembers.find((m: TeamMemberRecord) => m.id === id);
    expect(person.absences['2026-02-02']).toEqual({ type: 'vacation', halfDay: true });
    expect(person.absences['2026-02-06']).toBe('sick'); expect(person.absences['2026-02-09']).toBeUndefined();
  }
  expect(saved.teamMembers.map((m: TeamMemberRecord) => m.fte)).toEqual([.4, .6, .8, .7]);
  expect(saved.configuration.sitePublicHolidays.BIE).toContain('2026-02-04');
  expect(saved.configuration.sitePublicHolidays.CAI).toContain('2026-01-05');
});

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`global and individual calendars share today and initial-month behaviour (${theme})`, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T12:00:00') });
  const data = historyWorkspace(); data.view.activeToolView = 'Other'; data.view.theme = theme;
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'today.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  const global = page.getByRole('dialog', { name: 'Global member availability', exact: true });
  const openGlobal = () => page.getByRole('button', { name: 'Open Global Team Availability', exact: true }).click();
  await openGlobal();
  await expect(global.getByLabel('Calendar year')).toHaveText('2026');
  await expect.poll(() => global.getByTestId('availability-calendar').evaluate(el => el.scrollLeft)).toBe(304 * 24);
  const arrow = global.getByRole('img', { name: 'Today', exact: true });
  await expect(arrow).toBeVisible(); await expect(arrow).toHaveCSS('top', '-2px');
  await expect(global.locator('[aria-current="date"]')).toHaveAttribute('aria-label', 'Apply public holiday to shown sites on 2026-11-15');
  await global.getByTestId('availability-calendar').evaluate(el => { el.scrollLeft = 1200; });
  await global.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await openGlobal();
  await expect.poll(() => global.getByTestId('availability-calendar').evaluate(el => el.scrollLeft)).toBe(1200);
  await global.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Open Other member availability', exact: true }).click();
  const team = page.getByRole('dialog', { name: 'Other member availability', exact: true });
  await expect.poll(() => team.getByTestId('availability-calendar').evaluate(el => el.scrollLeft)).toBe(304 * 24);
  await expect(team.getByRole('img', { name: 'Today', exact: true })).toHaveCSS('top', '-2px');
  await team.getByRole('button', { name: 'Cancel', exact: true }).click();
  await openGlobal();
  await expect.poll(() => global.getByTestId('availability-calendar').evaluate(el => el.scrollLeft)).toBe(1200);
  await global.getByRole('button', { name: 'Next year', exact: true }).click();
  await expect(global.getByRole('img', { name: 'Today', exact: true })).toHaveCount(0);
});
