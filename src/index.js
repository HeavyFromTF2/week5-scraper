import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const CACHE_DIR = path.resolve('cache');
const START_URL = 'https://books.toscrape.com/catalogue/page-1.html';
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/HeavyFromTF2/week5-scraper)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(url, cacheFileName) {
  const filePath = path.join(CACHE_DIR, cacheFileName);

  // 1. Try cache
  try {
    const cachedData = await fs.readFile(filePath, 'utf-8');
    const size = Buffer.byteLength(cachedData, 'utf-8');
    console.log(`CACHE HIT (${size} bytes)`);
    return { html: cachedData, fromCache: true };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  // 2. Politeness delay before network call
  await sleep(500);

  // 3. Fetch from network
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(5000)
  });

  if (response.status !== 200) {
    throw new Error(`Failed to fetch ${url}: expected status 200, got ${response.status}`);
  }

  const html = await response.text();
  const size = Buffer.byteLength(html, 'utf-8');

  // 4. Save to cache
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(filePath, html, 'utf-8');
  console.log(`FETCH (${size} bytes)`);

  return { html, fromCache: false };
}

async function discoverCatalogue() {
  const bookUrls = new Set();
  let currentUrl = START_URL;
  let pageCount = 0;

  while (currentUrl && pageCount < 3) {
    pageCount++;
    const cacheFileName = `catalogue-page-${pageCount}.html`;

    const { html } = await fetchPage(currentUrl, cacheFileName);
    const $ = cheerio.load(html);

    // Extract book links
    $('.product_pod h3 a').each((_, el) => {
      const relativeHref = $(el).attr('href');
      const absoluteUrl = new URL(relativeHref, currentUrl).href;
      bookUrls.add(absoluteUrl);
    });

    // Get next page link
    const nextHref = $('.pager .next a').attr('href');
    currentUrl = nextHref ? new URL(nextHref, currentUrl).href : null;
  }

  console.log(
    `catalogue_pages=${pageCount}, discovered=${bookUrls.size}, unique_urls=${bookUrls.size}`
  );

  return Array.from(bookUrls);
}

discoverCatalogue().catch(console.error);