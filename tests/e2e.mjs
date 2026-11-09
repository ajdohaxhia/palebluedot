/**
 * EON end-to-end verification.
 * Run: node tests/e2e.mjs
 * Requires a local server: python3 -m http.server 5173
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.EON_URL || 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const shots = 'screenshots';
fs.mkdirSync(shots, { recursive: true });
const results = [];
const errors = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
}
async function state(page) {
  return page.evaluate(() => ({
    domain: EON.domain,
    ready: EON.ready,
    catalogsReady: EON.catalogsReady,
    selection: EON.selection,
    inspector: document.querySelector('#object-name')?.textContent,
    breadcrumbs: document.querySelector('#breadcrumbs')?.textContent.replace(/\s+/g, ' ').trim(),
    fps: Math.round(EON.engine?.fps || 0),
  }));
}
async function waitDomain(page, domain, timeout = 90000) {
  await page.waitForFunction(d => window.EON?.domain === d, domain, { timeout });
}
async function search(page, query) {
  await page.click('#search-input');
  await page.fill('#search-input', query);
  await page.waitForSelector('.search-result', { timeout: 20000 });
  await page.keyboard.press('Enter');
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--no-sandbox'],
});

/* ------------------------------------------------------------------------- */
/* Desktop                                                                   */
/* ------------------------------------------------------------------------- */
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('GL Driver')) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + ' :: ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
page.on('requestfailed', r => { if (!r.url().includes('favicon')) errors.push(`REQFAIL ${r.url()} ${r.failure()?.errorText}`); });

await page.goto(BASE + '?quality=low', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.EON?.ready, null, { timeout: 90000 });
await page.waitForFunction(() => window.EON?.catalogsReady, null, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2500);

let s = await state(page);
check('Launch renders Earth with a live 3D canvas', s.ready && s.domain === 'earth' && (await page.evaluate(() => document.querySelector('#scene-canvas').width > 0)), JSON.stringify(s));
check('Catalogue index loaded', s.catalogsReady, 'HYG + exoplanets + SDSS');
await page.screenshot({ path: `${shots}/qa-01-earth.png` });

// Earth interaction: drag to orbit and wheel to zoom.
const before = await page.evaluate(() => EON.earth.camera.position.toArray());
await page.mouse.move(640, 420);
await page.mouse.down();
await page.mouse.move(760, 470, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(900);
await page.mouse.wheel(0, -350);
await page.waitForTimeout(900);
const after = await page.evaluate(() => EON.earth.camera.position.toArray());
check('Earth camera responds to orbit and zoom', Math.hypot(after[0]-before[0], after[1]-before[1], after[2]-before[2]) > 0.02, `${before.map(v=>v.toFixed(2))} → ${after.map(v=>v.toFixed(2))}`);

// Search Saturn.
await search(page, 'Saturn');
await waitDomain(page, 'solar');
await page.waitForTimeout(1200);
s = await state(page);
const solar = await page.evaluate(() => ({
  ready: EON.solar?.ready, focus: EON.solar?.focusId,
  pos: EON.solar?.bodies.get('saturn')?.group.position.toArray(),
  inspector: document.querySelector('#object-name')?.textContent,
}));
check('Search Saturn opens the Solar System and inspects Saturn', s.domain === 'solar' && solar.ready && solar.inspector === 'Saturn', JSON.stringify(solar));
await page.screenshot({ path: `${shots}/qa-02-saturn.png` });

// Time simulation changes positions.
const posA = await page.evaluate(() => EON.solar.bodies.get('saturn').group.position.toArray());
await page.evaluate(() => EON.time.setDate(new Date('2032-01-01T00:00:00Z')));
await page.waitForTimeout(1300);
const posB = await page.evaluate(() => EON.solar.bodies.get('saturn').group.position.toArray());
const moved = Math.hypot((posB[0]-posA[0]), (posB[1]-posA[1]), (posB[2]-posA[2]));
check('Changing simulation date moves Saturn', moved > 0.01, `Δ ${moved.toFixed(3)} AU`);
// Date input control
await page.click('#time-date');
await page.waitForTimeout(300);
await page.fill('#time-input', '2035-06-01');
await page.dispatchEvent('#time-input', 'change');
await page.waitForTimeout(400);
const timeInputDate = await page.evaluate(() => EON.time.date.getUTCFullYear());
check('Date input control drives the simulation', timeInputDate === 2035, String(timeInputDate));
await page.click('#time-close').catch(()=>{});

// Sirius.
await search(page, 'Sirius');
await waitDomain(page, 'deep');
await page.waitForTimeout(1500);
s = await state(page);
const sirius = await page.evaluate(() => ({
  name: document.querySelector('#object-name')?.textContent,
  dist: document.querySelector('.fact-value')?.textContent,
  selection: EON.selection,
  labels: EON.deep?.labels?.items?.filter(i => i.el.style.display !== 'none').map(i => i.id).slice(0, 8),
}));
check('Search Sirius reaches the stellar atlas and shows real data', s.domain === 'deep' && sirius.name === 'Sirius' && sirius.selection?.kind === 'star', JSON.stringify({ domain: s.domain, name: sirius.name, labels: sirius.labels }));
await page.screenshot({ path: `${shots}/qa-03-sirius.png` });

// Explore the Milky Way.
await page.evaluate(() => EON.deep.focusMilkyWay());
await page.waitForTimeout(1600);
await page.screenshot({ path: `${shots}/qa-04-milkyway.png` });

// Andromeda via search.
await search(page, 'Andromeda');
await page.waitForTimeout(1600);
s = await state(page);
const andromeda = await page.evaluate(() => ({
  domain: EON.domain,
  inspector: document.querySelector('#object-name')?.textContent,
  dist: [...document.querySelectorAll('.fact-value')].map(e => e.textContent).find(v => /Mly/.test(v)),
}));
check('Search Andromeda opens the extragalactic atlas', andromeda.inspector === 'Andromeda Galaxy' && andromeda.domain === 'deep', JSON.stringify(andromeda));
await page.screenshot({ path: `${shots}/qa-05-andromeda.png` });

// Exoplanet system.
await search(page, 'TRAPPIST-1e');
await waitDomain(page, 'exo');
await page.waitForTimeout(1500);
const exo = await page.evaluate(() => ({
  domain: EON.domain,
  host: EON.exoSystem?.host,
  planets: EON.exo?.planets?.length,
  inspector: document.querySelector('#object-name')?.textContent,
  visibleReturn: !document.querySelector('#exo-return')?.hidden,
  note: document.querySelector('#object-viz-note')?.textContent,
}));
check('TRAPPIST-1e opens a 3D exoplanet system with honest visualization note', exo.domain === 'exo' && exo.planets === 7 && exo.inspector === 'TRAPPIST-1 e' && /Artist/.test(exo.note || ''), JSON.stringify(exo));
await page.screenshot({ path: `${shots}/qa-06-trappist.png` });

// Return to deep atlas.
await page.click('#exo-return');
await waitDomain(page, 'deep');
check('Return control leaves the exoplanet system', (await state(page)).domain === 'deep');

// Cosmic scale controller.
await page.evaluate(() => { document.querySelector('.scale-stop[data-id="local-group"]').click(); });
await page.waitForTimeout(700);
const scale = await page.evaluate(() => ({ domain: EON.domain, report: EON.activeScene?.getScaleReport?.(), target: EON.deep?.rig?.targetDistance, level: EON.deep?.focusLevel, caption: document.querySelector('#scale-caption')?.textContent }));
check('Cosmic scale controller navigates to the Local Group', scale.domain === 'deep' && scale.level === 'local', JSON.stringify(scale));
await page.screenshot({ path: `${shots}/qa-07-local-group.png` });

// Guided tour.
await page.click('#tour-button');
await page.waitForSelector('.tour-option');
await page.screenshot({ path: `${shots}/qa-08-tours.png` });
await page.click('.tour-option');
await page.waitForSelector('#tour-card:not([hidden])', { timeout: 20000 });
await page.waitForTimeout(1500);
const tour1 = await page.evaluate(() => ({
  visible: !document.querySelector('#tour-card')?.hidden,
  title: document.querySelector('#tour-title')?.textContent,
  progress: document.querySelector('#tour-progress-text')?.textContent,
  stopCount: EON.tour?.stops?.length,
}));
check('Guided tour starts and presents a real stop', tour1.visible && tour1.stopCount > 0, JSON.stringify(tour1));
await page.screenshot({ path: `${shots}/qa-09-tour.png` });
await page.click('#tour-next');
await page.waitForTimeout(1800);
const tour2 = await page.evaluate(() => document.querySelector('#tour-progress-text')?.textContent);
check('Tour advances to the next stop', tour2 === '2 / 6' || tour2 === '2 / 5' || tour2 === '2 / 4', String(tour2));
await page.click('#tour-exit');

check('No uncaught browser errors during the desktop journey', errors.length === 0, errors.slice(0, 4).join(' | '));

/* ------------------------------------------------------------------------- */
/* Mobile                                                                    */
/* ------------------------------------------------------------------------- */
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mobileErrors = [];
mobile.on('pageerror', e => mobileErrors.push(e.message));
mobile.on('console', m => { if (m.type() === 'error' && !m.text().includes('GL Driver')) mobileErrors.push(m.text()); });
await mobile.goto(BASE + '?quality=low', { waitUntil: 'domcontentloaded', timeout: 90000 });
await mobile.waitForFunction(() => window.EON?.ready, null, { timeout: 90000 });
await mobile.waitForTimeout(2500);
const m = await mobile.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  canvas: document.querySelector('#scene-canvas').getBoundingClientRect().width,
  inspectorOpen: document.querySelector('#inspector')?.classList.contains('is-open'),
  scaleRailHidden: getComputedStyle(document.querySelector('#scale-rail')).display === 'none',
}));
check('Mobile layout fits the viewport', !m.overflow && m.canvas === 390, JSON.stringify(m));
await mobile.click('#mobile-scale-button');
await mobile.waitForTimeout(400);
const sheet = await mobile.evaluate(() => ({
  display: getComputedStyle(document.querySelector('#scale-rail')).display,
  open: document.querySelector('#scale-rail')?.classList.contains('is-mobile-open'),
}));
check('Mobile cosmic scale sheet opens', sheet.display !== 'none' && sheet.open, JSON.stringify(sheet));
await mobile.screenshot({ path: `${shots}/qa-10-mobile-scale.png` });
await mobile.click('#search-input');
await mobile.waitForTimeout(300);
const searchOpen = await mobile.evaluate(() => document.querySelector('#search-wrap')?.classList.contains('is-mobile-open'));
check('Mobile search becomes a full-screen layer', searchOpen === true);
await mobile.fill('#search-input', 'Earth');
await mobile.waitForTimeout(800);
await mobile.keyboard.press('Enter');
await mobile.waitForTimeout(1800);
const mobileInspector = await mobile.evaluate(() => ({
  open: document.querySelector('#inspector')?.classList.contains('is-open'),
  name: document.querySelector('#object-name')?.textContent,
  sheetTop: document.querySelector('#inspector')?.getBoundingClientRect().top,
}));
check('Mobile object inspector opens as a bottom sheet', mobileInspector.open && mobileInspector.name === 'Earth', JSON.stringify(mobileInspector));
await mobile.screenshot({ path: `${shots}/qa-11-mobile-earth.png` });
check('No uncaught browser errors on mobile', mobileErrors.length === 0, mobileErrors.slice(0, 3).join(' | '));

/* ------------------------------------------------------------------------- */
/* Catalogue-failure resilience                                              */
/* ------------------------------------------------------------------------- */
const offline = await browser.newPage({ viewport: { width: 1000, height: 700 } });
let offlineErrors = 0;
offline.on('pageerror', () => offlineErrors++);
await offline.route('**/*', route => {
  const pathname = new URL(route.request().url()).pathname;
  if (pathname.startsWith('/data/')) return route.abort();
  return route.continue();
});
await offline.goto(BASE + '?quality=low', { waitUntil: 'domcontentloaded', timeout: 90000 });
await offline.waitForFunction(() => window.EON, null, { timeout: 90000 }).catch(() => {});
await offline.waitForFunction(() => window.EON?.ready, null, { timeout: 90000 }).catch(() => {});
await offline.waitForTimeout(2500);
const off = await offline.evaluate(() => ({
  ready: EON.ready,
  earth: !!EON.earth,
  catalogsReady: EON.catalogsReady,
  fatal: document.querySelector('#loading-error')?.textContent,
  toast: document.querySelector('#toast')?.textContent,
}));
check('Core Earth experience survives an unavailable catalogue', off.ready && off.earth && !off.catalogsReady, JSON.stringify(off));
check('Offline fallback does not crash the renderer', offlineErrors === 0, String(offlineErrors));

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (errors.length) console.log('Browser errors:', errors);
if (failed.length) {
  console.log('Failures:', failed);
  process.exitCode = 1;
}
