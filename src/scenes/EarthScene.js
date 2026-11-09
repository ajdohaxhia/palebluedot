import * as THREE from 'three';
import { OrbitRig, TouchEnhancer } from '../engine/camera.js';
import { createLine, createLineSegments } from '../engine/lines.js';
import { LabelLayer } from '../engine/labels.js';
import { SkyDome, earthSkyRotation } from '../engine/sky.js';
import { makeGlowTexture, makeCoronaTexture } from '../engine/procedural.js';
import {
  SUN, MOONS, EARTH_RADIUS_KM, EARTH_MASS_KG, AU_KM,
  SOURCES, EARTH_LANDMARKS,
} from '../data/featured.js';
import {
  earthSpinRad, sunDirectionEquatorial, moonEarthScenePosition, OBLIQUITY,
} from '../astronomy/ephemeris.js';
import {
  earthLatLonFromLocal, earthLocalFromLatLon, sunDirectionEarthScene,
} from '../astronomy/coordinates.js';
import { julianDate, J2000_JD } from '../astronomy/time.js';

const DEG = Math.PI / 180;
const EARTH_RADIUS_UNITS = 1.0;
const MOON_RADIUS_UNITS = 1737.4 / EARTH_RADIUS_KM;
const MOON_MEAN_DISTANCE_UNITS = 384400 / EARTH_RADIUS_KM;

const earthVertex = /* glsl */`
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

const earthFragment = /* glsl */`
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uSpec;
  uniform sampler2D uNormal;
  uniform sampler2D uClouds;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform float uNightIntensity;
  uniform float uExposure;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vWorldPos);

    // Perturb surface normal using 2K normal map for mountain & elevation relief
    vec3 normMap = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    vec3 q0 = dFdx(vWorldPos);
    vec3 q1 = dFdy(vWorldPos);
    vec2 st0 = dFdx(vUv);
    vec2 st1 = dFdy(vUv);
    vec3 S = normalize(q0 * st1.t - q1 * st0.t);
    vec3 T = normalize(-q0 * st1.s + q1 * st0.s);
    vec3 N_surf = normalize(cross(q0, q1));
    mat3 tbn = mat3(S, T, N_surf);
    vec3 perturbedN = normalize(tbn * normMap);

    float sunDot = dot(perturbedN, uSunDir);
    float geomSunDot = dot(N, uSunDir);
    float day = smoothstep(-0.12, 0.22, sunDot);
    float highSun = smoothstep(0.02, 0.58, sunDot);

    vec3 dayCol = texture2D(uDay, vUv).rgb;
    vec3 nightCol = texture2D(uNight, vUv).rgb;
    float specMask = texture2D(uSpec, vUv).r;

    // Atmospheric Rayleigh warming across the sunset / sunrise terminator
    float terminator = smoothstep(0.18, 0.0, abs(geomSunDot)) * smoothstep(-0.06, 0.25, geomSunDot);
    vec3 sunsetColor = vec3(1.10, 0.45, 0.16);
    dayCol = mix(dayCol, dayCol * sunsetColor * 1.5, terminator * 0.45);

    // Dynamic cloud shadows cast onto land and oceans below
    vec2 cloudUv = vUv - uSunDir.xy * 0.003;
    float cloudShadow = texture2D(uClouds, cloudUv).r;
    float shadowFactor = 1.0 - smoothstep(0.15, 0.85, cloudShadow) * 0.65 * day;

    vec3 lit = dayCol * (0.035 + 0.98 * day) * shadowFactor;

    // Ocean glint specular with Fresnel ocean reflection
    vec3 H = normalize(uSunDir + V);
    float specDot = max(dot(perturbedN, H), 0.0);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float spec = (pow(specDot, 130.0) + fresnel * pow(specDot, 28.0) * 0.4) * specMask * highSun * 0.24;
    lit += vec3(0.72, 0.85, 1.0) * spec;

    // City lights emerge where the Sun has set with warm sodium glow
    float nightMask = smoothstep(0.10, -0.22, geomSunDot);
    vec3 lights = nightCol * vec3(1.0, 0.82, 0.54) * 4.0;
    lit += lights * nightMask * uNightIntensity;

    // Subtle earthshine on the night hemisphere
    lit += dayCol * 0.006 * nightMask;
    lit *= uExposure;

    gl_FragColor = vec4(lit, 1.0);
  }
`;

const cloudsVertex = earthVertex;
const cloudsFragment = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uSunDir;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    float c = texture2D(uMap, vUv).r;
    float a = smoothstep(0.08, 0.85, c) * uOpacity;
    float sunDot = dot(normalize(vNormalW), uSunDir);
    float lit = smoothstep(-0.25, 0.35, sunDot);
    vec3 col = mix(vec3(0.14, 0.18, 0.26), vec3(1.0, 0.985, 0.96), lit);
    // warm cloud tops near the terminator
    col *= mix(vec3(1.0), vec3(1.08, 0.96, 0.88), smoothstep(0.0, 0.2, sunDot) * (1.0 - smoothstep(0.25, 0.7, sunDot)));
    gl_FragColor = vec4(col, a);
  }
`;

const atmosphereVertex = /* glsl */`
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const atmosphereFragment = /* glsl */`
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform float uIntensity;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vWorldPos);
    float ndv = max(dot(N, V), 0.0);
    // Soft outer haze plus a tighter, brighter limb line.
    float rim = pow(1.0 - ndv, 3.2) + 0.55 * pow(1.0 - ndv, 9.0);
    float sun = smoothstep(-0.42, 0.58, dot(N, uSunDir));
    vec3 deep = vec3(0.10, 0.34, 0.82);
    vec3 sky = vec3(0.46, 0.73, 1.0);
    vec3 col = mix(deep, sky, smoothstep(0.0, 0.9, sun));
    float alpha = rim * (0.12 + 0.95 * sun) * uIntensity;
    // A whisper of cyan airglow at the night limb.
    col += vec3(0.06, 0.20, 0.20) * (1.0 - sun) * rim * 0.4;
    gl_FragColor = vec4(col * alpha * 1.8, alpha);
  }
`;

function makeFallbackSky() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#020308';
  ctx.fillRect(0, 0, c.width, c.height);
  // deterministic starfield fallback, clearly not survey positions
  let s = 1234567;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * c.width;
    const y = rnd() * c.height;
    const b = Math.pow(rnd(), 2.6) * 0.7 + 0.03;
    ctx.fillStyle = `rgba(${200 + rnd() * 55},${210 + rnd() * 40},255,${b})`;
    ctx.fillRect(x, y, 0.8 + rnd() * 1.2, 0.8 + rnd() * 1.2);
  }
  const g = ctx.createLinearGradient(0, 260, 0, 760);
  g.addColorStop(0, 'rgba(120,140,190,0)');
  g.addColorStop(0.5, 'rgba(150,155,190,0.05)');
  g.addColorStop(1, 'rgba(120,140,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class EarthScene {
  constructor({ assets, canvas, labelsContainer, onSelect, onCoordinate, onFocusChange }) {
    this.assets = assets;
    this.canvas = canvas;
    this.labelsContainer = labelsContainer;
    this.onSelect = onSelect || (() => {});
    this.onCoordinate = onCoordinate || (() => {});
    this.onFocusChange = onFocusChange || (() => {});
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050a);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 12000);
    this.scene.add(this.camera);
    this.focusId = 'earth';
    this.clock = new THREE.Clock();
    this.selectedId = null;
    this.landmarksVisible = true;
    this.graticuleVisible = false;
    this.nightLights = 1.0;
    this.atmosphereIntensity = 1.0;
    this._labelItems = [];
    this._hover = null;
    this._pointer = new THREE.Vector2();
    this._raycaster = new THREE.Raycaster();
    this.rig = new OrbitRig(this.camera, {
      distance: 2.95,
      minDistance: 1.035,
      maxDistance: 95,
      yaw: 0.6,
      pitch: 0.22,
      damping: 6.5,
      zoomDamping: 7.5,
      near: 0.01,
      far: 12000,
      domElement: canvas,
    });
    this.touch = new TouchEnhancer(this.rig, canvas);
    this.rig.onPick = p => this.pick(p);
    this.rig.onHover = p => this.hover(p);
    this.rig.onDoubleClick = p => this.doubleClick(p);
    this.labels = new LabelLayer(labelsContainer, { className: 'labels-earth' });
    this.ready = false;
  }

  async init() {
    const [day, night, spec, normal, clouds, moon, sky] = await Promise.all([
      this.assets.texture('assets/textures/earth_day_4k.jpg'),
      this.assets.texture('assets/textures/earth_night_2k.jpg'),
      this.assets.texture('assets/textures/earth_specular_2048.jpg', { srgb: false }),
      this.assets.texture('assets/textures/earth_normal_2048.jpg', { srgb: false }),
      this.assets.texture('assets/textures/earth_clouds_2k.jpg', { srgb: false }),
      this.assets.texture('assets/textures/2k_moon.jpg'),
      this.assets.texture('assets/textures/nasa_starmap_2020_4k_bright.jpg').catch(() => null),
    ]);
    this.dayTex = day; this.nightTex = night; this.specTex = spec;
    this.normalTex = normal;
    this.cloudTex = clouds; this.moonTex = moon;
    this.skyTex = sky || makeFallbackSky();

    this.sky = new SkyDome(this.skyTex, {
      rotation: earthSkyRotation(),
      brightness: 1.22,
      opacity: 1.0,
      tint: 0xffffff,
    });
    this.scene.add(this.sky.mesh);

    this._buildEarth();
    this._buildMoonOrbit();
    this._buildMoon();
    this._buildSunGlow();
    this._buildGraticule();
    this._buildLandmarks();
    this._buildLabels();
    this._setInitialView();
    this.ready = true;
    return this;
  }

  _buildEarth() {
    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);

    const geo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 192, 96);
    this.earthMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uDay: { value: this.dayTex },
        uNight: { value: this.nightTex },
        uSpec: { value: this.specTex },
        uNormal: { value: this.normalTex },
        uClouds: { value: this.cloudTex },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uCameraPos: { value: new THREE.Vector3() },
        uNightIntensity: { value: 1.0 },
        uExposure: { value: 1.12 },
      },
      vertexShader: earthVertex,
      fragmentShader: earthFragment,
    });
    this.earthMesh = new THREE.Mesh(geo, this.earthMaterial);
    this.earthMesh.name = 'earth';
    this.earthGroup.add(this.earthMesh);

    // Clouds sit just above the surface and rotate with a slight relative drift.
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.006, 160, 80);
    this.cloudMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.cloudTex },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uOpacity: { value: 0.8 },
      },
      vertexShader: cloudsVertex,
      fragmentShader: cloudsFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.clouds = new THREE.Mesh(cloudGeo, this.cloudMaterial);
    this.clouds.renderOrder = 2;
    this.earthGroup.add(this.clouds);

    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.025, 128, 64);
    this.atmoMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uCameraPos: { value: new THREE.Vector3() },
        uIntensity: { value: 1.0 },
      },
      vertexShader: atmosphereVertex,
      fragmentShader: atmosphereFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });
    this.atmosphere = new THREE.Mesh(atmoGeo, this.atmoMaterial);
    this.atmosphere.renderOrder = 3;
    this.earthGroup.add(this.atmosphere);

    // A tiny bit of ambient fill so the unlit hemisphere remains readable.
    this.scene.add(new THREE.AmbientLight(0x0a1422, 0.22));
    this.sunLight = new THREE.DirectionalLight(0xfff4e2, 3.0);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  _buildMoonOrbit() {
    const points = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(a) * MOON_MEAN_DISTANCE_UNITS,
        0,
        Math.sin(a) * MOON_MEAN_DISTANCE_UNITS,
      ));
    }
    this.moonOrbitLine = createLine(points, { color: 0x82c8f5, opacity: 0.09, width: 1.5 });
    this.moonOrbitLine.rotation.x = -OBLIQUITY;
    this.moonOrbitLine.visible = false;
    this.scene.add(this.moonOrbitLine);
  }

  _buildMoon() {
    this.moonGroup = new THREE.Group();
    const geo = new THREE.SphereGeometry(MOON_RADIUS_UNITS, 96, 48);
    this.moonMaterial = new THREE.MeshStandardMaterial({
      map: this.moonTex,
      roughness: 0.98,
      metalness: 0.0,
      color: 0xd8d5cd,
    });
    this.moonMesh = new THREE.Mesh(geo, this.moonMaterial);
    this.moonMesh.name = 'moon';
    this.moonGroup.add(this.moonMesh);
    this.scene.add(this.moonGroup);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture({ color: '190,200,220', halo: 0.9 }),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    }));
    glow.scale.setScalar(0.85);
    this.moonGroup.add(glow);
  }

  _buildSunGlow() {
    const tex = makeGlowTexture({ color: '255,235,195', halo: 0.8 });
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    }));
    this.sunGlow.scale.setScalar(4.6);
    this.sunGlow.position.set(1, 0, 0).multiplyScalar(800);
    this.scene.add(this.sunGlow);

    // Wide streamer corona. It is a child of the glow, so it follows the Sun
    // and its scale is relative to the parent sprite.
    this.sunCorona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeCoronaTexture(),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    }));
    this.sunCorona.scale.setScalar(3.4);
    this.sunGlow.add(this.sunCorona);

    // Small, intense core so the disc reads as white-hot and feeds the bloom pass.
    this.sunCore = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture({ color: '255,250,240', core: 0.1, halo: 0.5 }),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    }));
    this.sunCore.scale.setScalar(0.28);
    this.sunGlow.add(this.sunCore);
  }

  _buildGraticule() {
    const pts = [];
    const r = 1.0025;
    for (let lat = -75; lat <= 75; lat += 15) {
      const phi = lat * DEG;
      for (let lon = -180; lon < 180; lon += 4) {
        const a = lon * DEG, b = (lon + 4) * DEG;
        pts.push(
          new THREE.Vector3(
            -Math.cos(a) * Math.cos(phi) * r,
            Math.sin(phi) * r,
            Math.sin(a) * Math.cos(phi) * r,
          ),
          new THREE.Vector3(
            -Math.cos(b) * Math.cos(phi) * r,
            Math.sin(phi) * r,
            Math.sin(b) * Math.cos(phi) * r,
          ),
        );
      }
    }
    for (let lon = -180; lon < 180; lon += 15) {
      const a = lon * DEG;
      for (let lat = -90; lat < 90; lat += 4) {
        const p = lat * DEG, q = (lat + 4) * DEG;
        pts.push(
          new THREE.Vector3(
            -Math.cos(a) * Math.cos(p) * r,
            Math.sin(p) * r,
            Math.sin(a) * Math.cos(p) * r,
          ),
          new THREE.Vector3(
            -Math.cos(a) * Math.cos(q) * r,
            Math.sin(q) * r,
            Math.sin(a) * Math.cos(q) * r,
          ),
        );
      }
    }
    this.graticule = createLineSegments(pts, {
      color: 0x82c8f5, opacity: 0.1, width: 1.25, blending: THREE.AdditiveBlending,
    });
    this.graticule.visible = false;
    this.earthMesh.add(this.graticule);
  }

  _buildLandmarks() {
    this.landmarkGroup = new THREE.Group();
    this.earthMesh.add(this.landmarkGroup);
    this.landmarkMarkers = [];
    const markerGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x82c8f5, transparent: true, opacity: 0.9 });
    for (const lm of EARTH_LANDMARKS) {
      const dir = earthLocalFromLatLon(lm.lat, lm.lon);
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(dir.x, dir.y, dir.z).multiplyScalar(1.008);
      marker.visible = false;
      this.landmarkGroup.add(marker);
      this.landmarkMarkers.push({ def: lm, marker });
    }
  }

  _buildLabels() {
    const items = [];
    items.push({
      id: 'earth-label', name: 'EARTH', priority: 100,
      className: 'label-major label-earth',
      position: new THREE.Vector3(0, 0, 0),
      getPosition: () => new THREE.Vector3(0, 0, 0),
      onClick: () => this.select('earth'),
      sub: 'Home',
      shouldShow: () => this.rig.distance > 6,
    });
    items.push({
      id: 'moon-label', name: 'MOON', priority: 80,
      className: 'label-major',
      getPosition: () => this.moonGroup.position.clone(),
      onClick: () => this.select('moon'),
      sub: 'Natural satellite',
      shouldShow: () => this.rig.distance > 4.2,
    });
    this.landmarkLabels = EARTH_LANDMARKS.map((lm, i) => ({
      id: `landmark-${i}`, name: lm.name, priority: 26 - i,
      className: 'label-landmark',
      getPosition: () => {
        const m = this.landmarkMarkers[i].marker;
        return m.getWorldPosition(new THREE.Vector3());
      },
      onClick: () => this.onSelect('landmark', lm.name, lm),
      shouldShow: () => {
        if (!this.landmarksVisible) return false;
        const visible = this.rig.distance < 4.6;
        // hide landmarks on the far side of the globe
        const world = this.landmarkMarkers[i].marker.getWorldPosition(new THREE.Vector3());
        const camera = this.camera.position;
        const center = new THREE.Vector3(0, 0, 0);
        const normal = world.clone().normalize();
        const toCam = camera.clone().sub(world).normalize();
        return visible && normal.dot(toCam) > 0.02;
      },
      sub: lm.kind,
    }));
    this.labels.setItems([...items, ...this.landmarkLabels]);
    for (const lm of this.landmarkMarkers) lm.marker.visible = false;
  }

  _setInitialView() {
    const now = new Date();
    const eq = sunDirectionEquatorial(now);
    const sunScene = new THREE.Vector3(eq.x, eq.z, -eq.y).normalize();
    // Find a photogenic, partly lit landmass for the first frame.
    const candidates = [
      { lat: 18, lon: 22, name: 'Sahara' },       // Africa
      { lat: 38, lon: -6, name: 'Iberia' },
      { lat: 18, lon: -95, name: 'Mexico' },
      { lat: -12, lon: -58, name: 'Amazon' },
      { lat: 30, lon: 105, name: 'China' },
      { lat: -25, lon: 135, name: 'Australia' },
      { lat: 48, lon: 12, name: 'Europe' },
    ];
    const sunWorld = new THREE.Vector3(eq.x, eq.z, -eq.y).normalize();
    // Earth's spin: inverse rotation of the sun direction gives the subsolar point.
    const spin = earthSpinRad(now);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -spin);
    const localSun = sunWorld.clone().applyQuaternion(q);
    const subsolar = earthLatLonFromLocal(localSun);
    let best = null, bestScore = -Infinity;
    for (const c of candidates) {
      const land = earthLocalFromLatLon(c.lat, c.lon);
      const landWorld = new THREE.Vector3(land.x, land.y, land.z)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), spin);
      const angular = Math.acos(Math.max(-1, Math.min(1, landWorld.dot(sunWorld)))) / DEG;
      if (angular > 118) continue; // far side of the planet
      // Favour a landscape near the day/night boundary for a cinematic terminator.
      let score = -Math.abs(angular - 68);
      if (['Sahara', 'Amazon', 'Europe'].includes(c.name)) score += 4;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) best = candidates[0];
    const land = earthLocalFromLatLon(best.lat, best.lon);
    const landWorld = new THREE.Vector3(land.x, land.y, land.z)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), spin)
      .normalize();
    // Place the visible hemisphere at ~62° from the subsolar point toward the chosen land:
    // roughly one third of the disc is in night, with the terminator crossing the globe.
    const c = 0.276; // cos 74°
    const s = 0.961;
    const perp = landWorld.clone().sub(sunWorld.clone().multiplyScalar(landWorld.dot(sunWorld)));
    if (perp.lengthSq() < 1e-6) perp.set(0, 1, 0);
    perp.normalize();
    const viewDir = sunWorld.clone().multiplyScalar(c).add(perp.clone().multiplyScalar(s));
    viewDir.y += 0.10;
    viewDir.normalize();
    const yaw = Math.atan2(viewDir.x, viewDir.z);
    const pitch = Math.asin(Math.max(-0.85, Math.min(0.85, viewDir.y)));
    this.rig.setAngles(yaw + 0.035, pitch * 0.6 + 0.13, true);
    this.rig.setDistance(3.78);
    this.rig.focus.set(0, 0, 0);
    this.rig.targetFocus.set(0, 0, 0);
    this.initial = { best, subsolar, yaw, pitch };
  }

  activate() {
    this.canvas.style.cursor = 'grab';
    this.labels.setVisible(true);
    this.rig.enabled = true;
    this._resize();
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

  setLabelsVisible(v) { this.labels.setVisible(v); }
  setLandmarksVisible(v) {
    this.landmarksVisible = v;
    for (const lm of this.landmarkMarkers) lm.marker.visible = v;
  }
  setGraticuleVisible(v) { this.graticule.visible = v; }
  setOrbitsVisible(v) { this.moonOrbitLine.visible = v; }
  setNightLights(v) { this.earthMaterial.uniforms.uNightIntensity.value = v; }
  setAtmosphere(v) { this.atmoMaterial.uniforms.uIntensity.value = v; }
  setCloudsVisible(v) { this.clouds.visible = v; }
  setCinematic(v) {
    this.rig.autoRotate = v;
    this.rig.autoRotateSpeed = 0.018;
  }

  focusObject(id, opts = {}) {
    this.select(id, { silent: true });
    if (id === 'moon') {
      this.rig.setLimits(0.34, 200, -1.48, 1.48);
      const pos = this.moonGroup.position;
      this.rig.focusOn(pos, 1.35, { duration: opts.immediate ? 0 : 1.9, ...opts });
    } else {
      this.rig.setLimits(1.035, 95);
      this.rig.focusOn(new THREE.Vector3(0, 0, 0), opts.distance || 2.35, { duration: opts.immediate ? 0 : 1.9, ...opts });
      this.focusId = 'earth';
      this.onFocusChange('earth');
    }
    this._focus(id);
  }

  _focus(id) {
    this.focusId = id;
    this.rig.follow = null;
    this.labels.setSelected(id === 'earth' ? 'earth-label' : id === 'moon' ? 'moon-label' : null);
    this.onFocusChange(id);
  }

  resetView() {
    this.rig.setLimits(1.035, 95);
    this.labels.setSelected('earth-label');
    this.focusId = 'earth';
    this.rig.focusOn(new THREE.Vector3(0, 0, 0), 2.92, { duration: 1.3 });
    this.onFocusChange('earth');
  }

  focusLandmark(latDeg, lonDeg, distance = 1.55) {
    const local = earthLocalFromLatLon(latDeg, lonDeg);
    const spin = this.earthMesh.rotation.y;
    const world = new THREE.Vector3(local.x, local.y, local.z)
      .normalize()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), spin)
      .normalize();
    const yaw = Math.atan2(world.x, world.z);
    const pitch = Math.asin(Math.max(-0.92, Math.min(0.92, world.y)));
    this.rig.setLimits(1.035, 95);
    this.rig.focusOn(new THREE.Vector3(0, 0, 0), distance, {
      duration: 1.25,
      yaw,
      pitch: pitch * 0.86 + 0.12,
    });
    this._focus('earth');
  }

  select(id, { silent = false } = {}) {
    this.selectedId = id;
    if (id === 'earth') this.onSelect({ kind: 'earth', id: 'earth', data: null, silent });
    else if (id === 'moon') this.onSelect({ kind: 'moon', id: 'moon', data: MOONS.find(m => m.id === 'moon'), silent });
  }

  pick({ x, y }) {
    const hit = this.raycast(x, y);
    if (hit?.object === this.earthMesh) {
      this.select('earth');
      this._focus('earth');
    } else if (hit?.object === this.moonMesh) {
      this.select('moon');
      this._focus('moon');
    } else {
      // Clicking empty space clears the selection.
      this.onSelect(null);
    }
  }

  doubleClick({ x, y }) {
    const hit = this.raycast(x, y);
    if (hit?.object === this.moonMesh) this.focusObject('moon');
    else if (hit?.object === this.earthMesh) this.focusObject('earth');
  }

  hover(p) {
    if (!p) {
      this.onCoordinate(null);
      this.canvas.style.cursor = 'grab';
      return;
    }
    const { x, y } = p;
    const hit = this.raycast(x, y);
    if (hit?.object === this.earthMesh && hit.uv) {
      const local = hit.point.clone();
      this.earthMesh.worldToLocal(local);
      const ll = earthLatLonFromLocal(local);
      const elev = this._sunElevationAt(local);
      this.onCoordinate({ ...ll, sunElevationDeg: elev, visible: true });
      this.canvas.style.cursor = 'crosshair';
    } else if (hit?.object === this.moonMesh) {
      this.onCoordinate(null, { kind: 'moon' });
      this.canvas.style.cursor = 'pointer';
    } else {
      this.onCoordinate(null);
      this.canvas.style.cursor = 'grab';
    }
  }

  _sunElevationAt(localDir) {
    const n = localDir.clone().normalize();
    const localSun = new THREE.Vector3(
      this.earthMaterial.uniforms.uSunDir.value.x,
      this.earthMaterial.uniforms.uSunDir.value.y,
      this.earthMaterial.uniforms.uSunDir.value.z,
    );
    const spin = this.earthMesh.rotation.y;
    localSun.applyAxisAngle(new THREE.Vector3(0, 1, 0), -spin);
    return Math.asin(Math.max(-1, Math.min(1, n.dot(localSun)))) / DEG;
  }

  raycast(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects([this.earthMesh, this.moonMesh], false);
    return hits.length ? hits[0] : null;
  }

  update(dt, { time, width, height }) {
    if (!this.ready) return;
    const w = width || window.innerWidth, h = height || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.rig.update(dt);

    // Sidereal rotation and realistic Sun direction from the current simulation date.
    const date = time.date;
    this.earthMesh.rotation.y = earthSpinRad(date);
    const tSec = (date.getTime() / 1000);
    this.clouds.rotation.y = this.earthMesh.rotation.y + 0.002 * Math.sin(tSec * 0.00002);
    const eq = sunDirectionEquatorial(date);
    const sunScene = new THREE.Vector3(eq.x, eq.z, -eq.y).normalize();
    this.earthMaterial.uniforms.uSunDir.value.copy(sunScene);
    this.earthMaterial.uniforms.uCameraPos.value.copy(this.camera.position);
    this.atmoMaterial.uniforms.uSunDir.value.copy(sunScene);
    this.atmoMaterial.uniforms.uCameraPos.value.copy(this.camera.position);
    this.cloudMaterial.uniforms.uSunDir.value.copy(sunScene);
    this.sunLight.position.copy(sunScene).multiplyScalar(100);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.intensity = 2.6;
    this.sunGlow.position.copy(sunScene).multiplyScalar(800);

    // Moon: low-precision geocentric position, in Earth radii.
    const moon = moonEarthScenePosition(date, EARTH_RADIUS_KM);
    this.moonGroup.position.set(moon.x, moon.y, moon.z);
    this.moonOrbitLine.rotation.set(-OBLIQUITY, 0, 0);

    const landmarksOn = this.landmarksVisible && this.rig.distance < 4.6 && this.rig.focus.length() < 1;
    for (const lm of this.landmarkMarkers) lm.marker.visible = landmarksOn;
    if (this._previousDistance !== this.rig.distance && this.labels._lastCollide) {
      this.labels._lastCollide = 0;
    }
    this._previousDistance = this.rig.distance;

    this.sky.update(this.camera);
    // Adjust sky brightness a little: Earth's night sky should be quiet.
    this.labels.update(this.camera, w, h, performance.now());
    this._resizeIfNeeded(w, h);
  }

  _resizeIfNeeded(w, h) {
    if (this._lastW !== w || this._lastH !== h) {
      this._lastW = w; this._lastH = h;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.labels.setScreenSize(w, h);
    }
  }

  getScaleReport() {
    const kmPerUnit = EARTH_RADIUS_KM;
    const visibleHeight = 2 * this.rig.distance * Math.tan(this.camera.fov * DEG / 2) * kmPerUnit;
    return {
      scaleMeters: visibleHeight * 1000,
      label: this.rig.distance > 40 ? 'Earth–Moon system' : 'Earth',
      distanceFromFocusKm: this.rig.distance * EARTH_RADIUS_KM,
    };
  }

  defaultView() {
    this.rig.focusOn(new THREE.Vector3(0, 0, 0), 2.92, { duration: 1.2 });
  }

  dispose() {
    this.rig.dispose();
    this.labels.dispose();
    this.sky?.dispose();
  }
}
