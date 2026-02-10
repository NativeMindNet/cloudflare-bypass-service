# Requirements: Cloudflare Bypass Service Core

> Version: 1.1
> Status: DRAFT
> Last Updated: 2026-02-10

## Problem Statement

Taxlien scrapers need to bypass Cloudflare protection (WAF + Turnstile CAPTCHA) to access county property data. Two existing implementations exist with different approaches. The goal is to consolidate into a single service based on CF-Clearance-Scraper, enhanced with anti-detection techniques from the legacy Python approach.

**Repository:** https://github.com/NativeMindNet/cloudflare-bypass-service

---

## Detailed Analysis of Legacy Approach (Python/SeleniumBase)

**Location:** `taxlien-parser/legacy/legacy-celery/`

### Complete Anti-Detection Mechanism Stack

The legacy approach implements a **5-layer anti-detection system**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Virtual Display (Linux)                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Display(visible=False, size=(1920, 1080))                  ││
│  │  os.environ['DISPLAY'] = ':99'                              ││
│  │                                                              ││
│  │  Purpose: Xvfb creates virtual X11 display allowing full    ││
│  │  GUI interaction in headless environment. Required for      ││
│  │  uc_gui_click_captcha() to work.                            ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Undetected Chrome Mode                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  SB(uc=True, headless=False, block_images=False)            ││
│  │                                                              ││
│  │  SeleniumBase parameters:                                    ││
│  │  - uc=True: Enables undetected-chromedriver patches         ││
│  │    • Removes navigator.webdriver flag                        ││
│  │    • Patches CDP commands to avoid detection                 ││
│  │    • Randomizes browser fingerprint                          ││
│  │  - headless=False: Must be false for GUI click simulation   ││
│  │  - block_images=False: Load images (more human-like)        ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Browser History Spoofing ★ CRITICAL ★                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  def make_sites_visited_history(sb: SB):                    ││
│  │      sb.uc_open_with_reconnect("https://instagram.com/", 2) ││
│  │      sb.uc_open_with_reconnect("https://google.com/", 2)    ││
│  │      sb.uc_open_with_reconnect("https://www.x.com/", 2)     ││
│  │      sb.sleep(2)                                            ││
│  │                                                              ││
│  │  WHY THIS WORKS:                                             ││
│  │  1. Creates browsing history in browser profile              ││
│  │  2. Generates cookies from major sites (session cookies)     ││
│  │  3. Populates localStorage/sessionStorage                    ││
│  │  4. Establishes TLS session tickets with major CDNs          ││
│  │  5. Creates HTTP/2 connection cache entries                  ││
│  │  6. Builds trust score with Cloudflare via CDN reputation    ││
│  │                                                              ││
│  │  TECHNICAL DETAILS:                                          ││
│  │  - uc_open_with_reconnect(url, retries=2):                   ││
│  │    • Opens URL with automatic reconnection on failure        ││
│  │    • Retries up to 2 times if page fails to load             ││
│  │    • Each site visited adds to browser fingerprint           ││
│  │  - Sites chosen strategically:                               ││
│  │    • instagram.com - Meta CDN (Cloudflare trusts)            ││
│  │    • google.com - Establishes Google cookies                 ││
│  │    • x.com - Twitter/X adds social media footprint           ││
│  │  - Final sleep(2) allows cookies to settle                   ││
│  │                                                              ││
│  │  CLOUDFLARE DETECTION VECTORS BYPASSED:                      ││
│  │  - Empty browser profile detection                           ││
│  │  - No cookies = bot indicator                                ││
│  │  - First-ever-visit to domain = suspicious                   ││
│  │  - Missing referrer chain                                    ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: Challenge Polling Loop                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  def scraper_pass_challenge(sb: SB):                        ││
│  │      for _ in range(10):  # Max 10 attempts                 ││
│  │          title = str(sb.get_page_title()).lower()           ││
│  │          if "just a moment" in title or "cloudflare" in title:│
│  │              print(f"Passing Cloudflare challenge...")      ││
│  │              sb.uc_gui_click_captcha()  # ★ KEY FUNCTION ★  ││
│  │              sb.sleep(2)                                    ││
│  │          else:                                               ││
│  │              break  # Challenge passed!                      ││
│  │                                                              ││
│  │  uc_gui_click_captcha() MECHANISM:                           ││
│  │  1. Detects Turnstile/hCaptcha/reCAPTCHA iframe on page     ││
│  │  2. Locates checkbox or interactive element                  ││
│  │  3. Simulates human mouse movement (curved path)             ││
│  │  4. Adds random micro-delays between movements               ││
│  │  5. Performs actual GUI click via OS-level event             ││
│  │  6. Waits for challenge response                             ││
│  │                                                              ││
│  │  DETECTION SIGNALS:                                          ││
│  │  - Page title "Just a moment..." = CF challenge active       ││
│  │  - Page title "Attention Required" = CF block page           ││
│  │  - Any title with "cloudflare" = still on CF page            ││
│  │                                                              ││
│  │  LOOP BEHAVIOR:                                              ││
│  │  - Retry up to 10 times (configurable)                       ││
│  │  - 2 second delay between attempts                           ││
│  │  - Exits immediately when real page title detected           ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Layer 5: Modal/Popup Handling                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  def scraper_pass_modal(sb: SB):                            ││
│  │      try:                                                    ││
│  │          sb.click(                                           ││
│  │              selector="[class*='btn btn-primary button-1']", ││
│  │              by="css selector",                              ││
│  │              timeout=3                                       ││
│  │          )                                                   ││
│  │      except:                                                 ││
│  │          pass  # No modal present, continue                  ││
│  │                                                              ││
│  │  PURPOSE:                                                    ││
│  │  - Many county sites have disclaimer/terms modals            ││
│  │  - Cookie consent banners                                    ││
│  │  - "I agree" buttons on first visit                          ││
│  │  - Selector targets common button patterns                   ││
│  │  - 3 second timeout prevents blocking                        ││
│  │  - Silent exception handling (modal might not exist)         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Complete Request Flow (Legacy)

```python
# Full execution sequence in legacy system:

def scrape_single_url(url, headless=False, block_images=False):

    # STEP 1: Create virtual display (Linux only)
    with Display(visible=False, size=(1920, 1080)) as disp:
        print(f'Display is alive: {disp.is_alive()}')  # Verify Xvfb running

        # STEP 2: Launch undetected Chrome
        with SB(uc=True, headless=False, block_images=False) as sb:

            # STEP 3: Build browser history (BEFORE visiting target)
            # This is called in qpublic_scrape_counties_urls_task
            # make_sites_visited_history(sb)  # ← Critical for trust

            # STEP 4: Open target URL with retry logic
            sb.uc_open_with_reconnect(url, 2)  # 2 retries

            # STEP 5: Handle Cloudflare challenge
            scraper_pass_challenge(sb)  # Polling loop with captcha click

            # STEP 6: Handle site-specific modals
            scraper_pass_modal(sb)  # Close cookie banners etc.

            # STEP 7: Extract page source
            html = r"{}".format(sb.get_page_source())
            return html
```

### Platform-Specific Usage (qpublic example)

```python
@app.task
def qpublic_scrape_counties_urls_task(url: str) -> dict:
    counties_urls = {}

    with Display(visible=False, size=(1920, 1080)) as disp:
        print(f'Display is alive: {disp.is_alive()}')

        with SB(uc=True, headless=False) as sb:
            # ★ BROWSER HISTORY SPOOFING - Called first! ★
            make_sites_visited_history(sb)

            # Now visit actual target
            sb.uc_open_with_reconnect(url, 2)
            scraper_pass_challenge(sb)
            scraper_pass_modal(sb)

            # ... scraping logic ...
```

### Additional Anti-Detection in scraper_online.py

The newer `scraper_online.py` adds more techniques:

```python
# 1. curl_cffi with Chrome impersonation
from curl_cffi import requests
response = requests.get(url, impersonate="chrome110", timeout=30)

# 2. Bot detection checking
def check_for_bot_detection(html: str) -> bool:
    indicators = [
        "attention required! | cloudflare",
        "sorry, you have been blocked",
        "just a moment...",
        "verify you are human",
        "enable cookies",
        "not authorized to view this website"
    ]
    return any(ind in html.lower() for ind in indicators)

# 3. Proxy rotation for IP reputation
class ProxyRotator:
    def get_next(self) -> Optional[str]:
        proxy = self.proxies[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.proxies)
        return proxy

# 4. Fallback to undetected_chromedriver
import undetected_chromedriver as uc
options = uc.ChromeOptions()
options.add_argument('--headless=new')
driver = uc.Chrome(options=options)
```

---

## Detailed Analysis of CF-Clearance-Scraper (Node.js/Puppeteer)

**Location:** `cloudflare-bypass-service/vendor/cf-clearance-scraper/`

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Express HTTP Server (:3000)                   │
│                                                                  │
│  POST /cf-clearance-scraper                                      │
│  Body: { url, mode, proxy?, siteKey?, authToken? }              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐                    │
│  │ Request Validate │──▶│ Auth Check       │                    │
│  └──────────────────┘   └──────────────────┘                    │
│                                │                                 │
│                                ▼                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Mode Router                                  │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  "source"        → getSource()       → HTML string       │   │
│  │  "waf-session"   → wafSession()      → {cookies,headers} │   │
│  │  "turnstile-min" → solveTurnstileMin → Token string      │   │
│  │  "turnstile-max" → solveTurnstileMax → Token string      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                │                                 │
│                                ▼                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Global Browser Instance                        │   │
│  │                                                           │   │
│  │  puppeteer-real-browser.connect({                        │   │
│  │    headless: false,                                       │   │
│  │    turnstile: true,     ← Auto-solve Turnstile           │   │
│  │    disableXvfb: false,  ← Use Xvfb like legacy           │   │
│  │    connectOption: { defaultViewport: null }              │   │
│  │  })                                                       │   │
│  │                                                           │   │
│  │  Features:                                                │   │
│  │  - Single browser, persistent across requests             │   │
│  │  - Auto-reconnects on disconnect                          │   │
│  │  - Isolated contexts per request (not new browsers)       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Concurrency Control:                                            │
│  - global.browserLimit = 20 (max concurrent contexts)           │
│  - global.browserLength tracks active contexts                  │
│  - Returns 429 when limit reached                               │
│  - global.timeOut = 60000ms per request                         │
└─────────────────────────────────────────────────────────────────┘
```

### Endpoint Details

#### 1. getSource() - Get Page HTML

```javascript
function getSource({ url, proxy }) {
  // Create isolated browser context with optional proxy
  const context = await global.browser.createBrowserContext({
    proxyServer: proxy ? `http://${proxy.host}:${proxy.port}` : undefined,
  });

  const page = await context.newPage();

  // Proxy authentication if provided
  if (proxy?.username && proxy?.password)
    await page.authenticate({ username, password });

  // Request interception setup
  await page.setRequestInterception(true);
  page.on("request", async (request) => request.continue());

  // Response listener - waits for successful target response
  page.on("response", async (res) => {
    if ([200, 302].includes(res.status()) && res.url() === url) {
      await page.waitForNavigation({ waitUntil: "load", timeout: 5000 });
      const html = await page.content();
      await context.close();
      resolve(html);
    }
  });

  // Navigate to URL - puppeteer-real-browser handles CF automatically
  await page.goto(url, { waitUntil: "domcontentloaded" });
}
```

#### 2. wafSession() - Get Reusable Session Credentials

```javascript
function wafSession({ url, proxy }) {
  // Same context creation as getSource...

  // Find Accept-Language from real browser
  const acceptLanguage = await page.evaluate(async () => {
    return await fetch("https://httpbin.org/get")
      .then(res => res.json())
      .then(res => res.headers["Accept-Language"]);
  });

  page.on("response", async (res) => {
    if ([200, 302].includes(res.status()) && res.url() === url) {
      const cookies = await page.cookies();
      let headers = await res.request().headers();

      // Clean headers for reuse with external HTTP clients
      delete headers["content-type"];
      delete headers["accept-encoding"];
      delete headers["accept"];
      delete headers["content-length"];
      headers["accept-language"] = acceptLanguage;

      resolve({ cookies, headers });
    }
  });
}
```

#### 3. solveTurnstileMin() - Efficient Token Generation

```javascript
function solveTurnstileMin({ url, proxy, siteKey }) {
  // Intercept document request and serve fake page
  page.on("request", async (request) => {
    if (request.url() === url && request.resourceType() === "document") {
      // Serve minimal HTML with just Turnstile widget
      await request.respond({
        status: 200,
        contentType: "text/html",
        body: fakePage.replace(/<site-key>/g, siteKey),
      });
    } else {
      await request.continue();
    }
  });

  // Inject token detection script
  await page.evaluateOnNewDocument(() => {
    async function waitForToken() {
      while (!token) {
        try {
          token = window.turnstile.getResponse();
        } catch (e) {}
        await new Promise(r => setTimeout(r, 500));
      }
      // Signal token ready via hidden input
      var c = document.createElement("input");
      c.name = "cf-response";
      c.value = token;
      document.body.appendChild(c);
    }
    waitForToken();
  });

  // Wait for token
  await page.waitForSelector('[name="cf-response"]', { timeout: 60000 });
  const token = await page.$eval('[name="cf-response"]', el => el.value);
}
```

### Browser Creation (createBrowser.js)

```javascript
const { connect } = require("puppeteer-real-browser");

async function createBrowser() {
  global.browser = null;

  const { browser } = await connect({
    headless: false,        // Required for Turnstile
    turnstile: true,        // ★ Built-in auto-solve ★
    connectOption: {
      defaultViewport: null  // Use full screen
    },
    disableXvfb: false,     // Use Xvfb on Linux
  });

  global.browser = browser;

  // Auto-reconnect on disconnect
  browser.on('disconnected', async () => {
    console.log('Browser disconnected');
    await new Promise(r => setTimeout(r, 3000));
    await createBrowser();  // Recursive reconnect
  });
}
```

---

## Feature Comparison and Gap Analysis

| Feature | Legacy (Python) | CF-Clearance | Gap/Action |
|---------|-----------------|--------------|------------|
| Browser engine | SeleniumBase/Chrome | Puppeteer/Chrome | Same |
| Anti-detection | undetected-chromedriver | puppeteer-real-browser | Similar |
| Virtual display | sbvirtualdisplay | Built-in Xvfb | Same |
| **Browser history spoofing** | **YES** | **NO** | **★ MUST ADD ★** |
| Turnstile solving | uc_gui_click_captcha loop | Built-in auto-solve | CF-Clearance better |
| Session reuse | No | Yes (waf-session) | CF-Clearance better |
| Context pooling | No (new browser each) | Yes (isolated contexts) | CF-Clearance better |
| Modal handling | scraper_pass_modal() | No | Nice to have |
| Bot detection check | check_for_bot_detection() | No | Nice to have |
| Proxy rotation | ProxyRotator class | Per-request proxy | Similar |
| Retry logic | uc_open_with_reconnect | Timeout only | Consider adding |

---

## Requirements for Enhanced CF-Clearance-Scraper

### Must Have (P0)

1. **Browser History Spoofing** - Port `make_sites_visited_history()` mechanism:
   - On browser startup OR on first request in new context
   - Visit configurable list of "warmup" sites
   - Build cookie/storage footprint before target
   - Make this optional via request parameter

2. **Keep Existing API** - No changes to endpoint structure:
   - POST /cf-clearance-scraper with same modes
   - Same request/response format
   - Backward compatible

3. **Maintain Efficiency** - Don't sacrifice performance:
   - Keep persistent browser instance
   - Keep context pooling
   - History warmup should be cached/reusable

### Should Have (P1)

4. **Bot Detection Response** - Add check_for_bot_detection():
   - Detect when page is still a challenge page
   - Return appropriate error code
   - Allow retry logic on client side

5. **Modal Handler** - Generic popup/modal closer:
   - Configurable selectors
   - Try common patterns
   - Optional per-request

6. **Enhanced Retry** - Add reconnect logic:
   - Retry navigation on failure
   - Configurable retry count
   - Exponential backoff

### Won't Have (This Iteration)

- Python bindings (use HTTP API)
- Task queue integration (stays as HTTP service)
- Multiple browser instances (keep single persistent)
- Platform-specific parsers (out of scope)

---

## Technical Implementation Notes

### Browser History Warmup Options

**Option A: On Browser Start (Recommended)**
```javascript
async function createBrowser() {
  const { browser } = await connect({...});
  global.browser = browser;

  // Warmup immediately after browser creation
  await warmupBrowserHistory(browser);
}

async function warmupBrowserHistory(browser) {
  const page = await browser.newPage();
  const warmupSites = [
    'https://instagram.com/',
    'https://google.com/',
    'https://x.com/'
  ];

  for (const site of warmupSites) {
    await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
  }
  await page.close();
}
```

**Option B: Per-Context Warmup**
```javascript
// In each endpoint, before navigating to target:
if (data.warmup !== false) {
  await warmupContext(page);
}
```

**Option C: Request Parameter**
```json
{
  "url": "https://target.com",
  "mode": "source",
  "warmup": true,
  "warmupSites": ["https://google.com/"]
}
```

---

## Open Questions (Resolved)

- [x] ~~Should we keep both approaches?~~ → **Consolidate to CF-Clearance-Scraper**
- [x] ~~Which architecture?~~ → **HTTP API (keep existing)**
- [x] ~~Warmup strategy?~~ → **Option A: On browser start** (most efficient, warmup once, all requests benefit)
- [x] ~~Warmup sites config?~~ → **Environment variable with defaults** (allows customization without code changes)
- [x] ~~Health check endpoint?~~ → **Yes, add `/health`** (useful for monitoring, non-breaking)

---

## Backward Compatibility Requirements

To maintain compatibility with existing software:

1. **API Contract Unchanged:**
   - `POST /cf-clearance-scraper` - same endpoint
   - Same request body schema: `{ url, mode, proxy?, siteKey?, authToken? }`
   - Same response schema for each mode
   - Same HTTP status codes (200, 400, 401, 429, 500)

2. **New Features are Transparent:**
   - Browser warmup happens automatically on startup
   - No new required parameters
   - Existing clients work without modification

3. **New Optional Parameters (additive only):**
   - `warmup: false` - skip warmup for this request (default: true/auto)
   - `closeModal: true` - attempt to close popups (default: false)
   - `retries: N` - retry count on failure (default: 1)

4. **New Endpoint (additive):**
   - `GET /health` - returns `{ status: "ok", browser: true/false }`

---

## Approval

- [x] Reviewed by: User
- [x] Approved on: 2026-02-10
- [x] Notes: Use recommendations, maintain backward compatibility
