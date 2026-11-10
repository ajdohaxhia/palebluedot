import * as THREE from 'three';
import { Engine, QUALITY_PRESETS } from './engine/renderer.js';
import { AssetStore } from './engine/assets.js';
import { EarthScene } from './scenes/EarthScene.js';
import { SolarScene } from './scenes/SolarScene.js';
import { DeepScene } from './scenes/DeepScene.js';
import { ExoScene } from './scenes/ExoScene.js';
import { CosmosApp } from './cosmos/CosmosApp.js';
import { Catalogs, searchCatalog, norm } from './astronomy/catalogs.js';
import { TimeEngine, SPEEDS, formatJD, julianDate, PRESENT, DATE_MIN, DATE_MAX } from './astronomy/time.js';
import {
  PLANETS, DWARF_PLANETS, MOONS, SUN, GALAXIES, CLUSTERS, TOURS, SCALE_LEVELS,
  FEATURED_STAR_NAMES, EARTH_RADIUS_KM, AU_KM, AU_M,
} from './data/featured.js';
import { Inspector } from './ui/inspector.js';
import {
  presentEarth, presentMoon, presentPlanetById, presentSun, presentStar, presentGalaxy,
  presentCluster, presentNebula, presentMilkyWay, presentExoplanet, presentExoSystem,
  presentWeb, presentLandmark, presentMoonById, presentSurveyPoint,
} from './ui/present.js';
import { formatDistance, formatDateUTC, formatNumber } from './astronomy/units.js';
import { earthLatLonFromLocal, galacticToEquatorial, SUN_SCENE_MPC } from './astronomy/coordinates.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const APP = {
  assets: null,
  engine: null,
  catalogs: null,
  time: null,
  earth: null,
  solar: null,
  solarPromise: null,
  deep: null,
  deepPromise: null,
  exo: null,
  exoSystem: null,
  cosmos: null,
  inspector: null,
  activeScene: null,
  scene: null,
  camera: null,
  mode: 'explore',
  domain: 'earth',
  selection: null,
  compare: [],
  settings: {
    labels: true,
    orbits: true,
    grid: false,
    landmarks: true,
    clouds: true,
    atmosphere: true,
    lights: true,
    transitions: true,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    bloom: 0.55,
    solarScale: 'true',
    quality: 'auto',
    layers: {
      stars: true, exoplanets: true, milkyway: true, localgroup: true,
      sdss: true, quasars: true, clusters: true, horizon: true,
    },
  },
  hover: null,
  uiTimer: 0,
  startTime: 0,
  ready: false,
  loadingDone: false,
  catalogsReady: false,
  recent: loadJSON('eon.recent', []),
  searchActive: -1,
  searchResults: [],
  tour: null,
  tourIndex: 0,
  toastTimer: null,
  frameHandle: null,
  lastFrame: 0,
  transitioning: false,
  pending: null,
};

/* -------------------------------------------------------------------------- */
/* Boot                                                                      */
/* -------------------------------------------------------------------------- */
async function boot() {
  APP.startTime = performance.now();
  const canvas = $('#scene-canvas');

  // Fonts / reduced motion state.
  document.body.classList.toggle('reduced-motion', APP.settings.reducedMotion);

  try {
    APP.engine = new Engine(canvas);
  } catch (e) {
    showFatal('EON needs WebGL 2. Your browser or graphics driver could not initialise it.', e);
    return;
  }
  const bootParams = new URLSearchParams(location.search);
  const bootQuality = bootParams.get('quality');
  APP.engine.setQuality(['low','balanced','high','ultra','auto'].includes(bootQuality) ? bootQuality : 'auto');
  APP.engine.onFps = fps => {
    $('#status-fps').textContent = `${Math.round(fps)} FPS`;
  };

  APP.assets = new AssetStore({ base: './' });
  APP.assets.setRenderer(APP.engine.renderer);
  APP.assets.manager.onProgress = (url, loaded, total) => {
    const pct = 12 + Math.round((loaded / Math.max(1, total)) * 70);
    setLoading(pct, loadingLabel(url));
  };
  APP.assets.manager.onError = url => {
    console.warn('Asset failed', url);
    showToast('Un livello di immagini non è stato caricato. Continuo con i dati disponibili.', 'warn');
  };

  APP.time = new TimeEngine({ speed: 100, playing: true });
  APP.time.on(() => {
    if (APP.ready) updateTimeUI();
  });

  setupLoading();
  setLoading(8, 'Initialising renderer');

  const overlay = $('#loading-screen');
  APP.earth = new EarthScene({
    assets: APP.assets,
    canvas,
    labelsContainer: $('#labels-layer'),
    onSelect: handleSelection,
    onCoordinate: (coord, meta) => {
      APP.hover = coord ? { ...coord, ...(meta || {}) } : null;
      updateTelemetry();
    },
    onFocusChange: id => {
      updateBreadcrumbsForFocus(id);
    },
  });

  setLoading(14, 'Loading Earth imagery');
  try {
    await APP.earth.init();
  } catch (e) {
    console.error(e);
    showFatal('The Earth imagery could not be initialised. Check that the assets directory is present and reload.', e);
    return;
  }

  APP.inspector = new Inspector($('#inspector'), {
    onAction: handleInspectorAction,
    onPlanetSelect: (planet, system) => openExoSystem(system, planet),
    onClose: () => {},
  });

  APP.activeScene = APP.earth;
  APP.scene = APP.earth.scene;
  APP.camera = APP.earth.camera;
  APP.domain = 'earth';
  APP.earth.activate();
  APP.ready = true;
  APP.loadingDone = true;
  clearInterval(APP.loadingInterval);
  setLoading(100, 'Observatory online');
  $('#data-chips').textContent = 'NASA · HYG';
  $('#status-quality').textContent = 'Automatica · adattiva';

  setupUI();
  initCosmos();
  updateBreadcrumbs('Earth', 'Solar System', 'Milky Way');
  updateTimeUI();
  updateScaleUI();
  updateTelemetry();
  renderTourList();
  setTimeout(() => {
    overlay.classList.add('is-hidden');
    APP.loadingDone = true;
    if (APP.cosmos) APP.cosmos.start(0);
    else { maybeOpenIntro(); showGuidance(); }
  }, 650);
  requestAnimationFrame(loop);

  // Background: build the searchable scientific index while the user explores.
  loadCataloguesInBackground();
  setTimeout(preloadSolar, 1800);
  setTimeout(preloadDeep, 7000);
}

function maybeOpenIntro() {
  if (window.innerWidth > 900) {
    setTimeout(() => {
      if (!APP.selection) {
        APP.inspector.open(presentEarth());
        APP.selection = { kind: 'earth', id: 'earth' };
      }
    }, 1100);
  }
}

function showGuidance() {
  setTimeout(() => {
    if (APP.selection) return;
    showToast('Trascina per orbitare attorno alla Terra · scorri per avvicinarti · premi / per cercare nel cosmo');
  }, 2300);
}

async function loadCataloguesInBackground() {
  APP.catalogs = new Catalogs('./data/');
  try {
    await APP.catalogs.load((p, label) => {
      if (!APP.loadingDone) setLoading(78 + Math.round(p * 20), label);
    });
    APP.catalogsReady = true;
    setupSearch();
    const sdssMeta = APP.catalogs.sdssMeta;
    const sdssSmall = document.querySelector('.layer-row[data-layer="sdss"] small');
    if (sdssSmall && sdssMeta) sdssSmall.textContent = `${APP.catalogs.sdss.count.toLocaleString('en-US')} real galaxies · observed (z ≤ ${sdssMeta.zMax.toFixed(3)})`;
    const qCount = APP.catalogs.quasars?.count;
    const qSmall = document.querySelector('.layer-row[data-layer="quasars"] small');
    if (qSmall && qCount) qSmall.textContent = `${qCount.toLocaleString('en-US')} SDSS quasars · observed (z ≤ 0.21)`;
    const cov = document.querySelector('#coverage-note');
    if (cov && sdssMeta) cov.textContent = `The SDSS sample covers ${APP.catalogs.sdss.count.toLocaleString('en-US')} galaxies in the survey footprint, z = ${sdssMeta.zMin.toFixed(3)}–${sdssMeta.zMax.toFixed(3)}. It is a shallow, incomplete slice, not a complete sky map. Absence of a point is not absence of a galaxy.`;
    updateDataChips();
    // Warm the search index off the critical path.
    APP.catalogs.searchIndex();
    console.info(`[EON] catalogue ready: ${APP.catalogs.starIndex.count.toLocaleString()} stars, ${APP.catalogs.exo.count.toLocaleString()} planets, ${APP.catalogs.sdss.count.toLocaleString()} galaxies`);
  } catch (e) {
    console.error('Catalogue load failed', e);
    showToast('Il catalogo esteso non è stato caricato. Terra e Sistema Solare restano esplorabili.', 'warn');
    setupSearch();
  }
}

/* -------------------------------------------------------------------------- */
/* Solar System scene                                                         */
/* -------------------------------------------------------------------------- */
async function createSolarScene() {
  if (APP.solar) return APP.solar;
  if (APP.solarPromise) return APP.solarPromise;
  const p = (async () => {
    const scene = new SolarScene({
      assets: APP.assets,
      canvas: $('#scene-canvas'),
      labelsContainer: $('#labels-layer'),
      getSettings: () => APP.settings,
      onSelect: handleSolarSelection,
      onFocusChange: (id, data) => {
        if (APP.domain !== 'solar') return;
        const name = data?.name || (id === 'sun' ? 'Sun' : id);
        updateBreadcrumbs(name, 'Solar System', 'Milky Way');
        updateTelemetry();
      },
    });
    await scene.init();
    APP.solar = scene;
    return scene;
  })();
  APP.solarPromise = p;
  p.catch(err => {
    console.error('Solar scene failed', err);
    showToast('Il renderer del Sistema Solare non si è avviato.', 'error');
    APP.solarPromise = null;
  });
  return p;
}

function preloadSolar() {
  if (APP.solar || APP.solarPromise) return;
  createSolarScene().then(() => {
    if (APP.domain !== 'solar') APP.solar?.deactivate();
  }).catch(() => {});
}

async function enterSolar({ targetId = null, distance = null, announce = false } = {}) {
  if (APP.domain === 'solar') {
    // This early return can be reached after a preload/deactivate cycle:
    // make sure the Solar rig and its labels are actually enabled.
    APP.solar?.activate();
    if (targetId) APP.solar.focusObject(targetId);
    if (distance) APP.solar.rig.targetDistance = distance;
    return APP.solar;
  }
  showToast('Salita verso il Sistema Solare…');
  const solar = await createSolarScene();
  await runTransition('Solar System', () => {
    activateDomain('solar', solar);
  });
  // Apply saved settings.
  solar.setScaleMode(APP.settings.solarScale);
  if (targetId) solar.focusObject(targetId);
  else if (distance) solar.rig.targetDistance = distance;
  else solar.resetView();
  if (announce) showToast('Sistema Solare — le posizioni orbitali usano elementi kepleriani approssimati.');
  return solar;
}

function activateDomain(domain, scene) {
  const previous = APP.activeScene;
  if (previous && previous !== scene) previous.deactivate?.();
  APP.domain = domain;
  document.body.classList.toggle('domain-earth', domain === 'earth');
  document.body.classList.toggle('domain-solar', domain === 'solar');
  document.body.classList.toggle('domain-stars', domain === 'deep' || domain === 'stars');
  document.body.classList.toggle('domain-exo', domain === 'exo');
  const exoReturn = $('#exo-return');
  if (exoReturn) exoReturn.hidden = domain !== 'exo';
  APP.activeScene = scene;
  APP.scene = scene.scene;
  APP.camera = scene.camera;
  APP.engine.setScene(scene.scene, scene.camera);
  if (scene.rig) {
    scene.rig.setFreeFlight(false);
    scene.rig.autoRotate = false;
  }
  scene.activate?.();
  setMode(APP.mode, false);
  APP.setCameraModeActive?.('orbit');
  if (domain === 'deep' && APP.deep) {
    for (const [k, v] of Object.entries(APP.settings.layers)) APP.deep.setLayer(k, v);
  }
  updateDataChips();
  updateScaleUI();
  updateTelemetry();
  APP.inspector?.close();
}

function runTransition(label, midpoint) {
  return new Promise(resolve => {
    if (!APP.settings.transitions || APP.settings.reducedMotion) {
      midpoint();
      updateTimeUI();
      requestAnimationFrame(() => resolve());
      return;
    }
    const veil = $('#transition-veil');
    $('#transition-label').textContent = label;
    veil.classList.add('is-active');
    APP.transitioning = true;
    setTimeout(() => {
      midpoint();
      setTimeout(() => {
        veil.classList.remove('is-active');
        APP.transitioning = false;
        resolve();
      }, 470);
    }, 380);
  });
}

async function leaveSolarToEarth() {
  await runTransition('Earth', () => {
    activateDomain('earth', APP.earth);
    APP.earth.setLandmarksVisible(APP.settings.landmarks);
    APP.earth.resetView();
  });
  updateBreadcrumbs('Earth', 'Solar System', 'Milky Way');
}

/* -------------------------------------------------------------------------- */
/* Deep universe                                                              */
/* -------------------------------------------------------------------------- */
function waitForCatalogues(timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const tick = () => {
      if (APP.catalogsReady && APP.catalogs) return resolve(APP.catalogs);
      if (performance.now() - start > timeoutMs) return reject(new Error('Catalogue timeout'));
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function createDeepScene() {
  if (APP.deep) return APP.deep;
  if (APP.deepPromise) return APP.deepPromise;
  const p = (async () => {
    await waitForCatalogues();
    const scene = new DeepScene({
      assets: APP.assets,
      catalogs: APP.catalogs,
      canvas: $('#scene-canvas'),
      labelsContainer: $('#labels-layer'),
      getSettings: () => APP.settings,
      onSelect: handleDeepSelection,
      onFocusChange: info => {
        if (APP.domain !== 'deep') return;
        updateTelemetry();
        if (info?.level) updateDeepBreadcrumbs(info.level, info);
      },
      onScaleLevel: level => {
        if (APP.domain === 'deep' && !APP.selection) updateDeepBreadcrumbs(level);
      },
    });
    await scene.init();
    APP.deep = scene;
    return scene;
  })();
  APP.deepPromise = p;
  p.catch(err => {
    console.error('Deep atlas failed', err);
    showToast('L’atlante profondo non si è avviato.', 'error');
    APP.deepPromise = null;
  });
  return p;
}

function preloadDeep() {
  if (APP.deep || APP.deepPromise) return;
  createDeepScene().then(() => {
    if (APP.domain !== 'deep') APP.deep?.deactivate();
  }).catch(() => {});
}

async function enterDeep({ label = 'Stellar neighbourhood', announce = false } = {}) {
  if (APP.domain === 'deep' && APP.deep) return APP.deep;
  if (!APP.catalogsReady) showToast('Esplorazione del cielo profondo…');
  const deep = await createDeepScene();
  await runTransition(label, () => activateDomain('deep', deep));
  if (announce) showToast(label === 'Cosmic web' ? 'Rete cosmica — le posizioni SDSS usano distanze comoventi.' : 'Atlante stellare — posizioni reali dal catalogo HYG.');
  updateDataChips();
  return deep;
}

function updateDeepBreadcrumbs(level, info = null) {
  let name = null;
  if (info?.star) name = info.star.name;
  else if (info?.galaxy) name = info.galaxy.name;
  else if (info?.cluster) name = info.cluster.name;
  else if (info?.display) name = info.display.name;
  if (level === 'stars') updateBreadcrumbs(name || 'Stellar neighbourhood', 'Solar neighbourhood', 'Milky Way');
  else if (level === 'galaxy') updateBreadcrumbs(name || 'Milky Way', 'Local Group', 'Laniakea');
  else if (level === 'local') updateBreadcrumbs(name || 'Local Group', 'Virgo Supercluster', 'Laniakea');
  else if (level === 'cosmic') updateBreadcrumbs(name || 'Cosmic web', 'Observable universe', '13.8 billion years');
  else updateBreadcrumbs('Observable universe', 'Cosmology', '13.8 billion years');
}

/* -------------------------------------------------------------------------- */
/* COSMOS — presentation-first mode                                           */
/* -------------------------------------------------------------------------- */
let cosmosSceneToken = 0;

function setAtlasPicking(enabled) {
  const noop = () => {};
  for (const scene of [APP.earth, APP.solar, APP.deep, APP.exo]) {
    if (scene?.rig) scene.rig.noHandoff = enabled;
  }
  if (APP.earth) APP.earth.onSelect = enabled ? handleSelection : noop;
  if (APP.solar) APP.solar.onSelect = enabled ? handleSolarSelection : noop;
  if (APP.deep) APP.deep.onSelect = enabled ? handleDeepSelection : noop;
  if (APP.exo) APP.exo.onSelect = enabled ? handleExoSelection : noop;
}

function initCosmos() {
  if (APP.cosmos) return;
  APP.cosmos = new CosmosApp({
    onScene: showCosmosScene,
    onFreeAtlas: () => setAtlasPicking(true),
    onExitFreeAtlas: () => setAtlasPicking(false),
  });
  window.COSMOS = APP.cosmos;
  if (APP.earth) APP.earth.onSelect = () => {};
}

async function showCosmosScene(scene) {
  if (!scene) return;
  const token = ++cosmosSceneToken;
  try {
    if (scene.domain === "earth") {
      if (!APP.earth) return;
      if (APP.domain !== "earth") activateDomain("earth", APP.earth);
      APP.earth.onSelect = () => {};
      APP.earth.rig.follow = null;
      if (scene.mode === "earth-moon") {
        APP.earth.rig.setLimits(1.035, 320);
        APP.earth.focusObject("earth", { distance: 12, immediate: true });
        const moon = APP.earth.moonGroup.position.clone();
        const mid = moon.clone().multiplyScalar(0.5);
        APP.earth.rig.follow = null;
        APP.earth.rig.focusOn(mid, 160, { duration: 0, yaw: 0.62, pitch: 0.34, immediate: true });
      } else if (scene.mode === "moon") {
        APP.earth.focusObject("moon", { immediate: true });
      } else {
        APP.earth.focusObject("earth", { distance: scene.distance || 3.2, immediate: true });
      }
      return;
    }
    if (scene.domain === "solar") {
      if (!APP.solar) await createSolarScene();
      if (token !== cosmosSceneToken) return;
      if (APP.domain !== "solar" || APP.activeScene !== APP.solar) activateDomain("solar", APP.solar);
      else if (!APP.solar.rig.enabled) APP.solar.activate();
      APP.solar.onSelect = () => {};
      APP.solar.setScaleMode("educational");
      APP.solar.rig.follow = null;
      APP.solar.rig.setLimits(0.000006, 220);
      if (scene.mode === "planet" && scene.target) {
        APP.solar.focusObject(scene.target, { immediate: true, follow: false });
      } else {
        APP.solar.focusObject("sun", { distance: scene.distanceAU || 22, immediate: true });
      }
      return;
    }
    if (scene.domain === "deep") {
      if (!APP.deep) await createDeepScene();
      if (token !== cosmosSceneToken) return;
      if (APP.domain !== "deep") activateDomain("deep", APP.deep);
      APP.deep.onSelect = () => {};
      APP.deep.rig.follow = null;
      switch (scene.mode) {
        case "stars":
          APP.deep.setScaleMeters(scene.scaleMeters || 3e17);
          break;
        case "star": {
          const found = APP.catalogs?.findStar(scene.target);
          if (found) {
            const data = found.i != null
              ? (APP.catalogs.starIndex.named.find(x => x.i === found.i) || found)
              : found;
            APP.deep.focusStar(data, { immediate: true });
          }
          break;
        }
        case "curated":
          APP.deep.focusCuratedStar(scene.target, { immediate: true });
          break;
        case "nebula":
          APP.deep.focusNebula(scene.target, { immediate: true });
          break;
        case "galaxy": {
          const g = GALAXIES.find(x => x.id === scene.target || x.name === scene.target || (x.aliases || []).includes(scene.target));
          if (g) APP.deep.focusGalaxy(g, { immediate: true });
          break;
        }
        case "cluster": {
          const c = CLUSTERS.find(x => x.id === scene.target || x.name === scene.target || (x.aliases || []).includes(scene.target));
          if (c) APP.deep.focusCluster(c, { immediate: true });
          break;
        }
        case "milkyway": APP.deep.focusMilkyWay({ immediate: true }); break;
        case "local": APP.deep.focusLocalGroup(); break;
        case "web": APP.deep.focusWeb({ immediate: true }); break;
        case "observable": APP.deep.focusObservable({ immediate: true }); break;
        default: break;
      }
    }
  } catch (err) {
    console.warn("COSMOS scene navigation failed", err);
  }
}

/* -------------------------------------------------------------------------- */
/* Frame loop                                                                */
/* -------------------------------------------------------------------------- */
function loop(timestamp) {
  APP.frameHandle = requestAnimationFrame(loop);
  if (document.hidden) {
    APP.lastFrame = timestamp;
    return;
  }
  const now = timestamp || performance.now();
  const dt = APP.lastFrame ? Math.min(0.2, (now - APP.lastFrame) / 1000) : 0.016;
  APP.lastFrame = now;

  // The COSMOS cover is a static presentation page; keep the observatory idle
  // until the learner actually enters the atlas. This avoids burning the GPU
  // behind an opaque cover.
  if (APP.cosmos && !APP.cosmos.active) return;

  APP.time.update(dt);

  const active = APP.activeScene;
  if (active) {
    try {
      active.update(dt, {
        time: APP.time,
        width: window.innerWidth,
        height: window.innerHeight,
      });
    } catch (e) {
      console.error('Scene update failed', e);
    }
    APP.engine.render(active.scene, active.camera, dt);
  }

  APP.uiTimer += dt;
  if (APP.uiTimer > 0.16) {
    APP.uiTimer = 0;
    updateTimeUI();
    updateScaleUI();
    updateTelemetry();
    updateStatus();
  }
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                   */
/* -------------------------------------------------------------------------- */
function setupLoading() {
  const err = $('#loading-error');
  err.hidden = true;
  let p = 3;
  setLoading(p, 'Calibrating optics');
  APP.loadingInterval = setInterval(() => {
    if (APP.loadingDone || p > 70) { clearInterval(APP.loadingInterval); return; }
    p += 1;
    setLoading(p, 'Initialising observatory');
  }, 260);
  window.addEventListener('eon:webgl-lost', () => {
    showToast('Contesto grafico perso. Tentativo di ripristino…', 'warn');
  });
  window.addEventListener('eon:webgl-restored', () => {
    showToast('Contesto grafico ripristinato.');
  });
}

function loadingLabel(url) {
  if (url.includes('earth_day')) return 'Loading Earth imagery';
  if (url.includes('earth_night')) return 'Caricamento delle luci delle città';
  if (url.includes('clouds')) return 'Costruzione dello strato nuvoloso';
  if (url.includes('starmap')) return 'Caricamento della sfera celeste';
  if (url.includes('normal') || url.includes('specular')) return 'Rifinitura dei materiali di superficie';
  return 'Caricamento delle risorse dell’osservatorio';
}

function setLoading(percent, text) {
  const bar = $('#loading-bar');
  const pct = $('#loading-percent');
  if (!bar) return;
  bar.style.width = `${Math.max(3, Math.min(100, percent))}%`;
  pct.textContent = `${Math.min(100, Math.round(percent))}%`;
  if (text) $('#loading-status').textContent = text;
}

function showFatal(message, error) {
  console.error(error);
  const el = $('#loading-error');
  if (el) {
    el.hidden = false;
    el.textContent = message;
  }
  const status = $('#loading-status');
  if (status) status.textContent = 'Impossibile avviare';
  showToast(message, 'error');
}

/* -------------------------------------------------------------------------- */
/* UI setup                                                                  */
/* -------------------------------------------------------------------------- */
function setupUI() {
  // Brand reset
  $('#brand-home').addEventListener('click', () => {
    exitTour();
    navigateHome();
  });

  setupPanels();
  setupModeMenu();
  setupTimeControls();
  setupSettings();
  setupCameraTools();
  setupScaleRail();
  setupZoomHandoffs();
  setupLabelWheelBridge();
  setupSearchShell();
  setupKeyboard();
  setupCoordinates();
  setupStatus();

  $('#fullscreen-button').addEventListener('click', toggleFullscreen);
  $('#exo-return')?.addEventListener('click', () => exitExo());
  $('#tour-prev').addEventListener('click', () => { if (APP.tour && APP.tourIndex > 0) goToTourStop(APP.tourIndex - 1); });
  $('#tour-next').addEventListener('click', () => {
    if (!APP.tour) return;
    if (APP.tourIndex >= APP.tour.stops.length - 1) exitTour();
    else goToTourStop(APP.tourIndex + 1);
  });
  $('#tour-exit').addEventListener('click', exitTour);

  // Prevent drag from selecting UI while orbiting.
  $('#scene-canvas').addEventListener('pointerdown', () => document.body.classList.add('is-dragging'));
  window.addEventListener('pointerup', () => document.body.classList.remove('is-dragging'));

  window.addEventListener('resize', () => {
    if (APP.earth) {
      APP.earth.camera.aspect = window.innerWidth / window.innerHeight;
      APP.earth.camera.updateProjectionMatrix();
    }
  });
}

function setupPanels() {
  const backdrop = $('#drawer-backdrop');
  const closeAll = () => {
    $$('.panel').forEach(p => { p.hidden = true; });
    backdrop.hidden = true;
    document.body.classList.remove('modal-open');
  };
  APP.closeAllPanels = closeAll;
  for (const btn of $$('[data-close-panel]')) {
    btn.addEventListener('click', closeAll);
  }
  backdrop.addEventListener('click', closeAll);
  $('#settings-button').addEventListener('click', () => togglePanel('settings-panel'));
  $('#layers-button').addEventListener('click', () => togglePanel('layers-panel'));
  $('#tour-button').addEventListener('click', () => togglePanel('tours-panel'));
  $('#sources-button').addEventListener('click', () => togglePanel('sources-panel'));
  $('#scale-open')?.addEventListener('click', () => toggleScaleRail(true));
}

function togglePanel(id) {
  const panel = document.getElementById(id);
  if (!panel) return;
  const isOpen = !panel.hidden;
  APP.closeAllPanels();
  if (isOpen) return;
  APP.inspector?.close();
  panel.hidden = false;
  $('#drawer-backdrop').hidden = false;
  document.body.classList.add('modal-open');
  APP.closeAllPanels = () => {
    panel.hidden = true;
    $('#drawer-backdrop').hidden = true;
    document.body.classList.remove('modal-open');
    APP.closeAllPanels = () => {
      $$('.panel').forEach(p => { p.hidden = true; });
      $('#drawer-backdrop').hidden = true;
      document.body.classList.remove('modal-open');
    };
  };
  const focusEl = panel.querySelector('button, select, input');
  setTimeout(() => focusEl?.focus({ preventScroll: true }), 80);
}

function setupModeMenu() {
  const btn = $('#mode-button');
  const menu = $('#mode-menu');
  const close = () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  for (const item of $$('[data-mode]')) {
    item.addEventListener('click', () => {
      setMode(item.dataset.mode, true);
      close();
    });
  }
  document.addEventListener('click', e => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) close();
  });
  APP.closeModeMenu = close;
}

function setMode(mode, fromUser = false) {
  APP.mode = mode;
  document.body.classList.remove('mode-explore', 'mode-atlas', 'mode-simulation', 'mode-cinematic', 'mode-education', 'mode-comparison');
  document.body.classList.add(`mode-${mode}`);
  $('#mode-label').textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
  for (const item of $$('[data-mode]')) {
    item.setAttribute('aria-checked', String(item.dataset.mode === mode));
  }
  const active = APP.activeScene;
  if (!active) return;
  // Camera behaviour for the display mode.
  if (active.setCinematic) active.setCinematic(mode === 'cinematic');
  else if (active.rig) active.rig.autoRotate = mode === 'cinematic';
  if (mode === 'cinematic') APP.inspector?.close();

  if (mode === 'atlas') {
    active.setLabelsVisible?.(true);
    if (active.setGridVisible) active.setGridVisible(true);
    if (active === APP.earth) active.setGraticuleVisible(true);
    $('#context-note').hidden = true;
  } else if (mode === 'education') {
    showContextNote();
  } else {
    $('#context-note').hidden = true;
    active.setLabelsVisible?.(APP.settings.labels);
    if (active.setGridVisible) active.setGridVisible(APP.settings.grid);
    if (active === APP.earth) active.setGraticuleVisible(APP.settings.grid);
    active.setOrbitsVisible?.(APP.settings.orbits);
  }
  if (mode === 'simulation') APP.time.setPlaying(true);
  if (mode === 'comparison' && fromUser) openComparePanel();
  if (fromUser) showToast(modeDescription(mode));
}

function modeDescription(mode) {
  switch (mode) {
    case 'atlas': return 'Atlas mode — labels and the geographic graticule are visible.';
    case 'simulation': return 'Simulation mode — orbital time is running. Use the time dock to change rate or date.';
    case 'cinematic': return 'Cinematic mode — interface minimised. Press Esc to return to Explore.';
    case 'education': return 'Education mode — scale context and references are shown.';
    case 'comparison': return 'Comparison mode — add two objects to compare their records.';
    default: return 'Explore mode.';
  }
}

function setupTimeControls() {
  const play = $('#time-play');
  const reverse = $('#time-reverse');
  const dateBtn = $('#time-date');
  const speedBtn = $('#time-speed');
  const popover = $('#time-popover');
  const dateInput = $('#time-input');
  const nowBtn = $('#time-now');
  const closeBtn = $('#time-close');

  const togglePopover = force => {
    const open = force !== undefined ? force : popover.hidden;
    popover.hidden = !open;
    dateBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      dateInput.value = APP.time.date.toISOString().slice(0, 10);
      $('#time-jd').textContent = `JD ${formatJD(julianDate(APP.time.date))}`;
    }
  };
  APP.closeTimePopover = () => togglePopover(false);

  play.addEventListener('click', () => {
    APP.time.toggle();
    updateTimeUI();
  });
  reverse.addEventListener('click', () => {
    if (APP.time.direction === -1) {
      APP.time.setDirection(1);
      reverse.classList.remove('is-reversed');
    } else {
      APP.time.setDirection(-1);
      APP.time.setPlaying(true);
      reverse.classList.add('is-reversed');
    }
    updateTimeUI();
  });
  dateBtn.addEventListener('click', e => {
    e.stopPropagation();
    togglePopover();
  });
  speedBtn.addEventListener('click', e => {
    e.stopPropagation();
    togglePopover(true);
    speedBtn.blur();
  });
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    const d = new Date(`${dateInput.value}T12:00:00Z`);
    if (Number.isFinite(d.getTime())) {
      APP.time.setPlaying(false);
      APP.time.setDate(d);
      updateTimeUI();
      showToast(`Data di simulazione impostata al ${formatDateUTC(d)}.`);
    }
  });
  nowBtn.addEventListener('click', () => {
    APP.time.setDate(PRESENT());
    APP.time.setPlaying(true);
    APP.time.setDirection(1);
    APP.time.setSpeed(100);
    updateTimeUI();
    togglePopover(false);
  });
  closeBtn.addEventListener('click', () => togglePopover(false));
  for (const b of $$('#speed-options button')) {
    b.addEventListener('click', () => {
      const s = Number(b.dataset.speed);
      APP.time.setSpeed(s);
      for (const x of $$('#speed-options button')) x.classList.toggle('active', x === b);
      updateTimeUI();
    });
  }
  document.addEventListener('pointerdown', e => {
    if (!popover.hidden && !popover.contains(e.target) && e.target !== dateBtn && !dateBtn.contains(e.target)) {
      togglePopover(false);
    }
  });
  reverse.classList.toggle('is-reversed', APP.time.direction === -1);
  updateTimeUI();
}

function updateTimeUI() {
  if (!APP.time) return;
  const d = APP.time.date;
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
  }).format(d);
  const el = $('#time-date-value');
  if (el) el.textContent = `${text} · UTC`;
  const dateBtn = $('#time-date');
  if (dateBtn) dateBtn.title = `${formatDateUTC(d, true)} · JD ${formatJD(julianDate(d))}`;
  const jd = $('#time-jd');
  if (jd) jd.textContent = `JD ${formatJD(julianDate(d))}`;
  const play = $('#time-play');
  if (play) {
    play.innerHTML = `<svg class="icon"><use href="#${APP.time.playing ? 'i-pause' : 'i-play'}"/></svg>`;
    play.setAttribute('aria-label', APP.time.playing ? 'Pause simulation' : 'Play simulation');
  }
  const sp = $('#time-speed');
  if (sp) sp.textContent = `${APP.time.speed.toLocaleString('en-US')}×`;
  for (const b of $$('#speed-options button')) {
    b.classList.toggle('active', Number(b.dataset.speed) === APP.time.speed);
  }
  const rev = $('#time-reverse');
  if (rev) rev.classList.toggle('is-reversed', APP.time.direction === -1);
}

function setupSettings() {
  const quality = $('#quality-select');
  quality.addEventListener('change', () => {
    APP.settings.quality = quality.value;
    APP.engine.setQuality(quality.value);
    $('#status-quality').textContent =
      quality.value === 'auto' ? 'Auto · adaptive' : (QUALITY_PRESETS[quality.value]?.name || quality.value);
    showToast(`Qualità di resa: ${quality.options[quality.selectedIndex].text}.`);
  });
  const bloom = $('#bloom-range');
  bloom.addEventListener('input', () => {
    APP.settings.bloom = Number(bloom.value) / 100;
    APP.engine.setBloom(APP.settings.bloom * 0.95, 0.55, 0.84);
  });
  $('#transitions-toggle').addEventListener('change', e => {
    APP.settings.transitions = e.target.checked;
  });
  const reduced = $('#reduced-motion-toggle');
  reduced.checked = APP.settings.reducedMotion;
  reduced.addEventListener('change', () => {
    APP.settings.reducedMotion = reduced.checked;
    document.body.classList.toggle('reduced-motion', reduced.checked);
    if (reduced.checked) {
      APP.earth?.rig.setAutoRotate(false);
      showToast('Movimento ridotto attivo — il movimento cinematografico della camera è limitato.', 'warn');
    }
  });
  $('#labels-toggle').addEventListener('change', e => {
    APP.settings.labels = e.target.checked;
    APP.activeScene?.setLabelsVisible?.(e.target.checked);
  });
  $('#orbits-toggle').addEventListener('change', e => {
    APP.settings.orbits = e.target.checked;
    if (APP.domain === 'solar') APP.solar?.setOrbitsVisible(e.target.checked);
    else if (APP.domain === 'earth') APP.earth?.setOrbitsVisible(e.target.checked);
    else if (APP.domain === 'deep') { /* no orbital paths at this scale */ }
    else if (APP.domain === 'exo') APP.exo?.setOrbitsVisible(e.target.checked);
    else APP.activeScene?.setOrbitsVisible?.(e.target.checked);
  });
  $('#grid-toggle').addEventListener('change', e => {
    APP.settings.grid = e.target.checked;
    if (APP.domain === 'solar') APP.solar?.setGridVisible(e.target.checked);
    else if (APP.domain === 'earth') APP.earth?.setGraticuleVisible(e.target.checked);
    else if (APP.domain === 'deep') APP.deep?.setGridVisible(e.target.checked);
    else APP.activeScene?.setGridVisible?.(e.target.checked);
  });
  $('#landmarks-toggle').addEventListener('change', e => {
    APP.settings.landmarks = e.target.checked;
    APP.earth?.setLandmarksVisible(e.target.checked);
  });
  $('#clouds-toggle').addEventListener('change', e => {
    APP.settings.clouds = e.target.checked;
    APP.earth?.setCloudsVisible(e.target.checked);
  });
  $('#atmosphere-toggle').addEventListener('change', e => {
    APP.settings.atmosphere = e.target.checked;
    APP.earth?.setAtmosphere(e.target.checked ? 1 : 0);
  });
  $('#lights-toggle').addEventListener('change', e => {
    APP.settings.lights = e.target.checked;
    APP.earth?.setNightLights(e.target.checked ? 1 : 0);
  });
  $('#scale-mode-select').addEventListener('change', e => {
    APP.settings.solarScale = e.target.value;
    APP.solar?.setScaleMode(e.target.value);
    if (e.target.value === 'educational') {
      showToast('Visibilità migliorata — dimensioni dei corpi e orbite lunari ×30, distanze interplanetarie reali.');
    } else {
      showToast('Scala reale — raggi e distanze fisiche.');
    }
    if (APP.mode === 'education') showContextNote();
  });
  for (const layer of $$('.layer-row input')) {
    layer.addEventListener('change', () => {
      const row = layer.closest('.layer-row');
      const name = row?.dataset.layer;
      if (!name) return;
      APP.settings.layers[name] = layer.checked;
      APP.deep?.setLayer(name, layer.checked);
      APP.onLayerToggle?.(name, layer.checked);
    });
  }
}

function setupCameraTools() {
  const buttons = $$('[data-camera]');
  const setActive = name => {
    buttons.forEach(b => {
      const active = b.dataset.camera === name;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  };
  APP.setCameraModeActive = setActive;
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const mode = b.dataset.camera;
      const scene = APP.activeScene;
      const rig = scene?.rig;
      if (!rig) return;
      if (mode === 'orbit') {
        rig.setFreeFlight(false);
        rig.autoRotate = false;
        if (APP.domain === 'earth') rig.follow = null;
        setActive('orbit');
      } else if (mode === 'free') {
        rig.setFreeFlight(true);
        rig.autoRotate = false;
        rig.follow = null;
        setActive('free');
        showToast('Volo libero — trascina per guardare, W A S D per muoverti, Q E in verticale, Maiusc per accelerare.');
      } else if (mode === 'follow') {
        if (!APP.selection) {
          showToast('Seleziona prima un oggetto, poi scegli Segui.', 'warn');
          return;
        }
        rig.setFreeFlight(false);
        if (APP.domain === 'solar') {
          if (APP.solar.setFollow(APP.selection.id)) {
            setActive('follow');
            showToast(`Seguendo ${APP.selection.name || APP.selection.id}.`);
          } else {
            showToast('This object cannot be followed.', 'warn');
          }
        } else if (APP.domain === 'earth') {
          if (APP.selection.kind === 'moon') rig.follow = () => APP.earth.moonGroup.position;
          else rig.follow = () => new THREE.Vector3(0, 0, 0);
          setActive('follow');
          showToast(APP.selection.kind === 'moon' ? 'Following the Moon.' : 'Earth-centred follow view enabled.');
        } else if (APP.domain === 'exo') {
          if (APP.selection.kind === 'exoplanet') {
            APP.exo.focusPlanet(APP.selection.id);
            setActive('follow');
            showToast(`Seguendo ${APP.selection.id}.`);
          } else {
            showToast('Select a planet to follow.', 'warn');
          }
        } else if (APP.domain === 'deep') {
          const p = APP.selection.data?.world || APP.deep.getObjectPosition(APP.selection.id);
          if (p) {
            rig.follow = () => new THREE.Vector3(p.x, p.y, p.z);
            setActive('follow');
            showToast(`Seguendo ${APP.selection.data?.name || APP.selection.id}.`);
          } else {
            showToast('This object cannot be followed.', 'warn');
          }
        }
      } else if (mode === 'cinematic') {
        rig.setFreeFlight(false);
        rig.autoRotate = !rig.autoRotate;
        rig.autoRotateSpeed = APP.domain === 'earth' ? 0.018 : 0.01;
        b.classList.toggle('active', rig.autoRotate);
        b.setAttribute('aria-pressed', String(rig.autoRotate));
        showToast(rig.autoRotate ? 'Deriva cinematografica attiva.' : 'Deriva cinematografica disattivata.');
        if (!rig.autoRotate) setActive('orbit');
        return;
      }
    });
  }
  $('#reset-view').addEventListener('click', resetView);
}

function setupScaleRail() {
  const stopsEl = $('#scale-stops');
  stopsEl.innerHTML = '';
  for (const level of SCALE_LEVELS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'scale-stop';
    b.dataset.id = level.id;
    b.style.top = `${logToRailPos(Math.log10(level.meters))}%`;
    b.innerHTML = `<span>${level.label}</span>`;
    b.title = `${level.label} — ${level.sub}`;
    b.addEventListener('click', () => {
      navigateToScale(Math.log10(level.meters));
      if (window.innerWidth <= 900) toggleScaleRail(false);
    });
    stopsEl.appendChild(b);
  }
  const range = $('#scale-range');
  range.addEventListener('input', () => {
    const v = Number(range.value);
    updateScaleReadout(v);
    updateScaleStops(v);
  });
  range.addEventListener('change', () => {
    navigateToScale(Number(range.value));
  });
  $('#scale-collapse').addEventListener('click', () => toggleScaleRail(false));
  $('#mobile-scale-button').addEventListener('click', () => {
    toggleScaleRail(true);
    showToast('Scala cosmica — trascina attraverso gli strati dell’universo.');
  });
  $('#scale-open').addEventListener('click', () => toggleScaleRail(true));
}

function toggleScaleRail(open) {
  const rail = $('#scale-rail');
  const collapsed = !open;
  rail.classList.toggle('is-collapsed', collapsed && window.innerWidth > 900);
  rail.classList.toggle('is-mobile-open', open && window.innerWidth <= 900);
  document.body.classList.toggle('scale-sheet-open', open && window.innerWidth <= 900);
  $('#scale-collapse').setAttribute('aria-expanded', String(!collapsed));
  $('#scale-collapse').innerHTML = `<svg class="icon"><use href="#${collapsed ? 'i-compass' : 'i-chevron-left'}"/></svg>`;
  if (open && window.innerWidth <= 900) APP.inspector?.close();
}

function logToRailPos(log) {
  const min = 6, max = 27;
  return 100 - ((log - min) / (max - min)) * 100;
}

function railPosToLog(pct) {
  const min = 6, max = 27;
  return min + ((100 - pct) / 100) * (max - min);
}

function updateScaleStops(log) {
  let nearest = SCALE_LEVELS[0];
  for (const l of SCALE_LEVELS) {
    if (Math.abs(Math.log10(l.meters) - log) < Math.abs(Math.log10(nearest.meters) - log)) nearest = l;
  }
  if (APP.domain === 'solar') nearest = SCALE_LEVELS.find(l => l.id === 'solar-system') || nearest;
  for (const b of $$('.scale-stop')) {
    b.classList.toggle('is-active', b.dataset.id === nearest.id);
  }
}

function updateScaleReadout(log) {
  const value = Math.pow(10, log);
  const [coeff, exp] = sciParts(value);
  $('#scale-value').innerHTML = `${coeff} × 10<sup>${exp}</sup> m`;
  $('#scale-caption').textContent = value < 1e9 ? 'Planetary' : 'Cosmic scale';
}

function sciParts(v) {
  const exp = Math.floor(Math.log10(v));
  let coeff = v / Math.pow(10, exp);
  coeff = Number(coeff.toFixed(coeff < 10 ? 2 : 1));
  if (coeff >= 10) return [coeff / 10, exp + 1];
  return [coeff, exp];
}

function setupSearch() {
  if (!APP.catalogsReady) return;
  const input = $('#search-input');
  if (document.activeElement === input) renderSearch(input.value);
  // Index is built lazily on the first query; this warms it.
  APP.catalogs.searchIndex();
  $('#search-input').placeholder = 'Search 9,045 stars, 6,464 exoplanets, galaxies…';
}

function setupSearchShell() {
  const input = $('#search-input');
  const wrap = $('#search-wrap');
  input.addEventListener('focus', () => {
    const rail = document.querySelector('#scale-rail');
    rail?.classList.remove('is-mobile-open');
    document.body.classList.remove('scale-sheet-open');
    if (window.innerWidth <= 620) wrap.classList.add('is-mobile-open');
    if (APP.catalogsReady) renderSearch('');
    else renderSearchLoading();
  });
  input.addEventListener('input', () => {
    APP.searchActive = -1;
    renderSearch(input.value);
  });
  input.addEventListener('keydown', onSearchKeyDown);
  document.addEventListener('click', e => {
    if (!e.target.closest('#search-wrap')) closeSearchResults();
  });
  $('#search-mobile-close').addEventListener('click', () => {
    wrap.classList.remove('is-mobile-open');
    input.blur();
    closeSearchResults();
  });
}

function renderSearchLoading() {
  const el = $('#search-results');
  el.hidden = false;
  el.innerHTML = `<div class="search-empty"><strong>Preparing the atlas index…</strong><br/>Loading star, exoplanet and galaxy catalogues.</div>`;
}

function renderSearch(query) {
  const el = $('#search-results');
  const input = $('#search-input');
  if (!APP.catalogsReady) {
    if (query) {
      renderSearchLoading();
    }
    return;
  }
  el.hidden = false;
  const q = query.trim();
  if (!q) {
    renderSearchIdle();
    return;
  }
  const results = searchCatalog(APP.catalogs, q, 9);
  APP.searchResults = results;
  input.setAttribute('aria-expanded', 'true');
  if (!results.length) {
    el.innerHTML = `<div class="search-empty"><strong>No catalogue object found.</strong><br/>
      Try a planet, a star name, a HIP/HD identifier, an exoplanet host, a Messier/NGC number, or a galaxy cluster.
      <div class="search-foot"><span>Search covers 9,045 named stars + 6,464 planets + curated deep-sky objects</span></div></div>`;
    return;
  }
  el.innerHTML = `<div class="search-group-label">Catalogue matches</div>`;
  results.forEach((r, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'search-result';
    b.role = 'option';
    b.dataset.index = i;
    b.innerHTML = `
      <svg class="icon result-icon" aria-hidden="true"><use href="#${iconForKind(r)}"/></svg>
      <span><span class="result-name">${escapeHTML(r.name)}${r.badge ? `<span class="result-badge">${escapeHTML(r.badge)}</span>` : ''}</span><span class="result-type">${escapeHTML(r.subtitle || r.type)}</span></span>
      <span class="result-dist">${escapeHTML(r.distanceLabel || '')}</span>`;
    b.addEventListener('click', () => chooseSearchResult(r));
    el.appendChild(b);
  });
  const foot = document.createElement('div');
  foot.className = 'search-foot';
  foot.innerHTML = `<span>↑↓ select · Enter travel · Esc close</span><span>${results.length} result${results.length === 1 ? '' : 's'}</span>`;
  el.appendChild(foot);
}

function renderSearchIdle() {
  const el = $('#search-results');
  el.hidden = false;
  const recent = APP.recent.slice(0, 5);
  el.innerHTML = `
    <div class="search-group-label">Begin somewhere</div>
    <div class="recent-chips">
      ${['Earth', 'Saturn', 'Sirius', 'TRAPPIST-1e', 'Andromeda', 'Virgo Cluster'].map(n => `<button class="recent-chip" data-suggest="${escapeHTML(n)}" type="button">${escapeHTML(n)}</button>`).join('')}
    </div>
    ${recent.length ? `<div class="search-group-label">Recent destinations</div><div class="recent-chips">${recent.map(x => `<button class="recent-chip" data-recent="${escapeHTML(x.name)}" type="button">${escapeHTML(x.name)}</button>`).join('')}</div>` : ''}
    <div class="search-foot"><span>Search 9,045 named stars · 6,464 confirmed exoplanets · deep-sky atlas</span><span>Press / to focus</span></div>`;
  for (const b of el.querySelectorAll('[data-suggest], [data-recent]')) {
    b.addEventListener('click', () => {
      const name = b.dataset.suggest || b.dataset.recent;
      $('#search-input').value = name;
      renderSearch(name);
      $('#search-input').focus();
    });
  }
}

function onSearchKeyDown(e) {
  if (e.key === 'Escape') {
    closeSearchResults();
    $('#search-input').blur();
    return;
  }
  if (!APP.searchResults.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    APP.searchActive = Math.min(APP.searchResults.length - 1, APP.searchActive + 1);
    highlightSearch();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    APP.searchActive = Math.max(-1, APP.searchActive - 1);
    highlightSearch();
  } else if (e.key === 'Enter') {
    if (APP.searchActive >= 0) {
      chooseSearchResult(APP.searchResults[APP.searchActive]);
    } else if (APP.searchResults[0]) {
      chooseSearchResult(APP.searchResults[0]);
    }
  }
}

function highlightSearch() {
  for (const b of $$('.search-result')) {
    b.classList.toggle('is-active', Number(b.dataset.index) === APP.searchActive);
    if (Number(b.dataset.index) === APP.searchActive) {
      b.setAttribute('aria-selected', 'true');
      b.scrollIntoView({ block: 'nearest' });
    } else b.removeAttribute('aria-selected');
  }
}

function closeSearchResults() {
  $('#search-results').hidden = true;
  $('#search-input').setAttribute('aria-expanded', 'false');
  $('#search-wrap').classList.remove('is-mobile-open');
  APP.searchActive = -1;
}

function iconForKind(r) {
  if (r.domain === 'earth') return 'i-globe';
  if (r.type?.includes('Star') || r.type?.includes('star') || r.type?.includes('·')) return 'i-star';
  if (r.type === 'Exoplanet' || r.type?.includes('Exoplanet')) return 'i-orbit';
  if (r.type?.includes('galaxy') || r.type?.includes('Galaxy')) return 'i-orbit';
  return 'i-compass';
}

function chooseSearchResult(r) {
  closeSearchResults();
  APP.closeAllPanels?.();
  APP.closeTimePopover?.();
  APP.closeModeMenu?.();
  $('#search-input').value = '';
  if (!r) return;
  addRecent({ name: r.name, domain: r.domain, type: r.type });
  navigateToSearchResult(r);
}

function addRecent(r) {
  APP.recent = [r, ...APP.recent.filter(x => x.name !== r.name)].slice(0, 8);
  saveJSON('eon.recent', APP.recent);
}

async function navigateToSearchResult(r) {
  if (!r) return;
  if (r.exoSystem) {
    if (r.exoPlanet) {
      openExoSystem(r.exoSystem, r.exoPlanet);
    } else {
      await openExoSystem(r.exoSystem, r.exoSystem.planets[0]);
    }
    return;
  }
  const obj = r.object;
  if (norm(r.name) === 'sun' || obj?.id === 'sun') {
    await navigateToSolarObject('sun');
    return;
  }
  if (obj?.id === 'earth' || norm(r.name) === 'earth') {
    await ensureDomain('earth');
    APP.earth.focusObject('earth');
    APP.inspector.open(presentEarth());
    APP.selection = { kind: 'earth', id: 'earth' };
    updateBreadcrumbs('Earth', 'Solar System', 'Milky Way');
    return;
  }
  if (obj?.id === 'moon' || norm(r.name) === 'moon') {
    await ensureDomain('earth');
    APP.earth.focusObject('moon', { duration: 1.4 });
    APP.inspector.open(presentMoon());
    APP.selection = { kind: 'moon', id: 'moon' };
    updateBreadcrumbs('Moon', 'Earth system', 'Milky Way');
    return;
  }
  if (obj?.kind === 'star' || r.domain === 'stars') {
    await navigateToStar(obj || r);
    return;
  }
  if (obj?.kind === 'galaxy') {
    await navigateToGalaxy(obj);
    return;
  }
  if (obj?.kind === 'cluster' || obj?.kind === 'structure') {
    await navigateToCluster(obj || r);
    return;
  }
  if (obj?.kind === 'moon' || r.domain === 'earth') {
    const id = obj?.id || (norm(r.name) === 'moon' ? 'moon' : 'earth');
    if (id === 'moon') {
      ensureDomain('earth').then(() => {
        APP.earth.focusObject('moon', { duration: 1.4 });
        APP.inspector.open(presentMoon());
        APP.selection = { kind: 'moon', id: 'moon' };
      });
    } else {
      ensureDomain('earth').then(() => {
        APP.earth.focusObject('earth');
        APP.inspector.open(presentEarth());
        APP.selection = { kind: 'earth', id: 'earth' };
      });
    }
    return;
  }
  if (obj?.kind === 'planet' || obj?.kind === 'dwarf' || obj?.kind === 'sun' || r.domain === 'solar') {
    await navigateToSolarObject(obj?.id || (norm(r.name) === 'sun' ? 'sun' : null));
    return;
  }
  if (r.name === 'The Observable Web' || obj?.id === 'sdss-web') {
    await navigateToWeb();
    return;
  }
  if (obj?.kind === 'nebula') {
    await navigateToNebula(obj.data);
    return;
  }
  // Fallback: resolve by name in the catalogue and try again.
  const found = APP.catalogs?.lookupObject(r.name);
  if (found) {
    if (found.kind === 'galaxy') return navigateToGalaxy(found);
    if (found.kind === 'cluster') return navigateToCluster(found);
  }
  showToast(`“${r.name}” is indexed, but its destination is not available yet.`, 'warn');
}

/* -------------------------------------------------------------------------- */
/* Selection, navigation actions                                             */
/* -------------------------------------------------------------------------- */
function handleSelection(info) {
  if (!info) {
    APP.selection = null;
    APP.inspector?.close();
    return;
  }
  if (info.kind === 'earth') {
    APP.selection = { kind: 'earth', id: 'earth' };
    APP.inspector?.open(presentEarth());
  } else if (info.kind === 'moon') {
    APP.selection = { kind: 'moon', id: 'moon' };
    APP.inspector?.open(presentMoon());
  } else if (info.kind === 'landmark') {
    APP.selection = { kind: 'landmark', id: info.id, data: info.data };
    APP.inspector?.open(presentLandmark(info.data));
  }
}

function handleSolarSelection(info) {
  if (!info) {
    APP.selection = null;
    APP.inspector?.close();
    return;
  }
  let display = null;
  if (info.kind === 'sun') display = presentSun();
  else if (info.kind === 'moon') display = presentMoonById(info.id);
  else display = presentPlanetById(info.id);
  if (!display) return;
  APP.selection = { kind: display.kind, id: info.id, data: info.data };
  APP.inspector?.open(display);
  updateBreadcrumbs(display.name, 'Solar System', 'Milky Way');
  updateTelemetry();
}

function handleInspectorAction(action, display) {
  switch (action) {
    case 'focus':
      if (display.kind === 'landmark') {
        const lm = display.data;
        APP.earth.focusLandmark?.(lm.lat, lm.lon, 1.55);
        return;
      }
      if (display.kind === 'earth' || (display.kind === 'moon' && display.id === 'moon' && APP.domain === 'earth')) {
        APP.earth.focusObject(display.kind === 'moon' ? 'moon' : 'earth');
        return;
      }
      if (APP.domain === 'solar') {
        APP.solar.focusObject(display.data?.id || display.id);
        return;
      }
      if (APP.domain === 'exo' && APP.exo) {
        if (display.kind === 'exoplanet') { APP.exo.focusPlanet(display.name); return; }
        APP.exo.resetView();
        return;
      }
      if (APP.domain === 'deep') {
        if (display.kind === 'sun') { APP.deep.focusSun(); return; }
        if (display.kind === 'star') { APP.deep.focusStar(display.data); return; }
        if (display.kind === 'galaxy') {
          if (display.milkyWay || display.data?.id === 'milky-way') APP.deep.focusMilkyWay();
          else APP.deep.focusGalaxy(display.data);
          return;
        }
        if (display.kind === 'cluster') {
          if (display.data?.noPosition) APP.deep.focusWeb();
          else APP.deep.focusCluster(display.data);
          return;
        }
        if (display.kind === 'structure') { APP.deep.focusWeb(); return; }
        if (display.kind === 'nebula') { navigateToNebula(display.data); return; }
      }
      navigateToDisplay(display);
      break;
    case 'follow':
      if (APP.domain === 'earth') {
        if (display.kind === 'moon') {
          APP.earth.rig.follow = () => APP.earth.moonGroup.position;
          APP.setCameraModeActive?.('follow');
          showToast('Following the Moon.');
        } else {
          showToast('Earth-centred follow view enabled.');
          APP.setCameraModeActive?.('follow');
        }
      } else if (APP.domain === 'solar') {
        const id = display.data?.id || display.id;
        if (APP.solar.setFollow(id)) {
          APP.setCameraModeActive?.('follow');
          showToast(`Following ${display.name}.`);
        } else {
          showToast('This object cannot be followed yet.', 'warn');
        }
      } else if (APP.domain === 'deep') {
        const p = display.data?.world || (display.id ? APP.deep.getObjectPosition(display.id) : null);
        if (p) {
          APP.deep.rig.follow = () => new THREE.Vector3(p.x, p.y, p.z);
          APP.setCameraModeActive?.('follow');
          showToast(`Following ${display.name}.`);
        } else {
          showToast('This object cannot be followed.', 'warn');
        }
      }
      break;
    case 'orbit':
      if (APP.domain === 'solar') {
        APP.solar.setOrbitsVisible(!APP.solar.orbitsVisible);
        APP.settings.orbits = !APP.solar.orbitsVisible ? false : true;
        $('#orbits-toggle').checked = APP.solar.orbitsVisible;
        showToast(APP.solar.orbitsVisible ? 'Orbital paths shown.' : 'Orbital paths hidden.');
      } else if (APP.domain === 'earth') {
        APP.earth.moonOrbitLine.visible = !APP.earth.moonOrbitLine.visible;
        showToast(APP.earth.moonOrbitLine.visible ? 'Orbital path shown.' : 'Orbital path hidden.');
      }
      break;
    case 'compare':
      addComparison(display);
      break;
    case 'system':
      if (display.system) openExoSystem(display.system, display.system._selectedPlanet);
      break;
    default:
      break;
  }
}

async function navigateToDisplay(display) {
  if (!display) return;
  if (display.kind === 'earth') return APP.earth.focusObject('earth');
  if (display.kind === 'moon' && display.id === 'moon') return APP.earth.focusObject('moon');
  if (display.kind === 'sun') {
    if (APP.domain === 'deep') { APP.deep.focusSun(); return; }
    return navigateToSolarObject('sun');
  }
  if (display.kind === 'planet' || display.kind === 'dwarf' || display.kind === 'moon') return navigateToSolarObject(display.data?.id || display.id);
  if (display.kind === 'star') return navigateToStar(display.data || display);
  if (display.kind === 'galaxy') return navigateToGalaxy(display.data || display);
  if (display.kind === 'cluster' || display.kind === 'structure') return navigateToCluster(display.data || display);
  if (display.kind === 'nebula') return navigateToNebula(display.data || display);
  if (display.kind === 'exoplanet' || display.kind === 'system') return openExoSystem(display.system, display.system?._selectedPlanet);
}

function navigateHome() {
  if (APP.tour) exitTour();
  if (APP.domain !== 'earth') {
    ensureDomain('earth').then(() => {
      APP.earth.resetView();
      APP.inspector.open(presentEarth());
      APP.selection = { kind: 'earth', id: 'earth' };
      updateBreadcrumbs('Earth', 'Solar System', 'Milky Way');
    });
    return;
  }
  APP.earth.resetView();
  updateBreadcrumbs('Earth', 'Solar System', 'Milky Way');
}

/* Placeholders filled in as additional scenes are initialised. */
async function ensureDomain(domain) {
  if (domain === 'earth') {
    if (APP.domain !== 'earth') {
      if (APP.domain === 'solar') {
        await leaveSolarToEarth();
      } else {
        setDomain('earth');
        APP.earth.activate();
      }
    }
    return true;
  }
  if (domain === 'solar') {
    if (!APP.solar) await enterSolar();
    else if (APP.domain !== 'solar') {
      await runTransition('Solar System', () => activateDomain('solar', APP.solar));
      APP.solar.setScaleMode(APP.settings.solarScale);
    }
    return true;
  }
  showToast('Loading this region of the atlas…');
  return false;
}

async function navigateToSolarObject(id, opts = {}) {
  if (!id) return;
  await enterSolar({ targetId: id, announce: true });
  if (APP.domain !== 'solar') return;
  APP.solar.focusObject(id, { immediate: !!opts.immediate });
  const display = id === 'sun' ? presentSun() : (APP.solar.bodies.get(id)?.kind === 'moon' ? presentMoonById(id) : presentPlanetById(id));
  if (display) {
    APP.inspector.open(display);
    APP.selection = { kind: display.kind, id, data: display.data };
  }
  const data = APP.solar.bodies.get(id)?.data;
  updateBreadcrumbs(data?.name || (id === 'sun' ? 'Sun' : id), 'Solar System', 'Milky Way');
  APP.setCameraModeActive?.('orbit');
}

function systemForStar(star) {
  if (!APP.catalogs || !star) return null;
  const aliases = { 'Proxima Centauri': 'Proxima Cen', '51 Pegasi': '51 Peg' };
  return APP.catalogs.findSystem(star.name) || APP.catalogs.findSystem(aliases[star.name]) || null;
}

function enableDeepLayer(name) {
  if (!APP.deep) return;
  APP.deep.setLayer(name, true);
  APP.settings.layers[name] = true;
  const cb = document.querySelector(`.layer-row[data-layer="${name}"] input`);
  if (cb) cb.checked = true;
}

async function navigateToStar(starRaw) {
  let star = starRaw?.data || starRaw;
  if (!star) return;
  if (star.world == null && star.i != null && APP.catalogs) star = APP.catalogs.starIndex.named.find(s => s.i === star.i) || star;
  await enterDeep({ label: 'Stellar neighbourhood' });
  enableDeepLayer('stars');
  APP.deep.focusStar(star);
  const system = systemForStar(star);
  const display = presentStar(star, system);
  APP.inspector?.open(display);
  const id = star.hip ? `hip-${star.hip}` : `hyg-${star.i}`;
  APP.selection = { kind: 'star', id, data: star };
  updateDeepBreadcrumbs('stars', { star });
  updateTelemetry();
}

async function navigateToGalaxy(gRaw) {
  let g = gRaw?.data || gRaw;
  if (!g) return;
  if (g.id === 'milky-way' || g.name === 'Milky Way') {
    await enterDeep({ label: 'Milky Way' });
    enableDeepLayer('milkyway');
    APP.deep.focusMilkyWay();
    APP.inspector?.open(presentMilkyWay());
    APP.selection = { kind: 'galaxy', id: 'milky-way', data: g };
    updateDeepBreadcrumbs('galaxy', { galaxy: g });
    return;
  }
  await enterDeep({ label: 'Extragalactic atlas' });
  enableDeepLayer('localgroup');
  APP.deep.focusGalaxy(g);
  APP.inspector?.open(presentGalaxy(g));
  APP.selection = { kind: 'galaxy', id: g.id, data: g };
  const level = (g.distMpc || 0) < 100 ? 'local' : 'cosmic';
  updateDeepBreadcrumbs(level, { galaxy: g });
  updateTelemetry();
}

async function navigateToCluster(cRaw) {
  let c = cRaw?.data || cRaw;
  if (!c) return;
  await enterDeep({ label: 'Cosmic web' });
  enableDeepLayer('clusters');
  if (c.noPosition || c.id === 'great-wall' || !c.world) {
    APP.deep.focusWeb();
  } else {
    APP.deep.focusCluster(c);
  }
  APP.inspector?.open(presentCluster(c));
  APP.selection = { kind: 'cluster', id: c.id, data: c };
  updateDeepBreadcrumbs('cosmic', { cluster: c });
  updateTelemetry();
}

async function navigateToWeb() {
  await enterDeep({ label: 'Cosmic web' });
  enableDeepLayer('sdss');
  APP.deep.focusWeb();
  APP.inspector?.open(presentWeb(APP.catalogs?.sdssMeta ? { ...APP.catalogs.sdssMeta, count: APP.catalogs.sdss?.count } : null));
  APP.selection = { kind: 'structure', id: 'sdss-web', data: { id: 'sdss-web' } };
  updateDeepBreadcrumbs('cosmic');
  updateTelemetry();
}

async function navigateToNebula(n) {
  if (!n) return;
  await enterDeep({ label: 'Stellar neighbourhood' });
  enableDeepLayer('stars');
  const w = n.world || n.data?.world;
  if (w) {
    APP.deep.rig.setLimits(1e-9, 30);
    APP.deep.rig.focusOn(new THREE.Vector3(w.x, w.y, w.z), 0.00025, {
      duration: 1.6, yaw: APP.deep.rig.yaw, pitch: APP.deep.rig.pitch,
    });
    APP.deep.focusLevel = 'stars';
  }
  APP.inspector?.open(presentNebula(n));
  APP.selection = { kind: 'nebula', id: n.id, data: n };
  updateDeepBreadcrumbs('stars', { star: { name: n.name } });
}

function handleDeepSelection(info) {
  if (!info) {
    APP.selection = null;
    APP.inspector?.close();
    return;
  }
  if (info.kind === 'star') {
    const data = info.data;
    const system = systemForStar(data);
    const display = presentStar(data, system);
    APP.selection = { kind: 'star', id: display.id, data };
    APP.inspector?.open(display);
    updateDeepBreadcrumbs('stars', { star: data });
    updateTelemetry();
  } else if (info.kind === 'galaxy') {
    const g = info.data;
    const display = g?.id === 'milky-way' ? presentMilkyWay() : presentGalaxy(g);
    APP.selection = { kind: 'galaxy', id: g?.id, data: g };
    APP.inspector?.open(display);
    updateDeepBreadcrumbs(g?.id === 'milky-way' ? 'galaxy' : 'local', { galaxy: g });
    updateTelemetry();
  } else if (info.kind === 'cluster') {
    const c = info.data;
    APP.selection = { kind: 'cluster', id: c?.id, data: c };
    APP.inspector?.open(presentCluster(c));
    updateDeepBreadcrumbs('cosmic', { cluster: c });
    updateTelemetry();
  } else if (info.kind === 'system') {
    openExoSystem(info.system, info.system?.planets?.[0]);
  } else if (info.kind === 'sun') {
    const display = presentSun();
    display.actions = ['focus', 'compare', 'source'];
    display.provenance = { ...display.provenance, model: 'The Sun is shown as a marker at the centre of the stellar neighbourhood.' };
    APP.selection = { kind: 'sun', id: 'sun', data: null };
    APP.inspector?.open(display);
    updateDeepBreadcrumbs('stars', { star: { name: 'Sun' } });
  } else if (info.kind === 'structure') {
    APP.selection = { kind: 'structure', id: 'sdss-web', data: { id: 'sdss-web' } };
    APP.inspector?.open(presentWeb(APP.catalogs?.sdssMeta ? { ...APP.catalogs.sdssMeta, count: APP.catalogs.sdss?.count } : null));
  } else if (info.kind === 'sdss' || info.kind === 'quasar') {
    const d = { ...info.data };
    // Derive RA/Dec from the scene position for the catalogue card.
    if (d.world) {
      const rel = { x: d.world.x - SUN_SCENE_MPC.x, y: d.world.y - SUN_SCENE_MPC.y, z: d.world.z - SUN_SCENE_MPC.z };
      const gx = rel.x, gy = -rel.z, gz = rel.y;
      const eq = galacticToEquatorial(gx, gy, gz);
      const len = Math.hypot(eq.x, eq.y, eq.z) || 1;
      d.raDeg = (Math.atan2(eq.y, eq.x) * 180 / Math.PI + 360) % 360;
      d.decDeg = Math.asin(Math.max(-1, Math.min(1, eq.z / len))) * 180 / Math.PI;
    }
    APP.selection = { kind: info.kind, id: `survey-${info.data.index}`, data: d };
    APP.inspector?.open(presentSurveyPoint(d));
    updateTelemetry();
  }
}

async function openExoSystem(system, planet = null) {
  if (!system) return;
  if (APP.exo && APP.exoSystem?.host === system.host && APP.domain === 'exo') {
    if (planet) APP.exo.focusPlanet(planet.name);
    const display = planet ? presentExoplanet(planet, system) : presentExoSystem(system, planet || system.planets[0]);
    APP.inspector?.open(display);
    APP.selection = { kind: planet ? 'exoplanet' : 'system', id: planet?.name || system.host, data: planet || system, system };
    return;
  }
  showToast('Opening confirmed planetary system…');
  if (APP.exo) {
    APP.exo.deactivate();
    APP.exo.labels?.dispose();
  }
  const exo = new ExoScene({
    assets: APP.assets,
    canvas: $('#scene-canvas'),
    labelsContainer: $('#labels-layer'),
    getSettings: () => APP.settings,
    onSelect: handleExoSelection,
    onFocusChange: () => updateTelemetry(),
  });
  try {
    await exo.init(system, planet);
  } catch (err) {
    console.error('Exoplanet scene failed', err);
    showToast('This planetary system could not be rendered.', 'error');
    return;
  }
  APP.exo = exo;
  APP.exoSystem = system;
  await runTransition(`${system.host} system`, () => {
    activateDomain('exo', exo);
  });
  if (planet) exo.focusPlanet(planet.name);
  const display = planet ? presentExoplanet(planet, system) : presentExoSystem(system, planet || system.planets[0]);
  APP.inspector?.open(display);
  APP.selection = { kind: planet ? 'exoplanet' : 'system', id: planet?.name || system.host, data: planet || system, system };
  updateBreadcrumbs(system.host, 'Confirmed planetary system', system.distPc != null ? `${formatNumber(system.distPc * 3.26156, 1)} ly` : 'Distance uncertain');
  showToast('Artist’s visualization — surface appearance is not directly observed.', 'warn');
  updateTelemetry();
}

function handleExoSelection(info) {
  if (!info) { APP.selection = null; APP.inspector?.close(); return; }
  const system = APP.exoSystem;
  if (!system) return;
  let display;
  if (info.kind === 'exoplanet') display = presentExoplanet(info.data, system);
  else display = presentExoSystem(system, info.system?._selectedPlanet || system.planets[0]);
  APP.selection = { kind: info.kind, id: info.id, data: info.data, system };
  APP.inspector?.open(display);
  updateBreadcrumbs(system.host, 'Confirmed planetary system', system.distPc != null ? `${formatNumber(system.distPc * 3.26156, 1)} ly` : 'Distance uncertain');
  updateTelemetry();
}

async function exitExo() {
  if (!APP.exo) return;
  const sys = APP.exoSystem;
  if (APP.deep) {
    await runTransition('Stellar neighbourhood', () => {
      activateDomain('deep', APP.deep);
      if (sys?.world) {
        APP.deep.rig.setLimits(2e-10, 30000);
        APP.deep.rig.focusOn(new THREE.Vector3(sys.world.x, sys.world.y, sys.world.z), 7e-7, {
          duration: 1.4, yaw: APP.deep.rig.yaw, pitch: APP.deep.rig.pitch,
        });
        APP.deep.focusLevel = 'stars';
      }
      updateDeepBreadcrumbs('stars', { star: { name: sys?.host } });
      APP.inspector?.open(presentExoSystem(sys, sys.planets[0]));
      APP.selection = { kind: 'system', id: sys.host, data: sys, system: sys };
    });
  } else {
    await enterDeep({ label: 'Stellar neighbourhood' });
  }
}

function setDomain(domain) {
  APP.domain = domain;
  if (domain === 'earth') {
    APP.activeScene = APP.earth;
    APP.scene = APP.earth.scene;
    APP.camera = APP.earth.camera;
  }
}

function updateBreadcrumbs(current, parent, root) {
  $('[data-crumb="domain"]').textContent = current;
  $('[data-crumb="parent"]').textContent = parent;
  $('.crumb-root').textContent = root;
  $('[data-crumb="domain"]').classList.add('crumb-current');
}

function updateBreadcrumbsForFocus(id) {
  if (APP.domain !== 'earth') return;
  if (id === 'moon') {
    updateBreadcrumbs('Moon', 'Earth system', 'Milky Way');
    updateTelemetry();
  } else {
    updateBreadcrumbs('Earth', 'Solar System', 'Milky Way');
  }
}

/* -------------------------------------------------------------------------- */
/* Comparison                                                                */
/* -------------------------------------------------------------------------- */
function addComparison(display) {
  if (!display) return;
  if (APP.compare.some(x => x.id === display.id && x.kind === display.kind)) {
    showToast('This object is already in the comparison.');
    openComparePanel();
    return;
  }
  APP.compare.push(display);
  if (APP.compare.length > 2) APP.compare.shift();
  openComparePanel();
  renderComparison();
}

function openComparePanel() {
  const panel = document.getElementById('compare-panel');
  if (panel?.hidden) togglePanel('compare-panel');
  renderComparison();
}

function renderComparison() {
  const grid = $('#compare-grid');
  const empty = $('#compare-empty');
  if (!grid) return;
  if (!APP.compare.length) {
    grid.hidden = true;
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.hidden = false;
  grid.innerHTML = '';
  const cards = APP.compare.slice(0, 2);
  for (const display of cards) {
    const card = document.createElement('div');
    card.className = 'compare-card';
    const facts = pickComparisonFacts(display.facts || []);
    card.innerHTML = `<h3>${escapeHTML(display.name)}</h3><p>${escapeHTML(display.subtitle || '')}</p>${facts.map(f => `<div class="compare-row"><span>${escapeHTML(f.label)}</span><span class="mono">${escapeHTML(f.value)}</span></div>`).join('')}`;
    grid.appendChild(card);
  }
  if (cards.length === 1) {
    const card = document.createElement('div');
    card.className = 'compare-card compare-more';
    card.innerHTML = `<h3>Add a second object</h3><p>Select another object and choose Compare.</p>`;
    grid.appendChild(card);
  }
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'text-button muted';
  clear.style.gridColumn = '1 / -1';
  clear.textContent = 'Clear comparison';
  clear.addEventListener('click', () => {
    APP.compare = [];
    renderComparison();
  });
  grid.appendChild(clear);
}

function pickComparisonFacts(facts) {
  const keys = ['radius', 'diameter', 'mass', 'distance', 'temperature', 'period', 'morphology', 'type', 'satellite', 'redshift'];
  const picked = [];
  for (const key of keys) {
    const f = facts.find(f => f.label.toLowerCase().includes(key));
    if (f && !picked.includes(f)) picked.push(f);
  }
  if (picked.length < 5) {
    for (const f of facts) if (!picked.includes(f) && picked.length < 6) picked.push(f);
  }
  return picked.slice(0, 6);
}

/* -------------------------------------------------------------------------- */
/* Time / telemetry / status                                                 */
/* -------------------------------------------------------------------------- */
function setupCoordinates() {
  document.addEventListener('keydown', e => {
    if (APP.cosmos && !APP.cosmos.freeAtlas) return;
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'Escape') {
      closeSearchResults();
      APP.closeAllPanels?.();
      APP.closeTimePopover?.();
      APP.closeModeMenu?.();
      if (APP.inspector?.isOpen) APP.inspector.close();
      if (document.body.classList.contains('mode-cinematic')) setMode('explore');
    }
    if (e.key === '/') {
      e.preventDefault();
      $('#search-input').focus();
      renderSearch($('#search-input').value);
    }
    if (e.key.toLowerCase() === 'r') resetView();
    if (e.key.toLowerCase() === 'f' && APP.selection) {
      if (APP.selection.kind === 'earth' || APP.selection.kind === 'moon') {
        APP.earth.focusObject(APP.selection.kind);
      } else navigateToDisplay(APP.inspector?.current);
    }
    if (e.code === 'Space' && !e.target.closest('button')) {
      e.preventDefault();
      APP.time.toggle();
      updateTimeUI();
    }
  });
}

function setupStatus() {
  const reveal = () => { $('#status-corner')?.classList.add('visible'); };
  reveal();
}

function lookbackGyrForUi(z) {
  // Abridged flat-ΛCDM lookback approximation, matching the cosmology module.
  if (!(z > 0)) return 0;
  const H0 = 70, Om = 0.3, OL = 0.7;
  const E = zz => Math.sqrt(Om * Math.pow(1 + zz, 3) + OL);
  const n = 64, h = z / n;
  let s = 1 / ((1 + 0) * E(0)) + 1 / ((1 + z) * E(z));
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / ((1 + i * h) * E(i * h));
  return 13.9681 * s * h / 3;
}

function setTelemetryKeys(keys) {
  const els = $$('#telemetry-lines .telemetry-key');
  keys.forEach((k, i) => { if (els[i]) els[i].textContent = k; });
}

function updateTelemetry() {
  if (!APP.ready) return;
  if (APP.domain === 'exo' && APP.exo && APP.exoSystem) {
    const sys = APP.exoSystem;
    const planet = APP.selection?.kind === 'exoplanet' ? APP.selection.data : null;
    const report = APP.exo.getScaleReport();
    setTelemetryKeys(['Host', 'Distance', 'Planets', 'FOV']);
    $('#telemetry-title').textContent = 'Exoplanet system';
    $('#telemetry-mode').textContent = planet?.name || 'System overview';
    $('#tel-lat').textContent = sys.host;
    $('#tel-lon').textContent = sys.distPc != null ? `${formatNumber(sys.distPc * 3.26156, 1)} ly` : '—';
    $('#tel-alt').textContent = `${sys.planets.length}`;
    $('#tel-sun').textContent = formatDistance(report.scaleMeters);
    $('#tel-extra').textContent = 'Artist’s visualization · orbital phase illustrative · bodies enlarged for visibility';
    $('#status-scale').textContent = formatDistance(report.scaleMeters);
    return;
  }

  if (APP.domain === 'exo' && APP.exo && APP.exoSystem) {
    const sys = APP.exoSystem;
    const outer = APP.exo.orbitOuter;
    note.innerHTML = `<strong>Scale reference · ${sys.host}</strong><br/>
      Orbital distances use published semi-major axes. This view is an artist’s visualization: planet surfaces have not been directly observed, and body sizes are enlarged for visibility.<br/>
      Outer plotted orbit: ${formatNumber(outer, 3)} AU. ${sys.planets.length} confirmed planet${sys.planets.length === 1 ? '' : 's'} in this system.`;
    note.hidden = false;
    return;
  }
  if (APP.domain === 'deep' && APP.deep) {
    const level = APP.deep.getLevel();
    const report = APP.deep.getScaleReport();
    const sel = APP.selection;
    const title = level === 'stars' ? 'Stellar atlas' : level === 'galaxy' ? 'Milky Way' : level === 'local' ? 'Galactic neighbourhood' : level === 'cosmic' ? 'Cosmic web' : 'Observable universe';
    $('#telemetry-title').textContent = title;
    $('#telemetry-mode').textContent = level === 'stars' ? 'HYG catalogue' : level === 'cosmic' || level === 'observable' ? 'SDSS DR18' : 'NED · models';
    const mly = mpc => Number.isFinite(mpc) ? `${formatNumber(mpc * 3.26156, mpc < 10 ? 2 : 1)} Mly` : '—';
    if (sel?.kind === 'star' || sel?.kind === 'system') {
      const st = sel.kind === 'system' ? sel.data?.planets?.[0] : sel.data;
      const star = sel.kind === 'system' ? sel.data : sel.data;
      const dPc = star?.distPc ?? null;
      setTelemetryKeys(['Focus', 'Distance', 'Spectral', 'FOV']);
      $('#tel-lat').textContent = sel.kind === 'system' ? (sel.data?.host || 'System') : (star?.name || 'Star');
      $('#tel-lon').textContent = dPc != null ? `${formatNumber(dPc * 3.26156, 2)} ly` : '—';
      $('#tel-alt').textContent = (star?.spect || star?.teffK || '—').toString();
      $('#tel-sun').textContent = formatDistance(report.scaleMeters);
      $('#tel-extra').textContent = 'HYG v4.1 · distances from parallax · uncertain for distant stars';
    } else if (sel?.kind === 'galaxy') {
      const g = sel.data;
      setTelemetryKeys(['Focus', 'Distance', 'Lookback', 'FOV']);
      $('#tel-lat').textContent = g?.name || '—';
      $('#tel-lon').textContent = mly(g?.distMpc);
      $('#tel-alt').textContent = Number.isFinite(g?.lookbackGyr) ? `${formatNumber(g.lookbackGyr, 2)} Gyr` : '—';
      $('#tel-sun').textContent = formatDistance(report.scaleMeters);
      $('#tel-extra').textContent = 'Positions from NED/measured distances · 3D structure is illustrative';
    } else if (sel?.kind === 'cluster') {
      const c = sel.data;
      setTelemetryKeys(['Focus', 'Distance', 'Lookback', 'FOV']);
      $('#tel-lat').textContent = c?.name || '—';
      $('#tel-lon').textContent = mly(c?.computedDistanceMpc);
      $('#tel-alt').textContent = Number.isFinite(c?.lookbackGyr) ? `${formatNumber(c.lookbackGyr, 2)} Gyr` : '—';
      $('#tel-sun').textContent = formatDistance(report.scaleMeters);
      $('#tel-extra').textContent = 'Comoving distances · flat ΛCDM · cluster members are not all plotted';
    } else if (sel?.kind === 'sdss' || sel?.kind === 'quasar') {
      const d = sel.data;
      setTelemetryKeys(['Object', 'Redshift', 'Lookback', 'FOV']);
      $('#tel-lat').textContent = sel.kind === 'quasar' ? 'Quasar' : 'Galaxy';
      $('#tel-lon').textContent = Number.isFinite(d?.z) ? d.z.toFixed(4) : '—';
      $('#tel-alt').textContent = Number.isFinite(d?.z) && d.z > 0 ? `${formatNumber(lookbackGyrForUi(d.z), 2)} Gyr` : '—';
      $('#tel-sun').textContent = formatDistance(report.scaleMeters);
      $('#tel-extra').textContent = 'SDSS spectroscopic object · real catalogue position';
    } else {
      setTelemetryKeys(['Level', 'Field of view', 'Distance scale', 'Data']);
      $('#tel-lat').textContent = mly ? (level === 'stars' ? 'Local neighbourhood' : level === 'galaxy' ? 'Milky Way' : level === 'local' ? 'Local Group' : level === 'cosmic' ? 'Cosmic web' : 'Observable universe') : '—';
      $('#tel-lon').textContent = formatDistance(report.scaleMeters);
      $('#tel-alt').textContent = report.label;
      $('#tel-sun').textContent = 'HYG · SDSS';
      $('#tel-extra').textContent = level === 'cosmic' || level === 'observable'
        ? 'The SDSS survey covers a partial sky; empty space does not mean absence.'
        : 'Catalogue stars are real positions; the Milky Way disk is a schematic model.';
    }
    $('#status-scale').textContent = formatDistance(report.scaleMeters);
    return;
  }

  if (APP.domain === 'solar' && APP.solar) {
    setTelemetryKeys(['Focus', 'Sun dist', 'Light', 'Rate']);
    const body = APP.solar.bodies.get(APP.solar.focusId);
    const name = body?.name || 'Solar System';
    $('#telemetry-title').textContent = 'Solar System';
    $('#telemetry-mode').textContent = APP.solar.scaleMode === 'educational' ? 'enhanced scale' : 'true scale';
    const dAU = body && body.id !== 'sun' ? body.group.position.length() : 0;
    const lightMin = dAU * AU_KM / 299792.458 / 60;
    const light = dAU === 0 ? '—' : lightMin < 60 ? `${lightMin.toFixed(1)} min` : `${(lightMin / 60).toFixed(2)} h`;
    $('#tel-lat').textContent = name;
    $('#tel-lon').textContent = `${dAU.toFixed(dAU < 10 ? 3 : 1)} AU`;
    $('#tel-alt').textContent = light;
    $('#tel-sun').textContent = `${APP.time.speed.toLocaleString('en-US')}×`;
    $('#tel-extra').textContent = APP.solar.scaleMode === 'educational'
      ? 'Approximate Keplerian positions · body sizes & moon orbits ×30 (Sun ×8)'
      : 'Approximate Keplerian positions · physical sizes and distances';
    const report = APP.solar.getScaleReport();
    $('#status-scale').textContent = `${APP.solar.rig.distance < 0.01 ? formatDistance(APP.solar.rig.distance * AU_M) : APP.solar.rig.distance.toFixed(2) + ' AU'} · FOV ${formatDistance(report.scaleMeters)}`;
    return;
  }
  if (!APP.earth) return;
  setTelemetryKeys(['Lat', 'Lon', 'Alt', 'Sun']);
  const earth = APP.earth;
  const isMoon = APP.selection?.kind === 'moon' && APP.domain === 'earth';
  $('#telemetry-title').textContent = isMoon ? 'Lunar observer' : 'Observer';
  $('#telemetry-mode').textContent = isMoon ? 'Moon orbit' : 'Earth orbit';
  $('#tel-alt').textContent = `${formatNumber(Math.max(0, (earth.rig.distance - 1) * EARTH_RADIUS_KM), 0)} km`;
  let lat, lon, sunEl;
  if (APP.hover?.visible) {
    lat = APP.hover.latDeg;
    lon = APP.hover.lonDeg;
    sunEl = APP.hover.sunElevationDeg;
  } else {
    const local = earth.camera.position.clone();
    earth.earthMesh.worldToLocal(local);
    const ll = earthLatLonFromLocal(local);
    lat = ll.latDeg; lon = ll.lonDeg;
    const n = local.clone().normalize();
    const sun = earth.earthMaterial.uniforms.uSunDir.value;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -earth.earthMesh.rotation.y);
    const sunLocal = sun.clone().applyQuaternion(q);
    sunEl = Math.asin(Math.max(-1, Math.min(1, n.dot(sunLocal)))) * 180 / Math.PI;
  }
  $('#tel-lat').textContent = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
  $('#tel-lon').textContent = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
  $('#tel-sun').textContent = `${sunEl >= 0 ? '+' : ''}${sunEl.toFixed(1)}°`;
  $('#tel-extra').textContent = APP.hover?.visible
    ? 'Surface coordinate under cursor'
    : isMoon ? 'Low-precision lunar orbit · labelled in atlas'
      : 'Sub-observer point · move across the globe';
  const report = earth.getScaleReport();
  $('#status-scale').textContent = `${earth.rig.distance.toFixed(2)} R⊕ · ${formatDistance(report.scaleMeters)}`;
}

function updateStatus() {
  if (!APP.engine) return;
  $('#status-quality').textContent = APP.settings.quality === 'auto' ? `Auto · ${Math.round(APP.engine.dynamicScale * 100)}%` : (QUALITY_PRESETS[APP.settings.quality]?.name || '');
}

function updateBreadcrumbsAfterResize() {}

function updateDataChips() {
  if (!APP.catalogsReady) return;
  const el = $('#data-chips');
  if (APP.domain === 'earth') el.textContent = 'NASA · HYG';
  else if (APP.domain === 'solar') el.textContent = 'JPL · NASA';
  else if (APP.domain === 'deep') el.textContent = 'HYG · SDSS · NED';
  else if (APP.domain === 'exo') el.textContent = 'NASA · EXOPLANETS';
  else el.textContent = 'HYG · SDSS · NED';
}

function updateScaleUI() {
  if (!APP.ready) return;
  const report = APP.activeScene?.getScaleReport?.();
  if (!report) return;
  const meters = Math.max(1e6, Math.min(1e27, report.scaleMeters));
  const log = Math.log10(meters);
  const thumb = $('#scale-thumb');
  const progress = $('#scale-progress');
  const pos = logToRailPos(log);
  if (thumb) thumb.style.top = `${pos}%`;
  if (progress) progress.style.height = `${100 - pos}%`;
  const range = $('#scale-range');
  if (range && document.activeElement !== range) range.value = String(log);
  const stop = APP.domain === 'solar'
    ? (SCALE_LEVELS.find(l => l.id === 'solar-system') || SCALE_LEVELS[0])
    : SCALE_LEVELS.reduce((best, l) => Math.abs(Math.log10(l.meters) - log) < Math.abs(Math.log10(best.meters) - log) ? l : best, SCALE_LEVELS[0]);
  $('#scale-value').textContent = formatDistance(meters);
  $('#scale-caption').textContent = APP.domain === 'exo' ? 'Exoplanet system' : stop.label;
  if (range) range.setAttribute('aria-valuetext', `${stop.label}, ${formatDistance(meters)}`);
  updateScaleStops(log);
}

async function navigateToScale(log) {
  if (!APP.ready) return;
  const meters = Math.pow(10, log);
  if (meters <= 1.12e9) {
    if (APP.domain !== 'earth') await ensureDomain('earth');
    const fov = APP.earth.camera.fov * Math.PI / 180;
    const dUnits = meters / (2 * EARTH_RADIUS_KM * 1000 * Math.tan(fov / 2));
    APP.earth.rig.targetDistance = Math.max(1.04, Math.min(95, dUnits));
    updateScaleUI();
    return;
  }
  if (meters <= 2.0e14) {
    const fov = 45 * Math.PI / 180;
    const dAU = Math.max(1e-5, Math.min(220, meters / AU_M / (2 * Math.tan(fov / 2))));
    if (APP.domain !== 'solar') {
      await enterSolar({ distance: dAU });
    }
    if (APP.solar) {
      APP.solar.rig.follow = null;
      APP.solar.focusId = 'sun';
      APP.solar.rig.setLimits(0.000006, 220);
      APP.solar.rig.focusOn(new THREE.Vector3(0, 0, 0), dAU, { duration: 0.9, yaw: 0.72, pitch: 0.85 });
    }
    updateBreadcrumbs('Solar System', 'Orion Arm', 'Milky Way');
    updateScaleUI();
    return;
  }
  const deepLabel = meters < 1e20 ? 'Stellar neighbourhood' : meters < 1e22 ? 'Milky Way' : meters < 2e24 ? 'Local Group' : meters < 5e26 ? 'Cosmic web' : 'Observable universe';
  await enterDeep({ label: deepLabel });
  APP.deep.setScaleMeters(meters);
  updateDeepBreadcrumbs(APP.deep.focusLevel || APP.deep.getLevel());
  updateScaleUI();
  updateTimeUI();
}

/* The legacy/free atlas labels are DOM buttons above the canvas.
   They keep pointer-events:auto so click selection still works, but that means
   a wheel gesture over a label targets the label, not #scene-canvas. Forward
   those wheel events to the active rig instead of letting the zoom gesture die. */
function setupLabelWheelBridge() {
  document.addEventListener('wheel', event => {
    if (!APP.cosmos?.freeAtlas) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.sky-label')) return;
    const rig = APP.activeScene?.rig;
    if (!rig?.enabled) return;
    event.preventDefault();
    rig._onWheel(event);
  }, { passive: false, capture: true });
}

/* Continuous zoom: scrolling past a scene's zoom limit moves to the next scale. */
function setupZoomHandoffs() {
  window.addEventListener('cosmos:zoomlimit', (ev) => {
    if (!APP.ready || APP.transitioning || APP.tour || APP.cosmos?.freeAtlas) return;
    const { dir, rig } = ev.detail || {};
    if (!rig) return;
    if (dir === 'out') {
      if (APP.domain === 'earth' && rig === APP.earth?.rig) {
        showToast('Leaving Earth — entering the Solar System.');
        navigateToScale(Math.log10(3e12));
      } else if (APP.domain === 'solar' && rig === APP.solar?.rig) {
        showToast('Leaving the Solar System — entering the stellar neighbourhood.');
        navigateToScale(17);
      }
    } else if (dir === 'in') {
      if (APP.domain === 'solar' && rig === APP.solar?.rig && APP.solar.focusId === 'earth') {
        showToast('Descending to Earth.');
        navigateToScale(Math.log10(3e7));
      }
    }
  });
}

function setupKeyboard() {}
function setupCoordinatesKeyboard() {}

function resetView() {
  if (APP.domain === 'exo' && APP.exo) {
    APP.exo.rig.setFreeFlight(false);
    APP.exo.rig.follow = null;
    APP.exo.rig.autoRotate = false;
    APP.exo.resetView();
    APP.setCameraModeActive?.('orbit');
    showToast('System view reset.');
    return;
  }
  if (APP.domain === 'deep' && APP.deep) {
    APP.deep.rig.setFreeFlight(false);
    APP.deep.rig.follow = null;
    APP.deep.rig.autoRotate = false;
    APP.deep.resetView();
    APP.selection = null;
    APP.inspector?.close();
    APP.setCameraModeActive?.('orbit');
    updateDeepBreadcrumbs('stars');
    showToast('View reset — stellar neighbourhood.');
    return;
  }
  if (APP.domain === 'solar' && APP.solar) {
    APP.solar.rig.setFreeFlight(false);
    APP.solar.rig.follow = null;
    APP.solar.rig.autoRotate = false;
    APP.solar.resetView();
    APP.setCameraModeActive?.('orbit');
    updateBreadcrumbs('Solar System', 'Orion Arm', 'Milky Way');
    showToast('View reset — Solar System overview.');
    return;
  }
  if (APP.domain === 'earth') {
    APP.earth.rig.freeFlight = false;
    APP.earth.rig.follow = null;
    APP.earth.rig.autoRotate = false;
    APP.earth.resetView();
    APP.setCameraModeActive?.('orbit');
    updateBreadcrumbs('Earth', 'Solar System', 'Milky Way');
    showToast('View reset.');
    return;
  }
  APP.onResetView?.();
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    el.requestFullscreen?.().catch(() => showToast('Fullscreen is unavailable in this browser.', 'warn'));
  } else {
    document.exitFullscreen?.();
  }
}

/* -------------------------------------------------------------------------- */
/* Context notes + toasts                                                    */
/* -------------------------------------------------------------------------- */
function showContextNote() {
  const note = $('#context-note');
  if (APP.domain === 'exo' && APP.exo && APP.exoSystem) {
    const sys = APP.exoSystem;
    const outer = APP.exo.orbitOuter;
    note.innerHTML = `<strong>Scale reference · ${sys.host}</strong><br/>
      Orbital distances use published semi-major axes. This view is an artist’s visualization: planet surfaces have not been directly observed, and body sizes are enlarged for visibility.<br/>
      Outer plotted orbit: ${formatNumber(outer, 3)} AU. ${sys.planets.length} confirmed planet${sys.planets.length === 1 ? '' : 's'} in this system.`;
    note.hidden = false;
    return;
  }
  if (APP.domain === 'deep' && APP.deep) {
    const level = APP.deep.getLevel();
    const r = APP.deep.getScaleReport();
    if (level === 'observable') {
      note.innerHTML = `<strong>Scale reference · observable universe</strong><br/>
        The comoving horizon is about 46.5 billion light-years in radius. We see the oldest light from every direction; this is an observational boundary in time and space, not a physical wall.<br/>
        Current field of view: ${formatDistance(r.scaleMeters)}.`;
    } else if (level === 'cosmic') {
      note.innerHTML = `<strong>Scale reference · cosmic web</strong><br/>
        SDSS galaxies trace filaments and voids within the survey footprint. Distances are comoving; 1 Mpc is 3.26 million light-years.<br/>
        The observable universe extends far beyond this sample. Current field of view: ${formatDistance(r.scaleMeters)}.`;
    } else if (level === 'local' || level === 'galaxy') {
      note.innerHTML = `<strong>Scale reference · galaxies</strong><br/>
        A light-year is about 9.46 trillion km. The Milky Way is roughly 100,000 light-years across; Andromeda lies 2.5 million light-years away.<br/>
        Galaxy shapes are illustrative 3D models anchored to real positions. Current field of view: ${formatDistance(r.scaleMeters)}.`;
    } else {
      note.innerHTML = `<strong>Scale reference · stellar neighbourhood</strong><br/>
        One parsec is 3.26 light-years; the nearest star beyond the Sun, Proxima Centauri, is 4.24 light-years away. Star positions come from the HYG catalogue.<br/>
        Current field of view: ${formatDistance(r.scaleMeters)}.`;
    }
    note.hidden = false;
    return;
  }
  if (APP.domain === 'solar' && APP.solar) {
    const r = APP.solar.getScaleReport();
    const body = APP.solar.bodies.get(APP.solar.focusId);
    const dAU = body && body.id !== 'sun' ? body.group.position.length() : 0;
    note.innerHTML = `<strong>Scale reference · Solar System</strong><br/>
      The Sun is 1.39 million km across. Neptune orbits at 30.1 AU — about 4.5 billion km from the Sun.<br/>
      Interplanetary distances are true. ${APP.settings.solarScale === 'educational' ? 'Body sizes and moon orbits are enlarged ×30 (the Sun ×8) for visibility.' : 'Body sizes are true scale; beacons mark small worlds.'}<br/>
      Current field of view: ${formatDistance(r.scaleMeters)}${dAU ? ` · ${body.name} is ${dAU.toFixed(2)} AU from the Sun.` : '.'}`;
    note.hidden = false;
    return;
  }
  if (!APP.earth) return;
  const r = APP.earth.getScaleReport();
  note.innerHTML = `<strong>Scale reference · Earth</strong><br/>
    Earth’s diameter is 12,742 km. The Moon orbits at a mean distance of 384,400 km — about 30 Earth diameters away. Light crosses that gap in 1.28 seconds.<br/>
    Current field of view: ${formatDistance(r.scaleMeters)}.`;
  note.hidden = false;
}

function showToast(message, type = '', duration = 3600) {
  const el = $('#toast');
  if (!el) return;
  el.className = 'toast' + (type ? ` ${type}` : '');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(APP.toastTimer);
  APP.toastTimer = setTimeout(() => { el.hidden = true; }, duration);
}

/* -------------------------------------------------------------------------- */
/* Tours (rendering; execution hooks added with the other scenes)            */
/* -------------------------------------------------------------------------- */
function renderTourList() {
  const list = $('#tour-list');
  if (!list) return;
  list.innerHTML = '';
  for (const tour of TOURS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tour-option';
    b.innerHTML = `<span class="tour-num">${tour.number}</span>
      <span><strong>${tour.title}</strong><small>${tour.subtitle} · ${tour.duration}</small></span>
      <svg class="icon"><use href="#i-chevron-right"/></svg>`;
    b.addEventListener('click', () => startTour(tour));
    list.appendChild(b);
  }
}

async function resolveTourStop(stop) {
  if (!stop) return false;
  const mode = stop.mode;
  const target = stop.target;
  if (mode === 'earth') {
    await ensureDomain('earth');
    APP.earth.focusObject(target === 'moon' ? 'moon' : 'earth', { duration: 1.4 });
    updateBreadcrumbs(target === 'moon' ? 'Moon' : 'Earth', target === 'moon' ? 'Earth system' : 'Solar System', 'Milky Way');
    return true;
  }
  if (mode === 'solar') {
    if (target === 'sun') {
      await navigateToSolarObject('sun');
      return true;
    }
    await navigateToSolarObject(target);
    return true;
  }
  if (mode === 'stars') {
    const star = APP.catalogs?.findStar(target);
    if (!star) return false;
    const data = star.i != null ? (APP.catalogs.starIndex.named.find(x => x.i === star.i) || star) : star;
    await navigateToStar(data);
    return true;
  }
  if (mode === 'exo') {
    const aliases = { 'Proxima b': 'Proxima Cen b' };
    const wanted = aliases[target] || target;
    const found = APP.catalogs?.findPlanet(wanted) || APP.catalogs?.findPlanet(target.replace(/\s+/g, ' '));
    if (!found) return false;
    await openExoSystem(found.system, found.planet);
    return true;
  }
  if (mode === 'galaxy') {
    if (target === 'milky-way') { await navigateToGalaxy({ id: 'milky-way' }); return true; }
    const g = GALAXIES.find(x => x.id === target || x.name === target || (x.aliases || []).includes(target));
    if (!g) return false;
    await navigateToGalaxy(g);
    return true;
  }
  if (mode === 'cosmos') {
    if (target === 'sdss-web') { await navigateToWeb(); return true; }
    const g = GALAXIES.find(x => x.id === target || x.name === target || (x.aliases || []).includes(target));
    if (g) { await navigateToGalaxy(g); return true; }
    const c = CLUSTERS.find(x => x.id === target || x.name === target || (x.aliases || []).includes(target));
    if (c) { await navigateToCluster(c); return true; }
    if (/milky/i.test(target)) { await navigateToGalaxy({ id: 'milky-way' }); return true; }
    return false;
  }
  return false;
}

function updateTourCard() {
  const tour = APP.tour;
  if (!tour) { $('#tour-card').hidden = true; return; }
  const stop = tour.stops[APP.tourIndex];
  const card = $('#tour-card');
  card.hidden = false;
  $('#tour-number').textContent = `Journey ${tour.number}`;
  $('#tour-title').textContent = stop?.title || tour.title;
  $('#tour-text').textContent = stop?.text || '';
  $('#tour-progress-text').textContent = `${APP.tourIndex + 1} / ${tour.stops.length}`;
  $('#tour-progress-bar').style.width = `${((APP.tourIndex + 1) / tour.stops.length) * 100}%`;
  $('#tour-prev').disabled = APP.tourIndex === 0;
  $('#tour-prev').style.opacity = APP.tourIndex === 0 ? '0.35' : '';
  $('#tour-next').textContent = APP.tourIndex === tour.stops.length - 1 ? 'Finish' : 'Next';
}

async function goToTourStop(index) {
  const tour = APP.tour;
  if (!tour) return;
  if (index < 0 || index >= tour.stops.length) return;
  APP.tourIndex = index;
  updateTourCard();
  const token = ++APP.tourToken;
  const stop = tour.stops[index];
  try {
    const ok = await resolveTourStop(stop);
    if (token !== APP.tourToken || !APP.tour) return;
    if (!ok) showToast(`“${stop.title}” could not be reached — the catalogue entry may be unavailable.`, 'warn');
    else {
      APP.inspector?.close();
      updateTourCard();
    }
  } catch (e) {
    console.error('Tour stop failed', e);
    if (token === APP.tourToken) showToast('This journey stop could not be loaded.', 'warn');
  }
}

function startTour(tour) {
  APP.closeAllPanels?.();
  APP.tour = tour;
  APP.tourIndex = 0;
  APP.tourToken = 0;
  setMode('explore');
  showToast(`Journey ${tour.number} — ${tour.title}`);
  updateTourCard();
  goToTourStop(0);
}

function exitTour() {
  APP.tour = null;
  APP.tourToken = ++APP.tourToken || 0;
  $('#tour-card').hidden = true;
  APP.onExitTour?.();
}

/* -------------------------------------------------------------------------- */
/* Utilities                                                                 */
/* -------------------------------------------------------------------------- */
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function loadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

/* Public hooks for the scene modules to integrate without cyclic imports. */
APP.hooks = {
  setDomain,
  showToast,
  getAssets: () => APP.assets,
  getTime: () => APP.time,
  getCatalogs: () => APP.catalogs,
  getInspector: () => APP.inspector,
  getEngine: () => APP.engine,
  getSettings: () => APP.settings,
  setSelection: sel => { APP.selection = sel; },
  addComparison,
  closePanels: () => APP.closeAllPanels?.(),
  setCurrentScene: (active) => {
    APP.activeScene = active;
    APP.scene = active.scene;
    APP.camera = active.camera;
    APP.engine.setScene(active.scene, active.camera);
  },
  getActiveScene: () => APP.activeScene,
  updateBreadcrumbs,
  refreshSearch: () => setupSearch(),
};

boot();

window.EON = APP;
window.COSMOS = APP.cosmos;
