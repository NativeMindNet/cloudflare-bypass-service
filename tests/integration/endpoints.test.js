/**
 * Integration Tests: API Endpoints
 *
 * These tests verify the HTTP API behavior with mocked browser.
 * For full browser tests, use the cloudflare tests.
 */

const request = require('supertest');

describe('API Endpoints', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
    process.env.SKIP_LAUNCH = 'true';

    // Reset globals
    global.browser = null;
    global.browserWarmedUp = false;
    global.browserLength = 0;
    global.browserLimit = 20;
    global.timeOut = 60000;

    app = require('../../src/index');
  });

  describe('GET /health', () => {
    test('returns 503 when browser not ready', async () => {
      global.browser = null;

      const res = await request(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
      expect(res.body.browser).toBe(false);
    });

    test('returns 200 when browser ready', async () => {
      global.browser = { mock: true };
      global.browserWarmedUp = true;

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.browser).toBe(true);
      expect(res.body.warmedUp).toBe(true);
    });

    test('includes proxy cache stats', async () => {
      global.browser = { mock: true };
      global.browserWarmedUp = true;

      const res = await request(app).get('/health');

      expect(res.body.proxyCache).toBeDefined();
      expect(res.body.proxyCache).toHaveProperty('total');
      expect(res.body.proxyCache).toHaveProperty('active');
    });
  });

  describe('GET /test-report', () => {
    test('returns message when no results available', async () => {
      const res = await request(app).get('/test-report');

      expect(res.status).toBe(200);
      expect(res.body.lastRun).toBeNull();
      expect(res.body.message).toContain('No test results');
    });
  });

  describe('POST /cf-clearance-scraper', () => {
    test('returns 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(400);
    });

    test('returns 400 for invalid mode', async () => {
      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send({ url: 'https://example.com', mode: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(400);
    });

    test('returns 500 when browser not ready', async () => {
      global.browser = null;

      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send({ url: 'https://example.com', mode: 'source' });

      expect(res.status).toBe(500);
      expect(res.body.message).toContain('not ready');
    });

    test('returns 429 when at browser limit', async () => {
      global.browser = { mock: true };
      global.browserLength = 20;
      global.browserLimit = 20;

      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send({ url: 'https://example.com', mode: 'source' });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe(429);

      // Reset
      global.browserLength = 0;
    });

    test('returns 401 when authToken required but not provided', async () => {
      // Temporarily set authToken
      const originalEnv = process.env.authToken;
      process.env.authToken = 'secret123';

      // Need to reload module to pick up env change
      jest.resetModules();
      const freshApp = require('../../src/index');

      const res = await request(freshApp)
        .post('/cf-clearance-scraper')
        .send({ url: 'https://example.com', mode: 'source' });

      expect(res.status).toBe(401);

      // Restore
      process.env.authToken = originalEnv;
    });
  });

  describe('Unknown routes', () => {
    test('returns 404 for unknown GET routes', async () => {
      const res = await request(app).get('/unknown');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(404);
    });

    test('returns 404 for unknown POST routes', async () => {
      const res = await request(app)
        .post('/unknown')
        .send({ data: 'test' });

      expect(res.status).toBe(404);
    });
  });
});
