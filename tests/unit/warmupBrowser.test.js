/**
 * Unit Tests: warmupBrowser
 */

describe('warmupBrowser', () => {
  let warmupBrowserModule;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.WARMUP_SITES;
    global.browserWarmedUp = false;
  });

  describe('DEFAULT_WARMUP_SITES', () => {
    test('contains expected default sites', () => {
      const { DEFAULT_WARMUP_SITES } = require('../../src/module/warmupBrowser');

      expect(DEFAULT_WARMUP_SITES).toContain('https://www.instagram.com/');
      expect(DEFAULT_WARMUP_SITES).toContain('https://www.google.com/');
      expect(DEFAULT_WARMUP_SITES).toContain('https://www.x.com/');
      expect(DEFAULT_WARMUP_SITES.length).toBe(3);
    });
  });

  describe('warmupBrowserHistory', () => {
    test('uses default sites when WARMUP_SITES env is empty', async () => {
      const { warmupBrowserHistory, DEFAULT_WARMUP_SITES } = require('../../src/module/warmupBrowser');

      const visitedSites = [];
      const mockPage = {
        goto: jest.fn().mockImplementation((url) => {
          visitedSites.push(url);
          return Promise.resolve();
        }),
        close: jest.fn().mockResolvedValue()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      await warmupBrowserHistory(mockBrowser);

      expect(visitedSites).toEqual(DEFAULT_WARMUP_SITES);
    });

    test('parses WARMUP_SITES env variable', async () => {
      process.env.WARMUP_SITES = 'example.com,test.org';

      jest.resetModules();
      const { warmupBrowserHistory } = require('../../src/module/warmupBrowser');

      const visitedSites = [];
      const mockPage = {
        goto: jest.fn().mockImplementation((url) => {
          visitedSites.push(url);
          return Promise.resolve();
        }),
        close: jest.fn().mockResolvedValue()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      await warmupBrowserHistory(mockBrowser);

      expect(visitedSites).toContain('https://example.com/');
      expect(visitedSites).toContain('https://test.org/');
    });

    test('adds https:// to bare domains', async () => {
      process.env.WARMUP_SITES = 'bare-domain.com';

      jest.resetModules();
      const { warmupBrowserHistory } = require('../../src/module/warmupBrowser');

      const visitedSites = [];
      const mockPage = {
        goto: jest.fn().mockImplementation((url) => {
          visitedSites.push(url);
          return Promise.resolve();
        }),
        close: jest.fn().mockResolvedValue()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      await warmupBrowserHistory(mockBrowser);

      expect(visitedSites[0]).toBe('https://bare-domain.com/');
    });

    test('preserves URLs that already have http/https', async () => {
      process.env.WARMUP_SITES = 'http://insecure.com,https://secure.com';

      jest.resetModules();
      const { warmupBrowserHistory } = require('../../src/module/warmupBrowser');

      const visitedSites = [];
      const mockPage = {
        goto: jest.fn().mockImplementation((url) => {
          visitedSites.push(url);
          return Promise.resolve();
        }),
        close: jest.fn().mockResolvedValue()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      await warmupBrowserHistory(mockBrowser);

      expect(visitedSites).toContain('http://insecure.com');
      expect(visitedSites).toContain('https://secure.com');
    });

    test('continues on individual site failure', async () => {
      const { warmupBrowserHistory } = require('../../src/module/warmupBrowser');

      let callCount = 0;
      const mockPage = {
        goto: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve();
        }),
        close: jest.fn().mockResolvedValue()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      const result = await warmupBrowserHistory(mockBrowser);

      // Should still return true because some sites succeeded
      expect(result).toBe(true);
      expect(mockPage.goto).toHaveBeenCalledTimes(3);
    });

    test('returns true if at least one site succeeds', async () => {
      const { warmupBrowserHistory } = require('../../src/module/warmupBrowser');

      let callCount = 0;
      const mockPage = {
        goto: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve();
        }),
        close: jest.fn().mockResolvedValue()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      const result = await warmupBrowserHistory(mockBrowser);

      expect(result).toBe(true);
    });

    test('returns false if all sites fail', async () => {
      const { warmupBrowserHistory } = require('../../src/module/warmupBrowser');

      const mockPage = {
        goto: jest.fn().mockRejectedValue(new Error('Network error')),
        close: jest.fn().mockResolvedValue()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      const result = await warmupBrowserHistory(mockBrowser);

      expect(result).toBe(false);
    });

    test('sets global.browserWarmedUp flag', async () => {
      const { warmupBrowserHistory } = require('../../src/module/warmupBrowser');

      const mockPage = {
        goto: jest.fn().mockResolvedValue(),
        close: jest.fn().mockResolvedValue()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      await warmupBrowserHistory(mockBrowser);

      expect(global.browserWarmedUp).toBe(true);
    });

    test('closes page after warmup', async () => {
      const { warmupBrowserHistory } = require('../../src/module/warmupBrowser');

      const mockPage = {
        goto: jest.fn().mockResolvedValue(),
        close: jest.fn().mockResolvedValue()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      await warmupBrowserHistory(mockBrowser);

      expect(mockPage.close).toHaveBeenCalled();
    });
  });
});
