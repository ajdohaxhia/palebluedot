import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver'))errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.evaluate(()=>localStorage.removeItem('cosmos.step'));
await page.waitForTimeout(1200);
await page.evaluate(()=>cancelAnimationFrame(window.EON.frameHandle));
const landing = await page.evaluate(()=>({
  btns:[...document.querySelectorAll('.cs-landing-actions button')].map(b=>{const s=getComputedStyle(b);const r=b.getBoundingClientRect();return {text:b.textContent.trim(),bg:s.backgroundColor,border:s.borderColor,fs:s.fontSize,color:s.color,w:Math.round(r.width),h:Math.round(r.height)}}),
  cover:document.querySelector('.cs-cover img')?.naturalWidth,
  intro:document.querySelector('.cs-lead')?.textContent,
}));
console.log('LANDING', JSON.stringify(landing,null,1));
await page.screenshot({path:'screenshots/cosmos-landing-final.png',timeout:60000}).catch(e=>console.log('shot landing',e.message));
await page.click('[data-cs="start"]');
await page.waitForTimeout(800);
await page.evaluate(()=>cancelAnimationFrame(window.EON.frameHandle));
await page.screenshot({path:'screenshots/cosmos-01-final.png',timeout:60000}).catch(e=>console.log('shot 1',e.message));
async function go(n) { await page.evaluate(n=>window.COSMOS.go(n-1),n); await page.waitForTimeout(700); await page.evaluate(()=>cancelAnimationFrame(window.EON.frameHandle)); }
async function inspect(n) {
  await go(n);
  const data = await page.evaluate(()=>{
    const card=document.querySelector('#cs-stage-card'); const body=document.querySelector('#cs-stage-body');
    const scaleRow=document.querySelector('.cs-scale-row'); const scaleVp=document.querySelector('.cs-scale-viewport');
    const hotspots=[...document.querySelectorAll('.cs-hotspot')].map(b=>{const r=b.getBoundingClientRect();return {i:b.textContent,x:Math.round(r.x),y:Math.round(r.y)}});
    const bounds=document.querySelector('.cs-bound-svg')?.getBoundingClientRect();
    const cosmic=[...document.querySelectorAll('.cs-cosmic-marker')].map(b=>Math.round(b.getBoundingClientRect().x));
    return {n:document.querySelector('#cs-bottom-count')?.textContent,title:document.querySelector('#cs-panel-title')?.textContent,
      cardVisible:card && !card.hidden, cardRect:card?card.getBoundingClientRect().toJSON():null,
      bodyChild:body?.children.length, scaleRow:scaleRow?scaleRow.getBoundingClientRect().toJSON():null,
      scaleVp:scaleVp?scaleVp.getBoundingClientRect().toJSON():null,
      hotspots, bounds:bounds?bounds.toJSON():null, cosmic,
      stageLabel:document.querySelector('#cs-stage-label')?.textContent,
      chips:[...document.querySelectorAll('.cs-chip')].slice(0,12).map(b=>b.textContent),
      h1:getComputedStyle(document.querySelector('#cs-panel-title')).fontSize,
      navFont:getComputedStyle(document.querySelector('.cs-nav-step')).fontSize,
      cardToggle:getComputedStyle(document.querySelector('.cs-card-toggle')).fontSize,
    };
  });
  console.log('STEP',JSON.stringify(data));
  await page.screenshot({path:`screenshots/cosmos-final-${n}.png`,timeout:60000}).catch(e=>console.log('shot',n,e.message));
}
for (const n of [5,11,24,27,32]) await inspect(n);
console.log('ERRORS',errors.slice(0,10));
await browser.close();
