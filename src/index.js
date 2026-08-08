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
// STAGE 4: Schema Definition (Zod)
// ==========================================
// Defines the exact shape and types for validated records.
// - Keeps original raw values (price_text) alongside clean values (price_gbp).
// - Enforces canonical HTTPS product URLs.
// - Sets description as optional/nullable.
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

// Helper function to convert raw price strings like "£51.77" to a float number (51.77)
function parsePrice(text) {
  const match = text.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

// ==========================================
// STAGE 1: Fetch HTML with Cache & Politeness
// ==========================================
// Implements a cache-first strategy to prevent unnecessary network requests.
// Adds a 500ms delay and timeout signal for politeness when performing network calls.
async function fetchPage(url, cacheFile) {
  const filePath = path.join(CACHE_DIR, cacheFile);

  // 1. Check if HTML is already stored locally in the cache directory
  try {
    const cached = await fs.readFile(filePath, 'utf-8');
    console.log(`CACHE HIT (${Buffer.byteLength(cached)} bytes)`);
    return cached;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err; // Re-throw errors other than "File Not Found"
  }

  // 2. Delay 500ms before requesting over the network to respect the target server
  await sleep(500);

  // 3. Perform network fetch with User-Agent header and a 5-second timeout
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(5000)
  });

  if (res.status !== 200) throw new Error(`HTTP ${res.status} on ${url}`);

  const html = await res.text();

  // 4. Save fetched HTML into local cache for future runs
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(filePath, html, 'utf-8');
  console.log(`FETCH (${Buffer.byteLength(html)} bytes)`);

  return html;
}

async function main() {
  const booksToExtract = [];
  let currentUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pageCount = 0;

  // ==========================================
  // STAGE 2: Catalogue Discovery
  // ==========================================
  // Crawls up to 3 catalogue pages, extracts relative links, converts them
  // to absolute URLs using `new URL()`, and discovers all available books.
  while (currentUrl && pageCount < 3) {
    pageCount++;
    const html = await fetchPage(currentUrl, `catalogue-page-${pageCount}.html`);
    const $ = cheerio.load(html);

    // Extract product links from the listing grid
    $('.product_pod h3 a').each((_, el) => {
      const url = new URL($(el).attr('href'), currentUrl).href;
      booksToExtract.push({ url, source: currentUrl });
    });

    // Resolve next pagination button URL
    const next = $('.pager .next a').attr('href');
    currentUrl = next ? new URL(next, currentUrl).href : null;
  }

  // Deduplicate products using absolute URL as canonical key (ensures idempotency)
  const uniqueBooks = Array.from(new Map(booksToExtract.map((b) => [b.url, b])).values());
  
  // STAGE 2 CHECKPOINT
  console.log(`catalogue_pages=${pageCount}, discovered=${uniqueBooks.length}, unique_urls=${uniqueBooks.length}`);

  // ==========================================
  // STAGE 3: Extract Raw & Normalized Records
  // ==========================================
  const rawRecords = [];

  for (let i = 0; i < uniqueBooks.length; i++) {
    const { url, source } = uniqueBooks[i];
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
      price_gbp: parsePrice(priceText), // CRITICAL: Added normalized number for Stage 4
      availability_text: main.find('.instock.availability').text().trim().replace(/\s+/g, ' '),
      rating_text: ratingMatch ? ratingMatch[1] : null,
      description: descText || null, // Optional field
      source_page: source,
      fetched_at: new Date().toISOString()
    });
  }

  // STAGE 3 CHECKPOINT
  console.log('\n--- Sample Raw Record ---');
  console.log(JSON.stringify(rawRecords[0], null, 2));
  console.log(`\ndetail_pages=${rawRecords.length}`);

  // ==========================================
  // STAGE 4: Validate, Store & Idempotency
  // ==========================================
  const validRecords = [];
  const errorRecords = [];

  for (const recordCandidate of rawRecords) {
    // Validate each record against Zod schema
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

  // Save valid items to output/books.json and invalid items to output/errors.json
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'books.json'),
    JSON.stringify(validRecords, null, 2),
    'utf-8'
  );

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'errors.json'),
    JSON.stringify(errorRecords, null, 2),
    'utf-8'
  );

  // STAGE 4 CHECKPOINT
  console.log(`\nSaved ${validRecords.length} records to output/books.json`);
  console.log(`Saved ${errorRecords.length} errors to output/errors.json`);
}

main().catch(console.error);