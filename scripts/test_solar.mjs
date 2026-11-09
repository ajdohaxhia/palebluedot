import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox','--no-sandbox','--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const issues = [];
page.on('console', m => { if (['error','warning'].includes(m.type()) && !m.text().includes('GL Driver')) issues.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => issues.push(`[pageerror] ${e.message}`));
page.on('requestfailed', r => { if (!r.url().includes('favicon')) issues.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`); });
await page.goto('http://127.0.0.1:5173/?quality=balanced', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.EON?.catalogsReady, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);
console.log('initial', await page.evaluate(() => ({ ready: EON.ready, cats: EON.catalogsReady, domain: EON.domain })));
// Search Saturn
await page.click('#search-input');
await page.fill('#search-input', 'Saturn');
await page.waitForTimeout(800);
const results = await page.$$eval('.search-result', els => els.slice(0, 5).map(e => e.textContent.trim()));
console.log('results', results);
await page.keyboard.press('Enter');
await page.waitForTimeout(9000);
const state = await page.evaluate(() => ({
  domain: EON.domain,
  solarReady: !!EON.solar?.ready,
  solarPromise: !!EON.solarPromise,
  focus: EON.solar?.focusId,
  rigDistance: EON.solar?.rig?.distance,
  selection: EON.selection,
  inspectorName: document.querySelector('#object-name')?.textContent,
  loading: document.querySelector('#loading-screen')?.className,
  toast: document.querySelector('#toast')?.textContent,
  toastHidden: document.querySelector('#toast')?.hidden,
  camera: EON.camera?.position?.toArray(),
  canvas: [document.querySelector('#scene-canvas')?.width, document.querySelector('#scene-canvas')?.height],
  buttons: [...document.querySelectorAll('[data-camera]')].map(b => [b.dataset.camera, b.className]),
}));
console.log(JSON.stringify({ state, issues }, null, 2));
await page.screenshot({ path: 'screenshots/04-solar-saturn.png' });
// Now reset to system overview
await page.click('#reset-view');
await page.waitForTimeout(4000);
console.log('overview', await page.evaluate(() => ({
  domain: EON.domain, focus: EON.solar?.focusId, dist: EON.solar?.rig?.distance,
  breadth: EON.solar?.labels?.items?.filter(i => i.el.style.display !== 'none').map(i => i.id).slice(0, 20),
  telemetry: { title: document.querySelector('#telemetry-title')?.textContent, lat: document.querySelector('#tel-lat')?.textContent, lon: document.querySelector('#tel-lon')?.textContent, extra: document.querySelector('#tel-extra')?.textContent },
  scale: document.querySelector('#scale-value')?.textContent, caption: document.querySelector('#scale-caption')?.textContent,
})));
await page.screenshot({ path: 'screenshots/05-solar-overview.png' });
await browser.close();
