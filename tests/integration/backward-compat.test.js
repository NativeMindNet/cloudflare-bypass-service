/**
 * Integration Tests: Backward Compatibility
 *
 * Ensures the API contract remains unchanged for existing clients.
 */

const request = require('supertest');

describe('Backward Compatibility', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
    process.env.SKIP_LAUNCH = 'true';

    global.browser = null;
    global.browserWarmedUp = false;
    global.browserLength = 0;
    global.browserLimit = 20;
    global.timeOut = 60000;

    app = require('../../src/index');
  });

  describe('Request validation schema', () => {
    test('accepts valid source mode request', async () => {
      const validRequest = {
        url: 'https://example.com',
        mode: 'source'
      };

      // Will fail because browser not ready, but validates schema
      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send(validRequest);

      expect(res.body.code).not.toBe(400);
    });

    test('accepts valid waf-session mode request', async () => {
      const validRequest = {
        url: 'https://example.com',
        mode: 'waf-session'
      };

      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send(validRequest);

      expect(res.body.code).not.toBe(400);
    });

    test('accepts valid turnstile-min mode request with siteKey', async () => {
      const validRequest = {
        url: 'https://example.com',
        mode: 'turnstile-min',
        siteKey: '0x4AAAAAAAtest'
      };

      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send(validRequest);

      expect(res.body.code).not.toBe(400);
    });

    test('accepts valid turnstile-max mode request', async () => {
      const validRequest = {
        url: 'https://example.com',
        mode: 'turnstile-max'
      };

      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send(validRequest);

      expect(res.body.code).not.toBe(400);
    });

    test('accepts request with proxy config', async () => {
      const validRequest = {
        url: 'https://example.com',
        mode: 'source',
        proxy: {
          host: 'proxy.example.com',
          port: 8080,
          username: 'user',
          password: 'pass'
        }
      };

      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send(validRequest);

      expect(res.body.code).not.toBe(400);
    });

    test('accepts request with authToken', async () => {
      const validRequest = {
        url: 'https://example.com',
        mode: 'source',
        authToken: 'mytoken'
      };

      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send(validRequest);

      // Should not be rejected for schema reasons
      expect(res.body.code).not.toBe(400);
    });
  });

  describe('Response format', () => {
    test('error responses have code and message fields', async () => {
      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send({});

      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
    });

    test('400 errors include schema info', async () => {
      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send({});

      expect(res.body.code).toBe(400);
      expect(res.body).toHaveProperty('schema');
    });
  });

  describe('HTTP status codes', () => {
    test('returns 400 for bad request', async () => {
      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send({});

      expect(res.status).toBe(400);
    });

    test('returns 404 for unknown endpoint', async () => {
      const res = await request(app).get('/nonexistent');

      expect(res.status).toBe(404);
    });

    test('returns 429 when rate limited', async () => {
      global.browser = { mock: true };
      global.browserLength = 20;
      global.browserLimit = 20;

      const res = await request(app)
        .post('/cf-clearance-scraper')
        .send({ url: 'https://example.com', mode: 'source' });

      expect(res.status).toBe(429);

      global.browserLength = 0;
    });
  });

  describe('New endpoints are additive', () => {
    test('GET /health is new endpoint (was 404 before)', async () => {
      const res = await request(app).get('/health');

      // Should not be 404
      expect(res.status).not.toBe(404);
      expect(res.body).toHaveProperty('status');
    });

    test('GET /test-report is new endpoint (was 404 before)', async () => {
      const res = await request(app).get('/test-report');

      // Should not be 404
      expect(res.status).not.toBe(404);
    });
  });

  describe('CORS support', () => {
    test('includes CORS headers', async () => {
      const res = await request(app)
        .options('/cf-clearance-scraper')
        .set('Origin', 'https://example.com');

      // Express CORS middleware should allow requests
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
