import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:5173/';
const out = process.argv[3] || 'screenshots/01-earth.png';
const wait = Number(process.argv[4] || 6000);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--disable-gpu-sandbox',
    '--no-sandbox',
    '--force-device-scale-factor=1',
  ],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const messages = [];
page.on('console', m => { if (['error','warning'].includes(m.type())) messages.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => messages.push(`[pageerror] ${e.message}`));
page.on('requestfailed', r => messages.push(`[requestfailed] ${r.url()} :: ${r.failure()?.errorText}`));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(wait);
const state = await page.evaluate(() => ({
  loadingHidden: document.querySelector('#loading-screen')?.classList.contains('is-hidden'),
  loadingText: document.querySelector('#loading-status')?.textContent,
  percent: document.querySelector('#loading-percent')?.textContent,
  fatal: document.querySelector('#loading-error')?.textContent,
  canvas: [document.querySelector('#scene-canvas')?.width, document.querySelector('#scene-canvas')?.height],
  webgl: (() => { try { return !!document.querySelector('#scene-canvas').getContext('webgl2'); } catch(e) { return false; } })(),
  dataChips: document.querySelector('#data-chips')?.textContent,
  inspectorOpen: document.querySelector('#inspector')?.classList.contains('is-open'),
  title: document.title,
  fps: document.querySelector('#status-fps')?.textContent,
}));
console.log(JSON.stringify({ state, messages }, null, 2));
await page.screenshot({ path: out, type: 'png' });
await browser.close();
