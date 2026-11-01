import { createSelectiveImportPlan, previewSelectiveImport } from "../src/utils/selectiveWorkspaceImport";
import { test, expect } from '@playwright/test';
import { historyWorkspace } from './fixtures/historyWorkspace';
import { createWorkspaceFile, parseWorkspaceFile, serializeWorkspace } from '../src/utils/workspaceFile';
import { DEFAULT_WEEKEND_WORK_FACTORS, parseWeekendWorkFactor } from '../src/utils/weekendWork';

test('weekend factors retain schema-1 compatibility and validate all saved values', () => {
  const data = historyWorkspace();
  expect(parseWorkspaceFile(serializeWorkspace(data)).data.configuration.weekendWorkFactors).toBeUndefined();
  data.configuration.weekendWorkFactors = { weekend: 1.75, publicHoliday: 1.6, weekendPublicHoliday: 2.5 };
  expect(parseWorkspaceFile(serializeWorkspace(data)).data.configuration.weekendWorkFactors).toEqual(data.configuration.weekendWorkFactors);
  for (const factors of [{ weekend: -1, publicHoliday: 1.5, weekendPublicHoliday: 2 }, { weekend: 1.5 }, { weekend: '1.5', publicHoliday: 1.5, weekendPublicHoliday: 2 }, null]) {
    const file = createWorkspaceFile(data); Object.assign(file.data.configuration, { weekendWorkFactors: factors });
    expect(() => parseWorkspaceFile(JSON.stringify(file))).toThrow(/Weekend work factors/);
  }
  expect(DEFAULT_WEEKEND_WORK_FACTORS).toEqual({ weekend: 1.5, publicHoliday: 1.5, weekendPublicHoliday: 2 });
  for (const invalid of ['', '-1', 'Infinity', 'NaN', '1e4', '1.2.3']) expect(parseWeekendWorkFactor(invalid)).toBeUndefined();
  expect(parseWeekendWorkFactor('1.75')).toBe(1.75); expect(parseWeekendWorkFactor('0')).toBe(0);
});

for (const theme of ['vibrant', 'basic', 'retro'] as const) test(`weekend work factors save cancel reset undo and transfer without changing costs (${theme})`, async ({ page }) => {
  await page.addInitScript(() => {
    let saved = ''; Object.defineProperty(window, '__weekendSaved', { get: () => saved });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => ({ createWritable: async () => ({ write: async (blob: Blob) => { saved = await blob.text(); }, close: async () => {}, abort: async () => {} }) }) });
  });
  const data = historyWorkspace(); data.view.theme = theme;
  await page.goto('/');
  await page.getByLabel('Workspace file', { exact: true }).setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(serializeWorkspace(data)) });
  await page.getByRole('button', { name: 'Import & Replace', exact: true }).click();
  const before = await page.getByRole('button', { name: /^Project cost:/ }).allTextContents();
  const open = async () => {
    await page.getByRole('button', { name: "Default's Configuration", exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Weekend Work Factors', exact: true }).click();
    return page.getByRole('dialog');
  };
  let dialog = await open();
  const labels = ['Weekend Work', 'Public Holiday Work', 'Weekend & Public Holiday Work'];
  for (const [i, value] of ['1.5', '1.5', '2'].entries()) await expect(dialog.getByLabel(labels[i], { exact: true })).toHaveValue(value);
  await dialog.getByLabel(labels[0], { exact: true }).fill('-2');
  await expect(dialog.getByRole('button', { name: 'Save Configuration', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByLabel(labels[0], { exact: true }).fill('1,75');
  await dialog.getByLabel(labels[1], { exact: true }).fill('1.8');
  await dialog.getByLabel(labels[2], { exact: true }).fill('2.5');
  await dialog.getByRole('button', { name: 'Save Configuration', exact: true }).click();
  expect(await page.getByRole('button', { name: /^Project cost:/ }).allTextContents()).toEqual(before);
  dialog = await open(); await expect(dialog.getByLabel(labels[0], { exact: true })).toHaveValue('1.75');
  await dialog.getByLabel(labels[0], { exact: true }).fill('3'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  dialog = await open(); await expect(dialog.getByLabel(labels[0], { exact: true })).toHaveValue('1.75');
  await dialog.getByRole('button', { name: 'Reset to Defaults', exact: true }).click();
  for (const [i, value] of ['1.5', '1.5', '2'].entries()) await expect(dialog.getByLabel(labels[i], { exact: true })).toHaveValue(value);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  dialog = await open(); await expect(dialog.getByLabel(labels[0], { exact: true })).toHaveValue('1.5'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__weekendSaved'))).not.toBe('');
  const saved = JSON.parse(await page.evaluate(() => Reflect.get(window, '__weekendSaved'))).data;
  expect(saved.configuration.weekendWorkFactors).toEqual({ weekend: 1.75, publicHoliday: 1.8, weekendPublicHoliday: 2.5 });
});


test('selective imports keep weekend factors unless explicitly chosen as shared settings', () => {
  const current = historyWorkspace(), incoming = historyWorkspace();
  current.configuration.weekendWorkFactors = { ...DEFAULT_WEEKEND_WORK_FACTORS };
  incoming.configuration.weekendWorkFactors = { weekend: 2, publicHoliday: 2.25, weekendPublicHoliday: 3 };
  const plan = createSelectiveImportPlan(current, incoming);
  const kept = previewSelectiveImport(current, incoming, plan);
  expect(kept.errors).toEqual([]);
  expect(kept.data!.configuration.weekendWorkFactors).toEqual(DEFAULT_WEEKEND_WORK_FACTORS);
  plan.shared = ['weekendWorkFactors'];
  const applied = previewSelectiveImport(current, incoming, plan);
  expect(applied.errors).toEqual([]);
  expect(applied.data!.configuration.weekendWorkFactors).toEqual(incoming.configuration.weekendWorkFactors);
});
