/**
 * COSMOS browser verification.
 * Prerequisite: `npm start` (http://127.0.0.1:5173).
 * Uses the locally installed Chrome and software WebGL so it runs headless.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { LESSON } from "../src/data/lesson.js";
import { STAGE_CONFIG } from "../src/cosmos/stage-config.js";

const URL = process.env.COSMOS_URL || "http://127.0.0.1:5173/?quality=low";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const watchdog = setTimeout(() => { console.error("COSMOS E2E watchdog: wall clock exceeded"); process.exit(2); }, 240000);
watchdog.unref?.();

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", e => errors.push(`pageerror: ${e.message}`));
page.on("console", m => {
  if (m.type() === "error" && !/GL Driver|WebGL|Failed to load resource/i.test(m.text())) errors.push(`console: ${m.text()}`);
});
await page.addInitScript(() => { try { localStorage.removeItem("cosmos.step"); localStorage.removeItem("cosmos.motion"); } catch {} });
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.EON?.ready, null, { timeout: 90000 });
await page.waitForTimeout(1200);

/* ---- landing ---- */
assert.equal(await page.locator("#cosmos-root").isVisible(), true, "root visible");
assert.equal(await page.locator(".cs-landing").isVisible(), true, "landing visible");
assert.equal(await page.locator("body").evaluate(b => getComputedStyle(b.querySelector("#hud")).display), "none", "legacy HUD hidden");
assert.match(await page.locator(".cs-landing h1").textContent(), /COSMOS/);
assert.match(await page.locator(".cs-landing-actions .cs-primary").textContent(), /Inizia l.esplorazione/);
assert.equal(await page.locator('.cs-landing-actions [data-cs="free-atlas"]').count(), 1, 'free atlas entry on landing');
await page.locator(".cs-landing-actions .cs-primary").click();
await page.waitForTimeout(1000);
assert.equal(await page.locator(".cs-app").isVisible(), true, "app visible");
console.log("landing → app OK");

/* ---- 32-step walk ---- */
const stageKinds = new Set();
for (const step of LESSON.steps) {
  await page.evaluate(n => window.COSMOS.go(n - 1), step.n);
  await page.waitForTimeout(90);
  const st = await page.evaluate(() => ({
    title: document.querySelector("#cs-panel-title")?.textContent?.trim(),
    section: document.querySelector("#cs-panel-kicker")?.textContent || "",
    count: document.querySelector("#cs-bottom-count")?.textContent || "",
    card: !!document.querySelector("#cs-stage-card") && !document.querySelector("#cs-stage-card").hidden,
    target: !!document.querySelector("#cs-target") && !document.querySelector("#cs-target").hidden,
    targetLabel: document.querySelector("#cs-target-label")?.textContent || "",
    toolCta: document.querySelectorAll(".cs-tool-cta").length,
    chips: document.querySelectorAll(".cs-chip").length,
    bodyChildren: document.querySelector("#cs-stage-body")?.children.length || 0,
    slideLink: !!document.querySelector('[data-cs="slide"]'),
    levels: document.querySelectorAll(".cs-level-tabs button").length,
  }));
  assert.equal(st.title, step.title, `slide ${step.n} title`);
  assert.equal(st.count, `${String(step.n).padStart(2, "0")} / 32`, `slide ${step.n} counter`);
  assert.equal(st.levels, 3, `slide ${step.n} explanation levels`);
  assert.equal(st.slideLink, true, `slide ${step.n} source access`);
  const cfg = STAGE_CONFIG[step.n];
  stageKinds.add(cfg.type);
  assert.equal(st.card, false, `slide ${step.n} 3D-first default must not cover the universe`);
  assert.equal(st.target, true, `slide ${step.n} 3D target`);
  assert.ok(st.targetLabel.length > 1, `slide ${step.n} target label`);
  if (cfg.type !== "atlas") assert.equal(st.toolCta >= 1, true, `slide ${step.n} optional interactive instrument`);
  if (step.notes) {
    await page.locator(".cs-level-tabs button").nth(2).click();
    await page.waitForTimeout(60);
    assert.equal(await page.locator(".cs-notes").count() > 0, true, `slide ${step.n} speaker notes reachable`);
    await page.locator(".cs-level-tabs button").nth(0).click();
  }
}
assert.deepEqual([...stageKinds].sort(), ["atlas", "boundaries", "distance", "gallery", "image", "scale", "timeline"]);
console.log("32/32 steps OK; stage types:", [...stageKinds].join(", "));

/* ---- original slide viewer ---- */
await page.locator('.cs-top-actions [data-cs="slide"]').click();
await page.waitForTimeout(500);
assert.equal(await page.locator("#cs-modal").isVisible(), true, "slide modal open");
assert.ok(await page.locator("#cs-modal img").evaluate(img => img.naturalWidth) >= 1400, "original slide decoded");
await page.locator(".cs-modal-close").click();
await page.waitForTimeout(200);
assert.equal(await page.locator("#cs-modal").isHidden(), true, "slide modal closed");
console.log("original slide viewer OK");

/* ---- atlas ---- */
await page.locator('.cs-top-actions [data-cs="atlas"]').click();
await page.waitForTimeout(300);
assert.equal(await page.locator(".cs-atlas-cat").count(), 12, "12 atlas categories");
await page.locator(".cs-atlas-chips button").first().click();
await page.waitForTimeout(400);
assert.equal(await page.locator("#cs-modal").isHidden(), true, "atlas jump closes modal");
console.log("atlas OK");

/* ---- quiz ---- */
await page.locator('.cs-top-actions [data-cs="quiz"]').click();
await page.waitForTimeout(300);
assert.equal(await page.locator(".cs-quiz-option").count() >= 2, true, "quiz options");
await page.locator(".cs-quiz-option").first().click();
await page.waitForTimeout(200);
assert.equal(await page.locator(".cs-quiz-feedback").isVisible(), true, "quiz feedback");
assert.equal(await page.locator('[data-cs="quiz-next"]').isVisible(), true, "quiz next");
await page.locator(".cs-modal-close").click();
await page.waitForTimeout(200);
console.log("quiz OK");

/* ---- presentation & reset ---- */
await page.locator('.cs-top-actions [data-cs="present"]').click();
await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => window.COSMOS.presenting), true);
assert.equal(await page.locator(".cs-topbar").evaluate(e => getComputedStyle(e).display), "none");
assert.equal(await page.locator(".cs-present-chrome").isVisible(), true);
assert.equal(await page.locator(".cs-panel").isVisible(), true, 'presentation keeps the explanation beside the 3D');
assert.equal(await page.locator(".cs-present-actions button").count(), 3, 'presentation chapter and slide controls');
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
assert.equal(await page.evaluate(() => window.COSMOS.presenting), false);
await page.keyboard.press("r");
await page.waitForTimeout(200);
console.log("presentation + reset OK");

/* ---- free first-version atlas ---- */
await page.locator('.cs-top-actions [data-cs="free-atlas"]').click();
await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => window.COSMOS.freeAtlas), true, 'free atlas active');
assert.equal(await page.locator('#hud').evaluate(e => getComputedStyle(e).display), 'block', 'legacy full atlas HUD visible');
assert.equal(await page.locator('#cosmos-root').isHidden(), true, 'COSMOS layer hidden in free atlas');
assert.equal(await page.locator('.cs-scale-rail, #scale-rail').first().isVisible(), true, 'cosmic scale navigator available');
assert.equal(await page.locator('#cosmos-free-return').isVisible(), true, 'return to presentation available');
await page.locator('#cosmos-free-return').click();
await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => window.COSMOS.freeAtlas), false, 'returned from free atlas');
assert.equal(await page.locator('#hud').evaluate(e => getComputedStyle(e).display), 'none', 'legacy HUD hidden again');
console.log("free first-version atlas OK");

/* ---- mobile ---- */
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
m.on("pageerror", e => errors.push(`mobile pageerror: ${e.message}`));
m.on("console", msg => { if (msg.type() === "error" && !/GL Driver|WebGL|Failed to load resource/i.test(msg.text())) errors.push(`mobile console: ${msg.text()}`); });
await m.addInitScript(() => { try { localStorage.removeItem("cosmos.step"); } catch {} });
await m.goto(URL, { waitUntil: "domcontentloaded" });
await m.waitForFunction(() => window.EON?.ready, null, { timeout: 90000 });
await m.waitForTimeout(1000);
assert.equal(await m.locator(".cs-landing").isVisible(), true);
assert.ok(await m.evaluate(() => document.querySelector(".cs-landing").scrollWidth <= innerWidth + 1), "landing no horizontal overflow");
await m.locator(".cs-landing-actions .cs-primary").click();
await m.waitForTimeout(600);
assert.equal(await m.locator("#cs-stage-card").isVisible(), false, "mobile starts on the 3D universe");
assert.equal(await m.locator("#cs-target").isVisible(), true, "mobile 3D target");
assert.equal(await m.locator(".cs-panel").isVisible(), true, "mobile teaching panel");
await m.locator(".cs-tool-cta").click();
await m.waitForTimeout(250);
assert.equal(await m.locator("#cs-stage-card").isVisible(), true, "mobile instrument drawer opens");
await m.locator(".cs-card-toggle").click();
await m.waitForTimeout(200);
await m.locator(".cs-mobile-only").first().click();
await m.waitForTimeout(250);
assert.equal(await m.locator(".cs-nav").evaluate(e => e.classList.contains("is-open")), true, "mobile chapter drawer");
await m.locator(".cs-close-nav").click();
await m.waitForTimeout(200);
assert.equal(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "app no horizontal overflow");
console.log("mobile landing, card, panel and chapter drawer OK");

if (errors.length) {
  console.error("Browser errors:", errors);
  process.exit(1);
}
console.log("COSMOS E2E: all checks passed");
clearTimeout(watchdog);
browser.close().catch(() => {});
setTimeout(() => process.exit(0), 100);
