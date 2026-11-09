/**
 * Solar System ephemeris.
 *
 * Major planets use the JPL approximate Keplerian elements (Standish),
 * valid 1800–2050 AD, with respect to the mean ecliptic and equinox of J2000.
 * Dwarf planets use approximate osculating elements. Moons use simplified
 * circular orbits around their parent. These approximations are labelled
 * throughout the interface; this is not a high-precision ephemeris.
 */

import { PLANETS, DWARF_PLANETS, MOONS, AU_KM } from '../data/featured.js';
import { julianDate, J2000_JD, gmstRad } from './time.js';

const DEG = Math.PI / 180;
const OBLIQUITY_DEG = 23.439291;
export const OBLIQUITY = OBLIQUITY_DEG * DEG;

export const MAJOR_PLANETS = PLANETS;
export const ALL_PLANETS = [...PLANETS, ...DWARF_PLANETS];

export const BODY_BY_ID = (() => {
  const m = new Map();
  for (const p of ALL_PLANETS) m.set(p.id, p);
  for (const moon of MOONS) m.set(moon.id, moon);
  return m;
})();

export const MOON_BY_ID = (() => Object.fromEntries(MOONS.map(m => [m.id, m])))();

/** Normalise an angle to [-180, 180). */
export function wrap180(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

export function wrap360(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Newton–Raphson solution of Kepler's equation M = E - e sin E. */
export function solveKepler(Mrad, e) {
  let E = Mrad + e * Math.sin(Mrad);
  if (e > 0.8) E = Mrad;
  for (let i = 0; i < 12; i++) {
    const f = E - e * Math.sin(E) - Mrad;
    const fp = 1 - e * Math.cos(E);
    const d = f / fp;
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/**
 * Heliocentric ecliptic J2000 position in AU.
 * @param {object} el elements with a,e,I,L,peri,node and da,de,dI,dL,dperi,dnode
 * @param {Date} date
 */
export function keplerPosition(el, date) {
  const T = (julianDate(date) - J2000_JD) / 36525;
  const a = el.a + (el.da || 0) * T;
  const e = el.e + (el.de || 0) * T;
  const I = (el.I + (el.dI || 0) * T) * DEG;
  const L = (el.L + (el.dL || 0) * T) * DEG;
  const peri = (el.peri + (el.dperi || 0) * T) * DEG;
  const node = (el.node + (el.dnode || 0) * T) * DEG;
  const M = wrap180((L - peri) / DEG) * DEG;
  const w = peri - node;
  const E = solveKepler(M, e);
  const cosE = Math.cos(E), sinE = Math.sin(E);
  const xp = a * (cosE - e);
  const yp = a * Math.sqrt(1 - e * e) * sinE;
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(node), sO = Math.sin(node);
  const cI = Math.cos(I), sI = Math.sin(I);
  const x = xp * (cw * cO - sw * sO * cI) - yp * (sw * cO + cw * sO * cI);
  const y = xp * (cw * sO + sw * cO * cI) - yp * (sw * sO - cw * cO * cI);
  const z = xp * (sw * sI) + yp * (cw * sI);
  return { x, y, z, a, e, M: wrap360(M / DEG) };
}

/** Sample one full orbit (ecliptic J2000 AU). */
export function sampleOrbit(el, date, segments = 360) {
  const T = (julianDate(date) - J2000_JD) / 36525;
  const a = el.a + (el.da || 0) * T;
  const e = el.e + (el.de || 0) * T;
  const I = (el.I + (el.dI || 0) * T) * DEG;
  const L = (el.L + (el.dL || 0) * T) * DEG;
  const peri = (el.peri + (el.dperi || 0) * T) * DEG;
  const node = (el.node + (el.dnode || 0) * T) * DEG;
  const w = peri - node;
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(node), sO = Math.sin(node);
  const cI = Math.cos(I), sI = Math.sin(I);
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const E = (i / segments) * Math.PI * 2;
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const x = xp * (cw * cO - sw * sO * cI) - yp * (sw * cO + cw * sO * cI);
    const y = xp * (cw * sO + sw * cO * cI) - yp * (sw * sO - cw * cO * cI);
    const z = xp * (sw * sI) + yp * (cw * sI);
    pts.push({ x, y, z });
  }
  return pts;
}

const cache = new Map();

/** Ecliptic heliocentric positions of planets, AU. */
export function planetPositions(date) {
  const key = Math.round(date.getTime() / 60000); // cache for one simulated minute
  if (cache.has(key)) return cache.get(key);
  const out = {};
  for (const p of ALL_PLANETS) {
    const el = p.orbit || {
      a: p.semiMajorAU, e: 0, I: 0, L: 0, peri: 0, node: 0,
      da: 0, de: 0, dI: 0, dL: 360 / (p.orbitalPeriodDays / 365.25) * 100,
      dperi: 0, dnode: 0,
    };
    out[p.id] = keplerPosition(el, date);
  }
  if (cache.size > 24) cache.clear();
  cache.set(key, out);
  return out;
}

/** Sun direction in ecliptic J2000 coordinates (unit vector) as seen from Earth. */
export function sunDirectionEcliptic(date) {
  const P = planetPositions(date);
  const e = P.earth;
  const len = Math.hypot(e.x, e.y, e.z);
  return { x: -e.x / len, y: -e.y / len, z: -e.z / len };
}

/** Rotate ecliptic → equatorial J2000. */
export function eclipticToEquatorial(x, y, z) {
  const ce = Math.cos(OBLIQUITY), se = Math.sin(OBLIQUITY);
  return { x, y: y * ce - z * se, z: y * se + z * ce };
}

/** Rotate equatorial → ecliptic J2000. */
export function equatorialToEcliptic(x, y, z) {
  const ce = Math.cos(OBLIQUITY), se = Math.sin(OBLIQUITY);
  return { x, y: y * ce + z * se, z: -y * se + z * ce };
}

/** Direction to the Sun in the Earth-centred equatorial frame. */
export function sunDirectionEquatorial(date) {
  const d = sunDirectionEcliptic(date);
  return eclipticToEquatorial(d.x, d.y, d.z);
}

/** Sun geocentric RA/Dec in degrees (apparent geometry, not nutation-corrected). */
export function sunRaDec(date) {
  const d = sunDirectionEquatorial(date);
  return {
    raDeg: wrap360(Math.atan2(d.y, d.x) / DEG),
    decDeg: Math.asin(Math.max(-1, Math.min(1, d.z))) / DEG,
  };
}

/**
 * Low-precision geocentric Moon position (Meeus, abridged).
 * Returns equatorial J2000 Cartesian km. Accurate to roughly a degree;
 * intended for visualisation, not navigation.
 */
export function moonEquatorialPositionKm(date) {
  const d = julianDate(date) - J2000_JD;
  const L = (218.316 + 13.176396 * d) * DEG;      // mean longitude
  const M = (134.963 + 13.064993 * d) * DEG;      // mean anomaly
  const F = (93.272 + 13.229350 * d) * DEG;       // argument of latitude
  const lambda = L + 6.289 * DEG * Math.sin(M);
  const beta = 5.128 * DEG * Math.sin(F);
  const rKm = 385001 - 20905 * Math.cos(M);
  const xEcl = rKm * Math.cos(beta) * Math.cos(lambda);
  const yEcl = rKm * Math.cos(beta) * Math.sin(lambda);
  const zEcl = rKm * Math.sin(beta);
  const eq = eclipticToEquatorial(xEcl, yEcl, zEcl);
  return { x: eq.x, y: eq.y, z: eq.z, rKm, phase: ((L / DEG) % 360 + 360) % 360 };
}

/** Moon position in Earth-scene units (Earth radii), Y up. */
export function moonEarthScenePosition(date, earthRadiusKm = 6378.137) {
  const p = moonEquatorialPositionKm(date);
  return {
    x: p.x / earthRadiusKm,
    y: p.z / earthRadiusKm,
    z: -p.y / earthRadiusKm,
    rKm: p.rKm,
    phase: p.phase,
  };
}

/** Return the moon's local position around its parent, in km. */
export function moonOffsetKm(moon, date) {
  const T = (julianDate(date) - J2000_JD);
  const period = Math.abs(moon.periodDays);
  const direction = moon.periodDays < 0 ? -1 : 1;
  const phase = ((T / period) * 360 * direction + (moon.id.charCodeAt(0) * 37) % 360) % 360;
  const M = phase * DEG;
  const inc = (moon.inclinationDeg || 0) * DEG;
  let x = moon.semiMajorKm * Math.cos(M);
  let y = moon.semiMajorKm * Math.sin(M);
  let z = 0;
  // Tilt the orbit around the x-axis, then add a small node offset.
  const y2 = y * Math.cos(inc) - z * Math.sin(inc);
  const z2 = y * Math.sin(inc) + z * Math.cos(inc);
  return { x, y: y2, z: z2, phase };
}

/** Geocentric distance (AU) and light-time (minutes) from Earth to a planet. */
export function heliocentricDistanceAu(id, date) {
  const P = planetPositions(date);
  const p = P[id];
  if (!p) return null;
  return Math.hypot(p.x, p.y, p.z);
}

export function earthDistanceAu(id, date) {
  const P = planetPositions(date);
  const p = P[id];
  const e = P.earth;
  if (!p || !e) return null;
  return Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z);
}

/** Planet current distance from the Sun/Earth for UI facts. */
export function livePlanetFacts(id, date) {
  const dSun = heliocentricDistanceAu(id, date);
  const dEarth = earthDistanceAu(id, date);
  return {
    dSun,
    dEarth,
    lightMinutes: dEarth ? dEarth * AU_KM / 299792.458 / 60 : null,
    sunLightMinutes: dSun ? dSun * AU_KM / 299792.458 / 60 : null,
  };
}

/**
 * Convert an ecliptic J2000 vector in AU to our Y-up Three.js scene frame.
 * (x, y, z)_ecl -> (x, z, -y)
 */
export function eclipticToScene(v) {
  return { x: v.x, y: v.z, z: -v.y };
}

/** Earth's rotation angle for the globe: local +X points to the GMST meridian. */
export function earthSpinRad(date) {
  // GMST is defined in the equatorial frame. In our scene, +X is RA=0,
  // +Z is RA=90, and rotation about +Y by -GMST places +X at RA=GMST.
  return -gmstRad(date);
}
