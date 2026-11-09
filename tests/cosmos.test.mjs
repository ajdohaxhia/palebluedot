/** COSMOS content, coverage and scientific-instrument verification. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LESSON, LESSON_SECTIONS } from "../src/data/lesson.js";
import { PRESENTATION_SLIDES } from "../src/data/presentation.js";
import { STAGE_CONFIG, ATLAS_CATEGORIES, QUIZ } from "../src/cosmos/stage-config.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "src/content/presentation-map.json"), "utf8"));
const exists = p => fs.existsSync(path.join(ROOT, p));

test("the supplied deck is represented by 32 COSMOS steps", () => {
  assert.equal(PRESENTATION_SLIDES.length, 32);
  assert.equal(LESSON.steps.length, 32);
  assert.equal(MAP.slides.length, 32);
  assert.equal(MAP.summary.coverage, "32/32");
  assert.equal(MAP.summary.threeDScenes, 32);
  assert.equal(new Set(LESSON.steps.map(s => s.n)).size, 32);
  for (let n = 1; n <= 32; n++) {
    const step = LESSON.steps[n - 1];
    assert.equal(step.n, n);
    assert.ok(step.title && step.summary && step.kicker, `step ${n} content`);
    assert.ok(step.scene?.domain, `step ${n} scene`);
    assert.ok(step.facts.length >= 1, `step ${n} facts`);
  }
});

test("every source slide image exists and is accessible", () => {
  for (const step of LESSON.steps) {
    assert.ok(exists(step.slide), step.slide);
    assert.ok(exists(step.cover || "assets/cosmos/images/pale-blue-dot.png"));
    assert.ok(step.slide.endsWith(".png"));
  }
});

test("all 21 speaker-note entries survive into the lesson and map", () => {
  const withNotes = LESSON.steps.filter(s => s.notes && s.notes.trim());
  assert.equal(withNotes.length, 21);
  for (const step of withNotes) {
    const map = MAP.slides.find(s => s.slide === step.n);
    assert.ok(map.speakerNotes.includes(step.notes.slice(0, 60)), `slide ${step.n} notes`);
    assert.equal(map.notesPreserved, true);
  }
});

test("every step has a real interactive stage", () => {
  const allowed = new Set(["atlas", "image", "scale", "distance", "boundaries", "timeline", "gallery"]);
  for (const step of LESSON.steps) {
    const cfg = STAGE_CONFIG[step.n];
    assert.ok(cfg, `stage config ${step.n}`);
    assert.ok(allowed.has(cfg.type), `stage type ${cfg.type}`);
    if (cfg.type === "image") {
      assert.ok(cfg.src && exists(cfg.src), `image ${cfg.src}`);
      assert.ok(cfg.alt, "image alt");
    }
    if (cfg.type === "scale") assert.ok(cfg.objects.length >= 2);
    if (cfg.type === "gallery") assert.ok(cfg.items.length >= 2);
    if (cfg.type === "timeline") assert.ok(cfg.events.length >= 3);
    if (cfg.type === "atlas") assert.ok(step.scene.domain);
  }
});

test("map carries objectives, objects, values, sources and completion for every slide", () => {
  for (const slide of MAP.slides) {
    assert.ok(slide.heading);
    assert.ok(slide.teachingObjective.length > 10);
    assert.ok(slide.astronomicalObjects.length > 0);
    assert.ok(slide.numericalValues.length > 0);
    assert.ok(slide.sourceCitations.length > 0);
    assert.equal(slide.completionStatus, "implemented");
    assert.equal(slide.hasOriginalSlideAccess, true);
    assert.ok(slide.plannedInteractiveComponent.label);
    assert.equal(slide.primaryMedium, "3D universe");
    assert.ok(slide.threeDScene?.label, `slide ${slide.slide} 3D scene`);
    assert.equal(slide.threeDScene.primary, true);
  }
});

test("atlas categories cover all 32 source slides", () => {
  const seen = new Set();
  for (const cat of ATLAS_CATEGORIES) for (const n of cat.steps) seen.add(n);
  assert.equal(ATLAS_CATEGORIES.length, 12);
  for (let n = 1; n <= 32; n++) assert.ok(seen.has(n), `slide ${n} missing from atlas categories`);
});

test("quiz answers and explanations point to valid slides", () => {
  assert.ok(QUIZ.length >= 10);
  for (const q of QUIZ) {
    assert.ok(q.options.length >= 2);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
    assert.ok(q.why.length > 15);
    assert.ok(q.slide >= 1 && q.slide <= 32);
  }
});

test("unit constants and light-travel examples are consistent", () => {
  const c = 299_792.458;
  const AU = 149_597_870.7;
  const LY = 9.460_730_472_580_8e12;
  assert.ok(Math.abs(LY / c / 86400 - 365.25) < 0.01);
  assert.ok(Math.abs(AU / c - 499.004) < 0.1);
  assert.ok(Math.abs(384_400 / c - 1.282) < 0.01);
  // VY CMa at 1,420 R☉: dynamic light circumference.
  const rVY = 1420 * 696_340;
  const lightSeconds = (2 * Math.PI * rVY) / c;
  assert.ok(lightSeconds / 3600 > 5.5 && lightSeconds / 3600 < 6.1);
  assert.match(LESSON.steps[29].caveat, /5,8 ore/);
  assert.match(LESSON.steps[29].caveat, /8 ore/);
});

test("cosmic-calendar arithmetic is correct and annotated", () => {
  const expectedMinutes = 300_000 / 13.8e9 * 365.25 * 24 * 60;
  assert.ok(Math.abs(expectedMinutes - 11.43) < 0.05);
  const mm = 300_000 / 13.8e9 * 1000;
  assert.ok(Math.abs(mm - 0.0217) < 0.001);
  const cfg = STAGE_CONFIG[32];
  assert.match(cfg.note, /0,022 mm/);
  assert.match(LESSON.steps[31].caveat, /approssimativ/);
});

test("scientific corrections are present for sensitive source claims", () => {
  const s = n => LESSON.steps.find(x => x.n === n);
  assert.match(s(22).caveat, /Nebulosa Aquila/);
  assert.match(s(22).caveat, /Sole/);
  assert.match(s(22).caveat, /non si è formato/);
  assert.match(s(23).caveat, /2 × 10²⁷/);
  assert.match(s(30).caveat, /5,8 ore/);
  assert.match(s(31).caveat, /909/);
  assert.match(s(31).caveat, /1.708/);
  assert.match(s(10).caveat, /placca Pioneer|placca/);
  assert.match(s(18).caveat, /2,54|2.54/);
  assert.match(s(20).caveat, /orizzonte|bordo/);
  assert.match(s(1).caveat, /1990/);
});

test("Apollo 11 timeline distinguishes landing from the first step", () => {
  const events = STAGE_CONFIG[7].events;
  const landing = events.find(e => /Allunaggio/i.test(e.title));
  const step = events.find(e => /Primo passo/i.test(e.title));
  assert.ok(landing && step);
  assert.match(landing.date, /20 luglio 1969/);
  assert.match(step.date, /21 luglio 1969/);
  assert.notEqual(landing.date, step.date);
});

test("the presentation viewer can always reach the original slide", () => {
  for (const step of LESSON.steps) {
    assert.ok(step.slide);
    assert.ok(MAP.slides.find(s => s.slide === step.n).hasOriginalSlideAccess);
  }
});
