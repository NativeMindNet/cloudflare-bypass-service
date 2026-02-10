# Implementation Plan: Cloudflare Bypass Service Core

> Version: 1.0
> Status: DRAFT
> Last Updated: 2026-02-10

## Overview

Implement two-level warmup system and comprehensive test framework for cloudflare-bypass-service.

**Repository:** https://github.com/NativeMindNet/cloudflare-bypass-service
**Base:** `vendor/cf-clearance-scraper/` (fork and enhance)

---

## Phase 1: Project Setup

### Task 1.1: Initialize project structure
**Files:** Root level
**Action:** Copy vendor code to src/, setup package.json

```bash
# From cloudflare-bypass-service/
cp -r vendor/cf-clearance-scraper/src ./src
cp -r vendor/cf-clearance-scraper/package.json ./
cp -r vendor/cf-clearance-scraper/Dockerfile ./
```

**Checklist:**
- [ ] Copy src/ from vendor
- [ ] Copy package.json
- [ ] Copy Dockerfile
- [ ] Update package.json name to "cloudflare-bypass-service"
- [ ] Add jest to devDependencies
- [ ] Create tests/ directory structure

---

## Phase 2: Core Warmup Modules

### Task 2.1: Create warmupBrowser.js
**File:** `src/module/warmupBrowser.js`
**Action:** New file

**Implementation:**
```javascript
const DEFAULT_WARMUP_SITES = [
  'https://www.instagram.com/',
  'https://www.google.com/',
  'https://www.x.com/'
];

async function warmupBrowserHistory(browser) {
  // Parse WARMUP_SITES env
  // Visit each site with domcontentloaded wait
  // Log progress
  // Set global.browserWarmedUp = true
  // Return success boolean
}

module.exports = { warmupBrowserHistory, DEFAULT_WARMUP_SITES };
```

**Checklist:**
- [ ] Parse WARMUP_SITES environment variable
- [ ] Handle bare domains (add https://)
- [ ] Visit sites sequentially with timeout
- [ ] Continue on individual failures
- [ ] Log warmup progress
- [ ] Set global.browserWarmedUp flag

---

### Task 2.2: Create proxyCache.js
**File:** `src/module/proxyCache.js`
**Action:** New file

**Implementation:**
```javascript
class ProxyCache {
  constructor() {
    this.cache = new Map();
    this.ttl = Number(process.env.PROXY_WARMUP_TTL) || 3600000;
  }

  getKey(proxy) { /* host:port or host:port:user */ }
  isWarmedUp(proxy) { /* check cache + TTL */ }
  setWarmedUp(proxy, success) { /* update cache */ }
  getStats() { /* return counts */ }
  cleanup() { /* remove expired */ }
}

module.exports = new ProxyCache();
```

**Checklist:**
- [ ] Implement getKey() with auth support
- [ ] Implement isWarmedUp() with TTL check
- [ ] Implement setWarmedUp() with timestamp
- [ ] Implement getStats() for health endpoint
- [ ] Implement cleanup() with setInterval
- [ ] Export singleton instance

---

### Task 2.3: Create warmupProxy.js
**File:** `src/module/warmupProxy.js`
**Action:** New file

**Implementation:**
```javascript
const proxyCache = require('./proxyCache');
const { DEFAULT_WARMUP_SITES } = require('./warmupBrowser');

async function warmupProxyContext(page, proxy) {
  // Check PROXY_WARMUP_ENABLED
  // Check proxyCache.isWarmedUp(proxy)
  // If not warmed, visit warmup sites
  // Update cache with result
  // Return success boolean
}

module.exports = { warmupProxyContext };
```

**Checklist:**
- [ ] Check PROXY_WARMUP_ENABLED env
- [ ] Check cache before warmup
- [ ] Reuse WARMUP_SITES config
- [ ] Visit sites through proxy context
- [ ] Update cache after warmup
- [ ] Log progress

---

### Task 2.4: Modify createBrowser.js
**File:** `src/module/createBrowser.js`
**Action:** Modify existing

**Changes:**
```javascript
const { warmupBrowserHistory } = require("./warmupBrowser");

async function createBrowser() {
  // ... existing connect() code ...

  global.browser = browser;
  global.browserWarmedUp = false;  // ADD

  // ADD: Warmup after browser creation
  if (process.env.WARMUP_ENABLED !== 'false') {
    await warmupBrowserHistory(browser);
  } else {
    global.browserWarmedUp = true;
  }

  // ... existing disconnect handler ...
}
```

**Checklist:**
- [ ] Import warmupBrowser module
- [ ] Add global.browserWarmedUp = false
- [ ] Call warmupBrowserHistory after connect
- [ ] Check WARMUP_ENABLED env
- [ ] Handle warmup on reconnect

---

## Phase 3: Endpoint Integration

### Task 3.1: Modify getSource.js
**File:** `src/endpoints/getSource.js`
**Action:** Modify existing

**Changes:**
```javascript
const { warmupProxyContext } = require('../module/warmupProxy');

// Inside getSource function, after page creation:
if (proxy) {
  await warmupProxyContext(page, proxy);
}
```

**Checklist:**
- [ ] Import warmupProxy module
- [ ] Add warmup call after page.authenticate()
- [ ] Before page.goto() to target

---

### Task 3.2: Modify wafSession.js
**File:** `src/endpoints/wafSession.js`
**Action:** Modify existing (same pattern as getSource)

**Checklist:**
- [ ] Import warmupProxy module
- [ ] Add warmup call after page creation

---

### Task 3.3: Modify solveTurnstile.min.js
**File:** `src/endpoints/solveTurnstile.min.js`
**Action:** Modify existing

**Checklist:**
- [ ] Import warmupProxy module
- [ ] Add warmup call after page creation

---

### Task 3.4: Modify solveTurnstile.max.js
**File:** `src/endpoints/solveTurnstile.max.js`
**Action:** Modify existing

**Checklist:**
- [ ] Import warmupProxy module
- [ ] Add warmup call after page creation

---

### Task 3.5: Create health.js
**File:** `src/endpoints/health.js`
**Action:** New file

**Implementation:**
```javascript
const proxyCache = require('../module/proxyCache');

function healthCheck(req, res) {
  const browserReady = !!global.browser;
  const warmedUp = global.browserWarmedUp === true;
  const status = browserReady && warmedUp ? 'ok' : browserReady ? 'degraded' : 'error';

  res.status(browserReady ? 200 : 503).json({
    status,
    browser: browserReady,
    warmedUp,
    activeContexts: global.browserLength || 0,
    maxContexts: global.browserLimit || 20,
    uptime: Math.floor(process.uptime()),
    proxyCache: proxyCache.getStats()
  });
}

module.exports = healthCheck;
```

**Checklist:**
- [ ] Import proxyCache for stats
- [ ] Return browser status
- [ ] Return warmup status
- [ ] Return proxy cache stats
- [ ] Return 503 if browser not ready

---

### Task 3.6: Create testReport.js
**File:** `src/endpoints/testReport.js`
**Action:** New file

**Implementation:**
```javascript
const fs = require('fs');
const path = require('path');

function testReport(req, res) {
  const reportPath = path.join(__dirname, '../../tests/cloudflare/results.json');

  if (!fs.existsSync(reportPath)) {
    return res.json({ lastRun: null, message: 'No test results available' });
  }

  const results = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  res.json(results);
}

module.exports = testReport;
```

**Checklist:**
- [ ] Read test results from file
- [ ] Return structured response
- [ ] Handle missing results file

---

### Task 3.7: Modify index.js
**File:** `src/index.js`
**Action:** Modify existing

**Changes:**
```javascript
const healthCheck = require('./endpoints/health');
const testReport = require('./endpoints/testReport');

// Add routes before 404 handler:
app.get('/health', healthCheck);
app.get('/test-report', testReport);
```

**Checklist:**
- [ ] Import health endpoint
- [ ] Import testReport endpoint
- [ ] Add GET /health route
- [ ] Add GET /test-report route

---

## Phase 4: Test Framework

### Task 4.1: Create test configuration
**File:** `jest.config.js`, `package.json` scripts
**Action:** New files

**Checklist:**
- [ ] Create jest.config.js
- [ ] Add test scripts to package.json
- [ ] Configure test directories
- [ ] Setup test reporter

---

### Task 4.2: Create unit tests
**Files:** `tests/unit/*.test.js`
**Action:** New files

**Files to create:**
- [ ] `tests/unit/proxyCache.test.js`
- [ ] `tests/unit/warmupBrowser.test.js`
- [ ] `tests/unit/warmupProxy.test.js`
- [ ] `tests/unit/health.test.js`

---

### Task 4.3: Create integration tests
**Files:** `tests/integration/*.test.js`
**Action:** New files

**Files to create:**
- [ ] `tests/integration/browser-warmup.test.js`
- [ ] `tests/integration/proxy-warmup.test.js`
- [ ] `tests/integration/backward-compat.test.js`

---

### Task 4.4: Create Cloudflare live tests
**Files:** `tests/cloudflare/*.js`
**Action:** New files

**Files to create:**
- [ ] `tests/cloudflare/cf-targets.js` - Test URLs
- [ ] `tests/cloudflare/reporter.js` - Results collector
- [ ] `tests/cloudflare/no-warmup.test.js`
- [ ] `tests/cloudflare/browser-warmup.test.js`
- [ ] `tests/cloudflare/proxy-warmup.test.js`
- [ ] `tests/cloudflare/behavior-monitor.js`
- [ ] `tests/cloudflare/report-generator.js`

---

## Phase 5: CI/CD & Documentation

### Task 5.1: Create GitHub Actions workflow
**File:** `.github/workflows/test.yml`
**Action:** New file

**Checklist:**
- [ ] Unit test job
- [ ] Integration test job
- [ ] Weekly CF monitoring job
- [ ] Artifact upload for reports

---

### Task 5.2: Create docker-compose.yml
**File:** `docker-compose.yml`
**Action:** New file

**Checklist:**
- [ ] Service definition
- [ ] Environment variables
- [ ] Port mapping
- [ ] Volume for test results

---

### Task 5.3: Update Dockerfile
**File:** `Dockerfile`
**Action:** Modify if needed

**Checklist:**
- [ ] Ensure all new files included
- [ ] Test dependencies available for dev mode

---

### Task 5.4: Update README.md
**File:** `README.md`
**Action:** Modify/Create

**Checklist:**
- [ ] Document new features
- [ ] Document environment variables
- [ ] Document test commands
- [ ] Add warmup explanation
- [ ] Add API reference

---

## Execution Order

```
Phase 1: Setup (1 task)
  └── 1.1 Initialize project

Phase 2: Core Modules (4 tasks, can parallelize 2.1-2.3)
  ├── 2.1 warmupBrowser.js
  ├── 2.2 proxyCache.js
  ├── 2.3 warmupProxy.js
  └── 2.4 createBrowser.js (depends on 2.1)

Phase 3: Endpoints (7 tasks, can parallelize 3.1-3.4)
  ├── 3.1 getSource.js
  ├── 3.2 wafSession.js
  ├── 3.3 solveTurnstile.min.js
  ├── 3.4 solveTurnstile.max.js
  ├── 3.5 health.js
  ├── 3.6 testReport.js
  └── 3.7 index.js (depends on 3.5, 3.6)

Phase 4: Tests (4 tasks)
  ├── 4.1 Test config
  ├── 4.2 Unit tests
  ├── 4.3 Integration tests
  └── 4.4 CF live tests

Phase 5: CI/CD (4 tasks)
  ├── 5.1 GitHub Actions
  ├── 5.2 docker-compose.yml
  ├── 5.3 Dockerfile
  └── 5.4 README.md
```

---

## Dependencies

```
warmupBrowser.js ─────────────────────┐
                                      ├──► createBrowser.js
proxyCache.js ────► warmupProxy.js ───┤
                                      └──► all endpoints
```

---

## Estimated Task Count

| Phase | Tasks | New Files | Modified Files |
|-------|-------|-----------|----------------|
| 1. Setup | 1 | 0 | 2 |
| 2. Core | 4 | 3 | 1 |
| 3. Endpoints | 7 | 2 | 5 |
| 4. Tests | 4 | 12 | 0 |
| 5. CI/CD | 4 | 3 | 1 |
| **Total** | **20** | **20** | **9** |

---

## Approval

- [x] Reviewed by: User
- [x] Approved on: 2026-02-10
- [x] Notes: Approved, begin implementation
