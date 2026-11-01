import { availabilityWorkspace as workspace } from "./fixtures/availabilityWorkspace";
import { test, expect, type Page } from '@playwright/test';


import { installWorkspaceSaveCapture, savedWorkspace } from './fixtures/workspaceSaveCapture';
import { parseWorkspaceFile, serializeWorkspace } from '../src/utils/workspaceFile';

async function load(page: Page, theme: 'vibrant' | 'basic' | 'retro', mutate?: (data: ReturnType<typeof workspace>) => void) {
  await installWorkspaceSaveCapture(page);
  await page.addInitScript(() => { for (const view of ['Data Factory', 'KPI', 'Global']) localStorage.setItem(`scan-availability-position:${encodeURIComponent(view)}`, JSON.stringify({ year: 2026, left: 0, top: 0 })); });
  const data = workspace(); data.view.theme = theme; mutate?.(data); parseWorkspaceFile(serializeWorkspace(data));
  await page.goto('/'); await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'monthly-capacity.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
}
async function capacity(page: Page, team: string, checks: { month: number; name?: string; occupied: number; cap: number; unavailable: number; available: number; days: number; working: number }[]) {
  await page.getByRole('button', { name: `${team} Team View`, exact: true }).click();
  await page.getByRole('button', { name: `Open ${team} Combined Team Timeline`, exact: true }).click();
  const timeline = page.getByRole('dialog');
  for (const expected of checks) {
    const name = expected.name ?? 'Shared Person';
    const cell = timeline.locator(`[title^="${name} ("][title*="Month ${expected.month} ("][title*="Leave / public holidays:"]`);
    await expect(cell).toHaveCount(1);
    const title = (await cell.getAttribute('title'))!;
    const occupied = title.match(/: ([\d.]+) \/ ([\d.]+) FTE occupied/)!;
    const available = title.match(/Leave \/ public holidays: ([\d.]+) FTE; available capacity: ([\d.]+) FTE \(([\d.]+)\/([\d.]+) working days unavailable\)/)!;
    expect(Math.abs(Number(occupied[1]) - expected.occupied)).toBeLessThanOrEqual(.00501); expect(Number(occupied[2])).toBe(expected.cap);
    expect(Math.abs(Number(available[1]) - expected.unavailable)).toBeLessThanOrEqual(.00501); expect(Math.abs(Number(available[2]) - expected.available)).toBeLessThanOrEqual(.00501);
    expect(Number(available[3])).toBe(expected.days); expect(Number(available[4])).toBe(expected.working);
    expect(title).not.toContain('OVERALLOCATED');
  }
  await page.keyboard.press('Escape');
}

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`global and team calendars update exact combined-timeline months without restoring allocations (${theme})`, async ({ page }) => {
  await load(page, theme);
  await capacity(page, 'Data Factory', [{ month: 1, occupied: .2, cap: .4, unavailable: 0, available: .4, days: 0, working: 22 }, { month: 2, occupied: .4, cap: .4, unavailable: 0, available: .4, days: 0, working: 20 }]);
  await page.getByRole('button', { name: 'Open Global Team Availability', exact: true }).click();
  const global = page.getByRole('dialog', { name: 'Global member availability' });
  for (const day of ['02', '03', '04', '05', '06']) await global.getByRole('button', { name: `Shared Person, 2026-02-${day}: Available`, exact: true }).press('Space');
  await global.getByRole('button', { name: 'Prague public holiday, 2026-02-10: Available', exact: true }).press('Space');
  await global.getByRole('checkbox', { name: 'Half-day' }).check();
  await global.getByRole('button', { name: 'Shared Person, 2026-03-02: Available', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Shared Person, 2026-01-12: Available', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Free Member, 2026-02-09: Available', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Save & Close', exact: true }).click();
  const saved = await savedWorkspace(page);
  for (const [tool, id, allocation] of [['Data Factory', 'member', .14], ['KPI', 'kpi', .21]] as const) {
    expect(saved.workpackages.find(w => w.id === `p-${tool}`)!.memberMonthlyAssignments![id][1]).toBeCloseTo(allocation, 7);
    expect(saved.workpackages.find(w => w.id === `p2-${tool}`)!.memberMonthlyAssignments![id][0]).toBeCloseTo(allocation, 7);
    expect(saved.workpackages.find(w => w.id === `p-${tool}`)!.memberMonthlyAssignments![id][0]).toBe(tool === 'Data Factory' ? .2 : .3);
  }
  await capacity(page, 'Data Factory', [
    { month: 1, occupied: .2 + .4 * .5 / 22, cap: .4, unavailable: .4 * .5 / 22, available: .4 * 21.5 / 22, days: .5, working: 22 },
    { month: 2, occupied: .4, cap: .4, unavailable: .12, available: .28, days: 6, working: 20 },
    { month: 3, occupied: .4, cap: .4, unavailable: .01, available: .39, days: .5, working: 22 },
    { month: 2, name: 'Free Member', occupied: .01, cap: .5, unavailable: .01, available: .49, days: .5, working: 20 },
  ]);
  await capacity(page, 'KPI', [{ month: 2, occupied: .6, cap: .6, unavailable: .18, available: .42, days: 6, working: 20 }, { month: 3, occupied: .6, cap: .6, unavailable: .01, available: .59, days: .5, working: 22 }]);
  await page.getByRole('button', { name: 'Open KPI member availability', exact: true }).click();
  const team = page.getByRole('dialog', { name: 'KPI member availability' });
  await team.getByRole('button', { name: 'Working day', exact: true }).click(); await team.getByRole('checkbox', { name: 'Half-day' }).check();
  await team.getByRole('button', { name: 'Shared Person, 2026-02-10: Public holiday', exact: true }).press('Space');
  await team.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await capacity(page, 'KPI', [{ month: 2, occupied: .585, cap: .6, unavailable: .165, available: .435, days: 5.5, working: 20 }]);
  await page.getByRole('button', { name: 'Data Factory Team View', exact: true }).click();
  await capacity(page, 'Data Factory', [{ month: 2, occupied: .39, cap: .4, unavailable: .11, available: .29, days: 5.5, working: 20 }]);
  await page.getByRole('button', { name: 'Open Global Team Availability', exact: true }).click();
  await expect(global.getByRole('button', { name: 'Shared Person, 2026-02-10: Working on public holiday', exact: true })).toHaveCSS('background-image', /linear-gradient/);
  await global.getByRole('button', { name: 'Working day', exact: true }).click();
  for (const day of ['02', '03', '04', '05', '06']) await global.getByRole('button', { name: `Shared Person, 2026-02-${day}: Vacation`, exact: true }).press('Space');
  await global.getByRole('button', { name: 'Prague public holiday, 2026-02-10: Public holiday', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await capacity(page, 'Data Factory', [{ month: 2, occupied: .28, cap: .4, unavailable: 0, available: .4, days: 0, working: 20 }]);
  await capacity(page, 'KPI', [{ month: 2, occupied: .42, cap: .6, unavailable: 0, available: .6, days: 0, working: 20 }]);
  const cancelled = await savedWorkspace(page);
  expect(cancelled.workpackages).toEqual(saved.workpackages);
  expect(cancelled.teamMembers.map(m => m.fte)).toEqual([.4, .6, .5]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await capacity(page, 'KPI', [{ month: 2, occupied: .585, cap: .6, unavailable: .165, available: .435, days: 5.5, working: 20 }]);
});

test('combined timeline exposes real imported overbooking and leave reconciliation clears it precisely', async ({ page }) => {
  await load(page, 'vibrant', data => {
    data.workpackages.find(w => w.id === 'p-Data Factory')!.memberMonthlyAssignments!.member[1] = .35;
    data.workpackages.find(w => w.id === 'p2-Data Factory')!.memberMonthlyAssignments!.member[0] = .35;
  });
  await page.getByRole('button', { name: 'Open Data Factory Combined Team Timeline', exact: true }).click();
  const cell = page.getByRole('dialog').locator('[title^="Shared Person (PRA)"][title*="Month 2 ("][title*="Leave / public holidays:"]');
  await expect(cell).toHaveAttribute('title', /0\.70 \/ 0\.40 FTE occupied \(175%\)/);
  await expect(cell).toHaveAttribute('title', /OVERALLOCATED/); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open Global Team Availability', exact: true }).click();
  const global = page.getByRole('dialog', { name: 'Global member availability' });
  await global.getByRole('button', { name: 'Shared Person, 2026-02-02: Available', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await capacity(page, 'Data Factory', [{ month: 2, occupied: .4, cap: .4, unavailable: .02, available: .38, days: 1, working: 20 }]);
});

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`global holiday replacement and removal clear half-working exceptions in every team (${theme})`, async ({ page }) => {
  await load(page, theme);
  const openGlobal = () => page.getByRole('button', { name: 'Open Global Team Availability', exact: true }).click();
  const global = page.getByRole('dialog', { name: 'Global member availability' });
  await openGlobal();
  await global.getByRole('button', { name: 'Shared Person, 2026-02-02: Available', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await openGlobal();
  await global.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Available', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Working day', exact: true }).click(); await global.getByRole('checkbox', { name: 'Half-day' }).check();
  await global.getByRole('button', { name: 'Shared Person, 2026-02-02: Public holiday', exact: true }).press('Space');
  await global.getByRole('button', { name: 'Save & Close', exact: true }).click();
  let data = await savedWorkspace(page);
  for (const member of data.teamMembers.filter(m => m.firstName === 'Shared')) expect(member.absences!['2026-02-02']).toEqual({ type: 'working', halfDay: true });
  await page.getByRole('button', { name: 'KPI Team View', exact: true }).click();
  await page.getByRole('button', { name: 'Open KPI member availability', exact: true }).click();
  const team = page.getByRole('dialog', { name: 'KPI member availability' });
  await expect(team.getByRole('button', { name: 'Shared Person, 2026-02-02: Working on public holiday', exact: true })).toHaveCSS('background-image', /linear-gradient/);
  await team.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Public holiday', exact: true }).press('Space');
  await team.getByRole('button', { name: 'Save & Close', exact: true }).click();
  await openGlobal();
  await expect(global.getByRole('button', { name: 'Shared Person, 2026-02-02: Available', exact: true })).toHaveCount(1);
  await global.getByRole('button', { name: 'Prague public holiday, 2026-02-02: Available', exact: true }).press('Space');
  await expect(global.getByRole('button', { name: 'Shared Person, 2026-02-02: Public holiday', exact: true })).toHaveCSS('background-image', 'none');
  await global.getByRole('button', { name: 'Save & Close', exact: true }).click();
  data = await savedWorkspace(page);
  for (const member of data.teamMembers.filter(m => m.firstName === 'Shared')) expect(member.absences!['2026-02-02']).toBeUndefined();
  expect(data.configuration.sitePublicHolidays!.PRA).toEqual(['2026-02-02']);
});
