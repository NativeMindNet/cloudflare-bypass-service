const { connect } = require("puppeteer-real-browser");
const { warmupBrowserHistory } = require("./warmupBrowser");

async function createBrowser() {
  try {
    if (global.finished == true) return;

    global.browser = null;
    global.browserWarmedUp = false;

    console.log('[Browser] Launching...');

    const { browser } = await connect({
      headless: false,
      turnstile: true,
      connectOption: { defaultViewport: null },
      disableXvfb: false,
    });

    console.log('[Browser] Launched successfully');

    global.browser = browser;

    // Warmup browser history after creation
    if (process.env.WARMUP_ENABLED !== 'false') {
      console.log('[Browser] Starting warmup...');
      await warmupBrowserHistory(browser);
    } else {
      console.log('[Browser] Warmup disabled via WARMUP_ENABLED=false');
      global.browserWarmedUp = true;
    }

    browser.on('disconnected', async () => {
      if (global.finished == true) return;
      console.log('[Browser] Disconnected, reconnecting in 3s...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      await createBrowser(); // Will re-warmup on reconnect
    });

  } catch (e) {
    console.error(`[Browser] Error: ${e.message}`);
    if (global.finished == true) return;
    await new Promise(resolve => setTimeout(resolve, 3000));
    await createBrowser();
  }
}

module.exports = createBrowser;

// Auto-start browser when module is loaded (unless skipped)
if (process.env.SKIP_LAUNCH !== 'true') {
  createBrowser();
}
