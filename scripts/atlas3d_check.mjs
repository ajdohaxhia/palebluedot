import { chromium } from 'playwright-core';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver'))errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.evaluate(()=>{localStorage.removeItem('cosmos.step')});
await page.waitForTimeout(800);
await page.click('[data-cs="start"]');await page.waitForTimeout(1200);
const step1=await page.evaluate(()=>({
  active:COSMOS.active,title:document.querySelector('#cs-panel-title')?.textContent,counter:document.querySelector('#cs-bottom-count')?.textContent,
  cardHidden:document.querySelector('#cs-stage-card')?.hidden,stage:document.querySelector('#cs-stage-label')?.textContent,
  targetHidden:document.querySelector('#cs-target')?.hidden,target:document.querySelector('#cs-target-label')?.textContent,
  switchHidden:document.querySelector('#cs-view-switch')?.hidden,switchText:document.querySelector('#cs-view-switch')?.textContent,
  cta:!!document.querySelector('.cs-tool-cta'),panelTool:document.querySelector('.cs-tool-name')?.textContent,
  hud:getComputedStyle(document.querySelector('#hud')).display,canvas:document.querySelector('#scene-canvas')?.width,domain:EON.domain,
}));
console.log('STEP1',JSON.stringify(step1));
// open drawer from panel
await page.click('.cs-tool-cta');await page.waitForTimeout(500);
console.log('DRAWER',JSON.stringify(await page.evaluate(()=>({
  cardHidden:document.querySelector('#cs-stage-card')?.hidden,bodyChildren:document.querySelector('#cs-stage-body')?.children.length,
  cardRect:document.querySelector('#cs-stage-card')?.getBoundingClientRect().toJSON(),
  img:document.querySelector('#cs-stage-body img')?.naturalWidth,
  targetHidden:document.querySelector('#cs-target')?.hidden,panelTool:document.querySelector('.cs-tool-action')?.textContent,
  stage:document.querySelector('#cs-stage-label')?.textContent,
}))));
await page.click('.cs-card-toggle');await page.waitForTimeout(300);
// go to step 11 and open image
await page.evaluate(()=>COSMOS.go(10));await page.waitForTimeout(700);
await page.click('.cs-tool-cta');await page.waitForTimeout(500);
console.log('PLAQUE',JSON.stringify(await page.evaluate(()=>({
  cardHidden:document.querySelector('#cs-stage-card')?.hidden,img:document.querySelector('#cs-stage-body img')?.naturalWidth,
  hotspots:document.querySelectorAll('.cs-stage-body .cs-hotspot').length,
  panelTool:document.querySelector('.cs-tool-name')?.textContent,
}))));
await page.click('.cs-card-toggle');await page.waitForTimeout(300);
// free atlas
await page.click('.cs-top-actions [data-cs="free-atlas"]');await page.waitForTimeout(700);
console.log('FREE',JSON.stringify(await page.evaluate(()=>({
  freeAtlas:COSMOS.freeAtlas,rootHidden:document.querySelector('#cosmos-root')?.hidden,
  hud:getComputedStyle(document.querySelector('#hud')).display,
  returnVisible:!!document.querySelector('#cosmos-free-return')&&!document.querySelector('#cosmos-free-return').hidden,
  returnRect:document.querySelector('#cosmos-free-return')?.getBoundingClientRect().toJSON(),
  brand:document.querySelector('#hud .brand-word')?.textContent,
  search:document.querySelector('#search-input')?.placeholder,
  scale:getComputedStyle(document.querySelector('#scale-rail')).display,
  labels:getComputedStyle(document.querySelector('#labels-layer')).display,
  earthSelect:COSMOS.freeAtlas, body:document.body.className,
}))));
await page.click('#cosmos-free-return');await page.waitForTimeout(1200);
console.log('RETURN',JSON.stringify(await page.evaluate(()=>({
  freeAtlas:COSMOS.freeAtlas,rootHidden:document.querySelector('#cosmos-root')?.hidden,
  hud:getComputedStyle(document.querySelector('#hud')).display,
  returnExists:!!document.querySelector('#cosmos-free-return'),
  title:document.querySelector('#cs-panel-title')?.textContent,cardHidden:document.querySelector('#cs-stage-card')?.hidden,
  body:document.body.className,
}))));
// present
await page.click('.cs-top-actions [data-cs="present"]');await page.waitForTimeout(500);
console.log('PRESENT',JSON.stringify(await page.evaluate(()=>({
  presenting:COSMOS.presenting,
  topbar:getComputedStyle(document.querySelector('.cs-topbar')).display,
  nav:getComputedStyle(document.querySelector('.cs-nav')).display,
  panel:getComputedStyle(document.querySelector('.cs-panel')).display,
  stage:getComputedStyle(document.querySelector('.cs-stage')).inset,
  card:document.querySelector('#cs-stage-card')?.hidden,
  chrome:!document.querySelector('.cs-present-chrome')?.hidden,
  actions:[...document.querySelectorAll('.cs-present-actions button')].map(b=>b.textContent),
  hud:getComputedStyle(document.querySelector('#hud')).display,
}))));
await page.keyboard.press('Escape');await page.waitForTimeout(300);
console.log('ERRORS',errors.slice(0,8));
await browser.close();
