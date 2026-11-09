import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
const errors=[];
page.on('pageerror',e=>errors.push('PAGEERROR '+e.message+'\n'+(e.stack||'').split('\n').slice(1,4).join('\n')));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver')) errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.evaluate(()=>localStorage.removeItem('cosmos.step'));
await page.waitForTimeout(1600);
await page.screenshot({path:'screenshots/cosmos-landing.png', timeout:60000}).catch(e=>console.log('landing shot',e.message));
console.log('landing', await page.evaluate(()=>({title:document.querySelector('.cs-landing h1')?.textContent, root:!document.querySelector('#cosmos-root')?.hidden, app:document.querySelector('.cs-app')?.hidden, hud:getComputedStyle(document.querySelector('#hud')).display})));
await page.click('[data-cs="start"]');
await page.waitForTimeout(3500);
await page.screenshot({path:'screenshots/cosmos-01-pale-blue-dot.png', timeout:60000}).catch(e=>console.log('s1 shot',e.message));
console.log('step1', await page.evaluate(()=>({title:document.querySelector('#cs-panel-title')?.textContent, stage:document.querySelector('#cs-stage-label')?.textContent, card:document.querySelector('#cs-stage-card')?.hidden, img:document.querySelector('#cs-stage-body img')?.naturalWidth, domain:EON?.domain, fps:EON?.engine?.fps})));
const shotSteps = new Set([2,3,4,5,7,8,11,12,13,17,20,22,24,27,30,31,32]);
const seen=[];
for (let i=1;i<32;i++) {
  await page.locator('.cs-bottombar [data-cs="next"]').click();
  await page.waitForTimeout(500);
  const st=await page.evaluate(()=>({n:document.querySelector('#cs-bottom-count')?.textContent,title:document.querySelector('#cs-panel-title')?.textContent,stage:document.querySelector('#cs-stage-label')?.textContent,card:!document.querySelector('#cs-stage-card')?.hidden,chips:document.querySelectorAll('#cs-chips .cs-chip').length,body:document.querySelector('#cs-stage-body')?.children.length,domain:EON?.domain}));
  seen.push(st);
  if (shotSteps.has(i+1)) await page.screenshot({path:`screenshots/cosmos-step-${String(i+1).padStart(2,'0')}.png`, timeout:60000}).catch(e=>console.log('shot',i+1,e.message));
}
console.log('walk', seen.map(s=>`${s.n} ${s.title} [${s.card?'card':'atlas'}|${s.domain}|${s.chips}]`).join('\n'));
await page.locator('.cs-bottombar [data-cs="next"]').isVisible().catch(()=>{});
// slide modal
await page.click('.cs-top-actions [data-cs="slide"]');
await page.waitForTimeout(1000);
await page.screenshot({path:'screenshots/cosmos-slide-modal.png', timeout:60000}).catch(e=>console.log('slide shot',e.message));
const slideModal=await page.evaluate(()=>({open:!document.querySelector('#cs-modal')?.hidden,kicker:document.querySelector('#cs-modal-kicker')?.textContent,img:document.querySelector('#cs-modal img')?.naturalWidth}));
console.log('slideModal',slideModal);
await page.click('[data-cs="modal-close"]');
await page.waitForTimeout(400);
// atlas
await page.click('.cs-top-actions [data-cs="atlas"]');
await page.waitForTimeout(700);
await page.screenshot({path:'screenshots/cosmos-atlas.png', timeout:60000}).catch(e=>console.log('atlas shot',e.message));
console.log('atlas', await page.evaluate(()=>({open:!document.querySelector('#cs-modal')?.hidden,cats:document.querySelectorAll('.cs-atlas-cat').length})));
await page.click('[data-cs="modal-close"]');
await page.waitForTimeout(300);
// quiz
await page.click('.cs-top-actions [data-cs="quiz"]');
await page.waitForTimeout(500);
await page.screenshot({path:'screenshots/cosmos-quiz.png', timeout:60000}).catch(e=>console.log('quiz shot',e.message));
console.log('quiz', await page.evaluate(()=>({open:!document.querySelector('#cs-modal')?.hidden,q:document.querySelector('.cs-quiz h3')?.textContent,opts:document.querySelectorAll('.cs-quiz-option').length})));
await page.click('[data-cs="modal-close"]');
await page.waitForTimeout(300);
// presentation
await page.click('.cs-top-actions [data-cs="present"]');
await page.waitForTimeout(900);
console.log('present', await page.evaluate(()=>({presenting:window.COSMOS?.presenting, chrome:!document.querySelector('.cs-present-chrome')?.hidden, topbar:getComputedStyle(document.querySelector('.cs-topbar')).display})));
await page.screenshot({path:'screenshots/cosmos-present.png', timeout:60000}).catch(e=>console.log('present shot',e.message));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
console.log('errors', errors.slice(0,12));
await browser.close();
