import * as THREE from 'three';
import { OrbitRig, TouchEnhancer } from '../engine/camera.js';
import { createLine } from '../engine/lines.js';
import { LabelLayer } from '../engine/labels.js';
import { SkyDome, eclipticSkyRotation } from '../engine/sky.js';
import {
  makeBeaconTexture, makeCoronaTexture, makeMoonTexture, makeSelectionTexture,
  makePlutoTexture, makeCeresTexture,
} from '../engine/procedural.js';
import {
  PLANETS, DWARF_PLANETS, MOONS, SUN, AU_KM, AU_M, SOURCES,
} from '../data/featured.js';
import {
  keplerPosition, sampleOrbit, eclipticToScene, moonOffsetKm, OBLIQUITY,
} from '../astronomy/ephemeris.js';

const DEG = Math.PI / 180;
const MOON_TEXTURE_SPECS = {
  io: { base: '#c8b258', accent: '#9b4b28', seed: 11, mottle: 0.85 },
  europa: { base: '#cfc7b8', accent: '#8b6c55', seed: 12, streaks: true, mottle: 0.6 },
  ganymede: { base: '#a79b8a', accent: '#6b6156', seed: 13, mottle: 0.7 },
  callisto: { base: '#786d61', accent: '#443d36', seed: 14, mottle: 0.75 },
  titan: { base: '#c69a5b', accent: '#7b5127', seed: 15, mottle: 0.35 },
  enceladus: { base: '#eef2f4', accent: '#a7c8d4', seed: 16, streaks: true, mottle: 0.4 },
  rhea: { base: '#c0c1bd', accent: '#8a8b86', seed: 17, mottle: 0.6 },
  iapetus: { base: '#9b948c', accent: '#4d4640', seed: 18, mottle: 0.85 },
  dione: { base: '#c9c7c1', accent: '#96968f', seed: 19, streaks: true, mottle: 0.55 },
  tethys: { base: '#d5d2ca', accent: '#a9a69e', seed: 20, mottle: 0.5 },
  titania: { base: '#b1a89f', accent: '#7d746b', seed: 21, mottle: 0.7 },
  oberon: { base: '#9b9289', accent: '#685f56', seed: 22, mottle: 0.8 },
  ariel: { base: '#c2bbb1', accent: '#918a80', seed: 23, mottle: 0.6 },
  umbriel: { base: '#7f7870', accent: '#55504a', seed: 24, mottle: 0.75 },
  miranda: { base: '#bbb7ad', accent: '#88847a', seed: 25, mottle: 0.7 },
  triton: { base: '#c3c2bb', accent: '#9c8b8e', seed: 26, mottle: 0.5 },
  proteus: { base: '#88847d', accent: '#57534d', seed: 27, mottle: 0.8 },
  nereid: { base: '#8b8881', accent: '#5a5752', seed: 28, mottle: 0.7 },
  charon: { base: '#a9a49d', accent: '#756f68', seed: 29, mottle: 0.6 },
  phobos: { base: '#7e766d', accent: '#4f4943', seed: 30, mottle: 0.8 },
  deimos: { base: '#8e857b', accent: '#5c554d', seed: 31, mottle: 0.7 },
};

const sphereLow = new THREE.SphereGeometry(1, 48, 24);
const sphereMed = new THREE.SphereGeometry(1, 96, 48);
const sphereHigh = new THREE.SphereGeometry(1, 144, 72);
let blankBlack = null;
function blackTexture() {
  if (blankBlack) return blankBlack;
  const c = document.createElement('canvas');
  c.width = 1; c.height = 1;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1, 1);
  blankBlack = new THREE.CanvasTexture(c);
  blankBlack.colorSpace = THREE.NoColorSpace;
  return blankBlack;
}

const planetVertex = /* glsl */`
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

const planetFragment = /* glsl */`
  uniform sampler2D uMap;
  uniform sampler2D uNight;
  uniform sampler2D uSpec;
  uniform sampler2D uNormal;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform vec3 uTint;
  uniform vec3 uRimColor;
  uniform float uHasNight;
  uniform float uHasSpec;
  uniform float uHasNormal;
  uniform float uAmbient;
  uniform float uLight;
  uniform float uRimStrength;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vWorldPos);

    if (uHasNormal > 0.5) {
      vec3 normMap = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
      vec3 q0 = dFdx(vWorldPos);
      vec3 q1 = dFdy(vWorldPos);
      vec2 st0 = dFdx(vUv);
      vec2 st1 = dFdy(vUv);
      vec3 S = normalize(q0 * st1.t - q1 * st0.t);
      vec3 T = normalize(-q0 * st1.s + q1 * st0.s);
      vec3 N_surf = normalize(cross(q0, q1));
      mat3 tbn = mat3(S, T, N_surf);
      N = normalize(tbn * normMap);
    }

    float geomNdl = dot(normalize(vNormalW), uSunDir);
    float ndl = dot(N, uSunDir);
    float light = smoothstep(-0.06, 0.26, ndl);
    vec3 base = texture2D(uMap, vUv).rgb * uTint;

    // Rich atmospheric twilight warming along the day/night terminator line
    float terminator = smoothstep(0.18, 0.0, abs(geomNdl)) * smoothstep(-0.06, 0.28, geomNdl);
    vec3 sunsetColor = vec3(1.08, 0.44, 0.16);
    base = mix(base, base * sunsetColor * 1.55, terminator * 0.45);

    vec3 col = base * (uAmbient + uLight * light);

    if (uHasNight > 0.5) {
      float nightMask = smoothstep(0.10, -0.22, geomNdl);
      vec3 lights = texture2D(uNight, vUv).rgb * vec3(1.0, 0.82, 0.54) * 3.8;
      col += lights * nightMask;
    }

    if (uHasSpec > 0.5) {
      vec3 H = normalize(uSunDir + V);
      float specDot = max(dot(N, H), 0.0);
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 5.0);
      float spec = (pow(specDot, 120.0) + fresnel * pow(specDot, 28.0) * 0.35) * texture2D(uSpec, vUv).r;
      col += vec3(0.72, 0.86, 1.0) * spec * smoothstep(0.0, 0.28, ndl) * 0.3;
    }

    // Atmospheric Rayleigh scattering rim
    float rim = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 3.0);
    float rimLit = smoothstep(-0.25, 0.45, geomNdl);
    col += uRimColor * rim * (0.035 + 0.9 * rimLit) * uRimStrength;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ringVertex = /* glsl */`
  varying float vRadial;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  uniform vec3 uCameraPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vRadial = length(position.xy);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const ringFragment = /* glsl */`
  uniform float uInner;
  uniform float uInnerRatio;
  uniform float uPlanetRadius;
  uniform vec3 uPlanetPos;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform sampler2D uRingMap;
  uniform float uHasRingMap;
  varying float vRadial;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;

  void main() {
    float t = clamp((vRadial - uInnerRatio) / (1.0 - uInnerRatio), 0.0, 1.0);

    vec3 col = vec3(0.85, 0.78, 0.66);
    float alpha = 0.5;

    if (uHasRingMap > 0.5) {
      vec4 samp = texture2D(uRingMap, vec2(t, 0.5));
      alpha = samp.a * 0.94;
      col = samp.rgb * 1.18;
    } else {
      float bands = 0.55
        + 0.13 * sin(t * 91.0)
        + 0.08 * sin(t * 173.0 + 1.3)
        + 0.05 * sin(t * 311.0 + 0.7)
        + 0.035 * sin(t * 701.0 + 2.1)
        + 0.025 * sin(t * 1441.0 + 0.4);
      bands = clamp(bands, 0.0, 1.0);
      alpha = bands * 0.38;
      alpha *= 1.0 - 0.88 * smoothstep(0.50, 0.545, t) * smoothstep(0.61, 0.57, t);
      alpha *= 1.0 - 0.55 * smoothstep(0.88, 0.895, t) * smoothstep(0.92, 0.905, t);
      col = mix(vec3(0.28, 0.245, 0.19), vec3(0.82, 0.74, 0.60), bands);
    }

    alpha *= smoothstep(0.0, 0.02, t) * smoothstep(1.0, 0.98, t);
    if (alpha < 0.015) discard;

    // Planet sphere cast shadow across the rings with soft penumbra
    vec3 rel = vWorldPos - uPlanetPos;
    float along = dot(rel, -uSunDir);
    vec3 closest = rel + uSunDir * along;
    float shadowDist = length(closest);
    float shadow = 1.0 - smoothstep(uPlanetRadius * 0.92, uPlanetRadius * 1.06, shadowDist);
    shadow *= step(0.0, along);
    col *= 1.0 - shadow * 0.85;

    // Optical illumination with back-scattering and front lighting
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vWorldPos);
    float sunFacing = abs(dot(N, uSunDir));
    float phase = max(0.0, dot(normalize(rel), -uSunDir));
    float illumination = 0.42 + 0.58 * sunFacing + 0.28 * pow(phase, 4.0);

    gl_FragColor = vec4(col * illumination * 1.08, alpha * (1.0 - shadow * 0.58));
  }
`;

const sunVertex = /* glsl */`
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

const sunFragment = /* glsl */`
  uniform sampler2D uSunMap;
  uniform float uTime;
  uniform vec3 uCameraPos;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec3(11.7, 3.1, 7.9);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vWorldPos);
    float mu = clamp(dot(N, V), 0.0, 1.0);

    // Dynamic solar photosphere granulation
    vec2 sunUv = vUv + vec2(uTime * 0.002, 0.0);
    vec3 texCol = texture2D(uSunMap, sunUv).rgb;

    vec3 p = normalize(vWorldPos) * 3.4;
    float grain = fbm(p * 6.5 + vec3(0.0, 0.0, uTime * 0.01));
    float fine = fbm(p * 22.0 + vec3(uTime * 0.006, 0.0, 0.0));
    float spots = smoothstep(0.60, 0.84, fbm(p * 2.5 + vec3(4.0)));

    vec3 warmPlasma = mix(texCol * 1.3, vec3(1.0, 0.96, 0.82), fine * 0.35 + grain * 0.25);
    warmPlasma *= 1.0 - spots * 0.4;

    // Physical solar limb darkening
    float limb = pow(mu, 0.58) * 0.65 + 0.35;
    vec3 color = warmPlasma * limb * 2.45;

    // Chromospheric flare activity along the limb
    float flare = smoothstep(0.72, 0.96, grain * fine);
    color += vec3(1.0, 0.95, 0.8) * flare * 1.6;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function makePlanetMaterial(map, { night = null, spec = null, normal = null, tint = 0xffffff, rimColor = 0x6f9fd8, rimStrength = 1.0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uNight: { value: night || blackTexture() },
      uSpec: { value: spec || blackTexture() },
      uNormal: { value: normal || blackTexture() },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uCameraPos: { value: new THREE.Vector3() },
      uTint: { value: new THREE.Color(tint) },
      uRimColor: { value: new THREE.Color(rimColor) },
      uHasNight: { value: night ? 1 : 0 },
      uHasSpec: { value: spec ? 1 : 0 },
      uHasNormal: { value: normal ? 1 : 0 },
      uAmbient: { value: 0.045 },
      uLight: { value: 0.95 },
      uRimStrength: { value: rimStrength },
    },
    vertexShader: planetVertex,
    fragmentShader: planetFragment,
  });
}

function makeRingMaterial(planet, innerRatio, ringTex = null) {
  const outerAU = planet.visualRadiusAU * (planet.ring.outerKm / planet.radiusKm);
  const innerAU = planet.visualRadiusAU * (planet.ring.innerKm / planet.radiusKm);
  const geo = new THREE.RingGeometry(innerRatio, 1, 512, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uInner: { value: innerAU },
      uInnerRatio: { value: innerRatio },
      uPlanetRadius: { value: planet.visualRadiusAU },
      uPlanetPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uCameraPos: { value: new THREE.Vector3() },
      uRingMap: { value: ringTex || blackTexture() },
      uHasRingMap: { value: ringTex ? 1 : 0 },
    },
    vertexShader: ringVertex,
    fragmentShader: ringFragment,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.setScalar(outerAU);
  mesh.userData.ring = true;
  return { mesh, mat, outerAU, innerAU };
}

export class SolarScene {
  constructor({
    assets, canvas, labelsContainer, onSelect, onFocusChange, onHover, getSettings,
  }) {
    this.assets = assets;
    this.canvas = canvas;
    this.labelsContainer = labelsContainer;
    this.onSelect = onSelect || (() => {});
    this.onFocusChange = onFocusChange || (() => {});
    this.onHover = onHover || (() => {});
    this.getSettings = getSettings || (() => ({}));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050a);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.000001, 5000);
    this.rig = new OrbitRig(this.camera, {
      distance: 22,
      minDistance: 0.00002,
      maxDistance: 220,
      yaw: 0.72,
      pitch: 0.85,
      damping: 7,
      zoomDamping: 8,
      rotateSpeed: 1,
      zoomSpeed: 0.9,
      near: 0.00001,
      far: 5000,
      domElement: canvas,
      onPick: p => this.pick(p),
      onHover: p => this.hover(p),
    });
    this.rig.onDoubleClick = p => this.doubleClick(p);
    this.touch = new TouchEnhancer(this.rig, canvas);
    this.labels = new LabelLayer(labelsContainer, { className: 'labels-solar' });
    this.bodies = new Map();
    this.planetBodies = [];
    this.moonBodies = [];
    this.selectedId = null;
    this.focusId = 'sun';
    this.scaleMode = 'true';
    this.orbitsVisible = true;
    this.gridVisible = false;
    this.time = 0;
    this._lastDate = null;
    this._lastNear = 0;
    this._lastFar = 0;
    this._labelsBuilt = false;
    this.ready = false;
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._world = new THREE.Vector3();
    this.raycastTargets = [];
    this.tmp = new THREE.Vector3();
  }

  async init() {
    const tex = async (name, opts) => {
      try { return await this.assets.texture(`assets/textures/${name}`, opts); }
      catch (e) { console.warn('solar texture missing', name); return this._fallbackTexture(); }
    };
    const [
      mercury, venus, mars, jupiter, saturn, saturnRing, uranus, neptune, moon,
      earthDay, earthNight, earthSpec, earthNormal, earthClouds, sunTex,
    ] = await Promise.all([
      tex('2k_mercury.jpg'), tex('2k_venus_atmosphere.jpg'), tex('mars_4k.jpg'),
      tex('jupiter_4k.jpg'), tex('saturn_4k.jpg'), tex('2k_saturn_ring_alpha.png', { srgb: false }),
      tex('2k_uranus.jpg'), tex('2k_neptune.jpg'),
      tex('2k_moon.jpg'), tex('earth_day_4k.jpg'), tex('earth_night_2k.jpg'),
      tex('earth_specular_2048.jpg', { srgb: false }), tex('earth_normal_2048.jpg', { srgb: false }),
      tex('earth_clouds_2k.jpg', { srgb: false }), tex('2k_sun.jpg'),
    ]);
    this.textures = {
      mercury, venus, mars, jupiter, saturn, saturnRing, uranus, neptune, moon,
      earthDay, earthNight, earthSpec, earthNormal, earthClouds, sun: sunTex,
    };
    this.skyTex = this.assets.textures.get('assets/textures/nasa_starmap_2020_4k_bright.jpg') || null;
    if (!this.skyTex) {
      try { this.skyTex = await this.assets.texture('assets/textures/nasa_starmap_2020_4k_bright.jpg'); } catch (e) { this.skyTex = this._fallbackSkyTexture(); }
    }
    this.sky = new SkyDome(this.skyTex, {
      rotation: eclipticSkyRotation(OBLIQUITY),
      brightness: 1.0,
      opacity: 0.85,
    });
    this.scene.add(this.sky.mesh);

    this.sun = this._createSun();
    this._createPlanets();
    this._createMoons();
    this._createOrbits();
    this._createBelts();
    this._createGrid();
    this._createSelectionRing();
    this._buildLabels();
    this.ready = true;
    this.resetView(true);
    return this;
  }

  _fallbackTexture() {
    if (!this._fbTex) {
      const c = document.createElement('canvas');
      c.width = 8; c.height = 8;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#5d5a55'; ctx.fillRect(0, 0, 8, 8);
      ctx.fillStyle = '#716d66'; ctx.fillRect(1, 2, 3, 2);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      this._fbTex = t;
    }
    return this._fbTex;
  }

  _fallbackSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#020306'; ctx.fillRect(0, 0, 1024, 512);
    let s = 7;
    const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    for (let i = 0; i < 3000; i++) {
      const x = rnd() * 1024, y = rnd() * 512;
      const b = Math.pow(rnd(), 3) * 0.7 + 0.03;
      ctx.fillStyle = `rgba(220,228,255,${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _createSun() {
    const visualFactor = this.scaleMode === 'educational' ? 8 : 1;
    const radiusAU = (SUN.radiusKm / AU_KM) * visualFactor;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCameraPos: { value: new THREE.Vector3() },
        uSunMap: { value: this.textures.sun || this._fallbackTexture() },
      },
      vertexShader: sunVertex,
      fragmentShader: sunFragment,
    });
    const mesh = new THREE.Mesh(sphereHigh, mat);
    mesh.scale.setScalar(radiusAU);
    this.scene.add(mesh);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeCoronaTexture(),
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    }));
    corona.renderOrder = 2;
    this.scene.add(corona);
    const body = {
      id: 'sun', name: 'Sun', kind: 'sun', data: SUN,
      group: mesh, mesh, material: mat, visualRadiusAU: radiusAU,
      physicalRadiusAU: SUN.radiusKm / AU_KM, corona,
      priority: 100, color: '#ffd9a0',
    };
    this.bodies.set('sun', body);
    this.raycastTargets.push(mesh);
    mesh.userData.bodyId = 'sun';
    corona.userData.bodyId = 'sun';
    this._sunCorona = corona;
    return body;
  }

  _planetTexture(p) {
    const t = this.textures;
    switch (p.id) {
      case 'earth': return t.earthDay;
      case 'mercury': return t.mercury;
      case 'venus': return t.venus;
      case 'mars': return t.mars;
      case 'jupiter': return t.jupiter;
      case 'saturn': return t.saturn;
      case 'uranus': return t.uranus;
      case 'neptune': return t.neptune;
      case 'pluto': return makePlutoTexture();
      case 'ceres': return makeCeresTexture();
      default: return this._fallbackTexture();
    }
  }

  _createPlanets() {
    for (const p of [...PLANETS, ...DWARF_PLANETS]) {
      const visualFactor = this.scaleMode === 'educational' ? 30 : 1;
      const physicalRadiusAU = p.radiusKm / AU_KM;
      const radiusAU = physicalRadiusAU * visualFactor;
      const map = this._planetTexture(p);
      const isEarth = p.id === 'earth';
      const mat = makePlanetMaterial(map, {
        night: isEarth ? this.textures.earthNight : null,
        spec: isEarth ? this.textures.earthSpec : null,
        normal: isEarth ? this.textures.earthNormal : null,
        tint: p.id === 'venus' ? 0xfff0db : 0xffffff,
        rimColor: p.id === 'earth' ? 0x5fa8f5 : p.id === 'venus' ? 0xf0d6a0 : p.id === 'mars' ? 0xdf8464 : p.id === 'uranus' ? 0x9be8ec : p.id === 'neptune' ? 0x4f7be8 : 0xd2c0a0,
        rimStrength: p.id === 'earth' ? 1.4 : p.id === 'venus' ? 1.8 : p.id === 'uranus' || p.id === 'neptune' ? 1.2 : 0.35,
      });
      const anchor = new THREE.Group();
      this.scene.add(anchor);
      const tilt = new THREE.Group();
      tilt.rotation.z = (p.axialTiltDeg || 0) * DEG;
      anchor.add(tilt);
      const mesh = new THREE.Mesh(isEarth || radiusAU > 0.00008 ? sphereMed : sphereLow, mat);
      mesh.scale.setScalar(radiusAU);
      mesh.userData.bodyId = p.id;
      tilt.add(mesh);
      const body = {
        id: p.id, name: p.name, kind: p.kind, data: p, parent: 'sun',
        group: anchor, tilt, mesh, material: mat, visualRadiusAU: radiusAU,
        physicalRadiusAU, visualFactor, color: p.color,
        orbit: p.orbit, priority: p.id === 'earth' ? 95 : p.id === 'jupiter' || p.id === 'saturn' ? 90 : 70,
        spinPhase: (p.id.length * 1.7) % (Math.PI * 2),
        ring: null, clouds: null,
      };
      // Saturn's ring plane.
      if (p.ring) {
        const innerRatio = p.ring.innerKm / p.ring.outerKm;
        const ring = makeRingMaterial(
          { ...p, visualRadiusAU: radiusAU },
          innerRatio,
          this.textures.saturnRing,
        );
        ring.mat.uniforms.uSunDir.value = new THREE.Vector3(1, 0, 0);
        tilt.add(ring.mesh);
        body.ring = ring;
        ring.mesh.userData.ringOf = p.id;
      }
      // Earth gets a thin cloud shell, lit only by day.
      if (isEarth && this.textures.earthClouds) {
        const cloudMat = new THREE.ShaderMaterial({
          uniforms: {
            uMap: { value: this.textures.earthClouds },
            uSunDir: { value: new THREE.Vector3(1, 0, 0) },
          },
          vertexShader: planetVertex,
          fragmentShader: `
            uniform sampler2D uMap;
            uniform vec3 uSunDir;
            varying vec2 vUv;
            varying vec3 vNormalW;
            varying vec3 vWorldPos;
            void main() {
              float c = texture2D(uMap, vUv).r;
              float a = smoothstep(0.12, 0.8, c) * 0.75;
              float lit = smoothstep(-0.24, 0.3, dot(normalize(vNormalW), uSunDir));
              gl_FragColor = vec4(mix(vec3(0.1,0.13,0.18), vec3(1.0,0.99,0.97), lit), a);
            }
          `,
          transparent: true,
          depthWrite: false,
        });
        const clouds = new THREE.Mesh(sphereMed, cloudMat);
        clouds.scale.setScalar(radiusAU * 1.008);
        tilt.add(clouds);
        body.clouds = clouds;
      }
      // A faint atmosphere shell for Earth and Venus.
      if (isEarth || p.id === 'venus') {
        const atmosphereMat = new THREE.ShaderMaterial({
          uniforms: {
            uSunDir: { value: new THREE.Vector3(1, 0, 0) },
            uCameraPos: { value: new THREE.Vector3() },
            uColor: { value: new THREE.Color(isEarth ? 0x6cb8ff : 0xe7c68e) },
          },
          vertexShader: planetVertex,
          fragmentShader: `
            uniform vec3 uSunDir;
            uniform vec3 uCameraPos;
            uniform vec3 uColor;
            varying vec2 vUv;
            varying vec3 vNormalW;
            varying vec3 vWorldPos;
            void main() {
              vec3 N = normalize(vNormalW);
              vec3 V = normalize(uCameraPos - vWorldPos);
              float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
              float light = smoothstep(-0.3, 0.55, dot(N, uSunDir));
              float a = rim * (0.12 + 0.9 * light) * 0.55;
              gl_FragColor = vec4(uColor * a * 1.6, a);
            }
          `,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const atmo = new THREE.Mesh(sphereMed, atmosphereMat);
        atmo.scale.setScalar(radiusAU * (isEarth ? 1.028 : 1.045));
        tilt.add(atmo);
        body.atmosphere = atmo;
      }
      const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._beaconTexture(),
        color: new THREE.Color(p.color),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      }));
      beacon.userData.bodyId = p.id;
      beacon.userData.beacon = true;
      this.scene.add(beacon);
      body.beacon = beacon;

      this.bodies.set(p.id, body);
      this.planetBodies.push(body);
      this.raycastTargets.push(mesh);
      if (beacon) this.raycastTargets.push(beacon);
    }
  }

  _beaconTexture() {
    if (!this._beaconTex) this._beaconTex = makeBeaconTexture('#dfeeff');
    return this._beaconTex;
  }

  _createMoons() {
    for (const m of MOONS) {
      const parent = this.bodies.get(m.parent);
      if (!parent) continue;
      const spec = MOON_TEXTURE_SPECS[m.id];
      let map;
      if (m.id === 'moon') map = this.textures.moon;
      else map = makeMoonTexture(spec || { base: '#9a9287', accent: '#675f56', seed: 40 });
      const tint = m.id === 'io' ? 0xe6d17e : m.id === 'europa' ? 0xd8d2c7 : m.id === 'titan' ? 0xd0a563 : m.id === 'triton' ? 0xcfc4c2 : 0xffffff;
      const mat = makePlanetMaterial(map, {
        tint,
        rimColor: 0x6c7c8f,
        rimStrength: 0.25,
      });
      const mesh = new THREE.Mesh(sphereLow, mat);
      const visualFactor = this.scaleMode === 'educational' ? 30 : 1;
      const radiusAU = (m.radiusKm / AU_KM) * visualFactor;
      mesh.scale.setScalar(radiusAU);
      mesh.userData.bodyId = m.id;
      this.scene.add(mesh);
      const body = {
        id: m.id, name: m.name, kind: 'moon', data: m, parent: m.parent,
        group: mesh, mesh, material: mat,
        visualRadiusAU: radiusAU, physicalRadiusAU: m.radiusKm / AU_KM,
        visualFactor, color: m.color, priority: 30,
      };
      this.bodies.set(m.id, body);
      this.moonBodies.push(body);
      this.raycastTargets.push(mesh);
    }
    // A marker for the Moon so it can be found at close range; no beacons for all moons.
  }

  _createOrbits() {
    this.orbitGroup = new THREE.Group();
    this.scene.add(this.orbitGroup);
    this.orbitLines = new Map();
    const date = new Date();
    for (const p of [...PLANETS, ...DWARF_PLANETS]) {
      const el = p.orbit;
      if (!el) continue;
      const samples = sampleOrbit(el, date, 420);
      const points = samples.map(s => {
        const v = eclipticToScene(s);
        return new THREE.Vector3(v.x, v.y, v.z);
      });
      const line = createLine(points, {
        color: new THREE.Color(p.color).multiplyScalar(0.75),
        opacity: p.id === 'earth' ? 0.55 : 0.38,
        width: 2,
        loop: true,
        blending: THREE.AdditiveBlending,
      });
      line.userData.bodyId = p.id;
      this.orbitGroup.add(line);
      this.orbitLines.set(p.id, line);
    }
    this.orbitGroup.visible = true;
  }

  _createBelts() {
    const generate = (count, aMin, aMax, thick, palette) => {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      let s = 991;
      const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
      for (let i = 0; i < count; i++) {
        const a = aMin + Math.pow(rnd(), 0.72) * (aMax - aMin);
        const ecc = rnd() * 0.12;
        const ang = rnd() * Math.PI * 2;
        const r = a * (1 - ecc * ecc) / (1 + ecc * Math.cos(ang));
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        const y = (rnd() - 0.5) * thick * (0.3 + rnd());
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        const c = palette[Math.floor(rnd() * palette.length)];
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.8,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(geo, mat);
      this.scene.add(pts);
      return pts;
    };
    this.asteroidBelt = generate(4200, 2.08, 3.3, 0.34, [
      [0.44, 0.4, 0.35], [0.58, 0.5, 0.41], [0.33, 0.31, 0.29], [0.7, 0.55, 0.4],
    ]);
    this.kuiperBelt = generate(6000, 30, 49, 4.0, [
      [0.28, 0.38, 0.5], [0.4, 0.46, 0.55], [0.24, 0.3, 0.42],
    ]);
    this.kuiperBelt.material.opacity = 0.1;
  }

  _createGrid() {
    this.gridGroup = new THREE.Group();
    this.gridGroup.visible = false;
    this.scene.add(this.gridGroup);
    const radii = [1, 5, 10, 20, 30, 40];
    for (const r of radii) {
      const pts = [];
      for (let i = 0; i <= 256; i++) {
        const a = (i / 256) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const line = createLine(pts, {
        color: 0x87b6e8, opacity: r === 1 ? 0.12 : 0.06, width: 1.5, blending: THREE.AdditiveBlending,
      });
      this.gridGroup.add(line);
    }
    // radial spokes
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 40, 0, Math.sin(a) * 40)];
      const line = createLine(pts, { color: 0x87b6e8, opacity: 0.035, width: 1.25 });
      this.gridGroup.add(line);
    }
    this.gridGroup.add(new THREE.AxesHelper(0)); // no-op keeps group valid
  }

  _createSelectionRing() {
    this.selectionSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeSelectionTexture('#9ed8ff'),
      color: new THREE.Color(0x82c8f5),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    }));
    this.selectionSprite.visible = false;
    this.scene.add(this.selectionSprite);
  }

  _buildLabels() {
    const items = [{
      id: 'sun', name: 'SUN', sub: 'G2V star', priority: 110,
      className: 'label-major label-body', color: '#ffd9a0',
      getPosition: () => this.bodies.get('sun').mesh.position,
      onClick: () => this.selectBody('sun'),
      shouldShow: () => true,
    }];
    for (const p of [...PLANETS, ...DWARF_PLANETS]) {
      items.push({
        id: p.id, name: p.name.toUpperCase(), sub: p.type, priority: p.id === 'earth' ? 100 : 70,
        className: 'label-body', color: p.color,
        getPosition: () => this.bodies.get(p.id).group.position,
        onClick: () => this.selectBody(p.id),
        shouldShow: () => {
          const b = this.bodies.get(p.id);
          if (!b) return false;
          const d = this.camera.position.distanceTo(b.group.position);
          return d > b.visualRadiusAU * 22;
        },
      });
    }
    for (const m of MOONS) {
      const parent = this.bodies.get(m.parent);
      items.push({
        id: m.id, name: m.name.toUpperCase(), sub: `Moon of ${parent?.name || ''}`,
        priority: 26, className: 'label-moon', color: m.color,
        getPosition: () => this.bodies.get(m.id)?.group.position || new THREE.Vector3(),
        onClick: () => this.selectBody(m.id),
        shouldShow: () => {
          const b = this.bodies.get(m.id);
          const p = this.bodies.get(m.parent);
          if (!b || !p) return false;
          const d = this.camera.position.distanceTo(p.group.position);
          const reach = Math.max(p.visualRadiusAU * 90, (m.semiMajorKm / AU_KM) * 6);
          return d < reach;
        },
      });
    }
    // Belt labels make the illustrative nature explicit.
    items.push({
      id: 'belt-label', name: 'ASTEROID BELT', sub: 'illustrative distribution', priority: 18,
      className: 'label-model', color: '#a99e8d',
      getPosition: () => new THREE.Vector3(2.65, 0, 0),
      onClick: () => {},
      shouldShow: () => this.rig.distance > 2.2,
    });
    items.push({
      id: 'kuiper-label', name: 'KUIPER BELT', sub: 'illustrative distribution', priority: 14,
      className: 'label-model', color: '#7e9ab5',
      getPosition: () => new THREE.Vector3(0, 0, 40),
      onClick: () => {},
      shouldShow: () => this.rig.distance > 22,
    });
    this.labels.setItems(items);
    this._labelsBuilt = true;
    for (const item of this.labels.items) {
      if (item.color) {
        const dot = item.el.querySelector('.sky-label-dot');
        if (dot) dot.style.background = item.color;
      }
    }
  }

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

  resetView(immediate = false) {
    const sun = this.bodies.get('sun');
    this.rig.setLimits(Math.max(0.000006, sun.visualRadiusAU * 1.25), 220);
    this.rig.follow = null;
    this.focusId = 'sun';
    this.rig.focusOn(new THREE.Vector3(0, 0, 0), 22, {
      duration: immediate ? 0 : 1.6,
      yaw: 0.72, pitch: 0.85, immediate,
    });
    this._setSelected(null);
  }

  setScaleMode(mode) {
    if (mode !== 'true' && mode !== 'educational') return;
    this.scaleMode = mode;
    const factor = mode === 'educational' ? 30 : 1;
    const sunFactor = mode === 'educational' ? 8 : 1;
    for (const b of this.planetBodies) {
      b.visualFactor = factor;
      b.visualRadiusAU = b.physicalRadiusAU * factor;
      b.mesh.scale.setScalar(b.visualRadiusAU);
      if (b.ring) {
        const p = b.data;
        const outerAU = b.visualRadiusAU * (p.ring.outerKm / p.radiusKm);
        b.ring.mesh.scale.setScalar(outerAU);
        b.ring.mat.uniforms.uPlanetRadius.value = b.visualRadiusAU;
      }
      if (b.clouds) b.clouds.scale.setScalar(b.visualRadiusAU * 1.008);
      if (b.atmosphere) b.atmosphere.scale.setScalar(b.visualRadiusAU * (b.id === 'earth' ? 1.028 : 1.045));
    }
    for (const b of this.moonBodies) {
      b.visualFactor = factor;
      b.visualRadiusAU = b.physicalRadiusAU * factor;
      b.mesh.scale.setScalar(b.visualRadiusAU);
    }
    const sun = this.bodies.get('sun');
    sun.visualRadiusAU = sun.physicalRadiusAU * sunFactor;
    sun.mesh.scale.setScalar(sun.visualRadiusAU);
    if (this.focusId) this._applyFocusLimits(this.focusId);
    if (this.rig.distance < 0.01) this._applyFocusDistance(this.focusId, false);
    this.onFocusChange?.(this.focusId, this.bodies.get(this.focusId)?.data || null);
  }

  setOrbitsVisible(v) {
    this.orbitsVisible = v;
    this.orbitGroup.visible = v;
  }

  setGridVisible(v) {
    this.gridVisible = v;
    this.gridGroup.visible = v;
  }

  setLabelsVisible(v) { this.labels.setVisible(v); }

  setCinematic(v) {
    this.rig.autoRotate = v;
    this.rig.autoRotateSpeed = 0.012;
  }

  setFollow(id) {
    const body = this.bodies.get(id);
    if (!body) return false;
    this.rig.follow = () => body.group.position;
    return true;
  }

  getObjectPosition(id) {
    return this.bodies.get(id)?.group.position || null;
  }

  _applyFocusLimits(id) {
    const b = this.bodies.get(id);
    if (!b) return;
    const min = Math.max(b.visualRadiusAU * 1.25, 1e-8);
    this.rig.setLimits(min, 220);
  }

  _focusAngles(body) {
    if (!body || body.id === 'sun') return { yaw: 0.68, pitch: 0.53 };
    const pos = body.group.position;
    const sunDir = pos.clone().negate().normalize();
    let north = new THREE.Vector3(0, 1, 0);
    if (body.tilt) {
      const q = new THREE.Quaternion();
      body.tilt.getWorldQuaternion(q);
      north = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    }
    let tangent = new THREE.Vector3().crossVectors(north, sunDir);
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
    tangent.normalize();
    // Lower the camera's latitude for Saturn so the rings read as a tilted system
    // rather than a bullseye from directly above the pole.
    const northWeight = body.id === 'saturn' ? 0.18 : 0.48;
    const view = sunDir.clone().multiplyScalar(0.86)
      .add(north.clone().multiplyScalar(northWeight))
      .add(tangent.clone().multiplyScalar(0.16))
      .normalize();
    const yaw = Math.atan2(view.x, view.z);
    const pitch = Math.max(-1.1, Math.min(1.1, Math.asin(view.y)));
    return { yaw, pitch };
  }

  _applyFocusDistance(id, animate = true) {
    const b = this.bodies.get(id);
    if (!b) return;
    const frame = id === 'saturn' ? 8.8 : id === 'jupiter' ? 7.0 : id === 'uranus' ? 7.5 : id === 'sun' ? 8 : 6.0;
    const d = b.visualRadiusAU * frame;
    const dist = Math.max(d, b.visualRadiusAU + 1e-7);
    const { yaw, pitch } = this._focusAngles(b);
    this.rig.focusOn(b.group.position, dist, {
      duration: animate ? 1.8 : 0,
      yaw,
      pitch,
    });
    this.rig.follow = () => b.group.position;
  }

  focusObject(id, opts = {}) {
    const b = this.bodies.get(id);
    if (!b) return;
    this.focusId = id;
    this._applyFocusLimits(id);
    if (id === 'sun') {
      this.rig.follow = null;
      this.rig.focusOn(new THREE.Vector3(0, 0, 0), opts.distance || 22, {
        duration: opts.immediate ? 0 : 1.7, yaw: 0.72, pitch: 0.85,
      });
    } else {
      this._applyFocusDistance(id, !opts.immediate);
      if (opts.follow === false) this.rig.follow = null;
    }
    this._setSelected(id);
    this.onFocusChange?.(id, b.data);
  }

  selectBody(id) {
    const b = this.bodies.get(id);
    if (!b) return;
    this._setSelected(id);
    this.onSelect?.({
      kind: id === 'sun' ? 'sun' : b.kind,
      id,
      data: b.data,
      body: b,
    });
  }

  _setSelected(id) {
    this.selectedId = id;
    this.labels.setSelected(id);
    const b = id ? this.bodies.get(id) : null;
    this.selectionSprite.visible = !!b;
  }

  pick({ x, y }) {
    const rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const targets = [];
    for (const b of this.planetBodies) {
      targets.push(b.mesh, b.beacon);
      if (b.ring) targets.push(b.ring.mesh);
    }
    for (const b of this.moonBodies) targets.push(b.mesh);
    targets.push(this.sun.mesh, this._sunCorona);
    const hits = this._raycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      if (hit.object.userData.beacon) {
        this.selectBody(hit.object.userData.bodyId);
        return;
      }
      if (hit.object.userData.ringOf) {
        this.selectBody(hit.object.userData.ringOf);
        return;
      }
      if (hit.object.userData.bodyId) {
        this.selectBody(hit.object.userData.bodyId);
        return;
      }
    }
    this.onSelect?.(null);
  }

  doubleClick({ x, y }) {
    const rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const targets = [];
    for (const b of this.planetBodies) targets.push(b.mesh, b.beacon);
    for (const b of this.moonBodies) targets.push(b.mesh);
    targets.push(this.sun.mesh, this._sunCorona);
    const hits = this._raycaster.intersectObjects(targets, false);
    if (hits[0]?.object.userData.bodyId) {
      this.selectBody(hits[0].object.userData.bodyId);
      this.focusObject(hits[0].object.userData.bodyId);
    }
  }

  hover(p) {
    // Keep cursor affordances light; actual raycasting is only on click.
    this.canvas.style.cursor = 'grab';
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
    const date = time.date;
    const t = date.getTime() / 1000;
    const sun = this.bodies.get('sun');
    sun.mesh.position.set(0, 0, 0);
    sun.material.uniforms.uTime.value = t;
    sun.material.uniforms.uCameraPos.value.copy(this.camera.position);
    this.sky.update(this.camera);

    // Sun corona stays visible at system scale but follows physical size close up.
    const sunDist = this.camera.position.length();
    const worldPerPixel = 2 * Math.tan(this.camera.fov * DEG / 2) * sunDist / Math.max(1, h);
    const coronaScale = Math.max(sun.visualRadiusAU * 8, worldPerPixel * 28);
    sun.corona.scale.setScalar(coronaScale);
    sun.corona.material.opacity = 0.95;

    const moonOrbitFactor = this.scaleMode === 'educational' ? 30 : 1;
    for (const b of this.planetBodies) {
      const p = b.data;
      const pos = keplerPosition(b.orbit, date);
      const v = eclipticToScene(pos);
      b.group.position.set(v.x, v.y, v.z);
      const sunDir = this.tmp.set(-v.x, -v.y, -v.z).normalize();
      b.material.uniforms.uSunDir.value.copy(sunDir);
      b.material.uniforms.uCameraPos.value.copy(this.camera.position);
      if (b.ring) {
        b.ring.mat.uniforms.uSunDir.value.copy(sunDir);
        b.ring.mat.uniforms.uPlanetPos.value.copy(b.group.position);
        b.ring.mat.uniforms.uCameraPos.value.copy(this.camera.position);
      }
      if (b.clouds) b.clouds.material.uniforms.uSunDir.value.copy(sunDir);
      if (b.atmosphere) {
        b.atmosphere.material.uniforms.uSunDir.value.copy(sunDir);
        b.atmosphere.material.uniforms.uCameraPos.value.copy(this.camera.position);
      }
      // Axial tilt is already applied to the tilt group; spin its textured mesh.
      const period = Math.abs(p.rotationHours || 24) * 3600;
      const dir = p.rotationHours < 0 ? -1 : 1;
      b.mesh.rotation.y = ((t / period) * Math.PI * 2 * dir + b.spinPhase) % (Math.PI * 2);
      if (b.clouds) b.clouds.rotation.y = b.mesh.rotation.y + 0.02 * Math.sin(t * 0.00002);
      b.mesh.getWorldPosition(this._world);
      this._updateBeacon(b, this._world, h);
    }

    for (const b of this.moonBodies) {
      const m = b.data;
      const parent = this.bodies.get(m.parent);
      if (!parent) continue;
      const off = moonOffsetKm(m, date);
      const fx = off.x / AU_KM * moonOrbitFactor;
      const fy = off.y / AU_KM * moonOrbitFactor;
      const fz = off.z / AU_KM * moonOrbitFactor;
      b.group.position.set(
        parent.group.position.x + fx,
        parent.group.position.y + fz,
        parent.group.position.z - fy,
      );
      const sunDir = this.tmp.copy(b.group.position).negate().normalize();
      b.material.uniforms.uSunDir.value.copy(sunDir);
      b.material.uniforms.uCameraPos.value.copy(this.camera.position);
      const period = Math.abs(m.periodDays) * 86400;
      const dir = m.periodDays < 0 ? -1 : 1;
      b.mesh.rotation.y = ((t / period) * Math.PI * 2 * dir) % (Math.PI * 2);
      b.mesh.getWorldPosition(this._world);
    }

    // Camera near/far and clipping.
    const near = Math.max(1e-9, this.rig.distance * 0.00002);
    const far = Math.max(200, this.rig.distance * 500);
    if (this._lastNear !== near || this._lastFar !== far) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
      this._lastNear = near;
      this._lastFar = far;
    }
    this.rig.update(dt);

    // Selection highlight follows the body.
    if (this.selectedId && this.bodies.get(this.selectedId)) {
      const b = this.bodies.get(this.selectedId);
      const d = this.camera.position.distanceTo(b.group.position);
      const wpp = 2 * Math.tan(this.camera.fov * DEG / 2) * d / Math.max(1, h);
      const physicalPx = (b.visualRadiusAU / Math.max(wpp, 1e-12)) * 2;
      this.selectionSprite.visible = physicalPx < 90;
      this.selectionSprite.position.copy(b.group.position);
      this.selectionSprite.scale.setScalar(Math.max(wpp * 30, b.visualRadiusAU * 2.1));
      this.selectionSprite.material.opacity = 0.62;
    } else {
      this.selectionSprite.visible = false;
    }

    this.labels.update(this.camera, w, h, performance.now());
  }

  _updateBeacon(body, worldPos, screenHeight) {
    const d = this.camera.position.distanceTo(worldPos);
    const wpp = 2 * Math.tan(this.camera.fov * DEG / 2) * d / Math.max(1, screenHeight);
    const physicalPx = (body.visualRadiusAU / Math.max(wpp, 1e-12)) * 2;
    // Planets stay marked at every zoom level.
    body.beacon.visible = true;
    body.beacon.position.copy(worldPos);
    const scale = Math.max(body.visualRadiusAU * 2.6, wpp * 15);
    body.beacon.scale.setScalar(scale);
    body.beacon.material.opacity = Math.min(0.95, Math.max(0.35, 1 - physicalPx / 55));
  }

  getScaleReport() {
    const visibleHeight = 2 * this.rig.distance * Math.tan(this.camera.fov * DEG / 2) * AU_M;
    const b = this.bodies.get(this.focusId);
    return {
      scaleMeters: visibleHeight,
      label: b ? b.name : 'Solar System',
      distanceFromFocusAU: this.rig.distance,
      focus: this.focusId,
    };
  }

  getTelemetry() {
    const b = this.bodies.get(this.focusId);
    const date = this.getDate?.() || new Date();
    return {
      title: 'Solar System',
      mode: b ? b.name : 'Heliocentric',
      focus: b ? b.name : 'Solar System',
      distanceAU: this.rig.distance,
    };
  }

  dispose() {
    this.rig.dispose();
    this.labels.dispose();
    this.sky?.dispose();
  }
}
