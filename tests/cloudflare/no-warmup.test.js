/**
 * Cloudflare Live Test: No Warmup Baseline
 *
 * Tests without any warmup to establish baseline success rates.
 * This helps measure the effectiveness of warmup strategies.
 *
 * NOTE: These tests require a real browser and make real network requests.
 * They are slow and should be run separately from unit tests.
 */

const targets = require('./cf-targets');
const reporter = require('./reporter');

// Skip these tests in CI unless explicitly enabled
const SKIP_LIVE_TESTS = process.env.SKIP_CF_TESTS === 'true';

describe('Cloudflare - No Warmup Baseline', () => {
  let originalWarmupEnabled;
  let originalProxyWarmupEnabled;

  beforeAll(() => {
    if (SKIP_LIVE_TESTS) {
      console.log('[CF Tests] Skipping live tests (SKIP_CF_TESTS=true)');
      return;
    }

    // Store original values
    originalWarmupEnabled = process.env.WARMUP_ENABLED;
    originalProxyWarmupEnabled = process.env.PROXY_WARMUP_ENABLED;

    // Disable all warmup
    process.env.WARMUP_ENABLED = 'false';
    process.env.PROXY_WARMUP_ENABLED = 'false';

    reporter.clear();
  });

  afterAll(() => {
    // Restore original values
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
  });

  // Control test - should always pass
  test('Control: example.com (no CF)', async () => {
    if (SKIP_LIVE_TESTS) return;

    const url = targets.control[1]; // example.com
    const start = Date.now();

    try {
      const response = await fetch(url);
      const html = await response.text();

      const success = response.ok && html.includes('Example Domain');
      const duration = Date.now() - start;

      reporter.record({
        test: 'no-warmup',
        target: 'control',
        url,
        success,
        duration,
        blocked: false
      });

      expect(success).toBe(true);
    } catch (e) {
      reporter.record({
        test: 'no-warmup',
        target: 'control',
        url,
        success: false,
        error: e.message,
        duration: Date.now() - start
      });

      throw e;
    }
  });

  // These tests document expected behavior but may fail
  // The purpose is to establish baseline metrics
  test.skip('WAF challenge without warmup (baseline)', async () => {
    if (SKIP_LIVE_TESTS) return;

    // This test requires real browser, skip in basic setup
    // Will be enabled when running full CF test suite

    const url = targets.primary.waf;
    const start = Date.now();

    // In a real implementation, this would call the CF bypass service
    // For now, just document the expected test structure

    reporter.record({
      test: 'no-warmup',
      target: 'waf',
      url,
      success: false,
      duration: Date.now() - start,
      blocked: true,
      note: 'Baseline test - expected to have lower success rate'
    });
  });

  test.skip('Turnstile without warmup (baseline)', async () => {
    if (SKIP_LIVE_TESTS) return;

    const { url, siteKey } = targets.turnstile[0];
    const start = Date.now();

    reporter.record({
      test: 'no-warmup',
      target: 'turnstile',
      url,
      success: false,
      duration: Date.now() - start,
      note: 'Baseline test - requires real browser'
    });
  });
});
