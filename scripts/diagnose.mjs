import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--disable-gpu-sandbox','--no-sandbox','--force-device-scale-factor=1'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('console', m => console.log('CONSOLE', m.type(), m.text()));
page.on('pageerror', e => console.log('PAGEERROR', e.message, '\nSTACK:', e.stack));
page.on('requestfailed', r => console.log('REQFAIL', r.url(), r.failure()?.errorText));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
console.log('STATE', await page.evaluate(() => ({
  loading: document.querySelector('#loading-status')?.textContent,
  percent: document.querySelector('#loading-percent')?.textContent,
  ready: window.EON?.ready,
  error: document.querySelector('#loading-error')?.textContent,
  textures: [...document.querySelectorAll('#loading-screen')].length,
  searchReady: !!window.EON?.catalogsReady,
  earthReady: !!window.EON?.earth?.ready,
})));
await browser.close();
