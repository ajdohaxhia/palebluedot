import { LESSON } from "../data/lesson.js";
import { STAGE_CONFIG, ATLAS_CATEGORIES, QUIZ } from "./stage-config.js";
import {
  mountImageStage, mountScaleStage, mountGalleryStage,
  mountDistanceStage, mountBoundariesStage, mountTimelineStage,
} from "./stages.js";
import { LIMCockpit } from "./LIMCockpit.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const LS = {
  step: "cosmos.step",
  motion: "cosmos.reducedMotion",
  muted: "cosmos.audioMuted",
  fontSize: "cosmos.fontSize",
  visited: "cosmos.visited",
};

const SOURCES = [
  { name: "Presentazione del docente · Geografia astronomica UDA 2 e 3", note: "Fonte didattica primaria del percorso: 32 slide, testi e note del relatore. Le slide originali ad alta risoluzione sono accessibili da ogni tappa.", url: "" },
  { name: "NASA / JPL-Caltech", note: "Voyager 1, Pale Blue Dot (1990); missioni Apollo 11 e 17; sonde Pioneer 10 e 11; parametri fisici ed effemeridi planetarie Standish.", url: "https://www.nasa.gov/" },
  { name: "NASA / ESA / STScI — Hubble Space Telescope", note: "Pilastri della Creazione (M16 nella Nebulosa Aquila) e VY Canis Majoris. Immagini osservative e dati fotometrici.", url: "https://hubblesite.org/" },
  { name: "NASA Exoplanet Archive", note: "Parametri fisici e orbitali dei sistemi esoplanetari confermati usati nell'atlante.", url: "https://exoplanetarchive.ipac.caltech.edu/" },
  { name: "HYG Database v4.1 · Astronomy Nexus", note: "Posizioni 3D, magnitudini, distanze e tipi spettrali delle 119.625 stelle del catalogo; licenza CC BY-SA 4.0.", url: "https://codeberg.org/astronexus/hyg" },
  { name: "SDSS DR18 — Sloan Digital Sky Survey", note: "Campioni di galassie e quasar osservati per la mappa cosmica tridimensionale.", url: "https://www.sdss.org/" },
  { name: "NASA / IPAC NED", note: "Distanze, redshifts comoventi e morfologie degli ammassi e superammassi di galassie.", url: "https://ned.ipac.caltech.edu/" },
  { name: "IAU / NASA Solar System Exploration", note: "Definizioni delle costanti astronomiche (1 UA, anno luce) e parametri fisici del Sistema Solare.", url: "https://science.nasa.gov/solar-system/" },
];

/* -------------------------------------------------------------------------- */
/* Procedural Audio Engine (Web Audio API · zero dependencies)                */
/* -------------------------------------------------------------------------- */
class CosmosAudio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(LS.muted) === "1";
    this.ambientPlaying = false;
    this.droneGain = null;
  }
  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
  }
  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch { /* noop */ }
  }
  playChime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    try {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        const t = this.ctx.currentTime + idx * 0.07;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    } catch { /* noop */ }
  }
  playThud() {
    if (this.muted) return;
    this.init();
    if (!this.ctx || this.ctx.state !== "running") return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(130, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.11);
    } catch { /* noop */ }
  }
  toggle() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    this.muted = !this.muted;
    localStorage.setItem(LS.muted, this.muted ? "1" : "0");
    if (this.muted && this.droneGain) {
      this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
    } else if (!this.muted && this.droneGain) {
      this.droneGain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    }
    return !this.muted;
  }
  toggleAmbience() {
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this.ambientPlaying) {
      if (this.droneGain) this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.ambientPlaying = false;
      return false;
    }
    try {
      if (!this.droneGain) {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        this.droneGain = this.ctx.createGain();
        osc1.type = "sine"; osc1.frequency.setValueAtTime(55, this.ctx.currentTime);
        osc2.type = "sine"; osc2.frequency.setValueAtTime(110.2, this.ctx.currentTime);
        filter.type = "lowpass"; filter.frequency.setValueAtTime(160, this.ctx.currentTime);
        this.droneGain.gain.setValueAtTime(this.muted ? 0 : 0.02, this.ctx.currentTime);
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(this.droneGain);
        this.droneGain.connect(this.ctx.destination);
        osc1.start(); osc2.start();
      } else {
        this.droneGain.gain.setValueAtTime(this.muted ? 0 : 0.02, this.ctx.currentTime);
      }
      this.ambientPlaying = true;
      return true;
    } catch { return false; }
  }
}

/* -------------------------------------------------------------------------- */
/* Italian Speech Synthesis (Web Speech API)                                  */
/* -------------------------------------------------------------------------- */
class CosmosSpeech {
  constructor() {
    this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    this.speaking = false;
    this.onStateChange = null;
  }
  speak(text) {
    if (!this.synth) return;
    this.stop();
    const cleanText = String(text || "")
      .replace(/[•*—_\[\]\(\)]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleanText) return;
    try {
      const u = new SpeechSynthesisUtterance(cleanText);
      u.lang = "it-IT";
      u.rate = 1.0;
      const voices = this.synth.getVoices?.() || [];
      const itVoice = voices.find(v => v.lang.startsWith("it")) || voices.find(v => v.lang.includes("it"));
      if (itVoice) u.voice = itVoice;
      u.onstart = () => { this.speaking = true; this.onStateChange?.(true); };
      u.onend = u.onerror = () => { this.speaking = false; this.onStateChange?.(false); };
      this.synth.speak(u);
    } catch {
      this.speaking = false;
      this.onStateChange?.(false);
    }
  }
  stop() {
    if (!this.synth) return;
    try { this.synth.cancel(); } catch { /* noop */ }
    this.speaking = false;
    this.onStateChange?.(false);
  }
  toggle(text) {
    if (this.speaking) { this.stop(); return false; }
    this.speak(text);
    return true;
  }
}

/* -------------------------------------------------------------------------- */
/* Main COSMOS Application                                                    */
/* -------------------------------------------------------------------------- */
export class CosmosApp {
  constructor({ onScene, onFreeAtlas, onExitFreeAtlas } = {}) {
    this.lesson = LESSON;
    this.steps = LESSON.steps;
    this.stageConfig = STAGE_CONFIG;
    this.onScene = onScene || (() => {});
    this.onFreeAtlas = onFreeAtlas || (() => {});
    this.onExitFreeAtlas = onExitFreeAtlas || (() => {});
    this.current = 0;
    this.level = "capire";
    this.stageView = "atlas";
    this.cardOpen = false;
    this.presenting = false;
    this.freeAtlas = false;
    this.freeAtlasWasPresenting = false;
    this.active = false;
    this.modal = null;
    this.stageInstance = null;
    this.slideInstance = null;
    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizAnswered = false;
    this.quizSelected = null;
    this.quizStreak = 0;
    this.savedStep = Math.max(0, Math.min(this.steps.length - 1, Number(localStorage.getItem(LS.step) || 0)));
    this.visited = new Set(JSON.parse(localStorage.getItem(LS.visited) || "[]"));
    this.fontSize = Number(localStorage.getItem(LS.fontSize) || 0); // -1, 0, 1, 2
    this.navFilter = "";
    this.autoplay = false;
    this.autoplayTimer = null;
    this.autoplayInterval = 10000;
    this.presentTimer = null;
    this.presentSeconds = 0;
    this.laserPointer = false;

    this.audio = new CosmosAudio();
    this.speech = new CosmosSpeech();
    this.speech.onStateChange = speaking => {
      const label = $("#cs-speech-label", this.root);
      const btn = $(".cs-speech-btn", this.root);
      if (label) label.textContent = speaking ? "Pausa voce" : "Ascolta";
      if (btn) btn.classList.toggle("is-speaking", speaking);
    };

    this.root = document.getElementById("cosmos-root");
    if (!this.root) {
      this.root = document.createElement("div");
      this.root.id = "cosmos-root";
      document.body.appendChild(this.root);
    }
    this.root.innerHTML = this.template();
    this.landing = $(".cs-landing", this.root);
    this.app = $(".cs-app", this.root);
    this.stageCard = $("#cs-stage-card", this.root);
    this.stageBody = $("#cs-stage-body", this.root);
    this.stageChips = $("#cs-chips", this.root);
    this.stageHint = $("#cs-stage-hint", this.root);
    this.stageSwitch = $("#cs-view-switch", this.root);
    this.target = $("#cs-target", this.root);
    this.targetLabel = $("#cs-target-label", this.root);
    this.targetCoord = $("#cs-target-coord", this.root);
    this.panel = $(".cs-panel", this.root);
    this.nav = $(".cs-nav", this.root);
    this.module = $("#cs-modal", this.root);
    this.toastEl = $("#cs-toast", this.root);
    this.tickPreview = $("#cs-tick-preview", this.root);
    this.laserDot = $("#cs-laser-dot", this.root);

    document.body.classList.add("cosmos-mode");
    this.applyFontSize();
    this.buildNav();
    this.buildBottomTicks();
    this.bind();
    this.applyMotion();
    this.updateAudioButtonState();
    this.root.hidden = true;
  }

  template() {
    const s = this.lesson;
    return `
      <div class="cs-landing" hidden>
        <div class="cs-landing-bg" aria-hidden="true"></div>
        <div class="cs-landing-particles" aria-hidden="true"></div>
        <div class="cs-landing-top">
          <div class="cs-brand">
            <span class="cs-brand-mark">◉</span>
            <div>
              <b>COSMOS</b>
              <small>Atlante interattivo di Geografia astronomica</small>
            </div>
          </div>
          <div class="cs-landing-top-actions">
            <button class="cs-top-link" type="button" data-cs="shortcuts" title="Scorciatoie da tastiera (K)">Comandi [K]</button>
            <button class="cs-top-link" type="button" data-cs="sources">Fonti e metodo</button>
          </div>
        </div>
        <div class="cs-landing-main">
          <div class="cs-landing-copy">
            <div class="cs-landing-tag">
              <span class="cs-kicker">UDA 2 e 3 · Percorso didattico completo</span>
              <span class="cs-pill-cyan">32 tappe 3D</span>
            </div>
            <h1>COSMOS</h1>
            <h2>La presentazione diventa<br><em>un atlante navigabile.</em></h2>
            <p class="cs-lead">${esc(s.intro)}</p>
            <div class="cs-landing-actions">
              <button class="cs-primary cs-glow" type="button" data-cs="start">Inizia l'esplorazione <span>→</span></button>
              <button class="cs-ghost cs-landing-lim" type="button" data-cs="lim"><span>🖥️</span> Modalità LIM / Aula</button>
              <button class="cs-ghost" type="button" data-cs="atlas">Sfoglia le tappe</button>
              <button class="cs-ghost" type="button" data-cs="free-atlas">Atlante 3D libero</button>
            </div>
            <div class="cs-landing-meta">
              <span>${esc(s.duration)}</span>
              <span>Italiano</span>
              <span>Presentazione + atlante 3D</span>
              <span>Audio spaziale &amp; voce</span>
            </div>
          </div>
          <figure class="cs-cover">
            <div class="cs-cover-halo" aria-hidden="true"></div>
            <img src="${esc(s.cover)}" alt="Pale Blue Dot, la Terra ripresa da Voyager 1 nel 1990" />
            <figcaption>
              <span>Pale Blue Dot · Voyager 1, 1990</span>
              <span class="cs-cover-credit">NASA/JPL-Caltech · 6 miliardi di km</span>
            </figcaption>
          </figure>
        </div>
        <div class="cs-landing-sections">
          ${s.sections.map((sec, i) => `
            <button class="cs-landing-section cs-section-card" type="button" data-cs="section" data-step="${sec.from - 1}">
              <span class="cs-sec-num">0${i + 1}</span>
              <div>
                <b>${esc(sec.label)}</b>
                <small>${esc(sec.title)}</small>
                <span class="cs-sec-count">${sec.to - sec.from + 1} tappe</span>
              </div>
              <i class="cs-sec-arrow">→</i>
            </button>`).join("")}
        </div>
        <div class="cs-landing-foot">
          <span>Basato sulla presentazione del docente «Geografia astronomica UDA 2 e 3» · 32 tappe</span>
          <div class="cs-landing-foot-links">
            <button type="button" data-cs="quiz">Mettiti alla prova (Quiz)</button>
            <span>·</span>
            <button type="button" data-cs="shortcuts">Tasti rapidi</button>
          </div>
          <span>Le slide originali e le note del relatore sono sempre accessibili.</span>
        </div>
      </div>

      <div class="cs-app" hidden>
        <header class="cs-topbar">
          <button class="cs-brand cs-brand-button" type="button" data-cs="home" aria-label="Torna alla copertina" title="Torna alla copertina">
            <span class="cs-brand-mark">◉</span>
            <div>
              <b>COSMOS</b>
              <small>Geografia astronomica · UDA 2 e 3</small>
            </div>
          </button>
          <div class="cs-top-center">
            <button class="cs-top-step-pill" type="button" data-cs="atlas" title="Sfoglia tutte le tappe">
              <span id="cs-top-section">UDA 2</span>
              <span class="cs-top-sep">/</span>
              <h2 id="cs-top-title">Pale Blue Dot</h2>
              <span class="cs-top-chevron">▾</span>
            </button>
          </div>
          <nav class="cs-top-actions" aria-label="Strumenti">
            <button class="cs-top-btn cs-lim-btn" type="button" data-cs="lim" title="Modalità Aula & LIM (L) — Navigatore touch 12 scale cosmiche, penna lavagna, laser pointer e confronti stellari"><span class="cs-lim-ico">🖥️</span><span>LIM</span></button>
            <button class="cs-top-btn" type="button" data-cs="free-atlas" title="Atlante 3D libero: zoom e ricerca in tutto l'universo"><svg class="cs-ico"><use href="#i-orbit"/></svg><span>Universo</span></button>
            <button class="cs-top-btn" type="button" data-cs="present" title="Modalità presentazione (P)"><svg class="cs-ico"><use href="#i-play"/></svg><span>Presenta</span></button>
            <button class="cs-top-btn" type="button" data-cs="slide" title="Apri la slide originale ad alta risoluzione (S)"><svg class="cs-ico"><use href="#i-grid"/></svg><span>Slide</span></button>
            <button class="cs-top-btn" type="button" data-cs="atlas" title="Sfoglia l'atlante per categorie (A)"><svg class="cs-ico"><use href="#i-globe"/></svg><span>Atlante</span></button>
            <button class="cs-top-icon cs-sound-btn" type="button" data-cs="sound" aria-label="Audio spaziale" title="Audio spaziale (M)"><span class="cs-sound-waves"><span></span><span></span><span></span></span></button>
            <button class="cs-top-icon" type="button" data-cs="quiz" aria-label="Interrogazione" title="Interrogazione / Verifica (?)"><span class="cs-quiz-mark">?</span></button>
            <button class="cs-top-icon" type="button" data-cs="shortcuts" aria-label="Scorciatoie da tastiera" title="Scorciatoie (K)">⌨</button>
            <button class="cs-top-icon" type="button" data-cs="sources" aria-label="Fonti e crediti" title="Fonti e crediti"><svg class="cs-ico"><use href="#i-info"/></svg></button>
            <button class="cs-top-icon" type="button" data-cs="fullscreen" aria-label="Schermo intero" title="Schermo intero (F)"><svg class="cs-ico"><use href="#i-expand"/></svg></button>
          </nav>
        </header>

        <main class="cs-stage" id="cs-main-stage">
          <div class="cs-stage-scrim" aria-hidden="true"></div>
          <div class="cs-stage-top">
            <span class="cs-stage-label" id="cs-stage-label">ATLANTE · Sistema Solare</span>
            <button class="cs-view-switch" id="cs-view-switch" type="button" data-cs="stage-toggle" hidden>← Torna al contenuto</button>
          </div>
          <div class="cs-target" id="cs-target" hidden>
            <span class="cs-target-bracket tl" aria-hidden="true"></span>
            <span class="cs-target-bracket tr" aria-hidden="true"></span>
            <span class="cs-target-bracket bl" aria-hidden="true"></span>
            <span class="cs-target-bracket br" aria-hidden="true"></span>
            <span class="cs-target-ring"></span>
            <span class="cs-target-label" id="cs-target-label"></span>
            <span class="cs-target-coord mono" id="cs-target-coord"></span>
          </div>
          <div class="cs-stage-cam-tools" role="toolbar" aria-label="Strumenti visuale 3D">
            <button class="cs-cam-btn" type="button" data-cs="cam-reset" title="Reimposta visuale (R)"><svg class="cs-ico"><use href="#i-reset"/></svg></button>
            <button class="cs-cam-btn" type="button" data-cs="cam-in" title="Zoom avanti (+)"><svg class="cs-ico"><use href="#i-plus"/></svg></button>
            <button class="cs-cam-btn" type="button" data-cs="cam-out" title="Zoom indietro (−)"><svg class="cs-ico"><use href="#i-minus"/></svg></button>
          </div>
          <div class="cs-chips" id="cs-chips"></div>
          <div class="cs-stage-hint" id="cs-stage-hint"></div>
          <div class="cs-stage-card" id="cs-stage-card" hidden>
            <div class="cs-card-head">
              <span class="cs-card-kicker" id="cs-card-kicker">Strumento interattivo</span>
              <button class="cs-card-toggle" type="button" data-cs="stage-toggle">Chiudi ×</button>
            </div>
            <div class="cs-stage-body" id="cs-stage-body"></div>
            <div class="cs-card-actions" id="cs-card-actions"></div>
          </div>
          <div class="cs-present-chrome" hidden>
            <div class="cs-present-top">
              <div class="cs-present-brand">
                <span>COSMOS · UDA 2 e 3</span>
                <span class="cs-present-timer mono" id="cs-present-timer">00:00</span>
                <button class="cs-present-laser-btn" type="button" data-cs="laser" title="Puntatore laser virtuale (L)">Laser</button>
              </div>
              <span id="cs-present-count">01 / 32</span>
              <div class="cs-present-actions">
                <button type="button" data-cs="atlas" title="Scegli una tappa">Tappe</button>
                <button type="button" data-cs="slide" title="Apri la slide originale">Slide</button>
                <button type="button" data-cs="lim" title="Modalità LIM / Aula">LIM</button>
                <button type="button" data-cs="present-exit" aria-label="Esci dalla presentazione">×</button>
              </div>
            </div>
            <div class="cs-present-bottom">
              <div class="cs-present-selection" id="cs-present-selection" hidden>
                <span class="cs-kicker">Selezione</span>
                <b id="cs-present-selection-name"></b>
                <span id="cs-present-selection-kind"></span>
                <button type="button" data-cs="selection-clear" aria-label="Deseleziona l'oggetto">×</button>
              </div>
              <button type="button" data-cs="prev" aria-label="Tappa precedente (←)">‹</button>
              <span id="cs-present-title"></span>
              <button type="button" data-cs="next" aria-label="Tappa successiva (→)">›</button>
              <button id="cs-present-tool" type="button" data-cs="stage-toggle" title="Apri lo strumento 2D della tappa">Strumento</button>
            </div>
          </div>
          <div class="cs-laser-dot" id="cs-laser-dot" hidden aria-hidden="true"></div>
        </main>

        <footer class="cs-bottombar">
          <div class="cs-bottom-meta">
            <span id="cs-bottom-section">UDA 2</span>
            <span class="cs-mono" id="cs-bottom-count">01 / 32</span>
          </div>
          <div class="cs-bottom-center">
            <button class="cs-nav-arrow" type="button" data-cs="prev" aria-label="Tappa precedente" title="Precedente (←)">‹</button>
            <div class="cs-progress" id="cs-progress" role="progressbar" aria-valuemin="1" aria-valuemax="32" aria-valuenow="1"></div>
            <button class="cs-nav-arrow" type="button" data-cs="next" aria-label="Tappa successiva" title="Successiva (→)">›</button>
          </div>
          <div class="cs-bottom-right">
            <button class="cs-autoplay-btn" type="button" data-cs="autoplay" title="Avanzamento automatico (10s)">
              <span class="cs-auto-icon">▶</span>
              <span id="cs-auto-label">Auto</span>
            </button>
            <button class="cs-small-link" type="button" data-cs="present">Modalità presentazione</button>
            <span id="cs-bottom-date">13,8 miliardi di anni</span>
          </div>
        </footer>

        <div class="cs-tick-preview" id="cs-tick-preview" hidden aria-hidden="true">
          <img src="" alt="" id="cs-preview-img" />
          <div class="cs-preview-meta">
            <div class="cs-preview-top">
              <span id="cs-preview-num" class="mono">01</span>
              <span id="cs-preview-section" class="cs-kicker">UDA 2</span>
            </div>
            <b id="cs-preview-title">Pale Blue Dot</b>
            <small id="cs-preview-type">3D Universe</small>
          </div>
        </div>
      </div>

      <div class="cs-modal" id="cs-modal" hidden>
        <div class="cs-modal-backdrop" data-cs="modal-close"></div>
        <section class="cs-modal-panel" id="cs-modal-panel" role="dialog" aria-modal="true">
          <header class="cs-modal-head">
            <div>
              <span class="cs-kicker" id="cs-modal-kicker">Slide originale</span>
              <h2 id="cs-modal-title"></h2>
            </div>
            <button class="cs-modal-close" type="button" data-cs="modal-close" aria-label="Chiudi">×</button>
          </header>
          <div class="cs-modal-body" id="cs-modal-body"></div>
        </section>
      </div>
      <div class="cs-toast" id="cs-toast" role="status" aria-live="polite" hidden></div>
    `;
  }

  bind() {
    this.root.addEventListener("click", e => this.onClick(e));
    document.addEventListener("keydown", e => this.onKey(e), true);
    document.addEventListener("fullscreenchange", () => {
      this.root.classList.toggle("cs-native-fullscreen", !!document.fullscreenElement);
    });

    const searchInput = $("#cs-nav-search", this.root);
    if (searchInput) {
      searchInput.addEventListener("input", e => {
        this.navFilter = (e.target.value || "").trim().toLowerCase();
        this.renderNav();
      });
    }

    // Laser pointer movement handler
    document.addEventListener("pointermove", e => {
      if (this.presenting && this.laserPointer && this.laserDot) {
        this.laserDot.style.left = `${e.clientX}px`;
        this.laserDot.style.top = `${e.clientY}px`;
      }
    });

    // Scrubber hover preview
    const progress = $("#cs-progress", this.root);
    if (progress) {
      progress.addEventListener("pointerover", e => {
        const tick = e.target.closest(".cs-tick");
        if (!tick) return;
        const stepIdx = Number(tick.dataset.step);
        this.showTickPreview(stepIdx, tick);
      });
      progress.addEventListener("pointerout", e => {
        if (!e.relatedTarget || !e.relatedTarget.closest("#cs-progress")) {
          this.hideTickPreview();
        }
      });
    }
  }

  onClick(e) {
    const el = e.target.closest("[data-cs]");
    if (!el) return;
    const action = el.dataset.cs;
    this.audio.playClick();

    switch (action) {
      case "start": this.startPresentation(0); break;
      case "section": this.start(Number(el.dataset.step) || 0); break;
      case "home": this.showLanding(); break;
      case "nav": this.nav?.classList.toggle("is-open"); break;
      case "nav-close": this.nav?.classList.remove("is-open"); break;
      case "prev": this.go(Math.max(0, this.current - 1)); break;
      case "next": this.go(Math.min(this.steps.length - 1, this.current + 1)); break;
      case "slide": this.openSlide(this.current); break;
      case "slide-prev": this.openSlide(Math.max(0, (this.slideIndex ?? this.current) - 1)); break;
      case "slide-next": this.openSlide(Math.min(this.steps.length - 1, (this.slideIndex ?? this.current) + 1)); break;
      case "atlas": if (!this.active) this.start(this.savedStep || 0); this.openAtlas(); break;
      case "free-atlas": if (!this.active) this.start(this.savedStep || 0); this.enterFreeAtlas(); break;
      case "quiz": if (!this.active) this.start(this.savedStep || 0); this.openQuiz(); break;
      case "sources": this.openSources(); break;
      case "shortcuts": this.openShortcuts(); break;
      case "sound": this.toggleAudio(); break;
      case "speech": this.toggleSpeech(); break;
      case "lim": this.toggleLIM(); break;
      case "font-inc": this.changeFontSize(1); break;
      case "font-dec": this.changeFontSize(-1); break;
      case "copy-note": this.copyStudyNote(); break;
      case "autoplay": this.toggleAutoplay(); break;
      case "laser": this.toggleLaser(); break;
      case "present": this.togglePresent(true); break;
      case "selection-clear": this.clearSelection(); break;
      case "present-exit": this.togglePresent(false); break;
      case "fullscreen": this.toggleFullscreen(); break;
      case "level": this.setLevel(el.dataset.level); break;
      case "stage-toggle": this.toggleStage(); break;
      case "modal-close": this.closeModal(); break;
      case "atlas-step":
        this.go(Number(el.dataset.step));
        this.closeModal();
        this.nav?.classList.remove("is-open");
        break;
      case "cam-reset":
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
        this.showToast("Visuale reimpostata");
        break;
      case "cam-in":
        this.zoomCanvas(true);
        break;
      case "cam-out":
        this.zoomCanvas(false);
        break;
      case "quiz-answer": this.answerQuiz(Number(el.dataset.option)); break;
      case "quiz-next": this.nextQuiz(); break;
      case "quiz-restart":
        this.quizIndex = 0;
        this.quizScore = 0;
        this.quizAnswered = false;
        this.quizSelected = null;
        this.quizStreak = 0;
        this.renderQuiz();
        break;
      case "quiz-slide": this.openSlide(Number(el.dataset.slide)); break;
      case "action": {
        const cfg = this.stageConfig[this.steps[this.current].n];
        const act = cfg?.actions?.[Number(el.dataset.action)];
        if (act?.view === "atlas") this.setStage(false);
        if (act?.goToSlide) this.go(Number(act.goToSlide) - 1);
        break;
      }
      case "chip": {
        const step = this.steps[this.current];
        const cfg = this.stageConfig[step.n];
        const chip = cfg?.objectChips?.[Number(el.dataset.chip)];
        if (chip?.scene) this.onScene(chip.scene);
        this.setTarget(chip?.label || this.steps[this.current].title, el);
        this.setSelection({ name: chip?.label || this.steps[this.current].title, kind: "Corpo celeste" });
        break;
      }
      case "motion": this.setMotion(!this.motionReduced); this.openSources(); break;
      default: break;
    }
  }

  zoomCanvas(inward = true) {
    const canvas = document.getElementById("scene-canvas");
    if (!canvas) return;
    const delta = inward ? -220 : 220;
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: delta, clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }));
  }

  onKey(e) {
    if (this.freeAtlas) return;
    if (e.target.closest("input, select, textarea")) return;
    if (!this.active) {
      if (!this.landing.hidden && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        this.start(this.savedStep || 0);
      }
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.openShortcuts();
      }
      return;
    }
    if (this.modal && !this.modal.hidden) {
      if (this.slideOpen && e.key === "ArrowLeft") {
        e.preventDefault();
        this.openSlide(Math.max(0, this.slideIndex - 1));
        return;
      }
      if (this.slideOpen && e.key === "ArrowRight") {
        e.preventDefault();
        this.openSlide(Math.min(this.steps.length - 1, this.slideIndex + 1));
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); this.closeModal(); }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (this.presenting) this.togglePresent(false);
      else this.showLanding();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      this.go(Math.min(this.steps.length - 1, this.current + 1));
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      this.go(Math.max(0, this.current - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      this.go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      this.go(this.steps.length - 1);
    } else if (e.key.toLowerCase() === "s") {
      this.openSlide(this.current);
    } else if (e.key.toLowerCase() === "a") {
      this.openAtlas();
    } else if (e.key.toLowerCase() === "p") {
      this.togglePresent(!this.presenting);
    } else if (e.key.toLowerCase() === "t") {
      this.toggleStage();
    } else if (e.key.toLowerCase() === "m") {
      this.toggleAudio();
    } else if (e.key.toLowerCase() === "k") {
      this.openShortcuts();
    } else if (e.key.toLowerCase() === "l") {
      this.toggleLIM();
    } else if (e.key === " ") {
      e.preventDefault();
      this.toggleSpeech();
    } else if (e.key === "?") {
      this.openQuiz();
    }
  }

  showLanding() {
    this.active = false;
    this.root.hidden = false;
    this.landing.hidden = false;
    this.app.hidden = true;
    this.root.classList.remove("cs-started", "cs-presenting");
    this.presenting = false;
    this.stopAutoplay();
    this.stopPresentTimer();
    this.speech.stop();
    this.nav?.classList.remove("is-open");
    const start = $("[data-cs=start]", this.root);
    if (start) {
      start.innerHTML = this.savedStep > 0
        ? `Riprendi dalla tappa ${String(this.savedStep + 1).padStart(2, "0")} <span>→</span>`
        : `Inizia l'esplorazione <span>→</span>`;
    }
  }

  startPresentation(n = 0) {
    this.start(n);
    this.togglePresent(true);
  }

  start(n = 0) {
    this.active = true;
    this.root.hidden = false;
    this.landing.hidden = true;
    this.app.hidden = false;
    this.root.classList.add("cs-started");
    this.go(n);
  }

  go(n) {
    n = Math.max(0, Math.min(this.steps.length - 1, Number(n) || 0));
    this.current = n;
    this.level = "capire";
    this.cardOpen = false;
    this.stageView = "atlas";
    this.speech.stop();
    this.visited.add(n);
    try {
      localStorage.setItem(LS.visited, JSON.stringify([...this.visited]));
      localStorage.setItem(LS.step, String(n));
    } catch { /* noop */ }

    this.renderTop();
    this.renderNav();
    this.renderBottom();
    this.renderStage();
    this.renderPanel();
    this.renderPresentChrome();
    this.clearSelection();

    const step = this.steps[n];
    try {
      const r = this.onScene?.(step.scene);
      if (r?.catch) r.catch(err => console.warn("COSMOS scene", err));
    } catch (err) {
      console.warn("COSMOS scene", err);
    }
    const next = this.steps[n + 1];
    if (next) {
      const im = new Image();
      im.src = next.slide;
    }
  }

  renderTop() {
    const s = this.steps[this.current];
    const setText = (sel, text) => {
      const el = $(sel, this.root);
      if (el) el.textContent = text;
    };
    setText("#cs-top-section", s.section);
    setText("#cs-top-title", s.title);
    setText("#cs-panel-section", s.section);
    setText("#cs-panel-count", `Tappa ${String(s.n).padStart(2, "0")} / 32`);
    setText("#cs-panel-title", s.title);
    setText("#cs-panel-kicker", s.kicker || s.sectionTitle);
    setText("#cs-slide-ref", `Slide originale ${String(s.n).padStart(2, "0")} / 32`);
    setText("#cs-bottom-section", s.section);
    setText("#cs-bottom-count", `${String(s.n).padStart(2, "0")} / 32`);
    setText("#cs-bottom-date", s.section === "UDA 2"
      ? "Sistema Solare · UDA 2"
      : s.section === "UDA 3"
        ? "Stelle e galassie · UDA 3"
        : "Tempo cosmico");
  }

  renderNav() {
    const scroll = $("#cs-nav-scroll", this.root);
    if (!scroll) return;

    const filter = this.navFilter;
    const progressMeta = $("#cs-nav-progress-meta", this.root);
    if (progressMeta) {
      progressMeta.textContent = `${this.visited.size}/32 completate`;
    }

    const filteredSections = this.lesson.sections.map(sec => {
      const sectionSteps = this.steps.filter(s => {
        if (s.sectionId !== sec.id) return false;
        if (!filter) return true;
        const text = `${s.n} ${s.title} ${s.summary || ""} ${s.kicker || ""}`.toLowerCase();
        return text.includes(filter);
      });
      return { sec, steps: sectionSteps };
    }).filter(g => g.steps.length > 0);

    scroll.innerHTML = filteredSections.map(({ sec, steps }) => `
      <section class="cs-nav-section">
        <div class="cs-nav-section-head">
          <span>${esc(sec.label)}</span>
          <small>${esc(sec.title)}</small>
        </div>
        ${steps.map(s => {
          const isVisited = this.visited.has(s.n - 1);
          const cfg = this.stageConfig[s.n] || {};
          const toolBadge = cfg.type === "scale" ? "Scala" : cfg.type === "distance" ? "Luce" : cfg.type === "image" ? "Foto" : cfg.type === "boundaries" ? "Confini" : cfg.type === "timeline" ? "Tempo" : cfg.type === "gallery" ? "Galleria" : "3D";
          return `
            <button class="cs-nav-step ${s.n - 1 === this.current ? "is-active" : ""} ${isVisited ? "is-visited" : ""}" type="button" data-cs="atlas-step" data-step="${s.n - 1}">
              <span class="cs-nav-num">${String(s.n).padStart(2, "0")}</span>
              <span class="cs-nav-name">${esc(s.title)}</span>
              <span class="cs-nav-badge">${toolBadge}</span>
              ${isVisited ? `<span class="cs-nav-check" title="Completata">✓</span>` : ""}
            </button>`;
        }).join("")}
      </section>`).join("") + `
      <div class="cs-nav-free">
        <button type="button" data-cs="free-atlas">Universo libero · zoom e ricerca →</button>
      </div>`;

    const activeBtn = scroll.querySelector(".cs-nav-step.is-active");
    if (activeBtn) activeBtn.scrollIntoView({ block: "nearest" });
  }

  buildNav() { this.renderNav(); }

  buildBottomTicks() {
    const p = $("#cs-progress", this.root);
    if (!p) return;
    p.innerHTML = this.steps.map((s, i) => `
      <button type="button" class="cs-tick" data-cs="atlas-step" data-step="${i}" aria-label="Vai alla tappa ${s.n}: ${esc(s.title)}" title="${s.n} · ${esc(s.title)}">
        <span class="cs-tick-bar"></span>
      </button>`).join("");
  }

  renderBottom() {
    const p = $("#cs-progress", this.root);
    if (p) {
      p.setAttribute("aria-valuenow", String(this.current + 1));
      p.querySelectorAll(".cs-tick").forEach((b, i) => {
        b.classList.toggle("is-active", i === this.current);
        b.classList.toggle("is-visited", this.visited.has(i));
      });
    }
  }

  showTickPreview(stepIdx, anchorEl) {
    const s = this.steps[stepIdx];
    if (!s || !this.tickPreview) return;
    const cfg = this.stageConfig[s.n] || {};
    const img = $("#cs-preview-img", this.tickPreview);
    const num = $("#cs-preview-num", this.tickPreview);
    const sec = $("#cs-preview-section", this.tickPreview);
    const title = $("#cs-preview-title", this.tickPreview);
    const type = $("#cs-preview-type", this.tickPreview);

    if (img) img.src = s.slide;
    if (num) num.textContent = String(s.n).padStart(2, "0");
    if (sec) sec.textContent = s.section;
    if (title) title.textContent = s.title;
    if (type) type.textContent = cfg.type === "atlas" ? "Atlante 3D diretto" : `Strumento: ${cfg.type}`;

    const rect = anchorEl.getBoundingClientRect();
    const prevW = 210;
    const left = Math.max(12, Math.min(window.innerWidth - prevW - 12, rect.left + rect.width / 2 - prevW / 2));
    this.tickPreview.style.left = `${left}px`;
    this.tickPreview.hidden = false;
  }

  hideTickPreview() {
    if (this.tickPreview) this.tickPreview.hidden = true;
  }

  renderPresentChrome() {
    const count = $("#cs-present-count", this.root);
    const title = $("#cs-present-title", this.root);
    if (count) count.textContent = `${String(this.current + 1).padStart(2, "0")} / 32`;
    if (title) title.textContent = this.steps[this.current].title;
    const cfg = this.stageConfig[this.steps[this.current].n];
    const tool = $("#cs-present-tool", this.root);
    if (tool) tool.hidden = !cfg || cfg.type === "atlas";
  }

  setSelection(selection) {
    this.selection = selection || null;
    const box = $("#cs-present-selection", this.root);
    if (!box) return;
    box.hidden = !this.selection;
    if (!this.selection) return;
    const name = $("#cs-present-selection-name", this.root);
    const kind = $("#cs-present-selection-kind", this.root);
    if (name) name.textContent = this.selection.name || "Oggetto";
    if (kind) kind.textContent = this.selection.kind || "";
    this.setTarget(this.selection.name || this.steps[this.current].title);
  }

  clearSelection() {
    this.selection = null;
    const box = $("#cs-present-selection", this.root);
    if (box) box.hidden = true;
    const step = this.steps[this.current];
    const cfg = this.stageConfig[step.n] || {};
    this.setTarget(cfg.targetLabel || step.atlas || step.title);
  }

  renderPanel() {
    // The right teaching panel has been removed in presentation-first mode.
    if (!$("#cs-panel-content", this.root)) return;
    const step = this.steps[this.current];
    const cfg = this.stageConfig[step.n] || {};

    $$("[data-cs=level]", this.root).forEach(b => {
      b.setAttribute("aria-selected", String(b.dataset.level === this.level));
      b.classList.toggle("is-active", b.dataset.level === this.level);
    });

    const facts = step.facts || [];
    const noteParagraphs = String(step.notes || "").split(/\n+/).filter(Boolean);
    const slideParagraphs = String(step.text || "").split(/\n+/).filter(Boolean);

    const toolNames = {
      image: "Immagine scientifica annotata",
      scale: "Confronto dimensionale in scala",
      distance: "Viaggio della luce",
      boundaries: "Scala dei confini",
      timeline: "Linea del tempo",
      gallery: "Galleria di immagini",
    };
    const toolLabel = toolNames[cfg.type] || "";
    const toolCta = cfg.type !== "atlas"
      ? `<button class="cs-tool-cta ${this.cardOpen ? "is-open" : ""}" type="button" data-cs="stage-toggle">
          <span>
            <span class="cs-kicker">Strumento interattivo [T]</span>
            <span class="cs-tool-name">${esc(toolLabel)}</span>
          </span>
          <span class="cs-tool-action">${this.cardOpen ? "Chiudi" : "Apri visualizzazione"} →</span>
        </button>`
      : `<div class="cs-em-note-box">
          <span class="cs-kicker">Navigazione 3D</span>
          <p>L'universo 3D è la scena attiva: trascina per orbitare, rotella o pinch per zoomare. Usa i comandi sulla scena o la tastiera.</p>
        </div>`;

    let html = "";
    if (this.level === "capire") {
      html = `
        <p class="cs-summary">${esc(step.summary || "")}</p>
        <div class="cs-keyfacts">
          ${facts.slice(0, 3).map(([k, v]) => `
            <div class="cs-fact-card">
              <span>${esc(k)}</span>
              <b>${esc(v)}</b>
            </div>`).join("")}
        </div>
        ${toolCta}
        <div class="cs-panel-level-jump">
          <button class="cs-text-link" type="button" data-cs="level" data-level="approfondisci">
            Tutti i dati fisici e note scientifiche →
          </button>
        </div>`;
    } else if (this.level === "esplora") {
      html = `
        <p class="cs-summary">${esc(step.atlas || step.sectionTitle || "")}</p>
        <p class="cs-atlas-desc">${esc(step.atlasText || "")}</p>
        <div class="cs-interactions">
          <span class="cs-kicker">Azioni disponibili</span>
          <ul>${(cfg.interactions || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
        ${toolCta}`;
    } else {
      html = `
        <div class="cs-facts">
          ${facts.map(([k, v]) => `
            <div class="cs-fact-cell">
              <span>${esc(k)}</span>
              <b>${esc(v)}</b>
            </div>`).join("")}
        </div>
        ${step.caveat ? `
          <div class="cs-sci-note">
            <span class="cs-kicker">Nota scientifica aggiornata</span>
            <p>${esc(step.caveat)}</p>
          </div>` : ""}
        <details class="cs-notes" ${step.notes ? "" : "hidden"}>
          <summary>
            <span>Note della presentazione</span>
            <span class="cs-notes-badge">${noteParagraphs.length ? noteParagraphs.length + " paragrafi" : ""}</span>
          </summary>
          <div>${noteParagraphs.map(p => `<p>${esc(p)}</p>`).join("")}</div>
        </details>
        <details class="cs-notes" ${step.text ? "" : "hidden"}>
          <summary>Testo originale nella slide</summary>
          <div>${slideParagraphs.map(p => `<p>${esc(p)}</p>`).join("")}</div>
        </details>
        <div class="cs-source-line">
          Fonte: slide ${step.n} della presentazione UDA 2 e 3 · dati verificati NASA/ESA/JPL.
          <button type="button" data-cs="sources">Consulta le fonti complete</button>
        </div>`;
    }

    $("#cs-panel-content").innerHTML = html;
  }

  renderStage() {
    const step = this.steps[this.current];
    const cfg = this.stageConfig[step.n] || { type: "atlas" };

    this.stageInstance?.destroy?.();
    this.stageInstance = null;
    if (this._overlayEl) { this._overlayEl.remove(); this._overlayEl = null; }
    this.stageBody.innerHTML = "";

    const hasContent = cfg.type !== "atlas";
    const content = hasContent && this.cardOpen;
    const chips = cfg.objectChips || [];
    const toolNames = {
      image: "Immagine annotata",
      scale: "Confronto in scala",
      distance: "Viaggio della luce",
      boundaries: "Scala dei confini",
      timeline: "Linea del tempo",
      gallery: "Galleria",
    };

    this.stageCard.hidden = !content;
    this.stageChips.hidden = content || !chips.length;
    this.stageHint.hidden = content;
    this.stageSwitch.hidden = !(hasContent && !content);
    this.stageSwitch.textContent = `Apri ${toolNames[cfg.type] || "visualizzazione"} →`;

    this.root.classList.toggle("cs-has-card", content);
    this.root.classList.toggle("cs-stage-atlas", !content);
    $("#cs-stage-label").textContent = content ? `STRUMENTO · ${step.title}` : `3D · ${step.title}`;
    $("#cs-card-kicker").textContent = cfg.title || "Strumento interattivo";

    const toggle = $(".cs-card-toggle", this.root);
    if (toggle) toggle.textContent = "Chiudi ×";

    $("#cs-card-actions").innerHTML = (cfg.actions || []).map((a, i) => `
      <button class="cs-button cs-small" type="button" data-cs="action" data-action="${i}">${esc(a.label)}</button>`).join("");

    if (content) {
      let instance = null;
      if (cfg.type === "image") instance = mountImageStage(cfg, this.stageBody);
      else if (cfg.type === "scale") instance = mountScaleStage(cfg, this.stageBody);
      else if (cfg.type === "gallery") instance = mountGalleryStage(cfg, this.stageBody);
      else if (cfg.type === "distance") instance = mountDistanceStage(cfg, this.stageBody);
      else if (cfg.type === "boundaries") instance = mountBoundariesStage(cfg, this.stageBody);
      else if (cfg.type === "timeline") instance = mountTimelineStage(cfg, this.stageBody);
      this.stageInstance = instance;
    }

    this.stageChips.innerHTML = chips.map((c, i) => `
      <button class="cs-chip" type="button" data-cs="chip" data-chip="${i}">
        <span class="cs-chip-dot"></span>
        <span>${esc(c.label)}</span>
      </button>`).join("");

    let hint = cfg.hint || "Trascina per orbitare · rotella o pinch per zoom · seleziona gli oggetti per esplorare";
    if (step.scene?.domain === "solar") hint += " · corpi ingranditi per visibilità (scala didattica)";
    else if (step.scene?.domain === "deep") hint += " · modelli 3D illustrativi";
    this.stageHint.textContent = hint;

    if (this.target) {
      this.target.hidden = content;
      if (!content) this.setTarget(cfg.targetLabel || step.atlas || step.title);
    }

    if (cfg.overlay && !content) {
      const box = document.createElement("div");
      box.className = "cs-atlas-overlay";
      box.innerHTML = `
        <span class="cs-kicker">${esc(cfg.overlay.title)}</span>
        ${cfg.overlay.lines.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}
        <small>${esc(cfg.overlay.note)}</small>`;
      this.stageChips.parentElement.insertBefore(box, this.stageChips);
      this._overlayEl = box;
    }

    this.renderPresentChrome();
  }

  setTarget(label, chipEl = null) {
    if (!this.target) return;
    this.target.hidden = false;
    this.targetLabel.textContent = label || this.steps[this.current].title;
    if (this.targetCoord) {
      const step = this.steps[this.current];
      this.targetCoord.textContent = step.section === "UDA 2" ? "Sistema Solare" : step.section === "UDA 3" ? "Vicinato stellare" : "Cosmologia";
    }
    $$(".cs-chip", this.stageChips).forEach(b => b.classList.toggle("is-active", b === chipEl));
  }

  setStage(open) {
    const cfg = this.stageConfig[this.steps[this.current].n];
    if (cfg?.type === "atlas") return;
    this.cardOpen = Boolean(open);
    this.stageView = this.cardOpen ? "content" : "atlas";
    this.renderStage();
    this.renderPanel();
  }

  toggleStage() {
    const cfg = this.stageConfig[this.steps[this.current].n];
    if (cfg?.type === "atlas") return;
    this.setStage(!this.cardOpen);
  }

  setLevel(level) {
    if (!["capire", "esplora", "approfondisci"].includes(level)) return;
    this.level = level;
    this.renderPanel();
    const content = $("#cs-panel-content");
    content?.scrollIntoView({ block: "nearest" });
  }

  toggleSpeech() {
    const step = this.steps[this.current];
    const textToRead = `${step.title}. ${step.summary}. ${step.facts?.slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(". ")}`;
    const speaking = this.speech.toggle(textToRead);
    this.showToast(speaking ? "Narrazione vocale avviata" : "Narrazione vocale interrotta");
  }

  toggleAudio() {
    const active = this.audio.toggle();
    this.updateAudioButtonState();
    this.showToast(active ? "Audio spaziale attivo" : "Audio spaziale disattivato");
  }

  updateAudioButtonState() {
    const btn = $(".cs-sound-btn", this.root);
    if (btn) btn.classList.toggle("is-active", !this.audio.muted);
  }

  changeFontSize(delta) {
    this.fontSize = Math.max(-1, Math.min(2, this.fontSize + delta));
    localStorage.setItem(LS.fontSize, String(this.fontSize));
    this.applyFontSize();
  }

  applyFontSize() {
    const scales = ["cs-font-sm", "cs-font-md", "cs-font-lg", "cs-font-xl"];
    scales.forEach(c => this.root.classList.remove(c));
    if (this.fontSize === -1) this.root.classList.add("cs-font-sm");
    else if (this.fontSize === 1) this.root.classList.add("cs-font-lg");
    else if (this.fontSize === 2) this.root.classList.add("cs-font-xl");
  }

  copyStudyNote() {
    const s = this.steps[this.current];
    const text = `COSMOS · Tappa ${String(s.n).padStart(2, "0")}: ${s.title}\n${s.summary}\n\nDati principali:\n${s.facts.map(([k, v]) => `• ${k}: ${v}`).join("\n")}\n\nFonte: UDA 2 e 3 (slide ${s.n})`;
    navigator.clipboard?.writeText(text).then(() => {
      this.showToast("Appunto copiato negli appunti!");
    }).catch(() => {
      this.showToast("Impossibile copiare negli appunti", "warn");
    });
  }

  toggleAutoplay() {
    this.autoplay = !this.autoplay;
    const btn = $(".cs-autoplay-btn", this.root);
    const label = $("#cs-auto-label", this.root);
    if (btn) btn.classList.toggle("is-running", this.autoplay);
    if (label) label.textContent = this.autoplay ? "Pausa" : "Auto";

    if (this.autoplay) {
      this.showToast("Avanzamento automatico ogni 10s");
      this.autoplayTimer = setInterval(() => {
        if (this.current >= this.steps.length - 1) {
          this.go(0);
        } else {
          this.go(this.current + 1);
        }
      }, this.autoplayInterval);
    } else {
      this.stopAutoplay();
      this.showToast("Avanzamento automatico disattivato");
    }
  }

  stopAutoplay() {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
    this.autoplay = false;
    const btn = $(".cs-autoplay-btn", this.root);
    const label = $("#cs-auto-label", this.root);
    if (btn) btn.classList.remove("is-running");
    if (label) label.textContent = "Auto";
  }

  toggleLaser() {
    this.laserPointer = !this.laserPointer;
    if (this.laserDot) this.laserDot.hidden = !this.laserPointer;
    this.showToast(this.laserPointer ? "Puntatore laser attivo" : "Puntatore laser disattivato");
  }

  startPresentTimer() {
    this.presentSeconds = 0;
    this.stopPresentTimer();
    this.presentTimer = setInterval(() => {
      this.presentSeconds++;
      const m = Math.floor(this.presentSeconds / 60);
      const s = this.presentSeconds % 60;
      const el = $("#cs-present-timer", this.root);
      if (el) el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }, 1000);
  }

  stopPresentTimer() {
    if (this.presentTimer) {
      clearInterval(this.presentTimer);
      this.presentTimer = null;
    }
  }

  togglePresent(force) {
    this.presenting = typeof force === "boolean" ? force : !this.presenting;
    this.root.classList.toggle("cs-presenting", this.presenting);
    const chrome = $(".cs-present-chrome", this.root);
    if (chrome) chrome.hidden = !this.presenting;
    if (this.presenting) {
      this.cardOpen = false;
      this.stageView = "atlas";
      this.startPresentTimer();
      this.renderStage();
      this.renderPanel();
    } else {
      this.stopPresentTimer();
      if (this.laserDot) this.laserDot.hidden = true;
      this.laserPointer = false;
    }
    this.renderPresentChrome();
    if (!this.presenting) this.root.classList.remove("cs-native-fullscreen");
  }

  toggleLIM() {
    if (!this.limCockpit) {
      this.limCockpit = new LIMCockpit({ host: document.body, app: this });
    }
    this.limCockpit.toggle();
    if (this.limCockpit.active) {
      this.showToast("Modalità LIM attiva · Navigatore 12 scale e strumenti lavagna");
    }
  }

  enterFreeAtlas() {
    if (this.freeAtlas) return;
    if (!this.active) this.start(this.savedStep || 0);
    this.closeModal();
    this.freeAtlasWasPresenting = this.presenting;
    if (this.presenting) this.togglePresent(false);
    this.presenting = false;
    this.root.classList.remove("cs-presenting");
    this.cardOpen = false;
    this.freeAtlas = true;
    this.root.hidden = true;
    document.body.classList.remove("cosmos-mode");
    document.body.classList.add("cosmos-free-atlas");

    const brand = document.querySelector("#hud .brand-word");
    if (brand) brand.textContent = "COSMOS";
    const tag = document.querySelector("#hud .brand-tagline");
    if (tag) tag.textContent = "Atlante libero · UDA 2 e 3";
    const search = document.querySelector("#search-input");
    if (search) {
      search.placeholder = "Cerca stelle, pianeti, galassie…";
      search.setAttribute("aria-label", "Cerca nell'universo");
    }

    let btn = document.getElementById("cosmos-free-return");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "cosmos-free-return";
      btn.type = "button";
      btn.className = "cosmos-free-return";
      btn.innerHTML = `<span>← Torna al percorso COSMOS</span><small>(Tappa ${String(this.current + 1).padStart(2, "0")})</small>`;
      btn.addEventListener("click", () => this.exitFreeAtlas());
    }
    if (btn && btn.parentElement !== document.body) document.body.appendChild(btn);
    if (btn) btn.hidden = false;

    let bar = document.getElementById("cosmos-free-quickbar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "cosmos-free-quickbar";
      bar.className = "cs-free-quickbar";
      const celestialBodies = [
        { id: "sun", label: "Sole", color: "#f59e0b" },
        { id: "mercury", label: "Mercurio", color: "#a89f91" },
        { id: "venus", label: "Venere", color: "#d8be92" },
        { id: "earth", label: "Terra", color: "#38bdf8" },
        { id: "moon", label: "Luna", color: "#cbd5e1" },
        { id: "mars", label: "Marte", color: "#ef4444" },
        { id: "jupiter", label: "Giove", color: "#f59e0b" },
        { id: "saturn", label: "Saturno", color: "#eab308" },
        { id: "uranus", label: "Urano", color: "#06b6d4" },
        { id: "neptune", label: "Nettuno", color: "#3b82f6" },
        { id: "pluto", label: "Plutone", color: "#b45309" },
      ];
      bar.innerHTML = celestialBodies.map(b => `
        <button class="cs-free-quickbtn" data-target="${b.id}" type="button">
          <span class="cs-free-quickdot" style="background:${b.color}"></span>
          <span>${b.label}</span>
        </button>
      `).join("");
      bar.querySelectorAll(".cs-free-quickbtn").forEach(b => {
        b.addEventListener("click", () => {
          const tid = b.dataset.target;
          if (window.EON) {
            if (tid === "earth" || tid === "moon") {
              if (window.EON.activateDomain && window.EON.earth) {
                window.EON.activateDomain("earth", window.EON.earth);
                window.EON.earth.focusObject(tid, { duration: 1.2 });
              }
            } else if (window.EON.navigateToSolarObject) {
              window.EON.navigateToSolarObject(tid);
            }
          }
        });
      });
    }
    if (bar && bar.parentElement !== document.body) document.body.appendChild(bar);
    if (bar) bar.hidden = false;
    this.onFreeAtlas?.();
  }

  exitFreeAtlas() {
    if (!this.freeAtlas) return;
    this.freeAtlas = false;
    document.body.classList.remove("cosmos-free-atlas");
    document.body.classList.add("cosmos-mode");
    this.root.hidden = false;
    const btn = document.getElementById("cosmos-free-return");
    if (btn) btn.remove();
    const bar = document.getElementById("cosmos-free-quickbar");
    if (bar) bar.remove();
    this.go(this.current);
    if (this.freeAtlasWasPresenting) this.togglePresent(true);
    this.freeAtlasWasPresenting = false;
    this.onExitFreeAtlas?.();
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  openModal(kicker, title, bodyHTML) {
    this.modal = $("#cs-modal", this.root);
    $("#cs-modal-kicker", this.root).textContent = kicker;
    $("#cs-modal-title", this.root).textContent = title;
    $("#cs-modal-body", this.root).innerHTML = bodyHTML;
    this.lastFocus = document.activeElement;
    this.modal.hidden = false;
    this.modal.classList.remove("is-slide");
    this.root.classList.add("cs-modal-open");
    requestAnimationFrame(() => $(".cs-modal-close", this.root)?.focus());
  }

  closeModal() {
    if (!this.modal) return;
    this.slideInstance?.destroy?.();
    this.slideInstance = null;
    this.modal.hidden = true;
    this.modal.classList.remove("is-slide");
    this.slideOpen = false;
    this.root.classList.remove("cs-modal-open");
    $("#cs-modal-body", this.root).innerHTML = "";
    if (this.lastFocus && document.contains(this.lastFocus)) this.lastFocus.focus();
  }

  openSlide(n = this.current) {
    const step = this.steps[n];
    if (!step) return;
    this.slideInstance?.destroy?.();
    this.slideInstance = null;
    this.slideIndex = n;
    this.slideOpen = true;
    this.openModal(
      `Slide originale · ${String(n + 1).padStart(2, "0")} / 32`,
      step.title,
      `<div class="cs-slide-modal">
        <div class="cs-slide-nav">
          <button type="button" data-cs="slide-prev" aria-label="Slide precedente" ${n === 0 ? "disabled" : ""}>‹</button>
          <span id="cs-slide-index">${String(n + 1).padStart(2, "0")} / 32</span>
          <button type="button" data-cs="slide-next" aria-label="Slide successiva" ${n === this.steps.length - 1 ? "disabled" : ""}>›</button>
        </div>
        <div class="cs-slide-viewer" id="cs-slide-modal-body"></div>
        <div class="cs-slide-hint">Rotella o pinch per zoom · trascina per spostarti · ← / → per cambiare slide · Esc per chiudere</div>
      </div>`
    );
    this.modal.classList.add("is-slide");
    const host = $("#cs-slide-modal-body", this.root);
    this.slideInstance = mountImageStage({
      src: step.slide,
      alt: `Slide ${step.n}: ${step.title}`,
      caption: `Slide originale ${step.n} della presentazione UDA 2 e 3.`,
      credit: "Materiale didattico UDA 2 e 3",
      aspect: "landscape",
      eyebrow: "Presentazione originale",
    }, host);
  }

  openAtlas() {
    const body = `
      <div class="cs-atlas">
        <div class="cs-atlas-free">
          <div>
            <span class="cs-kicker">Universo libero · Navigazione completa</span>
            <b>L'atlante 3D completo</b>
            <p>Zoom, ricerca, schede oggetto e navigazione libera in tutta la scala cosmica (dalla Terra all'Orizzonte).</p>
          </div>
          <button class="cs-primary" type="button" data-cs="free-atlas">Entra nell'Universo →</button>
        </div>
        <div class="cs-atlas-search-row">
          <input type="search" id="cs-atlas-filter" class="cs-input" placeholder="Filtra tappe e categorie per nome..." />
        </div>
        <p class="cs-atlas-intro">Dodici categorie didattiche collegate alle 32 slide originali. Clicca su una tappa per visualizzare la scena 3D e gli strumenti corrispondenti.</p>
        <div class="cs-atlas-cat-list" id="cs-atlas-cat-list">
          ${ATLAS_CATEGORIES.map(cat => {
            const cover = this.steps[cat.cover - 1];
            return `
              <section class="cs-atlas-cat">
                <div class="cs-atlas-cat-head">
                  <div>
                    <span class="cs-kicker">${cat.steps.length} tappe</span>
                    <h3>${esc(cat.title)}</h3>
                    <p>${esc(cat.description)}</p>
                  </div>
                  <img src="${esc(cover.slide)}" alt="" loading="lazy" />
                </div>
                <div class="cs-atlas-chips">
                  ${cat.steps.map(n => {
                    const isVisited = this.visited.has(n - 1);
                    return `
                      <button type="button" class="${isVisited ? "is-visited" : ""}" data-cs="atlas-step" data-step="${n - 1}">
                        <b>${String(n).padStart(2, "0")}</b>
                        ${esc(this.steps[n - 1].title)}
                        ${isVisited ? `<span class="cs-chip-check">✓</span>` : ""}
                      </button>`;
                  }).join("")}
                </div>
              </section>`;
          }).join("")}
        </div>
        <div class="cs-atlas-actions">
          <button type="button" data-cs="quiz">Interrogazione</button>
          <button type="button" data-cs="sources">Fonti e crediti</button>
        </div>
      </div>`;

    this.openModal("Modalità atlante", "Sfoglia il percorso per categorie", body);

    const filterInput = $("#cs-atlas-filter", this.root);
    if (filterInput) {
      filterInput.addEventListener("input", e => {
        const q = (e.target.value || "").trim().toLowerCase();
        $$(".cs-atlas-cat", this.root).forEach(catEl => {
          const text = catEl.textContent.toLowerCase();
          catEl.style.display = text.includes(q) ? "" : "none";
        });
      });
    }
  }

  openQuiz() {
    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizAnswered = false;
    this.quizSelected = null;
    this.quizStreak = 0;
    this.openModal("Interrogazione didattica", "Verifica la comprensione delle 32 tappe", `<div class="cs-quiz" id="cs-quiz"></div>`);
    this.renderQuiz();
  }

  renderQuiz() {
    const host = $("#cs-quiz", this.root);
    if (!host) return;

    if (this.quizIndex >= QUIZ.length) {
      const total = QUIZ.length;
      const pct = (this.quizScore / total) * 100;
      const rank = pct === 100
        ? "Astrofisico Emerito 🌟"
        : pct >= 80
          ? "Esploratore Cosmico Avanzato 🚀"
          : pct >= 60
            ? "Astronomo Praticante 🔭"
            : "Cadetto dello Spazio 🛰️";

      const msg = pct === 100
        ? "Eccellente! Hai risposto correttamente a tutte le domande. Hai una perfetta padronanza della geografia astronomica."
        : pct >= 70
          ? "Ottimo risultato: hai compreso i concetti fondamentali di distanze, scale e corpi celesti."
          : "Buon tentativo! Puoi rivedere le tappe e le note scientifiche per consolidare le conoscenze.";

      host.innerHTML = `
        <div class="cs-quiz-result">
          <span class="cs-kicker">Valutazione finale</span>
          <div class="cs-quiz-badge">${rank}</div>
          <div class="cs-quiz-score mono">${this.quizScore} / ${total}</div>
          <div class="cs-quiz-bar"><span style="width:${pct}%"></span></div>
          <p>${msg}</p>
          <div class="cs-quiz-actions">
            <button class="cs-primary" type="button" data-cs="quiz-restart">Riprova il quiz</button>
            <button class="cs-ghost" type="button" data-cs="atlas">Esplora le tappe</button>
          </div>
        </div>`;
      return;
    }

    const q = QUIZ[this.quizIndex];
    host.innerHTML = `
      <div class="cs-quiz-head">
        <span class="cs-kicker">Domanda ${String(this.quizIndex + 1).padStart(2, "0")} / ${QUIZ.length}</span>
        <div class="cs-quiz-stats">
          <span class="cs-quiz-progress mono">${this.quizScore} corrette</span>
          ${this.quizStreak > 1 ? `<span class="cs-quiz-streak">🔥 ${this.quizStreak} streak</span>` : ""}
        </div>
      </div>
      <div class="cs-quiz-bar"><span style="width:${(this.quizIndex / QUIZ.length) * 100}%"></span></div>
      <h3 class="cs-quiz-q">${esc(q.q)}</h3>
      <div class="cs-quiz-options">
        ${q.options.map((o, i) => `
          <button type="button" class="cs-quiz-option ${this.quizAnswered ? (i === q.answer ? "is-correct" : i === this.quizSelected ? "is-wrong" : "") : ""}" data-cs="quiz-answer" data-option="${i}" ${this.quizAnswered ? "disabled" : ""}>
            <span class="cs-quiz-opt-letter">${String.fromCharCode(65 + i)}</span>
            <span>${esc(o)}</span>
          </button>`).join("")}
      </div>
      ${this.quizAnswered ? `
        <div class="cs-quiz-feedback ${this.quizSelected === q.answer ? "is-ok" : "is-no"}">
          <div class="cs-quiz-fb-head">
            <b>${this.quizSelected === q.answer ? "Risposta esatta! ✓" : "Risposta non corretta ✗"}</b>
          </div>
          <p>${esc(q.why)}</p>
          <div class="cs-quiz-actions">
            <button class="cs-small-link" type="button" data-cs="quiz-slide" data-slide="${q.slide - 1}">
              Rivedi la slide ${q.slide} ↗
            </button>
            <button class="cs-primary" type="button" data-cs="quiz-next">
              ${this.quizIndex === QUIZ.length - 1 ? "Vedi il risultato" : "Prossima domanda"} →
            </button>
          </div>
        </div>` : ""}`;
  }

  answerQuiz(i) {
    if (this.quizAnswered) return;
    const q = QUIZ[this.quizIndex];
    this.quizAnswered = true;
    this.quizSelected = i;

    if (i === q.answer) {
      this.quizScore++;
      this.quizStreak++;
      this.audio.playChime();
    } else {
      this.quizStreak = 0;
      this.audio.playThud();
    }
    this.renderQuiz();
  }

  nextQuiz() {
    this.quizIndex++;
    this.quizAnswered = false;
    this.quizSelected = null;
    this.renderQuiz();
  }

  openShortcuts() {
    const body = `
      <div class="cs-shortcuts-grid">
        <div class="cs-shortcut-item"><kbd>→</kbd> <kbd>PageDown</kbd> <span>Tappa successiva</span></div>
        <div class="cs-shortcut-item"><kbd>←</kbd> <kbd>PageUp</kbd> <span>Tappa precedente</span></div>
        <div class="cs-shortcut-item"><kbd>S</kbd> <span>Visualizza slide originale</span></div>
        <div class="cs-shortcut-item"><kbd>A</kbd> <span>Apri indice / atlante per categorie</span></div>
        <div class="cs-shortcut-item"><kbd>T</kbd> <span>Apri / chiudi strumento 2D</span></div>
        <div class="cs-shortcut-item"><kbd>P</kbd> <span>Attiva modalità presentazione</span></div>
        <div class="cs-shortcut-item"><kbd>Spazio</kbd> <span>Ascolta / ferma narrazione vocale</span></div>
        <div class="cs-shortcut-item"><kbd>M</kbd> <span>Attiva / disattiva audio spaziale</span></div>
        <div class="cs-shortcut-item"><kbd>R</kbd> <span>Reimposta visuale della camera 3D</span></div>
        <div class="cs-shortcut-item"><kbd>F</kbd> <span>Schermo intero</span></div>
        <div class="cs-shortcut-item"><kbd>?</kbd> <span>Apri quiz di verifica</span></div>
        <div class="cs-shortcut-item"><kbd>Esc</kbd> <span>Chiudi finestra / esci da presentazione</span></div>
      </div>`;
    this.openModal("Scorciatoie da tastiera", "Navigazione rapida", body);
  }

  openSources() {
    const body = `
      <div class="cs-sources">
        <p class="cs-sources-lead">
          <b>32/32 slide originali · 21 note del relatore · 32 componenti scientifici interattivi.</b><br>
          Il progetto nasce dalla presentazione del docente «Geografia astronomica UDA 2 e 3».
          Le note scientifiche della scheda Approfondisci segnalano i punti in cui la letteratura contemporanea corregge o precisa i dati storici.
        </p>
        <div class="cs-source-list">
          ${SOURCES.map(s => `
            <div class="cs-source-card">
              <b>${esc(s.name)}</b>
              <p>${esc(s.note)}</p>
              ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">Apri documentazione ufficiale ↗</a>` : ""}
            </div>`).join("")}
        </div>
        <div class="cs-settings-box">
          <div class="cs-motion">
            <div>
              <b>Riduci il movimento</b>
              <p>Disattiva animazioni orbitali e transizioni rapide per l'accessibilità visiva.</p>
            </div>
            <button class="cs-toggle ${this.motionReduced ? "is-active" : ""}" type="button" data-cs="motion">
              ${this.motionReduced ? "Attivo" : "Disattivo"}
            </button>
          </div>
        </div>
      </div>`;
    this.openModal("Fonti, crediti e accessibilità", "Trasparenza scientifica", body);
  }

  applyMotion() {
    this.motionReduced = localStorage.getItem(LS.motion) === "1";
    this.root.classList.toggle("cs-reduced-motion", this.motionReduced);
    document.documentElement.classList.toggle("reduced-motion", this.motionReduced);
    try {
      if (window.EON?.settings) window.EON.settings.reducedMotion = this.motionReduced;
    } catch { /* noop */ }
  }

  setMotion(v) {
    this.motionReduced = !!v;
    localStorage.setItem(LS.motion, v ? "1" : "0");
    this.applyMotion();
    this.openSources();
  }

  showToast(text, kind = "info") {
    if (!this.toastEl) return;
    this.toastEl.textContent = text;
    this.toastEl.className = `cs-toast is-${kind}`;
    this.toastEl.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.hidden = true;
    }, 2800);
  }
}
