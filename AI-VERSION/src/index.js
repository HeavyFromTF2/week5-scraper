import { CONFIG } from "./config.js";
import { fetchPage } from "./fetcher.js";
import { parseCataloguePage, toCandidate } from "./parser.js";
import { BookSchema } from "./schema.js";
import { loadExisting, persistResults, writeReport } from "./storage.js";

function makeStats() {
  return {
    startedAt: new Date().toISOString(),
    cacheHits: 0,
    pagesFetched: 0,
    pageTimingsMs: [],
    failures: [],
    logs: [],
    log(msg) {
      this.logs.push(msg);
      console.log(msg);
    },
  };
}

/** Guess the next page's URL if we lost the "next" link because a page broke. */
function guessNextPage(pageUrl, pageNumber) {
  try {
    return new URL(`page-${pageNumber + 1}.html`, pageUrl).toString();
  } catch {
    return null;
  }
}

async function run() {
  const stats = makeStats();
  const { books: existingBooks, errors: existingErrors } = await loadExisting();

  const newBooks = [];
  const newErrors = [];

  let currentUrl = CONFIG.START_URL;
  let pageNumber = 1;
  let pagesAttempted = 0;

  while (currentUrl && pageNumber <= CONFIG.MAX_PAGES) {
    pagesAttempted += 1;
    let html;

    try {
      html = await fetchPage(currentUrl, stats);
    } catch (err) {
      // Page broke / timed out / 404'd: log it, don't crash, try to keep going.
      stats.failures.push({
        type: "page",
        url: currentUrl,
        message: err.message,
        at: new Date().toISOString(),
      });
      stats.log(`[error] page failed: ${currentUrl} -> ${err.message}`);

      currentUrl = guessNextPage(currentUrl, pageNumber);
      pageNumber += 1;
      continue;
    }

    let rawBooks = [];
    let nextUrl = null;

    try {
      ({ rawBooks, nextUrl } = parseCataloguePage(html, currentUrl));
    } catch (err) {
      stats.failures.push({
        type: "parse",
        url: currentUrl,
        message: err.message,
        at: new Date().toISOString(),
      });
      stats.log(`[error] parse failed: ${currentUrl} -> ${err.message}`);
    }

    for (const raw of rawBooks) {
      try {
        const candidate = toCandidate(raw);
        const result = BookSchema.safeParse(candidate);

        if (result.success) {
          newBooks.push(result.data);
        } else {
          newErrors.push({
            url: raw.url ?? null,
            title: raw.title ?? null,
            sourcePage: currentUrl,
            issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
          });
        }
      } catch (err) {
        // A single malformed item should never take down the whole run.
        newErrors.push({
          url: raw?.url ?? null,
          title: raw?.title ?? null,
          sourcePage: currentUrl,
          issues: [`unexpected error: ${err.message}`],
        });
        stats.log(`[error] item failed on ${currentUrl}: ${err.message}`);
      }
    }

    // Follow the real "next" link when present; if parsing broke but we still
    // have pages left to reach, fall back to the predictable page-N.html pattern.
    currentUrl = nextUrl ?? (pageNumber < CONFIG.MAX_PAGES ? guessNextPage(currentUrl, pageNumber) : null);
    pageNumber += 1;
  }

  const { totalBooks, totalErrors, addedBooks, addedErrors } = await persistResults({
    existingBooks,
    existingErrors,
    newBooks,
    newErrors,
  });

  const finishedAt = new Date().toISOString();
  const report = {
    startedAt: stats.startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(stats.startedAt),
    config: {
      startUrl: CONFIG.START_URL,
      maxPages: CONFIG.MAX_PAGES,
      timeoutMs: CONFIG.TIMEOUT_MS,
      delayMs: CONFIG.DELAY_MS,
      userAgent: CONFIG.USER_AGENT,
    },
    pagesAttempted,
    pagesFetchedFromNetwork: stats.pagesFetched,
    cacheHits: stats.cacheHits,
    pageTimingsMs: stats.pageTimingsMs,
    itemsThisRun: {
      valid: newBooks.length,
      invalid: newErrors.length,
    },
    totalsOnDisk: {
      books: totalBooks,
      errors: totalErrors,
    },
    newRecordsWritten: {
      books: addedBooks,
      errors: addedErrors,
    },
    failures: stats.failures,
  };

  await writeReport(report);

  console.log("\nDone.");
  console.log(`  Valid this run:   ${newBooks.length}`);
  console.log(`  Invalid this run: ${newErrors.length}`);
  console.log(`  Cache hits:       ${stats.cacheHits}`);
  console.log(`  Pages fetched:    ${stats.pagesFetched}`);
  console.log(`  Failures:         ${stats.failures.length}`);
  console.log(`  Report: ${CONFIG.REPORT_FILE}`);
}

run().catch((err) => {
  console.error("Fatal error (this should not happen - please file a bug):", err);
  process.exitCode = 1;
});
