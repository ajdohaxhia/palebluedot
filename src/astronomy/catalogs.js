/**
 * Catalogue loading and in-memory indexing.
 * Raw sources are transformed at build time by scripts/build_data.mjs.
 */

import {
  GALAXIES, CLUSTERS, NEBULAE, MILKY_WAY, SUN, PLANETS, DWARF_PLANETS,
  MOONS, SCALE_LEVELS, OBSERVABLE_UNIVERSE_RADIUS_MPC, PC_M,
} from '../data/featured.js';
import {
  raDecDistanceMpcToWorld, raDecParsecsToWorld, raDecKpcToWorld,
  equatorialHelioPcToWorldMpc, equatorialMpcToScene, SUN_SCENE_MPC,
} from './coordinates.js';
import { comovingDistanceMpc, lookbackGyr } from './cosmology.js';

const textDecoder = new TextDecoder();

export class Catalogs {
  constructor(base = './data/') {
    this.base = base;
    this.stars = null;
    this.starIndex = null;
    this.exo = null;
    this.sdss = null;
    this.quasars = null;
    this.manifest = null;
    this.loaded = false;
    this.byName = new Map();
    this._search = null;
  }

  async load(onProgress = () => {}) {
    const steps = 5;
    let done = 0;
    const tick = label => {
      done++;
      onProgress(done / steps, label);
    };
    const [starBuf, starIndex, exo, sdss, sdssMeta, manifest] = await Promise.all([
      fetch(`${this.base}stars.bin`).then(r => {
        if (!r.ok) throw new Error(`stars.bin ${r.status}`);
        return r.arrayBuffer();
      }),
      fetch(`${this.base}stars_index.json`).then(r => r.json()),
      fetch(`${this.base}exoplanets.json`).then(r => r.json()),
      fetch(`${this.base}sdss_galaxies.bin`).then(r => r.arrayBuffer()),
      fetch(`${this.base}sdss_galaxies.json`).then(r => r.json()),
      fetch(`${this.base}manifest.json`).then(r => r.json()),
    ]);
    tick('stellar catalogue');
    this.starIndex = starIndex;
    this.manifest = manifest;
    this.exo = exo;
    this.sdssMeta = sdssMeta;
    this._decodeStars(starBuf);
    tick('Gaia neighbourhood');
    this._decodeSDSS(sdss, sdssMeta);
    tick('SDSS cosmic web');
    // Optional quasar supplement; absence is handled honestly.
    try {
      const qbuf = await fetch(`${this.base}sdss_quasars.bin`).then(r => r.ok ? r.arrayBuffer() : null);
      if (qbuf) {
        const qmeta = await fetch(`${this.base}sdss_quasars.json`).then(r => r.json());
        this.quasars = this._decodePointCloud(qbuf, qmeta, 'EONQSO01');
        this.quasarMeta = qmeta;
      }
    } catch (e) {
      console.warn('Quasar supplement unavailable:', e.message);
    }
    tick('distant universe');

    this._buildObjectIndex();
    tick('atlas index');
    this.loaded = true;
    return this;
  }

  async loadBackground() {
    // Reserved for future larger survey tiles. Current data is bundled.
    return true;
  }

  _decodeStars(buffer) {
    const header = new DataView(buffer, 0, 128);
    const count = header.getUint32(12, true);
    const o = {
      pos: header.getUint32(20, true),
      mag: header.getUint32(24, true),
      abs: header.getUint32(28, true),
      ci: header.getUint32(32, true),
      lum: header.getUint32(36, true),
      color: header.getUint32(40, true),
      hip: header.getUint32(44, true),
      hd: header.getUint32(48, true),
      hr: header.getUint32(52, true),
      spect: header.getUint32(56, true),
      named: header.getUint32(60, true),
    };
    const rawPos = new Float32Array(buffer, o.pos, count * 3);
    const mag = new Float32Array(buffer, o.mag, count);
    const absmag = new Float32Array(buffer, o.abs, count);
    const ci = new Float32Array(buffer, o.ci, count);
    const lum = new Float32Array(buffer, o.lum, count);
    const colors = new Uint8Array(buffer, o.color, count * 3);
    const hip = new Int32Array(buffer, o.hip, count);
    const hd = new Int32Array(buffer, o.hd, count);
    const hr = new Int32Array(buffer, o.hr, count);
    const spectIdx = new Uint16Array(buffer, o.spect, count);
    const namedIdx = new Int32Array(buffer, o.named, count);

    // World positions in Mpc, galactic frame.
    const world = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = equatorialHelioPcToWorldMpc(rawPos[i * 3], rawPos[i * 3 + 1], rawPos[i * 3 + 2]);
      world[i * 3] = p.x;
      world[i * 3 + 1] = p.y;
      world[i * 3 + 2] = p.z;
    }
    this.stars = {
      count, rawPos, world, mag, absmag, ci, lum, colors, hip, hd, hr,
      spectIdx, namedIdx, spectra: this.starIndex.spectra,
      named: this.starIndex.named,
      hipMap: new Map(), hdMap: new Map(), hrMap: new Map(),
    };
    for (let i = 0; i < count; i++) {
      if (hip[i] > 0) this.stars.hipMap.set(hip[i], i);
      if (hd[i] > 0) this.stars.hdMap.set(hd[i], i);
      if (hr[i] > 0) this.stars.hrMap.set(hr[i], i);
    }
    this.stars.hipValues = hip;
    // Name lookup.
    this.starNameMap = new Map();
    for (const s of this.starIndex.named) {
      this.starNameMap.set(norm(s.name), s);
      if (s.proper) this.starNameMap.set(norm(s.proper), s);
      if (s.bayer && s.con) this.starNameMap.set(norm(`${s.bayer} ${s.con}`), s);
    }
    // Stationary positions need Mpc values for labels.
    for (const s of this.starIndex.named) {
      const w = this.starWorld(s.i);
      s.world = w;
    }
  }

  starWorld(index) {
    const s = this.stars;
    return {
      x: s.world[index * 3],
      y: s.world[index * 3 + 1],
      z: s.world[index * 3 + 2],
    };
  }

  _decodeSDSS(buffer, meta) {
    const header = new DataView(buffer, 0, 64);
    const magic = textDecoder.decode(new Uint8Array(buffer, 0, 8));
    if (magic !== 'EONGAL01') throw new Error('Bad SDSS binary');
    const count = header.getUint32(12, true);
    const src = new Float32Array(buffer, 64, count * 4);
    const world = new Float32Array(count * 3);
    const zred = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const eq = { x: src[i * 4], y: src[i * 4 + 1], z: src[i * 4 + 2] };
      const w = equatorialMpcToScene(eq.x, eq.y, eq.z);
      world[i * 3] = SUN_SCENE_MPC.x + w.x;
      world[i * 3 + 1] = SUN_SCENE_MPC.y + w.y;
      world[i * 3 + 2] = SUN_SCENE_MPC.z + w.z;
      zred[i] = src[i * 4 + 3];
    }
    this.sdss = { count, world, zred, meta };
  }

  _decodePointCloud(buffer, meta, expectedMagic) {
    const magic = textDecoder.decode(new Uint8Array(buffer, 0, 8));
    if (magic !== expectedMagic) throw new Error('Bad point-cloud binary');
    const header = new DataView(buffer, 0, 64);
    const count = header.getUint32(12, true);
    const src = new Float32Array(buffer, 64, count * 4);
    const world = new Float32Array(count * 3);
    const zred = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const w = equatorialMpcToScene(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
      world[i * 3] = SUN_SCENE_MPC.x + w.x;
      world[i * 3 + 1] = SUN_SCENE_MPC.y + w.y;
      world[i * 3 + 2] = SUN_SCENE_MPC.z + w.z;
      zred[i] = src[i * 4 + 3];
    }
    return { count, world, zred, meta };
  }

  _buildObjectIndex() {
    // Planets, moons, Sun.
    const objects = [];
    objects.push({
      id: 'sun', kind: 'star', name: 'Sun', type: 'G2V star', domain: 'solar',
      distanceLabel: '8.32 light-minutes from Earth', description: SUN.description,
      importance: 10, data: SUN,
    });
    for (const p of [...PLANETS, ...DWARF_PLANETS]) {
      objects.push({
        id: p.id, kind: p.kind, name: p.name, type: p.type, domain: 'solar',
        distanceLabel: `${p.semiMajorAU.toFixed(p.semiMajorAU < 10 ? 3 : 2)} AU from the Sun`,
        importance: p.id === 'earth' ? 10 : 8,
        data: p,
      });
    }
    for (const m of MOONS) {
      objects.push({
        id: m.id, kind: 'moon', name: m.name, type: m.type, domain: 'earth',
        distanceLabel: `Moon of ${m.parent.charAt(0).toUpperCase() + m.parent.slice(1)}`,
        importance: 5, data: m,
      });
    }
    // Curated galaxies.
    for (const g of GALAXIES) {
      objects.push({
        id: g.id, kind: 'galaxy', name: g.name, aliases: g.aliases, type: g.type,
        domain: 'cosmos', distanceLabel: g.distMpc ? `${(g.distMpc * 3.26156).toFixed(1)} million ly` : 'Cosmological distance',
        importance: ['m31', 'm33', 'lmc', 'smc', 'm87', 'm51'].includes(g.id) ? 9 : 6,
        data: g,
      });
    }
    for (const c of CLUSTERS) {
      const d = c.distMpc ?? comovingDistanceMpc(c.z);
      objects.push({
        id: c.id, kind: 'cluster', name: c.name, aliases: c.aliases, type: c.type,
        domain: 'cosmos', distanceLabel: d ? `${(d * 3.26156).toFixed(0)} million ly` : 'Cosmological distance',
        importance: ['virgo-cluster', 'coma-cluster', 'laniakea', 'perseus-cluster'].includes(c.id) ? 8 : 5,
        data: c,
      });
    }
    for (const n of NEBULAE) {
      objects.push({
        id: n.id, kind: 'nebula', name: n.name, aliases: n.aliases, type: n.type,
        domain: 'cosmos', distanceLabel: `${(n.distKpc * 3.26156).toFixed(0)} thousand ly`,
        importance: 4, data: n,
      });
    }
    objects.push({
      id: 'milky-way', kind: 'galaxy', name: 'Milky Way', type: 'Barred spiral galaxy',
      domain: 'galaxy', distanceLabel: 'Our home galaxy', importance: 10, data: MILKY_WAY,
    });
    objects.push({
      id: 'sdss-web', kind: 'structure', name: 'The Observable Web', type: 'Large-scale structure',
      domain: 'cosmos', distanceLabel: 'SDSS spectroscopic sample', importance: 5,
      description: 'Real galaxies from SDSS trace the cosmic web within the survey footprint. This is not a complete map of the universe.',
    });
    for (const o of objects) this._indexObject(o);

    this.objects = objects;
    this.objectById = new Map(objects.map(o => [o.id, o]));

    // 3D positions for curated deep-sky objects.
    for (const g of GALAXIES) {
      g.world = raDecDistanceMpcToWorld(g.ra, g.dec, g.distMpc);
      g.comovingDistanceMpc = g.redShift != null ? comovingDistanceMpc(g.redShift) : null;
      g.lookbackGyr = g.redShift != null ? lookbackGyr(g.redShift) : null;
    }
    for (const c of CLUSTERS) {
      let d = c.distMpc;
      if (d == null && c.z != null) d = comovingDistanceMpc(c.z);
      if (d == null) d = 0;
      c.computedDistanceMpc = d;
      c.lookbackGyr = c.z != null ? lookbackGyr(c.z) : null;
      c.world = c.noPosition || !Number.isFinite(c.ra) || !Number.isFinite(c.dec)
        ? null
        : raDecDistanceMpcToWorld(c.ra, c.dec, d);
    }
    for (const n of NEBULAE) {
      n.world = raDecKpcToWorld(n.ra, n.dec, n.distKpc);
    }
    // Exoplanet systems, with world positions.
    for (const s of this.exo.systems) {
      if (Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z)) {
        const p = equatorialHelioPcToWorldMpc(s.x, s.y, s.z);
        s.world = { x: p.x, y: p.y, z: p.z };
      }
    }
    // Named stars: ensure world position.
    for (const s of this.starIndex.named) {
      if (!s.world) s.world = this.starWorld(s.i);
    }
    // Featured star lookup convenience.
    this.featuredStar = name => {
      const s = this.starNameMap.get(norm(name));
      if (!s) return null;
      return this._objectFromStar(s);
    };
  }

  _indexObject(o) {
    this.byName.set(norm(o.name), o);
    for (const a of o.aliases || []) this.byName.set(norm(a), o);
  }

  lookupObject(name) {
    return this.byName.get(norm(name)) || null;
  }

  _objectFromStar(s) {
    return {
      id: s.hip ? `hip-${s.hip}` : `hyg-${s.i}`,
      kind: 'star',
      starIndex: s.i,
      name: s.name,
      aliases: [s.proper, s.hip ? `HIP ${s.hip}` : null, s.hd ? `HD ${s.hd}` : null, s.bayer && s.con ? `${s.bayer} ${s.con}` : null].filter(Boolean),
      type: s.spect || 'Star',
      domain: 'stars',
      distanceLabel: `${(s.distPc * 3.26156).toFixed(2)} light-years`,
      importance: 7,
      data: s,
      world: s.world || this.starWorld(s.i),
    };
  }

  objectFromStarIndex(index) {
    if (!this.stars || index < 0 || index >= this.stars.count) return null;
    const namedIdx = this.stars.namedIdx[index];
    if (namedIdx >= 0) return this._objectFromStar(this.starIndex.named[namedIdx]);
    const x = this.stars.rawPos[index * 3];
    const y = this.stars.rawPos[index * 3 + 1];
    const z = this.stars.rawPos[index * 3 + 2];
    const distPc = Math.hypot(x, y, z);
    const ra = Math.atan2(y, x) * 180 / Math.PI;
    const dec = Math.asin(z / (distPc || 1)) * 180 / Math.PI;
    const hip = this.stars.hip[index];
    const id = this.stars.hd[index];
    const hr = this.stars.hr[index];
    const name = hip > 0 ? `HIP ${hip}` : id > 0 ? `HD ${id}` : hr > 0 ? `HR ${hr}` : `HYG ${index}`;
    const spect = this.starIndex.spectra[this.stars.spectIdx[index]] || '';
    const lum = this.stars.lum[index];
    const data = {
      i: index, name, hip: hip > 0 ? hip : null, hd: id > 0 ? id : null,
      hr: hr > 0 ? hr : null, raDeg: ra, decDeg: dec, distPc,
      mag: this.stars.mag[index], absmag: this.stars.absmag[index],
      ci: this.stars.ci[index], spect, lum: lum > 0 ? lum : null,
      world: this.starWorld(index), unnamed: true,
    };
    return {
      id: hip > 0 ? `hip-${hip}` : `hyg-${index}`, kind: 'star', starIndex: index,
      name, aliases: [], type: spect || 'Star', domain: 'stars',
      distanceLabel: `${(distPc * 3.26156).toFixed(2)} light-years`,
      importance: 1, data, world: data.world,
    };
  }

  findStar(query) {
    const q = norm(query);
    if (!q) return null;
    if (this.starNameMap.has(q)) return this.starNameMap.get(q);
    // HIP/HD/HR catalogue identifiers.
    let m = q.match(/^(hip|hd|hr)\s*0*(\d+)$/);
    if (m) {
      const num = Number(m[2]);
      const map = m[1] === 'hip' ? this.stars.hipMap : m[1] === 'hd' ? this.stars.hdMap : this.stars.hrMap;
      const idx = map.get(num);
      if (idx != null) {
        const si = this.stars.namedIdx[idx];
        if (si >= 0) return this.starIndex.named[si];
        const p = this.starWorld(idx);
        return {
          i: idx, name: `${m[1].toUpperCase()} ${num}`, hip: m[1] === 'hip' ? num : null,
          distPc: this.stars.rawPos[idx * 3] ? Math.hypot(this.stars.rawPos[idx * 3], this.stars.rawPos[idx * 3 + 1], this.stars.rawPos[idx * 3 + 2]) : null,
          spect: this.starIndex.spectra[this.stars.spectIdx[idx]],
          world: p, worldFallback: true,
        };
      }
    }
    return null;
  }

  findSystem(name) {
    const q = norm(name);
    if (!q) return null;
    let exact = this.exo.systems.find(s => norm(s.host) === q);
    if (exact) return exact;
    // Common catalogue aliases used by the archive.
    const aliasMap = {
      'proxima centauri': 'proxima cen',
      '51 pegasi': '51 peg',
      'trapist 1': 'trappist 1',
    };
    if (aliasMap[q]) {
      exact = this.exo.systems.find(s => norm(s.host) === aliasMap[q]);
      if (exact) return exact;
    }
    return null;
  }

  findPlanet(name) {
    const q = norm(name);
    const qCompact = q.replace(/\s+/g, '');
    if (!q) return null;
    for (const sys of this.exo.systems) {
      for (const p of sys.planets) {
        const n = norm(p.name);
        if (n === q || n.replace(/\s+/g, '') === qCompact) return { system: sys, planet: p };
      }
    }
    return null;
  }

  findExoplanetHostByStar(query) {
    const q = norm(query);
    if (!q) return null;
    return this.exo.systems.find(s => norm(s.host) === q) || null;
  }

  /** The complete primary search index. Built lazily once. */
  searchIndex() {
    if (this._search) return this._search;
    const idx = [];
    for (const o of this.objects) {
      idx.push({
        id: o.id, name: o.name, type: o.type, domain: o.domain,
        distanceLabel: o.distanceLabel, aliases: o.aliases || [],
        importance: o.importance || 1, object: o, subtitle: o.type,
      });
    }
    // Stars: the named subset, but do not drown the UI in unnamed HIP entries.
    for (const s of this.starIndex.named) {
      const starObj = this._objectFromStar(s);
      idx.push({
        id: starObj.id, name: s.name, type: s.spect ? `Star · ${s.spect}` : 'Star',
        domain: 'stars', distanceLabel: `${(s.distPc * 3.26156).toFixed(2)} ly`,
        aliases: [s.proper, s.hip ? `HIP ${s.hip}` : null, s.hd ? `HD ${s.hd}` : null, s.hr ? `HR ${s.hr}` : null].filter(Boolean),
        importance: s.importance, object: starObj, subtitle: s.spect || 'Star',
      });
    }
    // Exoplanets and their host systems.
    for (const sys of this.exo.systems) {
      for (const p of sys.planets) {
        idx.push({
          id: `exo-${norm(p.name).replace(/\s+/g, '-')}`,
          name: p.name, type: 'Exoplanet', domain: 'exo',
          distanceLabel: sys.distPc != null ? `${(sys.distPc * 3.26156).toFixed(1)} ly` : 'Distance unavailable',
          aliases: [sys.host, p.name.replace(/\s+/g, '')], importance: 2.2, exoSystem: sys, exoPlanet: p,
          subtitle: `${sys.host} system`,
        });
      }
      idx.push({
        id: `exo-host-${norm(sys.host).replace(/\s+/g, '-')}`, name: sys.host, type: 'Exoplanet host star',
        domain: 'exo', distanceLabel: sys.distPc != null ? `${(sys.distPc * 3.26156).toFixed(1)} ly` : 'Distance unavailable',
        importance: 1.4, exoSystem: sys, subtitle: `${sys.planets.length} confirmed planet${sys.planets.length > 1 ? 's' : ''}`,
      });
    }
    // Special destinations.
    idx.push({
      id: 'sdss-web', name: 'The Observable Web', type: 'Large-scale structure', domain: 'cosmos',
      distanceLabel: 'SDSS spectroscopic sample', importance: 4, object: this.objectById.get('sdss-web'),
      subtitle: 'SDSS galaxies and quasars',
    });
    this._search = idx;
    return idx;
  }
}

export function norm(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchCatalog(catalog, query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const index = catalog.searchIndex();
  const scored = [];
  const wordRe = new RegExp(`(^|[^a-z0-9])${escapeRegExp(q)}`, 'i');
  for (const item of index) {
    const names = [item.name, ...(item.aliases || [])];
    let best = 0;
    for (const nRaw of names) {
      const n = norm(nRaw);
      if (!n) continue;
      let s = 0;
      if (n === q) s = 100;
      else if (n.startsWith(q)) s = 82 - Math.min(20, n.length - q.length);
      else if (wordRe.test(n)) s = 66;
      else if (n.includes(q)) s = 45 - Math.min(20, n.indexOf(q));
      if (s > best) best = s;
    }
    if (best > 0) {
      scored.push({ ...item, score: best + (item.importance || 0) * 1.2 + (q.length > 2 ? 0 : -20) });
    }
  }
  scored.sort((a, b) => b.score - a.score || (a.name.length - b.name.length));
  return scored.slice(0, limit);
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function buildGalaxyWorld(g, distanceMpc = null) {
  return raDecDistanceMpcToWorld(g.ra, g.dec, distanceMpc ?? g.distMpc);
}
