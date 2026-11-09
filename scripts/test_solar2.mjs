import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
const issues = [];
page.on('console', m => { if (m.type()==='error' && !m.text().includes('GL Driver')) issues.push(m.text()); });
page.on('pageerror', e => issues.push('PAGEERROR '+e.message));
await page.goto('http://127.0.0.1:5173/?quality=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.EON?.catalogsReady, null, { timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(5000);
console.log('preload', await page.evaluate(() => ({ solar: !!EON.solar, domain: EON.domain })));
await page.click('#search-input');
await page.fill('#search-input', 'Saturn');
await page.waitForTimeout(600);
await page.keyboard.press('Enter');
await page.waitForTimeout(7000);
console.log('after nav', await page.evaluate(() => ({
  domain: EON.domain, solar: !!EON.solar, focus: EON.solar?.focusId,
  rigDist: EON.solar?.rig?.distance, targetDist: EON.solar?.rig?.targetDistance,
  cameraLen: EON.solar?.camera?.position?.length(),
  labelsRoot: document.querySelector('.labels-solar')?.style.display,
  earthRoot: document.querySelector('.labels-earth')?.style.display,
  visible: EON.solar?.labels?.items?.filter(i=>i.el.style.display !== 'none').map(i=>i.id),
  inspector: document.querySelector('#object-name')?.textContent,
})));
await page.evaluate(() => { EON.solar.focusObject('saturn', { immediate: true, follow: false }); });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'screenshots/06-saturn-immediate.png' });
console.log('saturn-immediate', await page.evaluate(() => ({
  focus: EON.solar.focusId, rigDist: EON.solar.rig.distance,
  camLen: EON.solar.camera.position.length(),
  visible: EON.solar.labels.items.filter(i=>i.el.style.display !== 'none').map(i=>i.id),
  sunDir: EON.solar.bodies.get('saturn')?.material?.uniforms?.uSunDir?.value?.toArray(),
  camToSat: EON.solar.camera.position.clone().sub(EON.solar.bodies.get('saturn').group.position).normalize().toArray(),
})));
await page.evaluate(() => { EON.solar.resetView(true); });
await page.waitForTimeout(3000);
console.log('overview', await page.evaluate(() => ({
  focus: EON.solar.focusId, rigDist: EON.solar.rig.distance,
  visible: EON.solar.labels.items.filter(i=>i.el.style.display !== 'none').map(i=>i.id),
})));
await page.screenshot({ path: 'screenshots/07-overview-immediate.png' });
console.log('issues', issues);
await browser.close();
