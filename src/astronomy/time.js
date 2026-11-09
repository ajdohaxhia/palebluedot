/** Astronomical time, Julian dates, and the simulation clock. */

export const J2000_JD = 2451545.0;
export const UNIX_EPOCH_JD = 2440587.5;
export const MS_PER_DAY = 86400000;

export const SPEEDS = [1, 10, 100, 1000, 10000];
export const DATE_MIN = new Date(Date.UTC(1800, 0, 1));
export const DATE_MAX = new Date(Date.UTC(2050, 11, 31, 23, 59, 59));
export const PRESENT = () => new Date(Date.now());

export function julianDate(date) {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

export function dateFromJulian(jd) {
  return new Date((jd - UNIX_EPOCH_JD) * MS_PER_DAY);
}

export function centuriesSinceJ2000(date) {
  return (julianDate(date) - J2000_JD) / 36525;
}

export function daysSinceJ2000(date) {
  return julianDate(date) - J2000_JD;
}

/**
 * Greenwich Mean Sidereal Time in degrees.
 * Meeus, Astronomical Algorithms (formula 12.4). Accurate to seconds.
 */
export function gmstDeg(date) {
  const jd = julianDate(date);
  const T = (jd - J2000_JD) / 36525;
  let g = 280.46061837 + 360.98564736629 * (jd - J2000_JD) + 0.000387933 * T * T - T * T * T / 38710000;
  g = ((g % 360) + 360) % 360;
  return g;
}

export function gmstRad(date) {
  return gmstDeg(date) * Math.PI / 180;
}

/** Local sidereal time for a longitude east of Greenwich (degrees). */
export function localSiderealDeg(date, lonDeg) {
  return ((gmstDeg(date) + lonDeg) % 360 + 360) % 360;
}

export function formatJD(jd, digits = 3) {
  return Number.isFinite(jd) ? jd.toFixed(digits) : '—';
}

/** The shared simulation clock. */
export class TimeEngine {
  constructor({ speed = 100, playing = true, date = PRESENT() } = {}) {
    this.date = new Date(date);
    this.speed = speed;
    this.direction = 1;
    this.playing = playing;
    this.listeners = new Set();
    this._lastNotified = 0;
    this._dirty = true;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(force = false) {
    const now = performance.now();
    if (!force && now - this._lastNotified < 100) return;
    this._lastNotified = now;
    this._dirty = false;
    for (const fn of this.listeners) fn(this);
  }

  setDate(date, force = true) {
    const d = new Date(date);
    if (!Number.isFinite(d.getTime())) return;
    if (d < DATE_MIN) d.setTime(DATE_MIN.getTime());
    if (d > DATE_MAX) d.setTime(DATE_MAX.getTime());
    this.date = d;
    this._dirty = true;
    this.emit(force);
  }

  setSpeed(speed) {
    this.speed = speed;
    this.emit(false);
  }

  setPlaying(p) {
    this.playing = !!p;
    this.emit(true);
  }

  toggle() { this.setPlaying(!this.playing); }

  setDirection(d) {
    this.direction = d < 0 ? -1 : 1;
    this.emit(true);
  }

  resetNow() {
    this.setDate(PRESENT());
  }

  /** Real elapsed seconds -> simulated milliseconds. */
  update(realDtSeconds) {
    if (!this.playing) return;
    const deltaMs = realDtSeconds * 1000 * this.speed * this.direction;
    if (!Number.isFinite(deltaMs) || deltaMs === 0) return;
    let next = this.date.getTime() + deltaMs;
    // Clamp to the interval in which the JPL elements are fitted.
    if (next < DATE_MIN.getTime()) next = DATE_MIN.getTime();
    if (next > DATE_MAX.getTime()) next = DATE_MAX.getTime();
    this.date = new Date(next);
    this._dirty = true;
    this.emit(false);
  }

  get isDirty() { return this._dirty; }
  clearDirty() { this._dirty = false; }
}
