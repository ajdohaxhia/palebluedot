import * as THREE from 'three';
import { OrbitRig, TouchEnhancer } from '../engine/camera.js';
import { createLine } from '../engine/lines.js';
import { LabelLayer } from '../engine/labels.js';
import { SkyDome, galacticSkyRotation } from '../engine/sky.js';
import { makeGalaxyTexture, makeGlowTexture, makeSelectionTexture, makeBeaconTexture } from '../engine/procedural.js';
import {
  GALAXIES, CLUSTERS, NEBULAE, CURATED_STARS, MILKY_WAY, FEATURED_STAR_NAMES,
  OBSERVABLE_UNIVERSE_RADIUS_MPC,
} from '../data/featured.js';
import { SUN_SCENE_MPC, raDecParsecsToWorld, raDecKpcToWorld } from '../astronomy/coordinates.js';
import { MPC, KPC, LIGHT_YEAR } from '../astronomy/units.js';
import { comovingDistanceMpc, lookbackGyr, MPC_PER_MLY } from '../astronomy/cosmology.js';

const DEG = Math.PI / 180;
const LY_PER_MPC = 3.261563777e6;
const KPC_TO_MPC = 1e-3;

const starVertex = /* glsl */`
  uniform float uPixelRatio;
  uniform float uPointScale;
  uniform float uOpacity;
  attribute vec3 color;
  attribute float aAbsMag;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float distPc = length(mv.xyz) * 1e6;
    float m = aAbsMag + 5.0 * (log(max(distPc, 1e-8)) / log(10.0) - 1.0);
    float flux = pow(10.0, -0.4 * (m - 3.0));
    float size = clamp(1.0 + 3.4 * pow(flux, 0.22), 1.0, 6.8);
    gl_PointSize = size * uPixelRatio * uPointScale;
    float vis = smoothstep(13.0, 8.0, m);
    vAlpha = clamp(0.10 + pow(flux, 0.27), 0.0, 0.92) * uOpacity * vis;
    float lum = dot(color, vec3(0.28, 0.59, 0.13));
    vColor = mix(vec3(lum), color, 0.64);
    gl_Position = projectionMatrix * mv;
  }
`;

const starFragment = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float core = smoothstep(0.68, 0.05, r);
    float halo = pow(max(0.0, 1.0 - r), 2.8);
    vec3 col = pow(vColor, vec3(1.05));
    float a = (core * 0.82 + halo * 0.22) * vAlpha;
    gl_FragColor = vec4(col * a, a);
  }
`;

const galaxyPointVertex = /* glsl */`
  uniform float uPixelRatio;
  uniform float uOpacity;
  attribute vec3 color;
  attribute float aSize;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_PointSize = (0.8 + aSize * 1.15) * uPixelRatio;
    vColor = color;
    vAlpha = (0.16 + aSize * 0.34) * uOpacity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const galaxyPointFragment = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = smoothstep(1.0, 0.05, r) * vAlpha;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

const surveyVertex = /* glsl */`
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uOpacity;
  attribute vec3 color;
  attribute float aBright;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    gl_PointSize = uSize * uPixelRatio * (0.65 + aBright * 0.9);
    vColor = color;
    vAlpha = uOpacity * (0.4 + aBright * 0.6);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const surveyFragment = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = pow(max(0.0, 1.0 - r), 1.4) * vAlpha;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

const horizonVertex = /* glsl */`
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const horizonFragment = /* glsl */`
  uniform float uOpacity;
  varying vec3 vPos;

  // Hash function for procedural spherical harmonic noise
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // 3D smooth value noise for cosmic fluctuation multipoles
  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 w = fract(x);
    vec3 u = w * w * (3.0 - 2.0 * w);
    float n000 = hash(p + vec3(0.0, 0.0, 0.0));
    float n100 = hash(p + vec3(1.0, 0.0, 0.0));
    float n010 = hash(p + vec3(0.0, 1.0, 0.0));
    float n110 = hash(p + vec3(1.0, 1.0, 0.0));
    float n001 = hash(p + vec3(0.0, 0.0, 1.0));
    float n101 = hash(p + vec3(1.0, 0.0, 1.0));
    float n011 = hash(p + vec3(0.0, 1.0, 1.0));
    float n111 = hash(p + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
      mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
      u.z
    );
  }

  // Planck CMB Acoustic Anisotropy spectrum: sum of spherical harmonic octaves
  float cmbPattern(vec3 p) {
    vec3 d = normalize(p);
    float v = 0.0;
    v += noise(d * 14.0) * 0.44;
    v += noise(d * 28.0) * 0.28;
    v += noise(d * 56.0) * 0.16;
    v += noise(d * 112.0) * 0.08;
    v += noise(d * 220.0) * 0.04;
    return v;
  }

  // Authentic ESA Planck satellite colormap:
  // Cold (-300 uK) = deep blue / navy
  // Medium-cold (-100 uK) = cyan / sky blue
  // Neutral (0 uK) = pale green / white-gold
  // Medium-warm (+100 uK) = amber / orange
  // Hot (+300 uK) = deep red / crimson
  vec3 planckPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.02, 0.08, 0.42);  // deep blue
    vec3 c1 = vec3(0.12, 0.52, 0.88);  // cyan-blue
    vec3 c2 = vec3(0.92, 0.95, 0.98);  // neutral white
    vec3 c3 = vec3(0.95, 0.62, 0.12);  // amber orange
    vec3 c4 = vec3(0.78, 0.12, 0.08);  // deep crimson
    if (t < 0.25) return mix(c0, c1, t / 0.25);
    if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
    return mix(c3, c4, (t - 0.75) / 0.25);
  }

  void main() {
    vec3 d = normalize(vPos);
    float cmb = cmbPattern(d);
    vec3 col = planckPalette(cmb);

    // Subtle celestial coordinate grid on the cosmic horizon
    float lat = asin(clamp(d.y, -1.0, 1.0));
    float lon = atan(d.z, d.x);
    float bands = smoothstep(0.92, 1.0, abs(sin(lat * 18.0)));
    float meridians = smoothstep(0.92, 1.0, abs(sin(lon * 9.0)));
    float grid = max(bands * 0.4, meridians * 0.3) * smoothstep(0.0, 0.2, abs(d.y));

    col = mix(col, vec3(1.0, 0.9, 0.6), grid * 0.6);

    float alpha = (0.28 + grid * 0.22) * uOpacity;
    gl_FragColor = vec4(col * alpha * 1.5, alpha);
  }
`;

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function vec3Color(hex) {
  const c = new THREE.Color(hex);
  return [srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b)];
}

function mixColor(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Generate galaxy particles in local disk coordinates (Mpc relative to centre). */
function generateGalaxyParticles(g, count) {
  const rand = mulberry32((g.id || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + (g.seed || 1));
  const half = Math.max(0.000001, (g.diameterKpc * KPC_TO_MPC) / 2);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const type = g.model?.type || (g.type?.toLowerCase().includes('elliptical') ? 'elliptical' : 'spiral');
  const pitch = (g.model?.pitch || 16) * DEG;
  const arms = g.model?.arms || 2;
  const inc = Math.min(88, Math.max(0, g.inclinationDeg || 20)) * DEG;
  const pa = (g.positionAngleDeg || 0) * DEG;
  const ci = Math.cos(inc), si = Math.sin(inc);
  const cp = Math.cos(pa), sp = Math.sin(pa);
  const b = g.redShift;
  const blue = [0.85, 0.92, 1.0];
  const white = [1.0, 0.95, 0.82];
  const warm = [1.0, 0.76, 0.45];
  const pink = [1.0, 0.34, 0.42];
  const rose = [1.0, 0.55, 0.47];

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;
    let c = white;
    let bright = 0.55;
    if (type === 'elliptical' || type === 'lenticular') {
      const r = Math.pow(rand(), 0.62);
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const sq = Math.sqrt(1 - u * u);
      x = r * sq * Math.cos(phi);
      y = r * sq * Math.sin(phi) * (type === 'lenticular' ? 0.28 : 0.72);
      z = r * u;
      c = mixColor(warm, white, rand() * 0.5);
      bright = 0.55 + rand() * 0.2;
    } else if (type === 'irregular' || type === 'interacting') {
      const clump = Math.floor(rand() * (type === 'interacting' ? 2 : 5));
      const cx = type === 'interacting' ? (clump === 0 ? -0.34 : 0.34) : (rand() - 0.5) * 0.4;
      const cy = (rand() - 0.5) * 0.1;
      const cz = type === 'interacting' ? (clump === 0 ? -0.28 : 0.3) : (rand() - 0.5) * 0.25;
      const spread = type === 'interacting' ? 0.16 : 0.22;
      const r = Math.pow(rand(), 1.8) * 0.32;
      const a = rand() * Math.PI * 2;
      x = cx + Math.cos(a) * r;
      y = cy + (rand() - 0.5) * spread;
      z = cz + Math.sin(a) * r * 0.75;
      if (type === 'interacting' && rand() < 0.18) {
        x = (rand() - 0.5) * 1.5;
        z = (rand() - 0.5) * 0.35;
        y = (rand() - 0.5) * 0.1;
      }
      c = rand() < 0.25 ? pink : mixColor(blue, white, rand() * 0.6);
      bright = 0.4 + rand() * 0.5;
    } else {
      // spiral / barred spiral / ring
      const isBar = !!g.model?.bar || g.model?.type === 'barred';
      if (isBar && rand() < 0.14) {
        const t = (rand() * 2 - 1) * 0.42;
        x = t;
        z = (rand() - 0.5) * 0.055;
        y = (rand() - 0.5) * 0.028;
        c = mixColor(warm, white, rand() * 0.4);
        bright = 0.7;
      } else if (g.model?.type === 'ring') {
        const a = rand() * Math.PI * 2;
        const rr = 0.47 + (rand() - 0.5) * 0.16;
        x = Math.cos(a) * rr;
        z = Math.sin(a) * rr;
        y = (rand() - 0.5) * 0.03;
        c = rand() < 0.3 ? pink : mixColor(blue, white, rand());
        bright = 0.6;
      } else {
        const t = Math.pow(rand(), 0.62);
        const r = 0.04 + t * 0.96;
        const arm = Math.floor(rand() * arms);
        const armTheta = (arm / arms) * Math.PI * 2 + Math.log(r / 0.055) / Math.tan(pitch);
        const spread = (rand() - 0.5) * (0.2 + t * 0.75);
        const theta = armTheta + spread;
        const rr = r * (0.93 + (rand() - 0.5) * 0.12);
        x = Math.cos(theta) * rr;
        z = Math.sin(theta) * rr;
        const thickness = 0.016 + t * 0.035;
        y = (rand() - 0.5) * thickness;
        // central bulge contribution
        if (rand() < 0.13) {
          const br = Math.pow(rand(), 1.7) * 0.2;
          const ba = rand() * Math.PI * 2;
          x = Math.cos(ba) * br;
          z = Math.sin(ba) * br;
          y = (rand() - 0.5) * br * 0.7;
          c = warm;
          bright = 0.8;
        } else if (rand() < 0.045) {
          c = pink;
          bright = 0.95;
        } else {
          c = mixColor(warm, blue, Math.min(1, 0.3 + t * 0.9));
          if (rand() < 0.15) c = white;
          bright = 0.35 + rand() * 0.45;
        }
      }
    }
    // Scale into the galaxy's physical radius; apply disk inclination then PA.
    let px = x * half, py = y * half, pz = z * half;
    // Inclination around X, then position angle around Y.
    const iy = py * ci - pz * si;
    const iz = py * si + pz * ci;
    py = iy; pz = iz;
    const rx = px * cp - pz * sp;
    const rz = px * sp + pz * cp;
    px = rx; pz = rz;
    positions[i * 3] = px + g.world.x;
    positions[i * 3 + 1] = py + g.world.y;
    positions[i * 3 + 2] = pz + g.world.z;
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    sizes[i] = Math.min(1, Math.max(0.08, bright * (0.5 + rand())));
  }
  return { positions, colors, sizes, count };
}

/** Generate the schematic Milky Way particle model. */
function generateMilkyWay(count = 185000) {
  const rand = mulberry32(20261106);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const arms = 4;
  const armOffsets = [0.02, Math.PI * 0.52, Math.PI * 0.98, Math.PI * 1.52];
  const pitch = 0.235;
  const blue = [0.68, 0.82, 1.0];
  const white = [1.0, 0.94, 0.8];
  const warm = [1.0, 0.74, 0.4];
  const pink = [1.0, 0.4, 0.46];
  const N_BULGE = Math.floor(count * 0.19);
  const N_DISK = Math.floor(count * 0.72);
  const N_HALO = count - N_BULGE - N_DISK;

  for (let i = 0; i < count; i++) {
    let x = 0, z = 0, y = 0;
    let color = white;
    let size = 0.6;
    if (i < N_BULGE) {
      const r = Math.pow(rand(), 0.55) * 3.6; // kpc
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(rand() * 2 - 1);
      x = r * Math.sin(ph) * Math.cos(th);
      z = r * Math.sin(ph) * Math.sin(th);
      y = r * Math.cos(ph) * 0.55;
      color = mixColor(warm, white, rand() * 0.6);
      size = 0.75 + rand() * 0.4;
    } else if (i < N_BULGE + N_DISK) {
      const t = Math.pow(rand(), 0.56);
      const r = 1.5 + t * 14.0;
      const arm = Math.floor(rand() * arms);
      const spiral = Math.log(r / 1.8) / Math.tan(pitch);
      let theta = armOffsets[arm] + spiral + (rand() - 0.5) * (0.24 + t * 0.5);
      if (rand() < 0.2) theta = rand() * Math.PI * 2; // smooth inter-arm disk
      const rr = r * (0.94 + (rand() - 0.5) * 0.1);
      x = Math.cos(theta) * rr;
      z = Math.sin(theta) * rr;
      const thickness = 0.09 + t * 0.16;
      y = (rand() - 0.5) * thickness;
      if (rand() < 0.035) {
        color = pink;
        size = 1.2;
      } else {
        color = mixColor(warm, blue, Math.min(1, 0.25 + t));
        if (rand() < 0.13) color = white;
        size = 0.3 + rand() * 0.55;
      }
    } else {
      const r = 6 + Math.pow(rand(), 0.5) * 18;
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(rand() * 2 - 1);
      x = r * Math.sin(ph) * Math.cos(th);
      z = r * Math.sin(ph) * Math.sin(th);
      y = r * Math.cos(ph) * 0.7;
      color = mixColor(warm, white, rand() * 0.5);
      size = 0.4;
    }
    positions[i * 3] = x * KPC_TO_MPC;
    positions[i * 3 + 1] = y * KPC_TO_MPC;
    positions[i * 3 + 2] = z * KPC_TO_MPC;
    colors[i * 3] = color[0]; colors[i * 3 + 1] = color[1]; colors[i * 3 + 2] = color[2];
    sizes[i] = size;
  }
  return { positions, colors, sizes, count };
}

export class DeepScene {
  constructor({
    assets, catalogs, canvas, labelsContainer, onSelect, onFocusChange, onScaleLevel, getSettings,
  }) {
    this.assets = assets;
    this.catalogs = catalogs;
    this.canvas = canvas;
    this.labelsContainer = labelsContainer;
    this.onSelect = onSelect || (() => {});
    this.onFocusChange = onFocusChange || (() => {});
    this.onScaleLevel = onScaleLevel || (() => {});
    this.getSettings = getSettings || (() => ({}));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.camera = new THREE.PerspectiveCamera(50, 1, 1e-10, 40000);
    this.rig = new OrbitRig(this.camera, {
      distance: 1e-5,
      minDistance: 2e-10,
      maxDistance: 30000,
      yaw: 0.62,
      pitch: 0.2,
      damping: 7,
      zoomDamping: 8,
      near: 1e-10,
      far: 40000,
      domElement: canvas,
      onPick: p => this.pick(p),
      onHover: p => { this.canvas.style.cursor = 'grab'; },
    });
    this.rig.onDoubleClick = p => this.doubleClick(p);
    this.touch = new TouchEnhancer(this.rig, canvas);
    this.labels = new LabelLayer(labelsContainer, { className: 'labels-deep' });
    this.selectedId = null;
    this.selectedData = null;
    this.focusLevel = 'stars';
    this.layerVisibility = {
      stars: true, exoplanets: true, milkyway: true, localgroup: true,
      sdss: true, quasars: true, clusters: true, horizon: true,
    };
    this.time = 0;
    this.gridVisible = false;
    this.ready = false;
    this._labels = [];
    this._galaxySprites = [];
    this._clusterSprites = [];
    this._galaxyCentres = [];
    this._starFade = 1;
    this._galaxyFade = 0;
    this._cosmicFade = 0;
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._scratch = new THREE.Vector3();
    this._projected = new THREE.Vector3();
    this._lastW = 0;
    this._lastH = 0;
    this._lastNear = 0;
    this._lastFar = 0;
    this._selectedSprite = null;
    this._solarMarker = null;
    this._nebulae = [];
    this._curatedStars = [];
  }

  async init() {
    // Sky background is deliberately faint here; the 3D star field carries the sky.
    const skyTex = this.assets.textures.get('assets/textures/milkyway_starmap_4k.jpg') || null;
    this.sky = new SkyDome(skyTex || this._fallbackSkyTexture(), {
      rotation: galacticSkyRotation(),
      brightness: 0.28,
      opacity: 0.35,
    });
    this.scene.add(this.sky.mesh);

    const m31 = GALAXIES.find(g => g.id === 'm31');
    this._m31 = m31;
    this.localGroupAnchor = m31?.world
      ? new THREE.Vector3(m31.world.x * 0.5, m31.world.y * 0.5, m31.world.z * 0.5)
      : new THREE.Vector3(0.4, 0, 0);
    this._buildStars();
    this._buildExoplanetMarkers();
    this._buildMilkyWay();
    this._buildGalaxies();
    this._buildClusters();
    this._buildNebulae();
    this._buildCuratedStars();
    this._buildSurvey();
    this._buildHorizon();
    this._buildGalaxyGrid();
    this._buildSelection();
    this._buildSolarMarker();
    this._buildLabels();
    this._applyLayerVisibility();
    this.ready = true;
    this.rig.focusOn(new THREE.Vector3(SUN_SCENE_MPC.x, SUN_SCENE_MPC.y, SUN_SCENE_MPC.z), 1e-5, {
      duration: 0, yaw: 0.62, pitch: 0.2, immediate: true,
    });
    this.rig.minDistance = 2e-10;
    return this;
  }

  _fallbackSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#020409'; ctx.fillRect(0, 0, 1024, 512);
    let s = 3;
    const r = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = `rgba(220,230,255,${Math.pow(r(), 3) * 0.5})`;
      ctx.fillRect(r() * 1024, r() * 512, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _buildStars() {
    const s = this.catalogs.stars;
    const count = s.count;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const mag = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = s.world[i * 3];
      pos[i * 3 + 1] = s.world[i * 3 + 1];
      pos[i * 3 + 2] = s.world[i * 3 + 2];
      col[i * 3] = srgbToLinear(s.colors[i * 3] / 255);
      col[i * 3 + 1] = srgbToLinear(s.colors[i * 3 + 1] / 255);
      col[i * 3 + 2] = srgbToLinear(s.colors[i * 3 + 2] / 255);
      let m = s.absmag[i];
      if (!Number.isFinite(m) || m > 90) {
        const lum = s.lum[i];
        m = lum > 0 ? 4.83 - 2.5 * Math.log10(lum) : 9;
      }
      mag[i] = Math.max(-6, Math.min(18, m));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aAbsMag', new THREE.BufferAttribute(mag, 1));
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
        uPointScale: { value: 1 },
        uOpacity: { value: 1 },
      },
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(geo, this.starMaterial);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
    this._starPositions = pos;
  }

  _buildExoplanetMarkers() {
    const systems = this.catalogs.exo.systems.filter(s => s.world);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(systems.length * 3);
    systems.forEach((s, i) => {
      pos[i * 3] = s.world.x;
      pos[i * 3 + 1] = s.world.y;
      pos[i * 3 + 2] = s.world.z;
    });
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const exoTex = makeGlowTexture({ color: '120,220,210', core: 0.18, halo: 0.9 });
    this.exoPoints = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x6fd8cf, size: 2.0, sizeAttenuation: false,
      map: exoTex, alphaTest: 0.015,
      transparent: true, opacity: 0.25, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.exoPoints.frustumCulled = false;
    this.scene.add(this.exoPoints);
    this.exoSystems = systems;
  }

  _buildMilkyWay() {
    const gen = generateMilkyWay(185000);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(gen.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(gen.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(gen.sizes, 1));
    this.mwMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
      },
      vertexShader: galaxyPointVertex,
      fragmentShader: galaxyPointFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.milkyWay = new THREE.Points(geo, this.mwMaterial);
    this.milkyWay.frustumCulled = false;
    this.scene.add(this.milkyWay);

    const tex = makeGalaxyTexture('barred', 9001, 'warm');
    this.mwSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xf1ddc2,
    }));
    this.mwSprite.scale.setScalar(MILKY_WAY.diameterKpc * KPC_TO_MPC * 2.0);
    this.mwSprite.position.set(0, 0, 0);
    this.scene.add(this.mwSprite);

    const diskMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      color: 0xf5e4ce,
    });
    this.mwDisk = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), diskMat);
    this.mwDisk.rotation.x = -Math.PI / 2;
    this.mwDisk.scale.setScalar(MILKY_WAY.diameterKpc * KPC_TO_MPC * 1.08);
    this.scene.add(this.mwDisk);

    this.mwCore = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture({ color: '255,220,170', halo: 0.92 }),
      transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.mwCore.scale.setScalar(0.006);
    this.scene.add(this.mwCore);

    this.mwGrid = new THREE.Group();
    this.scene.add(this.mwGrid);
    for (const r of [5, 10, 15, 20, 25]) {
      const pts = [];
      for (let i = 0; i <= 192; i++) {
        const a = i / 192 * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r * KPC_TO_MPC, 0, Math.sin(a) * r * KPC_TO_MPC));
      }
      this.mwGrid.add(createLine(pts, { color: 0x7eb6e0, opacity: 0.09, width: 1.5, blending: THREE.AdditiveBlending }));
    }
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 25 * KPC_TO_MPC, 0, Math.sin(a) * 25 * KPC_TO_MPC)];
      this.mwGrid.add(createLine(pts, { color: 0x7eb6e0, opacity: 0.05, width: 1.25 }));
    }
    this.mwGrid.visible = false;
  }

  _buildSolarMarker() {
    this._solarMarker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeSelectionTexture('#ffd9a0'),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }));
    this._solarMarker.position.set(SUN_SCENE_MPC.x, SUN_SCENE_MPC.y, SUN_SCENE_MPC.z);
    this._solarMarker.scale.setScalar(0.00002);
    this.scene.add(this._solarMarker);
  }

  _buildGalaxies() {
    const galaxyData = GALAXIES.filter(g => g.world && g.id !== 'milky-way');
    const parts = [];
    let total = 0;
    const counts = {
      m31: 42000, m33: 26000, lmc: 18000, smc: 11000, m51: 28000, m101: 25000,
      m104: 22000, m87: 22000, m81: 22000, m82: 13000, 'cen-a': 18000,
      m49: 13000, m106: 12000, ngc1300: 12000, ngc1365: 12000, m83: 12000,
      m64: 8000, m94: 8000, m77: 8000, 'antennae': 11000, m46: 9000,
    };
    for (const g of galaxyData) {
      const count = counts[g.id] || 5500;
      const model = generateGalaxyParticles(g, count);
      parts.push(model);
      total += count;
    }
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const size = new Float32Array(total);
    let o = 0;
    for (const p of parts) {
      pos.set(p.positions, o * 3);
      col.set(p.colors, o * 3);
      size.set(p.sizes, o);
      o += p.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.galaxyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
      },
      vertexShader: galaxyPointVertex,
      fragmentShader: galaxyPointFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.galaxyPoints = new THREE.Points(geo, this.galaxyMaterial);
    this.galaxyPoints.frustumCulled = false;
    this.scene.add(this.galaxyPoints);

    // Sky-plane sprites for morphological recognition at distance.
    // Real galaxy photographs (NASA/ESA/Hubble, via Wikimedia Commons) replace the procedural sprites.
    const GALAXY_PHOTOS = {
      spiral: 'assets/textures/galaxies/m101-pinwheel.jpg',
      barred: 'assets/textures/galaxies/m81.jpg',
      elliptical: 'assets/textures/galaxies/m87.jpg',
      lenticular: 'assets/textures/galaxies/m87.jpg',
      edgeon: 'assets/textures/galaxies/sombrero.jpg',
      irregular: 'assets/textures/galaxies/hubble-udf.jpg',
    };
    // Each photo is drawn onto a square canvas (keeps its aspect ratio) and faded radially to black,
    // so the rectangular photo border never shows up under additive blending.
    const photoLoader = new THREE.ImageLoader();
    const typeTexture = new Map();
    const textureFor = (type) => {
      const key = GALAXY_PHOTOS[type] ? type : 'spiral';
      if (!typeTexture.has(key)) {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        // Procedural placeholder: visible while the photo loads and kept if the photo fails.
        {
          const ctx = canvas.getContext('2d');
          const procedural = makeGalaxyTexture(key, 4000 + typeTexture.size, 'warm');
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(procedural.image, 0, 0, size, size);
          procedural.dispose();
        }
        const photo = new THREE.CanvasTexture(canvas);
        photo.colorSpace = THREE.SRGBColorSpace;
        photo.anisotropy = 8;
        photoLoader.load(
          GALAXY_PHOTOS[key],
          (img) => {
            const ctx = canvas.getContext('2d');
            const fit = size / Math.max(img.width, img.height);
            const w = img.width * fit;
            const h = img.height * fit;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
            const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
            fade.addColorStop(0, 'rgba(0,0,0,0)');
            fade.addColorStop(1, 'rgba(0,0,0,1)');
            ctx.fillStyle = fade;
            ctx.fillRect(0, 0, size, size);
            photo.needsUpdate = true;
          },
          undefined,
          () => console.warn('Galaxy photo failed to load, using procedural texture:', GALAXY_PHOTOS[key]),
        );
        typeTexture.set(key, photo);
      }
      return typeTexture.get(key);
    };
    for (const g of galaxyData) {
      const type = g.model?.type || (g.type.toLowerCase().includes('elliptical') ? 'elliptical' : 'spiral');
      const tex = textureFor(type);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        color: 0xf7e2c4,
        rotation: (g.positionAngleDeg || 0) * DEG,
      });
      const sprite = new THREE.Sprite(mat);
      const sizeMpc = Math.max(0.00002, g.diameterKpc * KPC_TO_MPC) * 1.35;
      const flatten = type === 'edgeon' ? 1 : Math.max(0.22, Math.cos((g.inclinationDeg || 0) * DEG));
      sprite.scale.set(sizeMpc, sizeMpc * flatten, 1);
      sprite.position.set(g.world.x, g.world.y, g.world.z);
      sprite.userData.galaxyId = g.id;
      sprite.userData.pickable = true;
      this.scene.add(sprite);
      this._galaxySprites.push({ galaxy: g, sprite, material: mat, baseOpacity: 0.62, sizeMpc });
      const haloMat = new THREE.SpriteMaterial({
        map: this._galaxyHaloTexture || (this._galaxyHaloTexture = makeGlowTexture({ color: '185,205,245', core: 0.04, halo: 0.92 })),
        transparent: true, opacity: 0.1, depthWrite: false, depthTest: true,
        blending: THREE.AdditiveBlending, color: 0xcddcff,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.setScalar(sizeMpc * 2.6);
      halo.position.copy(sprite.position);
      this.scene.add(halo);
      this._galaxyHalos = this._galaxyHalos || [];
      this._galaxyHalos.push({ halo, material: haloMat });
      const coreMat = new THREE.SpriteMaterial({
        map: makeGlowTexture({ color: '255,236,200', core: 0.08, halo: 0.85 }),
        transparent: true, opacity: 0.5, depthWrite: false, depthTest: true,
        blending: THREE.AdditiveBlending,
      });
      const core = new THREE.Sprite(coreMat);
      core.scale.setScalar(sizeMpc * 0.42);
      core.position.copy(sprite.position);
      this.scene.add(core);
      this._galaxyCores = this._galaxyCores || [];
      this._galaxyCores.push({ core, material: coreMat });
      this._galaxyCentres.push({ type: 'galaxy', id: g.id, data: g, world: g.world, sizeMpc });
    }

    // A far-field Milky Way sprite, used only when viewed from outside.
    this._galaxyCentres.push({ type: 'galaxy', id: 'milky-way', data: MILKY_WAY, world: { x: 0, y: 0, z: 0 }, sizeMpc: MILKY_WAY.diameterKpc * KPC_TO_MPC * 1.2 });
  }

  _buildClusters() {
    const valid = CLUSTERS.filter(c => c.world && !c.noPosition);
    const glow = makeGlowTexture({ color: '180,165,225', halo: 0.95, core: 0.1 });
    for (const c of valid) {
      const size = Math.max(0.6, (c.diameterMpc || c.extentMpc || 2) * 1.35);
      const mat = new THREE.SpriteMaterial({
        map: glow,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        color: c.id === 'laniakea' ? 0xbda8e8 : 0x9eadd8,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(size);
      sprite.position.set(c.world.x, c.world.y, c.world.z);
      sprite.userData.clusterId = c.id;
      this.scene.add(sprite);
      this._clusterSprites.push({ cluster: c, sprite, material: mat, size });
    }
    this._clusterCentres = valid.map(c => ({ type: 'cluster', id: c.id, data: c, world: c.world, sizeMpc: Math.max(1, c.diameterMpc || c.extentMpc || 2) }));
  }

  _buildSurvey() {
    const makeSurvey = (data, { colorNear, colorFar, size, opacity }) => {
      if (!data) return null;
      const geo = new THREE.BufferGeometry();
      const n = data.count;
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const bright = new Float32Array(n);
      const near = vec3Color(colorNear), far = vec3Color(colorFar);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = data.world[i * 3];
        pos[i * 3 + 1] = data.world[i * 3 + 1];
        pos[i * 3 + 2] = data.world[i * 3 + 2];
        const z = data.zred[i];
        const t = Math.min(1, z / 1.5);
        const c = mixColor(near, far, t);
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        bright[i] = 0.35 + (i % 11) / 22;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uPixelRatio: { value: 1 },
          uSize: { value: size },
          uOpacity: { value: 0 },
        },
        vertexShader: surveyVertex,
        fragmentShader: surveyFragment,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      this.scene.add(pts);
      return { points: pts, material: mat, data };
    };
    this.sdssLayer = makeSurvey(this.catalogs.sdss, {
      colorNear: '#e9c08a', colorFar: '#8fb4e8', size: 1.5, opacity: 0,
    });
    this.quasarLayer = makeSurvey(this.catalogs.quasars, {
      colorNear: '#9ce4de', colorFar: '#dfe9ff', size: 2.1, opacity: 0,
    });
  }

  _buildHorizon() {
    const radius = OBSERVABLE_UNIVERSE_RADIUS_MPC;
    const geo = new THREE.SphereGeometry(radius, 72, 36);
    this.horizonMaterial = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: horizonVertex,
      fragmentShader: horizonFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.horizon = new THREE.Mesh(geo, this.horizonMaterial);
    this.horizon.position.set(SUN_SCENE_MPC.x, SUN_SCENE_MPC.y, SUN_SCENE_MPC.z);
    this.horizon.frustumCulled = false;
    this.horizon.renderOrder = -2;
    this.horizon.visible = false;
    this.scene.add(this.horizon);
  }

  _buildGalaxyGrid() {
    this.galaxyGrid = new THREE.Group();
    this.galaxyGrid.visible = false;
    // Reuse a subtle polar grid in the galactic plane.
    const radii = [5, 10, 15, 20];
    for (const r of radii) {
      const pts = [];
      for (let i = 0; i <= 256; i++) {
        const a = i / 256 * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r * KPC_TO_MPC, 0, Math.sin(a) * r * KPC_TO_MPC));
      }
      this.galaxyGrid.add(createLine(pts, { color: 0x8dbbdf, opacity: 0.06, width: 1.25 }));
    }
    this.scene.add(this.galaxyGrid);
  }

  _buildSelection() {
    this._selectedSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeSelectionTexture('#a7dcff'),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }));
    this._selectedSprite.visible = false;
    this.scene.add(this._selectedSprite);
  }

  _getStarNamed(name) {
    return this.catalogs.findStar(name);
  }

  _buildNebulae() {
    const m16 = NEBULAE.find(n => n.id === 'm16');
    if (!m16) return;
    const world = raDecKpcToWorld(m16.ra, m16.dec, m16.distKpc);
    this._nebulaM16 = { ...m16, world };
    const texture = new THREE.TextureLoader().load('assets/cosmos/images/pillars-clean.jpg');
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture, transparent: true, opacity: 0.92, depthWrite: false,
      depthTest: true, blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(world.x, world.y, world.z);
    sprite.scale.set(8e-6, 8e-6, 1);
    sprite.visible = false;
    this.scene.add(sprite);
    this._nebulaSprite = sprite;
  }

  _buildCuratedStars() {
    this._curatedStars = CURATED_STARS.map(c => ({
      ...c,
      world: raDecParsecsToWorld(c.ra, c.dec, c.distPc),
    }));
  }

  _buildLabels() {
    const items = [];
    const add = (item) => { items.push(item); this._labels.push(item); };

    // The Sun is a marker, not a catalogue star.
    add({
      id: 'sun', name: 'SUN', sub: 'G2V · you are here', priority: 130,
      className: 'label-major label-star', color: '#ffd9a0',
      getPosition: () => new THREE.Vector3(SUN_SCENE_MPC.x, SUN_SCENE_MPC.y, SUN_SCENE_MPC.z),
      onClick: () => this.onSelect({ kind: 'sun', id: 'sun', data: null }),
      shouldShow: () => this._starFade > 0.12,
    });
    for (const name of FEATURED_STAR_NAMES) {
      const s = this._getStarNamed(name);
      if (!s) continue;
      add({
        id: `star-${s.i}`, name: s.name.toUpperCase(),
        sub: `${s.spect || 'Star'} · ${(s.distPc * 3.26156).toFixed(1)} ly`,
        priority: s.name === 'Sirius' || s.name === 'Proxima Centauri' ? 105 : 80,
        className: 'label-star', color: '#cfe2f7',
        getPosition: () => {
          const w = s.world || this.catalogs.starWorld(s.i);
          return new THREE.Vector3(w.x, w.y, w.z);
        },
        onClick: () => this.selectStar(s),
        shouldShow: () => this._starFade > 0.25,
      });
    }
    // Featured exoplanet systems.
    const featuredHosts = ['TRAPPIST-1', 'Proxima Cen', '51 Peg', 'Kepler-186', 'Kepler-452', 'TOI-700', 'GJ 667 C'];
    for (const host of featuredHosts) {
      const sys = this.catalogs.findSystem(host);
      if (!sys || !sys.world) continue;
      add({
        id: `sys-${host}`, name: sys.host.toUpperCase(),
        sub: `${sys.planets.length} confirmed planet${sys.planets.length > 1 ? 's' : ''}`,
        priority: 65, className: 'label-exosystem', color: '#78d3cb',
        getPosition: () => new THREE.Vector3(sys.world.x, sys.world.y, sys.world.z),
        onClick: () => this.onSelect({ kind: 'system', id: sys.host, system: sys }),
        shouldShow: () => this._starFade > 0.25 && this.layerVisibility.exoplanets,
      });
    }

    // Galactic structure.
    add({
      id: 'galactic-centre', name: 'GALACTIC CENTRE', sub: 'Sgr A* · schematic model', priority: 120,
      className: 'label-major label-galaxy', color: '#ffcf96',
      getPosition: () => new THREE.Vector3(0, 0, 0),
      onClick: () => this.onSelect({ kind: 'galaxy', id: 'milky-way', data: MILKY_WAY }),
      shouldShow: () => this._galaxyFade > 0.08 && this.rig.distance < 0.2,
    });
    add({
      id: 'mw-sun', name: 'SOLAR SYSTEM', sub: '26,000 ly from centre', priority: 125,
      className: 'label-major label-galaxy', color: '#9edcff',
      getPosition: () => new THREE.Vector3(SUN_SCENE_MPC.x, SUN_SCENE_MPC.y, SUN_SCENE_MPC.z),
      onClick: () => this.onSelect({ kind: 'sun', id: 'sun', data: null }),
      shouldShow: () => this._galaxyFade > 0.12 && this.rig.distance < 0.2,
    });
    add({
      id: 'milky-way', name: 'MILKY WAY', sub: 'barred spiral · 100,000 ly', priority: 115,
      className: 'label-major label-galaxy', color: '#f0dcc0',
      getPosition: () => new THREE.Vector3(0, 0, 0.018),
      onClick: () => this.onSelect({ kind: 'galaxy', id: 'milky-way', data: MILKY_WAY }),
      shouldShow: () => this._galaxyFade > 0.2,
    });
    add({
      id: 'local-group', name: 'LOCAL GROUP', sub: 'our galactic neighbourhood', priority: 98,
      className: 'label-major label-galaxy', color: '#b9cce6',
      getPosition: () => this.localGroupAnchor.clone(),
      onClick: () => this.onSelect({ kind: 'galaxy', id: 'milky-way', data: MILKY_WAY }),
      shouldShow: () => this._localFade > 0.25,
    });
    // Galaxy labels.
    for (const g of GALAXIES) {
      if (!g.world || g.id === 'milky-way') continue;
      add({
        id: `galaxy-${g.id}`, name: g.name.toUpperCase(), sub: g.type,
        priority: ['m31', 'm33', 'lmc', 'smc', 'm87', 'm51'].includes(g.id) ? 95 : 55,
        className: 'label-galaxy', color: '#e7c79b',
        getPosition: () => new THREE.Vector3(g.world.x, g.world.y, g.world.z),
        onClick: () => this.selectGalaxy(g),
        shouldShow: () => this._galaxyFade > 0.12 && this.layerVisibility.localgroup &&
          (!['lmc', 'smc'].includes(g.id) || this.rig.distance < 0.6),
      });
    }
    // Clusters.
    for (const c of CLUSTERS) {
      if (!c.world || c.noPosition) continue;
      add({
        id: `cluster-${c.id}`, name: c.name.toUpperCase(), sub: c.type,
        priority: ['virgo-cluster', 'coma-cluster', 'laniakea', 'perseus-cluster'].includes(c.id) ? 70 : 35,
        className: 'label-cluster', color: '#c0aee8',
        getPosition: () => new THREE.Vector3(c.world.x, c.world.y, c.world.z),
        onClick: () => this.selectCluster(c),
        shouldShow: () => this._cosmicFade > 0.08 && this.layerVisibility.clusters,
      });
    }
    // Curated stars used by the UDA 2–3 journey.
    for (const c of this._curatedStars) {
      add({
        id: `curated-${c.id}`, name: c.name.toUpperCase(),
        sub: `${c.kind} · ${Math.round(c.distLy).toLocaleString('en-US')} ly`,
        priority: 90, className: 'label-major label-star', color: '#ffb27a',
        getPosition: () => new THREE.Vector3(c.world.x, c.world.y, c.world.z),
        onClick: () => this.onSelect({ kind: 'curated', id: c.id, data: c, curated: true }),
        shouldShow: () => this._starFade > 0.12,
      });
    }
    if (this._nebulaM16) {
      add({
        id: 'nebula-m16', name: 'NEBULOSA AQUILA',
        sub: 'M16 · Pilastri della Creazione · modello', priority: 92,
        className: 'label-major label-nebula', color: '#c8dfb2',
        getPosition: () => new THREE.Vector3(this._nebulaM16.world.x, this._nebulaM16.world.y, this._nebulaM16.world.z),
        onClick: () => this.onSelect({ kind: 'nebula', id: 'm16', data: this._nebulaM16 }),
        shouldShow: () => this._starFade > 0.05 && this.layerVisibility.stars,
      });
    }
    this.labels.setItems(items);
    for (const item of this.labels.items) {
      if (item.color) {
        const dot = item.el.querySelector('.sky-label-dot');
        if (dot) dot.style.background = item.color;
      }
    }
  }

  _applyLayerVisibility() {
    const l = this.layerVisibility;
    if (this.stars) this.stars.visible = l.stars;
    if (this._nebulaSprite) this._nebulaSprite.visible = l.stars && this._starFade > 0.03;
    if (this.exoPoints) this.exoPoints.visible = l.exoplanets;
    if (this.milkyWay) this.milkyWay.visible = l.milkyway;
    if (this.mwSprite) this.mwSprite.visible = l.milkyway;
    if (this.mwCore) this.mwCore.visible = l.milkyway;
    if (this.galaxyPoints) this.galaxyPoints.visible = l.localgroup;
    for (const s of this._galaxySprites) s.sprite.visible = l.localgroup;
    for (const s of this._clusterSprites) s.sprite.visible = l.clusters;
    if (this.sdssLayer) this.sdssLayer.points.visible = l.sdss;
    if (this.quasarLayer) this.quasarLayer.points.visible = l.quasars;
    if (this.horizon) this.horizon.visible = l.horizon;
    if (this.mwGrid) this.mwGrid.visible = this.gridVisible && l.milkyway;
  }

  setLayer(name, visible) {
    if (name in this.layerVisibility) {
      this.layerVisibility[name] = visible;
      this._applyLayerVisibility();
    }
  }

  setLabelsVisible(v) { this.labels.setVisible(v); }
  setGridVisible(v) { this.gridVisible = v; if (this.galaxyGrid) this.galaxyGrid.visible = v; this._applyLayerVisibility(); }
  setOrbitsVisible() { /* no orbits at this scale */ }
  setCinematic(v) { this.rig.autoRotate = v; this.rig.autoRotateSpeed = 0.008; }

  activate() {
    this.labels.setVisible(true);
    this.rig.enabled = true;
    this._resize();
    this.canvas.style.cursor = 'grab';
  }

  deactivate() {
    this.labels.setVisible(false);
    this.rig.enabled = false;
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.labels.setScreenSize(w, h);
  }

  setScaleMeters(meters, { animate = true } = {}) {
    const fov = this.camera.fov * DEG;
    const dMpc = meters / MPC / (2 * Math.tan(fov / 2));
    let anchor;
    let yaw = this.rig.yaw;
    let pitch = this.rig.pitch;
    if (meters < 2.5e19) {
      anchor = new THREE.Vector3(SUN_SCENE_MPC.x, SUN_SCENE_MPC.y, SUN_SCENE_MPC.z);
      pitch = Math.max(pitch, 0.16);
      this.focusLevel = 'stars';
    } else if (meters < 2e22) {
      anchor = new THREE.Vector3(0, 0, 0);
      pitch = this.rig.pitch > 0.65 ? this.rig.pitch : 0.58;
      this.focusLevel = meters < 2e21 ? 'galaxy' : 'galaxy';
    } else if (meters < 2e24) {
      // Frame the Local Group from a direction roughly perpendicular to the Milky Way–Andromeda axis.
      const m31 = this._m31;
      if (m31?.world) {
        const axis = new THREE.Vector3(m31.world.x, m31.world.y, m31.world.z).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const view = new THREE.Vector3().crossVectors(axis, up).normalize().multiplyScalar(0.82).addScaledVector(up, 0.5).normalize();
        yaw = Math.atan2(view.x, view.z);
        pitch = Math.max(0.24, Math.min(1.0, Math.asin(view.y)));
      }
      anchor = this.localGroupAnchor.clone();
      this.focusLevel = 'local';
    } else {
      anchor = new THREE.Vector3(0, 0, 0);
      pitch = this.rig.pitch > 0.35 ? this.rig.pitch : 0.38;
      this.focusLevel = meters > 5e26 ? 'observable' : 'cosmic';
    }
    let dist = Math.max(1e-9, Math.min(30000, dMpc));
    if (this.focusLevel === 'local') dist = Math.min(dist, Math.max(1.35, dist * 0.62));
    this.rig.setLimits(Math.max(2e-10, dist * 1e-6), 30000);
    this.rig.follow = null;
    this.rig.focusOn(anchor, dist, {
      duration: animate && !this.getSettings()?.reducedMotion ? 1.35 : 0,
      yaw,
      pitch,
    });
    this.onScaleLevel?.(this.focusLevel);
  }

  focusStar(star, opts = {}) {
    const world = star.world || this.catalogs.starWorld(star.i);
    if (!world) return;
    const target = new THREE.Vector3(world.x, world.y, world.z);
    this.rig.setLimits(2e-10, 30000);
    this.rig.focusOn(target, 1.2e-6, { duration: opts.immediate ? 0 : 1.7, yaw: this.rig.yaw, pitch: this.rig.pitch });
    this.focusLevel = 'stars';
    this.onFocusChange?.({ level: 'stars', star });
  }

  focusSun() {
    this.rig.setLimits(2e-10, 30000);
    this.rig.follow = null;
    this.focusLevel = 'stars';
    this.rig.focusOn(new THREE.Vector3(SUN_SCENE_MPC.x, SUN_SCENE_MPC.y, SUN_SCENE_MPC.z), 1e-5, {
      duration: 1.4, yaw: 0.62, pitch: 0.2,
    });
    this.onFocusChange?.({ level: 'stars', sun: true });
  }

  focusMilkyWay(opts = {}) {
    this.rig.setLimits(1e-7, 30000);
    this.rig.follow = null;
    this.rig.focusOn(new THREE.Vector3(0, 0, 0), 0.048, {
      duration: opts.immediate ? 0 : 1.8, yaw: 0.55, pitch: 0.92,
    });
    this.focusLevel = 'galaxy';
    this.onFocusChange?.({ level: 'galaxy', milkyWay: true });
  }

  focusLocalGroup() {
    const m31 = this._m31;
    let view = new THREE.Vector3(0.4, 0.6, 0.8).normalize();
    if (m31?.world) {
      const axis = new THREE.Vector3(m31.world.x, m31.world.y, m31.world.z).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      view = new THREE.Vector3().crossVectors(axis, up).normalize().multiplyScalar(0.8).addScaledVector(up, 0.6).normalize();
    }
    const yaw = Math.atan2(view.x, view.z);
    const pitch = Math.max(0.22, Math.min(1.1, Math.asin(view.y)));
    this.rig._tweens = [];
    this.rig.setLimits(1e-5, 30000);
    this.rig.follow = null;
    this.rig.focus.set(this.localGroupAnchor.x, this.localGroupAnchor.y, this.localGroupAnchor.z);
    this.rig.targetFocus.copy(this.rig.focus);
    this.rig.distance = 2.5;
    this.rig.targetDistance = 2.5;
    this.rig.setAngles(yaw, pitch, true);
    this.rig.apply(0, true);
    this.focusLevel = 'local';
    this.onFocusChange?.({ level: 'local' });
  }

  focusGalaxy(g, opts = {}) {
    if (!g || !g.world) return;
    const target = new THREE.Vector3(g.world.x, g.world.y, g.world.z);
    const dist = Math.max(0.00003, (g.diameterKpc || 10) * KPC_TO_MPC * 3.4);
    this.rig.setLimits(Math.min(dist * 0.1, 0.00003), 30000);
    this.rig.focusOn(target, dist, { duration: opts.immediate ? 0 : 1.7, yaw: 0.56, pitch: 0.42 });
    this.focusLevel = 'local';
    this.onFocusChange?.({ level: 'local', galaxy: g });
  }

  focusCluster(c, opts = {}) {
    if (!c || !c.world) return;
    const target = new THREE.Vector3(c.world.x, c.world.y, c.world.z);
    const size = Math.max(1, c.diameterMpc || c.extentMpc || 2);
    this.rig.setLimits(1e-5, 30000);
    this.rig.focusOn(target, size * 3.0, { duration: opts.immediate ? 0 : 1.7, yaw: 0.5, pitch: 0.45 });
    this.focusLevel = 'cosmic';
    this.onFocusChange?.({ level: 'cosmic', cluster: c });
  }

  focusWeb(opts = {}) {
    this.rig.setLimits(1e-5, 30000);
    this.rig.follow = null;
    this.rig.focusOn(new THREE.Vector3(0, 0, 0), 240, {
      duration: opts.immediate ? 0 : 1.8, yaw: 0.62, pitch: 0.42,
    });
    this.focusLevel = 'cosmic';
    this.onFocusChange?.({ level: 'cosmic' });
  }

  focusObservable(opts = {}) {
    this.rig.setLimits(1, 30000);
    this.rig.follow = null;
    this.rig.focusOn(new THREE.Vector3(0, 0, 0), 17000, {
      duration: opts.immediate ? 0 : 2.2, yaw: 0.62, pitch: 0.36,
    });
    this.focusLevel = 'observable';
    this.onFocusChange?.({ level: 'observable' });
  }

  focusCuratedStar(id, opts = {}) {
    const c = this._curatedStars.find(x => x.id === id);
    if (!c) return;
    const target = new THREE.Vector3(c.world.x, c.world.y, c.world.z);
    this.rig.setLimits(2e-10, 30000);
    this.rig.follow = null;
    this.rig.focusOn(target, 1.2e-6, {
      duration: opts.immediate ? 0 : 1.7, yaw: this.rig.yaw, pitch: this.rig.pitch,
    });
    this.focusLevel = 'stars';
    this.onFocusChange?.({ level: 'stars', star: c });
  }

  focusNebula(nebula, opts = {}) {
    const n = typeof nebula === 'string' ? NEBULAE.find(x => x.id === nebula) : nebula;
    if (!n) return;
    const world = n.world || raDecKpcToWorld(n.ra, n.dec, n.distKpc);
    const target = new THREE.Vector3(world.x, world.y, world.z);
    this.rig.setLimits(2e-8, 30000);
    this.rig.follow = null;
    this.rig.focusOn(target, 2.2e-4, {
      duration: opts.immediate ? 0 : 1.7, yaw: 0.42, pitch: 0.24,
    });
    this.focusLevel = 'stars';
    this.onFocusChange?.({ level: 'stars', nebula: n });
  }

  resetView() {
    this.rig.setLimits(2e-10, 30000);
    this.rig.follow = null;
    this.focusLevel = 'stars';
    this.rig.focusOn(new THREE.Vector3(SUN_SCENE_MPC.x, SUN_SCENE_MPC.y, SUN_SCENE_MPC.z), 1e-5, {
      duration: 1.6, yaw: 0.62, pitch: 0.2,
    });
    this._setSelected(null);
    this.onFocusChange?.({ level: 'stars' });
  }

  selectStar(star) {
    const data = star.i != null ? (this.catalogs.starIndex.named.find(s => s.i === star.i) || star) : star;
    this._setSelected({ type: 'star', id: `star-${star.i}`, position: star.world || this.catalogs.starWorld(star.i) });
    this.onSelect?.({ kind: 'star', data, star });
  }

  selectGalaxy(g) {
    this._setSelected({ type: 'galaxy', id: g.id, position: g.world, getPosition: () => g.world });
    this.onSelect?.({ kind: 'galaxy', id: g.id, data: g });
  }

  selectCluster(c) {
    this._setSelected({ type: 'cluster', id: c.id, position: c.world });
    this.onSelect?.({ kind: 'cluster', id: c.id, data: c });
  }

  _setSelected(sel) {
    this.selectedId = sel?.id || null;
    this.selectedData = sel;
    this._selectedSprite.visible = !!sel;
    if (sel) {
      const p = sel.position;
      this._selectedSprite.position.set(p.x, p.y, p.z);
    }
    this.labels.setSelected(sel?.id || null);
  }

  _project(world, w, h) {
    this._projected.set(world.x, world.y, world.z).project(this.camera);
    return {
      x: (this._projected.x * 0.5 + 0.5) * w,
      y: (-this._projected.y * 0.5 + 0.5) * h,
      z: this._projected.z,
    };
  }

  pick({ x, y }) {
    const w = window.innerWidth, h = window.innerHeight;
    const rect = this.canvas.getBoundingClientRect();
    const px = ((x - rect.left) / rect.width) * w;
    const py = ((y - rect.top) / rect.height) * h;
    // Galaxies and clusters first.
    const candidates = [];
    if (this.layerVisibility.localgroup && this._galaxyFade > 0.08) {
      for (const g of GALAXIES) {
        if (!g.world) continue;
        const p = this._project(g.world, w, h);
        if (p.z < -1 || p.z > 1) continue;
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < 22) candidates.push({ d, kind: 'galaxy', data: g });
      }
    }
    if (this.layerVisibility.clusters && this._cosmicFade > 0.05) {
      for (const c of CLUSTERS) {
        if (!c.world || c.noPosition) continue;
        const p = this._project(c.world, w, h);
        if (p.z < -1 || p.z > 1) continue;
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < 20) candidates.push({ d, kind: 'cluster', data: c });
      }
    }
    if (this._starFade > 0.2) {
      // The Sun marker.
      const sp = this._project(SUN_SCENE_MPC, w, h);
      if (sp.z > -1 && sp.z < 1 && Math.hypot(sp.x - px, sp.y - py) < 14) {
        candidates.push({ d: 2, kind: 'sun' });
      }
      // Exoplanet hosts.
      for (const sys of this.exoSystems) {
        const p = this._project(sys.world, w, h);
        if (p.z < -1 || p.z > 1) continue;
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < 10) candidates.push({ d, kind: 'system', system: sys });
      }
      // Stars. Iterate the full catalogue and find the brightest near the cursor.
      if (this.stars.visible) {
        const cam = this.camera;
        let best = null;
        const p = this._scratch;
        for (let i = 0; i < this.catalogs.stars.count; i++) {
          p.set(this._starPositions[i * 3], this._starPositions[i * 3 + 1], this._starPositions[i * 3 + 2]).project(cam);
          if (p.z < -1 || p.z > 1) continue;
          const sx = (p.x * 0.5 + 0.5) * w;
          const sy = (-p.y * 0.5 + 0.5) * h;
          const d = Math.hypot(sx - px, sy - py);
          if (d > 9) continue;
          const abs = this.catalogs.stars.absmag[i];
          const camDist = cam.position.distanceTo(new THREE.Vector3(this._starPositions[i * 3], this._starPositions[i * 3 + 1], this._starPositions[i * 3 + 2]));
          const app = abs + 5 * (Math.log10(Math.max(camDist * 1e6, 1e-6)) - 1);
          if (!best || app < best.app || (Math.abs(app - best.app) < 0.5 && d < best.d)) best = { i, d, app };
        }
        if (best) {
          candidates.push({
            d: best.d, kind: 'star', index: best.i,
            data: this.catalogs.starIndex.named.find(s => s.i === best.i) || null,
          });
        }
      }
    }
    // Survey points at cosmic scales.
    if (this.sdssLayer && this.layerVisibility.sdss && this._cosmicFade > 0.08) {
      const hit = this._pickPointCloud(this.sdssLayer.data, w, h, px, py, 6);
      if (hit) candidates.push({ d: 6, kind: 'sdss', index: hit });
    }
    if (this.quasarLayer && this.layerVisibility.quasars && this._cosmicFade > 0.08) {
      const hit = this._pickPointCloud(this.quasarLayer.data, w, h, px, py, 7);
      if (hit) candidates.push({ d: 7, kind: 'quasar', index: hit });
    }
    candidates.sort((a, b) => a.d - b.d);
    const c = candidates[0];
    if (!c) { this.onSelect?.(null); return; }
    if (c.kind === 'galaxy') {
      this.selectGalaxy(c.data);
      this._setSelected({ type: 'galaxy', id: c.data.id, position: c.data.world });
    } else if (c.kind === 'cluster') {
      this.selectCluster(c.data);
    } else if (c.kind === 'sun') {
      this.onSelect?.({ kind: 'sun', id: 'sun', data: null });
    } else if (c.kind === 'system') {
      this.onSelect?.({ kind: 'system', id: c.system.host, system: c.system });
    } else if (c.kind === 'star') {
      const star = this.catalogs.starIndex.named.find(s => s.i === c.index);
      if (star) this.selectStar(star);
      else {
        const obj = this.catalogs.objectFromStarIndex(c.index);
        if (obj) this.selectStar(obj.data);
      }
    } else if (c.kind === 'sdss' || c.kind === 'quasar') {
      const data = this.catalogs[c.kind === 'sdss' ? 'sdss' : 'quasars'];
      const idx = c.index;
      const z = data.zred[idx];
      const world = { x: data.world[idx * 3], y: data.world[idx * 3 + 1], z: data.world[idx * 3 + 2] };
      this._setSelected({ type: c.kind, id: `${c.kind}-${idx}`, position: world });
      this.onSelect?.({
        kind: c.kind,
        data: { z, world, index: idx, survey: c.kind === 'sdss' ? 'SDSS DR18 galaxies' : 'SDSS DR18 quasars' },
      });
    }
  }

  _pickPointCloud(data, w, h, px, py, radius) {
    let best = null;
    const p = this._scratch;
    for (let i = 0; i < data.count; i++) {
      p.set(data.world[i * 3], data.world[i * 3 + 1], data.world[i * 3 + 2]).project(this.camera);
      if (p.z < -1 || p.z > 1) continue;
      const sx = (p.x * 0.5 + 0.5) * w;
      const sy = (-p.y * 0.5 + 0.5) * h;
      const d = Math.hypot(sx - px, sy - py);
      if (d < radius && !best) best = i;
      else if (d < radius && best != null) { /* prefer first */ }
    }
    return best;
  }

  doubleClick({ x, y }) {
    this.pick({ x, y });
    if (!this.selectedData) return;
    if (this.selectedData.type === 'star') {
      const star = this.selectedData.star || this.selectedData.data;
      if (star) this.focusStar(star);
    } else if (this.selectedData.type === 'galaxy') {
      const g = this.selectedData.data;
      if (g) g.id === 'milky-way' ? this.focusMilkyWay() : this.focusGalaxy(g);
    } else if (this.selectedData.type === 'cluster') {
      if (this.selectedData.data) this.focusCluster(this.selectedData.data);
    }
  }

  getScaleReport() {
    const visibleHeight = 2 * this.rig.distance * Math.tan(this.camera.fov * DEG / 2) * MPC;
    let label = 'Stellar neighbourhood';
    if (this.rig.distance > 0.0005) label = 'Milky Way';
    if (this.rig.distance > 0.1) label = 'Local Group';
    if (this.rig.distance > 10) label = 'Cosmic web';
    if (this.rig.distance > 5000) label = 'Observable universe';
    return { scaleMeters: visibleHeight, label, distanceMpc: this.rig.distance };
  }

  getLevel() {
    const d = this.rig.distance;
    if (d < 0.0005) return 'stars';
    if (d < 0.1) return 'galaxy';
    if (d < 10) return 'local';
    if (d < 5000) return 'cosmic';
    return 'observable';
  }

  getObjectPosition(id) {
    if (id === 'sun') return new THREE.Vector3(SUN_SCENE_MPC.x, SUN_SCENE_MPC.y, SUN_SCENE_MPC.z);
    const g = GALAXIES.find(x => x.id === id);
    if (g?.world) return new THREE.Vector3(g.world.x, g.world.y, g.world.z);
    const c = CLUSTERS.find(x => x.id === id);
    if (c?.world) return new THREE.Vector3(c.world.x, c.world.y, c.world.z);
    return null;
  }

  update(dt, { time, width, height }) {
    if (!this.ready) return;
    const w = width || window.innerWidth, h = height || window.innerHeight;
    if (this._lastW !== w || this._lastH !== h) {
      this._lastW = w; this._lastH = h;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.labels.setScreenSize(w, h);
    }
    const d = this.rig.distance;
    const near = Math.max(1e-10, d * 1e-7);
    const far = Math.max(40000, d * 4);
    if (near !== this._lastNear || far !== this._lastFar) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
      this._lastNear = near;
      this._lastFar = far;
    }
    this.rig.update(dt);
    this.time += dt;

    const pr = Math.min(2, window.devicePixelRatio || 1);
    this.starMaterial.uniforms.uPixelRatio.value = pr;
    this.starMaterial.uniforms.uPointScale.value = 1;
    this.galaxyMaterial.uniforms.uPixelRatio.value = pr;
    if (this.sdssLayer) this.sdssLayer.material.uniforms.uPixelRatio.value = pr;
    if (this.quasarLayer) this.quasarLayer.material.uniforms.uPixelRatio.value = pr;

    const starFade = Math.max(0, Math.min(1, 1 - smoothstep(0.00025, 0.004, d)));
    const galaxyFade = Math.max(0, Math.min(1, smoothstep(0.00015, 0.0015, d) * (1 - smoothstep(6, 30, d))));
    const localFade = Math.max(0, Math.min(1, smoothstep(0.0004, 0.002, d) * (1 - smoothstep(60, 500, d))));
    const cosmicFade = smoothstep(8, 40, d);
    const quasarFade = smoothstep(30, 150, d);
    const horizonFade = smoothstep(800, 5000, d);
    this._starFade = starFade;
    this._galaxyFade = galaxyFade;
    this._localFade = localFade;
    this._cosmicFade = cosmicFade;

    if (this.stars) {
      this.stars.visible = this.layerVisibility.stars && starFade > 0.01;
      this.starMaterial.uniforms.uOpacity.value = starFade;
    }
    if (this._nebulaSprite) {
      this._nebulaSprite.visible = this.layerVisibility.stars && starFade > 0.03;
      this._nebulaSprite.material.opacity = 0.92 * Math.min(1, starFade * 1.4);
    }
    if (this.exoPoints) {
      this.exoPoints.visible = this.layerVisibility.exoplanets && starFade > 0.05;
      this.exoPoints.material.opacity = starFade * 0.22;
    }
    if (this.milkyWay) {
      this.milkyWay.visible = this.layerVisibility.milkyway && galaxyFade > 0.01;
      this.mwMaterial.uniforms.uOpacity.value = galaxyFade * 0.55;
    }
    if (this.mwDisk) {
      this.mwDisk.visible = this.layerVisibility.milkyway && galaxyFade > 0.01;
      this.mwDisk.material.opacity = galaxyFade * 0.34;
      this.mwDisk.rotation.z = 0.22;
    }
    if (this.mwSprite) {
      const spriteFade = this.layerVisibility.milkyway ? smoothstep(0.08, 0.5, d) * (1 - smoothstep(100, 400, d)) : 0;
      this.mwSprite.visible = spriteFade > 0.01;
      this.mwSprite.material.opacity = spriteFade * 0.75;
    }
    if (this.mwCore) {
      this.mwCore.visible = this.layerVisibility.milkyway && galaxyFade > 0.05;
      this.mwCore.material.opacity = galaxyFade * 0.35;
      this.mwCore.scale.setScalar(0.0032);
    }
    if (this.galaxyPoints) {
      this.galaxyPoints.visible = this.layerVisibility.localgroup && localFade > 0.01;
      this.galaxyMaterial.uniforms.uOpacity.value = localFade * 0.9;
    }
    for (const s of this._galaxySprites) {
      const camDist = this.camera.position.distanceTo(s.sprite.position);
      const close = Math.max(0, 1 - smoothstep(s.sizeMpc * 0.6, s.sizeMpc * 3.5, camDist));
      s.sprite.visible = this.layerVisibility.localgroup && localFade > 0.02;
      s.material.opacity = (0.68 - close * 0.42) * localFade;
    }
    for (const h of (this._galaxyHalos || [])) {
      h.halo.visible = this.layerVisibility.localgroup && localFade > 0.02;
      h.material.opacity = 0.08 * localFade;
    }
    for (const c of (this._galaxyCores || [])) {
      c.core.visible = this.layerVisibility.localgroup && localFade > 0.02;
      c.material.opacity = 0.32 * localFade;
    }
    for (const s of this._clusterSprites) {
      s.sprite.visible = this.layerVisibility.clusters && cosmicFade > 0.02;
      s.material.opacity = (s.cluster.id === 'laniakea' ? 0.06 : 0.16) * cosmicFade;
    }
    if (this.sdssLayer) {
      this.sdssLayer.points.visible = this.layerVisibility.sdss && cosmicFade > 0.01;
      this.sdssLayer.material.uniforms.uOpacity.value = cosmicFade;
    }
    if (this.quasarLayer) {
      this.quasarLayer.points.visible = this.layerVisibility.quasars && quasarFade > 0.01;
      this.quasarLayer.material.uniforms.uOpacity.value = quasarFade * 0.9;
    }
    if (this.horizon) {
      this.horizon.visible = this.layerVisibility.horizon && horizonFade > 0.01;
      this.horizonMaterial.uniforms.uOpacity.value = horizonFade;
    }
    if (this.sky) {
      const skyFade = Math.max(0, 1 - smoothstep(0.001, 0.008, d));
      this.sky.material.uniforms.uOpacity.value = skyFade * 0.035;
      this.sky.update(this.camera);
    }
    if (this.galaxyGrid) {
      this.galaxyGrid.visible = this.gridVisible && galaxyFade > 0.05;
      if (this.mwGrid) this.mwGrid.visible = this.gridVisible && galaxyFade > 0.1;
    }

    // Solar marker size (screen-constant).
    if (this._solarMarker) {
      const camDist = this.camera.position.distanceTo(this._solarMarker.position);
      const wpp = 2 * Math.tan(this.camera.fov * DEG / 2) * camDist / Math.max(1, h);
      this._solarMarker.scale.setScalar(Math.max(wpp * 22, 0.00002));
      this._solarMarker.material.opacity = (starFade * 0.6 + galaxyFade * 0.9);
      this._solarMarker.visible = this._solarMarker.material.opacity > 0.04;
    }

    if (this.selectedData) {
      const p = this.selectedData.getPosition ? this.selectedData.getPosition() : this.selectedData.position;
      if (p) {
        let layerVisible = true;
        if (this.selectedData.type === 'star') layerVisible = starFade > 0.08;
        else if (this.selectedData.type === 'galaxy') layerVisible = localFade > 0.03 || galaxyFade > 0.05;
        else if (this.selectedData.type === 'cluster') layerVisible = cosmicFade > 0.03;
        this._selectedSprite.position.set(p.x, p.y, p.z);
        const camDist = this.camera.position.distanceTo(this._selectedSprite.position);
        const wpp = 2 * Math.tan(this.camera.fov * DEG / 2) * camDist / Math.max(1, h);
        this._selectedSprite.scale.setScalar(Math.max(wpp * 26, 1e-9));
        this._selectedSprite.visible = layerVisible;
      }
    }

    this.labels.update(this.camera, w, h, performance.now());
  }
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
