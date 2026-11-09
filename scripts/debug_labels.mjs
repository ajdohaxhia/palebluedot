import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', e => console.log('ERR', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5173/?quality=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.EON?.catalogsReady, null, { timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(5000);
await page.click('#search-input'); await page.fill('#search-input','Saturn'); await page.waitForTimeout(500); await page.keyboard.press('Enter');
await page.waitForTimeout(8000);
const info = await page.evaluate(() => {
  const roots=[...document.querySelectorAll('.label-root')].map(r => ({cls:r.className, display:r.style.display, computed:getComputedStyle(r).display, count:r.children.length, sample:[...r.children].slice(0,3).map(c=>c.textContent)}));
  return {
    domain: EON.domain,
    activeSceneType: EON.activeScene?.constructor?.name,
    earthLabelsVisible: EON.earth?.labels?.visible,
    earthRootDisplay: EON.earth?.labels?.root?.style.display,
    solarLabelsVisible: EON.solar?.labels?.visible,
    solarRootDisplay: EON.solar?.labels?.root?.style.display,
    roots,
    sunDir: EON.solar?.bodies?.get('saturn')?.material?.uniforms?.uSunDir?.value?.toArray?.(),
    camPos: EON.solar?.camera?.position?.toArray?.(),
    satPos: EON.solar?.bodies?.get('saturn')?.group?.position?.toArray?.(),
    activeScene: EON.activeScene === EON.solar ? 'solar' : EON.activeScene === EON.earth ? 'earth' : 'other',
  };
});
console.log(JSON.stringify(info,null,2));
await browser.close();
