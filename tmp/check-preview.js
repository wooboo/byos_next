const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox']});
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR', err.stack || err.message));
  page.on('requestfailed', req => console.log('REQFAILED', req.url(), req.failure()?.errorText));
  const res = await page.goto('http://localhost:3001/preview/recipe/simple-text?width=800&height=480', {waitUntil:'networkidle0', timeout:30000});
  console.log('STATUS', res.status());
  console.log('TITLE', await page.title());
  console.log('BODY', (await page.evaluate(() => document.body.innerText)).slice(0,500));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
