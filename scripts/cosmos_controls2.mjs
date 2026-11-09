import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver'))errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.evaluate(()=>localStorage.removeItem('cosmos.step'));
await page.waitForTimeout(900);
await page.click('[data-cs="start"]'); await page.waitForTimeout(600);
await page.evaluate(()=>{ window.COSMOS.go(16); });
await page.waitForTimeout(1800);
console.log('step17', await page.evaluate(()=>({target:document.querySelector('#cs-target-label')?.textContent,targetHidden:document.querySelector('#cs-target')?.hidden,stage:document.querySelector('#cs-stage-label')?.textContent,chips:[...document.querySelectorAll('.cs-chip')].map(b=>b.textContent),domain:EON.domain})));
await page.evaluate(()=>window.COSMOS.go(23)); await page.waitForTimeout(600);
console.log('scale24', await page.evaluate(()=>{
 const vp=document.querySelector('.cs-scale-viewport'); const objects=[...document.querySelectorAll('.cs-scale-object')].map(b=>{const r=b.getBoundingClientRect();return {n:b.querySelector('.cs-scale-name')?.textContent,x:Math.round(r.x),w:Math.round(r.width)}});
 return {vp:vp?.getBoundingClientRect().toJSON(), objects, overflow:vp?vp.scrollWidth>vp.clientWidth:null};
}));
await page.evaluate(()=>window.COSMOS.go(31)); await page.waitForTimeout(600);
console.log('cosmic32', await page.evaluate(()=>({markers:document.querySelectorAll('.cs-cosmic-marker').length, active:document.querySelector('.cs-cosmic-marker.is-active')?.textContent, activeLabel:document.querySelector('.cs-cosmic-marker.is-active em')?.textContent, detail:document.querySelector('#cs-cosmic-detail h4')?.textContent})));
// slide modal
await page.click('.cs-top-actions [data-cs="slide"]'); await page.waitForTimeout(500);
console.log('slide', await page.evaluate(()=>({open:!document.querySelector('#cs-modal')?.hidden,img:document.querySelector('#cs-modal img')?.naturalWidth})));
await page.click('.cs-modal-close'); await page.waitForTimeout(250);
console.log('slideClosed', await page.evaluate(()=>document.querySelector('#cs-modal')?.hidden));
// atlas
await page.click('.cs-top-actions [data-cs="atlas"]'); await page.waitForTimeout(400);
console.log('atlas', await page.evaluate(()=>({cats:document.querySelectorAll('.cs-atlas-cat').length, steps:document.querySelectorAll('.cs-atlas-chips button').length, open:!document.querySelector('#cs-modal')?.hidden})));
await page.click('.cs-atlas-chips button'); await page.waitForTimeout(500);
console.log('atlasJump', await page.evaluate(()=>({n:document.querySelector('#cs-bottom-count')?.textContent,modalHidden:document.querySelector('#cs-modal')?.hidden,title:document.querySelector('#cs-panel-title')?.textContent})));
// quiz
await page.click('.cs-top-actions [data-cs="quiz"]'); await page.waitForTimeout(400);
const q1=await page.evaluate(()=>({q:document.querySelector('.cs-quiz h3')?.textContent,options:document.querySelectorAll('.cs-quiz-option').length,score:document.querySelector('.cs-quiz-progress')?.textContent}));
await page.click('.cs-quiz-option'); await page.waitForTimeout(300);
const q2=await page.evaluate(()=>({feedback:!!document.querySelector('.cs-quiz-feedback'),next:!!document.querySelector('[data-cs="quiz-next"]'),correct:!!document.querySelector('.cs-quiz-option.is-correct')}));
await page.click('.cs-modal-close'); await page.waitForTimeout(250);
console.log('quiz',q1,q2);
// present
await page.click('.cs-top-actions [data-cs="present"]'); await page.waitForTimeout(400);
console.log('present', await page.evaluate(()=>({presenting:window.COSMOS.presenting,topbar:getComputedStyle(document.querySelector('.cs-topbar')).display,panel:getComputedStyle(document.querySelector('.cs-panel')).display,chrome:!document.querySelector('.cs-present-chrome')?.hidden,card:getComputedStyle(document.querySelector('#cs-stage-card')).position})));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
console.log('presentExit', await page.evaluate(()=>({presenting:window.COSMOS.presenting,topbar:getComputedStyle(document.querySelector('.cs-topbar')).display})));
console.log('errors',errors.slice(0,10));
await browser.close();
