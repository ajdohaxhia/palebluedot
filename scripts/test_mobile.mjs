import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.waitForTimeout(2500);
await page.click('#mobile-scale-button');
await page.waitForTimeout(500);
const sheet = await page.evaluate(()=>{
  const rail=document.querySelector('#scale-rail');
  const stops=[...document.querySelectorAll('.scale-stop')].map(b=>({id:b.dataset.id, rect:b.getBoundingClientRect().toJSON(), display:getComputedStyle(b).display}));
  const readout=document.querySelector('.scale-readout').getBoundingClientRect();
  return {open:rail.classList.contains('is-mobile-open'), rail:rail.getBoundingClientRect().toJSON(), stops, readout:readout.toJSON(), scrollY:window.scrollY, docH:document.documentElement.scrollHeight};
});
await page.screenshot({path:'screenshots/qa-10-mobile-scale.png'});
console.log(JSON.stringify(sheet,null,1));
// search should close the scale sheet
await page.click('#search-input');
await page.waitForTimeout(300);
const closed = await page.evaluate(()=>({open:document.querySelector('#scale-rail').classList.contains('is-mobile-open'), search:document.querySelector('#search-wrap').classList.contains('is-mobile-open')}));
console.log('after search focus', closed);
await page.fill('#search-input','Earth'); await page.waitForTimeout(700); await page.keyboard.press('Enter');
await page.waitForTimeout(1800);
const insp = await page.evaluate(()=>({open:document.querySelector('#inspector').classList.contains('is-open'), name:document.querySelector('#object-name').textContent, sheet:document.querySelector('#scale-rail').classList.contains('is-mobile-open'), top:document.querySelector('#inspector').getBoundingClientRect().top}));
console.log('inspector',insp, errs);
await page.screenshot({path:'screenshots/qa-11-mobile-earth.png'});
await browser.close();
