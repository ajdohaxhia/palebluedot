import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.evaluate(()=>localStorage.removeItem('cosmos.step'));
await page.waitForTimeout(600); await page.click('[data-cs="start"]'); await page.waitForTimeout(400);
for (const n of [24,27,30]) {
  await page.evaluate(n=>window.COSMOS.go(n-1),n); await page.waitForTimeout(500);
  console.log('SCALE'+n, JSON.stringify(await page.evaluate(()=>{
    const vp=document.querySelector('.cs-scale-viewport'); const row=document.querySelector('.cs-scale-row');
    const objects=[...document.querySelectorAll('.cs-scale-object')].map(b=>{const r=b.getBoundingClientRect();return {n:b.querySelector('.cs-scale-name')?.textContent,x:Math.round(r.x),w:Math.round(r.width)}});
    return {vp:vp?.getBoundingClientRect().toJSON(),row:row?.getBoundingClientRect().toJSON(),overflow:vp?vp.scrollWidth>vp.clientWidth:null,objects};
  })));
}
await browser.close();
