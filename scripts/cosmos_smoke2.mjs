import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1024,height:700} });
const errors=[];
page.on('pageerror',e=>errors.push('PAGEERROR '+e.message+'\n'+(e.stack||'').split('\n').slice(1,4).join('\n')));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver')) errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.waitForTimeout(2000);
console.log('errors after load', errors);
const click = await page.evaluate(()=>{ const b=document.querySelector('[data-cs="start"]'); if(!b) return 'no'; b.click(); return 'clicked'; });
console.log('click',click);
await page.waitForTimeout(5000);
const st = await page.evaluate(()=>({
  active:window.COSMOS?.active, title:document.querySelector('#cs-panel-title')?.textContent,
  cardHidden:document.querySelector('#cs-stage-card')?.hidden,
  cardChildren:document.querySelector('#cs-stage-body')?.children.length,
  image:document.querySelector('#cs-stage-body img')?.complete,
  imageW:document.querySelector('#cs-stage-body img')?.naturalWidth,
  stageLabel:document.querySelector('#cs-stage-label')?.textContent,
  panel:document.querySelector('#cs-panel-content')?.textContent?.slice(0,80),
  domain:EON?.domain, scene:EON?.activeScene?.constructor?.name,
  fps:EON?.engine?.fps,
}));
console.log('state',st);
console.log('errors',errors);
await page.screenshot({path:'screenshots/cosmos-step1-small.png', timeout:60000}).catch(e=>console.log('shot err',e.message));
await page.click('[data-cs="next"]').catch(e=>console.log('next err',e.message));
await page.waitForTimeout(2000);
console.log('step2',await page.evaluate(()=>({title:document.querySelector('#cs-panel-title')?.textContent,stage:document.querySelector('#cs-stage-label')?.textContent,cardChildren:document.querySelector('#cs-stage-body')?.children.length,domain:EON?.domain,errors:window.__errs})));
await page.screenshot({path:'screenshots/cosmos-step2-small.png', timeout:60000}).catch(e=>console.log('shot2 err',e.message));
console.log('final errors',errors.slice(0,10));
await browser.close();
