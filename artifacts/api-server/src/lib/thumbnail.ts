import puppeteer from "puppeteer-core";

const CHROMIUM_PATH =
  "/nix/store/22pqil8ywhgwx1vdnkhr19gmaziyfc99-ungoogled-chromium-98.0.4758.102/bin/chromium";

/**
 * Renders `htmlContent` in a headless Chromium browser and returns a base64
 * PNG data URL (data:image/png;base64,...).  Returns null on any failure so
 * prototype creation never breaks when thumbnail generation fails.
 */
export async function generateThumbnail(htmlContent: string): Promise<string | null> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.setContent(htmlContent, { waitUntil: "load", timeout: 10000 });

    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1200, height: 800 },
    });

    const base64 = Buffer.from(screenshot).toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch {
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
