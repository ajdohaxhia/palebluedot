import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
page.on('console', m => console.log('CONSOLE', m.type(), m.text()));
page.on('pageerror', e => console.log('PAGEERROR', e.message, e.stack));
page.on('requestfailed', r => console.log('REQFAIL', r.url(), r.failure()?.errorText));
await page.goto('http://127.0.0.1:5173/?quality=low', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
console.log('state', await page.evaluate(() => ({
  eon: typeof window.EON, ready: window.EON?.ready, cats: window.EON?.catalogsReady,
  loading: document.querySelector('#loading-status')?.textContent,
  error: document.querySelector('#loading-error')?.textContent,
  earth: !!window.EON?.earth, solar: !!window.EON?.solar, deep: !!window.EON?.deep,
})));
await browser.close();
