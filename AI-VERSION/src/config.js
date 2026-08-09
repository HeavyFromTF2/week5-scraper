import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

export const CONFIG = {
  // Overridable via env var so the test/ mock server can be used without touching this file.
  START_URL: process.env.SCRAPER_START_URL || "https://books.toscrape.com/index.html",
  MAX_PAGES: 3,

  // Be a good citizen: identify ourselves and give the site a way to reach us.
  USER_AGENT:
    "week5-scraper/1.0 (+https://github.com/HeavyFromTF2/week5-scraper)",

  TIMEOUT_MS: 5000,
  DELAY_MS: 500,

  CACHE_DIR: path.join(ROOT_DIR, "cache"),
  OUTPUT_DIR: path.join(ROOT_DIR, "output"),

  BOOKS_FILE: path.join(ROOT_DIR, "output", "books.json"),
  ERRORS_FILE: path.join(ROOT_DIR, "output", "errors.json"),
  REPORT_FILE: path.join(ROOT_DIR, "output", "run-report.json"),
};
