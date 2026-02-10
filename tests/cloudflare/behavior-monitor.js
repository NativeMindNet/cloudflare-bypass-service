#!/usr/bin/env node

/**
 * Cloudflare Behavior Monitor
 *
 * Monitors Cloudflare behavior changes over time.
 * Run periodically (e.g., via cron) to detect when CF updates detection methods.
 *
 * Usage:
 *   node behavior-monitor.js
 *   npm run monitor:cloudflare
 */

const fs = require('fs');
const path = require('path');
const reporter = require('./reporter');

const HISTORY_FILE = path.join(__dirname, 'behavior-history.json');
const ALERT_THRESHOLD = 0.1; // Alert if success rate drops by more than 10%

class BehaviorMonitor {
  constructor() {
    this.history = this.loadHistory();
  }

  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      }
    } catch (e) {
      console.warn('[Monitor] Could not load history:', e.message);
    }
    return [];
  }

  saveHistory() {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2));
    } catch (e) {
      console.error('[Monitor] Could not save history:', e.message);
    }
  }

  /**
   * Run daily behavior check
   */
  async runCheck() {
    const today = new Date().toISOString().split('T')[0];

    console.log(`[Monitor] Running behavior check for ${today}...`);

    // Load latest test results
    const previousReport = reporter.loadPrevious();

    if (!previousReport) {
      console.log('[Monitor] No previous test results found.');
      console.log('[Monitor] Run `npm run test:cloudflare` first to generate results.');
      return null;
    }

    const entry = {
      date: today,
      timestamp: new Date().toISOString(),
      strategies: previousReport.strategies,
      recommendation: previousReport.recommendation
    };

    // Compare with previous entry
    const previousEntry = this.history[this.history.length - 1];

    if (previousEntry && previousEntry.strategies) {
      const alerts = this.compareEntries(previousEntry, entry);

      if (alerts.length > 0) {
        console.log('\n⚠️  ALERTS:');
        for (const alert of alerts) {
          console.log(`   ${alert}`);
        }
        entry.alerts = alerts;
        entry.cfBehaviorChange = true;
      } else {
        console.log('\n✓ No significant behavior changes detected.');
        entry.cfBehaviorChange = false;
      }
    } else {
      console.log('[Monitor] No previous entry to compare with.');
    }

    // Add to history
    this.history.push(entry);

    // Keep last 90 days of history
    if (this.history.length > 90) {
      this.history = this.history.slice(-90);
    }

    this.saveHistory();
    this.printSummary(entry);

    return entry;
  }

  /**
   * Compare two entries and return alerts
   */
  compareEntries(previous, current) {
    const alerts = [];

    for (const [strategy, currentStats] of Object.entries(current.strategies || {})) {
      const prevStats = previous.strategies?.[strategy];

      if (prevStats) {
        const delta = currentStats.successRate - prevStats.successRate;

        if (delta < -ALERT_THRESHOLD) {
          alerts.push(
            `${strategy}: Success rate dropped from ${(prevStats.successRate * 100).toFixed(1)}% ` +
            `to ${(currentStats.successRate * 100).toFixed(1)}% (Δ ${(delta * 100).toFixed(1)}%)`
          );
        }
      }
    }

    return alerts;
  }

  printSummary(entry) {
    console.log('\n📊 Summary:');
    console.log('─'.repeat(60));

    for (const [strategy, stats] of Object.entries(entry.strategies || {})) {
      console.log(
        `${strategy.padEnd(20)} | ` +
        `Success: ${(stats.successRate * 100).toFixed(1).padStart(5)}% | ` +
        `Blocked: ${(stats.blockedRate * 100).toFixed(1).padStart(5)}% | ` +
        `Avg: ${String(stats.avgDuration).padStart(5)}ms`
      );
    }

    console.log('─'.repeat(60));
    console.log(`Recommendation: ${entry.recommendation}`);
  }

  /**
   * Generate markdown report
   */
  generateReport() {
    let report = '# Cloudflare Behavior Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Current status
    const latest = this.history[this.history.length - 1];
    if (latest) {
      report += '## Current Status\n\n';
      report += `Date: ${latest.date}\n`;
      report += `Behavior Change Detected: ${latest.cfBehaviorChange ? '⚠️ YES' : '✓ No'}\n\n`;

      report += '| Strategy | Success Rate | Blocked Rate | Avg Duration |\n';
      report += '|----------|--------------|--------------|-------------|\n';

      for (const [strategy, stats] of Object.entries(latest.strategies || {})) {
        report += `| ${strategy} | ${(stats.successRate * 100).toFixed(1)}% | ${(stats.blockedRate * 100).toFixed(1)}% | ${stats.avgDuration}ms |\n`;
      }

      report += `\n**Recommendation:** ${latest.recommendation}\n\n`;
    }

    // Historical trend
    if (this.history.length > 1) {
      report += '## Historical Trend (Last 7 Days)\n\n';
      report += '| Date | Full Warmup Success | Browser Warmup Success | No Warmup Success |\n';
      report += '|------|---------------------|----------------------|------------------|\n';

      const recent = this.history.slice(-7);
      for (const entry of recent) {
        const full = entry.strategies?.['full-warmup']?.successRate ?? '-';
        const browser = entry.strategies?.['browser-warmup']?.successRate ?? '-';
        const none = entry.strategies?.['no-warmup']?.successRate ?? '-';

        report += `| ${entry.date} | ${full !== '-' ? (full * 100).toFixed(1) + '%' : '-'} | `;
        report += `${browser !== '-' ? (browser * 100).toFixed(1) + '%' : '-'} | `;
        report += `${none !== '-' ? (none * 100).toFixed(1) + '%' : '-'} |\n`;
      }
    }

    return report;
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new BehaviorMonitor();
  monitor.runCheck().then(() => {
    console.log('\n[Monitor] Check complete.');
  }).catch(e => {
    console.error('[Monitor] Error:', e);
    process.exit(1);
  });
}

module.exports = BehaviorMonitor;
