# Cloudflare Live Tests

These tests verify the warmup system against real Cloudflare-protected sites.

## Test Categories

### 1. No Warmup Baseline (`no-warmup.test.js`)
Tests without any warmup to establish baseline success rates.
- Disables both browser and proxy warmup
- Records success/failure rates for comparison

### 2. Browser Warmup (`browser-warmup.test.js`)
Tests with browser-level warmup only.
- Enables browser warmup on startup
- Disables proxy-specific warmup
- Should show improved success rates over baseline

### 3. Full Warmup (`proxy-warmup.test.js`)
Tests with both browser and proxy warmup.
- Enables browser warmup
- Enables proxy warmup (requires test proxies)
- Should show best success rates

## Test Targets

| Site | Type | Purpose |
|------|------|---------|
| nopecha.com/demo/cloudflare | WAF | Tests WAF challenge bypass |
| turnstile.zeroclover.io | Turnstile | Tests Turnstile token generation |
| example.com | Control | Baseline (no CF protection) |

## Running Tests

```bash
# Run all CF tests
npm run test:cloudflare

# Generate comparison report
npm run test:cloudflare:report

# Run behavior monitoring (for CI/cron)
npm run monitor:cloudflare
```

## Environment Variables

For proxy tests, set `TEST_PROXIES` environment variable:

```bash
TEST_PROXIES="host1:port1,host2:port2:user:pass"
```

## Results

Results are saved to `tests/cloudflare/results.json` and exposed via the `/test-report` API endpoint.

## Interpreting Results

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| Success Rate | >90% | 70-90% | <70% |
| Blocked Rate | <10% | 10-30% | >30% |

## Troubleshooting

### Tests Failing
1. Check if target sites are accessible
2. Verify warmup sites are reachable
3. Check proxy connectivity (if using proxies)
4. Review Cloudflare may have updated detection

### Low Success Rates
1. Increase warmup delay times
2. Add more warmup sites
3. Check browser fingerprint configuration
4. Review recent Cloudflare updates
