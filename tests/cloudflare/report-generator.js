#!/usr/bin/env node

/**
 * Cloudflare Test Report Generator
 *
 * Generates a comparison report of warmup strategies.
 *
 * Usage:
 *   node report-generator.js
 *   npm run test:cloudflare:report
 */

const fs = require('fs');
const path = require('path');
const reporter = require('./reporter');
const BehaviorMonitor = require('./behavior-monitor');

const REPORT_FILE = path.join(__dirname, 'REPORT.md');

function generateReport() {
  console.log('[Report] Generating Cloudflare test report...');

  const results = reporter.loadPrevious();

  if (!results) {
    console.log('[Report] No test results found.');
    console.log('[Report] Run `npm run test:cloudflare` first.');
    return;
  }

  let report = '# Cloudflare Warmup Strategy Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Last Test Run: ${results.lastRun}\n\n`;

  // Summary table
  report += '## Strategy Comparison\n\n';
  report += '| Strategy | Success Rate | Blocked Rate | Avg Duration | Tests |\n';
  report += '|----------|--------------|--------------|--------------|-------|\n';

  const strategies = results.strategies || {};
  const ordered = ['full-warmup', 'browser-warmup', 'no-warmup'];

  for (const name of ordered) {
    const stats = strategies[name];
    if (stats) {
      const successPct = (stats.successRate * 100).toFixed(1);
      const blockedPct = (stats.blockedRate * 100).toFixed(1);

      report += `| ${name} | ${successPct}% | ${blockedPct}% | ${stats.avgDuration}ms | ${stats.total} |\n`;
    }
  }

  // Add any other strategies not in the ordered list
  for (const [name, stats] of Object.entries(strategies)) {
    if (!ordered.includes(name)) {
      const successPct = (stats.successRate * 100).toFixed(1);
      const blockedPct = (stats.blockedRate * 100).toFixed(1);

      report += `| ${name} | ${successPct}% | ${blockedPct}% | ${stats.avgDuration}ms | ${stats.total} |\n`;
    }
  }

  report += '\n';

  // Recommendation
  report += '## Recommendation\n\n';
  report += `**Best Strategy:** ${results.recommendation}\n\n`;

  // Analysis
  const fullWarmup = strategies['full-warmup'];
  const noWarmup = strategies['no-warmup'];

  if (fullWarmup && noWarmup) {
    const improvement = fullWarmup.successRate - noWarmup.successRate;
    const improvementPct = (improvement * 100).toFixed(1);

    if (improvement > 0) {
      report += `Full warmup shows **${improvementPct}%** improvement over baseline.\n\n`;
    } else if (improvement < 0) {
      report += `⚠️ Warmup is showing lower success than baseline. Investigate CF changes.\n\n`;
    } else {
      report += `No significant difference detected between warmup and baseline.\n\n`;
    }
  }

  // Behavior change indicator
  report += '## Cloudflare Behavior\n\n';
  if (results.cfBehaviorChange) {
    report += '⚠️ **Behavior Change Detected**\n\n';
    report += 'Cloudflare may have updated their detection methods. Review recent changes.\n\n';
  } else {
    report += '✓ No significant behavior changes detected.\n\n';
  }

  // Historical context
  const monitor = new BehaviorMonitor();
  const historicalReport = monitor.generateReport();

  report += '---\n\n';
  report += historicalReport;

  // Write report
  fs.writeFileSync(REPORT_FILE, report);
  console.log(`[Report] Saved to ${REPORT_FILE}`);

  // Also print to console
  console.log('\n' + '='.repeat(60));
  console.log(report);

  return report;
}

// Run if called directly
if (require.main === module) {
  generateReport();
}

module.exports = generateReport;
