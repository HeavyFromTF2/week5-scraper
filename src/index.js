import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.resolve('cache');
const URL_PAGE_1 = 'https://books.toscrape.com/catalogue/page-1.html';
const FILE_PATH = path.join(CACHE_DIR, 'catalogue-page-1.html');
const USER_AGENT = 'FlyRankInternship-A9/1.0 (+https://github.com/HeavyFromTF2/week5-scraper)';

async function fetchPage1() {
  // 1. Ensure the cache directory exists
  await fs.mkdir(CACHE_DIR, { recursive: true });

  try {
    // 2. Try to read from local cache first
    const cachedData = await fs.readFile(FILE_PATH, 'utf-8');
    const size = Buffer.byteLength(cachedData, 'utf-8');
    console.log(`CACHE HIT (${size} bytes)`);
    return cachedData;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  // 3. Perform polite HTTP request with custom User-Agent and timeout
  const response = await fetch(URL_PAGE_1, {
    headers: {
      'User-Agent': USER_AGENT
    },
    signal: AbortSignal.timeout(5000)
  });

  // 4. Verify STRICT HTTP 200 OK status
  if (response.status !== 200) {
    throw new Error(`Failed to fetch page: expected status 200, got ${response.status}`);
  }

  const html = await response.text();
  const size = Buffer.byteLength(html, 'utf-8');

  // 5. Save HTML content to local cache
  await fs.writeFile(FILE_PATH, html, 'utf-8');
  console.log(`FETCH (${size} bytes)`);

  return html;
}

fetchPage1().catch(console.error);