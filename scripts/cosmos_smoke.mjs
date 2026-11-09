import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1440,height:900} });
const errors=[];
page.on('pageerror',e=>errors.push('PAGEERROR '+e.message+'\n'+(e.stack||'').split('\n').slice(1,4).join('\n')));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver')) errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.waitForTimeout(2200);
const landing = await page.evaluate(()=>{
  const root=document.querySelector('#cosmos-root');
  return {rootHidden:root?.hidden, landingHidden:document.querySelector('.cs-landing')?.hidden, appHidden:document.querySelector('.cs-app')?.hidden, hud:getComputedStyle(document.querySelector('#hud')).display, title:document.title};
});
console.log('landing',landing);
await page.screenshot({path:'screenshots/cosmos-landing.png'});
const start = await page.$('[data-cs="start"]');
if (!start) { console.log('NO START', errors); await browser.close(); process.exit(1); }
await start.click();
await page.waitForTimeout(4000);
const step1 = await page.evaluate(()=>({
  appHidden:document.querySelector('.cs-app')?.hidden, landingHidden:document.querySelector('.cs-landing')?.hidden,
  title:document.querySelector('#cs-panel-title')?.textContent, kicker:document.querySelector('#cs-panel-kicker')?.textContent,
  card:document.querySelector('#cs-stage-card')?.hidden, camera:window.EON?.camera?.position?.toArray?.(), scene:EON?.domain,
  img:document.querySelector('#cs-stage-body img')?.complete, imgNatural:document.querySelector('#cs-stage-body img')?.naturalWidth,
  navActive:document.querySelector('.cs-nav-step.is-active')?.textContent?.trim(),
  top:document.querySelector('#cs-top-title')?.textContent,
}));
console.log('step1',step1);
await page.screenshot({path:'screenshots/cosmos-step1.png'});
// walk all steps
const steps=[];
for (let i=0;i<32;i++) {
  if (i>0) { await page.click('[data-cs="next"]'); await page.waitForTimeout(500); }
  const st=await page.evaluate(()=>({
    i:document.querySelector('#cs-bottom-count')?.textContent,
    title:document.querySelector('#cs-panel-title')?.textContent,
    card:document.querySelector('#cs-stage-card')?.hidden,
    chips:document.querySelectorAll('#cs-chips .cs-chip').length,
    bodyChildren:document.querySelector('#cs-stage-body')?.children.length,
    stageLabel:document.querySelector('#cs-stage-label')?.textContent,
    domain:EON?.domain,
    err:document.querySelector('#cs-toast:not([hidden])')?.textContent||'',
  }));
  steps.push(st);
}
console.log('steps',JSON.stringify(steps,null,1));
await page.screenshot({path:'screenshots/cosmos-last.png'});
console.log('errors',errors.slice(0,8));
await browser.close();
