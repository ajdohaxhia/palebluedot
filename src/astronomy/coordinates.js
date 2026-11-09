/**
 * Coordinate transforms.
 *
 * Equatorial J2000: x -> RA 0h, y -> RA 6h, z -> north celestial pole.
 * Galactic: x -> l=0,b=0, y -> l=90, z -> north galactic pole.
 * Deep-scene frame: Y up (galactic north), X to the Galactic Centre, Z to l=90.
 * Sun: 8.15 kpc from the Galactic Centre toward l=180.
 */

import { PARSEC, KPC, MPC, LIGHT_YEAR } from './units.js';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** ICRS/J2000 -> Galactic rotation matrix (astropy/IAU). */
export const EQ_TO_GAL = [
  [-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
];

export function equatorialToGalactic(x, y, z) {
  const m = EQ_TO_GAL;
  return {
    x: m[0][0] * x + m[0][1] * y + m[0][2] * z,
    y: m[1][0] * x + m[1][1] * y + m[1][2] * z,
    z: m[2][0] * x + m[2][1] * y + m[2][2] * z,
  };
}

export function galacticToEquatorial(x, y, z) {
  // transpose of the orthogonal rotation
  const m = EQ_TO_GAL;
  return {
    x: m[0][0] * x + m[1][0] * y + m[2][0] * z,
    y: m[0][1] * x + m[1][1] * y + m[2][1] * z,
    z: m[0][2] * x + m[1][2] * y + m[2][2] * z,
  };
}

/** Galactic vector in kpc -> deep-scene vector in Mpc (Y up). */
export function galacticKpcToScene(gx, gy, gz) {
  return { x: gx / 1000, y: gz / 1000, z: -gy / 1000 };
}

/** Galactic vector in Mpc -> deep-scene Mpc. */
export function galacticMpcToScene(gx, gy, gz) {
  return { x: gx, y: gz, z: -gy };
}

/** Equatorial vector in Mpc -> deep-scene Mpc (no Sun offset). */
export function equatorialMpcToScene(x, y, z) {
  const g = equatorialToGalactic(x, y, z);
  return galacticMpcToScene(g.x, g.y, g.z);
}

/** Equatorial vector in pc (helio-centric) -> deep-scene Mpc relative to Sun. */
export function equatorialPcToSceneRelative(x, y, z) {
  const g = equatorialToGalactic(x, y, z); // pc
  return { x: g.x / 1e3 / 1e3, y: g.z / 1e3 / 1e3, z: -g.y / 1e3 / 1e3 };
  // pc -> kpc (1e3) -> Mpc (1e3)
}

/** Sun's position in the deep-scene frame, Mpc. Galactic X points to the centre. */
export const SUN_SCENE_MPC = { x: -8.15 / 1000, y: 0, z: 0 };
export const SUN_GAL_KPC = { x: -8.15, y: 0, z: 0 };
export const GALACTIC_CENTRE_SCENE = { x: 0, y: 0, z: 0 };

export function equatorialHelioPcToWorldMpc(x, y, z) {
  const rel = equatorialPcToSceneRelative(x, y, z);
  return {
    x: SUN_SCENE_MPC.x + rel.x,
    y: SUN_SCENE_MPC.y + rel.y,
    z: SUN_SCENE_MPC.z + rel.z,
    relX: rel.x, relY: rel.y, relZ: rel.z,
  };
}

export function raDecToEquatorialUnit(raDeg, decDeg) {
  const ra = raDeg * D2R, dec = decDeg * D2R;
  const cd = Math.cos(dec);
  return { x: cd * Math.cos(ra), y: cd * Math.sin(ra), z: Math.sin(dec) };
}

/** RA/Dec/distance in Mpc -> deep scene world position in Mpc. */
export function raDecDistanceMpcToWorld(raDeg, decDeg, distMpc) {
  const u = raDecToEquatorialUnit(raDeg, decDeg);
  const s = equatorialMpcToScene(u.x * distMpc, u.y * distMpc, u.z * distMpc);
  return {
    x: SUN_SCENE_MPC.x + s.x,
    y: SUN_SCENE_MPC.y + s.y,
    z: SUN_SCENE_MPC.z + s.z,
  };
}

/** Equatorial pc vector to deep scene in Mpc. */
export function eqPcVecToWorldMpc(x, y, z) {
  return equatorialHelioPcToWorldMpc(x, y, z);
}

/** RA/Dec/parsecs to world Mpc. */
export function raDecParsecsToWorld(raDeg, decDeg, distPc) {
  const u = raDecToEquatorialUnit(raDeg, decDeg);
  return equatorialHelioPcToWorldMpc(u.x * distPc, u.y * distPc, u.z * distPc);
}

/** RA/Dec/kpc to world Mpc. */
export function raDecKpcToWorld(raDeg, decDeg, distKpc) {
  return raDecParsecsToWorld(raDeg, decDeg, distKpc * 1000);
}

export function celestialToSceneEquatorial(xEq, yEq, zEq) {
  // Earth frame: +X RA 0, +Y NCP, +Z RA 90.
  return { x: xEq, y: zEq, z: -yEq };
}

/** Direction in the Earth scene -> equatorial vector. */
export function sceneToEquatorial(x, y, z) {
  return { x, y: -z, z: y };
}

/** Sun direction in the Earth scene. */
export function sunDirectionEarthScene(eqDir) {
  return { x: eqDir.x, y: eqDir.z, z: -eqDir.y };
}

const TAU = Math.PI * 2;

/**
 * Earth texture longitude/latitude from a direction in the Earth's local frame.
 * The equirectangular texture has longitude 0° at u=0.5 and longitude −180° at u=0.
 * Three.js SphereGeometry maps u=0 to local −X, u=0.25 to +Z, u=0.5 to +X.
 */
export function earthLatLonFromLocal(local) {
  const r = Math.hypot(local.x, local.y, local.z) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, local.y / r)));
  let u = Math.atan2(local.z, -local.x) / TAU;
  if (u < 0) u += 1;
  const lon = (u - 0.5) * 360;
  return {
    latDeg: lat * R2D,
    lonDeg: ((lon + 180) % 360 + 360) % 360 - 180,
    u, v: 0.5 + lat / Math.PI,
  };
}

/** Local direction for a latitude/longitude in the Earth texture frame. */
export function earthLocalFromLatLon(latDeg, lonDeg) {
  const lat = latDeg * D2R;
  const u = lonDeg / 360 + 0.5; // texture u
  // Invert the SphereGeometry parameterisation.
  const theta = Math.PI / 2 - lat;
  const phi = u * TAU;
  return {
    x: -Math.cos(phi) * Math.cos(lat),
    y: Math.sin(lat),
    z: Math.sin(phi) * Math.cos(lat),
  };
}

export function angularSeparationDeg(ra1, dec1, ra2, dec2) {
  const a1 = ra1 * D2R, d1 = dec1 * D2R, a2 = ra2 * D2R, d2 = dec2 * D2R;
  const c = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(a1 - a2);
  return Math.acos(Math.max(-1, Math.min(1, c))) * R2D;
}

export function formatRAHours(raDeg) {
  const h = ((raDeg % 360) + 360) % 360 / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m ${ss.toFixed(1).padStart(4, '0')}s`;
}

export function formatDecDeg(decDeg) {
  const sign = decDeg < 0 ? '−' : '+';
  const a = Math.abs(decDeg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = ((a - d) * 60 - m) * 60;
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′ ${s.toFixed(0).padStart(2, '0')}″`;
}
