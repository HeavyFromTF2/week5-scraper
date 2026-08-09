# Books to Scrape — Static HTML Web Scraper

A robust, polite, and fully reproducible Node.js scraper designed to extract book details from [Books to Scrape](https://books.toscrape.com/).

---

## Stage 0: Target Classification
* **Site Type:** Static HTML catalogue
* **Lane Selected:** Fast static HTTP requests (via `fetch`) with server-side DOM parsing (via `cheerio`).

---

## Quick Start (One-Command Run)

Make sure you have [Node.js](https://nodejs.org/) (v18+) installed.

```bash
git clone https://github.com/HeavyFromTF2/week5-scraper.git
cd week5-scraper/scraper
npm install
node src/index.js
```

## Installation & Setup

1. Clone the repository:
```bash
git clone https://github.com/HeavyFromTF2/week5-scraper.git
```

2. Navigate to the scraper folder:
```bash
cd week5-scraper/scraper
```

3. Install dependencies:
```bash
npm install
```

4. Execute the scraper:
```bash
node src/index.js
```

## Record Schema (`zod` Definition)

Extracted items are validated against the following Schema using Zod before being written to `output/books.json`:

* `title` (string): Non-empty book title.
* `product_url` (string): Valid HTTPS URL pointing to the book's detail page.
* `price_text` (string): Raw formatted price string (e.g., `"£51.77"`).
* `price_gbp` (number): Parsed floating-point price in GBP (e.g., `51.77`).
* `availability_text` (string): Stock status message with normalized spacing.
* `rating_text` (string | null): Star rating text extracted from CSS classes (e.g., `"Three"`).
* `description` (string | null): Full text description of the book.
* `source_page` (string): URL of the catalogue page where the book link was discovered.
* `fetched_at` (string): ISO 8601 timestamp of when the data was scraped.

## Politeness & Ethics Rules

To respect server infrastructure and maintain ethical scraping practices, this project implements the following safeguards:

* **Custom User-Agent:** Identifies the project clearly (`FlyRankInternship-A9/1.0 (+https://github.com/HeavyFromTF2/week5-scraper)`).
* **Rate Limiting Delay:** Introduces a `500ms` pause (`sleep`) between network fetches.
* **Network Timeout:** Enforces a `5000ms` hard timeout per HTTP request (`AbortSignal.timeout`) to prevent hanging processes.
* **Disk Caching:** Caches HTML pages locally in `cache/` to ensure idempotency and eliminate redundant network traffic during re-runs.

### Ethics Note

Always prefer using an official API whenever available. Respect site architecture by never bypassing authentication logins, paywalls, IP blocks, or CAPTCHAs. Scrape only publicly available data that is necessary for your scope, and store it responsibly.

### Browser-less Scraping Note

This assignment required no headless browser (e.g., Puppeteer, Playwright) because all target book data is pre-rendered static HTML served directly in the initial HTTP response, making a real browser an unnecessary resource and cost overhead.

### Known Limitation

The current implementation uses a hardcoded discovery limit of 3 catalogue pages (`pageCount < 3`) for demonstration and testing purposes rather than dynamically crawling every page until exhaustion.

## Sample Execution Report (`run-report.json`)

Below is a real execution metric report generated at `output/run-report.json`:

```json
{
  "start_time": "2026-08-09T00:01:15.873Z",
  "end_time": "2026-08-09T00:01:19.210Z",
  "duration_ms": 3337,
  "pages_fetched": 0,
  "cache_hits": 63,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```

## Bonus: AI vs Me

What did the AI do better — and do you understand that code?

* URL Handling: The AI did a great job combining relative links into valid absolute URLs using the built-in `URL` feature so no links broke.
* Error Recovery: If a catalogue page fails to load (like a 404 error), it doesn't crash. Instead, it tries to guess the next page's web address and keeps going.
* Code Structure: It split the code into clean, separate files (`config.js`, `fetcher.js`, `parser.js`, etc.), which makes it super easy to read and understand.

What did it get wrong or silently skip?

* Skipped Product Pages: The AI scraped all 60 books directly from the main listing pages. It never actually clicked into the individual book pages.
* Missing Fields (`description` & `fetched_at`): Because it didn't open the book pages, it completely skipped the book description. It also forgot the timestamp and added extra fields I didn't ask for.

What did your prompt forget to say?

* Explicit Navigation: I asked for 60 books, but I forgot to explicitly tell it: "Click into each book's link to open its page." The AI took the easy route and scraped everything off the main list.
* Exact Field Names: I didn't give it a strict list of field names, so the AI just made up its own fields.

What to improve in the prompt
To fix this in the rematch prompt, I need to add two simple rules:

1. Force Detail Visits: Explicitly write: "You MUST open each book's individual page to get the description."
2. List Every Field: Explicitly list all 8 field names (`title`, `product_url`, `price_text`, `availability_text`, `rating_text`, `description`, `source_page`, `fetched_at`) so it doesn't guess.

> "I will not reuse this code on another site without checking its rules and terms first. And I always respected the rule of identifying the project" 
