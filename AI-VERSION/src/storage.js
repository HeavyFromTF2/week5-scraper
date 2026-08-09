import fs from "node:fs/promises";
import { CONFIG } from "./config.js";

async function readJsonArray(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeJsonArray(filePath, items) {
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf-8");
}

export async function loadExisting() {
  const [books, errors] = await Promise.all([
    readJsonArray(CONFIG.BOOKS_FILE),
    readJsonArray(CONFIG.ERRORS_FILE),
  ]);
  return { books, errors };
}

/**
 * Merges newly-scraped valid books / errors into what's already on disk,
 * keyed by URL so re-running the scraper never creates duplicate entries.
 * Returns counts of how many *new* records were actually added.
 */
export async function persistResults({ existingBooks, existingErrors, newBooks, newErrors }) {
  const bookMap = new Map(existingBooks.map((b) => [b.url, b]));
  let addedBooks = 0;
  for (const book of newBooks) {
    if (!bookMap.has(book.url)) addedBooks += 1;
    bookMap.set(book.url, book); // last-seen wins, keeps data fresh on re-runs
  }

  const errorMap = new Map(existingErrors.map((e) => [e.url ?? `${e.sourcePage}:${e.title}`, e]));
  let addedErrors = 0;
  for (const err of newErrors) {
    const key = err.url ?? `${err.sourcePage}:${err.title}`;
    if (!errorMap.has(key)) addedErrors += 1;
    errorMap.set(key, err);
  }

  const books = [...bookMap.values()];
  const errors = [...errorMap.values()];

  await writeJsonArray(CONFIG.BOOKS_FILE, books);
  await writeJsonArray(CONFIG.ERRORS_FILE, errors);

  return { totalBooks: books.length, totalErrors: errors.length, addedBooks, addedErrors };
}

export async function writeReport(report) {
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  await fs.writeFile(CONFIG.REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
}
