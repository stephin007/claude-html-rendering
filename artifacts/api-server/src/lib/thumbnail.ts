import { execSync } from "child_process";
import { existsSync } from "fs";
import { chromium } from "playwright-core";

/**
 * Resolves a Chromium executable path using a layered strategy:
 *  1. PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH env var (explicit operator override)
 *  2. System PATH via `which` (reliable when Chromium is installed normally)
 *  3. Nix store glob (handles hash changes between Replit environment updates)
 *
 * Returns null if no browser is found; thumbnail generation gracefully skips.
 */
function resolveChromiumPath(): string | null {
  // 1. Explicit env override — most reliable for ops/deployed environments
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  // 2. PATH-based resolution — reliable when browser is installed via system packages
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const found = execSync(`which ${name} 2>/dev/null`, { encoding: "utf8" }).trim();
      if (found && existsSync(found)) return found;
    } catch {
      // not in PATH — try next candidate
    }
  }

  // 3. Nix store glob — handles any Chromium package regardless of hash
  try {
    const found = execSync("ls /nix/store/*/bin/chromium 2>/dev/null | head -1", {
      encoding: "utf8",
    }).trim();
    if (found && existsSync(found)) return found;
  } catch {
    // Nix store unavailable or no chromium found
  }

  return null;
}

/**
 * Renders `htmlContent` in a headless Chromium browser and returns a base64
 * PNG data URL (data:image/png;base64,...).
 *
 * All HTTP, HTTPS, and file:// requests are blocked during rendering to prevent
 * SSRF and local file access from attacker-controlled HTML content.
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

    // Block all outbound HTTP/HTTPS and file:// requests to prevent SSRF
    // and local file disclosure from attacker-controlled HTML
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
