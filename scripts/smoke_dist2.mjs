import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1000,height:650} });
const errors=[], failed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver')) errors.push(m.text());});
page.on('requestfailed',r=>failed.push(r.url()));
await page.goto('http://127.0.0.1:5180/', {waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.EON?.ready, null, {timeout:90000}).catch(()=>{});
await page.waitForFunction(()=>window.EON?.catalogsReady, null, {timeout:60000}).catch(()=>{});
const state = await page.evaluate(()=>({
  ready:window.EON?.ready, cats:window.EON?.catalogsReady,
  stars:window.EON?.catalogs?.stars?.count, exo:window.EON?.catalogs?.exo?.count,
  sdss:window.EON?.catalogs?.sdss?.count,
  searchEntries:window.EON?.catalogs?.searchIndex?.length,
  toast:document.querySelector('#toast')?.textContent,
}));
console.log(JSON.stringify({state, failed, errors}, null, 2));
await page.screenshot({path:'screenshots/deploy-dist-smoke.png'});
await browser.close();
