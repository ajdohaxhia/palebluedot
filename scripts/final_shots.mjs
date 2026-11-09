import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?quality=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.EON?.ready, null, { timeout: 90000 });
await page.waitForFunction(() => window.EON?.catalogsReady, null, { timeout: 90000 }).catch(()=>{});
await page.waitForTimeout(5500);
await page.screenshot({ path: 'screenshots/final-01-earth.png' });
console.log('earth done');

// Milky Way via the scale stop + face-on focus
await page.evaluate(() => document.querySelector('.scale-stop[data-id="milky-way"]').click());
await page.waitForFunction(() => EON.domain === 'deep', null, { timeout: 90000 });
await page.waitForTimeout(1200);
await page.evaluate(() => { EON.deep.focusMilkyWay(); });
await page.waitForTimeout(8000);
await page.screenshot({ path: 'screenshots/final-03-milkyway.png' });
console.log('mw done', await page.evaluate(() => ({cap:document.querySelector('#scale-caption').textContent, val:document.querySelector('#scale-value').textContent})));

// Local Group
await page.evaluate(() => document.querySelector('.scale-stop[data-id="local-group"]').click());
await page.waitForTimeout(7000);
await page.screenshot({ path: 'screenshots/final-07-localgroup.png' });
console.log('local done', await page.evaluate(() => ({cap:document.querySelector('#scale-caption').textContent, val:document.querySelector('#scale-value').textContent})));

// Cosmic web
await page.evaluate(() => document.querySelector('.scale-stop[data-id="cosmic-web"]').click());
await page.waitForTimeout(8000);
await page.screenshot({ path: 'screenshots/final-04-cosmicweb.png' });
console.log('web done', await page.evaluate(() => ({cap:document.querySelector('#scale-caption').textContent, val:document.querySelector('#scale-value').textContent})));

// Solar overview
await page.evaluate(() => document.querySelector('.scale-stop[data-id="solar-system"]').click());
await page.waitForFunction(() => EON.domain === 'solar', null, { timeout: 90000 });
await page.waitForTimeout(6500);
await page.screenshot({ path: 'screenshots/final-02-solar.png' });
console.log('solar done');

// Saturn close-up
await page.evaluate(() => document.querySelector('.scale-open')?.click());
await page.click('#search-input'); await page.fill('#search-input','Saturn');
await page.waitForSelector('.search-result', { timeout: 20000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(9000);
await page.screenshot({ path: 'screenshots/final-02-saturn.png' });
console.log('saturn done', await page.evaluate(() => ({name:document.querySelector('#object-name')?.textContent, focus:EON.solar?.focusId, dist:EON.solar?.rig?.distance})));

// Exoplanet system
await page.click('#search-input'); await page.fill('#search-input','TRAPPIST-1e');
await page.waitForSelector('.search-result', { timeout: 20000 });
await page.keyboard.press('Enter');
await page.waitForFunction(() => EON.domain === 'exo', null, { timeout: 90000 });
await page.waitForTimeout(7000);
await page.screenshot({ path: 'screenshots/final-05-exoplanet.png' });
console.log('exo done');

console.log('errors', errors);
await browser.close();

// Mobile
const mobile = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox','--no-sandbox'] });
const mp = await mobile.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mp.goto('http://127.0.0.1:5173/?quality=low', { waitUntil: 'domcontentloaded' });
await mp.waitForFunction(() => window.EON?.ready, null, { timeout: 90000 });
await mp.waitForTimeout(2500);
await mp.click('#mobile-scale-button');
await mp.waitForTimeout(1000);
await mp.screenshot({ path: 'screenshots/final-06-mobile.png' });
console.log('mobile done');
await mobile.close();
