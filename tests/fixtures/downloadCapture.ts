import { test as base, type Page, type Download } from "@playwright/test";

// Retain actual application Blob contents through revocation. Download events and
// suggested filenames are still checked by callers; OS download streams can be
// cancelled by the laptop sandbox independently of the generated file content.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const blobs = new Map<string, Blob>();
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (value: Blob | MediaSource) => {
        const url = create(value);
        if (value instanceof Blob) blobs.set(url, value);
        return url;
      };
      Object.defineProperty(window, "__exportBlobs", { value: blobs });
    });
    await use(page);
  },
});
export async function readDownloadedBytes(page: Page, download: Download) {
  const bytes = await page.evaluate(async url => {
    const blob = Reflect.get(window, "__exportBlobs").get(url) as Blob | undefined;
    if (!blob) throw new Error(`No application export Blob captured for ${url}`);
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, download.url());
  return Buffer.from(bytes);
}
