/**
 * Unit Tests: health endpoint
 */

describe('health endpoint', () => {
  let healthCheck;

  beforeEach(() => {
    jest.resetModules();

    // Reset globals
    global.browser = null;
    global.browserWarmedUp = false;
    global.browserLength = 0;
    global.browserLimit = 20;

    // Clear proxy cache
    const proxyCache = require('../../src/module/proxyCache');
    proxyCache.clear();

    healthCheck = require('../../src/endpoints/health');
  });

  const createMockRes = () => {
    const res = {
      statusCode: null,
      body: null,
      status: jest.fn().mockImplementation((code) => {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn().mockImplementation((data) => {
        res.body = data;
        return res;
      })
    };
    return res;
  };

  describe('status determination', () => {
    test('returns ok when browser ready and warmed up', () => {
      global.browser = { /* mock browser */ };
      global.browserWarmedUp = true;

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.browser).toBe(true);
      expect(res.body.warmedUp).toBe(true);
    });

    test('returns degraded when browser ready but not warmed up', () => {
      global.browser = { /* mock browser */ };
      global.browserWarmedUp = false;

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.browser).toBe(true);
      expect(res.body.warmedUp).toBe(false);
    });

    test('returns error when browser not ready', () => {
      global.browser = null;
      global.browserWarmedUp = false;

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.statusCode).toBe(503);
      expect(res.body.status).toBe('error');
      expect(res.body.browser).toBe(false);
    });

    test('returns error when browser is undefined', () => {
      global.browser = undefined;

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.statusCode).toBe(503);
      expect(res.body.status).toBe('error');
    });
  });

  describe('context stats', () => {
    test('includes activeContexts count', () => {
      global.browser = { /* mock */ };
      global.browserWarmedUp = true;
      global.browserLength = 5;

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.body.activeContexts).toBe(5);
    });

    test('includes maxContexts limit', () => {
      global.browser = { /* mock */ };
      global.browserWarmedUp = true;
      global.browserLimit = 30;

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.body.maxContexts).toBe(30);
    });

    test('defaults to 0 active contexts when undefined', () => {
      global.browser = { /* mock */ };
      global.browserWarmedUp = true;
      global.browserLength = undefined;

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.body.activeContexts).toBe(0);
    });

    test('defaults to 20 max contexts when undefined', () => {
      global.browser = { /* mock */ };
      global.browserWarmedUp = true;
      global.browserLimit = undefined;

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.body.maxContexts).toBe(20);
    });
  });

  describe('uptime', () => {
    test('includes uptime in seconds', () => {
      global.browser = { /* mock */ };
      global.browserWarmedUp = true;

      const res = createMockRes();
      healthCheck({}, res);

      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('proxy cache stats', () => {
    test('includes proxy cache stats', () => {
      global.browser = { /* mock */ };
      global.browserWarmedUp = true;

      const proxyCache = require('../../src/module/proxyCache');
      proxyCache.setWarmedUp({ host: 'test.com', port: 80 }, true);

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.body.proxyCache).toBeDefined();
      expect(res.body.proxyCache.total).toBe(1);
      expect(res.body.proxyCache.active).toBe(1);
    });

    test('includes empty stats when no proxies cached', () => {
      global.browser = { /* mock */ };
      global.browserWarmedUp = true;

      const res = createMockRes();
      healthCheck({}, res);

      expect(res.body.proxyCache).toBeDefined();
      expect(res.body.proxyCache.total).toBe(0);
    });
  });
});
