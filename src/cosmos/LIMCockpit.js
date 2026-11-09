/**
 * COSMOS — Suite LIM & Lezione Multimediale per Docente e Classe
 *
 * Progettata specificamente per l'uso su Lavagne Interattive Multimediali (LIM),
 * monitor touch d'aula e proiettori durante le lezioni di scienze e geografia astronomica.
 *
 * Include:
 *  - Navigatore universale touch a 12 scale cosmiche (da 10^4 km a 46,5 miliardi di anni luce)
 *  - Puntatore laser digitale per il docente con scia dinamica luminescente
 *  - Penna lavagna / annotatore virtuale per disegnare sui corpi celesti durante la spiegazione
 *  - Laboratorio 3D interattivo di confronto giganti stellari (Slide 23–31)
 *  - Il Righello cosmico del Tempo da 1 metro con zoom sull'ultimo millimetro (Slide 32)
 *  - Esploratore interattivo ad alta risoluzione della targa di Pioneer e Voyager (Slide 10–11)
 */

import { drawRealisticCelestialSphere } from './stages.js';

export class LIMCockpit {
  constructor({ host, app }) {
    this.host = host || document.body;
    this.app = app;
    this.active = false;
    this.laserActive = false;
    this.drawActive = false;
    this.currentColor = '#f59e0b';
    this.brushSize = 4;
    this.isDrawing = false;
    this.drawPoints = [];
    this.laserParticles = [];
    this.laserAnimId = null;

    this.initDOM();
    this.initLaser();
    this.initDrawing();
  }

  initDOM() {
    // Container for LIM tools
    this.el = document.createElement('div');
    this.el.id = 'cs-lim-suite';
    this.el.className = 'cs-lim-suite';
    this.el.hidden = true;

    this.el.innerHTML = `
      <!-- Toolbar principale LIM per docente -->
      <aside class="cs-lim-bar" id="cs-lim-bar" aria-label="Strumenti LIM">
        <div class="cs-lim-bar-title">
          <span class="cs-lim-badge">LIM</span>
          <b>AULA & LEZIONE</b>
        </div>
        <div class="cs-lim-actions">
          <button class="cs-lim-btn is-active" id="cs-lim-scale-toggle" type="button" title="Navigatore delle 12 scale cosmiche">
            <span class="cs-lim-icon">🔍</span>
            <span>Scale cosmiche</span>
          </button>
          <button class="cs-lim-btn" id="cs-lim-laser-toggle" type="button" title="Puntatore laser virtuale per indicare i dettagli (L)">
            <span class="cs-lim-icon">🔴</span>
            <span>Puntatore laser</span>
          </button>
          <button class="cs-lim-btn" id="cs-lim-draw-toggle" type="button" title="Penna lavagna per disegnare o cerchiare sullo schermo">
            <span class="cs-lim-icon">✏️</span>
            <span>Penna lavagna</span>
          </button>
          <button class="cs-lim-btn" id="cs-lim-stars-btn" type="button" title="Confronto dimensioni stellari da Terra a UY Scuti">
            <span class="cs-lim-icon">🌟</span>
            <span>Confronto stelle</span>
          </button>
          <button class="cs-lim-btn" id="cs-lim-ruler-btn" type="button" title="Righello del tempo da 1 metro (13,8 miliardi di anni)">
            <span class="cs-lim-icon">📏</span>
            <span>Righello tempo</span>
          </button>
          <button class="cs-lim-btn" id="cs-lim-plaque-btn" type="button" title="Targa aurea delle sonde Pioneer e Voyager">
            <span class="cs-lim-icon">🛰️</span>
            <span>Targa Voyager</span>
          </button>
          <button class="cs-lim-btn" id="cs-lim-fs-btn" type="button" title="Schermo intero per la lavagna">
            <span class="cs-lim-icon">⛶</span>
            <span>Schermo intero</span>
          </button>
          <button class="cs-lim-btn cs-lim-close" id="cs-lim-close-btn" type="button" title="Chiudi modalità LIM">
            <span>✕</span>
          </button>
        </div>
      </aside>

      <!-- Palette per la penna lavagna -->
      <div class="cs-lim-draw-palette" id="cs-lim-draw-palette" hidden>
        <span class="cs-lim-pal-title">Penna LIM:</span>
        <button class="cs-lim-color-btn is-active" data-color="#f59e0b" style="background:#f59e0b" type="button" title="Giallo Sole"></button>
        <button class="cs-lim-color-btn" data-color="#38bdf8" style="background:#38bdf8" type="button" title="Ciano Spazio"></button>
        <button class="cs-lim-color-btn" data-color="#ffffff" style="background:#ffffff" type="button" title="Bianco"></button>
        <button class="cs-lim-color-btn" data-color="#ef4444" style="background:#ef4444" type="button" title="Rosso"></button>
        <div class="cs-lim-pal-sep"></div>
        <button class="cs-lim-pal-action" id="cs-lim-clear-draw" type="button">🗑️ Cancella tutto</button>
      </div>

      <!-- Dock di navigazione cosmica a 12 livelli -->
      <nav class="cs-lim-scales-dock" id="cs-lim-scales-dock" aria-label="12 Livelli di scala cosmica">
        <div class="cs-lim-scales-scroll">
          <button class="cs-lim-scale-chip" data-scale="6.8" type="button">
            <span class="cs-scale-ico">🌍</span>
            <b>1. Terra & Satelliti</b>
            <small>12.742 km · Apollo 17</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="8.6" type="button">
            <span class="cs-scale-ico">🌕</span>
            <b>2. Terra–Luna</b>
            <small>384.403 km · 1,28 s luce</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="11.2" type="button">
            <span class="cs-scale-ico">☀️</span>
            <b>3. Sistema Interno (1 UA)</b>
            <small>150 mln km · 8 min 19 s</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="12.8" type="button">
            <span class="cs-scale-ico">🪐</span>
            <b>4. Sistema Completo</b>
            <small>40 UA · Nettuno e Plutone</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="13.4" type="button">
            <span class="cs-scale-ico">🛰️</span>
            <b>5. Voyager 1 & Eliopausa</b>
            <small>169 UA · Pale Blue Dot</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="15.2" type="button">
            <span class="cs-scale-ico">❄️</span>
            <b>6. Nube di Oort</b>
            <small>100.000 UA · 1,5 al</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="17.5" type="button">
            <span class="cs-scale-ico">✨</span>
            <b>7. Dintorni Solari</b>
            <small>100 al · Sirio e Alpha Cen</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="21.0" type="button">
            <span class="cs-scale-ico">🌌</span>
            <b>8. Via Lattea</b>
            <small>100.000 al · Braccio d'Orione</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="23.0" type="button">
            <span class="cs-scale-ico">🌀</span>
            <b>9. Gruppo Locale</b>
            <small>10 mln al · Andromeda M31</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="24.8" type="button">
            <span class="cs-scale-ico">🕸️</span>
            <b>10. Superammasso Vergine</b>
            <small>200 mln al · Virgo Cluster</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="26.7" type="button">
            <span class="cs-scale-ico">🔭</span>
            <b>11. Universo Osservabile</b>
            <small>46,5 mld al · Radiazione CMB</small>
          </button>
          <button class="cs-lim-scale-chip" data-scale="27.0" type="button">
            <span class="cs-scale-ico">♾️</span>
            <b>12. Orizzonte Infinito</b>
            <small>Oltre l'osservabile · 10¹⁰⁰ al</small>
          </button>
        </div>
      </nav>

      <!-- Overlay per disegno a mano libera -->
      <canvas class="cs-lim-draw-canvas" id="cs-lim-draw-canvas"></canvas>

      <!-- Overlay per laser pointer con scia -->
      <canvas class="cs-lim-laser-canvas" id="cs-lim-laser-canvas"></canvas>

      <!-- Modale: Laboratorio Confronto Giganti Stellari -->
      <div class="cs-lim-modal" id="cs-lim-stellar-modal" hidden>
        <div class="cs-lim-modal-content">
          <div class="cs-lim-modal-head">
            <div>
              <span class="cs-eyebrow">Laboratorio didattico LIM · Slide 23–31</span>
              <h3>Confronto delle Dimensioni Celesti: Dalla Terra a UY Scuti</h3>
              <p>Metti a confronto i corpi celesti in scala 3D reale. Modifica il fattore di zoom per comprendere come il Sole si riduca a un singolo pixel microscopico accanto alle supergiganti.</p>
            </div>
            <button class="cs-lim-modal-close" data-close="stellar" type="button">✕</button>
          </div>
          <div class="cs-lim-stellar-body">
            <div class="cs-lim-stellar-stage" id="cs-lim-stellar-stage">
              <canvas class="cs-lim-stellar-canvas" id="cs-lim-stellar-canvas" width="1000" height="420"></canvas>
            </div>
            <div class="cs-lim-stellar-ctrls">
              <div class="cs-lim-stellar-zoom-wrap">
                <label for="cs-lim-stellar-zoom">Ingrandimento Didattico: <b id="cs-lim-stellar-zoom-val">1×</b></label>
                <input type="range" id="cs-lim-stellar-zoom" min="0.1" max="10" step="0.1" value="1" />
              </div>
              <div class="cs-lim-stellar-presets">
                <button class="cs-button is-active" data-preset="1" type="button">1. Pianeti Rocciosi vs Giganti</button>
                <button class="cs-button" data-preset="2" type="button">2. Giove vs Sole vs Sirio</button>
                <button class="cs-button" data-preset="3" type="button">3. Sole vs Giganti Rosse (Arturo & Aldebaran)</button>
                <button class="cs-button" data-preset="4" type="button">4. Rigel & Betelgeuse</button>
                <button class="cs-button" data-preset="5" type="button">5. Sole vs VY Canis Majoris & UY Scuti (Zoom 7×)</button>
              </div>
            </div>
            <div class="cs-lim-stellar-info" id="cs-lim-stellar-info"></div>
          </div>
        </div>
      </div>

      <!-- Modale: Righello Cosmico del Tempo da 1 Metro -->
      <div class="cs-lim-modal" id="cs-lim-ruler-modal" hidden>
        <div class="cs-lim-modal-content">
          <div class="cs-lim-modal-head">
            <div>
              <span class="cs-eyebrow">Esperimento didattico LIM · Slide 32</span>
              <h3>Il Righello Cosmico del Tempo (1 Metro = 13,8 Miliardi di Anni)</h3>
              <p>Se l'intera storia dell'universo dal Big Bang a oggi fosse compressa in un righello lungo 1 metro, dove si troverebbero la Terra, i dinosauri e la nostra specie?</p>
            </div>
            <button class="cs-lim-modal-close" data-close="ruler" type="button">✕</button>
          </div>
          <div class="cs-lim-ruler-body">
            <div class="cs-lim-ruler-viewport">
              <div class="cs-lim-meter-ruler" id="cs-lim-meter-ruler">
                <div class="cs-lim-ruler-graduations"></div>
                <div class="cs-lim-ruler-pins" id="cs-lim-ruler-pins"></div>
                <div class="cs-lim-ruler-cursor" id="cs-lim-ruler-cursor" style="left: 99.998%">
                  <span class="cs-cursor-line"></span>
                  <span class="cs-cursor-label">Homo sapiens</span>
                </div>
              </div>
            </div>
            <div class="cs-lim-last-mm-box">
              <div class="cs-last-mm-head">
                <span class="cs-eyebrow">Focus LIM: L'Ultimo Millimetro del Righello</span>
                <h4>La vertigine del tempo umano</h4>
              </div>
              <div class="cs-last-mm-diagram">
                <div class="cs-last-mm-bar">
                  <div class="cs-last-mm-sapiens" title="300.000 anni fa: comparsa di Homo sapiens (0,022 mm)"></div>
                  <div class="cs-last-mm-history" title="Ultimi 10.000 anni: agricoltura, città, scrittura (0,0007 mm)"></div>
                  <div class="cs-last-mm-tech" title="Ultimi 150 anni: il 99% della tecnologia contemporanea (0,00001 mm)"></div>
                </div>
                <div class="cs-last-mm-legend">
                  <span class="cs-legend-dot sapiens"></span> <b>Homo sapiens</b> (0,022 mm sul righello = 300.000 anni)
                  <span class="cs-legend-dot history"></span> <b>Storia umana scritta</b> (0,0007 mm = meno di 1 micron!)
                  <span class="cs-legend-dot tech"></span> <b>99% della tecnologia moderna</b> (0,00001 mm = 10 nanometri!)
                </div>
              </div>
            </div>
            <div class="cs-lim-ruler-detail" id="cs-lim-ruler-detail">
              Tocca un evento sul righello per esplorarne il significato geologico e cosmico durante la lezione.
            </div>
          </div>
        </div>
      </div>

      <!-- Modale: Esploratore Targa Pioneer e Voyager -->
      <div class="cs-lim-modal" id="cs-lim-plaque-modal" hidden>
        <div class="cs-lim-modal-content">
          <div class="cs-lim-modal-head">
            <div>
              <span class="cs-eyebrow">Messaggio interstellare · Slide 10–11</span>
              <h3>La Targa delle Sonde Pioneer e Voyager: Il Messaggio dell'Umanità</h3>
              <p>Disegnata da Carl Sagan e Frank Drake, incisa su alluminio anodizzato in oro a bordo di Pioneer 10 (1972), Pioneer 11 (1973) e completata dal Golden Record di Voyager 1 e 2.</p>
            </div>
            <button class="cs-lim-modal-close" data-close="plaque" type="button">✕</button>
          </div>
          <div class="cs-lim-plaque-body">
            <div class="cs-lim-plaque-stage">
              <img src="assets/cosmos/images/pioneer-plaque.png" alt="Targa di Pioneer e Voyager" class="cs-lim-plaque-img" />
              <!-- Hotspots didattici -->
              <button class="cs-plaque-hotspot" style="top:12%; left:31%" data-hs="hydrogen" type="button" title="Transizione iperfine dell'idrogeno">1</button>
              <button class="cs-plaque-hotspot" style="top:44%; left:32%" data-hs="pulsars" type="button" title="Mappa delle 14 pulsar">2</button>
              <button class="cs-plaque-hotspot" style="top:40%; left:72%" data-hs="humans" type="button" title="Figure umane in scala">3</button>
              <button class="cs-plaque-hotspot" style="top:85%; left:42%" data-hs="planets" type="button" title="Mappa del Sistema Solare e rotta di fuga">4</button>
            </div>
            <div class="cs-lim-plaque-info" id="cs-lim-plaque-info">
              <b>Tocca i numeri cerchiati sulla targa</b> per analizzare i 4 codici universali con cui la civiltà umana si è presentata all'universo.
            </div>
          </div>
        </div>
      </div>
    `;

    this.host.appendChild(this.el);
    this.attachEventListeners();
  }

  attachEventListeners() {
    // Toolbar buttons
    this.el.querySelector('#cs-lim-scale-toggle')?.addEventListener('click', () => {
      const dock = this.el.querySelector('#cs-lim-scales-dock');
      const btn = this.el.querySelector('#cs-lim-scale-toggle');
      if (dock) {
        dock.hidden = !dock.hidden;
        btn?.classList.toggle('is-active', !dock.hidden);
      }
    });

    this.el.querySelector('#cs-lim-laser-toggle')?.addEventListener('click', () => {
      this.toggleLaser();
    });

    this.el.querySelector('#cs-lim-draw-toggle')?.addEventListener('click', () => {
      this.toggleDraw();
    });

    this.el.querySelector('#cs-lim-stars-btn')?.addEventListener('click', () => {
      this.openModal('stellar');
      this.initStellarLab();
    });

    this.el.querySelector('#cs-lim-ruler-btn')?.addEventListener('click', () => {
      this.openModal('ruler');
      this.initRulerLab();
    });

    this.el.querySelector('#cs-lim-plaque-btn')?.addEventListener('click', () => {
      this.openModal('plaque');
      this.initPlaqueLab();
    });

    this.el.querySelector('#cs-lim-fs-btn')?.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });

    this.el.querySelector('#cs-lim-close-btn')?.addEventListener('click', () => {
      this.close();
    });

    // Modals close buttons & backdrop click
    this.el.querySelectorAll('.cs-lim-modal').forEach(modal => {
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.hidden = true;
      });
    });
    this.el.querySelectorAll('.cs-lim-modal-close').forEach(b => {
      b.addEventListener('click', () => {
        const modal = b.closest('.cs-lim-modal');
        if (modal) modal.hidden = true;
      });
    });

    // Cosmic Scale Tiers
    this.el.querySelectorAll('.cs-lim-scale-chip').forEach(b => {
      b.addEventListener('click', () => {
        this.el.querySelectorAll('.cs-lim-scale-chip').forEach(x => x.classList.toggle('is-active', x === b));
        const log = Number(b.dataset.scale);
        if (window.EON && typeof window.EON.navigateToScale === 'function') {
          window.EON.navigateToScale(log);
        }
      });
    });

    // Palette colors
    this.el.querySelectorAll('.cs-lim-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.querySelectorAll('.cs-lim-color-btn').forEach(x => x.classList.toggle('is-active', x === btn));
        this.currentColor = btn.dataset.color;
      });
    });

    this.el.querySelector('#cs-lim-clear-draw')?.addEventListener('click', () => {
      this.clearDrawing();
    });
  }

  open() {
    this.active = true;
    this.el.hidden = false;
    document.body.classList.add('cs-lim-active');
    this.resizeCanvases();
  }

  close() {
    this.active = false;
    this.el.hidden = true;
    this.setLaser(false);
    this.setDraw(false);
    document.body.classList.remove('cs-lim-active');
  }

  toggle() {
    if (this.active) this.close();
    else this.open();
  }

  openModal(type) {
    this.el.querySelectorAll('.cs-lim-modal').forEach(m => m.hidden = true);
    const m = this.el.querySelector(`#cs-lim-${type}-modal`);
    if (m) m.hidden = false;
  }

  /* -------------------------------------------------------------------------- */
  /* Laser Pointer Implementation                                               */
  /* -------------------------------------------------------------------------- */
  initLaser() {
    this.laserCanvas = this.el.querySelector('#cs-lim-laser-canvas');
    this.laserCtx = this.laserCanvas?.getContext('2d');

    const addLaserPoint = (x, y) => {
      if (!this.laserActive) return;
      this.laserParticles.push({
        x, y,
        r: 7,
        alpha: 1.0,
        color: '#f59e0b',
        created: performance.now(),
      });
    };

    window.addEventListener('pointermove', e => {
      if (this.laserActive) addLaserPoint(e.clientX, e.clientY);
    });

    window.addEventListener('touchmove', e => {
      if (this.laserActive && e.touches[0]) {
        addLaserPoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    });

    const loop = () => {
      if (this.laserCtx && this.laserCanvas) {
        this.laserCtx.clearRect(0, 0, this.laserCanvas.width, this.laserCanvas.height);
        const now = performance.now();
        this.laserParticles = this.laserParticles.filter(p => now - p.created < 450);

        for (const p of this.laserParticles) {
          const age = (now - p.created) / 450;
          const a = (1 - age) * p.alpha;
          const rad = p.r * (1 + age * 1.5);

          // Pulsing glow halo
          const grad = this.laserCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 3);
          grad.addColorStop(0, `rgba(255, 230, 150, ${a * 0.9})`);
          grad.addColorStop(0.3, `rgba(245, 158, 11, ${a * 0.6})`);
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)');

          this.laserCtx.fillStyle = grad;
          this.laserCtx.beginPath();
          this.laserCtx.arc(p.x, p.y, rad * 3, 0, Math.PI * 2);
          this.laserCtx.fill();

          // Laser core dot
          this.laserCtx.fillStyle = `rgba(255, 255, 255, ${a})`;
          this.laserCtx.beginPath();
          this.laserCtx.arc(p.x, p.y, rad * 0.7, 0, Math.PI * 2);
          this.laserCtx.fill();
        }
      }
      this.laserAnimId = requestAnimationFrame(loop);
    };

    loop();
  }

  toggleLaser() {
    this.setLaser(!this.laserActive);
  }

  setLaser(active) {
    this.laserActive = active;
    const btn = this.el.querySelector('#cs-lim-laser-toggle');
    btn?.classList.toggle('is-active', active);
    if (this.laserCanvas) this.laserCanvas.style.pointerEvents = 'none';
  }

  /* -------------------------------------------------------------------------- */
  /* Drawing Canvas Implementation                                              */
  /* -------------------------------------------------------------------------- */
  initDrawing() {
    this.drawCanvas = this.el.querySelector('#cs-lim-draw-canvas');
    this.drawCtx = this.drawCanvas?.getContext('2d');

    const getPos = e => {
      const rect = this.drawCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDraw = e => {
      if (!this.drawActive) return;
      this.isDrawing = true;
      const p = getPos(e);
      this.drawPoints.push({ x: p.x, y: p.y, color: this.currentColor, size: this.brushSize, start: true });
      this.renderDrawing();
    };

    const moveDraw = e => {
      if (!this.drawActive || !this.isDrawing) return;
      const p = getPos(e);
      this.drawPoints.push({ x: p.x, y: p.y, color: this.currentColor, size: this.brushSize });
      this.renderDrawing();
    };

    const stopDraw = () => {
      this.isDrawing = false;
    };

    this.drawCanvas?.addEventListener('pointerdown', startDraw);
    this.drawCanvas?.addEventListener('pointermove', moveDraw);
    window.addEventListener('pointerup', stopDraw);

    this.drawCanvas?.addEventListener('touchstart', startDraw, { passive: true });
    this.drawCanvas?.addEventListener('touchmove', moveDraw, { passive: true });
    window.addEventListener('touchend', stopDraw);
  }

  toggleDraw() {
    this.setDraw(!this.drawActive);
  }

  setDraw(active) {
    this.drawActive = active;
    const btn = this.el.querySelector('#cs-lim-draw-toggle');
    const palette = this.el.querySelector('#cs-lim-draw-palette');
    btn?.classList.toggle('is-active', active);
    if (palette) palette.hidden = !active;
    if (this.drawCanvas) {
      this.drawCanvas.style.pointerEvents = active ? 'auto' : 'none';
    }
  }

  clearDrawing() {
    this.drawPoints = [];
    if (this.drawCtx && this.drawCanvas) {
      this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
    }
  }

  renderDrawing() {
    if (!this.drawCtx || !this.drawCanvas || this.drawPoints.length < 2) return;
    this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);

    for (let i = 0; i < this.drawPoints.length; i++) {
      const pt = this.drawPoints[i];
      if (pt.start || i === 0) {
        this.drawCtx.beginPath();
        this.drawCtx.strokeStyle = pt.color;
        this.drawCtx.lineWidth = pt.size;
        this.drawCtx.lineCap = 'round';
        this.drawCtx.lineJoin = 'round';
        this.drawCtx.moveTo(pt.x, pt.y);
      } else {
        this.drawCtx.lineTo(pt.x, pt.y);
        this.drawCtx.stroke();
      }
    }
  }

  resizeCanvases() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.laserCanvas) {
      this.laserCanvas.width = w;
      this.laserCanvas.height = h;
    }
    if (this.drawCanvas) {
      this.drawCanvas.width = w;
      this.drawCanvas.height = h;
      this.renderDrawing();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Laboratorio Didattico: Confronto Giganti Stellari (Slide 23–31)            */
  /* -------------------------------------------------------------------------- */
  initStellarLab() {
    const canvas = this.el.querySelector('#cs-lim-stellar-canvas');
    const zoomSlider = this.el.querySelector('#cs-lim-stellar-zoom');
    const zoomVal = this.el.querySelector('#cs-lim-stellar-zoom-val');
    const infoEl = this.el.querySelector('#cs-lim-stellar-info');
    if (!canvas || !zoomSlider) return;

    const ctx = canvas.getContext('2d');
    let zoom = 1.0;
    let selectedPreset = 1;

    const stars = [
      { id: 'earth', name: 'Terra', rKm: 6371, color: '#38bdf8', cat: 'Pianeta roccioso', note: 'Diametro 12.742 km. A questa scala cosmica, la Terra è spesso invisibile senza un forte ingrandimento.' },
      { id: 'jupiter', name: 'Giove', rKm: 69911, color: '#d4a373', cat: 'Gigante gassoso', note: '11 volte il diametro della Terra. Circa 1/10 del diametro solare.' },
      { id: 'sun', name: 'Sole', rKm: 696340, color: '#f59e0b', cat: 'Stella nana gialla (G2V)', note: 'Diametro 1.392.700 km (109 diametri terrestri). Contiene il 99,86% della massa del Sistema Solare.' },
      { id: 'sirius', name: 'Sirio A', rKm: 1190000, color: '#e0f2fe', cat: 'Stella bianca di sequenza principale (A1V)', note: 'La stella più luminosa del cielo notturno, a 8,6 anni luce da noi. Raggio 1,71 R☉.' },
      { id: 'pollux', name: 'Polluce', rKm: 6127000, color: '#fdba74', cat: 'Gigante arancione (K0III)', note: 'Nella costellazione dei Gemelli a 34 al. Raggio 8,8 R☉.' },
      { id: 'arcturus', name: 'Arturo', rKm: 17670000, color: '#fb923c', cat: 'Gigante rossa (K1.5III)', note: 'La stella più luminosa dell\'emisfero boreale (costellazione di Boote). Raggio circa 25 R☉.' },
      { id: 'aldebaran', name: 'Aldebaran', rKm: 30700000, color: '#ea580c', cat: 'Gigante arancione (K5III)', note: 'L\'occhio del Toro, a 65 anni luce da noi. Raggio 44 R☉.' },
      { id: 'rigel', name: 'Rigel', rKm: 54900000, color: '#93c5fd', cat: 'Supergigante blu (B8Ia)', note: 'Nel piede di Orione a 860 anni luce. 120.000 volte più luminosa del Sole. Raggio 78 R☉.' },
      { id: 'betelgeuse', name: 'Betelgeuse', rKm: 617000000, color: '#dc2626', cat: 'Supergigante rossa (M1-2Ia)', note: 'Sulla spalla di Orione a 640 al. Se fosse al posto del Sole, ingloberebbe Mercurio, Venere, Terra, Marte e Giove! Raggio ~887 R☉.' },
      { id: 'vy_cma', name: 'VY Canis Majoris', rKm: 988000000, color: '#e11d48', cat: 'Ipergigante rossa estrema', note: 'Slide 27, 28, 29, 30: Uno dei mostri cosmici più grandi noti. Il Sole è un microscopico pixel rispetto al suo disco (1.420 R☉).' },
      { id: 'uy_scuti', name: 'UY Scuti', rKm: 1180000000, color: '#c026d3', cat: 'Ipergigante rossa pulsante', note: 'Slide 31: A 9.500 anni luce. Ha un raggio di 1.700 R☉ (quasi 2,4 miliardi di km). Un raggio di luce impiega circa 7 ore a compiere un solo giro!' },
    ];

    const presets = {
      1: { list: ['earth', 'jupiter', 'sun'], baseScale: 0.00018, desc: '<b>Fase 1: Dai pianeti al Sole</b>. Confronto tra Terra (12.742 km), Giove (139.820 km) e il Sole (1.392.700 km).' },
      2: { list: ['jupiter', 'sun', 'sirius', 'pollux'], baseScale: 0.000045, desc: '<b>Fase 2: Dal Sole alle stelle vicine</b>. Il Sole accanto a Sirio A e Polluce.' },
      3: { list: ['sun', 'sirius', 'pollux', 'arcturus', 'aldebaran'], baseScale: 0.000012, desc: '<b>Fase 3: L\'ascesa delle giganti rosse</b>. Aldebaran e Arturo sovrastano il Sole.' },
      4: { list: ['aldebaran', 'rigel', 'betelgeuse'], baseScale: 0.0000007, desc: '<b>Fase 4: Le supergiganti di Orione</b>. Betelgeuse (raggio di 600 milioni di km) farebbe sparire l\'orbita terrestre.' },
      5: { list: ['sun', 'betelgeuse', 'vy_cma', 'uy_scuti'], baseScale: 0.00000032, desc: '<b>Fase 5: I mostri del cosmo (Slide 28 e 31)</b>. Confronto estremo: UY Scuti e VY Canis Majoris. A questo ingrandimento il Sole è un minuscolo puntino di 1 pixel!' },
    };

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, w, h);

      // Starfield background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 60; i++) {
        const sx = (i * 137.5) % w;
        const sy = (i * 223.1) % h;
        ctx.fillRect(sx, sy, 1, 1);
      }

      const p = presets[selectedPreset] || presets[1];
      const activeStars = stars.filter(s => p.list.includes(s.id));
      const baselineY = h * 0.76;
      let curX = 60;

      for (const s of activeStars) {
        const rad = Math.max(2, s.rKm * p.baseScale * zoom);
        const cx = curX + rad;
        const cy = baselineY - rad;

        // Stellar glow / corona
        const grad = ctx.createRadialGradient(cx, cy, Math.max(1, rad * 0.7), cx, cy, rad * 1.35);
        grad.addColorStop(0, s.color);
        grad.addColorStop(0.8, s.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 1.35, 0, Math.PI * 2);
        ctx.fill();

        // Star solid sphere
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.name, cx, baselineY + 22);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        const dStr = s.rKm >= 1e6 ? `${(s.rKm * 2 / 1e6).toFixed(1)} mln km` : `${Math.round(s.rKm * 2).toLocaleString('it-IT')} km`;
        ctx.fillText(dStr, cx, baselineY + 36);

        curX += rad * 2 + 35;
      }

      if (infoEl) {
        infoEl.innerHTML = `
          <div class="cs-lim-info-card">
            ${p.desc}
            <div class="cs-lim-info-meta">
              ${activeStars.map(s => `<span><b>${s.name}</b> (${s.cat}): ${s.note}</span>`).join('<br/>')}
            </div>
          </div>`;
      }
    };

    zoomSlider.addEventListener('input', () => {
      zoom = Number(zoomSlider.value);
      if (zoomVal) zoomVal.textContent = `${zoom.toFixed(1)}×`;
      render();
    });

    this.el.querySelectorAll('.cs-lim-stellar-presets button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.querySelectorAll('.cs-lim-stellar-presets button').forEach(x => x.classList.toggle('is-active', x === btn));
        selectedPreset = Number(btn.dataset.preset);
        zoomSlider.value = '1';
        zoom = 1;
        if (zoomVal) zoomVal.textContent = '1.0×';
        render();
      });
    });

    render();
  }

  /* -------------------------------------------------------------------------- */
  /* Laboratorio Didattico: Righello Cosmico del Tempo (Slide 32)               */
  /* -------------------------------------------------------------------------- */
  initRulerLab() {
    const rulerEl = this.el.querySelector('#cs-lim-meter-ruler');
    const pinsEl = this.el.querySelector('#cs-lim-ruler-pins');
    const gradEl = this.el.querySelector('.cs-lim-ruler-graduations');
    const cursor = this.el.querySelector('#cs-lim-ruler-cursor');
    const detailEl = this.el.querySelector('#cs-lim-ruler-detail');
    if (!rulerEl || !pinsEl) return;

    // Draw millimeter graduations
    if (gradEl && gradEl.children.length === 0) {
      let ticks = '';
      for (let i = 0; i <= 100; i++) {
        ticks += `<span class="cs-ruler-cm" style="left:${i}%"><i>${i % 10 === 0 ? i : ''}</i></span>`;
      }
      gradEl.innerHTML = ticks;
    }

    const events = [
      { cm: 0.0, ago: '13,8 mld anni fa', title: 'Big Bang', text: 'Scocca l\'istante iniziale dello spazio-tempo e dell\'espansione cosmica (0 cm sul righello).' },
      { cm: 23.9, ago: '10,5 mld anni fa', title: 'Prime stelle di Popolazione III', text: 'Le prime fucine stellari sintetizzano carbonio, ossigeno e ferro primordiali (circa 24 cm).' },
      { cm: 67.4, ago: '4,54 mld anni fa', title: 'Nascita del Sole e della Terra', text: 'Collasso della nebulosa protosolare e accrescimento della Terra (67,4 cm sul righello).' },
      { cm: 72.5, ago: '3,8 mld anni fa', title: 'Prime forme di vita unicellulare', text: 'Primi microrganismi negli oceani primordiali terrestri (72,5 cm).' },
      { cm: 82.6, ago: '2,4 mld anni fa', title: 'Grande evento ossidativo', text: 'I cianobatteri producono ossigeno molecolare, trasformando l\'atmosfera della Terra (82,6 cm).' },
      { cm: 96.1, ago: '540 mln anni fa', title: 'Esplosione del Cambriano', text: 'Straordinaria radiazione adattativa di quasi tutti i phyla animali moderni (96,1 cm).' },
      { cm: 98.3, ago: '240 mln anni fa', title: 'Comparsa dei Dinosauri', text: 'I dinosauri dominano gli ecosistemi terrestri nel Mesozoico (98,3 cm).' },
      { cm: 99.52, ago: '66 mln anni fa', title: 'Estinzione K-T (Asteroide)', text: 'Impatto di Chicxulub nel Golfo del Messico ed estinzione dei dinosauri non aviani (99,52 cm).' },
      { cm: 99.9978, ago: '300.000 anni fa', title: 'Homo sapiens (Ultimi 0,022 mm!)', text: 'L\'intera specie Homo sapiens compare negli ultimi 0,022 mm del righello lungo 1 metro!' },
    ];

    pinsEl.innerHTML = events.map((e, idx) => `
      <button class="cs-ruler-pin" style="left:${e.cm}%" data-idx="${idx}" type="button" title="${e.title}">
        <span></span>
        <label>${e.title}</label>
      </button>
    `).join('');

    const showEvent = idx => {
      const ev = events[idx];
      if (!ev) return;
      if (cursor) cursor.style.left = `${ev.cm}%`;
      pinsEl.querySelectorAll('.cs-ruler-pin').forEach(p => p.classList.toggle('is-active', Number(p.dataset.idx) === idx));
      if (detailEl) {
        detailEl.innerHTML = `
          <div class="cs-ruler-card">
            <span class="cs-eyebrow">${ev.ago} · Posizione sul righello: ${ev.cm.toFixed(3)} cm</span>
            <h4>${ev.title}</h4>
            <p>${ev.text}</p>
          </div>
        `;
      }
    };

    pinsEl.querySelectorAll('.cs-ruler-pin').forEach(btn => {
      btn.addEventListener('click', () => {
        showEvent(Number(btn.dataset.idx));
      });
    });

    showEvent(events.length - 1);
  }

  /* -------------------------------------------------------------------------- */
  /* Laboratorio Didattico: Targa Pioneer & Voyager (Slide 10–11)               */
  /* -------------------------------------------------------------------------- */
  initPlaqueLab() {
    const infoEl = this.el.querySelector('#cs-lim-plaque-info');
    const spots = {
      hydrogen: {
        title: '1. Transizione Iperfine dell\'Idrogeno Neutro (In alto a sinistra)',
        text: 'Due atomi di idrogeno con spin parallelo e antiparallelo del protone ed elettrone. La transizione emette un\'onda radio di 21 cm (1420 MHz). Questa lunghezza d\'onda (21 cm) e il suo periodo (0,7 ns) fungono da "righello universale" per misurare tutte le distanze e i tempi della targa.',
      },
      pulsars: {
        title: '2. Mappa delle 14 Pulsar (Al centro a sinistra)',
        text: '14 linee radiali che partono dal Sole. Ogni linea indica la direzione verso una specifica pulsar galattica, con il periodo di rotazione espresso in codice binario (multipli di 0,7 ns). Poiché le pulsar rallentano in modo prevedibile col tempo, questo schema permette a una civiltà aliena di triangolare la posizione del Sole e calcolare l\'epoca esatta del lancio.',
      },
      humans: {
        title: '3. Figure Umane e Sagoma della Sonda (Al centro a destra)',
        text: 'Un uomo e una donna davanti alla sagoma in scala della navicella spaziale Pioneer. Tra i due trattini a destra è segnato in codice binario "8", che moltiplicato per l\'unità di 21 cm fornisce esattamente 168 cm (l\'altezza media della donna). La mano alzata dell\'uomo è il saluto universale di pace.',
      },
      planets: {
        title: '4. Il Sistema Solare e la Rotta della Sonda (In basso)',
        text: 'Il Sole e i pianeti in ordine di distanza: Mercurio, Venere, Terra, Marte, Giove, Saturno (con anelli), Urano, Nettuno e Plutone. Una linea traccia la traiettoria della navicella spaziale che parte dal 3° pianeta (la Terra), sfrutta la fionda gravitazionale di Giove ed esce per sempre dal Sistema Solare.',
      },
    };

    this.el.querySelectorAll('.cs-plaque-hotspot').forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.querySelectorAll('.cs-plaque-hotspot').forEach(x => x.classList.toggle('is-active', x === btn));
        const key = btn.dataset.hs;
        const d = spots[key];
        if (d && infoEl) {
          infoEl.innerHTML = `
            <div class="cs-plaque-card">
              <span class="cs-eyebrow">Codice di comunicazione interstellare</span>
              <h4>${d.title}</h4>
              <p>${d.text}</p>
            </div>
          `;
        }
      });
    });
  }
}
