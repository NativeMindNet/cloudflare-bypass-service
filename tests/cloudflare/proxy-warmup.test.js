/**
 * Cloudflare Live Test: Full Warmup (Browser + Proxy)
 *
 * Tests with both browser and proxy warmup enabled.
 * Should show best success rates.
 *
 * NOTE: These tests require test proxies to be configured via TEST_PROXIES env.
 */

const targets = require('./cf-targets');
const reporter = require('./reporter');

const SKIP_LIVE_TESTS = process.env.SKIP_CF_TESTS === 'true';

/**
 * Parse TEST_PROXIES environment variable
 * Format: "host1:port1,host2:port2:user:pass"
 */
function loadTestProxies() {
  const proxiesEnv = process.env.TEST_PROXIES || '';

  if (!proxiesEnv) {
    return [];
  }

  return proxiesEnv.split(',').map(proxyStr => {
    const parts = proxyStr.split(':');

    if (parts.length < 2) return null;

    const proxy = {
      host: parts[0],
      port: parseInt(parts[1], 10)
    };

    if (parts.length >= 4) {
      proxy.username = parts[2];
      proxy.password = parts[3];
    }

    return proxy;
  }).filter(Boolean);
}

describe('Cloudflare - Full Warmup (Browser + Proxy)', () => {
  let originalWarmupEnabled;
  let originalProxyWarmupEnabled;
  let proxies;

  beforeAll(() => {
    if (SKIP_LIVE_TESTS) {
      console.log('[CF Tests] Skipping live tests (SKIP_CF_TESTS=true)');
      return;
    }

    originalWarmupEnabled = process.env.WARMUP_ENABLED;
    originalProxyWarmupEnabled = process.env.PROXY_WARMUP_ENABLED;

    // Enable all warmup
    process.env.WARMUP_ENABLED = 'true';
    process.env.PROXY_WARMUP_ENABLED = 'true';

    proxies = loadTestProxies();

    if (proxies.length === 0) {
      console.log('[CF Tests] No test proxies configured. Set TEST_PROXIES env to enable proxy tests.');
    }
  });

  afterAll(() => {
    if (originalWarmupEnabled !== undefined) {
      process.env.WARMUP_ENABLED = originalWarmupEnabled;
    } else {
      delete process.env.WARMUP_ENABLED;
    }

    if (originalProxyWarmupEnabled !== undefined) {
      process.env.PROXY_WARMUP_ENABLED = originalProxyWarmupEnabled;
    } else {
      delete process.env.PROXY_WARMUP_ENABLED;
    }

    reporter.save();
  });

  test('Control: example.com with full warmup', async () => {
    if (SKIP_LIVE_TESTS) return;

    const url = targets.control[1];
    const start = Date.now();

    try {
      const response = await fetch(url);
      const html = await response.text();

      const success = response.ok && html.includes('Example Domain');

      reporter.record({
        test: 'full-warmup',
        target: 'control',
        url,
        success,
        duration: Date.now() - start,
        blocked: false
      });

      expect(success).toBe(true);
    } catch (e) {
      reporter.record({
        test: 'full-warmup',
        target: 'control',
        url,
        success: false,
        error: e.message,
        duration: Date.now() - start
      });

      throw e;
    }
  });

  test.skip('WAF challenge with full warmup', async () => {
    if (SKIP_LIVE_TESTS) return;
    if (proxies.length === 0) {
      console.log('[Skipped] No test proxies available');
      return;
    }

    const url = targets.primary.waf;
    const proxy = proxies[0];
    const start = Date.now();

    reporter.record({
      test: 'full-warmup',
      target: 'waf',
      url,
      proxy: `${proxy.host}:${proxy.port}`,
      success: false,
      duration: Date.now() - start,
      note: 'Requires real browser with proxy'
    });
  });

  test.skip('Turnstile with full warmup', async () => {
    if (SKIP_LIVE_TESTS) return;
    if (proxies.length === 0) {
      console.log('[Skipped] No test proxies available');
      return;
    }

    const { url, siteKey } = targets.turnstile[0];
    const proxy = proxies[0];
    const start = Date.now();

    reporter.record({
      test: 'full-warmup',
      target: 'turnstile',
      url,
      proxy: `${proxy.host}:${proxy.port}`,
      success: false,
      duration: Date.now() - start,
      note: 'Requires real browser with proxy'
    });
  });
});
