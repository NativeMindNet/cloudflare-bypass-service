# Cloudflare Bypass Service

A Node.js service for bypassing Cloudflare protection using browser automation with Puppeteer. Features a two-level warmup system for improved success rates.

## Features

- **Cloudflare WAF Bypass** - Get page source from CF-protected sites
- **Turnstile CAPTCHA Solving** - Generate Turnstile tokens (min/max modes)
- **Session Extraction** - Get cookies and headers for reuse
- **Two-Level Warmup System** - Browser + proxy warmup for higher success rates
- **Health Monitoring** - Health check endpoint with detailed status
- **Test Framework** - Comprehensive tests including CF behavior monitoring

## Quick Start

### Docker (Recommended)

```bash
docker-compose up -d
```

### Local Development

```bash
npm install
npm start
```

The service will be available at `http://localhost:3000`.

## API Reference

### POST /cf-clearance-scraper

Main endpoint for all Cloudflare bypass operations.

**Request Body:**

```json
{
  "url": "https://example.com",
  "mode": "source",
  "proxy": {
    "host": "proxy.example.com",
    "port": 8080,
    "username": "optional",
    "password": "optional"
  },
  "siteKey": "required-for-turnstile-min",
  "authToken": "optional-if-server-requires"
}
```

**Modes:**

| Mode | Description | Response |
|------|-------------|----------|
| `source` | Get page HTML | `{ code: 200, source: "<html>..." }` |
| `waf-session` | Get session credentials | `{ code: 200, cookies: [...], headers: {...} }` |
| `turnstile-min` | Solve Turnstile (minimal) | `{ code: 200, token: "..." }` |
| `turnstile-max` | Solve Turnstile (full page) | `{ code: 200, token: "..." }` |

### GET /health

Health check endpoint.

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
    "expired": 0,
    "failed": 1
  }
}
```

### GET /test-report

Returns latest Cloudflare test results.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `browserLimit` | 20 | Max concurrent browser contexts |
| `timeOut` | 60000 | Request timeout (ms) |
| `authToken` | null | Optional API authentication |
| `WARMUP_ENABLED` | true | Enable browser warmup on startup |
| `WARMUP_SITES` | instagram.com,google.com,x.com | Warmup sites (comma-separated) |
| `PROXY_WARMUP_ENABLED` | true | Enable per-proxy warmup |
| `PROXY_WARMUP_TTL` | 3600000 | Proxy warmup cache TTL (ms) |

## Two-Level Warmup System

The service implements a two-level warmup system to improve Cloudflare bypass success rates:

### Level 1: Browser Warmup (on startup)

When the browser starts, it visits trusted sites (Instagram, Google, X.com) to:
- Build browsing history
- Generate cookies from major sites
- Populate localStorage/sessionStorage
- Establish TLS session tickets
- Build trust score with Cloudflare

### Level 2: Proxy Warmup (on first request)

When a request uses a new proxy, the service:
- Visits warmup sites through that proxy
- Builds trust for the specific proxy IP
- Caches the warmup status (TTL: 1 hour)

This two-level approach ensures both the browser profile and each proxy IP have established trust before accessing target sites.

## Testing

```bash
# Run all tests
npm test

# Run unit tests only (fast)
npm run test:unit

# Run integration tests
npm run test:integration

# Run Cloudflare live tests (slow, real CF sites)
npm run test:cloudflare

# Generate CF comparison report
npm run test:cloudflare:report

# Run behavior monitoring
npm run monitor:cloudflare
```

## Project Structure

```
cloudflare-bypass-service/
├── src/
│   ├── index.js                 # Express server
│   ├── module/
│   │   ├── createBrowser.js     # Browser management + warmup
│   │   ├── warmupBrowser.js     # Browser-level warmup
│   │   ├── warmupProxy.js       # Proxy-level warmup
│   │   ├── proxyCache.js        # Proxy warmup cache
│   │   └── reqValidate.js       # Request validation
│   ├── endpoints/
│   │   ├── getSource.js         # Get page HTML
│   │   ├── wafSession.js        # Get session credentials
│   │   ├── solveTurnstile.min.js
│   │   ├── solveTurnstile.max.js
│   │   ├── health.js            # Health check
│   │   └── testReport.js        # Test results
│   └── data/
│       └── fakePage.html        # Turnstile min mode page
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── cloudflare/              # CF live tests + monitoring
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Error Responses

| Code | Description |
|------|-------------|
| 400 | Bad request (invalid parameters) |
| 401 | Unauthorized (invalid authToken) |
| 429 | Too many requests (browser limit reached) |
| 500 | Server error |
| 503 | Service unavailable (browser not ready) |

## License

ISC

## Repository

https://github.com/NativeMindNet/cloudflare-bypass-service
