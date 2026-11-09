import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
page.on('console', m => { if (m.type() !== 'warning') console.log('CONSOLE', m.type(), m.text()); });
page.on('pageerror', e => console.log('PAGEERROR', e.message, e.stack));
page.on('response', r => { if (r.url().includes('/data/')) console.log('RESP', r.status(), r.url(), r.headers()['content-length']); });
page.on('requestfailed', r => console.log('FAIL', r.url(), r.failure()?.errorText));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
console.log('early fetch test', await page.evaluate(async () => {
  try { const r = await fetch('./data/manifest.json'); return [r.status, (await r.text()).slice(0, 80)]; } catch (e) { return 'ERR ' + e.message; }
}));
for (let i=0;i<8;i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => ({ ready: window.EON?.catalogsReady, cat: !!window.EON?.catalogs, loading: document.querySelector('#loading-percent')?.textContent, hidden: document.querySelector('#loading-screen')?.classList.contains('is-hidden') }));
  console.log('tick', i, s);
  if (s.ready) break;
}
console.log('final', await page.evaluate(() => {
  const e = window.EON;
  return {
    catalogsReady: e?.catalogsReady,
    hasStars: !!e?.catalogs?.stars,
    hasExo: !!e?.catalogs?.exo,
    hasSDSS: !!e?.catalogs?.sdss,
    searchIndex: (()=>{try{return e?.catalogs?.searchIndex?.().length}catch(err){return 'ERR '+err.message}})(),
    loadingPercent: document.querySelector('#loading-percent')?.textContent,
    loadingHidden: document.querySelector('#loading-screen')?.classList.contains('is-hidden'),
    toast: document.querySelector('#toast')?.textContent,
    toastHidden: document.querySelector('#toast')?.hidden,
  }
}));
await page.screenshot({ path: 'screenshots/probe2.png' });
await browser.close();
