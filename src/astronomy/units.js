/** Centralised unit conversions and formatting. All physical values are SI unless noted. */

export const KM = 1e3;
export const AU = 1.495978707e11;          // metres
export const LIGHT_YEAR = 9.4607304725808e15;
export const PARSEC = 3.0856775814913673e16;
export const KPC = PARSEC * 1e3;
export const MPC = PARSEC * 1e6;
export const GPC = PARSEC * 1e9;

export const AU_KM = AU / KM;
export const LY_KM = LIGHT_YEAR / KM;
export const PC_KM = PARSEC / KM;
export const MPC_KM = MPC / KM;
export const MPC_LY = MPC / LIGHT_YEAR;
export const GYR_S = 3.15576e16;
export const YEAR_S = 3.15576e7;
export const DAY_S = 86400;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const invLerp = (a, b, v) => (v - a) / (b - a);

/** Format a physical distance (metres) with an adaptive unit. */
export function formatDistance(m, opts = {}) {
  if (!Number.isFinite(m)) return '—';
  const abs = Math.abs(m);
  if (abs < 1e3) return `${formatNumber(m, abs < 10 ? 2 : 0)} m`;
  if (abs < 1e9) return `${formatNumber(m / KM, abs < 1e7 ? 1 : 0)} km`;
  if (abs < 0.01 * AU) return `${formatNumber(m / KM, 0)} km`;
  if (abs < 0.1 * LIGHT_YEAR) {
    const au = m / AU;
    return `${formatNumber(au, au < 10 ? 3 : au < 100 ? 2 : 1)} AU`;
  }
  if (abs < 1e4 * LIGHT_YEAR) {
    const ly = m / LIGHT_YEAR;
    return `${formatNumber(ly, ly < 10 ? 2 : ly < 100 ? 1 : 0)} ly`;
  }
  if (abs < 1e7 * LIGHT_YEAR) {
    const kpc = m / KPC;
    return `${formatNumber(kpc, kpc < 10 ? 2 : kpc < 100 ? 1 : 0)} kpc`;
  }
  if (abs < 1e10 * LIGHT_YEAR) {
    const mpc = m / MPC;
    return `${formatNumber(mpc, mpc < 10 ? 2 : mpc < 100 ? 1 : 0)} Mpc`;
  }
  const gpc = m / GPC;
  return `${formatNumber(gpc, gpc < 10 ? 2 : 1)} Gpc`;
}

/** Format a distance in Mpc using Mly for nearby values. */
export function formatMpc(mpc, opts = {}) {
  if (!Number.isFinite(mpc)) return 'Unavailable';
  const ly = mpc * MPC_LY;
  if (ly < 1e6) {
    if (ly < 1e4) return `${formatNumber(ly / 1000, 2)} thousand ly`;
    return `${formatNumber(ly / 1e6, 2)} million ly`;
  }
  if (ly < 1e9) return `${formatNumber(ly / 1e6, ly < 1e8 ? 1 : 2)} million ly`;
  if (ly < 1e12) return `${formatNumber(ly / 1e9, 2)} billion ly`;
  return `${formatNumber(mpc, 1)} Mpc`;
}

export function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e16 || (Math.abs(value) > 0 && Math.abs(value) < 1e-4)) {
    return value.toExponential(2).replace('e+', ' × 10^').replace('e-', ' × 10^−');
  }
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatRadiusKm(km) {
  if (!Number.isFinite(km)) return 'Unavailable';
  if (km >= 1e6) return `${formatNumber(km, 0)} km`;
  return `${formatNumber(km, km < 100 ? 1 : 0)} km`;
}

export function formatMassKg(kg) {
  if (!Number.isFinite(kg)) return 'Unavailable';
  return `${kg.toExponential(3).replace('e+', ' × 10^')} kg`;
}

export function formatKelvin(k) {
  if (!Number.isFinite(k)) return 'Unavailable';
  const c = k - 273.15;
  return `${formatNumber(k, 0)} K (${formatNumber(c, 0)} °C)`;
}

export function formatDegrees(deg, digits = 2) {
  if (!Number.isFinite(deg)) return 'Unavailable';
  return `${formatNumber(deg, digits)}°`;
}

export function formatRA(raDeg) {
  if (!Number.isFinite(raDeg)) return 'Unavailable';
  let h = ((raDeg % 360) + 360) % 360 / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m ${ss.toFixed(1).padStart(4, '0')}s`;
}

export function formatDec(decDeg) {
  if (!Number.isFinite(decDeg)) return 'Unavailable';
  const sign = decDeg < 0 ? '−' : '+';
  const a = Math.abs(decDeg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = ((a - d) * 60 - m) * 60;
  return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′ ${s.toFixed(0).padStart(2, '0')}″`;
}

export function formatAngleDeg(deg, digits = 2) {
  if (!Number.isFinite(deg)) return 'Unavailable';
  return `${formatNumber(deg, digits)}°`;
}

export function formatPercent(v, digits = 1) {
  if (!Number.isFinite(v)) return 'Unavailable';
  return `${formatNumber(v * 100, digits)}%`;
}

export function formatDateUTC(date, withTime = false) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return 'Unavailable';
  const pad = n => String(n).padStart(2, '0');
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  if (!withTime) return `${y}-${mo}-${d}`;
  return `${y}-${mo}-${d} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function formatFov(degrees) {
  if (!Number.isFinite(degrees)) return '—';
  if (degrees < 1) return `${(degrees * 60).toFixed(1)}′`;
  return `${numberFmt(degrees, degrees < 10 ? 2 : 1)}°`;
}

const numberFmt = (v, d) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(v);

/** Adaptive length for a given metres-per-pixel / field of view. */
export function describeScale(fovDeg, viewportHeight = 900) {
  const fovRad = fovDeg * Math.PI / 180;
  const metres = 2 * Math.tan(fovRad / 2) * (viewportHeight / 2); // placeholder replaced by scene callers
  return formatDistance(metres);
}

export function log10(v) { return Math.log10(Math.max(v, 1e-30)); }

export function distanceMpcToMly(mpc) { return mpc * (MPC / LIGHT_YEAR) / 1e6; }
