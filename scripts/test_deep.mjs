import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
const issues = [];
page.on('console', m => { if (m.type()==='error' && !m.text().includes('GL Driver')) issues.push(m.text()); });
page.on('pageerror', e => issues.push('PAGEERROR '+e.message));
await page.goto('http://127.0.0.1:5173/?quality=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.EON?.catalogsReady, null, { timeout: 90000 }).catch(()=>{});
await page.waitForTimeout(9000);
console.log('preload', await page.evaluate(() => ({ deep: !!EON.deep, promise: !!EON.deepPromise, domain: EON.domain })));
// Star search
await page.click('#search-input'); await page.fill('#search-input','Sirius'); await page.waitForTimeout(600);
console.log('results', await page.$$eval('.search-result', els => els.slice(0,3).map(e=>e.textContent.trim())));
await page.keyboard.press('Enter');
await page.waitForTimeout(12000);
const state = await page.evaluate(() => ({
  domain: EON.domain, deepReady: !!EON.deep?.ready, focusLevel: EON.deep?.focusLevel,
  rigDist: EON.deep?.rig?.distance, camera: EON.deep?.camera?.position?.toArray(),
  selection: EON.selection, inspector: document.querySelector('#object-name')?.textContent,
  crumbs: document.querySelector('#breadcrumbs')?.textContent.replace(/\s+/g,' ').trim(),
  telemetry: { keys:[...document.querySelectorAll('#telemetry-lines .telemetry-key')].map(e=>e.textContent), vals:[document.querySelector('#tel-lat')?.textContent, document.querySelector('#tel-lon')?.textContent, document.querySelector('#tel-alt')?.textContent, document.querySelector('#tel-sun')?.textContent] },
  labels: EON.deep?.labels?.items?.filter(i=>i.el.style.display !== 'none' && i.el.offsetParent !== null).map(i=>i.id).slice(0,20),
  starFade: EON.deep?._starFade, galaxyFade: EON.deep?._galaxyFade,
  fps: EON.engine?.fps,
}));
console.log(JSON.stringify({ state, issues }, null, 2));
await page.screenshot({ path: 'screenshots/10-deep-sirius.png' });
// Focus Milky Way via scale and inspect
await page.evaluate(() => { EON.deep.resetView(); });
await page.waitForTimeout(1200);
await page.evaluate(() => { EON.deep.focusMilkyWay(); });
await page.waitForTimeout(5000);
console.log('milkyway', await page.evaluate(() => ({
  dist: EON.deep.rig.distance, labels: EON.deep.labels.items.filter(i=>i.el.style.display!=='none').map(i=>i.id).slice(0,15),
  mwOpacity: EON.deep.mwMaterial.uniforms.uOpacity.value, galaxyFade: EON.deep._galaxyFade,
})));
await page.screenshot({ path: 'screenshots/11-deep-milkyway.png' });
// Cosmic web
await page.evaluate(() => { EON.deep.focusWeb(); });
await page.waitForTimeout(5000);
console.log('web', await page.evaluate(() => ({
  dist: EON.deep.rig.distance, labels: EON.deep.labels.items.filter(i=>i.el.style.display!=='none').map(i=>i.id).slice(0,20),
  sdssOpacity: EON.deep.sdssLayer?.material?.uniforms?.uOpacity?.value, cosmicFade: EON.deep._cosmicFade,
  scale: document.querySelector('#scale-value')?.textContent, caption: document.querySelector('#scale-caption')?.textContent,
})));
await page.screenshot({ path: 'screenshots/12-deep-web.png' });
// Observable
await page.evaluate(() => { EON.deep.focusObservable(); });
await page.waitForTimeout(4000);
await page.screenshot({ path: 'screenshots/13-deep-observable.png' });
console.log('observable', await page.evaluate(() => ({ dist: EON.deep.rig.distance, horizon: EON.deep.horizon.visible, hOp: EON.deep.horizonMaterial.uniforms.uOpacity.value })));
console.log('issues', issues);
await browser.close();
