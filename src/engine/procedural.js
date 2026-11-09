import * as THREE from 'three';

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Soft round point / beacon. */
export function makeGlowTexture({ core = 0.15, halo = 0.85, color = '255,255,255' } = {}) {
  return canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, `rgba(${color},1)`);
    g.addColorStop(core, `rgba(${color},0.95)`);
    g.addColorStop(core + 0.15, `rgba(${color},0.35)`);
    g.addColorStop(halo, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/** A minimal locator ring with a central point. */
export function makeBeaconTexture(color = '#82C8F5') {
  return canvasTexture(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.12);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Radial corona used for the Sun. */
export function makeCoronaTexture() {
  return canvasTexture(512, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.06, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.06, 'rgba(255,240,205,0.55)');
    g.addColorStop(0.22, 'rgba(255,205,140,0.16)');
    g.addColorStop(0.55, 'rgba(255,180,100,0.035)');
    g.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // delicate streamers
    const rand = mulberry32(7);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2;
      const len = s * (0.16 + rand() * 0.28);
      const grad = ctx.createLinearGradient(
        s / 2 + Math.cos(a) * s * 0.07, s / 2 + Math.sin(a) * s * 0.07,
        s / 2 + Math.cos(a) * len, s / 2 + Math.sin(a) * len,
      );
      grad.addColorStop(0, `rgba(255,220,170,${0.05 + rand() * 0.06})`);
      grad.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      ctx.moveTo(s / 2 + Math.cos(a) * s * 0.07, s / 2 + Math.sin(a) * s * 0.07);
      ctx.lineTo(s / 2 + Math.cos(a) * len, s / 2 + Math.sin(a) * len);
      ctx.stroke();
    }
  });
}

/**
 * Illustrative far-field galaxy sprite. Multiple morphology presets.
 */
export function makeGalaxyTexture(type = 'spiral', seed = 1, palette = 'warm') {
  const size = 768;
  return canvasTexture(size, (ctx, s) => {
    const rand = mulberry32(seed);
    const cx = s / 2, cy = s / 2;
    ctx.clearRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'lighter';

    const armColor = palette === 'blue'
      ? ['rgba(155,196,255,', 'rgba(215,232,255,', 'rgba(255,226,185,']
      : ['rgba(190,205,240,', 'rgba(255,237,205,', 'rgba(255,206,163,'];
    const coreColor = palette === 'blue' ? 'rgba(205,228,255,' : 'rgba(255,235,210,';

    if (type === 'elliptical' || type === 'lenticular') {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.47);
      g.addColorStop(0, 'rgba(255,246,226,0.94)');
      g.addColorStop(0.08, 'rgba(255,232,198,0.62)');
      g.addColorStop(0.26, 'rgba(245,222,196,0.25)');
      g.addColorStop(0.6, 'rgba(220,210,205,0.07)');
      g.addColorStop(1, 'rgba(200,200,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * (type === 'lenticular' ? 0.46 : 0.4), s * (type === 'lenticular' ? 0.18 : 0.33), 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3200; i++) {
        const r = Math.pow(rand(), 1.8) * s * 0.42;
        const a = rand() * Math.PI * 2;
        const e = type === 'lenticular' ? 0.38 : 0.76;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * e;
        const al = (1 - r / (s * 0.5)) * 0.11;
        ctx.fillStyle = `rgba(255,240,218,${al})`;
        ctx.fillRect(x, y, 1.2, 1.2);
      }
      return;
    }

    if (type === 'edgeon') {
      const g = ctx.createLinearGradient(0, cy - s * 0.12, 0, cy + s * 0.12);
      g.addColorStop(0, 'rgba(255,235,205,0)');
      g.addColorStop(0.35, 'rgba(255,235,205,0.26)');
      g.addColorStop(0.5, 'rgba(255,247,228,0.86)');
      g.addColorStop(0.62, 'rgba(210,195,180,0.28)');
      g.addColorStop(1, 'rgba(255,220,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.47, s * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.19);
      cg.addColorStop(0, 'rgba(255,248,228,0.96)');
      cg.addColorStop(0.15, 'rgba(255,230,194,0.55)');
      cg.addColorStop(0.5, 'rgba(230,215,200,0.1)');
      cg.addColorStop(1, 'rgba(230,215,200,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, s, s);
      // dust lane
      ctx.globalCompositeOperation = 'source-over';
      const dg = ctx.createLinearGradient(0, cy + s * 0.005, 0, cy + s * 0.055);
      dg.addColorStop(0, 'rgba(28,22,18,0)');
      dg.addColorStop(0.5, 'rgba(32,24,18,0.52)');
      dg.addColorStop(1, 'rgba(28,22,18,0)');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.ellipse(cx, cy + s * 0.03, s * 0.43, s * 0.018, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (type === 'irregular') {
      for (let c = 0; c < 7; c++) {
        const bx = cx + (rand() - 0.5) * s * 0.38;
        const by = cy + (rand() - 0.5) * s * 0.25;
        const br = s * (0.04 + rand() * 0.13);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, 'rgba(240,236,220,0.28)');
        g.addColorStop(0.3, 'rgba(190,205,230,0.12)');
        g.addColorStop(1, 'rgba(160,180,220,0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - br, by - br, br * 2, br * 2);
        for (let i = 0; i < 500; i++) {
          const a = rand() * Math.PI * 2;
          const r = Math.pow(rand(), 0.6) * br;
          ctx.fillStyle = `rgba(220,230,255,${0.15 * (1 - r / br)})`;
          ctx.fillRect(bx + Math.cos(a) * r, by + Math.sin(a) * r, 1.2, 1.2);
        }
      }
      return;
    }

    // Spiral / barred spiral
    const arms = type === 'barred' ? 2 : 2;
    const coreR = s * 0.26;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    cg.addColorStop(0, 'rgba(255,250,235,0.92)');
    cg.addColorStop(0.06, 'rgba(255,238,208,0.7)');
    cg.addColorStop(0.25, 'rgba(255,218,175,0.34)');
    cg.addColorStop(0.7, 'rgba(255,205,165,0.08)');
    cg.addColorStop(1, 'rgba(255,200,160,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    if (type === 'barred') {
      const bg = ctx.createLinearGradient(cx - s * 0.25, cy, cx + s * 0.25, cy);
      bg.addColorStop(0, 'rgba(255,230,190,0)');
      bg.addColorStop(0.5, 'rgba(255,241,214,0.28)');
      bg.addColorStop(1, 'rgba(255,230,190,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.23, s * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Log-spiral arms drawn as a dense scatter.
    const turns = 2.2;
    const pitch = 0.28;
    const armSeeds = [0, Math.PI, Math.PI * 0.55, Math.PI * 1.55];
    const total = 4200;
    for (let i = 0; i < total; i++) {
      const arm = Math.floor(rand() * armSeeds.length);
      const t = Math.pow(rand(), 0.64);
      const theta = armSeeds[arm] + t * turns * Math.PI * 2;
      const r = s * 0.055 + t * s * 0.42;
      const spread = (rand() - 0.5) * (0.035 + t * 0.085) * s;
      const x = cx + Math.cos(theta) * r + spread;
      const y = cy + Math.sin(theta) * r * 0.86 + (rand() - 0.5) * s * 0.025;
      const a = (0.07 + rand() * 0.2) * (1 - t * 0.35);
      const c = armColor[Math.floor(rand() * armColor.length)];
      ctx.fillStyle = `${c}${a.toFixed(3)})`;
      const sz = rand() < 0.06 ? 2.2 : 1.1;
      ctx.fillRect(x, y, sz, sz);
    }
    // HII knots
    for (let i = 0; i < 55; i++) {
      const t = Math.pow(rand(), 0.6);
      const theta = armSeeds[Math.floor(rand() * 4)] + t * turns * Math.PI * 2;
      const r = s * 0.07 + t * s * 0.41;
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r * 0.86;
      const rr = 1.5 + rand() * 4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, 'rgba(255,155,175,0.55)');
      g.addColorStop(1, 'rgba(255,120,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // Faint halo
    const hg = ctx.createRadialGradient(cx, cy, s * 0.2, cx, cy, s * 0.5);
    hg.addColorStop(0, 'rgba(160,190,245,0.03)');
    hg.addColorStop(1, 'rgba(160,190,245,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Ultra-subtle equirectangular earth-glow-free grid for the sky? reserved. */

export function makeRingTexture() {
  return canvasTexture(1024, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    // draw Saturn's rings as a radial strip; used with a 1D-ish custom mapping
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0.0, 'rgba(180,160,130,0)');
    g.addColorStop(0.16, 'rgba(190,170,140,0.15)');
    g.addColorStop(0.3, 'rgba(235,216,180,0.55)');
    g.addColorStop(0.48, 'rgba(244,229,196,0.8)');
    g.addColorStop(0.56, 'rgba(220,205,175,0.25)');
    g.addColorStop(0.62, 'rgba(246,232,201,0.7)');
    g.addColorStop(0.84, 'rgba(230,214,185,0.5)');
    g.addColorStop(0.9, 'rgba(210,195,168,0.45)');
    g.addColorStop(1.0, 'rgba(180,165,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Procedurally painted small-body texture. Illustrative only; not an observation. */
export function makeMoonTexture({ base = '#9b958c', accent = '#6b665f', seed = 4, streaks = false, mottle = 0.5 } = {}) {
  const key = `${base}-${accent}-${seed}-${streaks}-${mottle}`;
  if (!makeMoonTexture.cache) makeMoonTexture.cache = new Map();
  if (makeMoonTexture.cache.has(key)) return makeMoonTexture.cache.get(key);
  const rand = mulberry32(seed * 977 + 13);
  const tex = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    // broad albedo provinces
    for (let i = 0; i < 26; i++) {
      const x = rand() * s, y = rand() * s;
      const rx = s * (0.04 + rand() * 0.18), ry = s * (0.02 + rand() * 0.12);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      const alpha = (0.08 + rand() * 0.2) * mottle;
      g.addColorStop(0, accent);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // craters / speckle
    for (let i = 0; i < 900; i++) {
      const x = rand() * s, y = rand() * s, r = Math.pow(rand(), 2.4) * 7 + 0.4;
      ctx.globalAlpha = 0.07 + rand() * 0.18;
      ctx.strokeStyle = rand() < 0.5 ? 'rgba(245,242,235,0.35)' : 'rgba(25,22,20,0.35)';
      ctx.lineWidth = 0.5 + rand();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (streaks) {
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 50; i++) {
        const x = rand() * s, y = rand() * s;
        ctx.strokeStyle = rand() < 0.5 ? '#c8d8e5' : '#7d6d61';
        ctx.lineWidth = 0.5 + rand() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 8; j++) {
          ctx.lineTo(x + (rand() - 0.5) * s * 0.2, y + (rand() - 0.3) * s * 0.08);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // subtle polar tint
    const pg = ctx.createLinearGradient(0, 0, 0, s);
    pg.addColorStop(0, 'rgba(255,255,255,0.08)');
    pg.addColorStop(0.2, 'rgba(255,255,255,0)');
    pg.addColorStop(0.8, 'rgba(255,255,255,0)');
    pg.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, s, s);
  });
  makeMoonTexture.cache.set(key, tex);
  return tex;
}

/** Authentic New Horizons based procedural texture for Pluto */
export function makePlutoTexture() {
  if (makePlutoTexture.tex) return makePlutoTexture.tex;
  const tex = canvasTexture(1024, (ctx, s) => {
    const w = s, h = s / 2;
    // Base nitrogen/methane ice: warm terracotta beige
    ctx.fillStyle = '#bfa792';
    ctx.fillRect(0, 0, w, h);

    const rand = mulberry32(1930);

    // Dark reddish-brown tholin belt along the equator (Cthulhu Macula)
    for (let i = 0; i < 40; i++) {
      const cx = (w * 0.15) + (rand() * w * 0.55);
      const cy = (h * 0.48) + (rand() - 0.5) * h * 0.22;
      const rx = w * (0.05 + rand() * 0.12);
      const ry = h * (0.04 + rand() * 0.08);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
      g.addColorStop(0, 'rgba(74, 38, 25, 0.88)');
      g.addColorStop(0.6, 'rgba(110, 62, 42, 0.65)');
      g.addColorStop(1, 'rgba(191, 167, 146, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rand() * 0.4 - 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // The iconic bright heart: Tombaugh Regio (Sputnik Planitia)
    const hx = w * 0.52, hy = h * 0.52;
    const heartGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, w * 0.16);
    heartGrad.addColorStop(0, 'rgba(255, 248, 240, 0.95)');
    heartGrad.addColorStop(0.5, 'rgba(245, 235, 222, 0.85)');
    heartGrad.addColorStop(0.85, 'rgba(228, 212, 195, 0.5)');
    heartGrad.addColorStop(1, 'rgba(191, 167, 146, 0)');
    ctx.fillStyle = heartGrad;
    ctx.beginPath();
    // Heart shape lobe 1 (Sputnik Planitia smooth nitrogen ice lobe)
    ctx.ellipse(hx - w * 0.035, hy - h * 0.02, w * 0.09, h * 0.16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Heart lobe 2
    ctx.beginPath();
    ctx.ellipse(hx + w * 0.035, hy + h * 0.02, w * 0.08, h * 0.14, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Rugged water ice mountain ranges bordering Sputnik Planitia (Tenzing & Hillary Montes)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 60; k++) {
      const mx = hx - w * 0.09 + (rand() - 0.5) * w * 0.04;
      const my = hy + (rand() - 0.5) * h * 0.25;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + (rand() - 0.5) * 6, my + (rand() - 0.5) * 8);
      ctx.stroke();
    }

    // Craters and fractured ice polygons across north and south
    for (let i = 0; i < 400; i++) {
      const x = rand() * w, y = rand() * h;
      // Less craters on smooth Sputnik Planitia
      if (Math.hypot(x - hx, y - hy) < w * 0.1) continue;
      const r = Math.pow(rand(), 2.8) * 6 + 0.6;
      ctx.strokeStyle = rand() < 0.6 ? 'rgba(50, 30, 20, 0.45)' : 'rgba(255, 250, 240, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bright polar frost cap
    const northFrost = ctx.createLinearGradient(0, 0, 0, h * 0.25);
    northFrost.addColorStop(0, 'rgba(250, 245, 235, 0.35)');
    northFrost.addColorStop(1, 'rgba(250, 245, 235, 0)');
    ctx.fillStyle = northFrost;
    ctx.fillRect(0, 0, w, h * 0.25);
  });
  makePlutoTexture.tex = tex;
  return tex;
}

/** Authentic Dawn-mission based procedural texture for Ceres */
export function makeCeresTexture() {
  if (makeCeresTexture.tex) return makeCeresTexture.tex;
  const tex = canvasTexture(1024, (ctx, s) => {
    const w = s, h = s / 2;
    // Dark grey carbonaceous chondrite regolith
    ctx.fillStyle = '#615c56';
    ctx.fillRect(0, 0, w, h);
    const rand = mulberry32(1801);

    // Albedo variations and impact basins
    for (let i = 0; i < 60; i++) {
      const cx = rand() * w, cy = rand() * h;
      const r = w * (0.03 + rand() * 0.12);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rand() < 0.5 ? '#4a4641' : '#736d66');
      g.addColorStop(1, 'rgba(97, 92, 86, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dense cratering
    for (let i = 0; i < 700; i++) {
      const x = rand() * w, y = rand() * h;
      const r = Math.pow(rand(), 2.5) * 8 + 0.8;
      ctx.strokeStyle = rand() < 0.5 ? 'rgba(30, 28, 25, 0.5)' : 'rgba(180, 175, 168, 0.35)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Occator Crater with brilliant sodium carbonate salt deposits (Cerealia Facula)
    const ox = w * 0.44, oy = h * 0.48;
    const rimGrad = ctx.createRadialGradient(ox, oy, 4, ox, oy, 22);
    rimGrad.addColorStop(0, 'rgba(40, 38, 35, 0.8)');
    rimGrad.addColorStop(1, 'rgba(97, 92, 86, 0)');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(ox, oy, 22, 0, Math.PI * 2);
    ctx.fill();

    const saltGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 8);
    saltGrad.addColorStop(0, '#ffffff');
    saltGrad.addColorStop(0.4, 'rgba(240, 245, 255, 0.95)');
    saltGrad.addColorStop(0.8, 'rgba(210, 220, 235, 0.4)');
    saltGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = saltGrad;
    ctx.beginPath();
    ctx.arc(ox, oy, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  makeCeresTexture.tex = tex;
  return tex;
}

/** Thin targeting reticle for selected bodies. No central glow. */
export function makeSelectionTexture(color = '#9ed8ff') {
  return canvasTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    const r = s * 0.38;
    for (let k = 0; k < 4; k++) {
      const start = k * Math.PI / 2 + 0.22;
      const end = start + Math.PI / 2 - 0.44;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, r, start, end);
      ctx.stroke();
    }
    // four tiny ticks
    ctx.globalAlpha = 0.75;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(s / 2 + Math.cos(a) * r * 0.78, s / 2 + Math.sin(a) * r * 0.78);
      ctx.lineTo(s / 2 + Math.cos(a) * r * 0.64, s / 2 + Math.sin(a) * r * 0.64);
      ctx.stroke();
    }
  });
}
