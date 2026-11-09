import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const issues = [];
page.on('console', m => { if (m.type()==='error' && !m.text().includes('GL Driver')) issues.push(m.text()); });
page.on('pageerror', e => issues.push('PAGEERROR '+e.message));
await page.goto('http://127.0.0.1:5173/?quality=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.EON?.catalogsReady, null, { timeout: 90000 }).catch(()=>{});
await page.waitForTimeout(9000);
await page.click('#search-input'); await page.fill('#search-input','Sirius'); await page.waitForTimeout(500); await page.keyboard.press('Enter');
await page.waitForTimeout(4000);
await page.evaluate(() => { EON.inspector?.close(); cancelAnimationFrame(EON.frameHandle); });
async function view(name, src, out) {
  const info = await page.evaluate(({ src }) => {
    const s = EON.deep;
    const f = new Function('s', 'EON', src);
    f(s, EON);
    s.update(0.016, { time: EON.time, width: innerWidth, height: innerHeight });
    EON.engine.render(s.scene, s.camera, 0.016);
    const rep = s.getScaleReport();
    const set = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
    set('#scale-value', rep.scaleMeters > 9.4607e15 ? (rep.scaleMeters/9.4607e15 > 1e6 ? (rep.scaleMeters/9.4607e21).toFixed(2)+' million ly' : (rep.scaleMeters/9.4607e15).toFixed(0)+' ly') : (rep.scaleMeters/1000).toFixed(0)+' km');
    set('#scale-caption', rep.label);
    const labels = s.labels.items.filter(i => i.el.style.display !== 'none' && i.el.offsetParent !== null).map(i => i.id);
    return { dist: s.rig.distance, labels, rep, selVisible: s._selectedSprite.visible };
  }, { src });
  await page.waitForTimeout(700);
  await page.screenshot({ path: out });
  console.log(name, JSON.stringify(info));
}
await view('LOCAL', "s.focusLocalGroup();", 'screenshots/22-local.png');
await view('MW', "s.focusMilkyWay(); s.rig._tweens=[]; s.rig.focus.set(0,0,0); s.rig.targetFocus.set(0,0,0); s.rig.distance=0.048; s.rig.targetDistance=0.048; s.rig.setAngles(0.55,0.92,true); s.rig.apply(0,true);", 'screenshots/21-mw.png');
console.log('issues', issues);
await browser.close();
