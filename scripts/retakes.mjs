import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.waitForFunction(()=>window.EON?.catalogsReady,null,{timeout:90000}).catch(()=>{});
await page.waitForTimeout(3500);
// Saturn
await page.click('#search-input'); await page.fill('#search-input','Saturn'); await page.waitForSelector('.search-result'); await page.keyboard.press('Enter');
await page.waitForTimeout(9000);
await page.screenshot({path:'screenshots/final-02-saturn.png'});
console.log('saturn', await page.evaluate(()=>({dist:EON.solar?.rig?.distance, cap:document.querySelector('#scale-caption').textContent})));
// Cosmic web via scale
await page.evaluate(()=>document.querySelector('.scale-stop[data-id="cosmic-web"]').click());
await page.waitForTimeout(7000);
await page.screenshot({path:'screenshots/final-04-cosmicweb.png'});
console.log('web', await page.evaluate(()=>({crumbs:document.querySelector('#breadcrumbs').textContent.replace(/\s+/g,' ').trim(), cap:document.querySelector('#scale-caption').textContent})));
// Local group
await page.evaluate(()=>document.querySelector('.scale-stop[data-id="local-group"]').click());
await page.waitForTimeout(5000);
await page.screenshot({path:'screenshots/final-07-localgroup.png'});
console.log('local', await page.evaluate(()=>({crumbs:document.querySelector('#breadcrumbs').textContent.replace(/\s+/g,' ').trim()})));
// Exo
await page.click('#search-input'); await page.fill('#search-input','TRAPPIST-1e'); await page.waitForSelector('.search-result'); await page.keyboard.press('Enter');
await page.waitForFunction(()=>EON.domain==='exo',null,{timeout:90000});
await page.waitForTimeout(6000);
await page.screenshot({path:'screenshots/final-05-exoplanet.png'});
console.log('exo errors',errs);
await browser.close();
