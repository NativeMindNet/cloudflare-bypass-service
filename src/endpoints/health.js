/**
 * Health Check Endpoint
 *
 * Returns service health status including browser state and warmup status.
 */

const proxyCache = require('../module/proxyCache');

/**
 * GET /health
 *
 * Response:
 * - status: "ok" | "degraded" | "error"
 * - browser: boolean (browser instance ready)
 * - warmedUp: boolean (browser warmup complete)
 * - activeContexts: number (current browser contexts in use)
 * - maxContexts: number (maximum allowed contexts)
 * - uptime: number (process uptime in seconds)
 * - proxyCache: object (proxy warmup cache stats)
 *
 * Status codes:
 * - 200: Browser ready
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
    uptime: Math.floor(process.uptime()),
    proxyCache: proxyCache.getStats()
  };

  res.status(browserReady ? 200 : 503).json(response);
}

module.exports = healthCheck;
