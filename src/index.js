import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const CACHE_DIR = path.resolve('cache');
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/HeavyFromTF2/week5-scraper)';
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Stage 1: Fetch HTML with cache-first strategy and politeness rules
async function fetchPage(url, cacheFile) {
  const filePath = path.join(CACHE_DIR, cacheFile);

  // Read from local cache if available
  try {
    const cached = await fs.readFile(filePath, 'utf-8');
    console.log(`CACHE HIT (${Buffer.byteLength(cached)} bytes)`);
    return cached;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Delay for network polite fetching
  await sleep(500);

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(5000)
  });

  if (res.status !== 200) throw new Error(`HTTP ${res.status} on ${url}`);

  const html = await res.text();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(filePath, html, 'utf-8');
  console.log(`FETCH (${Buffer.byteLength(html)} bytes)`);
  return html;
}

async function main() {
  const booksToExtract = [];
  let currentUrl = 'https://books.toscrape.com/catalogue/page-1.html';
  let pageCount = 0;

  // Stage 2: Discover first 3 catalogue pages and extract book URLs
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

  // Remove duplicates
  const uniqueBooks = Array.from(new Map(booksToExtract.map((b) => [b.url, b])).values());
  console.log(`catalogue_pages=${pageCount}, discovered=${uniqueBooks.length}, unique_urls=${uniqueBooks.length}`);

  // Stage 3: Extract raw details from each book page
  const rawRecords = [];
  for (let i = 0; i < uniqueBooks.length; i++) {
    const { url, source } = uniqueBooks[i];
    const html = await fetchPage(url, `book-detail-${i + 1}.html`);
    const $ = cheerio.load(html);

    const main = $('.product_main');
    const ratingMatch = main.find('.star-rating').attr('class')?.match(/star-rating\s+(\w+)/);

    rawRecords.push({
      title: main.find('h1').text().trim(),
      product_url: url,
      price_text: main.find('.price_color').text().trim(),
      availability_text: main.find('.instock.availability').text().trim().replace(/\s+/g, ' '),
      rating_text: ratingMatch ? ratingMatch[1] : null,
      description: $('#product_description').next('p').text().trim() || null,
      source_page: source,
      fetched_at: new Date().toISOString()
    });
  }

  // Stage 3 Checkpoint
  console.log('\n--- Sample Raw Record ---');
  console.log(JSON.stringify(rawRecords[0], null, 2));
  console.log(`\ndetail_pages=${rawRecords.length}`);
}

main().catch(console.error);