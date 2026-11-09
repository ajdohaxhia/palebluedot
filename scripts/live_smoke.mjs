import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1280,height:800} });
const errors=[], failed=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('GL Driver')) errors.push(m.text());});
page.on('requestfailed',r=>failed.push(`${r.url()} :: ${r.failure()?.errorText}`));
await page.goto('https://eon-atlas.pages.dev/?quality=low', {waitUntil:'domcontentloaded', timeout:90000});
await page.waitForFunction(()=>window.EON?.ready, null, {timeout:90000});
await page.waitForFunction(()=>window.EON?.catalogsReady, null, {timeout:60000}).catch(()=>{});
await page.waitForTimeout(3000);
const state = await page.evaluate(()=>({
  ready:window.EON?.ready, cats:window.EON?.catalogsReady,
  stars:window.EON?.catalogs?.stars?.count, exo:window.EON?.catalogs?.exo?.count,
  sdss:window.EON?.catalogs?.sdss?.count,
  placeholder:document.querySelector('#search-input')?.placeholder,
  domain:window.EON?.domain, title:document.title,
}));
await page.screenshot({path:'screenshots/cloudflare-live.png'});
// exercise real catalogue search against the deployed data
await page.click('#search-input'); await page.fill('#search-input','Sirius'); await page.waitForSelector('.search-result',{timeout:20000});
await page.keyboard.press('Enter');
await page.waitForFunction(()=>window.EON?.domain==='deep', null, {timeout:90000}).catch(()=>{});
await page.waitForTimeout(2500);
const search = await page.evaluate(()=>({domain:window.EON?.domain, name:document.querySelector('#object-name')?.textContent, crumbs:document.querySelector('#breadcrumbs')?.textContent.replace(/\s+/g,' ').trim()}));
console.log(JSON.stringify({state, search, errors, failed}, null, 2));
await page.screenshot({path:'screenshots/cloudflare-live-sirius.png'});
await browser.close();
