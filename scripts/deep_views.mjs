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
// Enter deep via search so the scene is active
await page.click('#search-input'); await page.fill('#search-input','Sirius'); await page.waitForTimeout(500); await page.keyboard.press('Enter');
await page.waitForTimeout(5000);
// Close inspector, cancel RAF for deterministic manual rendering
await page.evaluate(() => {
  EON.inspector?.close();
  cancelAnimationFrame(EON.frameHandle);
});
async function view(name, fn, out) {
  const info = await page.evaluate(({ src }) => {
    const f = new Function('s', 'EON', src);
    const s = EON.deep;
    f(s, EON);
    s.update(0.016, { time: EON.time, width: innerWidth, height: innerHeight });
    EON.engine.render(s.scene, s.camera, 0.016);
    const rep = s.getScaleReport();
    const set = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
    set('#scale-value', (rep.scaleMeters > 9.46e15 ? (rep.scaleMeters/9.4607e15).toFixed(rep.scaleMeters>9.46e18?1:2) + ' ly' : (rep.scaleMeters/1000).toFixed(0) + ' km'));
    set('#scale-caption', rep.label);
    const labels = s.labels.items.filter(i => i.el.style.display !== 'none' && i.el.offsetParent !== null).map(i => i.id);
    return { dist: s.rig.distance, focus: s.focusId, labels, rep, cam: s.camera.position.toArray(), tweens: s.rig._tweens.length };
  }, { src: fn });
  await page.waitForTimeout(900);
  await page.screenshot({ path: out });
  console.log(name, JSON.stringify(info));
}
await view('MW', `
  s.focusMilkyWay();
  s.rig._tweens.length = 0;
  s.rig.setLimits(1e-7, 30000);
  s.rig.focus.set(0,0,0); s.rig.targetFocus.set(0,0,0);
  s.rig.distance = 0.048; s.rig.targetDistance = 0.048;
  s.rig.setAngles(0.55, 0.92, true); s.rig.follow = null;
  s.rig.apply(0, true);
`, 'screenshots/21-mw.png');
await view('LOCAL', `
  s.rig._tweens.length = 0;
  s.rig.setLimits(1e-7, 30000);
  s.rig.focus.set(0,0,0); s.rig.targetFocus.set(0,0,0);
  s.rig.distance = 2.6; s.rig.targetDistance = 2.6;
  s.rig.setAngles(0.72, 0.42, true); s.rig.follow = null;
  s.rig.apply(0, true);
`, 'screenshots/22-local.png');
await view('WEB', `
  s.rig._tweens.length = 0;
  s.rig.setLimits(1e-5, 30000);
  s.rig.focus.set(0,0,0); s.rig.targetFocus.set(0,0,0);
  s.rig.distance = 260; s.rig.targetDistance = 260;
  s.rig.setAngles(0.62, 0.4, true); s.rig.follow = null;
  s.rig.apply(0, true);
`, 'screenshots/23-web.png');
await view('OBSERVABLE', `
  s.rig._tweens.length = 0;
  s.rig.setLimits(1, 30000);
  s.rig.focus.set(0,0,0); s.rig.targetFocus.set(0,0,0);
  s.rig.distance = 16000; s.rig.targetDistance = 16000;
  s.rig.setAngles(0.62, 0.36, true); s.rig.follow = null;
  s.rig.apply(0, true);
`, 'screenshots/24-observable.png');
console.log('issues', issues);
await browser.close();
