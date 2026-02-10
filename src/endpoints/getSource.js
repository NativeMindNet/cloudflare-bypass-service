function getSource({ url, proxy }) {
  return new Promise(async (resolve, reject) => {
    if (!url) return reject("Missing url parameter");
    const context = await global.browser
      .createBrowserContext({
        proxyServer: proxy ? `http://${proxy.host}:${proxy.port}` : undefined, // https://pptr.dev/api/puppeteer.browsercontextoptions
      })
      .catch(() => null);
    if (!context) return reject("Failed to create browser context");

    let isResolved = false;

    var cl = setTimeout(async () => {
      if (!isResolved) {
        await context.close();
        reject("Timeout Error");
      }
    }, global.timeOut || 60000);

    try {
      const page = await context.newPage();

      if (proxy?.username && proxy?.password)
        await page.authenticate({
          username: proxy.username,
          password: proxy.password,
        });

      await page.setRequestInterception(true);
      page.on("request", async (request) => request.continue());
      page.on("response", async (res) => {
        try {
          if (
            [200, 302].includes(res.status()) &&
            [url, url + "/"].includes(res.url())
          ) {
            await page
              .waitForNavigation({ waitUntil: "load", timeout: 5000 })
              .catch(() => {});
            const html = await page.content();
            await context.close();
            isResolved = true;
            clearInterval(cl);
            resolve(html);
          }
        } catch (e) {}
      });
      await page.goto(url, {
        waitUntil: "domcontentloaded",
      });
    } catch (e) {
      if (!isResolved) {
        await context.close();
        clearInterval(cl);
        reject(e.message);
      }
    }
  });
}
module.exports = getSource;
