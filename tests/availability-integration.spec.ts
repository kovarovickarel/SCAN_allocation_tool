import { availabilityWorkspace as workspace } from "./fixtures/availabilityWorkspace";
import { test, expect, type Page } from '@playwright/test';


import { installWorkspaceSaveCapture, savedWorkspace } from './fixtures/workspaceSaveCapture';
import { parseWorkspaceFile, serializeWorkspace } from '../src/utils/workspaceFile';
import { formatRemainingFTE } from '../src/utils/helpers';

test('remaining FTE labels round up to at most two decimal places', () => {
  expect(formatRemainingFTE(0.105)).toBe('0.11');
  expect(formatRemainingFTE(0.101)).toBe('0.11');
  expect(formatRemainingFTE(0.1 + 0.2)).toBe('0.3');
  expect(formatRemainingFTE(0.025)).toBe('0.03');
  expect(formatRemainingFTE(0.0001)).toBe('0.01');
  expect(formatRemainingFTE(1.001)).toBe('1.01');
  expect(formatRemainingFTE(0)).toBe('0');
});

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

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`personal leave breakdown shows only used leave types with isolated compact monthly cells (${theme})`, async ({ page }) => {
  await load(page, theme, data => {
    data.teamMembers[0].absences = {
      '2026-01-05': 'vacation', '2026-01-06': 'vacation',
      '2026-01-07': { type: 'sick', halfDay: true }, '2026-01-08': 'sick',
      '2026-01-09': { type: 'working', halfDay: true },
      '2026-01-17': 'working', '2026-02-02': 'other', '2026-02-03': 'vacation',
    };
    data.teamMembers[2].absences = { '2020-01-02': 'vacation', '2026-01-10': 'sick', '2026-01-17': 'working' };
    data.configuration.sitePublicHolidays = { PRA: ['2026-01-08', '2026-01-09', '2026-01-10'] };
  });
  await page.getByRole('button', { name: 'Open Data Factory Combined Team Timeline', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const breakdown = dialog.locator('[aria-label="Shared Person leave breakdown"]');
  const expand = dialog.getByRole('button', { name: 'Expand leave breakdown for Shared Person', exact: true });
  const january = dialog.locator('[title^="Shared Person ("][title*="Month 1 ("][title*="Leave / public holidays:"]');
  const summary = dialog.getByTitle(/Month 1 .*Overall Team Capacity Used/);
  const summaryBefore = await summary.getAttribute('title');
  await expect(january).toHaveAttribute('title', /0\.28 \/ 0\.40 FTE occupied \(70%\)/);
  await expect(breakdown).toHaveCount(0);
  await expand.press('Enter');
  await expect(january).toHaveAttribute('title', /0\.20 \/ 0\.40 FTE occupied \(50%\)/);
  await expect(summary).toHaveAttribute('title', summaryBefore!);
  await expect(breakdown).toBeVisible();
  const rows = breakdown.locator(':scope > div');
  await expect(rows).toHaveCount(4);
  const leaveOrder = ['Public holidays', 'Vacation', 'Sick leave', 'Other leave'];
  for (const [index, label] of leaveOrder.entries()) {
    await expect(rows.nth(index)).toContainText(label);
    await expect(breakdown.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(breakdown.getByTitle('Shared Person · Vacation · 01/2026 · 2 days · 0.036 FTE unavailable', { exact: true })).toHaveText('0.036');
  await expect(breakdown.getByTitle('Shared Person · Sick leave · 01/2026 · 0.5 days · 0.009 FTE unavailable', { exact: true })).toHaveText('0.009');
  await expect(breakdown.getByTitle('Shared Person · Public holidays · 01/2026 · 2 days · 0.036 FTE unavailable', { exact: true })).toHaveText('0.036');
  const vacation = rows.nth(1).locator('[title]');
  await expect(vacation).toHaveCount(2);
  for (const cell of await vacation.all()) {
    await expect(cell).toHaveCSS('height', '16px');
    await expect(cell).toHaveCSS('border-style', 'dashed');
    await expect(cell).toHaveCSS('border-top-left-radius', '6px');
    await expect(cell).toHaveCSS('border-top-right-radius', '6px');
  }
  const collapse = dialog.getByRole('button', { name: 'Collapse leave breakdown for Shared Person', exact: true });
  await collapse.click();
  await expect(january).toHaveAttribute('title', /0\.28 \/ 0\.40 FTE occupied \(70%\)/);
  await expect(breakdown).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Expand leave breakdown for Free Member', exact: true })).toHaveCount(0);
  await expect(dialog.locator('[aria-label="Free Member leave breakdown"] > div')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Save & Close', exact: true })).toBeDisabled();
});

test('worked weekday public holidays occupy full normal capacity and remain in the expanded holiday row', async ({ page }) => {
  await load(page, 'vibrant', data => {
    data.teamMembers[2].absences = {
      '2026-02-14': 'working',
      '2026-02-16': 'working',
      '2026-02-17': { type: 'working', halfDay: true },
    };
    data.configuration.sitePublicHolidays = { BIE: ['2026-02-14', '2026-02-16', '2026-02-17'] };
  });
  await page.getByRole('button', { name: 'Open Data Factory Combined Team Timeline', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const february = dialog.locator('[title^="Free Member ("][title*="Month 2 ("][title*="Leave / public holidays:"]');
  await expect(february).toHaveAttribute('title', /0\.05 \/ 0\.50 FTE occupied \(10%\)/);
  await expect(february).toHaveAttribute('title', /2\/20 working days unavailable/);
  await february.getByRole('button', { name: 'Choose premium work day' }).click();
  await expect(february.getByRole('button', { name: '2026-02-16 · 8 h · Public Holiday Work · 1.5×', exact: true })).toBeVisible();
  await expect(february.getByRole('button', { name: '2026-02-17 · 4 h · Public Holiday Work · 1.5×', exact: true })).toBeVisible();
  await february.getByRole('button', { name: 'Choose premium work day' }).press('Escape');
  await dialog.getByRole('button', { name: 'Expand leave breakdown for Free Member', exact: true }).click();
  await expect(february).toHaveAttribute('title', /0\.00 \/ 0\.50 FTE occupied \(0%\)/);
  const breakdown = dialog.locator('[aria-label="Free Member leave breakdown"]');
  await expect(breakdown.locator(':scope > div')).toHaveCount(1);
  await expect(breakdown.getByTitle('Free Member · Public holidays · 02/2026 · 2 days · 0.05 FTE unavailable', { exact: true })).toHaveText('0.05');
  await dialog.getByRole('button', { name: 'Collapse leave breakdown for Free Member', exact: true }).click();
  await expect(february).toHaveAttribute('title', /0\.05 \/ 0\.50 FTE occupied \(10%\)/);
});

test('personal staffing displays one or two premium dates directly and offers a picker for three', async ({ page }) => {
  await load(page, 'vibrant', data => {
    data.teamMembers[0].absences = {
      '2026-01-03': 'working',
      '2026-02-07': 'working',
      '2026-02-08': { type: 'working', halfDay: true },
    };
    data.teamMembers[2].absences = {
      '2026-01-17': 'working',
      '2026-01-04': { type: 'working', halfDay: true },
      '2026-01-05': 'working',
      '2026-01-01': 'working',
    };
    data.configuration.sitePublicHolidays = { BIE: ['2026-01-01', '2026-01-17'] };
    data.configuration.weekendWorkFactors = { BIE: { weekend: 1.75, publicHoliday: 1.6, weekendPublicHoliday: 2.5 } };
  });
  await page.getByRole('button', { name: 'Open Data Factory Combined Team Timeline', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const cell = (name: string, month = 1) => dialog.locator(`[title^="${name} ("][title*="Month ${month} ("][title*="Leave / public holidays:"]`);
  const allocated = cell('Shared Person');
  const singleDay = allocated.getByTitle('2026-01-03 · 8 h · Weekend Work · 1.5×');
  await expect(singleDay).toHaveText('03');
  const hasEmptyLowerSlot = await singleDay.evaluate(day => {
    const slot = day.getBoundingClientRect();
    const strip = day.parentElement!;
    const bounds = strip.getBoundingClientRect();
    return strip.lastElementChild === day && getComputedStyle(strip).backgroundColor === 'rgba(0, 0, 0, 0)'
      && slot.top === bounds.top && Math.abs(slot.height * 2 + 2 - bounds.height) < 1;
  });
  expect(hasEmptyLowerSlot).toBe(true);
  await expect(allocated.getByRole('button', { name: 'Choose premium work day' })).toHaveCount(0);
  const twoDays = cell('Shared Person', 2);
  const upper = twoDays.getByTitle('2026-02-07 · 8 h · Weekend Work · 1.5×');
  const lower = twoDays.getByTitle('2026-02-08 · 4 h · Weekend Work · 1.5×');
  await expect(upper).toHaveText('07');
  await expect(lower).toHaveText('08');
  await expect(upper).toHaveCSS('background-color', 'rgb(249, 168, 212)');
  await expect(upper).toHaveCSS('color', 'rgb(157, 23, 77)');
  await expect(upper).toHaveCSS('outline-color', 'rgb(131, 24, 67)');
  await expect(upper).toHaveCSS('background-image', 'none');
  await expect(lower).toHaveCSS('background-image', /linear-gradient\(135deg, .*rgb\(255, 255, 255\) 50%\)/);
  expect((await lower.boundingBox())!.y).toBeGreaterThan((await upper.boundingBox())!.y);
  const stripStyle = await upper.evaluate(day => {
    const strip = day.parentElement!;
    const badge = strip.nextElementSibling!;
    return {
      gap: badge.getBoundingClientRect().left - strip.getBoundingClientRect().right,
      dateGap: day.nextElementSibling!.getBoundingClientRect().top - day.getBoundingClientRect().bottom,
      stripBackground: getComputedStyle(strip).backgroundColor,
      stripBorder: getComputedStyle(strip).borderRightWidth,
      dateBorder: getComputedStyle(day).borderBottomWidth,
    };
  });
  expect(stripStyle).toEqual({ gap: 3, dateGap: 2, stripBackground: 'rgba(0, 0, 0, 0)', stripBorder: '0px', dateBorder: '0px' });
  await expect(twoDays.getByRole('button', { name: 'Choose premium work day' })).toHaveCount(0);
  const free = cell('Free Member');
  await expect(free).toHaveAttribute('title', /0\.02 \/ 0\.50 FTE occupied/);
  const first = '2026-01-01 · 8 h · Public Holiday Work · 1.6×';
  const second = '2026-01-04 · 4 h · Weekend Work · 1.75×';
  const third = '2026-01-17 · 8 h · Weekend & Public Holiday Work · 2.5×';
  const arrow = free.getByRole('button', { name: 'Choose premium work day' });
  await expect(arrow).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const highlight = free.locator('svg > rect[stroke-dasharray]');
  await expect(highlight).toHaveCSS('animation-name', 'premium-work-dashes');
  await expect(free.locator('svg:has(> rect[stroke-dasharray])')).toHaveCSS('filter', /drop-shadow\(/);
  const highlightLeftGap = await highlight.evaluate(rect =>
    rect.closest('svg')!.parentElement!.getBoundingClientRect().left - rect.getBoundingClientRect().left
  );
  expect(highlightLeftGap).toBeGreaterThan(1);
  const holiday = free.getByTitle(first);
  await expect(holiday).toHaveText('01');
  await expect(holiday).toHaveCSS('background-color', 'rgb(134, 239, 172)');
  await expect(holiday).toHaveCSS('color', 'rgb(22, 101, 52)');
  await expect(arrow).toHaveAttribute('aria-expanded', 'false');
  await arrow.press('Space');
  const halfDayIcon = free.getByRole('button', { name: second }).locator('[aria-hidden="true"]');
  await expect(halfDayIcon).toHaveText('04');
  await expect(halfDayIcon).toHaveCSS('background-image', /linear-gradient\(135deg, .*rgb\(255, 255, 255\) 50%\)/);
  const lastOption = free.getByRole('list').getByRole('button').last();
  await expect(lastOption).toHaveAccessibleName(first);
  const lastIcon = lastOption.locator('[aria-hidden="true"]');
  await expect(lastIcon).toHaveText('01');
  const [slotBounds, iconBounds] = await Promise.all([holiday.boundingBox(), lastIcon.boundingBox()]);
  expect(iconBounds).toEqual(slotBounds);
  await free.getByRole('button', { name: third }).click();
  const weekendHoliday = free.getByTitle(third);
  await expect(weekendHoliday).toHaveText('17');
  await expect(weekendHoliday).toHaveCSS('background-color', 'rgb(244, 206, 115)');
  await expect(weekendHoliday).toHaveCSS('color', 'rgb(91, 56, 8)');
  await expect(weekendHoliday).toHaveCSS('outline-color', 'rgb(149, 98, 13)');
  await expect(weekendHoliday).toHaveCSS('-webkit-text-stroke-width', '0px');
  await expect(free.getByTitle(first)).toHaveCount(0);
  await expect(arrow).toBeFocused();
  await expect(arrow).toHaveAttribute('aria-expanded', 'false');
  await arrow.click();
  await expect(free.getByRole('button', { name: first })).toBeVisible();
  await expect(lastOption).toHaveAccessibleName(third);
  await expect(free.getByText(/2026-01-05/)).toHaveCount(0);
  await arrow.press('Escape');
  await expect(arrow).toHaveAttribute('aria-expanded', 'false');
  await expect(dialog).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(highlight).toHaveCSS('animation-name', 'none');
  await expect(highlight).toHaveAttribute('stroke-dasharray', '5 5');
});

test('premium work drags from the staffing row and dropdown into the matching workpackage month', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    const setDragImage = DataTransfer.prototype.setDragImage;
    DataTransfer.prototype.setDragImage = function (image, x, y) {
      Reflect.set(window, 'premiumDragPreview', image.matches('[data-premium-date-badge]') ? image.textContent : null);
      setDragImage.call(this, image, x, y);
    };
  });
  await load(page, 'vibrant', data => {
    data.teamMembers[0].role = 'both';
    data.teamMembers[0].absences = { '2026-01-03': 'working' };
    data.teamMembers[1].absences = { '2026-01-03': 'working' };
    data.teamMembers[2].absences = {
      '2026-02-07': 'working',
      '2026-02-08': { type: 'working', halfDay: true },
      '2026-02-14': 'working',
    };
  });
  const openTimeline = () => page.getByRole('button', { name: 'Open Data Factory Combined Team Timeline', exact: true }).click();
  await openTimeline();
  const dialog = page.getByRole('dialog');
  const workpackageMonths = dialog.locator('[data-gantt-row="p-Data Factory"] > div');
  const offsetMonths = dialog.locator('[data-gantt-row="p2-Data Factory"] > div');
  const janBadge = dialog.getByTitle('2026-01-03 · 8 h · Weekend Work · 1.5×', { exact: true });
  const phaseName = (await workpackageMonths.nth(0).getByTitle(/^Drop member onto .* phase label/).textContent())!;
  const phaseLabel = workpackageMonths.nth(0).getByText(phaseName, { exact: true });
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await janBadge.dispatchEvent('dragstart', { dataTransfer: transfer });
  expect(await page.evaluate(() => Reflect.get(window, 'premiumDragPreview'))).toBe('03');
  await expect(dialog.locator('[data-premium-drag-month]')).toHaveText("Jan '26");
  await expect(workpackageMonths.nth(0)).toHaveAttribute('data-premium-drop-target', 'p-Data Factory');
  await expect(workpackageMonths.nth(1)).not.toHaveAttribute('data-premium-drop-target');
  await expect(offsetMonths.nth(0)).not.toHaveAttribute('data-premium-drop-target');
  await phaseLabel.dispatchEvent('dragover', { dataTransfer: transfer });
  await expect(workpackageMonths.nth(0).getByText('M1 ONLY', { exact: true })).toBeVisible();
  await expect(workpackageMonths.nth(1).getByText(/ONLY/)).toHaveCount(0);
  await janBadge.dispatchEvent('dragend', { dataTransfer: transfer });
  await expect(dialog.locator('[data-premium-drop-target]')).toHaveCount(0);
  await expect(workpackageMonths.nth(0).getByText('M1 ONLY', { exact: true })).toHaveCount(0);

  await janBadge.dragTo(workpackageMonths.nth(1));
  await expect(janBadge).toHaveAttribute('draggable', 'true');
  await expect(dialog.locator('[data-premium-drop-target]')).toHaveCount(0);
  await janBadge.dragTo(phaseLabel);
  const regularAndPremiumRow = dialog.locator('[data-timeline-row="wp_member_p-Data Factory_member"]');
  const premiumCell = regularAndPremiumRow.getByTitle(/Premium work: 8 h/);
  await expect(premiumCell).toHaveText('0.2563%');
  await expect(premiumCell).toHaveCSS('color', 'rgb(61, 32, 0)');
  await expect(premiumCell).toHaveCSS('text-shadow', 'none');
  const personalJanuary = dialog.locator('[title^="Shared Person ("][title*="Month 1 ("][title*="Leave / public holidays:"]');
  await expect(personalJanuary).toHaveAttribute('title', /0\.20 \/ 0\.40 FTE occupied \(50%\)/);
  await expect(personalJanuary).toHaveAttribute('title', /Regular allocation: 0\.20 FTE · Premium work: 8 h/);
  await expect(dialog.getByTitle(/Month 1 .*Overall Team Capacity Used/)).toHaveAttribute('title', /0\.20 \/ 0\.90 FTE/);
  const assignedJan = dialog.getByTitle(/2026-01-03.*Allocated to/);
  await expect(assignedJan).toHaveAttribute('draggable', 'false');
  await expect(assignedJan).toHaveCSS('filter', 'grayscale(1)');
  await expect(assignedJan.locator('..').locator('svg > rect[stroke-dasharray]')).toHaveCount(0);

  const freeFebruary = dialog.locator('[title^="Free Member ("][title*="Month 2 ("][title*="Leave / public holidays:"]');
  const arrow = freeFebruary.getByRole('button', { name: 'Choose premium work day' });
  await arrow.click();
  await freeFebruary.getByRole('button', { name: /^2026-02-08 · 4 h/ })
    .locator('[aria-hidden="true"]').dragTo(offsetMonths.nth(1));
  expect(await page.evaluate(() => Reflect.get(window, 'premiumDragPreview'))).toBe('08');
  const premiumOnlyRow = dialog.locator('[data-timeline-row="wp_member_p2-Data Factory_idle"]');
  const premiumOnlyCell = premiumOnlyRow.getByTitle(/Premium work: 4 h/);
  await expect(premiumOnlyCell).toHaveText('0.035%');
  await expect(premiumOnlyCell).toHaveCSS('color', 'rgb(120, 64, 0)');
  await expect(offsetMonths.nth(1)).toContainText('23%');
  await arrow.click();
  const assignedFeb = freeFebruary.getByRole('button', { name: /2026-02-08 · 4 h.*Allocated to Offset project Data Factory/ });
  await expect(freeFebruary).toHaveAttribute('title', /0\.00 \/ 0\.50 FTE occupied \(0%\)/);
  await expect(assignedFeb).toHaveAttribute('draggable', 'false');
  await expect(assignedFeb.locator('[aria-hidden="true"]')).toHaveCSS('filter', 'grayscale(1)');
  await expect(freeFebruary.locator('svg > rect[stroke-dasharray]')).toHaveCount(1);
  await arrow.press('Escape');
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();

  const saved = await savedWorkspace(page);
  expect(saved.workpackages.find(card => card.id === 'p-Data Factory')!.memberPremiumAssignments).toEqual({ member: ['2026-01-03'] });
  expect(saved.workpackages.find(card => card.id === 'p2-Data Factory')!.memberPremiumAssignments).toEqual({ idle: ['2026-02-08'] });
  expect(saved.workpackages.find(card => card.id === 'p2-Data Factory')!.memberMonthlyAssignments).not.toHaveProperty('idle');
  await openTimeline();
  await expect(assignedJan).toHaveAttribute('draggable', 'false');
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('button', { name: 'KPI Team View', exact: true }).click();
  await page.getByRole('button', { name: 'Open KPI Combined Team Timeline', exact: true }).click();
  await expect(assignedJan).toHaveAttribute('draggable', 'false');
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Data Factory Team View', exact: true }).click();
  await openTimeline();
  await expect(janBadge).toHaveAttribute('draggable', 'true');
});

test('management-only premium work cannot be assigned to engineering by drag or manual edit', async ({ page }) => {
  await load(page, 'vibrant', data => {
    data.teamMembers[0].role = 'management';
    data.teamMembers[0].absences = { '2026-01-03': 'working', '2026-02-07': 'working' };
    data.workpackages.find(card => card.id === 'p2-Data Factory')!.memberPremiumAssignments = { member: ['2026-02-07'] };
  });
  await page.getByRole('button', { name: 'Open Data Factory Combined Team Timeline', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const grid = dialog.locator('[data-gantt-row="p-Data Factory"]');
  const date = dialog.getByTitle('2026-01-03 · 8 h · Weekend Work · 1.5×', { exact: true });
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await date.dispatchEvent('dragstart', { dataTransfer: transfer });
  await expect(dialog.locator('[data-premium-drag-month]')).toHaveText("Jan '26");
  await expect(dialog.locator('[data-premium-drop-target]')).toHaveCount(0);
  await date.dispatchEvent('dragend', { dataTransfer: transfer });
  await date.dragTo(grid.locator(':scope > div').first());
  await expect(date).toHaveAttribute('draggable', 'true');

  await grid.locator('../..').getByRole('button', { name: /^Expand .* allocated team member row/ }).click();
  const january = dialog.locator('[data-timeline-row="wp_member_p-Data Factory_member"] > div').first();
  await january.click();
  const input = january.getByRole('textbox');
  await input.fill('0.45');
  await input.press('Enter');
  await expect(january).toHaveText('0.40100%');
  await expect(january.getByTitle(/Premium work:/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  const saved = await savedWorkspace(page);
  expect(saved.workpackages.every(card => !card.memberPremiumAssignments)).toBe(true);
  expect(saved.teamMembers[0].absences).toEqual({ '2026-01-03': 'working', '2026-02-07': 'working' });
});

test('manual staffing uses premium work by priority and releases it before regular hours', async ({ page }) => {
  await load(page, 'vibrant', data => {
    const member = data.teamMembers[2];
    member.fte = 1;
    member.absences = { '2026-01-03': 'working', '2026-01-05': 'working', '2026-01-10': 'working' };
    data.configuration.sitePublicHolidays = { BIE: ['2026-01-03', '2026-01-05'] };
    const card = data.workpackages.find(item => item.id === 'p-Data Factory')!;
    card.memberMonthlyAssignments!.idle = { 0: 0.95 };
    data.configuration.toolFteRates['Data Factory']['Capacity Test'].phases![0].rate = 1.4;
  });
  const open = () => page.getByRole('button', { name: 'Open Data Factory Combined Team Timeline', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const workpackage = dialog.locator('[data-gantt-row="p-Data Factory"]').locator('../..');
  const january = workpackage.locator('[data-timeline-row="wp_member_p-Data Factory_idle"] > div').first();
  const expand = () => workpackage.getByRole('button', { name: /^Expand .* allocated team member row/ }).click();
  const edit = async (value: string) => {
    await january.click();
    const input = january.getByRole('textbox');
    await input.fill(value);
    await input.press('Enter');
  };
  await open();
  await expand();
  await edit('0.94');
  await expect(january).toHaveText('0.9494%');
  await expect(january.getByTitle(/Premium work:/)).toHaveCount(0);
  await edit('1.07');
  await expect(january).toHaveText('1.07107%');
  await expect(january.getByTitle(/Premium work: 19.2 h/)).toHaveCSS('color', 'rgb(255, 239, 160)');
  const personalJanuary = dialog.locator('[title^="Free Member ("][title*="Month 1 ("][title*="Leave / public holidays:"]');
  await expect(personalJanuary).toHaveAttribute('title', /1\.00 \/ 1\.00 FTE occupied \(100%\)/);
  await expect(personalJanuary).not.toHaveAttribute('title', /OVERALLOCATED!/);
  await expect(dialog.getByRole('button', { name: 'Choose premium work day' })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Choose premium work day' }).click();
  await expect(dialog.getByRole('button', { name: /2026-01-05.*Allocated to/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /2026-01-10.*Allocated to/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Choose premium work day' }).press('Escape');

  await edit('1.02');
  await expect(january).toHaveText('1.02102%');
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  let saved = await savedWorkspace(page);
  let card = saved.workpackages.find(item => item.id === 'p-Data Factory')!;
  expect(card.memberPremiumAssignments?.idle).toEqual(['2026-01-03', { date: '2026-01-05', hours: 3.2 }]);
  expect(card.memberMonthlyAssignments?.idle?.[0]).toBe(0.95);

  await open();
  await expand();
  await edit('0.90');
  await expect(january).toHaveText('0.9090%');
  await dialog.getByRole('button', { name: 'Save & Close', exact: true }).click();
  saved = await savedWorkspace(page);
  card = saved.workpackages.find(item => item.id === 'p-Data Factory')!;
  expect(card.memberPremiumAssignments).toBeUndefined();
  expect(card.memberMonthlyAssignments?.idle?.[0]).toBe(0.90);
});

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
  await capacity(page, 'KPI', [{ month: 2, occupied: .6, cap: .6, unavailable: .18, available: .42, days: 6, working: 20 }]);
  await page.getByRole('button', { name: 'Data Factory Team View', exact: true }).click();
  await capacity(page, 'Data Factory', [{ month: 2, occupied: .4, cap: .4, unavailable: .12, available: .28, days: 6, working: 20 }]);
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
  await capacity(page, 'KPI', [{ month: 2, occupied: .6, cap: .6, unavailable: .18, available: .42, days: 6, working: 20 }]);
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
