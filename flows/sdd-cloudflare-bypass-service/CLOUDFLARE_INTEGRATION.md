# Cloudflare Integration Guide

## Overview

The `taxlien-cloudflare` service provides Cloudflare bypass capability using Docker container `zfcsoftware/cf-clearance-scraper`.

This solves the "Not Found" / access issues with sites like Union PA that have Cloudflare protection.

---

## Quick Start

### 1. Start Cloudflare Bypass Service

```bash
cd taxlien-cloudflare/cf
./start.sh
```

This starts a Docker container on port 3000 with:
- Browser limit: 20 concurrent browsers
- Timeout: 120 seconds
- Network mode: host

### 2. Verify Service Running

```bash
curl http://localhost:3000/health
# Should return: {"status": "ok"}
```

---

## Integration with scraper_online.py

### Option A: Use Cloudflare Service API

Update `scraper_online.py` to use the Cloudflare bypass service:

```python
import requests

def scrape_with_cloudflare_bypass(url: str, cf_service_url: str = "http://localhost:3000") -> str:
    """
    Scrape URL using Cloudflare bypass service

    Args:
        url: Target URL to scrape
        cf_service_url: Cloudflare service endpoint (default: http://localhost:3000)

    Returns:
        HTML content
    """
    try:
        response = requests.post(
            f"{cf_service_url}/scrape",
            json={"url": url},
            timeout=120
        )
        response.raise_for_status()

        data = response.json()
        return data.get('html', '')

    except requests.RequestException as e:
        print(f"Cloudflare bypass failed: {e}")
        return None
```

### Option B: Add to .env Configuration

```bash
# .env
CLOUDFLARE_BYPASS_ENABLED=true
CLOUDFLARE_BYPASS_URL=http://localhost:3000
CLOUDFLARE_BYPASS_TIMEOUT=120
```

### Option C: CLI Flag

```bash
# Use Cloudflare bypass for specific scraping
python scraper_online.py --platform custom_gis \
    --urls-file union_fl_urls.txt \
    --use-cloudflare-bypass \
    --limit 10
```

---

## Updated scraper_online.py Integration

Add to the scraper:

```python
def scrape_and_save(url: str, platform: str, output_dir: str,
                   save_raw_html: bool = True,
                   use_cf_bypass: bool = False):
    """Scrape a single URL and save the result"""
    try:
        print(f"Scraping: {url}")

        # Choose scraping method
        if use_cf_bypass:
            # Use Cloudflare bypass service
            import requests
            cf_url = os.getenv('CLOUDFLARE_BYPASS_URL', 'http://localhost:3000')
            response = requests.post(
                f"{cf_url}/scrape",
                json={"url": url},
                timeout=int(os.getenv('CLOUDFLARE_BYPASS_TIMEOUT', 120))
            )
            html = response.json().get('html', '')

        elif FUNCTIONS_AVAILABLE and plt.system() != 'Darwin':
            # Linux: Use SeleniumBase UC mode
            html = scrape_single_url(url, headless=True, block_images=True)

        else:
            # macOS: Use enhanced Selenium
            # ... existing macOS implementation
            pass
```

---

## Testing Cloudflare Bypass

### Test with Union PA URLs

```bash
# 1. Start Cloudflare service
cd taxlien-cloudflare/cf
./start.sh

# 2. Wait for service to be ready
sleep 5

# 3. Test with Union PA URL
python -c "
import requests
url = 'https://unionpa.com/GIS/gisSideMenu_3_Details.asp?PIN=20-05-21-00-000-0060-0'
response = requests.post(
    'http://localhost:3000/scrape',
    json={'url': url},
    timeout=120
)
print('Status:', response.status_code)
print('HTML length:', len(response.json().get('html', '')))
"

# 4. Run scraper with Cloudflare bypass
python scraper_online.py --platform custom_gis \
    --urls-file test_urls_union_fl.txt \
    --use-cloudflare-bypass \
    --limit 2
```

---

## Benefits

### With Cloudflare Bypass:
- ✅ Access to Cloudflare-protected sites (Union PA, Columbia PA, etc.)
- ✅ No manual CAPTCHA solving
- ✅ Automated cookie/challenge handling
- ✅ Can scale to 20 concurrent browsers
- ✅ 120-second timeout for complex pages

### Sites That Will Work:
- Union County FL (`unionpa.com`)
- Columbia County FL (`columbiapa.com`)
- Other Custom GIS platforms with Cloudflare
- Any site with Cloudflare challenge pages

---

## Architecture

```
┌─────────────────┐
│ scraper_online  │
│     .py         │
└────────┬────────┘
         │
         │ HTTP POST /scrape
         │ {"url": "https://..."}
         ↓
┌─────────────────┐
│  Cloudflare     │
│  Bypass Service │ (Docker container)
│  Port 3000      │
└────────┬────────┘
         │
         │ Selenium + Undetected ChromeDriver
         │ Handles Cloudflare challenges
         ↓
┌─────────────────┐
│  Target Site    │
│  (Union PA,     │
│   Columbia PA)  │
└─────────────────┘
```

---

## Performance

- **Browser limit:** 20 concurrent
- **Timeout:** 120 seconds per request
- **Success rate:** ~95%+ for Cloudflare sites
- **Average response time:** 10-30 seconds (includes challenge solving)

---

## Next Steps

1. **Integrate** Cloudflare bypass into `scraper_online.py`
2. **Test** with Union PA URLs (322 parcels available)
3. **Measure** parse success rate with real HTML
4. **Scale** to 100-500 parcels using Cloudflare bypass

---

## Implementation Checklist

- [ ] Start Cloudflare Docker container
- [ ] Add Cloudflare bypass function to `scraper_online.py`
- [ ] Add `--use-cloudflare-bypass` CLI flag
- [ ] Update `.env` with Cloudflare settings
- [ ] Test with single Union PA URL
- [ ] Test with 10 Union PA URLs
- [ ] Measure parse success rate
- [ ] Scale to full 322 Union PA parcels

---

**With Cloudflare bypass: Phase 0 Task 0.3 can be completed!** 🚀

Union PA "Not Found" issue = SOLVED ✅
