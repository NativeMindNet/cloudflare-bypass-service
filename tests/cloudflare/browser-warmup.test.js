/**
 * Cloudflare Live Test: Browser Warmup
 *
 * Tests with browser-level warmup enabled.
 * Should show improved success rates over baseline.
 *
 * NOTE: These tests require a real browser and make real network requests.
 */

const targets = require('./cf-targets');
const reporter = require('./reporter');

const SKIP_LIVE_TESTS = process.env.SKIP_CF_TESTS === 'true';

describe('Cloudflare - Browser Warmup', () => {
  let originalWarmupEnabled;
  let originalProxyWarmupEnabled;

  beforeAll(() => {
    if (SKIP_LIVE_TESTS) {
      console.log('[CF Tests] Skipping live tests (SKIP_CF_TESTS=true)');
      return;
    }

    originalWarmupEnabled = process.env.WARMUP_ENABLED;
    originalProxyWarmupEnabled = process.env.PROXY_WARMUP_ENABLED;

    // Enable browser warmup only
    process.env.WARMUP_ENABLED = 'true';
    process.env.PROXY_WARMUP_ENABLED = 'false';
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

    // Save results after all tests
    reporter.save();
  });

  test('Control: example.com with browser warmup', async () => {
    if (SKIP_LIVE_TESTS) return;

    const url = targets.control[1];
    const start = Date.now();

    try {
      const response = await fetch(url);
      const html = await response.text();

      const success = response.ok && html.includes('Example Domain');

      reporter.record({
        test: 'browser-warmup',
        target: 'control',
        url,
        success,
        duration: Date.now() - start,
        blocked: false
      });

      expect(success).toBe(true);
    } catch (e) {
      reporter.record({
        test: 'browser-warmup',
        target: 'control',
        url,
        success: false,
        error: e.message,
        duration: Date.now() - start
      });

      throw e;
    }
  });

  test.skip('WAF challenge with browser warmup', async () => {
    if (SKIP_LIVE_TESTS) return;

    const url = targets.primary.waf;
    const start = Date.now();

    // This would call the CF bypass service with browser warmup enabled
    // Service should have visited warmup sites on startup

    reporter.record({
      test: 'browser-warmup',
      target: 'waf',
      url,
      success: false,
      duration: Date.now() - start,
      note: 'Requires real browser with warmup'
    });
  });

  test.skip('Turnstile with browser warmup', async () => {
    if (SKIP_LIVE_TESTS) return;

    const { url, siteKey } = targets.turnstile[0];
    const start = Date.now();

    reporter.record({
      test: 'browser-warmup',
      target: 'turnstile',
      url,
      success: false,
      duration: Date.now() - start,
      note: 'Requires real browser with warmup'
    });
  });
});
