import { test, expect, type Page, type Locator } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";

async function charts(page: Page, query = "") {
  await page.route("**/__spending-test*", (route) => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/project-spending-harness.tsx") }));
  await page.goto(`/__spending-test?${query}`);
  await page.getByRole("button", { name: /Project cost:/ }).click();
  await page.getByRole("button", { name: "Graph View", exact: true }).click();
  return page.getByRole("dialog");
}
async function positions(svg: Locator) {
  return svg.locator('g[role="button"]').first().locator('rect[style*="transform"]').evaluateAll((elements) =>
    elements.map((element) => ({ color: element.getAttribute("class")!.split(" ")[0],
      y: new DOMMatrix(getComputedStyle(element).transform).m42, height: Number(element.getAttribute("height")),
      opacity: Number(getComputedStyle(element).opacity) })));
}

test("overall charts show priced totals, per-tool management inclusion, aligned guides and dense axes", async ({ page }) => {
  const dialog = await charts(page);
  await expect(dialog.getByRole("heading", { name: "Overall Project Spending", exact: true })).toBeVisible();
  const upper = dialog.locator('section[aria-label="Combined spending chart"] svg');
  const lower = dialog.locator('section[aria-label="Monthly engineering and management spending"] svg');
  await expect(upper.locator('text[text-anchor="end"]')).toHaveCount(11);
  await expect(lower.locator('text[text-anchor="end"]')).toHaveCount(11);
  await expect(upper.locator("foreignObject")).toHaveCount(4);
  await expect(lower.locator("foreignObject")).toHaveCount(0);
  expect(await upper.locator('line[stroke-dasharray="3 4"][class]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("x1"))))
    .toEqual(await lower.locator('line[stroke-dasharray="3 4"][class]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("x1"))));
  const legend = dialog.getByRole("list", { name: "Monthly spending legend" });
  await expect(legend.getByRole("button")).toHaveText(["KPI", "Simulation", "Other"]);
  const january = lower.locator('g[role="button"]').first();
  await expect(january).toHaveAttribute("aria-label", /KPI: € 5,120/);
  await expect(january).toHaveAttribute("aria-label", /Simulation: € 3,840/);
  await january.click();
  await expect(dialog.getByText("FTEs:", { exact: false })).toContainText("€ 11,360");
  await expect(dialog.getByText("Management support:", { exact: false })).toHaveCount(0);
  expect(await january.locator('rect[fill="transparent"]').getAttribute("class")).toBeNull();
  await expect(upper.locator('rect[fill="currentColor"]').first()).toHaveAttribute("class", "text-yellow-500");
  await expect(lower.locator('line[stroke="#000000"]')).toHaveAttribute("y1", "0");
});

test("legend and bar clicks preserve current stack order and animate every segment without replacing its node", async ({ page }) => {
  const dialog = await charts(page);
  const lower = dialog.locator('section[aria-label="Monthly engineering and management spending"] svg');
  const legend = dialog.getByRole("list", { name: "Monthly spending legend" });
  const firstMonth = lower.locator('g[role="button"]').first();
  const bars = firstMonth.locator('rect[style*="transform"]');
  const original = await bars.elementHandles();
  const before = await positions(lower);
  const totalHeight = before.reduce((sum, bar) => sum + bar.height, 0);
  await legend.getByRole("button", { name: "Other", exact: true }).click();
  await expect(legend.getByRole("button", { name: "Other", exact: true })).toHaveAttribute("aria-pressed", "true");
  const targetY = await bars.nth(2).evaluate((node) => Number((node as SVGRectElement).style.transform.match(/translateY\((.+)px\)/)![1]));
  await expect.poll(async () => (await positions(lower))[2].y).toBeCloseTo(targetY, 3);
  const otherFirst = await positions(lower);
  expect(otherFirst[2].y).toBeGreaterThan(otherFirst[0].y);
  expect(otherFirst[0].y).toBeGreaterThan(otherFirst[1].y);
  await legend.getByRole("button", { name: "Simulation", exact: true }).click();
  const afterClick = await positions(lower);
  // Background KPI must also be moving between its old and new positions.
  const kpiTarget = await bars.nth(0).evaluate((node) => Number((node as SVGRectElement).style.transform.match(/translateY\((.+)px\)/)![1]));
  expect(Math.abs(afterClick[0].y - kpiTarget)).toBeGreaterThan(1);
  expect(await original[0].evaluate((node) => node.isConnected)).toBe(true);
  expect(await original[1].evaluate((node) => node.isConnected)).toBe(true);
  await expect.poll(async () => (await positions(lower))[0].y).toBeCloseTo(kpiTarget, 3);
  const simulationFirst = await positions(lower);
  expect(simulationFirst[1].y).toBeGreaterThan(simulationFirst[2].y);
  expect(simulationFirst[2].y).toBeGreaterThan(simulationFirst[0].y);
  expect(simulationFirst.reduce((sum, bar) => sum + bar.height, 0)).toBeCloseTo(totalHeight, 8);
  await expect.poll(async () => (await positions(lower))[0].opacity).toBe(0.2);
  const duration = await bars.first().evaluate((node) => getComputedStyle(node).transitionDuration.split(",").map((value) => parseFloat(value)));
  expect(duration[1]).toBeGreaterThan(duration[0]);
  // Clicking the faded KPI segment uses the same category selection as its legend.
  await bars.nth(0).click();
  await expect(legend.getByRole("button", { name: "KPI", exact: true })).toHaveAttribute("aria-pressed", "true");
  await legend.getByRole("button", { name: "KPI", exact: true }).click();
  await expect(legend.locator('[aria-pressed="true"]')).toHaveCount(0);
});

test("tool-specific graph retains separate management, matching title and yellow monthly bars", async ({ page }) => {
  const dialog = await charts(page, "tool=KPI");
  await expect(dialog.getByRole("heading", { name: "Project KPI Spending", exact: true })).toBeVisible();
  const legend = dialog.getByRole("list", { name: "Monthly spending legend" });
  await expect(legend.getByRole("button")).toHaveText(["KPI engineering", "Other engineering", "Management support"]);
  const lower = dialog.locator('section[aria-label="Monthly engineering and management spending"] svg');
  await lower.locator('g[role="button"]').first().focus();
  const readout = dialog.locator('[aria-live="polite"]');
  await expect(readout.getByText("Engineering:", { exact: false })).toContainText("€ 7,200");
  await expect(readout.getByText("Management support:", { exact: false })).toContainText("€ 320");
  await expect(readout.getByText("Monthly:", { exact: false }).locator("strong")).toHaveClass(/text-yellow-500/);
  await expect(dialog.getByRole("heading", { name: "Project KPI Spending", exact: true }).locator("span")).toHaveClass(/text-emerald-600/);
});

test("switching views preserves timeline expansion and the toggle keeps matching dimensions and icon", async ({ page }) => {
  await charts(page);
  await page.getByRole("button", { name: "Timeline View", exact: true }).click();
  const expand = page.getByRole("button", { name: "Expand All", exact: true });
  const toggle = page.getByRole("button", { name: "Graph View", exact: true });
  const close = page.getByRole("button", { name: "Close project spending", exact: true });
  const e = (await expand.boundingBox())!, t = (await toggle.boundingBox())!, c = (await close.boundingBox())!;
  expect(t.height).toBe(e.height);
  expect(t.x).toBeGreaterThan(e.x);
  expect(c.x).toBeGreaterThan(t.x);
  await expand.click();
  await toggle.click();
  await expect(page.getByRole("button", { name: "Timeline View", exact: true }).locator("svg rect")).toHaveCount(1);
  await page.getByRole("button", { name: "Timeline View", exact: true }).click();
  await expect(page.getByText("Prague Engineer", { exact: true }).first()).toBeVisible();
});

test("EUR conversion is shared and reduced motion disables the category animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let requests = 0;
  await page.route("https://api.frankfurter.dev/v2/rate/USD/EUR", (route) => {
    requests++;
    return route.fulfill({ json: { base: "USD", quote: "EUR", rate: 0.5, date: "2026-10-01" } });
  });
  const dialog = await charts(page, "currency=USD");
  const lower = dialog.locator('section[aria-label="Monthly engineering and management spending"] svg');
  await expect(lower.locator('g[role="button"]').first()).toHaveAttribute("aria-label", /KPI: € 2,560/);
  await dialog.getByRole("list", { name: "Monthly spending legend" }).getByRole("button", { name: "Other", exact: true }).click();
  expect(await lower.locator('rect[style*="transform"]').first().evaluate((node) => getComputedStyle(node).transitionProperty)).toBe("none");
  expect(requests).toBe(1);
});
