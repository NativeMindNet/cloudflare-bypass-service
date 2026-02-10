/**
 * Cloudflare Test Targets
 *
 * Known Cloudflare-protected sites for testing warmup effectiveness.
 * Updated periodically based on monitoring.
 */

module.exports = {
  // Primary test targets (stable, maintained for testing)
  primary: {
    waf: 'https://nopecha.com/demo/cloudflare',      // CF WAF Challenge
    turnstile: 'https://turnstile.zeroclover.io/',   // Turnstile CAPTCHA
  },

  // Sites known to have CF protection
  protected: [
    'https://nopecha.com/demo/cloudflare',
    'https://nowsecure.nl/',
  ],

  // Sites with Turnstile (siteKey required for turnstile-min mode)
  turnstile: [
    {
      url: 'https://turnstile.zeroclover.io/',
      siteKey: '0x4AAAAAAAEwzhD6pyKkgXC0'
    }
  ],

  // Control sites (no CF) - for baseline comparison
  control: [
    'https://httpbin.org/html',
    'https://example.com/',
  ],

  // Bot detection indicators in page content
  botIndicators: [
    'attention required! | cloudflare',
    'sorry, you have been blocked',
    'just a moment...',
    'verify you are human',
    'enable cookies',
    'not authorized to view this website',
    'checking your browser',
    'ray id:',
  ],

  /**
   * Check if HTML content indicates bot detection/blocking
   * @param {string} html - Page HTML content
   * @returns {boolean} - True if blocked
   */
  isBlocked(html) {
    if (!html) return true;
    const lower = html.toLowerCase();
    return this.botIndicators.some(indicator => lower.includes(indicator));
  }
};
