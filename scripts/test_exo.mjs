import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const issues = [];
page.on('console', m => { if (m.type()==='error' && !m.text().includes('GL Driver')) issues.push(m.text()); });
page.on('pageerror', e => issues.push('PAGEERROR '+e.message));
await page.goto('http://127.0.0.1:5173/?quality=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.EON?.catalogsReady, null, { timeout: 90000 }).catch(()=>{});
await page.waitForTimeout(7000);
await page.click('#search-input'); await page.fill('#search-input','TRAPPIST-1e'); await page.waitForTimeout(600);
console.log('results', await page.$$eval('.search-result', els => els.slice(0,3).map(e=>e.textContent.trim())));
await page.keyboard.press('Enter');
await page.waitForTimeout(12000);
const state = await page.evaluate(() => ({
  domain: EON.domain, exoReady: !!EON.exo?.ready, host: EON.exoSystem?.host,
  planets: EON.exo?.planets?.length, selection: EON.selection,
  inspector: document.querySelector('#object-name')?.textContent,
  returnVisible: !document.querySelector('#exo-return')?.hidden,
  crumbs: document.querySelector('#breadcrumbs')?.textContent.replace(/\s+/g,' ').trim(),
  telemetry: { title: document.querySelector('#telemetry-title')?.textContent, keys: [...document.querySelectorAll('#telemetry-lines .telemetry-key')].map(e=>e.textContent), vals: [document.querySelector('#tel-lat')?.textContent, document.querySelector('#tel-lon')?.textContent, document.querySelector('#tel-alt')?.textContent, document.querySelector('#tel-sun')?.textContent] },
  labels: EON.exo?.labels?.items?.filter(i=>i.el.style.display!=='none').map(i=>i.id).slice(0,12),
  fps: EON.engine?.fps,
}));
console.log(JSON.stringify({ state, issues }, null, 2));
await page.screenshot({ path: 'screenshots/30-exo-trappist.png' });
console.log('toast', await page.evaluate(() => ({text:document.querySelector('#toast')?.textContent, hidden:document.querySelector('#toast')?.hidden})));
await browser.close();
