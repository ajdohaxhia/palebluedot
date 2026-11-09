import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver'))errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.evaluate(()=>localStorage.removeItem('cosmos.step'));
await page.waitForTimeout(800); await page.click('[data-cs="start"]'); await page.waitForTimeout(500);
async function go(n){await page.evaluate(n=>window.COSMOS.go(n-1),n);await page.waitForTimeout(700);}
for (const n of [24,27]) {
  await go(n);
  await page.evaluate(()=>cancelAnimationFrame(window.EON.frameHandle));
  console.log('scale',n, await page.evaluate(()=>{
    const vp=document.querySelector('.cs-scale-viewport'); const row=document.querySelector('.cs-scale-row');
    const objects=[...document.querySelectorAll('.cs-scale-object')].map(b=>{const r=b.getBoundingClientRect();return {n:b.querySelector('.cs-scale-name')?.textContent,x:Math.round(r.x),w:Math.round(r.width)}});
    return {vp:vp?.getBoundingClientRect().toJSON(),row:row?.getBoundingClientRect().toJSON(),overflow:vp?vp.scrollWidth>vp.clientWidth:null,objects};
  }));
  await page.screenshot({path:`screenshots/cosmos-scale-${n}.png`,timeout:45000}).catch(e=>console.log('shot',n,e.message));
}
// target check without image
await go(17);
console.log('target17', await page.evaluate(()=>({label:document.querySelector('#cs-target-label')?.textContent,hidden:document.querySelector('#cs-target')?.hidden,step:document.querySelector('#cs-bottom-count')?.textContent})));
console.log('errors desktop',errors);
// mobile
const m = await browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true });
const me=[]; m.on('pageerror',e=>me.push(e.message)); m.on('console',x=>{if(x.type()==='error'&&!x.text().includes('GL Driver'))me.push(x.text());});
await m.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await m.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await m.evaluate(()=>localStorage.removeItem('cosmos.step'));
await m.waitForTimeout(1200);
console.log('mobile landing', await m.evaluate(()=>({
  sw:document.querySelector('.cs-landing')?.scrollWidth, cw:document.querySelector('.cs-landing')?.clientWidth,
  inner:innerWidth, root:!document.querySelector('#cosmos-root')?.hidden, app:document.querySelector('.cs-app')?.hidden,
  buttons:[...document.querySelectorAll('.cs-landing-actions button')].map(b=>b.getBoundingClientRect().toJSON()),
  cover:document.querySelector('.cs-cover')?.getBoundingClientRect().toJSON(),
})));
await m.screenshot({path:'screenshots/cosmos-mobile-landing.png',timeout:45000}).catch(e=>console.log('m landing shot',e.message));
await m.click('[data-cs="start"]'); await m.waitForTimeout(900);
console.log('mobile app', await m.evaluate(()=>({
  panel:document.querySelector('.cs-panel')?.getBoundingClientRect().toJSON(),
  card:document.querySelector('#cs-stage-card')?.getBoundingClientRect().toJSON(),
  topbar:getComputedStyle(document.querySelector('.cs-topbar')).height,
  hud:getComputedStyle(document.querySelector('#hud')).display,
  navButton:!!document.querySelector('.cs-mobile-only'),
  cardVisible:!document.querySelector('#cs-stage-card')?.hidden,
  title:document.querySelector('#cs-panel-title')?.textContent,
  horizontal:document.documentElement.scrollWidth>innerWidth,
})));
await m.screenshot({path:'screenshots/cosmos-mobile-step1.png',timeout:45000}).catch(e=>console.log('m step shot',e.message));
// nav drawer
await m.click('.cs-mobile-only');
await m.waitForTimeout(400);
console.log('mobile nav', await m.evaluate(()=>({open:document.querySelector('.cs-nav')?.classList.contains('is-open'), rect:document.querySelector('.cs-nav')?.getBoundingClientRect().toJSON(), scrim:getComputedStyle(document.querySelector('.cs-nav-scrim')).display})));
await m.screenshot({path:'screenshots/cosmos-mobile-nav.png',timeout:45000}).catch(e=>console.log('m nav shot',e.message));
await m.click('.cs-close-nav'); await m.waitForTimeout(200);
console.log('mobile errors',me);
await browser.close();
