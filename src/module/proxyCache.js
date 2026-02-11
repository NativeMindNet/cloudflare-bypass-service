/**
 * Proxy Cache Module
 *
 * Tracks which proxies have been warmed up to avoid redundant warmup.
 * Each proxy is cached with a TTL (default 1 hour).
 */

class ProxyCache {
  constructor() {
    this.cache = new Map();
    this.ttl = Number(process.env.PROXY_WARMUP_TTL) || 3600000; // 1 hour default
  }

  /**
   * Generate cache key from proxy config
   * Format: "host:port" or "host:port:username" if auth provided
   *
   * @param {Object} proxy - Proxy configuration {host, port, username?, password?}
   * @returns {string|null} - Cache key or null if no proxy
   */
  getKey(proxy) {
    if (!proxy || !proxy.host || !proxy.port) {
      return null;
    }

    const base = `${proxy.host}:${proxy.port}`;
    return proxy.username ? `${base}:${proxy.username}` : base;
  }

  /**
   * Check if proxy is warmed up and not expired
   *
   * @param {Object} proxy - Proxy configuration
   * @returns {boolean} - True if warmed up and valid
   */
  isWarmedUp(proxy) {
    const key = this.getKey(proxy);

    // No proxy = no warmup needed
    if (!key) {
      return true;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    const expired = Date.now() - entry.timestamp > this.ttl;

    if (expired) {
      this.cache.delete(key);
      return false;
    }

    return entry.success;
  }

  /**
   * Mark proxy as warmed up
   *
   * @param {Object} proxy - Proxy configuration
   * @param {boolean} success - Whether warmup was successful
   */
  setWarmedUp(proxy, success = true) {
    const key = this.getKey(proxy);

    if (!key) {
      return;
    }

    const existing = this.cache.get(key);

    this.cache.set(key, {
      timestamp: Date.now(),
      success,
      attempts: (existing?.attempts || 0) + 1
    });
  }

  /**
   * Get cache statistics for monitoring
   *
   * @returns {Object} - Stats {total, active, expired, failed}
   */
  getStats() {
    const now = Date.now();
    let active = 0;
    let expired = 0;
    let failed = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        expired++;
      } else if (entry.success) {
        active++;
      } else {
        failed++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      failed
    };
  }

  /**
   * Remove expired entries from cache
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[ProxyCache] Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
  }
}

// Singleton instance
const proxyCache = new ProxyCache();

// Cleanup every 10 minutes (unref to not block process exit)
const cleanupInterval = setInterval(() => proxyCache.cleanup(), 600000);
cleanupInterval.unref();

module.exports = proxyCache;
