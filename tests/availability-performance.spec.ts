import { test, expect } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/__availability-performance?*", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/availability-performance-harness.tsx") }));
});
test("editing one row does not revisit another member; paint changes keep capacity summaries cached", async ({ page }) => {
  await page.goto("/__availability-performance?isolation=true");
  await page.getByRole("button", { name: "Edit Alice", exact: true }).click();
  await expect(page.getByRole("button", { name: "Alice Example, 2026-01-05: Vacation", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('div[title^="Alice Example ·"]')).toHaveAttribute("title", /1: 0\.95 FTE/);
  let counters = await page.evaluate(() => (window as any).__availabilityPerformance);
  expect(counters.names.alice).toBeGreaterThan(0); expect(counters.names.bob).toBe(0);
  expect(counters.capacities.alice).toBeGreaterThan(0); expect(counters.capacities.bob).toBe(0);
  await page.getByRole("button", { name: "Change paint", exact: true }).click();
  counters = await page.evaluate(() => (window as any).__availabilityPerformance);
  expect(counters.names.bob).toBeGreaterThan(0); expect(counters.capacities.alice).toBe(0); expect(counters.capacities.bob).toBe(0);
  await page.getByRole("button", { name: "Add holiday", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bob Example, 2026-01-06: Public holiday", exact: true })).toBeAttached();
  counters = await page.evaluate(() => (window as any).__availabilityPerformance);
  expect(counters.capacities.alice).toBeGreaterThan(0); expect(counters.capacities.bob).toBeGreaterThan(0);
  await expect(page.locator('div[title^="Alice Example ·"]')).toHaveAttribute("title", /1: 0\.91 FTE/);
  await expect(page.locator('div[title^="Bob Example ·"]')).toHaveAttribute("title", /1: 0\.95 FTE/);
  await page.getByRole("button", { name: "Clear Alice", exact: true }).click();
  await expect(page.locator('div[title^="Alice Example ·"]')).toHaveAttribute("title", /1: 0\.95 FTE/);
  counters = await page.evaluate(() => (window as any).__availabilityPerformance);
  expect(counters.names.bob).toBe(0); expect(counters.capacities.bob).toBe(0);
  await page.getByRole("button", { name: "Half Alice", exact: true }).click();
  await expect(page.locator('div[title^="Alice Example ·"]')).toHaveAttribute("title", /1: 0\.93 FTE/);
});
const percentile = (items: number[], q: number) => [...items].sort((a,b) => a-b)[Math.min(items.length-1, Math.floor(items.length*q))] ?? 0;
for (const [global, count, kind] of [[false,4,"member"],[true,16,"member"],[true,40,"member"],[true,40,"site"],[true,40,"header"]] as const)
test(`large calendar drag profile and selection correctness (${global ? "global" : "team"}, ${count}, ${kind})`, async ({ page }) => {
  await page.goto(`/__availability-performance?global=${global}&count=${count}`);
  const calendar = page.getByTestId("availability-calendar"); await calendar.waitFor(); await page.evaluate(() => document.fonts.ready);
  const day = kind === "member" ? page.getByRole("button", { name: /^Member0 Example, 2026-01-05:/ })
    : kind === "site" ? page.getByRole("button", { name: /^Prague public holiday, 2026-01-05:/ })
    : page.getByRole("button", { name: "Apply public holiday to shown sites on 2026-01-05", exact: true });
  await day.scrollIntoViewIfNeeded(); const box = await day.boundingBox(), bounds = await calendar.boundingBox();
  await page.mouse.move(box!.x+12, box!.y+10); await page.mouse.down();
  await page.mouse.move(Math.min(1278, bounds!.x+bounds!.width+30), box!.y+10);
  const sample = await page.evaluate(async () => {
    const calendar = document.querySelector('[data-testid="availability-calendar"]') as HTMLElement;
    const metrics = (window as any).__availabilityPerformance; metrics.commits = [];
    const intervals: number[] = []; let last = performance.now(), start = last;
    await new Promise<void>(resolve => { const tick = (now: number) => {
      intervals.push(now-last); last = now;
      if (now-start < 1800) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
    return { intervals, commits: metrics.commits as number[], scrollLeft: calendar.scrollLeft };
  });
  await page.mouse.up();
  expect(sample.scrollLeft).toBeGreaterThan(40);
  console.log(JSON.stringify({ global, members: count, kind, frameP50: percentile(sample.intervals,.5), frameP95: percentile(sample.intervals,.95), renderP50: percentile(sample.commits,.5), renderP95: percentile(sample.commits,.95), scrollLeft: sample.scrollLeft }));
  // Browser timing is diagnostic only; correctness assertions do not depend on FPS.
  await page.getByRole("button", { name: "Save & Close", exact: true }).click();
  const saved = await page.evaluate(() => (window as any).__availabilityPerformance.saved);
  if (kind === "member") {
    expect(Object.keys(saved.absences.member0).length).toBeGreaterThan(5);
    expect(Object.keys(saved.absences.member1)).toHaveLength(0);
  } else {
    expect(saved.holidays.PRA.length).toBeGreaterThan(5);
    if (kind === "header") expect(saved.holidays.BIE).toEqual(saved.holidays.PRA);
  }
});
