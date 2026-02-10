/**
 * Unit Tests: ProxyCache
 */

describe('ProxyCache', () => {
  let proxyCache;

  beforeEach(() => {
    // Clear module cache to get fresh instance
    jest.resetModules();
    process.env.PROXY_WARMUP_TTL = '3600000';
    proxyCache = require('../../src/module/proxyCache');
    proxyCache.clear();
  });

  describe('getKey', () => {
    test('returns null for undefined proxy', () => {
      expect(proxyCache.getKey(undefined)).toBeNull();
    });

    test('returns null for null proxy', () => {
      expect(proxyCache.getKey(null)).toBeNull();
    });

    test('returns null for proxy without host', () => {
      expect(proxyCache.getKey({ port: 8080 })).toBeNull();
    });

    test('returns null for proxy without port', () => {
      expect(proxyCache.getKey({ host: 'proxy.example.com' })).toBeNull();
    });

    test('generates correct key for basic proxy', () => {
      const proxy = { host: 'proxy.example.com', port: 8080 };
      expect(proxyCache.getKey(proxy)).toBe('proxy.example.com:8080');
    });

    test('generates correct key for proxy with auth', () => {
      const proxy = {
        host: 'proxy.example.com',
        port: 8080,
        username: 'user1',
        password: 'pass1'
      };
      expect(proxyCache.getKey(proxy)).toBe('proxy.example.com:8080:user1');
    });
  });

  describe('isWarmedUp', () => {
    test('returns true for no proxy (null)', () => {
      expect(proxyCache.isWarmedUp(null)).toBe(true);
    });

    test('returns true for undefined proxy', () => {
      expect(proxyCache.isWarmedUp(undefined)).toBe(true);
    });

    test('returns false for unknown proxy', () => {
      const proxy = { host: 'unknown.example.com', port: 8080 };
      expect(proxyCache.isWarmedUp(proxy)).toBe(false);
    });

    test('returns true for warmed up proxy', () => {
      const proxy = { host: 'warmed.example.com', port: 8080 };
      proxyCache.setWarmedUp(proxy, true);
      expect(proxyCache.isWarmedUp(proxy)).toBe(true);
    });

    test('returns false for failed warmup', () => {
      const proxy = { host: 'failed.example.com', port: 8080 };
      proxyCache.setWarmedUp(proxy, false);
      expect(proxyCache.isWarmedUp(proxy)).toBe(false);
    });
  });

  describe('TTL expiration', () => {
    test('expires entries after TTL', () => {
      jest.resetModules();
      process.env.PROXY_WARMUP_TTL = '100'; // 100ms TTL
      const freshCache = require('../../src/module/proxyCache');
      freshCache.clear();

      const proxy = { host: 'expiring.example.com', port: 8080 };
      freshCache.setWarmedUp(proxy, true);

      expect(freshCache.isWarmedUp(proxy)).toBe(true);

      // Wait for TTL to expire
      return new Promise(resolve => {
        setTimeout(() => {
          expect(freshCache.isWarmedUp(proxy)).toBe(false);
          resolve();
        }, 150);
      });
    });
  });

  describe('setWarmedUp', () => {
    test('tracks warmup attempts', () => {
      const proxy = { host: 'tracked.example.com', port: 8080 };

      proxyCache.setWarmedUp(proxy, true);
      proxyCache.setWarmedUp(proxy, true);
      proxyCache.setWarmedUp(proxy, false);

      const stats = proxyCache.getStats();
      expect(stats.total).toBe(1);
    });

    test('ignores invalid proxy', () => {
      proxyCache.setWarmedUp(null, true);
      proxyCache.setWarmedUp(undefined, true);
      proxyCache.setWarmedUp({}, true);

      const stats = proxyCache.getStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('getStats', () => {
    test('returns correct counts', () => {
      proxyCache.setWarmedUp({ host: 'a.com', port: 80 }, true);
      proxyCache.setWarmedUp({ host: 'b.com', port: 80 }, true);
      proxyCache.setWarmedUp({ host: 'c.com', port: 80 }, false);

      const stats = proxyCache.getStats();
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.expired).toBe(0);
    });

    test('returns empty stats for empty cache', () => {
      const stats = proxyCache.getStats();
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.expired).toBe(0);
    });
  });

  describe('cleanup', () => {
    test('removes expired entries', async () => {
      jest.resetModules();
      process.env.PROXY_WARMUP_TTL = '50'; // 50ms TTL
      const freshCache = require('../../src/module/proxyCache');
      freshCache.clear();

      freshCache.setWarmedUp({ host: 'old.com', port: 80 }, true);

      await new Promise(r => setTimeout(r, 100)); // Wait for expiration

      freshCache.setWarmedUp({ host: 'new.com', port: 80 }, true);
      freshCache.cleanup();

      const stats = freshCache.getStats();
      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });
  });

  describe('clear', () => {
    test('removes all entries', () => {
      proxyCache.setWarmedUp({ host: 'a.com', port: 80 }, true);
      proxyCache.setWarmedUp({ host: 'b.com', port: 80 }, true);

      proxyCache.clear();

      const stats = proxyCache.getStats();
      expect(stats.total).toBe(0);
    });
  });
});
