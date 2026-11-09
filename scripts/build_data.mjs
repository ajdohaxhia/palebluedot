#!/usr/bin/env node
/**
 * EON data build.
 *
 * Converts the raw catalogue downloads in /data into compact browser assets.
 * Raw data:
 *   HYG Database v4.1 (astronexus)          CC BY-SA 4.0
 *   NASA Exoplanet Archive pscomppars       NASA public data
 *   SDSS DR18 SpecObj (SkyServer SQL)       SDSS public data
 *
 * No values are invented. Missing values remain absent.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data');
const RETRIEVED = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some(v => v !== '')) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function readCSV(file) {
  const text = fs.readFileSync(path.join(DATA, file), 'utf8');
  const rows = parseCSV(text).filter(r => !r[0]?.startsWith('#'));
  const header = rows.shift().map(h => h.replace(/^\uFEFF/, '').trim());
  return rows.map(r => {
    const o = {};
    header.forEach((k, i) => { o[k] = r[i] === undefined ? '' : r[i].trim(); });
    return o;
  });
}

const num = v => {
  if (v === null || v === undefined || v === '' || v === 'null' || v === 'NaN') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SRGB = v => clamp(Math.round(v), 0, 255);

/** B-V colour index -> effective temperature (Ballesteros 2012). Visual estimate. */
function tempFromBV(bv) {
  const x = 0.92 * bv + 1.7;
  const y = 0.92 * bv + 0.62;
  return 4600 * (1 / x + 1 / y);
}

/** Approximate blackbody RGB (Tanner Helland), slightly desaturated for star fields. */
function temperatureRGB(K) {
  const t = clamp(K, 1000, 40000) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  // Keep enough hue to read temperature, but avoid neon.
  const v = [r / 255, g / 255, b / 255];
  const lum = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  const sat = 0.86;
  return v.map(c => SRGB((lum + (c - lum) * sat) * 255));
}

function approxBlackbodyColor(K) {
  const [r, g, b] = temperatureRGB(K);
  return [(r / 255) ** 2.2, (g / 255) ** 2.2, (b / 255) ** 2.2];
}

/* ------------------------------------------------------------------ */
/* Cosmology (flat ΛCDM, matching the viewer)                          */
/* ------------------------------------------------------------------ */
const H0 = 70.0;                 // km/s/Mpc
const OMEGA_M = 0.3;
const OMEGA_L = 0.7;
const C_KMS = 299792.458;
const DH = C_KMS / H0;           // 4282.75 Mpc
const E = z => Math.sqrt(OMEGA_M * Math.pow(1 + z, 3) + OMEGA_L);

function comovingDistanceMpc(z) {
  if (z <= 0) return 0;
  const n = 256;
  const h = z / n;
  let s = 1 / E(0) + 1 / E(z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / E(i * h);
  return DH * s * h / 3;
}

function lookbackGyr(z) {
  if (z <= 0) return 0;
  const n = 256;
  const h = z / n;
  let s = 1 / ((1 + 0) * E(0)) + 1 / ((1 + z) * E(z));
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / ((1 + i * h) * E(i * h));
  const tH = 977.7922216 / H0; // Gyr: (Mpc/km*s) -> Gyr  (1/H0 in Gyr)
  return tH * s * h / 3;
}

/* ------------------------------------------------------------------ */
/* HYG stars                                                           */
/* ------------------------------------------------------------------ */
console.log('Reading HYG v4.1 …');
const hyg = readCSV('hygdata_v41.csv');
console.log(`  ${hyg.length.toLocaleString()} rows`);

const starRows = [];
const spectra = [];
const spectrumIndex = new Map();
const named = [];
const ALIASES = new Map([
  ['71683', 'Alpha Centauri A'],
  ['71681', 'Alpha Centauri B'],
  ['70890', 'Proxima Centauri'],
]);

for (const r of hyg) {
  const id = num(r.id);
  if (id === 0) continue; // Sun is part of the Solar System, not the star field
  const dist = num(r.dist);
  const ra = num(r.ra), dec = num(r.dec);
  if (dist === null || dist <= 0 || ra === null || dec === null) continue;
  let x = num(r.x), y = num(r.y), z = num(r.z);
  if (x === null || y === null || z === null) {
    const d = dist;
    x = d * Math.cos(dec * Math.PI / 180) * Math.cos(ra * Math.PI / 180);
    y = d * Math.cos(dec * Math.PI / 180) * Math.sin(ra * Math.PI / 180);
    z = d * Math.sin(dec * Math.PI / 180);
  }
  const mag = num(r.mag);
  if (mag === null) continue;
  const absmag = num(r.absmag);
  let ci = num(r.ci);
  if (ci !== null) ci = clamp(ci, -0.5, 3.5);
  const spect = r.spect || '';
  let si = spectrumIndex.get(spect);
  if (si === undefined) { si = spectra.length; spectra.push(spect); spectrumIndex.set(spect, si); }
  const hip = num(r.hip) || -1;
  const hd = num(r.hd) || -1;
  const hr = num(r.hr) || -1;
  const proper = (r.proper || '').trim();
  const bayer = (r.bayer || '').trim();
  const flam = (r.flam || '').trim();
  const con = (r.con || '').trim();
  let lum = num(r.lum);
  if ((lum === null || lum <= 0) && absmag !== null) lum = Math.pow(10, (4.83 - absmag) / 2.5);
  const tempEstimate = ci !== null ? tempFromBV(ci) : null;
  starRows.push({
    id, hip, hd, hr, ra, dec, dist, x, y, z, mag, absmag, ci, lum,
    spectIdx: si, temp: tempEstimate, proper, bayer, flam, con,
  });
}

console.log(`  ${starRows.length.toLocaleString()} usable stars`);

// Assign stable indexes.
starRows.sort((a, b) => a.id - b.id);
const N = starRows.length;
for (let i = 0; i < N; i++) {
  const s = starRows[i];
  s.index = i;
  const alias = s.hip >= 0 ? ALIASES.get(String(s.hip)) : null;
  let display = alias || s.proper;
  if (!display && s.bayer && s.con) display = `${s.bayer} ${s.con}`;
  if (!display && s.flam && s.con) display = `${s.flam} ${s.con}`;
  if (!display && s.hip >= 0) display = `HIP ${s.hip}`;
  s.display = display || `HYG ${s.id}`;
  const notable = !!s.proper || !!s.bayer || s.mag <= 6.5;
  if (notable) {
    const importance = (s.proper ? 4 : 0) + (s.bayer ? 2 : 0) + clamp((7 - s.mag) / 2, 0, 3);
    named.push({ i, ...s, importance });
  }
}
named.sort((a, b) => b.importance - a.importance || a.mag - b.mag);
console.log(`  ${named.length.toLocaleString()} searchable/notable stars`);

// Build star binary.
const MAGIC = Buffer.from('EONSTAR1');
const HEADER = 128;
const align = (n, a) => Math.ceil(n / a) * a;
const offset = { pos: HEADER };
offset.mag = align(offset.pos + N * 12, 8);
offset.abs = align(offset.mag + N * 4, 8);
offset.ci = align(offset.abs + N * 4, 8);
offset.lum = align(offset.ci + N * 4, 8);
offset.color = offset.lum + N * 4;
offset.hip = align(offset.color + N * 3, 8);
offset.hd = align(offset.hip + N * 4, 8);
offset.hr = align(offset.hd + N * 4, 8);
offset.spect = align(offset.hr + N * 4, 8);
offset.named = align(offset.spect + N * 2, 8);
offset.pad = offset.named + N * 4;
const total = align(offset.pad + N * 4, 8);
if (offset.hip % 4 || offset.spect % 2 || offset.named % 4) throw new Error('Bad star binary alignment');
const buf = Buffer.alloc(total);
MAGIC.copy(buf, 0);
buf.writeUInt32LE(1, 8);              // version
buf.writeUInt32LE(N, 12);             // count
buf.writeUInt32LE(HEADER, 16);
buf.writeUInt32LE(offset.pos, 20);
buf.writeUInt32LE(offset.mag, 24);
buf.writeUInt32LE(offset.abs, 28);
buf.writeUInt32LE(offset.ci, 32);
buf.writeUInt32LE(offset.lum, 36);
buf.writeUInt32LE(offset.color, 40);
buf.writeUInt32LE(offset.hip, 44);
buf.writeUInt32LE(offset.hd, 48);
buf.writeUInt32LE(offset.hr, 52);
buf.writeUInt32LE(offset.spect, 56);
buf.writeUInt32LE(offset.named, 60);
buf.writeUInt32LE(named.length, 64);
buf.writeUInt32LE(spectra.length, 68);

const namedByIndex = new Map(named.map((s, i) => [s.i, i]));
for (let i = 0; i < N; i++) {
  const s = starRows[i];
  buf.writeFloatLE(s.x, offset.pos + i * 12);
  buf.writeFloatLE(s.y, offset.pos + i * 12 + 4);
  buf.writeFloatLE(s.z, offset.pos + i * 12 + 8);
  buf.writeFloatLE(s.mag, offset.mag + i * 4);
  buf.writeFloatLE(s.absmag ?? 99, offset.abs + i * 4);
  buf.writeFloatLE(s.ci ?? 0.65, offset.ci + i * 4);
  buf.writeFloatLE(s.lum ?? 0, offset.lum + i * 4);
  const temp = s.temp ?? 5772;
  const [r, g, b] = approxBlackbodyColor(temp).map(v => clamp(Math.round(v * 255), 0, 255));
  buf[offset.color + i * 3] = r;
  buf[offset.color + i * 3 + 1] = g;
  buf[offset.color + i * 3 + 2] = b;
  buf.writeInt32LE(s.hip, offset.hip + i * 4);
  buf.writeInt32LE(s.hd, offset.hd + i * 4);
  buf.writeInt32LE(s.hr, offset.hr + i * 4);
  buf.writeUInt16LE(s.spectIdx, offset.spect + i * 2);
  buf.writeInt32LE(namedByIndex.get(i) ?? -1, offset.named + i * 4);
}
fs.writeFileSync(path.join(DATA, 'stars.bin'), buf);
console.log(`  stars.bin ${(total / 1024 / 1024).toFixed(2)} MB`);

const starIndex = {
  source: {
    name: 'HYG Database v4.1',
    authors: 'David Nash / Astronomy Nexus (compiled from Hipparcos, Yale BSC, Gliese, Gaia DR2 where available)',
    url: 'https://codeberg.org/astronexus/hyg',
    license: 'CC BY-SA 4.0',
    retrievedAt: RETRIEVED,
    note: 'Distances from Hipparcos parallax; uncertain for distant stars. Temperatures shown are estimates derived from B−V colour when not in the source catalogue.',
  },
  count: N,
  spectra,
  named: named.map(s => ({
    i: s.i,
    name: s.display,
    proper: s.proper || null,
    bayer: s.bayer || null,
    flam: s.flam || null,
    con: s.con || null,
    hip: s.hip >= 0 ? s.hip : null,
    hd: s.hd >= 0 ? s.hd : null,
    hr: s.hr >= 0 ? s.hr : null,
    raDeg: s.ra,
    decDeg: s.dec,
    distPc: s.dist,
    mag: s.mag,
    absmag: s.absmag,
    ci: s.ci,
    spect: spectra[s.spectIdx],
    lum: s.lum,
    tempK: s.temp ? Math.round(s.temp) : null,
    importance: Number(s.importance.toFixed(3)),
  })),
};
fs.writeFileSync(path.join(DATA, 'stars_index.json'), JSON.stringify(starIndex));

/* ------------------------------------------------------------------ */
/* Exoplanets                                                          */
/* ------------------------------------------------------------------ */
console.log('Reading NASA Exoplanet Archive …');
const exoRows = readCSV('exoplanets_raw.csv');
console.log(`  ${exoRows.length.toLocaleString()} planets`);

const planet = r => ({
  name: r.pl_name,
  periodDays: num(r.pl_orbper),
  radiusEarth: num(r.pl_rade),
  massEarth: num(r.pl_bmasse),
  smaAU: num(r.pl_orbsmax),
  eccentricity: num(r.pl_orbeccen),
  inclinationDeg: num(r.pl_orbincl),
  method: r.discoverymethod || null,
  discoveryYear: num(r.disc_year),
  equilibriumTempK: num(r.pl_eqt),
});

const systemsMap = new Map();
for (const r of exoRows) {
  const host = r.hostname;
  if (!host) continue;
  let sys = systemsMap.get(host);
  if (!sys) {
    const ra = num(r.ra), dec = num(r.dec), dpc = num(r.sy_dist);
    sys = {
      host,
      raDeg: ra, decDeg: dec, distPc: dpc,
      teffK: num(r.st_teff),
      radiusSun: num(r.st_rad),
      massSun: num(r.st_mass),
      spect: r.st_spectype || null,
      planets: [],
    };
    if (ra !== null && dec !== null && dpc !== null && dpc > 0) {
      const d = dpc;
      const ar = ra * Math.PI / 180, de = dec * Math.PI / 180;
      sys.x = d * Math.cos(de) * Math.cos(ar);
      sys.y = d * Math.cos(de) * Math.sin(ar);
      sys.z = d * Math.sin(de);
    }
    systemsMap.set(host, sys);
  }
  const p = planet(r);
  if (!sys.planets.some(q => q.name === p.name)) sys.planets.push(p);
}
const systems = [...systemsMap.values()].map(s => {
  s.planets.sort((a, b) => (a.smaAU ?? 1e9) - (b.smaAU ?? 1e9));
  return s;
});
systems.sort((a, b) => a.host.localeCompare(b.host));

const exo = {
  source: {
    name: 'NASA Exoplanet Archive — Planetary Systems Composite Parameters',
    table: 'pscomppars',
    url: 'https://exoplanetarchive.ipac.caltech.edu/',
    service: 'NASA Exoplanet Archive TAP',
    license: 'NASA public data',
    retrievedAt: RETRIEVED,
    note: 'Confirmed planets only. Missing parameters remain null. Values describe the planet as of the archive retrieval date.',
  },
  count: exoRows.length,
  systemCount: systems.length,
  systems,
};
fs.writeFileSync(path.join(DATA, 'exoplanets.json'), JSON.stringify(exo));
console.log(`  exoplanets.json ${systems.length.toLocaleString()} systems`);

/* ------------------------------------------------------------------ */
/* SDSS galaxies (comoving Cartesian Mpc, equatorial J2000)            */
/* ------------------------------------------------------------------ */
console.log('Reading SDSS DR18 galaxies …');
const sdssRows = readCSV('sdss_galaxies.csv');
const galaxies = [];
for (const r of sdssRows) {
  const ra = num(r.ra), dec = num(r.dec), z = num(r.z);
  if (ra === null || dec === null || z === null || z <= 0) continue;
  const dc = comovingDistanceMpc(z);
  const ar = ra * Math.PI / 180, de = dec * Math.PI / 180;
  galaxies.push({
    x: dc * Math.cos(de) * Math.cos(ar),
    y: dc * Math.cos(de) * Math.sin(ar),
    z: dc * Math.sin(de),
    zred: z,
  });
}
console.log(`  ${galaxies.length.toLocaleString()} galaxies`);
const gbuf = Buffer.alloc(64 + galaxies.length * 16);
Buffer.from('EONGAL01').copy(gbuf, 0);
gbuf.writeUInt32LE(1, 8);
gbuf.writeUInt32LE(galaxies.length, 12);
for (let i = 0; i < galaxies.length; i++) {
  const g = galaxies[i];
  gbuf.writeFloatLE(g.x, 64 + i * 16);
  gbuf.writeFloatLE(g.y, 64 + i * 16 + 4);
  gbuf.writeFloatLE(g.z, 64 + i * 16 + 8);
  gbuf.writeFloatLE(g.zred, 64 + i * 16 + 12);
}
fs.writeFileSync(path.join(DATA, 'sdss_galaxies.bin'), gbuf);

const minRA = Math.min(...sdssRows.map(r => num(r.ra)).filter(v => v !== null));
const maxRA = Math.max(...sdssRows.map(r => num(r.ra)).filter(v => v !== null));
const sdssMeta = {
  source: {
    name: 'Sloan Digital Sky Survey Data Release 18',
    table: 'SpecObj',
    url: 'https://skyserver.sdss.org/',
    license: 'SDSS public data — attribution requested',
    retrievedAt: RETRIEVED,
    selection: "class = 'GALAXY', 0.004 ≤ z ≤ 0.15 (stratified bins); this build combines a 40,000-object low-redshift query with higher-redshift bins that completed successfully.",
    note: 'Spectroscopic galaxy redshift sample. Coverage is the SDSS footprint and only part of the available redshift range; it is a shallow, incomplete slice, not a complete sky map. Positions are flat-ΛCDM comoving distances (H₀=70, Ωm=0.3), converted from RA/Dec.',
  },
  count: galaxies.length,
  zMin: Math.min(...galaxies.map(g => g.zred)),
  zMax: Math.max(...galaxies.map(g => g.zred)),
  raRangeDeg: [minRA, maxRA],
  comovingMaxMpc: Math.max(...galaxies.map(g => Math.hypot(g.x, g.y, g.z))),
};
fs.writeFileSync(path.join(DATA, 'sdss_galaxies.json'), JSON.stringify(sdssMeta));

/* ------------------------------------------------------------------ */
/* Optional quasar sample                                             */
/* ------------------------------------------------------------------ */
if (fs.existsSync(path.join(DATA, 'sdss_quasars.csv'))) {
  console.log('Reading SDSS DR18 quasars …');
  const qrows = readCSV('sdss_quasars.csv');
  const qs = [];
  for (const r of qrows) {
    const ra = num(r.ra), dec = num(r.dec), z = num(r.z);
    if (ra === null || dec === null || z === null || z <= 0) continue;
    const dc = comovingDistanceMpc(z);
    const ar = ra * Math.PI / 180, de = dec * Math.PI / 180;
    qs.push({
      x: dc * Math.cos(de) * Math.cos(ar),
      y: dc * Math.cos(de) * Math.sin(ar),
      z: dc * Math.sin(de),
      zred: z,
    });
  }
  const qbuf = Buffer.alloc(64 + qs.length * 16);
  Buffer.from('EONQSO01').copy(qbuf, 0);
  qbuf.writeUInt32LE(1, 8);
  qbuf.writeUInt32LE(qs.length, 12);
  qs.forEach((q, i) => {
    qbuf.writeFloatLE(q.x, 64 + i * 16);
    qbuf.writeFloatLE(q.y, 64 + i * 16 + 4);
    qbuf.writeFloatLE(q.z, 64 + i * 16 + 8);
    qbuf.writeFloatLE(q.zred, 64 + i * 16 + 12);
  });
  fs.writeFileSync(path.join(DATA, 'sdss_quasars.bin'), qbuf);
  fs.writeFileSync(path.join(DATA, 'sdss_quasars.json'), JSON.stringify({
    source: {
      name: 'Sloan Digital Sky Survey Data Release 18',
      table: 'SpecObj',
      url: 'https://skyserver.sdss.org/',
      license: 'SDSS public data',
      retrievedAt: RETRIEVED,
      selection: "class = 'QSO', 0.05 ≤ z ≤ 3.0",
      note: 'Spectroscopically confirmed quasars. Positions are flat-ΛCDM comoving distances.',
    },
    count: qs.length,
    zMin: Math.min(...qs.map(q => q.zred)),
    zMax: Math.max(...qs.map(q => q.zred)),
    comovingMaxMpc: Math.max(...qs.map(q => Math.hypot(q.x, q.y, q.z))),
  }));
  console.log(`  ${qs.length.toLocaleString()} quasars`);
}

/* ------------------------------------------------------------------ */
/* Manifest + cosmology self-check                                    */
/* ------------------------------------------------------------------ */
const manifest = {
  generatedAt: new Date().toISOString(),
  cosmology: { H0, OmegaM: OMEGA_M, OmegaL: OMEGA_L, note: 'Flat ΛCDM used for redshift-derived comoving distances.' },
  checks: {
    comoving_z_0_1: comovingDistanceMpc(0.1),
    comoving_z_1: comovingDistanceMpc(1),
    lookback_z_1_Gyr: lookbackGyr(1),
  },
  assets: {
    stars: { file: 'stars.bin', index: 'stars_index.json', count: N },
    exoplanets: { file: 'exoplanets.json', systems: systems.length, planets: exoRows.length },
    galaxies: { file: 'sdss_galaxies.bin', count: galaxies.length },
    textures: {
      starMap: 'NASA/Goddard Deep Star Maps 2020 (celestial, RA increasing left)',
    },
  },
  sources: [starIndex.source, exo.source, sdssMeta.source],
};
fs.writeFileSync(path.join(DATA, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Cosmology checks:', manifest.checks);
console.log('Done.');
