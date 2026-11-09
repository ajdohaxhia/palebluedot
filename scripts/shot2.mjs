import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:5173/';
const out = process.argv[3] || 'screenshots/02-earth.png';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox','--no-sandbox','--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const issues = [];
page.on('console', m => { if (m.type() === 'error') issues.push(`[error] ${m.text()}`); });
page.on('pageerror', e => issues.push(`[pageerror] ${e.message}`));
page.on('requestfailed', r => { if (!r.url().includes('favicon')) issues.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`); });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(12000);
const state = await page.evaluate(() => {
  const e = window.EON;
  return {
    ready: e?.ready, catalogsReady: e?.catalogsReady, loadingHidden: document.querySelector('#loading-screen')?.classList.contains('is-hidden'),
    loadingPercent: document.querySelector('#loading-percent')?.textContent,
    fps: Math.round(e?.engine?.fps || 0), frames: e?.engine?.frameCount,
    inspectorOpen: document.querySelector('#inspector')?.classList.contains('is-open'),
    cameraDistance: e?.earth?.rig?.distance,
    scaleValue: document.querySelector('#scale-value')?.textContent,
    scaleCaption: document.querySelector('#scale-caption')?.textContent,
    percent: document.querySelector('#loading-percent')?.textContent,
    errors: e?.__errors,
  };
});
console.log(JSON.stringify({ state, issues }, null, 2));
await page.screenshot({ path: out });
await browser.close();
