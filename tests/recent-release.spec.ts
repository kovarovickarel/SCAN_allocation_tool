import { test, expect, type Page } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";
import { DEFAULT_SUPPLIERS, DEFAULT_TOOL_FTE_RATES } from "../src/constants";
import { ensureOtherSupplier, retainUsedSuppliers } from "../src/utils/nonFteWorkpackages";

async function open(page: Page, screen: string) {
  await page.route("**/__recent-release", route => route.fulfill({ contentType: "text/html", body: harnessHtml("/tests/fixtures/recent-release-harness.tsx") }));
  await page.goto("/__recent-release"); await page.getByRole("button", { name: `Open ${screen}`, exact: true }).click();
}
async function values(page: Page, id: string) { return JSON.parse((await page.getByTestId(id).textContent())!); }
test("default Other supplier is unique, collision-safe and retained through reset", () => {
  expect(DEFAULT_SUPPLIERS.filter(supplier => supplier.name === "Other")).toHaveLength(1);
  const source = [{ id: "supplier-other", name: "Real supplier" }]; const copy = structuredClone(source);
  expect(ensureOtherSupplier(source)[0]).toEqual({ id: "supplier-other-1", name: "Other" }); expect(source).toEqual(copy);
  expect(ensureOtherSupplier([{ id: "custom-other", name: "Other" }])).toEqual([{ id: "custom-other", name: "Other" }]);
  expect(retainUsedSuppliers([], source, new Set(["supplier-other"]))).toHaveLength(2);
});
test("seeded definitions omit dev support while retaining meetings", () => {
  for (const [tool, types] of Object.entries(DEFAULT_TOOL_FTE_RATES)) for (const rates of Object.values(types) as any[]) {
    expect(rates.supportingPhases.some(activity => activity.id === "devFunctionsSupport")).toBe(false);
    if (tool !== "Other") expect(rates.supportingPhases.some(activity => activity.id === "weeklyMeetings")).toBe(true);
  }
});
for (const [kind, label, count] of [["both", "All", 6], ["fte", "FTE", 3], ["non-fte", "Non-FTE", 3]] as const) test(`bulk reusability scope ${kind} requires confirmation before saving`, async ({ page }) => {
  await open(page, "reusability"); const before = await values(page, "saved-cards");
  const dialog = page.getByRole("dialog"); await dialog.getByLabel("Reusability", { exact: true }).selectOption("High Reusability");
  await dialog.getByRole("button", { name: label, exact: true }).click(); await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Confirm reusability changes" })).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText(`${count} workpackages`); expect(await values(page, "saved-cards")).toEqual(before);
  await dialog.getByRole("button", { name: "Confirm changes" }).click();
  expect((await values(page, "saved-cards")).filter(card => card.reusability === "High Reusability")).toHaveLength(count);
});
for (const route of ["Cancel", "Close reusability", "Escape", "Back"] as const) test(`bulk reusability ${route} preserves draft source`, async ({ page }) => {
  await open(page, "reusability"); const before = await values(page, "saved-cards"); const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reusability", { exact: true }).selectOption("High Reusability"); await dialog.getByRole("button", { name: "OK", exact: true }).click();
  if (route === "Escape") await page.keyboard.press("Escape"); else await dialog.getByRole("button", { name: route, exact: true }).click();
  if (route === "Back") { await expect(dialog.getByRole("button", { name: "OK", exact: true })).toBeVisible(); await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); }
  expect(await values(page, "saved-cards")).toEqual(before);
});
test("no-op OK closes; empty family selection disables and backdrop preserves dialog", async ({ page }) => {
  await open(page, "reusability"); await page.getByRole("dialog").click({ position: { x: 1, y: 1 } });
  await page.getByRole("button", { name: "Select none", exact: true }).click(); await expect(page.getByRole("button", { name: "OK", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Select all", exact: true }).click(); await expect(page.getByRole("button", { name: "OK", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "OK", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("tool view offers only that family plus Other and applies to those alone", async ({ page }) => {
  await open(page, "reusability"); await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Test view").selectOption("KPI"); await page.getByRole("button", { name: "Open reusability" }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog.getByRole("button", { name: "Data Factory", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Select all", exact: true })).toHaveCount(0);
  await dialog.getByLabel("Reusability", { exact: true }).selectOption("High Reusability"); await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm changes" }).click(); const cards = await values(page, "saved-cards");
  expect(cards.filter(card => card.tool === "Data Factory").every(card => card.reusability === "New")).toBe(true);
  expect(cards.filter(card => card.reusability === "High Reusability")).toHaveLength(4);
});
test("zero custom factor blocks purchases but is allowed for FTE-only", async ({ page }) => {
  await open(page, "reusability"); const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reusability", { exact: true }).selectOption("Other"); await dialog.getByLabel("Custom factor (0–1)").fill("0");
  await expect(dialog.getByRole("button", { name: "OK", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "FTE", exact: true }).click(); await expect(dialog.getByRole("button", { name: "OK", exact: true })).toBeEnabled();
});
test("main MH editing preserves duration and synchronizes FTE with three decimal places", async ({ page }) => {
  await open(page, "phases"); const mh = page.getByLabel("Phase 1 man-hours", { exact: true }); await expect(mh).toHaveValue("960");
  await mh.fill("320"); await mh.blur(); await expect(page.getByLabel("Phase 1 duration", { exact: true })).toHaveValue("6");
  await expect(page.getByLabel("Phase 1 FTE rate", { exact: true })).toHaveValue("0.333"); expect((await values(page, "phases"))[0].rate).toBe(0.333);
  await page.getByLabel("Phase 1 duration", { exact: true }).fill("3"); await expect(mh).toHaveValue("160");
  const rate = page.getByLabel("Phase 1 FTE rate", { exact: true }); await rate.fill("0.123456"); await rate.blur(); await expect(rate).toHaveValue("0.123");
  await expect(mh).toHaveValue("59");
});
test("maintenance total and project-end monthly MH edits use the correct denominator", async ({ page }) => {
  await open(page, "phases"); await page.getByLabel("Phase 2 man-hours", { exact: true }).fill("960");
  await expect(page.getByLabel("Phase 2 FTE rate", { exact: true })).toHaveValue("1"); await expect(page.getByLabel("Phase 2 duration", { exact: true })).toHaveValue("6");
  await page.getByLabel("Phase 3 man-hours per month", { exact: true }).fill("80"); await expect(page.getByLabel("Phase 3 FTE rate", { exact: true })).toHaveValue("0.5");
});
test("supporting MH is monthly, accepts decimal commas and rejects invalid input", async ({ page }) => {
  await open(page, "phases"); const mh = page.getByLabel("Supporting activity 1 man-hours per month", { exact: true });
  await mh.fill("20,5"); await expect(page.getByLabel("Supporting activity 1 FTE rate", { exact: true })).toHaveValue("0.128");
  await mh.fill("-1"); await expect(mh).toHaveAttribute("aria-invalid", "true"); await expect(page.getByRole("alert").filter({ hasText: "supporting activity" })).toBeVisible();
});
test("responsive subtool tag abbreviates without oscillation and restores after resizing", async ({ page }) => {
  await open(page, "tag"); const tag = page.getByTitle("Trace Checker", { exact: true }); await expect(tag).toHaveText(/Trace CheckerTrace Checker/);
  await page.getByLabel("Row width").fill("220"); await expect(tag).toHaveText(/Trace CheckerTC$/);
  await page.getByLabel("Row width").fill("400"); await expect(tag).toHaveText(/Trace CheckerTrace Checker/);
});
for (const [kind, toolCost, slotCost, mh] of [["both", "140 EUR", "130 EUR", true], ["fte", "50 EUR", "40 EUR", true], ["non-fte", "90 EUR", "90 EUR", false]] as const) test(`tool and subtool ${kind} header cost and MH scope`, async ({ page }) => {
  await open(page, "tool"); await page.getByLabel("Workpackage view").selectOption(kind);
  const header = page.getByTestId("tool").locator(":scope > div > div").first(); await expect(header).toContainText(toolCost);
  const slot = page.getByText("Pipeline", { exact: true }).first().locator("..").locator(".."); await expect(slot).toContainText(slotCost);
  if (mh) await expect(header).toContainText("480 MH"); else { await expect(header).not.toContainText(" MH"); await expect(slot).not.toContainText(" MH"); }
});
