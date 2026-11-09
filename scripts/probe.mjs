import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--disable-gpu-sandbox','--no-sandbox','--force-device-scale-factor=1'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(12000);
console.log(await page.evaluate(() => {
  const e = window.EON;
  return {
    ready: e?.ready, domain: e?.domain,
    fps: e?.engine?.fps, quality: e?.settings?.quality,
    loadingHidden: document.querySelector('#loading-screen')?.classList.contains('is-hidden'),
    loadingText: document.querySelector('#loading-status')?.textContent,
    percent: document.querySelector('#loading-percent')?.textContent,
    inspectorOpen: document.querySelector('#inspector')?.classList.contains('is-open'),
    starReady: e?.catalogsReady,
    sceneChildren: e?.activeScene?.scene?.children?.length,
    cameraPos: e?.camera?.position?.toArray(),
    frameCount: e?.engine?.frameCount,
  };
}));
await page.screenshot({ path: 'screenshots/probe.png' });
await browser.close();
