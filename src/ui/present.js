/**
 * Presentation layer: turns science records into editorial UI objects.
 * All unknown values are explicitly rendered as unavailable.
 */
import {
  SUN, PLANETS, DWARF_PLANETS, MOONS, GALAXIES, CLUSTERS, NEBULAE, MILKY_WAY,
  EARTH_RADIUS_KM, EARTH_MASS_KG, AU_KM, SOURCES,
} from '../data/featured.js';
import { formatNumber, formatDistance, formatKelvin, formatAngleDeg } from '../astronomy/units.js';
import { formatRAHours, formatDecDeg } from '../astronomy/coordinates.js';
import { comovingDistanceMpc, lookbackGyr, MPC_PER_MLY } from '../astronomy/cosmology.js';

export const UNAVAILABLE = 'Unavailable';

const number = (v, d = 2) => Number.isFinite(v) ? formatNumber(v, d) : UNAVAILABLE;

export function temperatureFromBV(ci) {
  if (!Number.isFinite(ci)) return null;
  const x = 0.92 * ci + 1.7;
  const y = 0.92 * ci + 0.62;
  return 4600 * (1 / x + 1 / y);
}

export function starColor(ci) {
  if (!Number.isFinite(ci)) return '#dfe7f4';
  const t = temperatureFromBV(ci);
  const k = Math.max(1000, Math.min(40000, t)) / 100;
  let r, g, b;
  if (k <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(k) - 161.1195681661;
    b = k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(k - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(k - 60, -0.0755148492);
    b = 255;
  }
  const cl = v => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${cl(r)}, ${cl(g)}, ${cl(b)})`;
}

export function starRadiusFromLuminosity(lum, tempK) {
  if (!Number.isFinite(lum) || !Number.isFinite(tempK) || lum <= 0) return null;
  return Math.sqrt(lum) * Math.pow(5772 / tempK, 2);
}

function sourceBlock(prov) {
  if (!prov) return null;
  return {
    source: prov.source || prov.name || 'Catalogue',
    url: prov.url || null,
    retrieved: prov.retrieved || null,
    model: prov.model || null,
    identifier: prov.identifier || null,
  };
}

function planetPreview(texture) {
  if (!texture) return { style: '', className: '' };
  return {
    style: `background-image:url('assets/textures/${texture}');background-size:185%;background-position:center 46%;`,
    className: 'is-object',
  };
}

function planetObject(p, kindOverride = null) {
  const isDwarf = kindOverride === 'dwarf' || DWARF_PLANETS.some(d => d.id === p.id);
  const facts = [...(p.facts || [])];
  const atmosphere = p.atmosphere || [];
  const subtitle = `${p.type} · ${isDwarf ? 'Dwarf planet' : 'Solar System'}`;
  return {
    id: p.id,
    kind: kindOverride || 'planet',
    kicker: isDwarf ? 'Dwarf planet' : 'Solar System',
    name: p.name,
    subtitle,
    description: p.description || '',
    preview: planetPreview(p.texture),
    facts,
    atmosphere,
    vizNote: p.key === 'earth' ? null : null,
    provenance: sourceBlock(p.provenance),
    actions: ['focus', 'follow', 'orbit', 'compare', 'source'],
    data: p,
  };
}

export function presentEarth() {
  const earth = PLANETS.find(p => p.id === 'earth');
  return {
    ...planetObject(earth),
    actions: ['focus', 'follow', 'compare', 'source'],
    facts: [
      { label: 'Equatorial diameter', value: '12,756.3 km' },
      { label: 'Mass', value: '5.97237 × 10²⁴ kg' },
      { label: 'Distance from Sun', value: '1.000 AU (149.6 million km)' },
      { label: 'Orbital period', value: '365.256 days' },
      { label: 'Rotation period', value: '23.9345 h' },
      { label: 'Mean temperature', value: '288 K (15 °C)' },
      { label: 'Axial tilt', value: '23.44°' },
      { label: 'Known natural satellites', value: '1 (the Moon)' },
    ],
    atmosphere: ['Nitrogen 78.08%', 'Oxygen 20.95%', 'Argon 0.93%', 'Carbon dioxide 0.04%'],
    description: 'Our home world: the only planet known to host life. Liquid-water oceans cover 71 percent of the surface, and a nitrogen–oxygen atmosphere shields a biosphere that has reshaped the planet over four billion years.',
  };
}

export function presentMoon() {
  const m = MOONS.find(x => x.id === 'moon');
  return {
    id: 'moon',
    kind: 'moon',
    kicker: 'Earth system',
    name: 'Moon',
    subtitle: 'Natural satellite · Earth',
    description: m.description,
    preview: planetPreview('2k_moon.jpg'),
    facts: m.facts,
    atmosphere: ['No substantial atmosphere'],
    provenance: sourceBlock(m.provenance),
    actions: ['focus', 'follow', 'orbit', 'compare', 'source'],
    data: m,
  };
}

export function presentSun() {
  return {
    id: 'sun',
    kind: 'sun',
    kicker: 'Solar System',
    name: 'Sun',
    subtitle: 'G2V main-sequence star · The centre of our system',
    description: SUN.description,
    preview: {
      className: 'is-star',
      style: 'background:radial-gradient(circle at 40% 35%, #fff8e8 0%, #ffe3a4 18%, #f6b85c 48%, #a85d20 78%, #3a1c08 100%);box-shadow:0 0 30px rgba(255,201,122,.35), inset -6px -8px 20px rgba(43,16,0,.5);',
    },
    facts: SUN.facts,
    atmosphere: SUN.atmosphere,
    provenance: sourceBlock(SUN.provenance),
    actions: ['focus', 'orbit', 'compare', 'source'],
    data: SUN,
  };
}

export function presentPlanetById(id) {
  if (id === 'earth') return presentEarth();
  const p = [...PLANETS, ...DWARF_PLANETS].find(x => x.id === id);
  if (!p) return null;
  return planetObject(p, DWARF_PLANETS.some(d => d.id === id) ? 'dwarf' : 'planet');
}

export function presentStar(star, system = null) {
  const temp = star.tempK ?? temperatureFromBV(star.ci);
  const radius = star.radiusSun ?? starRadiusFromLuminosity(star.lum, temp);
  const facts = [
    { label: 'Spectral type', value: star.spect || UNAVAILABLE },
    { label: 'Distance from Sun', value: Number.isFinite(star.distPc) ? `${number(star.distPc * 3.26156, 2)} ly · ${number(star.distPc, 2)} pc` : UNAVAILABLE },
    { label: 'Apparent magnitude', value: number(star.mag, 2) },
    { label: 'Absolute magnitude', value: number(star.absmag, 2) },
    { label: 'Effective temperature', value: temp ? `${number(temp, 0)} K${!star.tempK ? ' (estimated from colour)' : ''}` : UNAVAILABLE },
    { label: 'Luminosity', value: Number.isFinite(star.lum) && star.lum > 0 ? `${number(star.lum, star.lum < 1 ? 4 : 2)} L☉` : UNAVAILABLE },
    { label: 'Radius', value: radius ? `${number(radius, radius < 1 ? 3 : 2)} R☉ (derived)` : UNAVAILABLE },
    { label: 'Right ascension', value: Number.isFinite(star.raDeg) ? formatRAHours(star.raDeg) : UNAVAILABLE },
    { label: 'Declination', value: Number.isFinite(star.decDeg) ? formatDecDeg(star.decDeg) : UNAVAILABLE },
    { label: 'Catalogue', value: star.hip ? `HIP ${star.hip}` : star.hd ? `HD ${star.hd}` : star.hr ? `HR ${star.hr}` : 'HYG' },
  ];
  if (system && system.planets?.length) {
    facts.push({ label: 'Confirmed planets', value: `${system.planets.length}` });
  }
  return {
    id: star.hip ? `hip-${star.hip}` : `hyg-${star.i}`,
    kind: 'star',
    kicker: 'Stellar catalogue',
    name: star.name || (star.hip ? `HIP ${star.hip}` : 'Star'),
    subtitle: `${star.spect || 'Star'} · ${Number.isFinite(star.distPc) ? `${number(star.distPc * 3.26156, 2)} light-years` : 'Distance unavailable'}`,
    description: `A ${star.spect ? spectralDescription(star.spect) : 'star'} in the HYG stellar catalogue. ${Number.isFinite(star.distPc) ? `Its light reaches us from ${number(star.distPc * 3.26156, 2)} light-years away.` : 'Its distance is not reliably known.'}`,
    preview: {
      className: 'is-star',
      style: `background:radial-gradient(circle at 40% 35%, #f7fbff 0%, ${starColor(star.ci)} 26%, rgba(10,14,24,.9) 72%, #060a12 100%);box-shadow:0 0 28px ${starColor(star.ci)}44, inset -5px -6px 18px rgba(0,0,0,.6);`,
    },
    facts,
    atmosphere: [],
    vizNote: system?.planets?.length ? 'Planets are known from indirect observations. The star itself is unresolved at interstellar distances; this disc is a visualization.' : null,
    provenance: sourceBlock({
      source: 'HYG Database v4.1, compiled from Hipparcos, Yale BSC and Gliese catalogues',
      url: SOURCES.hyg.url,
      retrieved: '2026-11',
      model: 'Temperature and radius are derived quantities where not direct measurements.',
    }),
    actions: ['focus', 'compare', 'source', ...(system ? ['system'] : [])],
    data: star,
    system,
  };
}

function spectralDescription(spect) {
  if (/^O/i.test(spect)) return 'rare, extremely hot blue star';
  if (/^B/i.test(spect)) return 'hot blue-white star';
  if (/^A/i.test(spect)) return 'white star';
  if (/^F/i.test(spect)) return 'yellow-white star';
  if (/^G/i.test(spect)) return 'Sun-like yellow star';
  if (/^K/i.test(spect)) return 'orange dwarf or giant';
  if (/^M/i.test(spect)) return 'cool red star';
  return 'star';
}

export function presentExoplanet(planet, system) {
  const facts = [
    { label: 'Host star', value: system.host },
    { label: 'Radius', value: Number.isFinite(planet.radiusEarth) ? `${number(planet.radiusEarth, 2)} R⊕` : UNAVAILABLE },
    { label: 'Mass', value: Number.isFinite(planet.massEarth) ? `${number(planet.massEarth, 2)} M⊕` : UNAVAILABLE },
    { label: 'Orbital period', value: Number.isFinite(planet.periodDays) ? `${number(planet.periodDays, planet.periodDays < 10 ? 3 : 1)} days` : UNAVAILABLE },
    { label: 'Semi-major axis', value: Number.isFinite(planet.smaAU) ? `${number(planet.smaAU, 4)} AU` : UNAVAILABLE },
    { label: 'Eccentricity', value: Number.isFinite(planet.eccentricity) ? number(planet.eccentricity, 3) : UNAVAILABLE },
    { label: 'Equilibrium temperature', value: Number.isFinite(planet.equilibriumTempK) ? `${number(planet.equilibriumTempK, 0)} K` : UNAVAILABLE },
    { label: 'Discovery', value: `${planet.method || 'Method unavailable'}${planet.discoveryYear ? ` · ${planet.discoveryYear}` : ''}` },
    { label: 'System distance', value: Number.isFinite(system.distPc) ? `${number(system.distPc * 3.26156, 1)} ly` : UNAVAILABLE },
    { label: 'Coordinates', value: Number.isFinite(system.raDeg) ? `${formatRAHours(system.raDeg)} ${formatDecDeg(system.decDeg)}` : UNAVAILABLE },
  ];
  const color = planetColor(planet);
  return {
    id: planet.name,
    kind: 'exoplanet',
    kicker: 'Confirmed exoplanet',
    name: planet.name,
    subtitle: `${hostType(system)} · ${system.host} system`,
    description: describeExoplanet(planet, system),
    preview: {
      className: 'is-star',
      style: `background:radial-gradient(circle at 34% 30%, #ffffff 0%, ${color} 22%, color-mix(in srgb, ${color} 45%, #05080f) 58%, #04070d 100%);`,
    },
    facts,
    atmosphere: [],
    vizNote: 'Artist’s visualization — the surface appearance of this planet has not been directly observed.',
    provenance: sourceBlock({
      source: 'NASA Exoplanet Archive · pscomppars',
      url: SOURCES.exo.url,
      retrieved: '2026-11',
      model: 'Orbital phase is illustrative; measured epochs are not available for all systems.',
    }),
    actions: ['system', 'compare', 'source'],
    data: planet,
    system: { ...system, _selectedPlanet: planet },
    orbitalView: true,
  };
}

function hostType(system) {
  if (!system.teffK) return 'Exoplanet system';
  if (system.teffK > 6000) return 'Hot host star';
  if (system.teffK > 4500) return 'Sun-like host star';
  return 'Cool dwarf host star';
}

function planetColor(p) {
  if (!Number.isFinite(p.equilibriumTempK)) return '#8fa9bd';
  if (p.equilibriumTempK > 1000) return '#d8916a';
  if (p.equilibriumTempK > 500) return '#c6a47f';
  if (p.equilibriumTempK > 300) return '#8fb7b4';
  if (p.equilibriumTempK > 180) return '#7aa4c8';
  return '#9bbcce';
}

function describeExoplanet(p, system) {
  const size = Number.isFinite(p.radiusEarth)
    ? p.radiusEarth > 6 ? 'a gas-giant-sized world' : p.radiusEarth > 2.5 ? 'a sub-Neptune-sized world' : p.radiusEarth > 1.4 ? 'a super-Earth-sized world' : 'an Earth-sized world'
    : 'a confirmed planet';
  const orbit = Number.isFinite(p.periodDays) ? `orbiting its host in ${number(p.periodDays, 1)} days` : 'in orbit around its host';
  return `${p.name} is ${size} ${orbit}. It was confirmed by the ${p.method || 'an observational'} method${p.discoveryYear ? ` in ${p.discoveryYear}` : ''}. Its distance from Earth places it in the ${hostType(system).toLowerCase()} regime where atmosphere studies remain observationally challenging.`;
}

export function presentExoSystem(system, selectedPlanet = null) {
  const planet = selectedPlanet || system.planets[0];
  const facts = [
    { label: 'Host star', value: system.host },
    { label: 'Spectral type', value: system.spect || UNAVAILABLE },
    { label: 'Effective temperature', value: Number.isFinite(system.teffK) ? `${number(system.teffK, 0)} K` : UNAVAILABLE },
    { label: 'Stellar radius', value: Number.isFinite(system.radiusSun) ? `${number(system.radiusSun, 2)} R☉` : UNAVAILABLE },
    { label: 'Stellar mass', value: Number.isFinite(system.massSun) ? `${number(system.massSun, 2)} M☉` : UNAVAILABLE },
    { label: 'Distance', value: Number.isFinite(system.distPc) ? `${number(system.distPc * 3.26156, 1)} ly` : UNAVAILABLE },
    { label: 'Confirmed planets', value: `${system.planets.length}` },
    { label: 'Coordinates', value: Number.isFinite(system.raDeg) ? `${formatRAHours(system.raDeg)}` : UNAVAILABLE },
  ];
  return {
    id: system.host,
    kind: 'system',
    kicker: 'Confirmed planetary system',
    name: system.host,
    subtitle: `${system.planets.length} confirmed planet${system.planets.length === 1 ? '' : 's'} · Artist’s visualization`,
    description: `A planetary system ${Number.isFinite(system.distPc) ? `${number(system.distPc * 3.26156, 1)} light-years` : 'at an uncertain distance'} from Earth. The orbital view uses measured period, semi-major axis and eccentricity where published; planet surfaces are artistic visualizations.`,
    preview: {
      className: 'is-star',
      style: `background:radial-gradient(circle at 40% 35%, #fff 0%, #ffd9a0 24%, #b7793a 64%, #120a06 100%);`,
    },
    facts,
    vizNote: 'Artist’s visualization. Surface appearance and global colour are not directly observed. Orbital distances use published semi-major axes; body sizes are enlarged for visibility.',
    provenance: sourceBlock({ source: 'NASA Exoplanet Archive · pscomppars', url: SOURCES.exo.url, retrieved: '2026-11', model: 'Orbits use available measured parameters.' }),
    actions: ['system', 'compare', 'source'],
    data: system,
    system: { ...system, _selectedPlanet: planet },
    orbitalView: true,
  };
}

export function presentGalaxy(g, { milkyWay = false } = {}) {
  const lookback = Number.isFinite(g.lookbackGyr) ? g.lookbackGyr : null;
  const dist = g.distMpc;
  const type = g.type || 'Galaxy';
  const facts = [
    { label: 'Morphology', value: g.subtype || type },
    { label: 'Distance', value: Number.isFinite(dist) ? `${number(dist * MPC_PER_MLY, dist < 1 ? 2 : 1)} Mly · ${number(dist, 2)} Mpc` : UNAVAILABLE },
    { label: 'Right ascension', value: Number.isFinite(g.ra) ? formatRAHours(g.ra) : UNAVAILABLE },
    { label: 'Declination', value: Number.isFinite(g.dec) ? formatDecDeg(g.dec) : UNAVAILABLE },
    { label: 'Redshift', value: Number.isFinite(g.redShift) ? `${g.redShift.toFixed(6)}${g.redShift < 0 ? ' (blueshifted)' : ''}` : UNAVAILABLE },
    { label: 'Lookback time', value: lookback != null ? `${number(lookback, 2)} Gyr` : g.redShift < 0 ? 'Approaching the Local Group' : UNAVAILABLE },
    { label: 'Estimated diameter', value: Number.isFinite(g.diameterKpc) ? `${number(g.diameterKpc, 1)} kpc (${number(g.diameterKpc * 3.26156, 0)} thousand ly)` : UNAVAILABLE },
    { label: 'Apparent magnitude', value: number(g.magV, 2) },
    { label: 'Group / cluster', value: g.group || UNAVAILABLE },
  ];
  if (g.role) facts.unshift({ label: 'Role', value: g.role });
  return {
    id: g.id,
    kind: 'galaxy',
    kicker: milkyWay ? 'Our galaxy' : g.group || 'Extragalactic atlas',
    name: g.name,
    subtitle: `${type}${g.subtype ? ` · ${g.subtype}` : ''}${milkyWay ? ' · Schematic model' : ''}`,
    description: g.description || '',
    preview: {
      className: `is-galaxy galaxy-${g.model?.type || (type.toLowerCase().includes('elliptical') ? 'elliptical' : 'spiral')}`,
      style: '',
    },
    facts,
    atmosphere: [],
    vizNote: g.viz?.label || (milkyWay ? 'Schematic model — the galaxy has never been photographed from outside.' : 'Illustrative 3D structure informed by observed parameters.'),
    provenance: sourceBlock(g.provenance || { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' }),
    actions: ['focus', 'compare', 'source'],
    data: g,
    milkyWay,
  };
}

export function presentCluster(c) {
  const z = c.z;
  const comoving = Number.isFinite(z) && z > 0 ? comovingDistanceMpc(z) : c.computedDistanceMpc;
  const lookback = Number.isFinite(z) && z > 0 ? lookbackGyr(z) : null;
  const facts = [
    { label: 'Type', value: c.type },
    { label: 'Distance', value: Number.isFinite(c.computedDistanceMpc) ? `${number(c.computedDistanceMpc * MPC_PER_MLY, 0)} Mly${z > 0 ? ' (comoving)' : ''}` : UNAVAILABLE },
    { label: 'Redshift', value: Number.isFinite(z) ? z.toFixed(4) : UNAVAILABLE },
    { label: 'Lookback time', value: lookback != null ? `${number(lookback, 2)} Gyr` : UNAVAILABLE },
    { label: 'Right ascension', value: Number.isFinite(c.ra) ? formatRAHours(c.ra) : UNAVAILABLE },
    { label: 'Declination', value: Number.isFinite(c.dec) ? formatDecDeg(c.dec) : UNAVAILABLE },
    { label: 'Membership', value: c.richness || UNAVAILABLE },
    { label: 'Extent', value: Number.isFinite(c.diameterMpc) ? `${number(c.diameterMpc, 1)} Mpc` : Number.isFinite(c.extentMpc) ? `${number(c.extentMpc, 0)} Mpc` : UNAVAILABLE },
  ];
  return {
    id: c.id,
    kind: 'cluster',
    kicker: c.type || 'Large-scale structure',
    name: c.name,
    subtitle: `${c.type}${c.z ? ` · z = ${c.z.toFixed(4)}` : ''}`,
    description: c.description || '',
    preview: { className: 'is-cluster', style: '' },
    facts,
    atmosphere: [],
    vizNote: c.id === 'great-wall' ? 'This is a reconstructed large-scale structure, not a single gravitationally bound object.' : null,
    provenance: sourceBlock(c.provenance),
    actions: ['focus', 'compare', 'source'],
    data: c,
  };
}

export function presentNebula(n) {
  return {
    id: n.id,
    kind: 'nebula',
    kicker: 'Milky Way · Interstellar medium',
    name: n.name,
    subtitle: n.type,
    description: n.description,
    preview: { className: 'is-nebula', style: `--nebula:${n.color};` },
    facts: [
      { label: 'Type', value: n.type },
      { label: 'Distance', value: `${number(n.distKpc * 3.26156, 0)} thousand ly` },
      { label: 'Right ascension', value: formatRAHours(n.ra) },
      { label: 'Declination', value: formatDecDeg(n.dec) },
    ],
    atmosphere: [],
    vizNote: 'Illustrative glow based on the object’s classification; no resolved image is shown.',
    provenance: sourceBlock({ source: 'SIMBAD/NED literature values, rounded', url: SOURCES.ned.url, retrieved: '2026-11' }),
    actions: ['focus', 'source'],
    data: n,
  };
}

export function presentMilkyWay() {
  return {
    ...presentGalaxy(MILKY_WAY, { milkyWay: true }),
    facts: [
      { label: 'Morphology', value: 'SB(rs)bc barred spiral' },
      { label: 'Diameter', value: '≈ 30.6 kpc (100,000 ly)' },
      { label: 'Stellar mass', value: '≈ 6 × 10¹⁰ M☉' },
      { label: 'Sun’s distance from centre', value: '≈ 8.15 kpc (26,000 ly)' },
      { label: 'Galactic centre', value: 'Sagittarius A* — 4.3 million M☉' },
      { label: 'Approximate age', value: '13.6 billion years' },
      { label: 'Satellite galaxies', value: 'Large & Small Magellanic Clouds, and many dwarfs' },
    ],
    vizNote: 'Schematic 3D model informed by published Milky Way structure. Individual star positions in the solar neighbourhood come from the HYG catalogue.',
    actions: ['focus', 'compare', 'source'],
  };
}

export function presentLandmark(lm) {
  return {
    id: `landmark-${lm.name}`,
    kind: 'landmark',
    kicker: 'Earth · Surface reference',
    name: lm.name,
    subtitle: `${lm.kind} · ${lm.lat.toFixed(2)}°, ${lm.lon.toFixed(2)}°`,
    description: lm.note,
    preview: { className: 'is-object', style: 'background:radial-gradient(circle at 40% 40%, #2a5b88, #0b1a2a 55%, #040810);' },
    facts: [
      { label: 'Latitude', value: `${lm.lat.toFixed(3)}°` },
      { label: 'Longitude', value: `${lm.lon.toFixed(3)}°` },
      { label: 'Type', value: lm.kind },
    ],
    atmosphere: [],
    provenance: sourceBlock({ source: 'Geographic reference point', url: null, retrieved: null }),
    actions: ['focus'],
    data: lm,
  };
}

export function presentWeb(meta = null) {
  return {
    id: 'sdss-web',
    kind: 'structure',
    kicker: 'Cosmic web',
    name: 'The Observable Web',
    subtitle: 'Large-scale structure traced by SDSS galaxies',
    description: 'Each point is a spectroscopically observed galaxy. Their three-dimensional distribution reveals filaments, walls and voids shaped by gravity and the expansion of space. This atlas uses a shallow, incomplete SDSS slice: it does not cover the whole sky, and it is not a complete map of the cosmic web.',
    preview: { className: 'is-cluster', style: '' },
    facts: [
      { label: 'Galaxy sample', value: meta?.count ? `${meta.count.toLocaleString('en-US')} SDSS DR18 galaxies` : 'SDSS DR18 galaxies' },
      { label: 'Redshift range', value: meta?.zMin != null ? `${meta.zMin.toFixed(3)} – ${meta.zMax.toFixed(3)} (galaxies)` : 'Shallow SDSS slice' },
      { label: 'Quasar sample', value: '8,000 SDSS DR18 quasars (z ≤ 0.21)' },
      { label: 'Distance measure', value: 'Comoving, flat ΛCDM (H₀ = 70, Ωm = 0.3)' },
      { label: 'Survey coverage', value: 'Partial sky and partial redshift — not complete' },
      { label: 'Observational horizon', value: '≈ 14.3 Gpc comoving (46.5 billion ly)' },
    ],
    atmosphere: [],
    vizNote: 'Observed catalogue data, not a complete map of the Universe. The SDSS slice is shallow; the faint horizon grid is a visualization of the observational boundary, not a physical surface.',
    provenance: sourceBlock({ source: 'Sloan Digital Sky Survey DR18', url: SOURCES.sdss.url, retrieved: '2026-11', model: 'Comoving positions derived from redshift.' }),
    actions: ['focus', 'compare', 'source'],
    data: { id: 'sdss-web' },
  };
}

export function presentMoonById(id) {
  if (id === 'moon') return presentMoon();
  const m = MOONS.find(x => x.id === id);
  if (!m) return null;
  const parent = PLANETS.find(p => p.id === m.parent) || DWARF_PLANETS.find(p => p.id === m.parent);
  return {
    id: m.id,
    kind: 'moon',
    kicker: `${parent?.name || 'Planet'} system`,
    name: m.name,
    subtitle: `Natural satellite · ${parent?.name || 'Solar System'}`,
    description: m.description || `${m.name} is a natural satellite of ${parent?.name || 'its parent planet'}.`,
    preview: {
      className: 'is-object',
      style: `background:radial-gradient(circle at 34% 30%, color-mix(in srgb, ${m.color} 75%, #ffffff) 0%, ${m.color} 32%, color-mix(in srgb, ${m.color} 45%, #05080f) 70%, #04070d 100%);`,
    },
    facts: m.facts,
    atmosphere: [],
    vizNote: 'Surface appearance is illustrative. The global colour and albedo are informed by published measurements where available.',
    provenance: sourceBlock(m.provenance),
    actions: ['focus', 'follow', 'compare', 'source'],
    data: m,
  };
}


export function presentSurveyPoint(data) {
  const z = Number(data.z);
  const dc = Number.isFinite(z) && z > 0 ? comovingDistanceMpc(z) : null;
  const look = Number.isFinite(z) && z > 0 ? lookbackGyr(z) : null;
  const isQso = data.survey?.toLowerCase().includes('quasar');
  const name = isQso ? 'SDSS quasar' : 'SDSS galaxy';
  return {
    id: `survey-${data.survey}-${data.index}`,
    kind: isQso ? 'quasar' : 'galaxy-survey',
    kicker: 'Spectroscopic survey object',
    name,
    subtitle: `${data.survey} · z = ${Number.isFinite(z) ? z.toFixed(4) : '—'}`,
    description: isQso
      ? 'A spectroscopically confirmed quasar from the Sloan Digital Sky Survey. The point marks its comoving position; it has no resolved image in this atlas.'
      : 'A galaxy with a measured spectroscopic redshift from the Sloan Digital Sky Survey. EON plots its comoving position; no individual name or image is available for this target.',
    preview: isQso
      ? { className: 'is-star', style: 'background:radial-gradient(circle at 45% 42%, #eaffff, #74d8d0 30%, #0d3540 70%, #04070d);' }
      : { className: 'is-cluster', style: '' },
    facts: [
      { label: 'Redshift', value: Number.isFinite(z) ? z.toFixed(5) : UNAVAILABLE },
      { label: 'Comoving distance', value: dc != null ? `${number(dc, dc < 100 ? 1 : 0)} Mpc` : UNAVAILABLE },
      { label: 'Lookback time', value: look != null ? `${number(look, 2)} Gyr` : UNAVAILABLE },
      { label: 'Right ascension', value: Number.isFinite(data.raDeg) ? formatRAHours(data.raDeg) : UNAVAILABLE },
      { label: 'Declination', value: Number.isFinite(data.decDeg) ? formatDecDeg(data.decDeg) : UNAVAILABLE },
    ],
    atmosphere: [],
    vizNote: 'This is catalogue data. The object is unresolved at this distance; no surface or structural detail is implied.',
    provenance: sourceBlock({
      source: 'Sloan Digital Sky Survey DR18 · SpecObj',
      url: SOURCES.sdss.url,
      retrieved: '2026-11',
      model: 'Comoving position from redshift in flat ΛCDM (H₀=70, Ωm=0.3).',
    }),
    actions: ['compare', 'source'],
    data,
  };
}
