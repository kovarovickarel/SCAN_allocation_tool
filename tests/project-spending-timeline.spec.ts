import { test, expect, type Page } from "@playwright/test";
import { harnessHtml } from "./fixtures/harnessHtml";

async function openSpending(page: Page, query = "") {
  await page.route("**/__spending-test*", (route) => route.fulfill({ contentType: "text/html", body:
    harnessHtml("/tests/fixtures/project-spending-harness.tsx") }));
  await page.goto(`/__spending-test?${query}`);
  await page.getByRole("button", { name: /Project cost:/ }).click();
  return page.getByRole("dialog");
}

for (const theme of ["vibrant", "basic", "retro"]) test(`spending timeline expands, collapses and closes in ${theme}`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const dialog = await openSpending(page, `theme=${theme}`);
  await expect(dialog.getByRole("heading", { name: "Spending Test Project Spending" })).toBeVisible();
  await expect(dialog).not.toContainText("workpackages)");
  await expect(dialog).not.toContainText("Current allocations ×");
  await expect(dialog.getByText("€ 60,960", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Expanded Spending", exact: true }).click();
  await dialog.getByRole("button", { name: "Expand All", exact: true }).click();
  await expect(dialog.getByText("Prague Engineer", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText("Support Manager", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Collapse All", exact: true }).click();
  await expect(dialog.getByText("Prague Engineer", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Project cost:/ })).toBeFocused();
  expect(errors).toEqual([]);
});

for (const theme of ["vibrant", "basic", "retro"]) test(`equal large workpackage and member amounts keep distinct weights and fit (${theme})`, async ({ page }) => {
  const dialog = await openSpending(page, `theme=${theme}&highCost=1&dense=1`);
  await dialog.getByRole("button", { name: "Expanded Spending", exact: true }).click();
  const rowFor = (name: string) => dialog.getByText(name, { exact: true }).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " grid ")][1]');
  const amountIn = (name: string) => rowFor(name).locator("span.inline-block.whitespace-nowrap").filter({ hasText: /^€460,000$/ }).nth(1);
  const workpackage = amountIn("Simulation Work");
  const member = amountIn("German Engineer");
  await expect(workpackage).toHaveCSS("font-weight", "900");
  await expect(member).toHaveCSS("font-weight", "400");
  for (const label of [workpackage, member]) {
    await expect(label).toHaveText("€460,000");
    await expect.poll(() => label.evaluate((element) => {
      const container = element.parentElement!;
      const style = getComputedStyle(container);
      return element.getBoundingClientRect().width - (container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    })).toBeLessThanOrEqual(0.5);
  }
  const container = workpackage.locator("..");
  await container.evaluate((element) => { element.style.width = "200px"; element.style.flexShrink = "0"; });
  await expect(workpackage).toHaveCSS("font-size", "10px");
  await container.evaluate((element) => { element.style.width = "36px"; });
  await expect.poll(() => workpackage.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeLessThan(10);
});

test("tool title and scope match the cost button; close button and backdrop dismiss safely", async ({ page }) => {
  let dialog = await openSpending(page, "tool=KPI");
  await expect(dialog.getByRole("heading", { name: "Spending Test Project KPI Spending" })).toBeVisible();
  await expect(dialog.getByText("Simulation Work", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("€ 37,920", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Close project spending", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /Project cost:/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.click({ position: { x: 1, y: 1 } });
  await expect(dialog).toHaveCount(0);
});

test("missing rates are flagged and currency conversion failure never plots untranslated amounts", async ({ page }) => {
  await page.route("https://api.frankfurter.dev/**", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  const dialog = await openSpending(page, "currency=USD&missing=1");
  await expect(dialog.getByRole("status")).toContainText("EUR conversion is unavailable");
  await expect(dialog.getByRole("status")).toContainText("BIE");
  await expect(dialog.getByText("N/A", { exact: true }).first()).toBeVisible();
});

test("project dashboard cost button opens the production spending dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Project cost:/ }).first().click();
  await expect(page.getByRole("heading", { name: "GM Project Spending", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close project spending", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("tool expansion and member spending expansion are independent and preserve each other", async ({ page }) => {
  const dialog = await openSpending(page);
  const expandMembers = dialog.getByRole("button", { name: "Expanded Spending", exact: true });
  const collapseMembers = dialog.getByRole("button", { name: "Collapsed Spending", exact: true });
  const expandTools = dialog.getByRole("button", { name: "Expand All", exact: true });
  const collapseTools = dialog.getByRole("button", { name: "Collapse All", exact: true });
  await expandTools.click();
  await expect(dialog.getByText("KPI Work", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Prague Engineer", { exact: true })).toHaveCount(0);
  await expandMembers.click();
  await expect(expandMembers).toHaveAttribute("aria-pressed", "true");
  await collapseTools.click();
  await expect(dialog.getByText("KPI Work", { exact: true })).toHaveCount(0);
  await expandTools.click();
  await expect(dialog.getByText("Prague Engineer", { exact: true }).first()).toBeVisible();
  await collapseMembers.click();
  await expect(collapseMembers).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByText("KPI Work", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Prague Engineer", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Expand spending by member for KPI Work", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Collapse spending by member for KPI Work", exact: true })).toHaveText("- Collapse");
  await expect(expandMembers).toHaveAttribute("aria-pressed", "false");
  await expect(collapseMembers).toHaveAttribute("aria-pressed", "false");
});

test("spending summary rows use averages, complete total badges and compact million cells", async ({ page }) => {
  const dialog = await openSpending(page, "highCost=1&dense=1");
  const rowFor = (name: string) => dialog.getByText(name, { exact: true }).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " grid ")][1]');
  const cumulative = rowFor("Cumulative Spending");
  const monthly = rowFor("Monthly Spending");
  const totalBadge = cumulative.locator("span[title]");
  const avgBadge = monthly.locator('span[title^="Average monthly spending"]');
  await expect(totalBadge).toHaveText("€ 2,801,760");
  await expect(avgBadge).toHaveText("€ 155,653");
  await expect(cumulative.locator("div[title]").filter({ hasText: "k" }).first()).toBeVisible();
  await expect(cumulative.locator("div[title]").filter({ hasText: "k" }).first()).toContainText("EUR");
  await expect(cumulative.locator("div[title]").last()).toHaveText("2802kEUR");
  expect((await cumulative.boundingBox())!.y).toBeLessThan((await monthly.boundingBox())!.y);
  await expect(monthly.getByText("EUR", { exact: true })).toHaveCount(18);
  await expect(dialog.getByText("Heatmap Scale:", { exact: true })).toHaveCount(0);
});

test("Other spending appears only for an allocated team in both timeline and graphs", async ({ page }) => {
  let dialog = await openSpending(page, "tool=Simulation");
  await expect(dialog.getByText("Other Work", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Other", exact: true })).toHaveCount(0);
  await expect(dialog.getByText("€ 23,040", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Graph View", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /Focus Other/ })).toHaveCount(0);
  dialog = await openSpending(page, "tool=KPI");
  await expect(dialog.getByText("Other Work", { exact: true })).toBeVisible();
  await expect(dialog.getByText("€ 37,920", { exact: true }).first()).toBeVisible();
});

test("production project cost and spending scope agree when Other belongs to a different team", async ({ page }) => {
  await page.goto("/");
  await page.locator('[draggable="true"]').filter({ hasText: "Config Manager" }).first()
    .dragTo(page.getByRole("heading", { name: "GM", exact: true }));
  await page.getByRole("button", { name: "Confirm & Place in Project", exact: true }).click();
  await page.getByTitle("KPI Team View").click();
  await page.getByRole("button", { name: "Open KPI Combined Team Timeline" }).click();
  const timeline = page.getByRole("dialog");
  await timeline.getByRole("button", { name: 'Include "Other" WPs', exact: true }).click();
  await timeline.getByTitle("Drag and drop Alex Novak onto any activity above to allocate", { exact: true })
    .dragTo(timeline.getByText("Config Manager", { exact: true }));
  await timeline.getByRole("button", { name: "Save & Close", exact: true }).click();
  const button = page.getByRole("button", { name: /Project cost:/ }).first();
  const allocatedCost = await button.innerText();
  expect(allocatedCost).not.toBe("€0");
  await button.click();
  await expect(page.getByRole("dialog").getByText("Config Manager", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close project spending", exact: true }).click();
  await page.getByTitle("Simulation Team View").click();
  await expect(button).toHaveText("€0");
  await button.click();
  await expect(page.getByRole("dialog").getByText("Config Manager", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog").getByText("€ 0", { exact: true }).first()).toBeVisible();
});

test("project cost button retains compact yellow content with the subtle purple background", async ({ page }) => {
  await page.route("**/__spending-test*", (route) => route.fulfill({ contentType: "text/html", body:
    harnessHtml("/tests/fixtures/project-spending-harness.tsx") }));
  await page.goto("/__spending-test");
  const button = page.getByRole("button", { name: /Project cost:/ });
  await expect(button).toHaveCSS("background-color", "rgba(88, 28, 135, 0.3)");
  await expect(button).toHaveCSS("border-color", "rgb(107, 33, 168)");
  await expect(button.locator("span").last()).toHaveCSS("color", "rgb(250, 204, 21)");
  await button.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
