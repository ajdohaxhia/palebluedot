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
console.log('preload', await page.evaluate(() => ({ deep: !!EON.deep, domain: EON.domain })));
// star
await page.click('#search-input'); await page.fill('#search-input','Sirius'); await page.waitForTimeout(500); await page.keyboard.press('Enter');
await page.waitForTimeout(6000);
await page.evaluate(() => { const s=EON.deep; const d=EON.selection?.data; if (s&&d) s.focusStar(d); s.rig._tweens = []; });
// force immediate by setting the rig state directly for screenshot
await page.evaluate(() => {
  const s=EON.deep; const st=EON.selection?.data;
  if (s && st) {
    const w=st.world;
    s.rig._tweens = [];
    s.rig.setLimits(2e-10,30000);
    s.rig.focus.set(w.x,w.y,w.z); s.rig.targetFocus.set(w.x,w.y,w.z);
    s.rig.targetDistance=1.2e-6; s.rig.distance=1.2e-6;
    s.rig.follow=null;
    s.rig.apply(0, true);
  }
});
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/10-deep-sirius.png' });
// MW
console.log('MW', await page.evaluate(() => {
  const s=EON.deep; s.focusMilkyWay();
  s.rig.focus.set(0,0,0); s.rig.targetFocus.set(0,0,0); s.rig.targetDistance=0.048; s.rig.distance=0.048;
  s.rig.setAngles(0.55,0.92,true); s.rig.follow=null;
  return { d: s.rig.distance };
}));
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/11-deep-milkyway.png' });
console.log('web', await page.evaluate(() => {
  const s=EON.deep; s.focusWeb();
  s.rig.focus.set(0,0,0); s.rig.targetFocus.set(0,0,0); s.rig.targetDistance=240; s.rig.distance=240;
  s.rig.setAngles(0.62,0.42,true); s.rig.follow=null;
  return { d: s.rig.distance, labels: s.labels.items.filter(i=>i.el.style.display!=='none').map(i=>i.id).slice(0,12) };
}));
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/12-deep-web.png' });
console.log('observable', await page.evaluate(() => {
  const s=EON.deep; s.focusObservable();
  s.rig.focus.set(0,0,0); s.rig.targetFocus.set(0,0,0); s.rig.targetDistance=17000; s.rig.distance=17000;
  s.rig.setAngles(0.62,0.36,true); s.rig.follow=null;
  return { d: s.rig.distance };
}));
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/13-deep-observable.png' });
console.log('issues', issues);
await browser.close();
