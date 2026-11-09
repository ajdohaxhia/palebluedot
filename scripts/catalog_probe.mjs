import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:5173/tests/catalog-test.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__CATALOG_RESULT, null, { timeout: 60000 });
console.log(JSON.stringify(await page.evaluate(() => window.__CATALOG_RESULT), null, 2));
await browser.close();
