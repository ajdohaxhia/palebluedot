/** COSMOS interactive stage components. Pure DOM/SVG/Canvas; no external dependencies. */

const C_KMS = 299_792.458;
const AU_KM = 149_597_870.7;
const LY_KM = 9.460_730_472_580_8e12;
const AU_LY = AU_KM / LY_KM;
const YEAR_S = 365.25 * 86400;
const NUM = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const NUM1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
const NUM2 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const km = v => `${NUM.format(Math.round(v))} km`;
const au = v => `${NUM1.format(v)} UA`;
const lightTime = seconds => {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 120) return `${NUM1.format(seconds)} s`;
  if (seconds < 7200) return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
  return `${NUM1.format(seconds / 3600)} h`;
};
const diameterAu = radiusKm => (radiusKm * 2) / AU_KM;

/* -------------------------------------------------------------------------- */
/* Image viewer with Loupe, Minimap & Animated Hotspots                        */
/* -------------------------------------------------------------------------- */
export function mountImageStage(cfg, host) {
  const ac = new AbortController();
  const hotspots = cfg.hotspots || [];
  host.innerHTML = `
    <div class="cs-image-stage ${cfg.aspect === "portrait" ? "is-portrait" : cfg.aspect === "square" ? "is-square" : "is-landscape"}">
      <div class="cs-iv-top">
        <div class="cs-iv-badge-wrap">
          <span class="cs-eyebrow">${cfg.eyebrow || "Immagine scientifica"}</span>
          <span class="cs-iv-zoom-badge mono" id="cs-iv-zoom-badge">100%</span>
        </div>
        <div class="cs-iv-tools">
          <button class="cs-round" data-iv="out" type="button" aria-label="Riduci" title="Riduci zoom (−)">−</button>
          <button class="cs-round" data-iv="in" type="button" aria-label="Ingrandisci" title="Ingrandisci zoom (+)">+</button>
          <button class="cs-round" data-iv="reset" type="button" aria-label="Reimposta zoom" title="Reimposta (1:1)">↺</button>
          <button class="cs-round" data-iv="full" type="button" aria-label="Schermo intero" title="Schermo intero">⛶</button>
        </div>
      </div>
      <div class="cs-iv-viewport" tabindex="0" role="img" aria-label="${esc(cfg.alt || cfg.caption || "Immagine")}">
        <div class="cs-iv-canvas">
          <img src="${esc(cfg.src)}" alt="${esc(cfg.alt || cfg.caption || "")}" draggable="false" />
          ${hotspots.map((h, i) => `
            <button class="cs-hotspot" type="button" data-hot="${i}" style="left:${h.x}%;top:${h.y}%" aria-label="${esc(h.title)}">
              <span class="cs-hotspot-radar"></span>
              <i>${i + 1}</i>
              <span class="cs-hotspot-tag">${esc(h.title)}</span>
            </button>`).join("")}
        </div>
        <div class="cs-iv-minimap" id="cs-iv-minimap" style="background-image:url(&quot;${esc(cfg.src)}&quot;)" aria-hidden="true" hidden>
          <div class="cs-iv-minimap-box" id="cs-iv-minimap-box"></div>
        </div>
        <div class="cs-iv-pop" hidden>
          <div class="cs-iv-pop-head">
            <span class="cs-eyebrow">Punto di interesse</span>
            <button class="cs-iv-pop-close" type="button" aria-label="Chiudi">×</button>
          </div>
          <h4 class="cs-iv-pop-title"></h4>
          <p></p>
        </div>
      </div>
      <div class="cs-iv-foot">
        <p class="cs-caption">${esc(cfg.caption || "")}</p>
        <div class="cs-iv-meta">
          <span class="cs-iv-credit">${esc(cfg.credit || "")}</span>
          <span class="cs-iv-help">${hotspots.length ? "Tocca i punti o premi [Invio] · Rotella per zoom" : "Rotella o doppio clic per ingrandire"}</span>
        </div>
      </div>
    </div>`;

  const vp = host.querySelector(".cs-iv-viewport");
  const canvas = host.querySelector(".cs-iv-canvas");
  const img = host.querySelector("img");
  const pop = host.querySelector(".cs-iv-pop");
  const popTitle = host.querySelector(".cs-iv-pop-title");
  const zoomBadge = host.querySelector("#cs-iv-zoom-badge");
  const minimap = host.querySelector("#cs-iv-minimap");
  const minimapBox = host.querySelector("#cs-iv-minimap-box");

  let scale = 1, tx = 0, ty = 0, dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;
  
  const updateMinimap = () => {
    if (!minimap || !minimapBox) return;
    if (scale > 1.05) {
      minimap.hidden = false;
      const boxW = Math.max(12, 100 / scale);
      const boxH = Math.max(12, 100 / scale);
      const maxX = (vp.clientWidth * (scale - 1)) / 2;
      const maxY = (vp.clientHeight * (scale - 1)) / 2;
      const normX = maxX > 0 ? 0.5 - (tx / (2 * maxX)) : 0.5;
      const normY = maxY > 0 ? 0.5 - (ty / (2 * maxY)) : 0.5;
      minimapBox.style.width = `${boxW}%`;
      minimapBox.style.height = `${boxH}%`;
      minimapBox.style.left = `${Math.max(0, Math.min(100 - boxW, (normX * 100) - (boxW / 2)))}%`;
      minimapBox.style.top = `${Math.max(0, Math.min(100 - boxH, (normY * 100) - (boxH / 2)))}%`;
    } else {
      minimap.hidden = true;
    }
  };

  const apply = () => {
    canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    canvas.style.cursor = scale > 1.02 ? "grab" : "default";
    if (zoomBadge) zoomBadge.textContent = `${Math.round(scale * 100)}%`;
    updateMinimap();
  };

  const clamp = () => {
    scale = Math.min(7, Math.max(1, scale));
    const maxX = (vp.clientWidth * (scale - 1)) / 2;
    const maxY = (vp.clientHeight * (scale - 1)) / 2;
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  };

  const zoomBy = f => { scale *= f; clamp(); apply(); };
  
  host.querySelector('[data-iv="in"]')?.addEventListener("click", () => zoomBy(1.35), { signal: ac.signal });
  host.querySelector('[data-iv="out"]')?.addEventListener("click", () => zoomBy(1 / 1.35), { signal: ac.signal });
  host.querySelector('[data-iv="reset"]')?.addEventListener("click", () => { scale = 1; tx = 0; ty = 0; apply(); pop.hidden = true; }, { signal: ac.signal });
  host.querySelector('[data-iv="full"]')?.addEventListener("click", () => {
    const el = vp.closest(".cs-image-stage") || vp;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => {});
  }, { signal: ac.signal });

  vp.addEventListener("wheel", e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false, signal: ac.signal });
  vp.addEventListener("pointerdown", e => {
    if (e.target.closest(".cs-hotspot")) return;
    dragging = true; sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
    vp.setPointerCapture?.(e.pointerId); vp.style.cursor = "grabbing";
  }, { signal: ac.signal });
  vp.addEventListener("pointermove", e => {
    if (!dragging) return;
    tx = stx + e.clientX - sx; ty = sty + e.clientY - sy; clamp(); apply();
  }, { signal: ac.signal });
  vp.addEventListener("pointerup", () => { dragging = false; vp.style.cursor = scale > 1.02 ? "grab" : "default"; }, { signal: ac.signal });
  vp.addEventListener("pointercancel", () => { dragging = false; }, { signal: ac.signal });
  vp.addEventListener("dblclick", e => { if (e.target.closest(".cs-hotspot")) return; zoomBy(scale > 1.5 ? 1 / scale : 2.0); }, { signal: ac.signal });
  vp.addEventListener("keydown", e => {
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.35); }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.35); }
    if (e.key === "0") { e.preventDefault(); scale = 1; tx = 0; ty = 0; apply(); }
    if (e.key === "Escape") { pop.hidden = true; }
  }, { signal: ac.signal });

  host.querySelectorAll(".cs-hotspot").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    const h = hotspots[Number(b.dataset.hot)];
    if (popTitle) popTitle.textContent = h.title;
    else pop.querySelector(".cs-eyebrow").textContent = h.title;
    pop.querySelector("p").textContent = h.text;
    pop.hidden = false;
  }, { signal: ac.signal }));

  host.querySelector(".cs-iv-pop-close")?.addEventListener("click", () => { pop.hidden = true; }, { signal: ac.signal });
  img?.addEventListener("load", () => { canvas.classList.add("is-loaded"); apply(); }, { signal: ac.signal });
  if (img?.complete) canvas.classList.add("is-loaded");
  apply();
  return { destroy() { ac.abort(); } };
}

/* -------------------------------------------------------------------------- */
/* Realistic 3D Celestial Sphere & Boundary Renderers                         */
/* -------------------------------------------------------------------------- */
export function drawRealisticCelestialSphere(ctx, cx, cy, r, name, rot = 0, isStar = false) {
  if (r <= 0.5) return;
  const n = String(name || '').toLowerCase();
  ctx.save();

  // Star rendering
  if (isStar || r >= 600000 || n.includes('sole') || n.includes('sun') || n.includes('sirio') || n.includes('aldebaran') || n.includes('betelgeuse') || n.includes('vy') || n.includes('scuti')) {
    let coreCol = '#fff9e6', midCol = '#ffa726', outerCol = '#e65100', flareCol = '#ffb74d';
    if (n.includes('sirio') || n.includes('sirius')) {
      coreCol = '#ffffff'; midCol = '#90caf9'; outerCol = '#1e88e5'; flareCol = '#bbdefb';
    } else if (n.includes('aldebaran')) {
      coreCol = '#fff3e0'; midCol = '#ff7043'; outerCol = '#d84315'; flareCol = '#ff8a65';
    } else if (n.includes('betelgeuse') || n.includes('vy') || n.includes('scuti')) {
      coreCol = '#ffebee'; midCol = '#e53935'; outerCol = '#b71c1c'; flareCol = '#ff5252';
    }

    // Coronal bloom
    const coronaR = r * 1.55;
    const cg = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, coronaR);
    cg.addColorStop(0, flareCol);
    cg.addColorStop(0.35, `${flareCol}55`);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, coronaR, 0, Math.PI * 2);
    ctx.fill();

    // Star body with physical limb darkening
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const starGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    starGrad.addColorStop(0, coreCol);
    starGrad.addColorStop(0.5, midCol);
    starGrad.addColorStop(0.85, outerCol);
    starGrad.addColorStop(1, '#000000');
    ctx.fillStyle = starGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Dynamic solar convective granulation
    if (r > 12) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      const cells = Math.min(60, Math.floor(r * 1.5));
      for (let i = 0; i < cells; i++) {
        const a = (i * 137.5 + rot * 40) * Math.PI / 180;
        const dist = Math.sqrt((i + 1) / cells) * r * 0.88;
        const px = cx + Math.cos(a) * dist;
        const py = cy + Math.sin(a) * dist;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, r * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  // Planet rendering
  const lx = cx - r * 0.38;
  const ly = cy - r * 0.38;

  // Saturn tilted 3D ring: draw back half first
  const isSaturn = n.includes('saturno') || n.includes('saturn');
  if (isSaturn && r > 6) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.4);
    const outerRx = r * 2.3, outerRy = r * 0.72;
    const innerRx = r * 1.25, innerRy = r * 0.38;
    ctx.beginPath();
    ctx.ellipse(0, 0, outerRx, outerRy, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(0, 0, innerRx, innerRy, 0, Math.PI * 2, Math.PI, true);
    ctx.fillStyle = 'rgba(215, 195, 160, 0.75)';
    ctx.fill();
    ctx.restore();
  }

  // Planet body clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (n.includes('terra') || n.includes('earth')) {
    // Earth: deep blue oceans
    const ocean = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    ocean.addColorStop(0, '#1a5fb4');
    ocean.addColorStop(0.7, '#0c2e68');
    ocean.addColorStop(1, '#030c1e');
    ctx.fillStyle = ocean;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    if (r > 8) {
      // Continents
      ctx.fillStyle = '#3a6631';
      const offset = (rot * 30) % (r * 3);
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.2 + offset * 0.2, cy - r * 0.1, r * 0.35, r * 0.45, 0.2, 0, Math.PI * 2);
      ctx.ellipse(cx + r * 0.3 + offset * 0.2, cy + r * 0.2, r * 0.3, r * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.1 + offset * 0.3, cy - r * 0.3, r * 0.45, r * 0.12, 0.1, 0, Math.PI * 2);
      ctx.ellipse(cx + r * 0.1 + offset * 0.3, cy + r * 0.35, r * 0.5, r * 0.14, -0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ocean specular glint
    const glint = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.45);
    glint.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glint;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (n.includes('giove') || n.includes('jupiter')) {
    // Jupiter: banded atmosphere
    const jupGrad = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    jupGrad.addColorStop(0, '#e8cfb0');
    jupGrad.addColorStop(0.75, '#b08055');
    jupGrad.addColorStop(1, '#2c1c11');
    ctx.fillStyle = jupGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    if (r > 10) {
      const bands = [-0.65, -0.35, -0.1, 0.18, 0.45, 0.68];
      const bandColors = ['#8d502f', '#a8653b', '#733c20', '#995832', '#703c20', '#855235'];
      bands.forEach((by, idx) => {
        ctx.fillStyle = bandColors[idx];
        ctx.fillRect(cx - r, cy + by * r, r * 2, r * 0.14);
      });
      // Great Red Spot
      ctx.fillStyle = '#b8321d';
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.22, cy + r * 0.26, r * 0.2, r * 0.12, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6e1d10';
      ctx.beginPath();
      ctx.arc(cx + r * 0.22, cy + r * 0.26, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (isSaturn) {
    // Saturn globe
    const satGrad = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    satGrad.addColorStop(0, '#f0ddbe');
    satGrad.addColorStop(0.7, '#cbb085');
    satGrad.addColorStop(1, '#332617');
    ctx.fillStyle = satGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    if (r > 10) {
      [-0.4, -0.15, 0.1, 0.35].forEach((by, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(150, 115, 75, 0.35)' : 'rgba(240, 220, 180, 0.25)';
        ctx.fillRect(cx - r, cy + by * r, r * 2, r * 0.15);
      });
    }
  } else if (n.includes('marte') || n.includes('mars')) {
    // Mars: rust red
    const marsGrad = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    marsGrad.addColorStop(0, '#df5e35');
    marsGrad.addColorStop(0.75, '#963416');
    marsGrad.addColorStop(1, '#260a03');
    ctx.fillStyle = marsGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    if (r > 8) {
      ctx.fillStyle = 'rgba(60, 24, 14, 0.6)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.1, r * 0.35, r * 0.25, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // White polar ice cap
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.85, r * 0.28, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (n.includes('venere') || n.includes('venus')) {
    // Venus: creamy sulfur haze
    const venGrad = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    venGrad.addColorStop(0, '#f5e4c4');
    venGrad.addColorStop(0.75, '#d4b37d');
    venGrad.addColorStop(1, '#362812');
    ctx.fillStyle = venGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (n.includes('luna') || n.includes('moon') || n.includes('mercurio') || n.includes('mercury') || n.includes('ceres')) {
    // Moon / Mercury: cratered grey
    const moonGrad = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    moonGrad.addColorStop(0, '#c7c4be');
    moonGrad.addColorStop(0.7, '#726d66');
    moonGrad.addColorStop(1, '#1c1b18');
    ctx.fillStyle = moonGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    if (r > 8) {
      ctx.fillStyle = 'rgba(60, 56, 50, 0.65)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.2, cy - r * 0.15, r * 0.35, r * 0.25, 0.2, 0, Math.PI * 2);
      ctx.ellipse(cx + r * 0.25, cy + r * 0.2, r * 0.28, r * 0.2, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.15, cy + r * 0.35, Math.max(1.5, r * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (n.includes('urano') || n.includes('uranus')) {
    // Uranus: cyan ice giant
    const uGrad = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    uGrad.addColorStop(0, '#bbf2f6');
    uGrad.addColorStop(0.75, '#68c5d1');
    uGrad.addColorStop(1, '#112f36');
    ctx.fillStyle = uGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else if (n.includes('nettuno') || n.includes('neptune')) {
    // Neptune: deep cobalt blue
    const nGrad = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    nGrad.addColorStop(0, '#5b8bf5');
    nGrad.addColorStop(0.7, '#244ecc');
    nGrad.addColorStop(1, '#061340');
    ctx.fillStyle = nGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    if (r > 8) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(cx - r * 0.5, cy - r * 0.2, r * 0.7, 1.5);
      ctx.fillRect(cx - r * 0.2, cy + r * 0.3, r * 0.6, 1.2);
    }
  } else if (n.includes('plutone') || n.includes('pluto')) {
    // Pluto: beige with white heart
    const pGrad = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    pGrad.addColorStop(0, '#d9c2aa');
    pGrad.addColorStop(0.75, '#997d65');
    pGrad.addColorStop(1, '#2e1f14');
    ctx.fillStyle = pGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    if (r > 8) {
      ctx.fillStyle = 'rgba(255, 248, 238, 0.85)';
      ctx.beginPath();
      ctx.arc(cx + r * 0.1, cy + r * 0.1, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Default shaded body
    const dGrad = ctx.createRadialGradient(lx, ly, r * 0.1, cx, cy, r);
    dGrad.addColorStop(0, '#e2e8f0');
    dGrad.addColorStop(0.75, '#64748b');
    dGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = dGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Spherical shadow falloff
  const shadowGrad = ctx.createRadialGradient(lx, ly, r * 0.2, cx, cy, r);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.75, 'rgba(0,0,0,0.15)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  ctx.restore();

  // Saturn front half of rings
  if (isSaturn && r > 6) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.4);
    const outerRx = r * 2.3, outerRy = r * 0.72;
    const innerRx = r * 1.25, innerRy = r * 0.38;
    ctx.beginPath();
    ctx.ellipse(0, 0, outerRx, outerRy, 0, 0, Math.PI);
    ctx.ellipse(0, 0, innerRx, innerRy, 0, Math.PI, 0, true);
    ctx.fillStyle = 'rgba(225, 205, 170, 0.82)';
    ctx.fill();
    // Cassini division gap
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.85, r * 0.58, 0, 0, Math.PI);
    ctx.ellipse(0, 0, r * 1.72, r * 0.54, 0, Math.PI, 0, true);
    ctx.fillStyle = 'rgba(10, 8, 6, 0.75)';
    ctx.fill();
    ctx.restore();
  }

  // Atmospheric limb glow
  if (n.includes('terra') || n.includes('earth') || n.includes('urano') || n.includes('nettuno') || n.includes('venere')) {
    const rimCol = n.includes('venere') ? 'rgba(235, 205, 150, 0.3)' : 'rgba(110, 185, 255, 0.35)';
    ctx.strokeStyle = rimCol;
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* -------------------------------------------------------------------------- */
/* Size comparison with Physical Metrics, 3D Realistic Bodies & Light Orbit   */
/* -------------------------------------------------------------------------- */
export function mountScaleStage(cfg, host) {
  const ac = new AbortController();
  const objects = cfg.objects || [];
  const maxR = Math.max(...objects.map(o => o.radiusKm), 1);
  let zoom = 1;
  let selected = 0;
  let showTable = false;
  let lightTimer = null;
  let heroRot = 0;

  host.innerHTML = `
    <div class="cs-scale-stage">
      <div class="cs-scale-head">
        <div>
          <span class="cs-eyebrow">Scala fisica 3D comparativa</span>
          <p class="cs-scale-sub">${esc(cfg.note || "")}</p>
        </div>
        <div class="cs-scale-head-actions">
          <button class="cs-toggle-btn" id="cs-scale-table-toggle" type="button" title="Tabella dati">Dati</button>
          <label class="cs-zoom"><span>Zoom</span><input type="range" min="0.5" max="8" step="0.1" value="1" aria-label="Zoom della scala" /></label>
        </div>
      </div>
      <div class="cs-scale-viewport">
        <div class="cs-scale-hero-wrap">
          <canvas class="cs-scale-hero-canvas" width="220" height="220" aria-label="Vista 3D realistica"></canvas>
          <span class="cs-scale-hero-hint">Ruota in 3D</span>
        </div>
        <div class="cs-scale-row"></div>
      </div>
      <div class="cs-scale-detail" aria-live="polite"></div>
      <div class="cs-scale-table-panel" id="cs-scale-table-panel" hidden></div>
      <div class="cs-scale-actions">
        <button class="cs-button" data-scale-light type="button" ${cfg.light ? "" : "hidden"}>
          <span class="cs-light-ico">⚡</span>
          <span>Luce attorno alla stella</span>
        </button>
        <span class="cs-scale-light-readout mono" hidden></span>
      </div>
    </div>`;

  const row = host.querySelector(".cs-scale-row");
  const detail = host.querySelector(".cs-scale-detail");
  const tablePanel = host.querySelector("#cs-scale-table-panel");
  const tableToggle = host.querySelector("#cs-scale-table-toggle");
  const slider = host.querySelector('input[type="range"]');
  const heroCanvas = host.querySelector(".cs-scale-hero-canvas");
  const heroCtx = heroCanvas?.getContext("2d");

  const drawHero = () => {
    if (!heroCtx || !heroCanvas) return;
    const w = heroCanvas.width, h = heroCanvas.height;
    heroCtx.clearRect(0, 0, w, h);
    const o = objects[selected];
    if (!o) return;
    const isStar = o.radiusKm >= 600000;
    const hr = Math.min(w, h) * (isStar ? 0.32 : 0.38);
    drawRealisticCelestialSphere(heroCtx, w / 2, h / 2, hr, o.name, heroRot, isStar);
  };

  let heroDragging = false, lastHeroX = 0;
  if (heroCanvas) {
    heroCanvas.addEventListener("pointerdown", e => {
      heroDragging = true;
      lastHeroX = e.clientX;
      heroCanvas.setPointerCapture?.(e.pointerId);
    }, { signal: ac.signal });
    heroCanvas.addEventListener("pointermove", e => {
      if (!heroDragging) return;
      heroRot += (e.clientX - lastHeroX) * 0.015;
      lastHeroX = e.clientX;
      drawHero();
    }, { signal: ac.signal });
    heroCanvas.addEventListener("pointerup", () => { heroDragging = false; }, { signal: ac.signal });
    heroCanvas.addEventListener("pointercancel", () => { heroDragging = false; }, { signal: ac.signal });
  }

  const renderTable = () => {
    if (!tablePanel) return;
    tablePanel.innerHTML = `
      <table class="cs-metric-table">
        <thead>
          <tr>
            <th>Corpo</th>
            <th>Raggio (km)</th>
            <th>R☉</th>
            <th>R⊕</th>
            <th>Diametro (UA)</th>
          </tr>
        </thead>
        <tbody>
          ${objects.map((o, idx) => `
            <tr class="${idx === selected ? "is-active" : ""}">
              <td><span class="cs-color-dot" style="background:${o.color}"></span><b>${esc(o.name)}</b></td>
              <td class="mono">${NUM.format(o.radiusKm)}</td>
              <td class="mono">${NUM2.format(o.radiusKm / 696340)}</td>
              <td class="mono">${NUM1.format(o.radiusKm / 6371)}</td>
              <td class="mono">${NUM2.format(diameterAu(o.radiusKm))}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  };

  const render = () => {
    const avail = Math.max(200, host.clientWidth - 56);
    const minItem = 36, gap = 14;
    const fixed = objects.length * minItem + gap * (objects.length - 1);
    const maxD = Math.min(260, Math.max(64, avail - fixed)) * zoom;
    let factor = maxD / (2 * maxR);
    const totalAt = f => objects.reduce((sum, o) => sum + Math.max(2 * o.radiusKm * f, minItem), 0) + gap * (objects.length - 1);
    if (zoom <= 1.02) {
      const total = totalAt(factor);
      if (total > avail) {
        const allowed = Math.max(0, avail - fixed);
        const excess = total - fixed;
        if (allowed > 0 && excess > 0) factor *= allowed / excess;
      }
    }
    row.style.justifyContent = "center";
    row.innerHTML = objects.map((o, i) => {
      const d = Math.max(8, 2 * o.radiusKm * factor);
      const isStar = o.radiusKm >= 600000;
      const sizePx = Math.max(d, 36);
      return `<button class="cs-scale-object ${i === selected ? "is-selected" : ""}" type="button" data-i="${i}" style="width:${sizePx}px;flex:0 0 ${sizePx}px" title="${esc(o.name)}">
        <span class="cs-scale-dot ${isStar ? "cs-is-star" : ""}" style="width:${Math.max(d, 12)}px;height:${Math.max(d, 12)}px;position:relative">
          <canvas class="cs-scale-canvas-sphere" width="${Math.max(d, 12) * 2}" height="${Math.max(d, 12) * 2}" style="width:100%;height:100%;display:block"></canvas>
        </span>
        <span class="cs-scale-name">${esc(o.name)}</span>
      </button>`;
    }).join("");

    // Paint realistic 3D spheres inside each item canvas
    row.querySelectorAll(".cs-scale-object").forEach((b, idx) => {
      const o = objects[idx];
      const cvs = b.querySelector(".cs-scale-canvas-sphere");
      if (cvs) {
        const c = cvs.getContext("2d");
        const sr = cvs.width / 2;
        const isStar = o.radiusKm >= 600000;
        drawRealisticCelestialSphere(c, sr, sr, sr * (isStar ? 0.65 : 0.95), o.name, 0, isStar);
      }
      b.addEventListener("click", () => {
        selected = Number(b.dataset.i);
        heroRot = 0;
        render();
      }, { signal: ac.signal });
    });

    drawHero();

    const o = objects[selected];
    const d = 2 * o.radiusKm;
    const rSun = o.radiusKm / 696340;
    const rEarth = o.radiusKm / 6371;

    detail.innerHTML = `
      <div class="cs-scale-detail-top">
        <div>
          <span class="cs-eyebrow">${esc(o.name)}</span>
          <div class="cs-scale-badge-row">
            <span class="cs-pill">${NUM1.format(rEarth)} R⊕</span>
            <span class="cs-pill">${NUM2.format(rSun)} R☉</span>
            <span class="cs-pill">${NUM2.format(diameterAu(o.radiusKm))} UA</span>
          </div>
        </div>
      </div>
      <div class="cs-scale-detail-line">
        Raggio <b>${km(o.radiusKm)}</b> · Diametro <b>${km(d)}</b>
      </div>
      ${o.note ? `<p class="cs-scale-note">${esc(o.note)}</p>` : ""}`;

    host.querySelector(".cs-scale-light-readout").hidden = !cfg.light || selected !== 0;
    if (cfg.light && selected === 0) {
      const t = (2 * Math.PI * o.radiusKm) / C_KMS;
      host.querySelector(".cs-scale-light-readout").textContent = `Un giro di luce: ${lightTime(t)} (calcolato sul raggio di ${km(o.radiusKm)})`;
    }
    renderTable();
  };

  tableToggle?.addEventListener("click", () => {
    showTable = !showTable;
    tableToggle.classList.toggle("is-active", showTable);
    if (tablePanel) tablePanel.hidden = !showTable;
  }, { signal: ac.signal });

  slider.addEventListener("input", () => { zoom = Number(slider.value); render(); }, { signal: ac.signal });

  host.querySelector("[data-scale-light]")?.addEventListener("click", () => {
    const o = objects[0];
    const t = (2 * Math.PI * o.radiusKm) / C_KMS;
    const readout = host.querySelector(".cs-scale-light-readout");
    const stage = host.querySelector(".cs-scale-stage");
    readout.hidden = false;
    readout.textContent = `Un giro di luce: ${lightTime(t)} · orbita fotonica in corso`;
    stage.classList.remove("cs-light-on");
    void stage.offsetWidth;
    stage.classList.add("cs-light-on");

    const dot = document.createElement("span");
    dot.className = "cs-light-dot";
    const target = row.querySelector(".cs-scale-object.is-selected .cs-scale-dot");
    if (target) {
      target.appendChild(dot);
      if (lightTimer) clearTimeout(lightTimer);
      lightTimer = setTimeout(() => {
        dot.remove();
        readout.textContent = `Un giro di luce: ${lightTime(t)} · completato`;
      }, 9000);
    }
  }, { signal: ac.signal });

  requestAnimationFrame(render);
  return {
    destroy() {
      ac.abort();
      if (lightTimer) clearTimeout(lightTimer);
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Gallery with Carousel Filmstrip and Lightbox                               */
/* -------------------------------------------------------------------------- */
export function mountGalleryStage(cfg, host) {
  const ac = new AbortController();
  let active = 0;
  host.innerHTML = `
    <div class="cs-gallery">
      <div class="cs-gallery-tabs"></div>
      <div class="cs-gallery-view">
        <div class="cs-gallery-frame">
          <img alt="" />
          <button class="cs-gallery-prev" type="button" aria-label="Precedente">‹</button>
          <button class="cs-gallery-next" type="button" aria-label="Successiva">›</button>
        </div>
        <div class="cs-gallery-info"></div>
      </div>
    </div>`;

  const tabs = host.querySelector(".cs-gallery-tabs");
  const img = host.querySelector("img");
  const info = host.querySelector(".cs-gallery-info");

  const render = () => {
    const item = cfg.items[active];
    tabs.innerHTML = cfg.items.map((it, i) => `
      <button class="cs-gallery-tab ${i === active ? "is-active" : ""}" type="button" data-i="${i}">
        <b>${String(i + 1).padStart(2, "0")}</b>
        <span>${esc(it.name)}</span>
      </button>`).join("");

    tabs.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      active = Number(b.dataset.i);
      render();
    }, { signal: ac.signal }));

    img.src = item.src;
    img.alt = item.name;
    info.innerHTML = `
      <div class="cs-gallery-info-top">
        <span class="cs-eyebrow">${esc(item.name)}</span>
        <span class="cs-badge">${esc(item.distance)}</span>
      </div>
      <p>${esc(item.note)}</p>
      <div class="cs-gallery-meta">
        <b>${esc(item.distance)}</b>
        <span>${esc(item.credit || "")}</span>
      </div>`;
  };

  host.querySelector(".cs-gallery-prev")?.addEventListener("click", () => {
    active = (active - 1 + cfg.items.length) % cfg.items.length;
    render();
  }, { signal: ac.signal });

  host.querySelector(".cs-gallery-next")?.addEventListener("click", () => {
    active = (active + 1) % cfg.items.length;
    render();
  }, { signal: ac.signal });

  render();
  return { destroy() { ac.abort(); } };
}

/* -------------------------------------------------------------------------- */
/* Distance / Light Photon Beam Simulation                                    */
/* -------------------------------------------------------------------------- */
export function mountDistanceStage(cfg, host) {
  const ac = new AbortController();

  if (cfg.mode === "light-year") {
    host.innerHTML = `
      <div class="cs-distance cs-lightyear">
        <div class="cs-distance-hero">
          <span class="cs-eyebrow">Distanza, non tempo</span>
          <strong>1 anno luce</strong>
          <div class="cs-big-number">9.4607 × 10¹² km</div>
          <p>La luce percorre questa distanza nel vuoto in 365,25 giorni. Il Sole dista 8 min 19 s luce; la Luna 1,28 s luce.</p>
        </div>
        <div class="cs-converter">
          <div class="cs-converter-row">
            <input id="cs-ly-input" type="number" min="0" step="any" value="1" aria-label="Valore da convertire" />
            <select id="cs-ly-unit" aria-label="Unità di partenza">
              <option value="ly">anni luce (al)</option>
              <option value="km">chilometri (km)</option>
              <option value="au">unità astronomiche (UA)</option>
              <option value="ls">secondi luce (ls)</option>
              <option value="lm">minuti luce (lm)</option>
              <option value="lh">ore luce (lh)</option>
            </select>
          </div>
          <div class="cs-convert-output" id="cs-convert-output"></div>
        </div>
        <div class="cs-light-demo">
          <div class="cs-light-track" id="cs-light-track">
            <span class="cs-light-source" title="Sole">☉</span>
            <span class="cs-light-beam"></span>
            <span class="cs-light-planet" title="Terra">⊕</span>
          </div>
          <div class="cs-light-actions">
            <button class="cs-button" id="cs-light-run">
              <span class="cs-play-ico">▶</span>
              <span>Lancia fotone</span>
            </button>
            <span class="mono" id="cs-light-time">Sole → Terra · 8 min 19 s</span>
          </div>
        </div>
      </div>`;

    const input = host.querySelector("#cs-ly-input");
    const unit = host.querySelector("#cs-ly-unit");
    const out = host.querySelector("#cs-convert-output");

    const convert = () => {
      const v = Number(input.value) || 0;
      const kmVal = unit.value === "ly" ? v * LY_KM : unit.value === "km" ? v : unit.value === "au" ? v * AU_KM : unit.value === "ls" ? v * C_KMS : unit.value === "lm" ? v * C_KMS * 60 : v * C_KMS * 3600;
      out.innerHTML = `
        <div class="cs-convert-card"><span>Chilometri</span><b class="mono">${NUM.format(kmVal)} km</b></div>
        <div class="cs-convert-card"><span>Unità astronomiche</span><b class="mono">${NUM1.format(kmVal / AU_KM)} UA</b></div>
        <div class="cs-convert-card"><span>Anni luce</span><b class="mono">${NUM1.format(kmVal / LY_KM)} al</b></div>
        <div class="cs-convert-card"><span>Tempo luce</span><b class="mono">${lightTime(kmVal / C_KMS)}</b></div>`;
    };

    input.addEventListener("input", convert, { signal: ac.signal });
    unit.addEventListener("change", convert, { signal: ac.signal });
    convert();

    host.querySelector("#cs-light-run")?.addEventListener("click", () => {
      const track = host.querySelector("#cs-light-track");
      if (!track) return;
      track.classList.remove("is-running");
      void track.offsetWidth;
      track.classList.add("is-running");
    }, { signal: ac.signal });
    return { destroy() { ac.abort(); } };
  }

  if (cfg.mode === "earth-moon") {
    host.innerHTML = `
      <div class="cs-distance cs-earth-moon">
        <div class="cs-em-head">
          <div>
            <span class="cs-eyebrow">Distanza Terra–Luna</span>
            <strong>384.400 km</strong>
            <p>In media, la Luna dista circa 30 diametri terrestri. Le dimensioni dei corpi sono in scala; la distanza è compressa nella modalità didattica.</p>
          </div>
          <div class="cs-toggle">
            <button class="is-active" data-mode="didactic" type="button">Scala didattica</button>
            <button data-mode="true" type="button">Scala reale</button>
          </div>
        </div>
        <div class="cs-em-scene" data-mode="didactic">
          <div class="cs-em-earth" title="Terra (diametro 12.742 km)"></div>
          <div class="cs-em-line"><span class="cs-em-moon" id="cs-em-moon" title="Luna (diametro 3.474 km)"></span></div>
          <div class="cs-em-labels"><span>Terra</span><span>Luna</span></div>
        </div>
        <div class="cs-em-controls">
          <label>Distanza orbitale <input id="cs-em-range" type="range" min="18" max="100" value="86" /></label>
          <button class="cs-button" id="cs-em-light">
            <span class="cs-pulse-ico">◉</span>
            <span>Impulso laser Terra–Luna</span>
          </button>
          <span class="mono" id="cs-em-readout">384.400 km · 1,28 s luce</span>
        </div>
        <div class="cs-em-note">In scala reale il diametro terrestre è 12.742 km: per coprire la distanza servono circa 30 sfere terrestri allineate.</div>
      </div>`;

    const scene = host.querySelector(".cs-em-scene");
    const earthEl = host.querySelector(".cs-em-earth");
    const moon = host.querySelector("#cs-em-moon");
    const range = host.querySelector("#cs-em-range");
    const readout = host.querySelector("#cs-em-readout");

    // Mount 3D spherical planetary canvases
    if (earthEl) {
      const eCvs = document.createElement("canvas");
      eCvs.width = 120;
      eCvs.height = 120;
      eCvs.className = "cs-em-sphere-canvas";
      earthEl.appendChild(eCvs);
      drawRealisticCelestialSphere("earth", eCvs);
    }
    if (moon) {
      const mCvs = document.createElement("canvas");
      mCvs.width = 64;
      mCvs.height = 64;
      mCvs.className = "cs-em-sphere-canvas";
      moon.appendChild(mCvs);
      drawRealisticCelestialSphere("moon", mCvs);
    }

    const setMode = m => {
      host.querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("is-active", b.dataset.mode === m));
      scene.dataset.mode = m;
    };

    host.querySelectorAll(".cs-toggle button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode), { signal: ac.signal }));

    const update = () => {
      const pct = Number(range.value);
      moon.style.left = `calc(${pct}% - 11px)`;
      readout.textContent = `384.400 km · 1,28 s luce`;
    };

    range.addEventListener("input", update, { signal: ac.signal });
    update();

    host.querySelector("#cs-em-light")?.addEventListener("click", () => {
      const dot = document.createElement("span");
      dot.className = "cs-em-pulse";
      scene.appendChild(dot);
      setTimeout(() => dot.remove(), 1700);
      readout.textContent = "Segnale luminoso: 1,28 s (andata)";
    }, { signal: ac.signal });

    return { destroy() { ac.abort(); } };
  }

  // AU (Sole -> Terra)
  host.innerHTML = `
    <div class="cs-distance cs-au">
      <div class="cs-distance-hero">
        <span class="cs-eyebrow">Unità astronomica fondamentale</span>
        <strong>1 UA</strong>
        <div class="cs-big-number">149.597.870,7 km</div>
        <p>La distanza media convenzionale Terra–Sole definita dall'IAU. La luce impiega esattamente 8 minuti e 19 secondi.</p>
      </div>
      <div class="cs-au-scene">
        <span class="cs-au-sun" title="Sole"></span>
        <div class="cs-au-line"><span class="cs-au-light"></span></div>
        <span class="cs-au-earth" title="Terra"></span>
        <div class="cs-au-label">1 UA = 149.597.870,7 km</div>
      </div>
      <div class="cs-au-actions">
        <button class="cs-button" id="cs-au-run">
          <span class="cs-play-ico">▶</span>
          <span>Lancia la luce</span>
        </button>
        <div class="cs-unit-toggle">
          <button class="is-active" data-unit="au" type="button">UA</button>
          <button data-unit="km" type="button">km</button>
        </div>
        <span class="mono" id="cs-au-readout">1 UA = 149.597.870,7 km · luce 8 min 19 s</span>
      </div>
      <div class="cs-em-note">Le dimensioni del Sole e della Terra non sono in scala rispetto alla distanza: a questa scala entrambi risulterebbero microscopici.</div>
    </div>`;

  const sunEl = host.querySelector(".cs-au-sun");
  const earthAuEl = host.querySelector(".cs-au-earth");
  if (sunEl) {
    const sCvs = document.createElement("canvas");
    sCvs.width = 120;
    sCvs.height = 120;
    sCvs.className = "cs-au-sphere-canvas";
    sunEl.appendChild(sCvs);
    drawRealisticCelestialSphere("sun", sCvs);
  }
  if (earthAuEl) {
    const eCvs = document.createElement("canvas");
    eCvs.width = 72;
    eCvs.height = 72;
    eCvs.className = "cs-au-sphere-canvas";
    earthAuEl.appendChild(eCvs);
    drawRealisticCelestialSphere("earth", eCvs);
  }

  host.querySelector("#cs-au-run")?.addEventListener("click", () => {
    const line = host.querySelector(".cs-au-line");
    line.classList.remove("is-running");
    void line.offsetWidth;
    line.classList.add("is-running");
    host.querySelector("#cs-au-readout").textContent = "Luce in viaggio: 8 min 19 s (animazione accelerata)";
  }, { signal: ac.signal });

  host.querySelectorAll(".cs-unit-toggle button").forEach(b => b.addEventListener("click", () => {
    host.querySelectorAll(".cs-unit-toggle button").forEach(x => x.classList.toggle("is-active", x === b));
    host.querySelector("#cs-au-readout").textContent = b.dataset.unit === "au" ? "1 UA = 149.597.870,7 km" : "149.597.870,7 km = 1 UA";
  }, { signal: ac.signal }));

  return { destroy() { ac.abort(); } };
}

/* -------------------------------------------------------------------------- */
/* Solar System Boundaries with Live Voyager Markers & 3D Deep Space View     */
/* -------------------------------------------------------------------------- */
export function mountBoundariesStage(cfg, host) {
  const ac = new AbortController();
  const bands = [
    { id: "planets", label: "Pianeti", from: 0.4, to: 50, color: "#7ec8e3", kind: "osservato", text: "I pianeti e i corpi principali del Sistema Solare, da Mercurio a Plutone e oltre." },
    { id: "kuiper", label: "Fascia di Kuiper", from: 30, to: 50, color: "#9bb9d6", kind: "osservato", text: "Una cintura di corpi ghiacciati e pianeti nani oltre Nettuno. Gli oggetti sono osservati." },
    { id: "helio", label: "Eliopausa", from: 80, to: 120, color: "#eab76a", kind: "misurato", text: "Dove il vento solare incontra il mezzo interstellare. Voyager 1 l'ha attraversata nel 2012 a circa 121 UA; Voyager 2 nel 2018." },
    { id: "oort", label: "Nube di Oort", from: 20000, to: 100000, color: "#b58ad8", kind: "modello", text: "La riserva sferica ipotizzata delle comete di lungo periodo. Non è stata osservata direttamente: è un modello matematico." },
  ];

  const x = auVal => 196 + (Math.log10(auVal) - Math.log10(0.4)) / (Math.log10(100000) - Math.log10(0.4)) * 548;

  const svg = `<svg class="cs-bound-svg" viewBox="0 0 800 320" role="img" aria-label="Scala logaritmica dei confini del Sistema Solare">
    <defs>
      <linearGradient id="cs-bgrad" x1="0" x2="1">
        <stop offset="0" stop-color="#070d16"/>
        <stop offset="1" stop-color="#121b2d"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="800" height="320" fill="url(#cs-bgrad)"/>
    <text x="16" y="28" fill="#a2adbc" font-size="10" font-family="'IBM Plex Mono', monospace" letter-spacing="1.4">CONFINI · SCALA LOGARITMICA</text>
    <text x="16" y="44" fill="#5f6c7c" font-size="8.5">Distanza dal Sole in Unità Astronomiche (UA)</text>
    
    ${[1, 10, 100, 1000, 10000, 100000].map(v => `
      <g class="cs-axis-tick">
        <line x1="${x(v)}" y1="52" x2="${x(v)}" y2="252" stroke="rgba(255,255,255,0.08)"/>
        <text x="${x(v)}" y="268" text-anchor="middle" fill="#8c99aa" font-size="9" font-family="'IBM Plex Mono', monospace">${v >= 1000 ? v / 1000 + "k" : v}</text>
        <text x="${x(v)}" y="282" text-anchor="middle" class="cs-axis-sub" fill="#5f6c7c" font-size="7.5">UA</text>
      </g>`).join("")}

    ${bands.map((b, i) => {
      const bx = x(b.from), bw = Math.max(4, x(b.to) - x(b.from)), by = 64 + i * 42;
      return `<g class="cs-bound-band" data-band="${b.id}">
        <text x="16" y="${by + 11}" fill="${b.color}" font-size="10" font-weight="600">${b.label}</text>
        <text x="16" y="${by + 23}" fill="#667585" font-size="7.5" font-family="'IBM Plex Mono', monospace">${b.kind}</text>
        <line x1="188" y1="${by + 10}" x2="${bx - 6}" y2="${by + 10}" stroke="${b.color}" stroke-opacity=".25" stroke-dasharray="2 3"/>
        <rect x="${bx}" y="${by}" width="${bw}" height="20" rx="3" fill="${b.color}" opacity=".25"/>
        <rect x="${bx}" y="${by}" width="${bw}" height="3" fill="${b.color}"/>
        <text x="${bx + 4}" y="${by + 14}" fill="${b.color}" font-size="8.5" font-family="'IBM Plex Mono', monospace">${b.from >= 1000 ? (b.from / 1000) + "k–" + (b.to / 1000) + "k" : b.from + "–" + b.to} UA</text>
      </g>`;
    }).join("")}

    <!-- Voyager 1 current position marker (~163 AU) -->
    <g class="cs-voyager-marker" transform="translate(${x(163)}, 232)">
      <line x1="0" y1="-180" x2="0" y2="18" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="3 3"/>
      <polygon points="0,-6 -4,2 4,2" fill="#38bdf8"/>
      <text x="4" y="-8" fill="#38bdf8" font-size="8" font-family="'IBM Plex Mono', monospace">Voyager 1 (~163 UA)</text>
    </g>

    <line x1="196" y1="252" x2="744" y2="252" stroke="#586678" stroke-width="1.2"/>
  </svg>`;

  host.innerHTML = `
    <div class="cs-boundaries">
      <div class="cs-bound-canvas-wrap">
        <canvas class="cs-bound-canvas" width="800" height="260" aria-label="Visualizzazione 3D realistica dei confini del Sistema Solare"></canvas>
      </div>
      ${svg}
      <div class="cs-bound-controls">
        ${bands.map(b => `<button class="cs-bound-toggle is-on" data-bound="${b.id}" type="button"><span style="background:${b.color}"></span>${b.label}</button>`).join("")}
      </div>
      <div class="cs-bound-detail" aria-live="polite">
        ${bands.map(b => `<p data-detail="${b.id}"><b>${b.label}</b> · <span class="cs-badge">${b.kind}</span> — ${b.text}</p>`).join("")}
      </div>
      <p class="cs-em-note">Ogni intervallo della scala logaritmica moltiplica per dieci la distanza. La nube di Oort è un modello teorico per spiegare le comete, non un oggetto fotografato. L'eliopausa è una regione fluida di transizione, non un confine solido.</p>
    </div>`;

  const canvas = host.querySelector(".cs-bound-canvas");
  const ctx = canvas?.getContext("2d");
  const activeBands = { planets: true, kuiper: true, helio: true, oort: true };
  let animId = null;

  // Starfield background
  const stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * 800,
    y: Math.random() * 260,
    r: Math.random() * 1.2 + 0.4,
    a: Math.random() * 0.7 + 0.3,
  }));

  // Kuiper particles
  const kuiperDust = Array.from({ length: 140 }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: 110 + Math.random() * 32,
    speed: 0.0003 + Math.random() * 0.0005,
    size: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.6 + 0.2,
  }));

  let time = 0;
  const render3DView = () => {
    if (!ctx) return;
    time += 0.016;
    const w = 800, h = 260;
    const cx = 130, cy = 130;

    ctx.fillStyle = "#040810";
    ctx.fillRect(0, 0, w, h);

    // Deep space stars
    for (const s of stars) {
      ctx.fillStyle = `rgba(220, 235, 255, ${s.a * (0.8 + 0.2 * Math.sin(time * 2 + s.x))})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Oort Cloud volumetric spherical shell
    if (activeBands.oort) {
      const gradOort = ctx.createRadialGradient(cx, cy, 180, cx, cy, 380);
      gradOort.addColorStop(0, "rgba(181, 138, 216, 0.0)");
      gradOort.addColorStop(0.5, "rgba(181, 138, 216, 0.06)");
      gradOort.addColorStop(1, "rgba(181, 138, 216, 0.0)");
      ctx.fillStyle = gradOort;
      ctx.beginPath();
      ctx.arc(cx, cy, 380, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(181, 138, 216, 0.2)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, 240, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#b58ad8";
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillText("Nube di Oort (20.000–100.000 UA)", 390, 32);
    }

    // Heliopause magnetic bubble (solar wind vs interstellar medium)
    if (activeBands.helio) {
      const helioR = 175 + Math.sin(time * 1.5) * 2;
      const gradHelio = ctx.createRadialGradient(cx, cy, helioR - 25, cx, cy, helioR + 15);
      gradHelio.addColorStop(0, "rgba(234, 183, 106, 0.0)");
      gradHelio.addColorStop(0.7, "rgba(234, 183, 106, 0.18)");
      gradHelio.addColorStop(0.9, "rgba(56, 189, 248, 0.22)");
      gradHelio.addColorStop(1, "rgba(56, 189, 248, 0.0)");
      ctx.fillStyle = gradHelio;
      ctx.beginPath();
      ctx.ellipse(cx + 10, cy, helioR + 25, helioR, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(234, 183, 106, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx + 10, cy, helioR + 15, helioR, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#eab76a";
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillText("Eliopausa (~120 UA)", 270, 78);
    }

    // Kuiper Belt icy particles
    if (activeBands.kuiper) {
      for (const k of kuiperDust) {
        k.angle += k.speed;
        const kx = cx + Math.cos(k.angle) * k.dist * 1.15;
        const ky = cy + Math.sin(k.angle) * (k.dist * 0.45);
        ctx.fillStyle = `rgba(155, 185, 214, ${k.alpha})`;
        ctx.beginPath();
        ctx.arc(kx, ky, k.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#9bb9d6";
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillText("Fascia di Kuiper (30–50 UA)", 225, 114);
    }

    // Planets orbits and 3D planetary spheres
    if (activeBands.planets) {
      const planets = [
        { name: "Mercurio", r: 16, c: "#a89f91", sz: 2, sp: 0.8 },
        { name: "Venere", r: 24, c: "#d8be92", sz: 3, sp: 0.6 },
        { name: "Terra", r: 35, c: "#4895ef", sz: 3.2, sp: 0.45 },
        { name: "Marte", r: 47, c: "#d65d3d", sz: 2.6, sp: 0.35 },
        { name: "Giove", r: 68, c: "#d4a373", sz: 6, sp: 0.2 },
        { name: "Saturno", r: 88, c: "#e9c46a", sz: 5, sp: 0.15 },
        { name: "Urano", r: 104, c: "#72efdd", sz: 4, sp: 0.1 },
        { name: "Nettuno", r: 118, c: "#4361ee", sz: 4, sp: 0.08 },
      ];

      for (const p of planets) {
        // Orbit ring
        ctx.strokeStyle = "rgba(126, 200, 227, 0.15)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(cx, cy, p.r * 1.15, p.r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Planet body
        const ang = time * p.sp + p.r;
        const px = cx + Math.cos(ang) * (p.r * 1.15);
        const py = cy + Math.sin(ang) * (p.r * 0.45);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(px, py, p.sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Voyager 1 Live Position & Radio Pulse Beacon at ~163 UA
    const voyX = cx + 205;
    const voyY = cy - 35;
    const pulseR = ((time * 30) % 60);
    ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0, 1 - pulseR / 60)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(voyX, voyY, pulseR, 0, Math.PI * 2);
    ctx.stroke();

    // Voyager beacon point
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(voyX, voyY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Antenna vector line
    ctx.strokeStyle = "#38bdf8";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(voyX, voyY);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 10px 'IBM Plex Mono', monospace";
    ctx.fillText("Voyager 1 · ~163 UA (22,6 ore luce)", voyX + 8, voyY - 4);

    // Sun in the center
    const sunGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18);
    sunGrad.addColorStop(0, "#ffffff");
    sunGrad.addColorStop(0.3, "#fef08a");
    sunGrad.addColorStop(0.7, "#f59e0b");
    sunGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();

    animId = requestAnimationFrame(render3DView);
  };

  render3DView();

  host.querySelectorAll(".cs-bound-toggle").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.bound;
    btn.classList.toggle("is-on");
    const isOn = btn.classList.contains("is-on");
    activeBands[id] = isOn;
    const g = host.querySelector(`[data-band="${id}"]`);
    if (g) g.style.opacity = isOn ? "1" : "0.12";
  }, { signal: ac.signal }));

  return {
    destroy() {
      ac.abort();
      if (animId) cancelAnimationFrame(animId);
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Timeline: Apollo 11 Mission & Cosmic Calendar with 1-Meter Ruler           */
/* -------------------------------------------------------------------------- */
export function mountTimelineStage(cfg, host) {
  const ac = new AbortController();

  if (cfg.mode === "apollo") {
    let active = 0, timer = null;
    host.innerHTML = `
      <div class="cs-apollo">
        <div class="cs-apollo-hero">
          <img src="${esc(cfg.hero)}" alt="La Luna fotografata da Apollo 11" />
          <div>
            <span class="cs-eyebrow">Apollo 11 · 16–24 luglio 1969</span>
            <h4>La rotta verso la Tranquillità</h4>
            <p>Dalla rampa di lancio di Cape Canaveral all'allunaggio e al rientro nell'Oceano Pacifico.</p>
          </div>
        </div>
        <div class="cs-apollo-track"></div>
        <div class="cs-apollo-detail"></div>
        <div class="cs-apollo-actions">
          <button class="cs-button" id="cs-apollo-play" type="button">
            <span class="cs-play-ico">▶</span>
            <span class="cs-apollo-btn-text">Riproduci la missione</span>
          </button>
        </div>
      </div>`;

    const track = host.querySelector(".cs-apollo-track");
    const detail = host.querySelector(".cs-apollo-detail");
    const playBtnText = host.querySelector(".cs-apollo-btn-text");

    const render = () => {
      track.innerHTML = cfg.events.map((e, i) => `
        <button class="cs-apollo-event ${i === active ? "is-active" : ""}" data-i="${i}" type="button">
          <span class="cs-apollo-dot"></span>
          <span class="cs-apollo-date">${esc(e.date)}</span>
          <span class="cs-apollo-title">${esc(e.title)}</span>
        </button>`).join("");

      track.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
        active = Number(b.dataset.i);
        render();
      }, { signal: ac.signal }));

      const e = cfg.events[active];
      detail.innerHTML = `
        <span class="cs-eyebrow">${esc(e.date)}</span>
        <h4>${esc(e.title)}</h4>
        <p>${esc(e.text)}</p>`;
    };

    render();

    host.querySelector("#cs-apollo-play")?.addEventListener("click", () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
        if (playBtnText) playBtnText.textContent = "Riproduci la missione";
        return;
      }
      if (playBtnText) playBtnText.textContent = "Pausa missione";
      timer = setInterval(() => {
        active = (active + 1) % cfg.events.length;
        render();
      }, 1800);
    }, { signal: ac.signal });

    return {
      destroy() {
        ac.abort();
        if (timer) clearInterval(timer);
      }
    };
  }

  // Cosmic calendar (13.8 billion years -> 1 calendar year)
  let span = 13.8e9;
  let preset = "full";
  let calendar = false;
  const totalAge = 13.8e9;
  const events = cfg.events.map(e => ({ ...e, ago: -e.t * (e.unit === "Gyr" ? 1e9 : 1) }));

  const presets = [
    { id: "full", label: "13,8 miliardi di anni", span: 13.8e9 },
    { id: "gyr", label: "Ultimo miliardo di anni", span: 1e9 },
    { id: "myr", label: "Ultimo milione di anni", span: 1e6 },
    { id: "sapiens", label: "Ultimi 300.000 anni", span: 300000 },
  ];

  host.innerHTML = `
    <div class="cs-cosmic">
      <div class="cs-cosmic-head">
        <div>
          <span class="cs-eyebrow">Tempo cosmico</span>
          <h4>13,8 miliardi di anni</h4>
          <p>La linea del tempo dell'Universo: cambia scala per comprendere la vertigine temporale dell'umanità.</p>
        </div>
        <button class="cs-button cs-calendar-btn" id="cs-calendar-toggle" type="button">Calendario cosmico</button>
      </div>
      <div class="cs-cosmic-presets"></div>
      <div class="cs-cosmic-track-wrap">
        <div class="cs-cosmic-track" id="cs-cosmic-track"></div>
        <div class="cs-cosmic-labels" id="cs-cosmic-labels"></div>
      </div>
      <div class="cs-cosmic-detail" id="cs-cosmic-detail"></div>
      <div class="cs-cosmic-verify" id="cs-cosmic-verify"></div>
      <p class="cs-em-note">Il calendario cosmico comprime 13,8 miliardi di anni in un anno convenzionale: il Big Bang scocca il 1° gennaio a mezzanotte; l'intera storia di Homo sapiens (300.000 anni) inizia circa alle 23:48:38 del 31 dicembre (ultimi 11,4 minuti). L'analogia didattica del «millimetro» nella presentazione è approssimata: 300.000 anni corrispondono a 0,022 mm su un righello lungo 1 m, non a 1/100 di millimetro.</p>
    </div>`;

  const presetsEl = host.querySelector(".cs-cosmic-presets");
  const track = host.querySelector("#cs-cosmic-track");
  const labels = host.querySelector("#cs-cosmic-labels");
  const detail = host.querySelector("#cs-cosmic-detail");
  const verify = host.querySelector("#cs-cosmic-verify");
  let activeEvent = 0;

  const render = () => {
    presetsEl.innerHTML = presets.map(p => `
      <button class="cs-cosmic-preset ${p.id === preset ? "is-active" : ""}" data-p="${p.id}" type="button">
        ${p.label}
      </button>`).join("");

    presetsEl.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      preset = b.dataset.p;
      span = presets.find(p => p.id === preset).span;
      activeEvent = 0;
      render();
    }, { signal: ac.signal }));

    const visible = events.map((e, i) => ({ e, i })).filter(x => x.e.ago <= span * 1.00001);

    track.innerHTML = `<div class="cs-cosmic-axis"></div>${visible.map(({ e, i }) => {
      const p = Math.min(100, Math.max(0, (1 - e.ago / span) * 100));
      return `<button class="cs-cosmic-marker ${i === activeEvent ? "is-active" : ""} ${p > 84 ? "is-edge" : ""}" style="left:${p}%" data-e="${i}" type="button" title="${esc(e.title)}">
        <span></span>
        ${i === activeEvent ? `<em>${esc(e.title)}</em>` : ""}
      </button>`;
    }).join("")}`;

    track.querySelectorAll(".cs-cosmic-marker").forEach(b => b.addEventListener("click", () => {
      activeEvent = Number(b.dataset.e);
      render();
    }, { signal: ac.signal }));

    const startLabel = preset === "full" ? "13,8 miliardi di anni fa" : preset === "gyr" ? "1 miliardo di anni fa" : preset === "myr" ? "1 milione di anni fa" : "300.000 anni fa";
    labels.innerHTML = `<span>${startLabel}</span><span class="mono">Oggi (0)</span>`;

    const e = events[activeEvent];
    if (e) {
      const frac = 1 - e.ago / totalAge;
      const d = new Date(Date.UTC(2025, 0, 1) + frac * 365.25 * 86400000);
      detail.innerHTML = `
        <span class="cs-eyebrow">${calendar ? "Data nel Calendario Cosmico" : "Tappa temporale"}</span>
        <h4>${esc(e.title)}</h4>
        <p>${esc(e.text)}</p>
        <div class="cs-cosmic-meta">
          <b class="mono">${NUM1.format(e.ago / 1e9)} miliardi di anni fa</b>
          ${calendar ? `<span>≈ ${d.toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" })}${e.ago < 1e6 ? " · 23:" + String(Math.floor((d.getUTCHours() * 60 + d.getUTCMinutes()) / 60)).padStart(2, "0") : ""}</span>` : ""}
        </div>`;
    }

    const mm = (300000 / totalAge) * 1000;
    verify.innerHTML = `
      <strong>Verifica e rigore scientifico</strong>
      <div>1 anno cosmico = 13,8 Gyr · 1 mese cosmico ≈ 1,15 Gyr · 1 giorno cosmico ≈ 37,8 Myr · 1 secondo cosmico ≈ 438 anni.</div>
      <div>Ultimi 300.000 anni di Homo sapiens = <b>${(300000 / totalAge * 365.25 * 24 * 60).toFixed(1)} minuti</b> di un anno cosmico = <b>${mm.toFixed(3)} mm</b> su un righello lungo 1 metro.</div>`;
  };

  host.querySelector("#cs-calendar-toggle")?.addEventListener("click", () => {
    calendar = !calendar;
    host.querySelector("#cs-calendar-toggle").classList.toggle("is-active", calendar);
    render();
  }, { signal: ac.signal });

  render();
  return { destroy() { ac.abort(); } };
}
