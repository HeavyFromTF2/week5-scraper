# week5-scraper

A small, polite scraper for [books.toscrape.com](https://books.toscrape.com/). It follows the
"next" pagination link across the first 3 catalogue pages (60 books), and writes clean,
validated JSON to disk.

## Setup

```bash
npm install
```

Requires Node.js 18+ (uses the built-in `fetch`).

## Run

```bash
npm start
```

Re-running the command is safe and free after the first run — HTML is cached to disk, and
output files are de-duplicated by book URL.

## What it does

- Starts at `https://books.toscrape.com/index.html` and follows `ul.pager li.next a` for up to
  3 pages total.
- Turns every relative link (book URLs, cover images, the "next" link) into an absolute URL.
- Sends a custom `User-Agent` (`week5-scraper/1.0 (+https://github.com/HeavyFromTF2/week5-scraper)`),
  a 5s request timeout, and a 500ms delay between real network fetches.
- Caches raw page HTML in `cache/`. On the next run, pages already on disk are read from there
  instead of hitting the site again.
- Cleans scraped prices (e.g. `"£51.77"`) into a numeric `price` field.
- Validates every book with [Zod](https://zod.dev). Valid items go to `output/books.json`,
  invalid ones go to `output/errors.json` with the reason(s) they failed.
- Both output files are keyed by book URL, so re-running never creates duplicate entries.
- If a page fetch throws (timeout, 404, etc.) or a single item is malformed, the error is
  logged and the scraper moves on instead of crashing.
- Every run appends timing/count details to `output/run-report.json`: cache hits, pages
  fetched from the network, per-page timings, valid/invalid counts, and any failures.

## Project layout

```
src/
  config.js    constants (URLs, timeout, delay, paths)
  fetcher.js   disk cache + fetch-with-timeout/delay
  parser.js    HTML -> raw book records + next-page link (cheerio)
  schema.js    Zod schema + price/rating cleaning
  storage.js   de-duplicated read/write of the output JSON files
  index.js     orchestrates the run and writes the report
cache/         raw HTML per page (gitignored, created on first run)
output/        books.json, errors.json, run-report.json (gitignored, created on first run)
test/
  server.mjs   a tiny local mock of books.toscrape.com's page structure
  run.sh       starts the mock server and runs the scraper against it
```

## Testing without hitting the real site

```bash
bash test/run.sh
```

This spins up a local mock server that mirrors the site's HTML structure (including a
simulated 404 and one intentionally malformed item), then runs the real scraper against it
with `SCRAPER_START_URL` pointed at `localhost`. Useful for verifying caching, error-handling,
and de-duplication without making requests to the live site.
