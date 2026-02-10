/**
 * Browser History Warmup Module
 *
 * Visits trusted sites on browser startup to build a realistic browser profile.
 * This helps bypass Cloudflare detection by:
 * - Creating browsing history
 * - Generating cookies from major sites
 * - Populating localStorage/sessionStorage
 * - Establishing TLS session tickets with major CDNs
 * - Building trust score with Cloudflare via CDN reputation
 */

const DEFAULT_WARMUP_SITES = [
  'https://www.instagram.com/',
  'https://www.google.com/',
  'https://www.x.com/'
];

/**
 * Warmup browser by visiting trusted sites to build profile
 *
 * @param {Browser} browser - Puppeteer browser instance
 * @returns {Promise<boolean>} - Success status (true if at least one site succeeded)
 */
async function warmupBrowserHistory(browser) {
  // Parse warmup sites from environment or use defaults
  const sitesEnv = process.env.WARMUP_SITES || '';
  const sites = sitesEnv
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.startsWith('http') ? s : `https://${s}/`);

  const warmupSites = sites.length > 0 ? sites : DEFAULT_WARMUP_SITES;

  console.log(`[Warmup] Starting browser history warmup with ${warmupSites.length} sites...`);

  let successCount = 0;
  let page = null;

  try {
    page = await browser.newPage();

    for (const site of warmupSites) {
      try {
        console.log(`[Warmup] Visiting ${site}...`);

        await page.goto(site, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });

        // Let cookies and storage settle
        await new Promise(resolve => setTimeout(resolve, 1000));

        successCount++;
        console.log(`[Warmup] ✓ ${site}`);
      } catch (e) {
        console.warn(`[Warmup] ⚠ Failed to visit ${site}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(`[Warmup] Error creating warmup page: ${e.message}`);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }

  const success = successCount > 0;
  global.browserWarmedUp = success;

  console.log(`[Warmup] Complete. ${successCount}/${warmupSites.length} sites visited successfully.`);

  return success;
}

module.exports = { warmupBrowserHistory, DEFAULT_WARMUP_SITES };
