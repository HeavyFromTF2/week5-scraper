import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { z } from 'zod';

// Base directory paths for cache and output storage
const CACHE_DIR = path.resolve('cache');
const OUTPUT_DIR = path.resolve('output');

// Custom User-Agent to comply with scraping best practices
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/HeavyFromTF2/week5-scraper)';

// Helper utility to pause execution for polite network requests
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ==========================================
// STAGE 5: Run Metrics
// ==========================================
const report = {
  start_time: new Date().toISOString(),
  end_time: null,
  duration_ms: 0,
  pages_fetched: 0,
  cache_hits: 0,
  valid_records: 0,
  invalid_records: 0,
  failed_pages: 0
};

// ==========================================
// STAGE 4: Schema Definition (Zod)
// ==========================================
const bookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url().startsWith('https://'),
  price_text: z.string(),
  price_gbp: z.number().positive(),
  availability_text: z.string(),
  rating_text: z.string().nullable(),
  description: z.string().optional().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string().datetime()
});

function parsePrice(text) {
  const match = text.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

// ==========================================
// STAGE 1: Fetch HTML with Cache & Politeness
// ==========================================
async function fetchPage(url, cacheFile) {
  const filePath = path.join(CACHE_DIR, cacheFile);

  try {
    const cached = await fs.readFile(filePath, 'utf-8');
    report.cache_hits++;
    console.log(`CACHE HIT (${Buffer.byteLength(cached)} bytes)`);
    return cached;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  await sleep(500);

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(5000)
  });

  if (res.status !== 200) throw new Error(`HTTP ${res.status} on ${url}`);

  const html = await res.text();

  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(filePath, html, 'utf-8');

  report.pages_fetched++;
  console.log(`FETCH (${Buffer.byteLength(html)} bytes)`);

  return html;
}

async function main() {
  const startTime = Date.now();
  const booksToExtract = [];
  let currentUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pageCount = 0;

  // ==========================================
  // STAGE 2: Catalogue Discovery
  // ==========================================
  while (currentUrl && pageCount < 3) {
    pageCount++;
    const html = await fetchPage(currentUrl, `catalogue-page-${pageCount}.html`);
    const $ = cheerio.load(html);

    $('.product_pod h3 a').each((_, el) => {
      const url = new URL($(el).attr('href'), currentUrl).href;
      booksToExtract.push({ url, source: currentUrl });
    });

    const next = $('.pager .next a').attr('href');
    currentUrl = next ? new URL(next, currentUrl).href : null;
  }

  const uniqueBooks = Array.from(new Map(booksToExtract.map((b) => [b.url, b])).values());
  console.log(`catalogue_pages=${pageCount}, discovered=${uniqueBooks.length}, unique_urls=${uniqueBooks.length}`);

  // Stage 5 test: Inject an invalid URL on the list (404 test)
  /* uniqueBooks.push({
    url: 'https://books.toscrape.com/catalogue/pagina-que-nao-existe/index.html',
    source: 'https://books.toscrape.com/catalogue/page-1.html'
  }); */

  // ==========================================
  // STAGE 3 & 5: Raw Detail Extraction (With fault isolation)
  // ==========================================
  const rawRecords = [];

  for (let i = 0; i < uniqueBooks.length; i++) {
    const { url, source } = uniqueBooks[i];
    try {
      const html = await fetchPage(url, `book-detail-${i + 1}.html`);
      const $ = cheerio.load(html);

      const main = $('.product_main');
      const priceText = main.find('.price_color').text().trim();
      const ratingMatch = main.find('.star-rating').attr('class')?.match(/star-rating\s+(\w+)/);
      const descText = $('#product_description').next('p').text().trim();

      rawRecords.push({
        title: main.find('h1').text().trim(),
        product_url: url,
        price_text: priceText,
        price_gbp: parsePrice(priceText),
        availability_text: main.find('.instock.availability').text().trim().replace(/\s+/g, ' '),
        rating_text: ratingMatch ? ratingMatch[1] : null,
        description: descText || null,
        source_page: source,
        fetched_at: new Date().toISOString()
      });
    } catch (err) {
      console.error(`[SKIPPED] ${url}: ${err.message}`);
      report.failed_pages++;
    }
  }

  console.log('\n--- Sample Raw Record ---');
  if (rawRecords.length > 0) console.log(JSON.stringify(rawRecords[0], null, 2));
  console.log(`\ndetail_pages=${rawRecords.length}`);

  // ==========================================
  // STAGE 4: Validate, Store & Idempotency
  // ==========================================
  const validRecords = [];
  const errorRecords = [];

  for (const recordCandidate of rawRecords) {
    const validation = bookSchema.safeParse(recordCandidate);

    if (validation.success) {
      validRecords.push(validation.data);
    } else {
      errorRecords.push({
        record: recordCandidate,
        reason: validation.error.format()
      });
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  await fs.writeFile(path.join(OUTPUT_DIR, 'books.json'), JSON.stringify(validRecords, null, 2), 'utf-8');
  await fs.writeFile(path.join(OUTPUT_DIR, 'errors.json'), JSON.stringify(errorRecords, null, 2), 'utf-8');

  console.log(`\nSaved ${validRecords.length} records to output/books.json`);
  console.log(`Saved ${errorRecords.length} errors to output/errors.json`);

  // ==========================================
  // STAGE 5: Report Output
  // ==========================================
  report.end_time = new Date().toISOString();
  report.duration_ms = Date.now() - startTime;
  report.valid_records = validRecords.length;
  report.invalid_records = errorRecords.length;

  await fs.writeFile(path.join(OUTPUT_DIR, 'run-report.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Saved run report to output/run-report.json`);
}

main().catch(console.error);