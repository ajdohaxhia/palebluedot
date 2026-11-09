import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver'))errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?quality=low',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready,null,{timeout:90000});
await page.evaluate(()=>localStorage.removeItem('cosmos.step'));
await page.waitForTimeout(1200);
await page.screenshot({path:'screenshots/cosmos-landing-2.png', timeout:60000}).catch(e=>console.log(e.message));
console.log('landing buttons', await page.evaluate(()=>[...document.querySelectorAll('.cs-landing-actions button')].map(b=>{const s=getComputedStyle(b);return {text:b.textContent.trim(),bg:s.backgroundColor,border:s.borderColor,fs:s.fontSize,color:s.color}})));
await page.click('[data-cs="start"]'); await page.waitForTimeout(2500);
// go to 5, 11, 24, 27, 32 with nav clicks via JS
async function go(n){await page.evaluate(n=>window.COSMOS.go(n-1),n); await page.waitForTimeout(1400);}
for (const n of [5,11,24,27,32]) { await go(n); await page.screenshot({path:`screenshots/cosmos-retake-${n}.png`, timeout:60000}).catch(e=>console.log('shot',n,e.message)); }
console.log('errors',errors.slice(0,10));
await browser.close();
