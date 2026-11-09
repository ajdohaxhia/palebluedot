import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver'))errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.evaluate(()=>localStorage.removeItem('cosmos.step'));
await page.waitForTimeout(1000);
await page.click('[data-cs="start"]'); await page.waitForTimeout(700);
// step 17 local group and target label
await page.evaluate(()=>window.COSMOS.go(16)); await page.waitForTimeout(1800);
console.log('target17', await page.evaluate(()=>({label:document.querySelector('#cs-target-label')?.textContent, hidden:document.querySelector('#cs-target')?.hidden, s:document.querySelector('#cs-stage-label')?.textContent, chips:[...document.querySelectorAll('.cs-chip')].map(b=>b.textContent)})));
await page.evaluate(()=>cancelAnimationFrame(window.EON.frameHandle));
await page.screenshot({path:'screenshots/cosmos-17-final.png',timeout:60000}).catch(e=>console.log('17 shot',e.message));
// step 24 scale layout and shot
await page.evaluate(()=>window.COSMOS.go(23)); await page.waitForTimeout(900); await page.evaluate(()=>cancelAnimationFrame(window.EON.frameHandle));
console.log('scale24', await page.evaluate(()=>{
  const sun=document.querySelector('.cs-scale-object.is-selected'); const vp=document.querySelector('.cs-scale-viewport'); const row=document.querySelector('.cs-scale-row'); const objects=[...document.querySelectorAll('.cs-scale-object')].map(b=>{const r=b.getBoundingClientRect();return {n:b.textContent.trim(),x:Math.round(r.x),w:Math.round(r.width)}});
  return {sun:sun?sun.getBoundingClientRect().toJSON():null, vp:vp?.getBoundingClientRect().toJSON(), row:row?.getBoundingClientRect().toJSON(), objects};
}));
await page.screenshot({path:'screenshots/cosmos-24-final.png',timeout:60000}).catch(e=>console.log('24 shot',e.message));
// step 32 cosmic active label
await page.evaluate(()=>window.COSMOS.go(31)); await page.waitForTimeout(700); await page.evaluate(()=>cancelAnimationFrame(window.EON.frameHandle));
console.log('cosmic', await page.evaluate(()=>({markers:document.querySelectorAll('.cs-cosmic-marker').length, active:document.querySelector('.cs-cosmic-marker.is-active')?.textContent, detail:document.querySelector('#cs-cosmic-detail')?.textContent.slice(0,80)})));
await page.screenshot({path:'screenshots/cosmos-32-final.png',timeout:60000}).catch(e=>console.log('32 shot',e.message));
// slide modal close with X
await page.click('[data-cs="slide"]'); await page.waitForTimeout(600);
console.log('slide', await page.evaluate(()=>({open:!document.querySelector('#cs-modal')?.hidden, img:document.querySelector('#cs-modal img')?.naturalWidth, close:!!document.querySelector('.cs-modal-close')})));
await page.click('.cs-modal-close'); await page.waitForTimeout(300);
console.log('slide closed', await page.evaluate(()=>document.querySelector('#cs-modal')?.hidden));
// atlas
await page.click('.cs-top-actions [data-cs="atlas"]'); await page.waitForTimeout(500);
console.log('atlas', await page.evaluate(()=>({cats:document.querySelectorAll('.cs-atlas-cat').length, open:!document.querySelector('#cs-modal')?.hidden})));
await page.evaluate(()=>cancelAnimationFrame(window.EON.frameHandle));
await page.screenshot({path:'screenshots/cosmos-atlas-final.png',timeout:60000}).catch(e=>console.log('atlas shot',e.message));
await page.click('.cs-atlas-chips button'); await page.waitForTimeout(700);
console.log('atlas jump', await page.evaluate(()=>({step:document.querySelector('#cs-bottom-count')?.textContent, modal:document.querySelector('#cs-modal')?.hidden, title:document.querySelector('#cs-panel-title')?.textContent})));
// quiz
await page.click('.cs-top-actions [data-cs="quiz"]'); await page.waitForTimeout(500);
console.log('quiz', await page.evaluate(()=>({q:document.querySelector('.cs-quiz h3')?.textContent, options:document.querySelectorAll('.cs-quiz-option').length})));
await page.click('.cs-quiz-option'); await page.waitForTimeout(300);
console.log('quiz answered', await page.evaluate(()=>({feedback:!!document.querySelector('.cs-quiz-feedback'), next:!!document.querySelector('[data-cs="quiz-next"]')})));
await page.click('.cs-modal-close'); await page.waitForTimeout(300);
// present
await page.click('.cs-top-actions [data-cs="present"]'); await page.waitForTimeout(600);
console.log('present', await page.evaluate(()=>({presenting:window.COSMOS.presenting, topbar:getComputedStyle(document.querySelector('.cs-topbar')).display, panel:getComputedStyle(document.querySelector('.cs-panel')).display, chrome:!document.querySelector('.cs-present-chrome')?.hidden})));
await page.screenshot({path:'screenshots/cosmos-present-final.png',timeout:60000}).catch(e=>console.log('present shot',e.message));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
console.log('presented exit', await page.evaluate(()=>({presenting:window.COSMOS.presenting, topbar:getComputedStyle(document.querySelector('.cs-topbar')).display})));
console.log('ERRORS', errors.slice(0,10));
await browser.close();
