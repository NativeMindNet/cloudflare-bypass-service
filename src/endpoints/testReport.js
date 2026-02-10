/**
 * Test Report Endpoint
 *
 * Returns the latest Cloudflare test results for monitoring warmup effectiveness.
 */

const fs = require('fs');
const path = require('path');

/**
 * GET /test-report
 *
 * Response:
 * - lastRun: ISO timestamp of last test run
 * - strategies: object with success rates per warmup strategy
 * - recommendation: recommended strategy based on results
 * - cfBehaviorChange: boolean indicating if CF behavior changed
 *
 * If no results available, returns { lastRun: null, message: "..." }
 */
function testReport(req, res) {
  const reportPath = path.join(__dirname, '../../tests/cloudflare/results.json');

  if (!fs.existsSync(reportPath)) {
    return res.json({
      lastRun: null,
      message: 'No test results available. Run `npm run test:cloudflare` to generate.'
    });
  }

  try {
    const results = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    res.json(results);
  } catch (e) {
    res.status(500).json({
      lastRun: null,
      message: `Error reading test results: ${e.message}`
    });
  }
}

module.exports = testReport;
