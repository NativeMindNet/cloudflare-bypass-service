# Specifications: Cloudflare Bypass Service Core

> Version: 1.0
> Status: DRAFT
> Last Updated: 2026-02-10

## Overview

Enhance CF-Clearance-Scraper with browser history spoofing from legacy Python approach while maintaining full backward compatibility.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    cloudflare-bypass-service                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Express Server (:3000)                      │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                                                                 │ │
│  │  GET /health ──────────────────────► { status, browser }  [NEW] │ │
│  │  GET /test-report ─────────────────► { results, stats }   [NEW] │ │
│  │                                                                 │ │
│  │  POST /cf-clearance-scraper ───┬──► getSource()                │ │
│  │       (unchanged API)          ├──► wafSession()               │ │
│  │                                ├──► solveTurnstileMin()        │ │
│  │                                └──► solveTurnstileMax()        │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              Two-Level Warmup System (enhanced)           [NEW] │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                                                                 │ │
│  │  Level 1: Browser Warmup (on startup, no proxy)                │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │  createBrowser()                                          │ │ │
│  │  │      └── warmupBrowserHistory(browser, null)              │ │ │
│  │  │              ├── visit instagram.com                       │ │ │
│  │  │              ├── visit google.com                          │ │ │
│  │  │              └── visit x.com                               │ │ │
│  │  │                                                            │ │ │
│  │  │  Purpose: Build base browser profile trust                 │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  Level 2: Proxy Warmup (on first request through new proxy)   │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │  getSource/wafSession/etc.                                │ │ │
│  │  │      └── if (proxy && !proxyWarmedUp[proxyKey])           │ │ │
│  │  │              └── warmupProxyContext(context, proxy)        │ │ │
│  │  │                      ├── visit instagram.com via proxy     │ │ │
│  │  │                      ├── visit google.com via proxy        │ │ │
│  │  │                      └── visit x.com via proxy             │ │ │
│  │  │                                                            │ │ │
│  │  │  Purpose: Build trust for specific proxy IP                │ │ │
│  │  │  Cache: global.proxyWarmedUp = Map<proxyKey, timestamp>   │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Test Framework                         [NEW] │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                                                                 │ │
│  │  tests/                                                         │ │
│  │  ├── unit/           # Fast, no network                        │ │
│  │  ├── integration/    # With real browser, local                │ │
│  │  └── cloudflare/     # Live CF detection tests                 │ │
│  │      ├── test-no-warmup.js                                     │ │
│  │      ├── test-browser-warmup.js                                │ │
│  │      ├── test-proxy-warmup.js                                  │ │
│  │      └── test-cf-behavior.js  # Detect CF changes              │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Environment Variables:                                              │
│  ├── PORT (default: 3000)                                           │
│  ├── browserLimit (default: 20)                                     │
│  ├── timeOut (default: 60000)                                       │
│  ├── authToken (optional)                                           │
│  ├── WARMUP_ENABLED (default: "true")                         [NEW] │
│  ├── WARMUP_SITES (default: "instagram.com,google.com,x.com") [NEW] │
│  ├── PROXY_WARMUP_ENABLED (default: "true")                   [NEW] │
│  └── PROXY_WARMUP_TTL (default: "3600000" = 1 hour)           [NEW] │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
cloudflare-bypass-service/
├── src/
│   ├── index.js                    # Express server (enhanced)
│   ├── module/
│   │   ├── createBrowser.js        # Browser creation (enhanced)
│   │   ├── warmupBrowser.js        # [NEW] Browser-level warmup
│   │   ├── warmupProxy.js          # [NEW] Proxy-level warmup
│   │   ├── proxyCache.js           # [NEW] Warmed proxy tracking
│   │   └── reqValidate.js          # Request validation (unchanged)
│   ├── endpoints/
│   │   ├── getSource.js            # (enhanced with proxy warmup)
│   │   ├── wafSession.js           # (enhanced with proxy warmup)
│   │   ├── solveTurnstile.min.js   # (enhanced with proxy warmup)
│   │   ├── solveTurnstile.max.js   # (enhanced with proxy warmup)
│   │   ├── health.js               # [NEW] Health check endpoint
│   │   └── testReport.js           # [NEW] Test results endpoint
│   └── data/
│       └── fakePage.html           # (unchanged)
├── tests/
│   ├── unit/
│   │   ├── warmupBrowser.test.js   # [NEW]
│   │   ├── warmupProxy.test.js     # [NEW]
│   │   ├── proxyCache.test.js      # [NEW]
│   │   └── health.test.js          # [NEW]
│   ├── integration/
│   │   ├── endpoints.test.js       # Existing (enhanced)
│   │   ├── browser-warmup.test.js  # [NEW]
│   │   └── proxy-warmup.test.js    # [NEW]
│   └── cloudflare/
│       ├── README.md               # [NEW] Test documentation
│       ├── cf-targets.js           # [NEW] Known CF-protected sites
│       ├── no-warmup.test.js       # [NEW] Baseline without warmup
│       ├── browser-warmup.test.js  # [NEW] With browser warmup
│       ├── proxy-warmup.test.js    # [NEW] With proxy warmup
│       ├── behavior-monitor.js     # [NEW] Detect CF changes
│       └── report-generator.js     # [NEW] Generate comparison reports
├── package.json                    # Dependencies (add jest)
├── Dockerfile                      # Docker build
├── docker-compose.yml              # [NEW] For testing with proxies
└── README.md                       # Documentation (enhanced)
```

---

## New Module: warmupBrowser.js

### Purpose

Implement browser history spoofing to build trust with Cloudflare before visiting target sites.

### Specification

```javascript
// src/module/warmupBrowser.js

/**
 * Default warmup sites - chosen strategically:
 * - instagram.com: Uses Cloudflare CDN, Meta trust
 * - google.com: Establishes Google cookies
 * - x.com: Social media footprint
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
 * @returns {Promise<boolean>} - Success status
 *
 * Behavior:
 * - Creates temporary page (not context)
 * - Visits each warmup site sequentially
 * - Waits for domcontentloaded + 1 second delay
 * - Closes page when done
 * - Sets global.browserWarmedUp = true
 *
 * Error handling:
 * - Individual site failures don't stop warmup
 * - Logs warnings but continues
 * - Returns true if at least one site succeeded
 */
async function warmupBrowserHistory(browser) {
  const sites = (process.env.WARMUP_SITES || '')
    .split(',')
    .filter(s => s.trim())
    .map(s => s.trim().startsWith('http') ? s.trim() : `https://${s.trim()}/`);

  const warmupSites = sites.length > 0 ? sites : DEFAULT_WARMUP_SITES;

  console.log(`[Warmup] Starting browser history warmup with ${warmupSites.length} sites...`);

  let successCount = 0;
  const page = await browser.newPage();

  try {
    for (const site of warmupSites) {
      try {
        console.log(`[Warmup] Visiting ${site}...`);
        await page.goto(site, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        await new Promise(r => setTimeout(r, 1000)); // Let cookies settle
        successCount++;
        console.log(`[Warmup] ✓ ${site}`);
      } catch (e) {
        console.warn(`[Warmup] ⚠ Failed to visit ${site}: ${e.message}`);
      }
    }
  } finally {
    await page.close();
  }

  global.browserWarmedUp = successCount > 0;
  console.log(`[Warmup] Complete. ${successCount}/${warmupSites.length} sites visited.`);

  return global.browserWarmedUp;
}

module.exports = { warmupBrowserHistory, DEFAULT_WARMUP_SITES };
```

---

## New Module: proxyCache.js

### Purpose

Track which proxies have been warmed up to avoid redundant warmup.

### Specification

```javascript
// src/module/proxyCache.js

/**
 * Cache for tracking warmed-up proxies
 *
 * Key format: "host:port" or "host:port:user" (if auth)
 * Value: { timestamp, success, attempts }
 */

class ProxyCache {
  constructor() {
    this.cache = new Map();
    this.ttl = Number(process.env.PROXY_WARMUP_TTL) || 3600000; // 1 hour default
  }

  /**
   * Generate cache key from proxy config
   */
  getKey(proxy) {
    if (!proxy) return null;
    const base = `${proxy.host}:${proxy.port}`;
    return proxy.username ? `${base}:${proxy.username}` : base;
  }

  /**
   * Check if proxy is warmed up and not expired
   */
  isWarmedUp(proxy) {
    const key = this.getKey(proxy);
    if (!key) return true; // No proxy = no warmup needed

    const entry = this.cache.get(key);
    if (!entry) return false;

    const expired = Date.now() - entry.timestamp > this.ttl;
    if (expired) {
      this.cache.delete(key);
      return false;
    }

    return entry.success;
  }

  /**
   * Mark proxy as warmed up
   */
  setWarmedUp(proxy, success = true) {
    const key = this.getKey(proxy);
    if (!key) return;

    this.cache.set(key, {
      timestamp: Date.now(),
      success,
      attempts: (this.cache.get(key)?.attempts || 0) + 1
    });
  }

  /**
   * Get cache stats for monitoring
   */
  getStats() {
    const now = Date.now();
    let active = 0, expired = 0, failed = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) expired++;
      else if (entry.success) active++;
      else failed++;
    }

    return { total: this.cache.size, active, expired, failed };
  }

  /**
   * Clear expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
const proxyCache = new ProxyCache();

// Cleanup every 10 minutes
setInterval(() => proxyCache.cleanup(), 600000);

module.exports = proxyCache;
```

---

## New Module: warmupProxy.js

### Purpose

Warmup browser context through a specific proxy before accessing target.

### Specification

```javascript
// src/module/warmupProxy.js

const proxyCache = require('./proxyCache');
const { DEFAULT_WARMUP_SITES } = require('./warmupBrowser');

/**
 * Warmup a browser context through a specific proxy
 *
 * @param {Page} page - Puppeteer page (already in proxy context)
 * @param {Object} proxy - Proxy configuration
 * @returns {Promise<boolean>} - Success status
 *
 * Called: Before navigating to target URL, if proxy not yet warmed up
 *
 * Flow:
 * 1. Check if proxy already warmed (proxyCache)
 * 2. If not, visit warmup sites through this proxy
 * 3. Mark proxy as warmed in cache
 */
async function warmupProxyContext(page, proxy) {
  // Check if proxy warmup is disabled
  if (process.env.PROXY_WARMUP_ENABLED === 'false') {
    return true;
  }

  // Check cache
  if (proxyCache.isWarmedUp(proxy)) {
    console.log(`[ProxyWarmup] Proxy ${proxy.host}:${proxy.port} already warmed`);
    return true;
  }

  const sites = (process.env.WARMUP_SITES || '')
    .split(',')
    .filter(s => s.trim())
    .map(s => s.trim().startsWith('http') ? s.trim() : `https://${s.trim()}/`);

  const warmupSites = sites.length > 0 ? sites : DEFAULT_WARMUP_SITES;

  console.log(`[ProxyWarmup] Warming up proxy ${proxy.host}:${proxy.port}...`);

  let successCount = 0;

  for (const site of warmupSites) {
    try {
      console.log(`[ProxyWarmup] Visiting ${site} via proxy...`);
      await page.goto(site, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      await new Promise(r => setTimeout(r, 1000));
      successCount++;
      console.log(`[ProxyWarmup] ✓ ${site}`);
    } catch (e) {
      console.warn(`[ProxyWarmup] ⚠ Failed: ${site} - ${e.message}`);
    }
  }

  const success = successCount > 0;
  proxyCache.setWarmedUp(proxy, success);

  console.log(`[ProxyWarmup] Complete. ${successCount}/${warmupSites.length} sites.`);
  return success;
}

/**
 * Wrapper to conditionally warmup before action
 */
async function withProxyWarmup(page, proxy, action) {
  if (proxy) {
    await warmupProxyContext(page, proxy);
  }
  return action();
}

module.exports = { warmupProxyContext, withProxyWarmup };
```

---

## Modified Endpoint: getSource.js (example)

### Changes

Add proxy warmup before navigating to target.

```javascript
// src/endpoints/getSource.js - with proxy warmup

const { warmupProxyContext } = require('../module/warmupProxy');

function getSource({ url, proxy }) {
  return new Promise(async (resolve, reject) => {
    if (!url) return reject("Missing url parameter");

    const context = await global.browser
      .createBrowserContext({
        proxyServer: proxy ? `http://${proxy.host}:${proxy.port}` : undefined,
      })
      .catch(() => null);

    if (!context) return reject("Failed to create browser context");

    let isResolved = false;
    var cl = setTimeout(async () => {
      if (!isResolved) {
        await context.close();
        reject("Timeout Error");
      }
    }, global.timeOut || 60000);

    try {
      const page = await context.newPage();

      if (proxy?.username && proxy?.password)
        await page.authenticate({
          username: proxy.username,
          password: proxy.password,
        });

      // [NEW] Warmup proxy context before target navigation
      if (proxy) {
        await warmupProxyContext(page, proxy);
      }

      await page.setRequestInterception(true);
      page.on("request", async (request) => request.continue());
      page.on("response", async (res) => {
        try {
          if (
            [200, 302].includes(res.status()) &&
            [url, url + "/"].includes(res.url())
          ) {
            await page
              .waitForNavigation({ waitUntil: "load", timeout: 5000 })
              .catch(() => {});
            const html = await page.content();
            await context.close();
            isResolved = true;
            clearInterval(cl);
            resolve(html);
          }
        } catch (e) {}
      });

      await page.goto(url, {
        waitUntil: "domcontentloaded",
      });
    } catch (e) {
      if (!isResolved) {
        await context.close();
        clearInterval(cl);
        reject(e.message);
      }
    }
  });
}
module.exports = getSource;
```

---

## Modified Module: createBrowser.js

### Changes

Add warmup call after browser creation.

```javascript
// src/module/createBrowser.js

const { connect } = require("puppeteer-real-browser");
const { warmupBrowserHistory } = require("./warmupBrowser");

async function createBrowser() {
  try {
    if (global.finished == true) return;

    global.browser = null;
    global.browserWarmedUp = false;  // [NEW]

    console.log('[Browser] Launching...');

    const { browser } = await connect({
      headless: false,
      turnstile: true,
      connectOption: { defaultViewport: null },
      disableXvfb: false,
    });

    console.log('[Browser] Launched successfully');

    global.browser = browser;

    // [NEW] Warmup browser history after creation
    if (process.env.WARMUP_ENABLED !== 'false') {
      await warmupBrowserHistory(browser);
    } else {
      console.log('[Browser] Warmup disabled via WARMUP_ENABLED=false');
      global.browserWarmedUp = true;  // Mark as ready anyway
    }

    browser.on('disconnected', async () => {
      if (global.finished == true) return;
      console.log('[Browser] Disconnected, reconnecting...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      await createBrowser();  // Will re-warmup on reconnect
    });

  } catch (e) {
    console.error(`[Browser] Error: ${e.message}`);
    if (global.finished == true) return;
    await new Promise(resolve => setTimeout(resolve, 3000));
    await createBrowser();
  }
}

module.exports = createBrowser;
```

---

## New Endpoint: health.js

### Specification

```javascript
// src/endpoints/health.js

/**
 * Health check endpoint
 *
 * GET /health
 *
 * Response:
 * {
 *   "status": "ok" | "degraded" | "error",
 *   "browser": true | false,
 *   "warmedUp": true | false,
 *   "activeContexts": number,
 *   "maxContexts": number,
 *   "uptime": number (seconds)
 * }
 *
 * Status codes:
 * - 200: Everything healthy
 * - 503: Browser not ready
 */
function healthCheck(req, res) {
  const browserReady = global.browser !== null && global.browser !== undefined;
  const warmedUp = global.browserWarmedUp === true;

  const status = browserReady && warmedUp ? 'ok'
    : browserReady ? 'degraded'
    : 'error';

  const response = {
    status,
    browser: browserReady,
    warmedUp,
    activeContexts: global.browserLength || 0,
    maxContexts: global.browserLimit || 20,
    uptime: Math.floor(process.uptime())
  };

  res.status(browserReady ? 200 : 503).json(response);
}

module.exports = healthCheck;
```

---

## Modified: index.js

### Changes

Add health endpoint (additive, backward compatible).

```javascript
// src/index.js - changes only

const healthCheck = require('./endpoints/health');

// ... existing code ...

// [NEW] Health check endpoint
app.get('/health', healthCheck);

// Existing endpoint unchanged
app.post('/cf-clearance-scraper', async (req, res) => {
  // ... existing code unchanged ...
});
```

---

## API Reference

### Existing Endpoints (Unchanged)

#### POST /cf-clearance-scraper

**Request:**
```json
{
  "url": "https://example.com",
  "mode": "source" | "waf-session" | "turnstile-min" | "turnstile-max",
  "siteKey": "optional, required for turnstile-min",
  "proxy": {
    "host": "optional",
    "port": "optional",
    "username": "optional",
    "password": "optional"
  },
  "authToken": "optional, if server requires auth"
}
```

**Response (mode: source):**
```json
{
  "code": 200,
  "source": "<html>...</html>"
}
```

**Response (mode: waf-session):**
```json
{
  "code": 200,
  "cookies": [
    { "name": "cf_clearance", "value": "...", ... }
  ],
  "headers": {
    "user-agent": "...",
    "accept-language": "..."
  }
}
```

**Response (mode: turnstile-min/max):**
```json
{
  "code": 200,
  "token": "0.xxxxx..."
}
```

**Error Responses:**
```json
{ "code": 400, "message": "Bad Request", "schema": {...} }
{ "code": 401, "message": "Unauthorized" }
{ "code": 429, "message": "Too Many Requests" }
{ "code": 500, "message": "Error description" }
```

### New Endpoints

#### GET /health

**Response:**
```json
{
  "status": "ok",
  "browser": true,
  "warmedUp": true,
  "activeContexts": 3,
  "maxContexts": 20,
  "uptime": 3600,
  "proxyCache": {
    "total": 5,
    "active": 4,
    "expired": 1,
    "failed": 0
  }
}
```

#### GET /test-report

**Purpose:** Return latest Cloudflare test results for monitoring.

**Response:**
```json
{
  "lastRun": "2026-02-10T12:00:00Z",
  "strategies": {
    "noWarmup": {
      "successRate": 0.45,
      "avgDuration": 2300,
      "blocked": 0.55
    },
    "browserWarmup": {
      "successRate": 0.78,
      "avgDuration": 4100,
      "blocked": 0.22
    },
    "fullWarmup": {
      "successRate": 0.92,
      "avgDuration": 5800,
      "blocked": 0.08
    }
  },
  "recommendation": "fullWarmup",
  "cfBehaviorChange": false
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| browserLimit | 20 | Max concurrent browser contexts |
| timeOut | 60000 | Request timeout (ms) |
| authToken | null | Optional API authentication |
| **WARMUP_ENABLED** | true | Enable browser-level warmup on startup [NEW] |
| **WARMUP_SITES** | instagram.com,google.com,x.com | Comma-separated warmup sites [NEW] |
| **PROXY_WARMUP_ENABLED** | true | Enable per-proxy warmup [NEW] |
| **PROXY_WARMUP_TTL** | 3600000 | Proxy warmup cache TTL in ms (1 hour) [NEW] |

---

## Backward Compatibility Matrix

| Client Action | Before | After | Compatible? |
|---------------|--------|-------|-------------|
| POST /cf-clearance-scraper with mode=source | Works | Works (better with warmup) | YES |
| POST /cf-clearance-scraper with mode=waf-session | Works | Works (better with warmup) | YES |
| POST /cf-clearance-scraper with mode=turnstile-min | Works | Works | YES |
| POST /cf-clearance-scraper with mode=turnstile-max | Works | Works | YES |
| Request with proxy | Works | Works (with auto proxy warmup) | YES |
| Request without proxy | Works | Works | YES |
| GET /health | 404 | 200 with status | YES (additive) |
| GET /test-report | 404 | 200 with results | YES (additive) |
| Unknown endpoint | 404 | 404 | YES |
| Over rate limit | 429 | 429 | YES |

**Warmup is fully transparent to clients:**
- Old clients benefit automatically from warmup
- No required parameter changes
- Can disable via env vars if needed (`WARMUP_ENABLED=false`, `PROXY_WARMUP_ENABLED=false`)

---

## Testing Strategy

### Test Categories

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Test Pyramid                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│     /\           Cloudflare Live Tests (slow, real CF)              │
│    /  \          - Detect CF behavior changes                        │
│   /    \         - Compare warmup strategies                         │
│  /──────\        - Generate effectiveness reports                    │
│ /        \                                                           │
│/──────────\      Integration Tests (medium, real browser)           │
│            \     - Full request flow                                 │
│             \    - Browser + proxy warmup                            │
│──────────────\   - Backward compatibility                            │
│               \                                                      │
│────────────────\ Unit Tests (fast, mocked)                          │
│                 \- Module logic                                      │
│                  \- Cache behavior                                   │
│                   \- Config parsing                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Unit Tests

```javascript
// tests/unit/proxyCache.test.js
describe('ProxyCache', () => {
  test('generates correct key for proxy', () => {});
  test('returns true for no proxy', () => {});
  test('returns false for unknown proxy', () => {});
  test('returns true for warmed proxy', () => {});
  test('expires entries after TTL', () => {});
  test('cleanup removes expired entries', () => {});
  test('tracks failed warmup attempts', () => {});
  test('getStats returns correct counts', () => {});
});

// tests/unit/warmupBrowser.test.js
describe('warmupBrowser', () => {
  test('uses default sites when env empty', () => {});
  test('parses WARMUP_SITES env variable', () => {});
  test('adds https:// to bare domains', () => {});
  test('continues on individual site failure', () => {});
  test('returns true if at least one site succeeds', () => {});
  test('sets global.browserWarmedUp flag', () => {});
  test('skips when WARMUP_ENABLED=false', () => {});
});

// tests/unit/warmupProxy.test.js
describe('warmupProxy', () => {
  test('skips if proxy already in cache', () => {});
  test('visits warmup sites through proxy', () => {});
  test('updates cache after warmup', () => {});
  test('handles partial failures', () => {});
  test('skips when PROXY_WARMUP_ENABLED=false', () => {});
});

// tests/unit/health.test.js
describe('health endpoint', () => {
  test('returns ok when browser ready and warmed', () => {});
  test('returns degraded when browser ready but not warmed', () => {});
  test('returns error when browser not ready', () => {});
  test('includes correct stats', () => {});
});
```

### Integration Tests

```javascript
// tests/integration/browser-warmup.test.js
describe('Browser Warmup Integration', () => {
  beforeAll(async () => {
    // Start server, wait for browser
  });

  test('browser is warmed after startup', async () => {
    const health = await fetch('/health').then(r => r.json());
    expect(health.warmedUp).toBe(true);
  });

  test('source request succeeds after warmup', async () => {
    const result = await fetch('/cf-clearance-scraper', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com', mode: 'source' })
    }).then(r => r.json());
    expect(result.code).toBe(200);
  });
});

// tests/integration/proxy-warmup.test.js
describe('Proxy Warmup Integration', () => {
  const testProxy = { host: 'localhost', port: 8080 };

  test('first request through proxy triggers warmup', async () => {});
  test('second request through same proxy skips warmup', async () => {});
  test('different proxy triggers new warmup', async () => {});
  test('proxy warmup expires after TTL', async () => {});
});

// tests/integration/backward-compat.test.js
describe('Backward Compatibility', () => {
  // All existing tests from vendor/cf-clearance-scraper/tests/
  test('source mode returns HTML', async () => {});
  test('waf-session returns cookies and headers', async () => {});
  test('turnstile-min returns token with siteKey', async () => {});
  test('turnstile-max returns token', async () => {});
  test('returns 400 for invalid request', async () => {});
  test('returns 401 for bad auth token', async () => {});
  test('returns 429 when limit exceeded', async () => {});
});
```

### Cloudflare Live Tests

```javascript
// tests/cloudflare/cf-targets.js
/**
 * Known Cloudflare-protected sites for testing
 * Updated periodically based on monitoring
 */
module.exports = {
  // Primary test targets (stable, maintained for testing)
  primary: {
    waf: 'https://nopecha.com/demo/cloudflare',      // CF WAF Challenge
    turnstile: 'https://turnstile.zeroclover.io/',   // Turnstile CAPTCHA
  },

  // Sites known to have CF protection
  protected: [
    'https://nopecha.com/demo/cloudflare',
    'https://nowsecure.nl/',
  ],

  // Sites with Turnstile (siteKey required for turnstile-min mode)
  turnstile: [
    {
      url: 'https://turnstile.zeroclover.io/',
      siteKey: '0x4AAAAAAAEwzhD6pyKkgXC0'
    }
  ],

  // Control sites (no CF) - for baseline comparison
  control: [
    'https://httpbin.org/html',
    'https://example.com/',
  ]
};

// tests/cloudflare/no-warmup.test.js
/**
 * Baseline test: Request without any warmup
 * Purpose: Establish success rate without warmup
 */
const targets = require('./cf-targets');

describe('Cloudflare - No Warmup Baseline', () => {
  beforeAll(() => {
    process.env.WARMUP_ENABLED = 'false';
    process.env.PROXY_WARMUP_ENABLED = 'false';
  });

  test('WAF challenge without warmup', async () => {
    const url = targets.primary.waf; // https://nopecha.com/demo/cloudflare
    const start = Date.now();
    const result = await fetch('/cf-clearance-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, mode: 'source' })
    }).then(r => r.json());

    reporter.record({
      test: 'no-warmup',
      target: 'waf',
      url,
      success: result.code === 200,
      duration: Date.now() - start,
      blocked: result.source?.includes('Just a moment') || false
    });
  });

  test('Turnstile without warmup', async () => {
    const { url, siteKey } = targets.turnstile[0]; // https://turnstile.zeroclover.io/
    const start = Date.now();
    const result = await fetch('/cf-clearance-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, siteKey, mode: 'turnstile-min' })
    }).then(r => r.json());

    reporter.record({
      test: 'no-warmup',
      target: 'turnstile',
      url,
      success: result.code === 200 && result.token?.length > 10,
      duration: Date.now() - start
    });
  });
});

// tests/cloudflare/browser-warmup.test.js
/**
 * Test with browser-level warmup only
 */
const targets = require('./cf-targets');

describe('Cloudflare - Browser Warmup', () => {
  beforeAll(() => {
    process.env.WARMUP_ENABLED = 'true';
    process.env.PROXY_WARMUP_ENABLED = 'false';
  });

  test('WAF challenge with browser warmup', async () => {
    const url = targets.primary.waf; // https://nopecha.com/demo/cloudflare
    const start = Date.now();
    const result = await fetch('/cf-clearance-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, mode: 'source' })
    }).then(r => r.json());

    reporter.record({
      test: 'browser-warmup',
      target: 'waf',
      url,
      success: result.code === 200,
      duration: Date.now() - start,
      blocked: result.source?.includes('Just a moment') || false
    });

    expect(result.code).toBe(200);
  });

  test('Turnstile with browser warmup', async () => {
    const { url, siteKey } = targets.turnstile[0]; // https://turnstile.zeroclover.io/
    const start = Date.now();
    const result = await fetch('/cf-clearance-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, siteKey, mode: 'turnstile-min' })
    }).then(r => r.json());

    reporter.record({
      test: 'browser-warmup',
      target: 'turnstile',
      url,
      success: result.code === 200 && result.token?.length > 10,
      duration: Date.now() - start
    });

    expect(result.code).toBe(200);
    expect(result.token.length).toBeGreaterThan(10);
  });
});

// tests/cloudflare/proxy-warmup.test.js
/**
 * Test with both browser and proxy warmup
 */
const targets = require('./cf-targets');

describe('Cloudflare - Full Warmup (Browser + Proxy)', () => {
  const proxies = loadTestProxies(); // From TEST_PROXIES env or proxies.txt

  beforeAll(() => {
    process.env.WARMUP_ENABLED = 'true';
    process.env.PROXY_WARMUP_ENABLED = 'true';
  });

  test('WAF challenge with full warmup', async () => {
    const url = targets.primary.waf; // https://nopecha.com/demo/cloudflare
    const proxy = proxies[0]; // Use first test proxy

    const start = Date.now();
    const result = await fetch('/cf-clearance-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, mode: 'source', proxy })
    }).then(r => r.json());

    reporter.record({
      test: 'full-warmup',
      target: 'waf',
      url,
      proxy: `${proxy.host}:${proxy.port}`,
      success: result.code === 200,
      duration: Date.now() - start,
      blocked: result.source?.includes('Just a moment') || false
    });

    expect(result.code).toBe(200);
  });

  test('Turnstile with full warmup', async () => {
    const { url, siteKey } = targets.turnstile[0]; // https://turnstile.zeroclover.io/
    const proxy = proxies[0];

    const start = Date.now();
    const result = await fetch('/cf-clearance-scraper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, siteKey, mode: 'turnstile-min', proxy })
    }).then(r => r.json());

    reporter.record({
      test: 'full-warmup',
      target: 'turnstile',
      url,
      proxy: `${proxy.host}:${proxy.port}`,
      success: result.code === 200 && result.token?.length > 10,
      duration: Date.now() - start
    });

    expect(result.code).toBe(200);
    expect(result.token.length).toBeGreaterThan(10);
  });
});

// tests/cloudflare/behavior-monitor.js
/**
 * Monitor Cloudflare behavior changes over time
 *
 * Purpose:
 * - Detect when CF updates detection methods
 * - Track success rate trends
 * - Alert on significant changes
 *
 * Output:
 * - JSON report with historical comparison
 * - Console warnings if success rate drops
 */
class CloudflareBehaviorMonitor {
  constructor() {
    this.historyFile = './cf-behavior-history.json';
  }

  async runDailyCheck() {
    const today = new Date().toISOString().split('T')[0];

    const results = {
      date: today,
      noWarmup: await this.testWithConfig({ warmup: false, proxyWarmup: false }),
      browserWarmup: await this.testWithConfig({ warmup: true, proxyWarmup: false }),
      fullWarmup: await this.testWithConfig({ warmup: true, proxyWarmup: true }),
    };

    // Compare with previous
    const history = this.loadHistory();
    const previous = history[history.length - 1];

    if (previous) {
      const delta = {
        noWarmup: results.noWarmup.successRate - previous.noWarmup.successRate,
        browserWarmup: results.browserWarmup.successRate - previous.browserWarmup.successRate,
        fullWarmup: results.fullWarmup.successRate - previous.fullWarmup.successRate,
      };

      // Alert on significant drops (>10%)
      for (const [key, change] of Object.entries(delta)) {
        if (change < -0.1) {
          console.warn(`⚠️ ${key} success rate dropped by ${(-change * 100).toFixed(1)}%`);
          console.warn('   Cloudflare may have updated detection methods!');
        }
      }
    }

    // Save results
    history.push(results);
    this.saveHistory(history);

    return results;
  }

  async testWithConfig(config) {
    // Run tests with given config, return { successRate, avgTime, blocked }
  }

  generateReport() {
    // Generate HTML/Markdown report with charts
  }
}

// tests/cloudflare/report-generator.js
/**
 * Generate comparison reports for warmup strategies
 *
 * Output: Markdown report with tables
 *
 * | Strategy      | Success Rate | Avg Time | Blocked |
 * |--------------|--------------|----------|---------|
 * | No Warmup    | 45%          | 2.3s     | 55%     |
 * | Browser Only | 78%          | 4.1s     | 22%     |
 * | Full Warmup  | 92%          | 5.8s     | 8%      |
 */
function generateReport(testResults) {
  // Generate comparison table
  // Include recommendations
  // Save to tests/cloudflare/REPORT.md
}
```

### Test Commands

```bash
# Unit tests (fast, no network)
npm run test:unit

# Integration tests (needs browser)
npm run test:integration

# Cloudflare live tests (slow, real CF sites)
npm run test:cloudflare

# Full test suite
npm test

# Generate CF behavior report
npm run test:cloudflare:report

# Run CF monitoring (for CI/cron)
npm run monitor:cloudflare
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:unit

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:integration

  # Weekly CF behavior check
  cloudflare-monitor:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:cloudflare:report
      - uses: actions/upload-artifact@v3
        with:
          name: cf-report
          path: tests/cloudflare/REPORT.md
```

---

## Rollout Plan

### Phase 1: Core Warmup Modules
1. Add `src/module/warmupBrowser.js` - browser-level warmup
2. Add `src/module/proxyCache.js` - proxy warmup tracking
3. Add `src/module/warmupProxy.js` - proxy-level warmup
4. Modify `src/module/createBrowser.js` - call browser warmup on start

### Phase 2: Endpoint Integration
5. Modify `src/endpoints/getSource.js` - add proxy warmup call
6. Modify `src/endpoints/wafSession.js` - add proxy warmup call
7. Modify `src/endpoints/solveTurnstile.min.js` - add proxy warmup call
8. Modify `src/endpoints/solveTurnstile.max.js` - add proxy warmup call
9. Add `src/endpoints/health.js` - health check endpoint
10. Add `src/endpoints/testReport.js` - test results endpoint
11. Modify `src/index.js` - add new routes

### Phase 3: Test Framework
12. Add `tests/unit/*.test.js` - unit tests
13. Add `tests/integration/*.test.js` - integration tests
14. Add `tests/cloudflare/*.js` - CF live tests + monitoring
15. Update `package.json` - add jest, test scripts

### Phase 4: CI/CD & Documentation
16. Add `.github/workflows/test.yml` - CI pipeline
17. Add `docker-compose.yml` - local testing with proxies
18. Update `Dockerfile` if needed
19. Update `README.md` - document new features and env vars

---

## Approval

- [x] Reviewed by: User
- [x] Approved on: 2026-02-10
- [x] Notes: Added test URLs (nopecha.com/demo/cloudflare, turnstile.zeroclover.io)
