/** Scientific and unit verification for EON. Run with `npm test`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  AU, AU_KM, LIGHT_YEAR, PARSEC, MPC, PC_KM, MPC_LY,
  formatDistance, formatRA, formatDec, formatMpc,
} from '../src/astronomy/units.js';
import {
  EQ_TO_GAL, equatorialToGalactic, galacticToEquatorial,
  earthLatLonFromLocal, earthLocalFromLatLon, raDecToEquatorialUnit,
} from '../src/astronomy/coordinates.js';
import {
  comovingDistanceMpc, lookbackGyr, ageAtRedshiftGyr, angularDiameterDistanceMpc,
} from '../src/astronomy/cosmology.js';
import {
  keplerPosition, moonEquatorialPositionKm, planetPositions, sunRaDec,
} from '../src/astronomy/ephemeris.js';
import { gmstDeg, julianDate, J2000_JD } from '../src/astronomy/time.js';
import {
  PLANETS, DWARF_PLANETS, MOONS, SUN, SCALE_LEVELS, GALAXIES, CLUSTERS,
  OBSERVABLE_UNIVERSE_RADIUS_MPC, AU_KM as FEATURED_AU_KM,
} from '../src/data/featured.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const close = (a, b, eps) => Math.abs(a - b) <= eps;

test('unit constants are self-consistent', () => {
  assert.ok(close(AU_KM, 149_597_870.7, 1e-3));
  assert.ok(close(AU, AU_KM * 1000, 1e-6));
  assert.ok(close(LIGHT_YEAR / PARSEC, 0.306601, 1e-5));
  assert.ok(close(MPC / 1e6, PARSEC, 1e-3));
  assert.ok(close(FEATURED_AU_KM, AU_KM, 1e-9));
  assert.ok(close(MPC_LY, 3.261563777e6, 1e-1));
});

test('adaptive distance formatting uses sensible units', () => {
  assert.match(formatDistance(12_742_000), /12,?742 km/);
  assert.match(formatDistance(AU), /1 AU/);
  assert.match(formatDistance(4.2465 * LIGHT_YEAR), /4\.25 ly/);
  assert.match(formatDistance(8.15 * 1000 * PARSEC), /8,150 kpc|8\.15 kpc/);
  assert.match(formatDistance(100 * MPC), /100 Mpc/);
  assert.match(formatMpc(0.778), /million ly/);
});

test('sexagesimal formatting', () => {
  assert.equal(formatRA(0), '00h 00m 00.0s');
  assert.match(formatRA(6.752481), /00h 27m/);
  assert.match(formatDec(-16.716116), /−16°/);
});

test('galactic rotation matrix is orthonormal and round-trips', () => {
  const m = EQ_TO_GAL;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let dot = 0;
      for (let k = 0; k < 3; k++) dot += m[i][k] * m[j][k];
      assert.ok(close(dot, i === j ? 1 : 0, 1e-12));
    }
  }
  const v = raDecToEquatorialUnit(83.8221, -5.3911);
  const g = equatorialToGalactic(v.x, v.y, v.z);
  const back = galacticToEquatorial(g.x, g.y, g.z);
  assert.ok(close(back.x, v.x, 1e-12));
  assert.ok(close(back.y, v.y, 1e-12));
  assert.ok(close(back.z, v.z, 1e-12));
});

test('the Galactic Centre maps to l=0, b=0', () => {
  const v = raDecToEquatorialUnit(266.4168, -29.0078);
  const g = equatorialToGalactic(v.x, v.y, v.z);
  assert.ok(close(g.x, 1, 0.001));
  assert.ok(close(g.y, 0, 0.001));
  assert.ok(close(g.z, 0, 0.001));
});

test('Earth latitude/longitude round-trip', () => {
  for (const [lat, lon] of [[0, 0], [23.5, -42.2], [-54.6, 130.1], [89.2, 12.4], [-88.1, -170.2]]) {
    const local = earthLocalFromLatLon(lat, lon);
    const back = earthLatLonFromLocal(local);
    assert.ok(close(back.latDeg, lat, 1e-8), `${lat} -> ${back.latDeg}`);
    const dLon = ((back.lonDeg - lon + 540) % 360) - 180;
    assert.ok(close(dLon, 0, 1e-8), `${lon} -> ${back.lonDeg}`);
  }
});

test('flat ΛCDM distances match reference values', () => {
  assert.equal(comovingDistanceMpc(0), 0);
  assert.ok(close(comovingDistanceMpc(0.1), 418.4545, 0.05));
  assert.ok(close(comovingDistanceMpc(1), 3303.8288, 0.5));
  assert.ok(close(lookbackGyr(1), 7.7153, 0.01));
  assert.ok(lookbackGyr(2) > lookbackGyr(1));
  assert.ok(ageAtRedshiftGyr(0) > 13.9 && ageAtRedshiftGyr(0) < 14.1);
  assert.ok(angularDiameterDistanceMpc(1) < comovingDistanceMpc(1));
});

test('Julian date and sidereal time reference values', () => {
  const date = new Date('2000-01-01T12:00:00Z');
  assert.ok(close(julianDate(date), J2000_JD, 1e-9));
  assert.ok(close(gmstDeg(date), 280.46061837, 1e-5));
  assert.ok(close(gmstDeg(new Date('2026-11-06T00:00:00Z')) % 360, 45.225896, 0.001));
});

test('planetary ordering, radii and masses are physical', () => {
  const order = PLANETS.map(p => p.semiMajorAU);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `planet ${i} out of order`);
  for (const p of [...PLANETS, ...DWARF_PLANETS]) {
    assert.ok(p.radiusKm > 0 && Number.isFinite(p.radiusKm));
    assert.ok(p.massKg > 0 && Number.isFinite(p.massKg));
    assert.ok(p.orbitalPeriodDays > 0);
    assert.ok(p.orbit && Number.isFinite(p.orbit.a) && p.orbit.a > 0);
    assert.ok(p.orbit.e >= 0 && p.orbit.e < 1);
  }
  assert.equal(SUN.radiusKm, 696340);
  assert.equal(PLANETS.length, 8);
});

test('required moons are present with real orbital radii', () => {
  const ids = new Set(MOONS.map(m => m.id));
  for (const id of ['moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'enceladus', 'triton']) {
    assert.ok(ids.has(id), `missing ${id}`);
  }
  for (const m of MOONS) {
    assert.ok(m.semiMajorKm > 0 && m.periodDays !== 0);
    assert.ok(m.radiusKm > 0);
  }
  assert.ok(MOONS.find(m => m.id === 'triton').periodDays < 0, 'Triton should be retrograde');
});

test('JPL Keplerian positions stay on their orbits', () => {
  const date = new Date('2026-11-06T00:00:00Z');
  const positions = planetPositions(date);
  for (const p of PLANETS) {
    const r = Math.hypot(positions[p.id].x, positions[p.id].y, positions[p.id].z);
    const a = p.orbit.a;
    const e = p.orbit.e;
    assert.ok(r >= a * (1 - e) - 0.02 && r <= a * (1 + e) + 0.02, `${p.name} r=${r}`);
  }
  const earth = positions.earth;
  assert.ok(Math.hypot(earth.x, earth.y, earth.z) > 0.97 && Math.hypot(earth.x, earth.y, earth.z) < 1.02);
  const sun = sunRaDec(date);
  assert.ok(sun.raDeg >= 0 && sun.raDeg < 360);
  assert.ok(Math.abs(sun.decDeg) < 23.6);
});

test('Earth distance is near 1 AU across the simulation interval', () => {
  for (const year of [1800, 1900, 2000, 2026, 2050]) {
    const p = planetPositions(new Date(Date.UTC(year, 0, 1)));
    const r = Math.hypot(p.earth.x, p.earth.y, p.earth.z);
    assert.ok(r > 0.98 && r < 1.02, `${year}: ${r}`);
  }
});

test('Moon distance is in the physical range', () => {
  for (const year of [2000, 2026, 2050]) {
    const p = moonEquatorialPositionKm(new Date(Date.UTC(year, 0, 1)));
    assert.ok(p.rKm > 355000 && p.rKm < 407000, `${year}: ${p.rKm}`);
  }
});

test('scale levels are strictly ordered and cover the universe', () => {
  const logs = SCALE_LEVELS.map(l => Math.log10(l.meters));
  for (let i = 1; i < logs.length; i++) assert.ok(logs[i] > logs[i - 1]);
  assert.ok(SCALE_LEVELS.some(l => l.id === 'earth'));
  assert.ok(SCALE_LEVELS.some(l => l.id === 'observable'));
  assert.ok(OBSERVABLE_UNIVERSE_RADIUS_MPC > 14000 && OBSERVABLE_UNIVERSE_RADIUS_MPC < 14500);
});

test('curated galaxies and clusters have finite positions and provenance', () => {
  const names = new Set(GALAXIES.map(g => g.id));
  for (const id of ['m31', 'm33', 'lmc', 'smc', 'm51', 'm101', 'm104', 'm87', 'm81']) assert.ok(names.has(id), `missing ${id}`);
  for (const g of GALAXIES) {
    assert.ok(Number.isFinite(g.ra) && g.ra >= 0 && g.ra < 360, `${g.id} RA`);
    assert.ok(Number.isFinite(g.dec) && Math.abs(g.dec) <= 90, `${g.id} Dec`);
    assert.ok(Number.isFinite(g.distMpc) && g.distMpc > 0);
    assert.ok(g.provenance?.source);
  }
  for (const c of CLUSTERS) {
    if (c.noPosition) continue;
    assert.ok(Number.isFinite(c.ra) && Number.isFinite(c.dec), `${c.id}`);
  }
});

test('processed catalogues are present and scientifically plausible', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/manifest.json'), 'utf8'));
  const stars = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/stars_index.json'), 'utf8'));
  const exo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/exoplanets.json'), 'utf8'));
  const sdss = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sdss_galaxies.json'), 'utf8'));
  assert.ok(stars.count > 100000);
  assert.ok(stars.named.some(s => s.proper === 'Sirius'));
  assert.ok(stars.named.some(s => s.proper === 'Proxima Centauri'));
  assert.ok(exo.count > 5000);
  assert.ok(exo.systemCount > 4000);
  assert.ok(exo.systems.find(s => s.host === 'TRAPPIST-1')?.planets.length === 7);
  assert.ok(exo.systems.every(s => s.planets.length > 0));
  assert.ok(sdss.count >= 40000);
  assert.ok(sdss.zMax > 0.04 && sdss.zMax < 0.2);
  assert.ok(manifest.checks.comoving_z_1 > 3000);
  for (const s of stars.named.slice(0, 2000)) {
    assert.ok(Number.isFinite(s.raDeg) && s.raDeg >= 0 && s.raDeg < 360);
    assert.ok(Number.isFinite(s.distPc) && s.distPc >= 0);
  }
});
