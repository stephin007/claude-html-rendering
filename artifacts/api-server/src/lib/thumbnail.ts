export async function generateThumbnail(htmlContent: string): Promise<string | null> {
  let browser: { close(): Promise<void> } | null = null;
  try {
    const { chromium } = await import("playwright");
    type LaunchOptions = Parameters<typeof chromium.launch>[0];
    const launchOptions: LaunchOptions = {
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    };
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
        void route.abort();
      } else {
        void route.continue();
      }
    });
    await page.setContent(htmlContent, { waitUntil: "load", timeout: 10000 });
    const screenshot = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1200, height: 800 } });
    return `data:image/png;base64,${Buffer.from(screenshot).toString("base64")}`;
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
