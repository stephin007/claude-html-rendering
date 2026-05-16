import { existsSync } from "fs";
import { chromium } from "playwright-core";

/**
 * Resolves a Chromium executable path by checking known candidate locations.
 * Returns null if none are found.
 */
function resolveChromiumPath(): string | null {
  const candidates = [
    // Known Replit Nix store path (primary)
    "/nix/store/22pqil8ywhgwx1vdnkhr19gmaziyfc99-ungoogled-chromium-98.0.4758.102/bin/chromium",
    // Common Linux system paths (fallback)
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Renders `htmlContent` in a headless Chromium browser and returns a base64
 * PNG data URL (data:image/png;base64,...).
 *
 * All external HTTP/HTTPS and file:// requests are blocked during rendering to
 * prevent SSRF and local file access from attacker-controlled HTML content.
 *
 * Returns null on any failure so prototype creation never breaks.
 */
export async function generateThumbnail(htmlContent: string): Promise<string | null> {
  const executablePath = resolveChromiumPath();
  if (!executablePath) return null;

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-default-apps",
      ],
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });

    // Block all external and file:// requests to prevent SSRF and local file access
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("file://")
      ) {
        void route.abort();
      } else {
        void route.continue();
      }
    });

    await page.setContent(htmlContent, { waitUntil: "load", timeout: 10000 });

    const screenshotBuffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1200, height: 800 },
    });

    const base64 = Buffer.from(screenshotBuffer).toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch {
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
