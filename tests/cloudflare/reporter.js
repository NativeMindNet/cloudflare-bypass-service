/**
 * Cloudflare Test Reporter
 *
 * Collects and stores test results for comparison and monitoring.
 */

const fs = require('fs');
const path = require('path');

class CFTestReporter {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.resultsFile = path.join(__dirname, 'results.json');
  }

  /**
   * Record a test result
   * @param {Object} result - Test result data
   */
  record(result) {
    this.results.push({
      ...result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get summary statistics by test strategy
   * @returns {Object} - Summary stats
   */
  getSummary() {
    const byStrategy = {};

    for (const result of this.results) {
      const strategy = result.test || 'unknown';

      if (!byStrategy[strategy]) {
        byStrategy[strategy] = {
          total: 0,
          success: 0,
          blocked: 0,
          errors: 0,
          durations: []
        };
      }

      byStrategy[strategy].total++;
      if (result.success) {
        byStrategy[strategy].success++;
      }
      if (result.blocked) {
        byStrategy[strategy].blocked++;
      }
      if (result.error) {
        byStrategy[strategy].errors++;
      }
      if (result.duration) {
        byStrategy[strategy].durations.push(result.duration);
      }
    }

    // Calculate rates and averages
    const summary = {};
    for (const [strategy, stats] of Object.entries(byStrategy)) {
      summary[strategy] = {
        successRate: stats.total > 0 ? stats.success / stats.total : 0,
        blockedRate: stats.total > 0 ? stats.blocked / stats.total : 0,
        errorRate: stats.total > 0 ? stats.errors / stats.total : 0,
        avgDuration: stats.durations.length > 0
          ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
          : 0,
        total: stats.total
      };
    }

    return summary;
  }

  /**
   * Get recommendation based on results
   * @returns {string} - Recommended strategy
   */
  getRecommendation() {
    const summary = this.getSummary();

    let best = { strategy: 'fullWarmup', rate: 0 };

    for (const [strategy, stats] of Object.entries(summary)) {
      if (stats.successRate > best.rate) {
        best = { strategy, rate: stats.successRate };
      }
    }

    return best.strategy;
  }

  /**
   * Save results to file
   */
  save() {
    const report = {
      lastRun: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      strategies: this.getSummary(),
      recommendation: this.getRecommendation(),
      cfBehaviorChange: false, // Will be set by behavior monitor
      results: this.results
    };

    fs.writeFileSync(this.resultsFile, JSON.stringify(report, null, 2));
    console.log(`[Reporter] Saved ${this.results.length} results to ${this.resultsFile}`);

    return report;
  }

  /**
   * Load previous results for comparison
   * @returns {Object|null} - Previous results or null
   */
  loadPrevious() {
    try {
      if (fs.existsSync(this.resultsFile)) {
        return JSON.parse(fs.readFileSync(this.resultsFile, 'utf8'));
      }
    } catch (e) {
      console.warn('[Reporter] Could not load previous results:', e.message);
    }
    return null;
  }

  /**
   * Clear all results
   */
  clear() {
    this.results = [];
    this.startTime = Date.now();
  }
}

// Singleton instance
const reporter = new CFTestReporter();

module.exports = reporter;
