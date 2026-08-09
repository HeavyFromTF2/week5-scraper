import fs from "node:fs/promises";
import path from "node:path";
import { CONFIG } from "./config.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Turn a page URL into a safe, deterministic cache filename. */
function cacheFilenameFor(url) {
  const { pathname } = new URL(url);
  const safe = pathname.replace(/^\/+|\/+$/g, "").replace(/[/\\]/g, "_") || "index";
  return `${safe.endsWith(".html") ? safe : `${safe}.html`}`;
}

/**
 * Fetches a page's HTML, reading from the on-disk cache when available.
 * Only real network requests count towards the polite delay + fetched-page stat.
 */
export async function fetchPage(url, stats) {
  await fs.mkdir(CONFIG.CACHE_DIR, { recursive: true });
  const cachePath = path.join(CONFIG.CACHE_DIR, cacheFilenameFor(url));

  try {
    const cached = await fs.readFile(cachePath, "utf-8");
    stats.cacheHits += 1;
    stats.log(`[cache] ${url}`);
    return cached;
  } catch {
    // not cached yet, fall through to a real fetch
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": CONFIG.USER_AGENT },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }

    const html = await res.text();
    await fs.writeFile(cachePath, html, "utf-8");

    stats.pagesFetched += 1;
    stats.pageTimingsMs.push({ url, ms: Date.now() - start });
    stats.log(`[fetch] ${url} (${Date.now() - start}ms)`);

    return html;
  } finally {
    clearTimeout(timeout);
    // Polite delay between real network fetches only (not cache hits).
    await sleep(CONFIG.DELAY_MS);
  }
}
