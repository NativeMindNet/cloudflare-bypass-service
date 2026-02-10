/**
 * Unit Tests: warmupProxy
 */

describe('warmupProxy', () => {
  let warmupProxyContext;
  let proxyCache;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.PROXY_WARMUP_ENABLED;
    delete process.env.WARMUP_SITES;

    proxyCache = require('../../src/module/proxyCache');
    proxyCache.clear();

    const warmupModule = require('../../src/module/warmupProxy');
    warmupProxyContext = warmupModule.warmupProxyContext;
  });

  describe('warmupProxyContext', () => {
    test('returns true when PROXY_WARMUP_ENABLED is false', async () => {
      process.env.PROXY_WARMUP_ENABLED = 'false';
      jest.resetModules();

      const { warmupProxyContext: freshWarmup } = require('../../src/module/warmupProxy');

      const mockPage = { goto: jest.fn() };
      const proxy = { host: 'proxy.example.com', port: 8080 };

      const result = await freshWarmup(mockPage, proxy);

      expect(result).toBe(true);
      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    test('returns true for null proxy', async () => {
      const mockPage = { goto: jest.fn() };

      const result = await warmupProxyContext(mockPage, null);

      expect(result).toBe(true);
      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    test('returns true for undefined proxy', async () => {
      const mockPage = { goto: jest.fn() };

      const result = await warmupProxyContext(mockPage, undefined);

      expect(result).toBe(true);
      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    test('returns true for proxy without host', async () => {
      const mockPage = { goto: jest.fn() };

      const result = await warmupProxyContext(mockPage, { port: 8080 });

      expect(result).toBe(true);
      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    test('skips warmup if proxy already in cache', async () => {
      const proxy = { host: 'cached.example.com', port: 8080 };
      proxyCache.setWarmedUp(proxy, true);

      const mockPage = { goto: jest.fn() };

      const result = await warmupProxyContext(mockPage, proxy);

      expect(result).toBe(true);
      expect(mockPage.goto).not.toHaveBeenCalled();
    });

    test('visits warmup sites through proxy', async () => {
      const proxy = { host: 'new.example.com', port: 8080 };
      const visitedSites = [];

      const mockPage = {
        goto: jest.fn().mockImplementation((url) => {
          visitedSites.push(url);
          return Promise.resolve();
        })
      };

      await warmupProxyContext(mockPage, proxy);

      expect(visitedSites.length).toBe(3);
      expect(visitedSites).toContain('https://www.instagram.com/');
      expect(visitedSites).toContain('https://www.google.com/');
      expect(visitedSites).toContain('https://www.x.com/');
    });

    test('updates cache after successful warmup', async () => {
      const proxy = { host: 'success.example.com', port: 8080 };

      const mockPage = {
        goto: jest.fn().mockResolvedValue()
      };

      await warmupProxyContext(mockPage, proxy);

      expect(proxyCache.isWarmedUp(proxy)).toBe(true);
    });

    test('updates cache with failure after failed warmup', async () => {
      const proxy = { host: 'failure.example.com', port: 8080 };

      const mockPage = {
        goto: jest.fn().mockRejectedValue(new Error('Proxy error'))
      };

      await warmupProxyContext(mockPage, proxy);

      // Cache should be updated (even with failure)
      const stats = proxyCache.getStats();
      expect(stats.total).toBe(1);
    });

    test('handles partial failures', async () => {
      const proxy = { host: 'partial.example.com', port: 8080 };
      let callCount = 0;

      const mockPage = {
        goto: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.reject(new Error('Timeout'));
          }
          return Promise.resolve();
        })
      };

      const result = await warmupProxyContext(mockPage, proxy);

      expect(result).toBe(true); // At least some succeeded
      expect(proxyCache.isWarmedUp(proxy)).toBe(true);
    });

    test('returns false when all sites fail', async () => {
      const proxy = { host: 'allfail.example.com', port: 8080 };

      const mockPage = {
        goto: jest.fn().mockRejectedValue(new Error('Network error'))
      };

      const result = await warmupProxyContext(mockPage, proxy);

      expect(result).toBe(false);
    });
  });

  describe('withProxyWarmup', () => {
    test('calls action after warmup when proxy provided', async () => {
      const { withProxyWarmup } = require('../../src/module/warmupProxy');

      const proxy = { host: 'action.example.com', port: 8080 };
      const mockPage = {
        goto: jest.fn().mockResolvedValue()
      };

      const action = jest.fn().mockResolvedValue('action result');

      const result = await withProxyWarmup(mockPage, proxy, action);

      expect(action).toHaveBeenCalled();
      expect(result).toBe('action result');
    });

    test('calls action without warmup when no proxy', async () => {
      const { withProxyWarmup } = require('../../src/module/warmupProxy');

      const mockPage = {
        goto: jest.fn()
      };

      const action = jest.fn().mockResolvedValue('action result');

      await withProxyWarmup(mockPage, null, action);

      expect(mockPage.goto).not.toHaveBeenCalled();
      expect(action).toHaveBeenCalled();
    });
  });
});
