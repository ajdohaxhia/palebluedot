import * as THREE from 'three';
import { OrbitRig, TouchEnhancer } from '../engine/camera.js';
import { createLine } from '../engine/lines.js';
import { LabelLayer } from '../engine/labels.js';
import { SkyDome, galacticSkyRotation } from '../engine/sky.js';
import { makeCoronaTexture, makeGlowTexture, makeMoonTexture } from '../engine/procedural.js';
import { AU_KM, AU_M } from '../data/featured.js';

const DEG = Math.PI / 180;
const EARTH_RADIUS_AU = 6378.137 / AU_KM;
const SOLAR_RADIUS_AU = 696340 / AU_KM;

const starVertex = /* glsl */`
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const starFragment = /* glsl */`
  uniform vec3 uColor;
  uniform float uTime;
  uniform vec3 uCameraPos;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  float hash(vec3 p) { p = fract(p * 0.3183099 + vec3(1.1, 2.3, 3.7)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y), f.z);
  }
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vWorldPos);
    float mu = clamp(dot(N, V), 0.0, 1.0);
    vec3 p = normalize(vWorldPos) * 4.0;
    float n = noise(p * 5.0 + uTime * 0.004) * 0.55 + noise(p * 13.0) * 0.25;
    vec3 col = uColor * (0.8 + n * 0.7);
    col *= 0.48 + 0.52 * pow(mu, 0.5);
    gl_FragColor = vec4(col * 2.0, 1.0);
  }
`;

const planetVertex = /* glsl */`
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const planetFragment = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uSunDir;
  uniform vec3 uBase;
  uniform vec3 uCameraPos;
  uniform float uOpacity;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vWorldPos);
    float ndl = dot(N, uSunDir);
    float light = smoothstep(-0.1, 0.42, ndl);
    vec3 tex = texture2D(uMap, gl_FragCoord.xy * 0.0).rgb; // replaced by vertex uv below
    gl_FragColor = vec4(uBase * (0.06 + 0.94 * light), uOpacity);
  }
`;

// Simpler planet shader with UVs (kept separate for clarity).
const planetFragUV = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uSunDir;
  uniform vec3 uBase;
  uniform vec3 uCameraPos;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vWorldPos);
    float ndl = dot(N, uSunDir);
    float light = smoothstep(-0.08, 0.38, ndl);
    vec3 tex = texture2D(uMap, vUv).rgb;
    vec3 col = mix(uBase, tex * uBase * 1.9, 0.25) * (0.055 + 0.945 * light);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += uBase * rim * 0.16;
    gl_FragColor = vec4(col, 1.0);
  }
`;
const planetVertUV = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

function starColorForTemp(K) {
  if (!Number.isFinite(K)) return new THREE.Color(0xffd9a0);
  const t = Math.max(2000, Math.min(12000, K)) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255;
  }
  return new THREE.Color(Math.max(0, Math.min(255, r)) / 255, Math.max(0, Math.min(255, g)) / 255, Math.max(0, Math.min(255, b)) / 255);
}

function planetVisualColor(p) {
  const T = p.equilibriumTempK;
  if (!Number.isFinite(T)) return new THREE.Color(0x93a7b8);
  if (T > 1400) return new THREE.Color(0xd27c52);
  if (T > 800) return new THREE.Color(0xc09a71);
  if (T > 500) return new THREE.Color(0xb8a58c);
  if (T > 320) return new THREE.Color(0x8fb8b7);
  if (T > 200) return new THREE.Color(0x7fa9cc);
  return new THREE.Color(0x9abdd0);
}

function fmt(n, d = 2) {
  return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n) : '—';
}

export class ExoScene {
  constructor({ assets, canvas, labelsContainer, onSelect, onFocusChange, getSettings }) {
    this.assets = assets;
    this.canvas = canvas;
    this.labelsContainer = labelsContainer;
    this.onSelect = onSelect || (() => {});
    this.onFocusChange = onFocusChange || (() => {});
    this.getSettings = getSettings || (() => ({}));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.camera = new THREE.PerspectiveCamera(45, 1, 1e-8, 10);
    this.rig = new OrbitRig(this.camera, {
      distance: 1,
      minDistance: 1e-5,
      maxDistance: 60,
      yaw: 0.7,
      pitch: 0.48,
      damping: 7,
      zoomDamping: 8,
      near: 1e-8,
      far: 100,
      domElement: canvas,
      onPick: p => this.pick(p),
    });
    this.touch = new TouchEnhancer(this.rig, canvas);
    this.labels = new LabelLayer(labelsContainer, { className: 'labels-exo' });
    this.system = null;
    this.planets = [];
    this.selectedPlanet = null;
    this.time = 0;
    this.ready = false;
    this._lastW = 0;
    this._lastH = 0;
    this._starMesh = null;
  }

  async init(system, selectedPlanet = null) {
    this.system = system;
    this.selectedPlanet = selectedPlanet || system.planets[0] || null;
    this.sky = new SkyDome(
      this.assets.textures.get('assets/textures/milkyway_starmap_4k.jpg') || this._fallbackSky(),
      { rotation: galacticSkyRotation(), brightness: 0.24, opacity: 0.55 },
    );
    this.scene.add(this.sky.mesh);
    this._buildStar();
    this._buildPlanets();
    this._buildLabels();
    const initial = this.planets.find(r => r.data === this.selectedPlanet || r.data.name === this.selectedPlanet?.name) || this.planets[0] || null;
    this._setSelection(initial);
    this.ready = true;
    this.resetView(true);
    return this;
  }

  _fallbackSky() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, 512, 256);
    let s = 11;
    const r = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    for (let i = 0; i < 1000; i++) {
      ctx.fillStyle = `rgba(220,230,255,${Math.pow(r(), 3) * 0.7})`;
      ctx.fillRect(r() * 512, r() * 256, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _buildStar() {
    const sys = this.system;
    const maxOrbit = Math.max(0.01, ...sys.planets.map(p => Number.isFinite(p.smaAU) ? p.smaAU : 0));
    const minOrbit = Math.min(maxOrbit, ...sys.planets.filter(p => Number.isFinite(p.smaAU) && p.smaAU > 0).map(p => p.smaAU).concat([maxOrbit]));
    const physical = Number.isFinite(sys.radiusSun) ? sys.radiusSun * SOLAR_RADIUS_AU : SOLAR_RADIUS_AU;
    const visual = Math.max(0.0004, Math.min(physical * 28, minOrbit * 0.16));
    const color = starColorForTemp(sys.teffK);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uTime: { value: 0 }, uCameraPos: { value: new THREE.Vector3() } },
      vertexShader: starVertex,
      fragmentShader: starFragment,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
    mesh.scale.setScalar(visual);
    mesh.userData.exoStar = true;
    this.scene.add(mesh);
    this._starMesh = mesh;
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeCoronaTexture(), transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    corona.scale.setScalar(visual * 10);
    corona.material.color.copy(color);
    this.scene.add(corona);
    this.star = { name: sys.host, visualRadius: visual, color, mesh, corona, data: sys };
    this.raycastTargets = [mesh];
    this.orbitOuter = maxOrbit;
  }

  _buildPlanets() {
    const sys = this.system;
    const orbits = sys.planets.filter(p => Number.isFinite(p.smaAU) && p.smaAU > 0);
    this.orbitOuter = Math.max(this.orbitOuter, ...orbits.map(p => p.smaAU));
    this.planetRoot = new THREE.Group();
    this.scene.add(this.planetRoot);
    const sphereGeo = new THREE.SphereGeometry(1, 48, 24);
    for (const p of orbits) {
      const color = planetVisualColor(p);
      const map = makeMoonTexture({
        base: `#${color.getHexString()}`, accent: '#4b5966', seed: p.name.length * 37 + 3, mottle: 0.45,
      });
      const physical = (Number.isFinite(p.radiusEarth) ? p.radiusEarth * EARTH_RADIUS_AU : EARTH_RADIUS_AU);
      const visual = Math.max(this.orbitOuter * 0.004, Math.min(physical * 220, p.smaAU * 0.11));
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: map }, uSunDir: { value: new THREE.Vector3(1, 0, 0) },
          uBase: { value: color }, uCameraPos: { value: new THREE.Vector3() },
        },
        vertexShader: planetVertUV,
        fragmentShader: planetFragUV,
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.scale.setScalar(visual);
      mesh.userData.planetName = p.name;
      this.planetRoot.add(mesh);
      this.raycastTargets.push(mesh);
      const orbitGroup = new THREE.Group();
      this.planetRoot.add(orbitGroup);
      const pts = [];
      const e = Number.isFinite(p.eccentricity) ? Math.min(0.85, p.eccentricity) : 0;
      const inc = Number.isFinite(p.inclinationDeg) ? p.inclinationDeg * DEG : 0;
      const segments = 360;
      for (let i = 0; i <= segments; i++) {
        const th = i / segments * Math.PI * 2;
        const r = p.smaAU * (1 - e * e) / (1 + e * Math.cos(th));
        pts.push(new THREE.Vector3(Math.cos(th) * r, 0, Math.sin(th) * r));
      }
      const orbit = createLine(pts, {
        color: color.clone().multiplyScalar(0.8), opacity: 0.32, width: 2, blending: THREE.AdditiveBlending,
      });
      orbit.rotation.x = inc;
      orbitGroup.add(orbit);
      const record = {
        data: p, mesh, orbit, orbitGroup, visual,
        phase: (p.name.charCodeAt(0) * 0.73 + p.name.length) % (Math.PI * 2),
        map, material: mat,
      };
      this.planets.push(record);
    }
    // If there are no usable orbits, still show the star and a note in the inspector.
    this.resetView();
  }

  _buildLabels() {
    const items = [];
    items.push({
      id: 'host', name: this.system.host, sub: 'Host star · artist’s visualization', priority: 100,
      className: 'label-major label-star', color: '#' + this.star.color.getHexString(),
      getPosition: () => this.star.mesh.position,
      onClick: () => this._selectStar(),
      shouldShow: () => true,
    });
    for (const rec of this.planets) {
      items.push({
        id: 'planet-' + rec.data.name, name: rec.data.name.toUpperCase(),
        sub: `${fmt(rec.data.periodDays, 1)} d orbit`,
        priority: 60, className: 'label-exoplanet', color: '#' + planetVisualColor(rec.data).getHexString(),
        getPosition: () => rec.mesh.position,
        onClick: () => this._selectPlanet(rec),
        shouldShow: () => true,
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

  _selectStar() {
    this._setSelection(null);
    this.onSelect?.({ kind: 'system', id: this.system.host, system: this.system, data: this.system, viewing: true });
  }

  _selectPlanet(rec) {
    this.selectedPlanet = rec.data;
    this._setSelection(rec);
    this.onSelect?.({ kind: 'exoplanet', id: rec.data.name, data: rec.data, system: this.system, viewing: true });
  }

  _setSelection(rec) {
    this.selectedPlanet = rec?.data || this.selectedPlanet;
    for (const r of this.planets) {
      r.orbit.material.opacity = r === rec ? 0.9 : 0.24;
      r.orbit.material.color.set(r === rec ? 0x9edcff : planetVisualColor(r.data).multiplyScalar(0.7));
    }
    this.labels.setSelected(rec ? 'planet-' + rec.data.name : 'host');
  }

  focusPlanet(name) {
    const rec = this.planets.find(r => r.data.name === name);
    if (!rec) return;
    this._setSelection(rec);
    this.rig.setLimits(Math.max(1e-6, rec.visual * 1.4), Math.max(10, this.orbitOuter * 10));
    this.rig.focusOn(rec.mesh.position, Math.max(rec.visual * 9, 0.001), {
      duration: 1.4, yaw: this.rig.yaw, pitch: this.rig.pitch,
    });
    this._selectedPlanetRecord = rec;
    this.rig.follow = () => rec.mesh.position;
  }

  resetView(immediate = false) {
    this._selectedPlanetRecord = null;
    const outer = Math.max(0.02, this.orbitOuter || 1);
    this.rig.setLimits(outer * 0.01, outer * 20);
    this.rig.follow = null;
    this.rig.focusOn(new THREE.Vector3(0, 0, 0), Math.max(outer * 1.9, 0.01), {
      duration: immediate ? 0 : 1.3, yaw: 0.7, pitch: 0.48, immediate,
    });
  }

  activate() {
    this.rig.enabled = true;
    this.labels.setVisible(true);
    this.canvas.style.cursor = 'grab';
  }

  deactivate() {
    this.rig.enabled = false;
    this.labels.setVisible(false);
  }

  setLabelsVisible(v) { this.labels.setVisible(v); }
  setGridVisible(v) { /* orbital grid not applicable */ }
  setOrbitsVisible(v) { for (const p of this.planets) p.orbit.visible = v; }
  setCinematic(v) { this.rig.autoRotate = v; this.rig.autoRotateSpeed = 0.01; }

  pick({ x, y }) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((x - rect.left) / rect.width) * 2 - 1;
    const ny = -((y - rect.top) / rect.height) * 2 + 1;
    this._raycaster = this._raycaster || new THREE.Raycaster();
    this._raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hits = this._raycaster.intersectObjects(this.raycastTargets, false);
    if (hits[0]?.object.userData.exoStar) { this._selectStar(); return; }
    const pname = hits[0]?.object.userData.planetName;
    if (pname) {
      const rec = this.planets.find(r => r.data.name === pname);
      if (rec) this._selectPlanet(rec);
    }
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
    this.time += dt;
    const tSec = time ? time.date.getTime() / 1000 : performance.now() / 1000;
    this._starMesh.material.uniforms.uTime.value = this.time;
    this._starMesh.material.uniforms.uCameraPos.value.copy(this.camera.position);
    this.star.corona.scale.setScalar(this.star.visualRadius * (8 + 1.5 * Math.sin(this.time * 0.2)));
    this.star.corona.material.opacity = 0.75;
    this.sky.update(this.camera);
    for (const rec of this.planets) {
      const p = rec.data;
      const period = Number.isFinite(p.periodDays) && p.periodDays > 0 ? p.periodDays : 100;
      // Orbital phase is illustrative; no catalogue epoch is assumed.
      const phase = rec.phase + (tSec / (period * 86400)) * Math.PI * 2;
      const e = Number.isFinite(p.eccentricity) ? Math.min(0.85, p.eccentricity) : 0;
      const r = p.smaAU * (1 - e * e) / (1 + e * Math.cos(phase));
      const inc = Number.isFinite(p.inclinationDeg) ? p.inclinationDeg * DEG : 0;
      const x = Math.cos(phase) * r;
      const y0 = 0;
      const z = Math.sin(phase) * r;
      rec.mesh.position.set(x, y0 * Math.cos(inc) - z * Math.sin(inc) * 0, z * Math.cos(inc) + y0 * Math.sin(inc));
      // simpler: rotate the orbit plane by inclination around x
      const yy = y0 * Math.cos(inc) - z * Math.sin(inc);
      const zz = y0 * Math.sin(inc) + z * Math.cos(inc);
      rec.mesh.position.set(x, yy, zz);
      const recWorld = rec.mesh.position;
      rec.mesh.rotation.y = (tSec / (period * 86400)) * Math.PI * 2;
      const sunDir = new THREE.Vector3(-recWorld.x, -recWorld.y, -recWorld.z).normalize();
      rec.material.uniforms.uSunDir.value.copy(sunDir);
      rec.material.uniforms.uCameraPos.value.copy(this.camera.position);
    }
    this.rig.update(dt);
    const near = Math.max(1e-9, this.rig.distance * 1e-4);
    const far = Math.max(20, this.rig.distance * 50);
    if (this._lastNear !== near || this._lastFar !== far) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
      this._lastNear = near;
      this._lastFar = far;
    }
    this.labels.update(this.camera, w, h, performance.now());
  }

  getScaleReport() {
    const visibleHeight = 2 * this.rig.distance * Math.tan(this.camera.fov * DEG / 2) * AU_M;
    return { scaleMeters: visibleHeight, label: this.system.host + ' system' };
  }
}
