import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
page.on('pageerror', e => console.log('ERR', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5173/?quality=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.EON?.catalogsReady, null, { timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(3000);
// Go to solar directly via search
await page.click('#search-input'); await page.fill('#search-input','Saturn'); await page.waitForTimeout(500); await page.keyboard.press('Enter');
await page.waitForTimeout(5000);
await page.evaluate(() => {
  const s = EON.solar;
  s.focusObject('saturn', { immediate: true, follow: false });
  // view from above the ring plane (north pole) using the tilt angle
  const tilt = s.bodies.get('saturn').tilt.rotation.z;
  const nx = -Math.sin(tilt), ny = Math.cos(tilt);
  const yaw = Math.atan2(nx, 0);
  const pitch = Math.asin(ny);
  s.rig.setAngles(yaw, pitch, true);
  s.rig.setDistance(0.0045, true);
});
await page.waitForTimeout(2500);
console.log(await page.evaluate(() => {
  const s = EON.solar;
  const b = s.bodies.get('saturn');
  const ring = b.ring?.mesh;
  const beacons = Object.fromEntries(['jupiter','saturn','earth','mars'].map(id => {
    const x = s.bodies.get(id);
    const pos = x.group.position.clone().project(s.camera);
    return [id, { beaconVisible: x.beacon.visible, op: x.beacon.material.opacity, scale: x.beacon.scale.x, screen: [(pos.x*0.5+0.5)*1000, (-pos.y*0.5+0.5)*650], z: pos.z }];
  }));
  return {
    focus: s.focusId, rigDist: s.rig.distance,
    ringScale: ring?.scale.toArray(),
    ringGeoParams: ring?.geometry?.parameters,
    beacons,
    labels: s.labels.items.filter(i=>i.el.style.display!=='none').map(i=>i.id),
  };
}));
await page.screenshot({ path: 'screenshots/08-saturn-pole.png' });
// Set a day-side oblique view at a larger distance
await page.evaluate(() => {
  const s = EON.solar; const b = s.bodies.get('saturn');
  const pos = b.group.position.clone().negate().normalize();
  const N = {x:-0.45,y:0.893,z:0};
  const view = {x: pos.x*0.75 + N.x*0.6, y: pos.y*0.75 + N.y*0.6, z: pos.z*0.75};
  const len = Math.hypot(view.x,view.y,view.z);
  const yaw = Math.atan2(view.x/len, view.z/len), pitch = Math.asin(view.y/len);
  s.rig.setAngles(yaw,pitch,true); s.rig.setDistance(0.0038,true); s.rig.focusOn(b.group.position,0.0038,{immediate:true, yaw, pitch});
});
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/09-saturn-oblique.png' });
await browser.close();
