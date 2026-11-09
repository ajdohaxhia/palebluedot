/** Flat ΛCDM cosmology and distance-measure conversions. */

export const H0 = 70.0;
export const OMEGA_M = 0.3;
export const OMEGA_L = 0.7;
export const C_KM_S = 299792.458;
export const DH_MPC = C_KM_S / H0;         // Hubble distance, Mpc
export const HUBBLE_TIME_GYR = 977.7922216 / H0;
export const MPC_PER_MLY = 3.261563777;
export const GYR = 1;

export function E(z) {
  return Math.sqrt(OMEGA_M * Math.pow(1 + z, 3) + OMEGA_L);
}

/** Line-of-sight comoving distance in Mpc. Integrates from 0 to z. */
export function comovingDistanceMpc(z) {
  if (!Number.isFinite(z) || z <= 0) return 0;
  const n = 256;
  const h = z / n;
  let s = 1 / E(0) + 1 / E(z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / E(i * h);
  return DH_MPC * s * h / 3;
}

/** Lookback time in Gyr. */
export function lookbackGyr(z) {
  if (!Number.isFinite(z) || z <= 0) return 0;
  const n = 256;
  const h = z / n;
  let s = 1 / ((1 + 0) * E(0)) + 1 / ((1 + z) * E(z));
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / ((1 + i * h) * E(i * h));
  return HUBBLE_TIME_GYR * s * h / 3;
}

/** Age of the universe at redshift z, Gyr. */
export function ageAtRedshiftGyr(z) {
  return HUBBLE_TIME_GYR - lookbackGyr(z);
}

/** Angular diameter distance, Mpc. */
export function angularDiameterDistanceMpc(z) {
  if (!Number.isFinite(z) || z <= 0) return 0;
  return comovingDistanceMpc(z) / (1 + z);
}

/** Luminosity distance, Mpc. */
export function luminosityDistanceMpc(z) {
  if (!Number.isFinite(z) || z <= 0) return 0;
  return comovingDistanceMpc(z) * (1 + z);
}

/** Convert comoving Mpc to million light-years. */
export function mpcToMly(mpc) { return mpc * MPC_PER_MLY; }
export function mlyToMpc(mly) { return mly / MPC_PER_MLY; }

/** Approximate scale factor for a given redshift. */
export function scaleFactor(z) { return 1 / (1 + z); }

/** The redshift at which a comoving distance is reached (bisection). */
export function redshiftForComovingDistance(mpc) {
  if (mpc <= 0) return 0;
  let lo = 0, hi = 20;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (comovingDistanceMpc(mid) < mpc) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
