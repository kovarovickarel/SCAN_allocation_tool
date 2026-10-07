import { test, expect, type Page } from "@playwright/test";

async function suppliers(page: Page) {
  await page.getByRole("button", { name: "Default's Configuration" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Suppliers", exact: true }).click();
  return dialog;
}
async function member(page: Page) {
  await page.getByRole("button", { name: "Add Member", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("e.g. John").fill("Supplier");
  await dialog.getByPlaceholder("e.g. Smith").fill("Tester");
  return dialog;
}

test("configured member suppliers survive editing and reset and are released for internal members", async ({ page }) => {
  await page.goto("/");
  let dialog = await suppliers(page);
  await dialog.getByLabel("New supplier name").fill("Custom Staffing");
  await dialog.getByRole("button", { name: "Add Supplier", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Configuration" }).click();
  await page.getByTitle("KPI Team View").click();
  dialog = await member(page);
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).check();
  await dialog.getByLabel("Monthly salary cost *", { exact: true }).fill("0");
  await expect(dialog.getByRole("button", { name: "Add Member", exact: true })).toBeDisabled();
  await dialog.getByLabel("Supplier *", { exact: true }).selectOption({ label: "Custom Staffing" });
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).uncheck();
  await expect(dialog.getByLabel("Supplier *", { exact: true })).toHaveCount(0);
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).check();
  await expect(dialog.getByLabel("Supplier *", { exact: true }).locator("option:checked")).toHaveText("Custom Staffing");
  await dialog.getByRole("button", { name: "Add Member", exact: true }).click();
  await expect(page.getByTitle("Supplier: Custom Staffing", { exact: true })).toBeVisible();
  await page.getByTitle("Edit Supplier Tester", { exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Supplier *", { exact: true }).locator("option:checked")).toHaveText("Custom Staffing");
  await dialog.getByLabel("Supplier *", { exact: true }).selectOption("supplier-luxoft");
  await page.keyboard.press("Escape");
  dialog = await suppliers(page);
  await expect(dialog.getByRole("button", { name: "Remove supplier Custom Staffing", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Reset to Defaults" }).click();
  await expect(dialog.getByRole("button", { name: "Remove supplier Custom Staffing", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Save Configuration" }).click();
  await page.getByTitle("Edit Supplier Tester", { exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Supplier *", { exact: true }).locator("option:checked")).toHaveText("Custom Staffing");
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByTitle("Supplier: Custom Staffing", { exact: true })).toHaveCount(0);
  dialog = await suppliers(page);
  await expect(dialog.getByRole("button", { name: "Remove supplier Custom Staffing", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Remove supplier Custom Staffing", exact: true }).click();
  await dialog.getByRole("button", { name: "Save Configuration" }).click();
  await page.getByTitle("Edit Supplier Tester", { exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).check();
  await expect(dialog.getByLabel("Supplier *", { exact: true })).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "Save Changes", exact: true })).toBeDisabled();
});

test("empty supplier lists block external saving while internal members need no supplier", async ({ page }) => {
  await page.goto("/");
  // Remove supplier-backed demo records before testing an empty configuration.
  for (const [tool, memberName, purchases] of [
    ["KPI", "Nina Weber", ["KPI Analysis License"]],
    ["Data Factory", "Daniel Costa", ["Data Processing Workstation"]],
    ["Reprocessing", "Priya Sharma", ["HIL Test Bench Hardware", "Server Maintenance Service"]],
  ] as const) {
    await page.getByTitle(`${tool} Team View`, { exact: true }).click();
    await page.getByTitle(`Delete ${memberName}`, { exact: true }).click();
    await page.getByRole("button", { name: "Non-FTE", exact: true }).click();
    for (const name of purchases) await page.getByRole("button", { name: `Delete ${name}`, exact: true }).click();
  }
  let dialog = await suppliers(page);
  for (const name of ["Luxoft", "T&S", "Akoddis", "rProcess"])
    await dialog.getByRole("button", { name: `Remove supplier ${name}`, exact: true }).click();
  await dialog.getByRole("button", { name: "Save Configuration" }).click();
  await page.getByTitle("KPI Team View").click();
  dialog = await member(page);
  await expect(dialog.getByRole("button", { name: "Add Member", exact: true })).toBeEnabled();
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).check();
  await dialog.getByLabel("Monthly salary cost *", { exact: true }).fill("5000");
  await expect(dialog.getByRole("button", { name: "Add Member", exact: true })).toBeDisabled();
  await expect(dialog.getByText("Add a supplier in Defaults → Suppliers before saving an external member.", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Supplier *", { exact: true }).locator("option")).toHaveCount(1);
});

test("member names abbreviate alongside tags and restore when cards become wider", async ({ page }) => {
  await page.goto("/");
  await page.getByTitle("KPI Team View").click();
  const dialog = await member(page);
  await dialog.getByPlaceholder("e.g. John").fill("Alexandra");
  await dialog.getByPlaceholder("e.g. Smith").fill("Montgomery");
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).check();
  await dialog.getByLabel("Monthly salary cost *", { exact: true }).fill("5000");
  await dialog.getByLabel("Supplier *", { exact: true }).selectOption("supplier-luxoft");
  await dialog.getByRole("button", { name: "Add Member", exact: true }).click();
  const card = page.locator('.group[title="Alexandra Montgomery"]');
  const name = card.locator('[aria-label="Alexandra Montgomery"]');
  const displayed = () => name.evaluate(element => element.firstChild?.textContent);
  const tagsFollowText = async () => {
    await expect.poll(() => name.evaluate(element => {
      const range = document.createRange();
      range.selectNode(element.firstChild!);
      const location = element.nextElementSibling!;
      const gap = parseFloat(getComputedStyle(element.parentElement!).columnGap);
      return Math.abs(location.getBoundingClientRect().left - range.getBoundingClientRect().right - gap);
    })).toBeLessThan(0.8);
    await expect(card.getByTitle("Supplier: Luxoft", { exact: true })).toBeVisible();
  };
  await card.evaluate(element => { element.style.width = "600px"; });
  await expect.poll(displayed).toBe("Alexandra Montgomery");
  await tagsFollowText();
  // Pick a width between the two independently measured name lengths.
  await card.evaluate(element => {
    const label = element.querySelector('[aria-label="Alexandra Montgomery"]')!;
    const measurements = label.querySelectorAll('span[aria-hidden="true"]');
    const target = (measurements[0].getBoundingClientRect().width + measurements[1].getBoundingClientRect().width) / 2;
    const row = label.parentElement!;
    const siblings = Array.from(row.children).filter(child => child !== label).reduce((sum, child) => sum + child.getBoundingClientRect().width, 0);
    const gaps = (parseFloat(getComputedStyle(row).columnGap) || 0) * (row.children.length - 1);
    element.style.width = `${element.getBoundingClientRect().width - row.getBoundingClientRect().width + siblings + gaps + target}px`;
  });
  await expect.poll(displayed).toBe("A. Montgomery");
  await tagsFollowText();
  await expect(name).toHaveAttribute("title", "Alexandra Montgomery");
  await expect(card.getByTitle("Supplier: Luxoft", { exact: true })).toBeVisible();
  await card.evaluate(element => {
    const label = element.querySelector('[aria-label="Alexandra Montgomery"]')!;
    const row = label.parentElement!;
    const siblings = Array.from(row.children).filter(child => child !== label).reduce((sum, child) => sum + child.getBoundingClientRect().width, 0);
    const gaps = (parseFloat(getComputedStyle(row).columnGap) || 0) * (row.children.length - 1);
    element.style.width = `${element.getBoundingClientRect().width - row.getBoundingClientRect().width + siblings + gaps + 24}px`;
  });
  await expect.poll(displayed).toBe("AM");
  await tagsFollowText();
  await card.evaluate(element => { element.style.width = "600px"; });
  await expect.poll(displayed).toBe("Alexandra Montgomery");
  await tagsFollowText();
});


for (const theme of ["vibrant", "basic", "retro"] as const) test(`existing member name remeasures when supplier tags change (${theme})`, async ({ page }) => {
  await page.goto("/");
  if (theme !== "vibrant") await page.getByRole("button", { name: "Theme: Vibrant", exact: true }).click();
  if (theme === "retro") await page.getByRole("button", { name: "Theme: Basic", exact: true }).click();
  await page.getByTitle("KPI Team View", { exact: true }).click();
  const card = page.locator('.group[title="Marcus Vogel"]');
  const name = card.locator('[aria-label="Marcus Vogel"]');
  // Hold the row width steady while adding/removing a tag: the original
  // observer missed this because only the space for the name changed.
  await card.evaluate(element => { element.style.width = "298px"; });
  const displayed = () => name.evaluate(element => element.firstChild?.textContent);
  await expect.poll(displayed).toBe("Marcus Vogel");
  await page.getByTitle("Edit Marcus Vogel", { exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).check();
  await dialog.getByLabel("Monthly salary cost *", { exact: true }).fill("5000");
  await dialog.getByLabel("Supplier *", { exact: true }).selectOption("supplier-ts");
  await dialog.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(displayed).toBe("M. Vogel");
  await expect.poll(() => name.evaluate(element => {
    const range = document.createRange(); range.selectNode(element.firstChild!);
    return range.getBoundingClientRect().width <= element.getBoundingClientRect().width + 0.1;
  })).toBe(true);
  await expect(name).toHaveAttribute("title", "Marcus Vogel");
  await expect(card.getByTitle("Supplier: T&S", { exact: true })).toBeVisible();
  await page.getByTitle("Edit Marcus Vogel", { exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "External team member", exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect.poll(displayed).toBe("Marcus Vogel");
});
