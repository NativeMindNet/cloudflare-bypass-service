/**
 * Proxy Warmup Module
 *
 * Warms up a browser context through a specific proxy before accessing target.
 * This builds trust for the specific proxy IP with Cloudflare.
 */

const proxyCache = require('./proxyCache');
const { DEFAULT_WARMUP_SITES } = require('./warmupBrowser');

/**
 * Warmup a browser context through a specific proxy
 *
 * @param {Page} page - Puppeteer page (already in proxy context)
 * @param {Object} proxy - Proxy configuration {host, port, username?, password?}
 * @returns {Promise<boolean>} - Success status
 */
async function warmupProxyContext(page, proxy) {
  // Check if proxy warmup is disabled
  if (process.env.PROXY_WARMUP_ENABLED === 'false') {
    return true;
  }

  // No proxy = no warmup needed
  if (!proxy || !proxy.host || !proxy.port) {
    return true;
  }

  // Check if already warmed up
  if (proxyCache.isWarmedUp(proxy)) {
    console.log(`[ProxyWarmup] Proxy ${proxy.host}:${proxy.port} already warmed up`);
    return true;
  }

  // Parse warmup sites from environment or use defaults
  const sitesEnv = process.env.WARMUP_SITES || '';
  const sites = sitesEnv
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.startsWith('http') ? s : `https://${s}/`);

  const warmupSites = sites.length > 0 ? sites : DEFAULT_WARMUP_SITES;

  console.log(`[ProxyWarmup] Warming up proxy ${proxy.host}:${proxy.port} with ${warmupSites.length} sites...`);

  let successCount = 0;

  for (const site of warmupSites) {
    try {
      console.log(`[ProxyWarmup] Visiting ${site} via proxy...`);

      await page.goto(site, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Let cookies and storage settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      successCount++;
      console.log(`[ProxyWarmup] ✓ ${site}`);
    } catch (e) {
      console.warn(`[ProxyWarmup] ⚠ Failed: ${site} - ${e.message}`);
    }
  }

  const success = successCount > 0;
  proxyCache.setWarmedUp(proxy, success);

  console.log(`[ProxyWarmup] Complete. ${successCount}/${warmupSites.length} sites visited via proxy.`);

  return success;
}

/**
 * Wrapper to conditionally warmup before performing an action
 *
 * @param {Page} page - Puppeteer page
 * @param {Object} proxy - Proxy configuration
 * @param {Function} action - Action to perform after warmup
 * @returns {Promise<*>} - Result of action
 */
async function withProxyWarmup(page, proxy, action) {
  if (proxy) {
    await warmupProxyContext(page, proxy);
  }
  return action();
}

module.exports = { warmupProxyContext, withProxyWarmup };
