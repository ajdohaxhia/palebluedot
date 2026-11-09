import { chromium } from 'playwright-core';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1000,height:650}});
const errors=[],fails=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver'))errors.push(m.text());});
page.on('requestfailed',r=>{if(!r.url().includes('favicon'))fails.push(r.url()+' '+r.failure()?.errorText);});
page.on('response',r=>{if(r.status()>=500)fails.push(r.status()+' '+r.url());});
console.log('goto');
await page.goto('https://cosmos-atlante.pages.dev/?quality=low',{waitUntil:'domcontentloaded',timeout:120000});
console.log('dom loaded');
for (let i=0;i<10;i++) {
  await page.waitForTimeout(9000);
  const s=await page.evaluate(()=>({
    ready:!!window.EON?.ready, cats:!!window.EON?.catalogsReady,
    root:document.querySelector('#cosmos-root')?.hidden, landing:document.querySelector('.cs-landing')?.hidden,
    loading:document.querySelector('#loading-screen')?.className, status:document.querySelector('#loading-status')?.textContent,
    percent:document.querySelector('#loading-percent')?.textContent,
    cta:document.querySelector('.cs-landing-actions .cs-primary')?.textContent?.trim(),
    title:document.title,
  }));
  console.log('tick',i,s);
  if (s.ready && s.landing===false) break;
}
const st=await page.evaluate(()=>({ready:!!window.EON?.ready,landing:!document.querySelector('.cs-landing')?.hidden,root:!document.querySelector('#cosmos-root')?.hidden,title:document.title,cta:document.querySelector('.cs-landing-actions .cs-primary')?.textContent?.trim(),loading:document.querySelector('#loading-status')?.textContent,percent:document.querySelector('#loading-percent')?.textContent}));
console.log('final state',st);
if (st.landing) {
  await page.click('[data-cs="start"]'); await page.waitForTimeout(1200);
  console.log('started',await page.evaluate(()=>({title:document.querySelector('#cs-panel-title')?.textContent,counter:document.querySelector('#cs-bottom-count')?.textContent,img:document.querySelector('#cs-stage-body img')?.naturalWidth,domain:EON.domain})));
}
console.log('errors',errors.slice(0,8));
console.log('fails',fails.slice(0,8));
await browser.close();
