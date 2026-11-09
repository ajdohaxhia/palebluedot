/**
 * EON curated scientific data.
 *
 * Everything here is either measured or derived from published values.
 * `viz` fields describe visualization choices and are kept separate from
 * physical data. Approximate models are labelled in the interface.
 *
 * Primary sources:
 *   NASA/JPL Planetary Physical Parameters & Approximate Positions (Standish)
 *   NASA Solar System Exploration fact sheets
 *   NASA/IPAC Extragalactic Database (NED) values, rounded
 *   IAU / NASA Exoplanet Archive
 */

export const AU_KM = 149_597_870.7;
export const AU_M = 149_597_870_700;
export const LY_KM = 9.4607304725808e12;
export const PC_KM = 3.0856775814913673e13;
export const PC_M = 3.0856775814913673e16;
export const MPC_M = 3.0856775814913673e22;
export const KPC_M = 3.0856775814913673e19;
export const GPC_M = 3.0856775814913673e25;
export const LIGHT_YEAR_M = 9.4607304725808e15;
export const SOLAR_RADIUS_KM = 696_340;
export const SOLAR_MASS_KG = 1.98847e30;
export const JUPITER_RADIUS_KM = 71_492;
export const JUPITER_MASS_KG = 1.8982e27;
export const EARTH_RADIUS_KM = 6378.137;
export const EARTH_MASS_KG = 5.97237e24;

export const SOURCES = {
  jplPlanets: {
    label: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/planets/phys_par.html',
  },
  jplElements: {
    label: 'JPL approximate planetary positions (Standish)',
    url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
  },
  nasaSSE: {
    label: 'NASA Solar System Exploration',
    url: 'https://science.nasa.gov/solar-system/',
  },
  nasaEarth: {
    label: 'NASA Earth Observatory',
    url: 'https://earthobservatory.nasa.gov/',
  },
  hyg: {
    label: 'HYG Database v4.1 (Astronomy Nexus)',
    url: 'https://codeberg.org/astronexus/hyg',
  },
  exo: {
    label: 'NASA Exoplanet Archive',
    url: 'https://exoplanetarchive.ipac.caltech.edu/',
  },
  ned: {
    label: 'NASA/IPAC Extragalactic Database',
    url: 'https://ned.ipac.caltech.edu/',
  },
  sdss: {
    label: 'Sloan Digital Sky Survey DR18',
    url: 'https://www.sdss.org/',
  },
  starMap: {
    label: 'NASA/Goddard Deep Star Maps 2020',
    url: 'https://svs.gsfc.nasa.gov/4851',
  },
  planetTextures: {
    label: 'Solar System Scope (CC BY 4.0), derived from NASA imagery',
    url: 'https://www.solarsystemscope.com/textures/',
  },
  gaia: {
    label: 'ESA Gaia mission',
    url: 'https://www.esa.int/Science_Exploration/Space_Science/Gaia',
  },
};

/** JPL Table 1: mean ecliptic and equinox J2000, valid 1800–2050 AD. */
const JPL = {
  Mercury: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.2503235, peri: 77.45779628, node: 48.33076593, da: 0.00000037, de: 0.00001906, dI: -0.00594749, dL: 149472.67411175, dperi: 0.16047689, dnode: -0.12534081 },
  Venus:   { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.9790995, peri: 131.60246718, node: 76.67984255, da: 0.0000039, de: -0.00004107, dI: -0.0007889, dL: 58517.81538729, dperi: 0.00268329, dnode: -0.27769418 },
  Earth:   { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, peri: 102.93768193, node: 0.0, da: 0.00000562, de: -0.00004392, dI: -0.01294668, dL: 35999.37244981, dperi: 0.32327364, dnode: 0.0 },
  Mars:    { a: 1.52371034, e: 0.0933941, I: 1.84969142, L: -4.55343205, peri: -23.94362959, node: 49.55953891, da: 0.00001847, de: 0.00007882, dI: -0.00813131, dL: 19140.30268499, dperi: 0.44441088, dnode: -0.29257343 },
  Jupiter: { a: 5.202887, e: 0.04838624, I: 1.30439695, L: 34.39644051, peri: 14.72847983, node: 100.47390909, da: -0.00011607, de: -0.00013253, dI: -0.00183714, dL: 3034.74612775, dperi: 0.21252668, dnode: 0.20469106 },
  Saturn:  { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, peri: 92.59887831, node: 113.66242448, da: -0.0012506, de: -0.00050991, dI: 0.00193609, dL: 1222.49362201, dperi: -0.41897216, dnode: -0.28867794 },
  Uranus:  { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, peri: 170.9542763, node: 74.01692503, da: -0.00196176, de: -0.00004397, dI: -0.00242939, dL: 428.48202785, dperi: 0.40805281, dnode: 0.04240589 },
  Neptune: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, peri: 44.96476227, node: 131.78422574, da: 0.00026291, de: 0.00005105, dI: 0.00035372, dL: 218.45945325, dperi: -0.32241464, dnode: -0.00508664 },
};

const atmosphere = {
  mercury: ['Oxygen', 'Sodium', 'Hydrogen', 'Helium', 'Potassium'],
  venus: ['Carbon dioxide 96.5%', 'Nitrogen 3.5%', 'Sulfur dioxide', 'Argon'],
  earth: ['Nitrogen 78.08%', 'Oxygen 20.95%', 'Argon 0.93%', 'Carbon dioxide 0.04%'],
  mars: ['Carbon dioxide 95.3%', 'Nitrogen 2.7%', 'Argon 1.6%', 'Oxygen 0.13%'],
  jupiter: ['Hydrogen 89.8%', 'Helium 10.2%', 'Methane', 'Ammonia', 'Water vapour'],
  saturn: ['Hydrogen 96.3%', 'Helium 3.25%', 'Methane', 'Ammonia'],
  uranus: ['Hydrogen 82.5%', 'Helium 15.2%', 'Methane 2.3%'],
  neptune: ['Hydrogen 80%', 'Helium 19%', 'Methane 1.5%'],
  pluto: ['Nitrogen', 'Methane', 'Carbon monoxide'],
  moon: ['No substantial atmosphere'],
  ceres: ['Water vapour (transient exosphere)'],
};

const desc = {
  Mercury: 'The smallest planet and the fastest to orbit the Sun. Its airless, cratered surface swings between about 100 K at night and 700 K by day.',
  Venus: 'A near-twin of Earth in size, wrapped in a runaway carbon-dioxide atmosphere. Surface pressure is about 92 times Earth’s, and the planet rotates backwards.',
  Earth: 'The only world known to host life. Liquid-water oceans cover 71% of its surface, and a nitrogen–oxygen atmosphere protects a biosphere that has reshaped the planet.',
  Mars: 'A cold desert world with the tallest volcano and one of the largest canyon systems in the Solar System. Ancient river valleys record a wetter past.',
  Jupiter: 'The Solar System’s largest planet, a hydrogen–helium giant with a Great Red Spot — a storm wider than Earth that has persisted for centuries.',
  Saturn: 'The ringed giant. Its rings span roughly 280,000 km but are only metres to tens of metres thick, made of countless icy particles.',
  Uranus: 'An ice giant tipped almost onto its side, probably by an ancient collision. Methane in its upper atmosphere gives it a pale cyan hue.',
  Neptune: 'The most distant planet, an ice giant with the fastest winds measured in the Solar System — over 2,000 km/h.',
  Pluto: 'A dwarf planet in the Kuiper Belt. New Horizons revealed nitrogen-ice glaciers, water-ice mountains and a thin blue atmospheric haze.',
  Ceres: 'The largest object in the asteroid belt and the closest dwarf planet to the Sun. Bright carbonate deposits mark the crater Occator.',
  Moon: 'Earth’s only natural satellite, formed from debris after a giant impact. Its surface preserves 4.5 billion years of bombardment.',
};

const planetFacts = (d) => [
  { label: 'Equatorial diameter', value: `${Math.round(d.radiusKm * 2).toLocaleString('en-US')} km` },
  { label: 'Mass', value: `${d.massKg.toExponential(3)} kg (${(d.massKg / EARTH_MASS_KG).toFixed(2)} M⊕)` },
  { label: 'Semi-major axis', value: `${d.semiMajorAU.toFixed(4)} AU` },
  { label: 'Orbital period', value: d.orbitalPeriodDays > 1000 ? `${(d.orbitalPeriodDays / 365.25).toFixed(2)} years` : `${d.orbitalPeriodDays.toFixed(2)} days` },
  { label: 'Rotation period', value: `${Math.abs(d.rotationHours).toLocaleString('en-US', { maximumFractionDigits: 1 })} h${d.rotationHours < 0 ? ' (retrograde)' : ''}` },
  { label: 'Axial tilt', value: `${d.axialTiltDeg.toFixed(2)}°` },
  { label: 'Mean surface temperature', value: `${d.meanTempK} K (${Math.round(d.meanTempK - 273.15)} °C)` },
  { label: 'Known natural satellites', value: d.moonCount === null ? 'Not available' : `${d.moonCount}` },
];

function planet(o) {
  const jpl = JPL[o.name];
  const p = {
    kind: 'planet',
    type: o.type,
    subtype: o.subtype,
    moons: o.moons || [],
    orbit: jpl ? { ...jpl, source: 'JPL approximate Keplerian elements, 1800–2050' } : o.orbit,
    description: desc[o.name],
    ...o,
  };
  p.facts = planetFacts(p);
  p.atmosphere = atmosphere[o.key];
  p.provenance = {
    source: o.provenance?.source || 'NASA/JPL planetary fact sheets; JPL approximate Keplerian elements',
    url: o.provenance?.url || SOURCES.jplPlanets.url,
    retrieved: '2026-11',
    model: o.orbitModel || 'Keplerian orbit — approximate',
  };
  return p;
}

export const PLANETS = [
  planet({
    key: 'mercury', id: 'mercury', name: 'Mercury', parent: 'sun',
    type: 'Terrestrial planet', subtype: 'Rocky world',
    radiusKm: 2439.7, massKg: 3.3011e23,
    semiMajorAU: JPL.Mercury.a, orbitalPeriodDays: 87.9691, rotationHours: 1407.6,
    axialTiltDeg: 0.034, meanTempK: 440, moonCount: 0,
    color: '#a9a29a', texture: '2k_mercury.jpg', roughness: 0.98,
    gallery: 'Airless, cratered, and compressionally shrunk.',
  }),
  planet({
    key: 'venus', id: 'venus', name: 'Venus', parent: 'sun',
    type: 'Terrestrial planet', subtype: 'Rocky world',
    radiusKm: 6051.8, massKg: 4.8675e24,
    semiMajorAU: JPL.Venus.a, orbitalPeriodDays: 224.701, rotationHours: -5832.5,
    axialTiltDeg: 177.36, meanTempK: 737, moonCount: 0,
    color: '#d9c49a', texture: '2k_venus_atmosphere.jpg', atmosphereTexture: '2k_venus_atmosphere.jpg',
    atmosphereColor: '#e8caa0', roughness: 0.7, clouds: true,
    surfaceTexture: '2k_venus_surface.jpg',
  }),
  planet({
    key: 'earth', id: 'earth', name: 'Earth', parent: 'sun',
    type: 'Terrestrial planet', subtype: 'Ocean world',
    radiusKm: 6378.137, massKg: 5.97237e24,
    semiMajorAU: JPL.Earth.a, orbitalPeriodDays: 365.256, rotationHours: 23.9345,
    axialTiltDeg: 23.4393, meanTempK: 288, moonCount: 1,
    color: '#6d9fd2', texture: 'earth_day_4k.jpg', roughness: 0.72,
    material: 'earth',
    moons: ['moon'],
    gallery: 'Seventy-one percent ocean. One known biosphere.',
  }),
  planet({
    key: 'mars', id: 'mars', name: 'Mars', parent: 'sun',
    type: 'Terrestrial planet', subtype: 'Rocky desert world',
    radiusKm: 3389.5, massKg: 6.4171e23,
    semiMajorAU: JPL.Mars.a, orbitalPeriodDays: 686.98, rotationHours: 24.6229,
    axialTiltDeg: 25.19, meanTempK: 210, moonCount: 2,
    color: '#b8643c', texture: 'mars_4k.jpg', roughness: 0.94,
    moons: ['phobos', 'deimos'],
  }),
  planet({
    key: 'jupiter', id: 'jupiter', name: 'Jupiter', parent: 'sun',
    type: 'Gas giant', subtype: 'Hydrogen–helium giant',
    radiusKm: 71492, massKg: 1.8982e27,
    semiMajorAU: JPL.Jupiter.a, orbitalPeriodDays: 4332.59, rotationHours: 9.925,
    axialTiltDeg: 3.13, meanTempK: 165, moonCount: 95,
    color: '#c2a27e', texture: 'jupiter_4k.jpg', roughness: 0.55,
    atmosphereColor: '#d9c2a0', clouds: true,
    moons: ['io', 'europa', 'ganymede', 'callisto'],
  }),
  planet({
    key: 'saturn', id: 'saturn', name: 'Saturn', parent: 'sun',
    type: 'Gas giant', subtype: 'Ringed giant',
    radiusKm: 60268, massKg: 5.6834e26,
    semiMajorAU: JPL.Saturn.a, orbitalPeriodDays: 10759.22, rotationHours: 10.656,
    axialTiltDeg: 26.73, meanTempK: 134, moonCount: 146,
    color: '#d5c39a', texture: 'saturn_4k.jpg', roughness: 0.62,
    atmosphereColor: '#e3d4ad', clouds: true,
    ring: { texture: '2k_saturn_ring_alpha.png', innerKm: 74800, outerKm: 140220 },
    moons: ['titan', 'enceladus', 'rhea', 'iapetus', 'dione', 'tethys'],
  }),
  planet({
    key: 'uranus', id: 'uranus', name: 'Uranus', parent: 'sun',
    type: 'Ice giant', subtype: 'Hydrogen–helium–methane',
    radiusKm: 25559, massKg: 8.681e25,
    semiMajorAU: JPL.Uranus.a, orbitalPeriodDays: 30688.5, rotationHours: -17.24,
    axialTiltDeg: 97.77, meanTempK: 76, moonCount: 28,
    color: '#9bcfd0', texture: '2k_uranus.jpg', roughness: 0.6,
    atmosphereColor: '#b6e3e4',
    moons: ['titania', 'oberon', 'ariel', 'umbriel', 'miranda'],
  }),
  planet({
    key: 'neptune', id: 'neptune', name: 'Neptune', parent: 'sun',
    type: 'Ice giant', subtype: 'Hydrogen–helium–methane',
    radiusKm: 24764, massKg: 1.02413e26,
    semiMajorAU: JPL.Neptune.a, orbitalPeriodDays: 60195, rotationHours: 16.11,
    axialTiltDeg: 28.32, meanTempK: 72, moonCount: 16,
    color: '#526ec8', texture: '2k_neptune.jpg', roughness: 0.6,
    atmosphereColor: '#6f92e8',
    moons: ['triton', 'proteus', 'nereid'],
  }),
];

export const DWARF_PLANETS = [
  planet({
    key: 'pluto', id: 'pluto', name: 'Pluto', parent: 'sun',
    type: 'Dwarf planet', subtype: 'Kuiper Belt object',
    radiusKm: 1188.3, massKg: 1.303e22,
    semiMajorAU: 39.482, orbitalPeriodDays: 90560, rotationHours: 153.3,
    axialTiltDeg: 122.53, meanTempK: 44, moonCount: 5,
    color: '#b7a18d', texture: '2k_moon.jpg', roughness: 0.95,
    orbit: {
      a: 39.482, e: 0.2488, I: 17.16, L: 238.66,
      peri: 224.133, node: 110.299,
      da: 0, de: 0, dI: 0, dL: 145.18, dperi: 0, dnode: 0,
      source: 'Approximate osculating elements at J2000',
    },
    orbitModel: 'Approximate osculating elements — not a JPL 1800–2050 fit',
    moons: ['charon'],
  }),
  planet({
    key: 'ceres', id: 'ceres', name: 'Ceres', parent: 'sun',
    type: 'Dwarf planet', subtype: 'Asteroid Belt object',
    radiusKm: 469.7, massKg: 9.3835e20,
    semiMajorAU: 2.7675, orbitalPeriodDays: 1681.6, rotationHours: 9.074,
    axialTiltDeg: 4.0, meanTempK: 168, moonCount: 0,
    color: '#8c877e', texture: '2k_moon.jpg', roughness: 1.0,
    orbit: {
      a: 2.7675, e: 0.0758, I: 10.593, L: 231.362,
      peri: 153.99, node: 80.393,
      da: 0, de: 0, dI: 0, dL: 7817.0, dperi: 0, dnode: 0,
      source: 'Approximate osculating elements at J2000',
    },
    orbitModel: 'Approximate osculating elements',
    description: 'The largest object in the asteroid belt and the closest dwarf planet to the Sun. Bright carbonate deposits mark the crater Occator.',
  }),
];

export const SUN = {
  kind: 'star',
  id: 'sun',
  name: 'Sun',
  type: 'G-type main-sequence star',
  subtype: 'G2V',
  description: 'The star at the centre of our Solar System. Its gravity holds the planets in orbit; its light and heat make Earth habitable.',
  radiusKm: SOLAR_RADIUS_KM,
  massKg: SOLAR_MASS_KG,
  meanTempK: 5772,
  coreTempK: 15_700_000,
  ageGyr: 4.6,
  rotationHours: 609.12,
  luminosity: 1,
  color: '#ffd9a0',
  atmosphere: ['Hydrogen 73.46%', 'Helium 24.85%', 'Oxygen 0.77%', 'Carbon 0.29%', 'Iron 0.16%'],
  facts: [
    { label: 'Equatorial diameter', value: '1,392,680 km' },
    { label: 'Mass', value: '1.9885 × 10³⁰ kg (333,000 M⊕)' },
    { label: 'Photospheric temperature', value: '5,772 K' },
    { label: 'Core temperature', value: '≈ 15.7 million K' },
    { label: 'Age', value: '≈ 4.6 billion years' },
    { label: 'Luminosity', value: '1 L☉ (3.828 × 10²⁶ W)' },
    { label: 'Composition', value: 'Hydrogen 73.5%, helium 24.9%' },
  ],
  provenance: { source: 'NASA/JPL Sun fact sheet', url: SOURCES.jplPlanets.url, retrieved: '2026-11' },
};

const moon = (o) => ({
  kind: 'moon',
  type: o.type || 'Natural satellite',
  ...o,
  facts: [
    { label: 'Mean radius', value: `${o.radiusKm.toLocaleString('en-US', { maximumFractionDigits: 1 })} km` },
    { label: 'Mass', value: o.massKg ? `${o.massKg.toExponential(3)} kg` : 'Not available' },
    { label: 'Orbital radius', value: `${o.semiMajorKm.toLocaleString('en-US')} km` },
    { label: 'Orbital period', value: `${Math.abs(o.periodDays).toFixed(3)} days${o.periodDays < 0 ? ' (retrograde)' : ''}` },
    ...(o.tempK ? [{ label: 'Mean temperature', value: `${o.tempK} K` }] : []),
  ],
  provenance: {
    source: o.provenance?.source || 'NASA/JPL planetary satellite fact sheets',
    url: SOURCES.jplPlanets.url,
    retrieved: '2026-11',
    model: 'Circular/orbital elements simplified for visualization',
  },
});

export const MOONS = [
  moon({ id: 'moon', name: 'Moon', parent: 'earth', radiusKm: 1737.4, massKg: 7.342e22, semiMajorKm: 384_400, periodDays: 27.3217, inclinationDeg: 5.145, tempK: 250, texture: '2k_moon.jpg', color: '#b8b5ae', description: desc.Moon }),
  moon({ id: 'phobos', name: 'Phobos', parent: 'mars', radiusKm: 11.267, massKg: 1.0659e16, semiMajorKm: 9376, periodDays: 0.31891, inclinationDeg: 1.08, texture: '2k_moon.jpg', color: '#8c8279', description: 'The larger of Mars’s two moons. It orbits so close that it rises in the west and sets in the east.' }),
  moon({ id: 'deimos', name: 'Deimos', parent: 'mars', radiusKm: 6.2, massKg: 1.4762e15, semiMajorKm: 23_463, periodDays: 1.263, inclinationDeg: 1.79, texture: '2k_moon.jpg', color: '#8c8279', description: 'A small, irregular moon of Mars, likely a captured asteroid or impact debris.' }),
  moon({ id: 'io', name: 'Io', parent: 'jupiter', radiusKm: 1821.6, massKg: 8.9319e22, semiMajorKm: 421_700, periodDays: 1.769, inclinationDeg: 0.05, texture: '2k_moon.jpg', color: '#d8c66a', description: 'The most volcanically active body in the Solar System, driven by tidal heating from Jupiter.' }),
  moon({ id: 'europa', name: 'Europa', parent: 'jupiter', radiusKm: 1560.8, massKg: 4.7998e22, semiMajorKm: 671_034, periodDays: 3.551, inclinationDeg: 0.47, texture: '2k_moon.jpg', color: '#cdbfa8', description: 'An icy moon with a global subsurface ocean beneath a fractured shell — one of the best places to search for life beyond Earth.' }),
  moon({ id: 'ganymede', name: 'Ganymede', parent: 'jupiter', radiusKm: 2634.1, massKg: 1.4819e23, semiMajorKm: 1_070_412, periodDays: 7.155, inclinationDeg: 0.2, texture: '2k_moon.jpg', color: '#a49a8c', description: 'The largest moon in the Solar System — larger than Mercury — and the only moon known to generate its own magnetic field.' }),
  moon({ id: 'callisto', name: 'Callisto', parent: 'jupiter', radiusKm: 2410.3, massKg: 1.0759e23, semiMajorKm: 1_882_709, periodDays: 16.689, inclinationDeg: 0.19, texture: '2k_moon.jpg', color: '#8a8077', description: 'One of the most heavily cratered objects known, its ancient surface preserves a record of the early Jovian system.' }),
  moon({ id: 'titan', name: 'Titan', parent: 'saturn', radiusKm: 2574.7, massKg: 1.3452e23, semiMajorKm: 1_221_870, periodDays: 15.945, inclinationDeg: 0.35, texture: '2k_moon.jpg', color: '#d0a35f', description: 'Saturn’s largest moon, with a thick nitrogen atmosphere and lakes and seas of liquid methane and ethane.' }),
  moon({ id: 'enceladus', name: 'Enceladus', parent: 'saturn', radiusKm: 252.1, massKg: 1.08022e20, semiMajorKm: 238_020, periodDays: 1.370, inclinationDeg: 0.02, texture: '2k_moon.jpg', color: '#e6e6e6', description: 'Its south-polar geysers eject water ice and organic molecules, fed by a subsurface ocean.' }),
  moon({ id: 'rhea', name: 'Rhea', parent: 'saturn', radiusKm: 763.8, massKg: 2.3065e21, semiMajorKm: 527_108, periodDays: 4.518, inclinationDeg: 0.35, texture: '2k_moon.jpg', color: '#c2c2c2', description: 'Saturn’s second-largest moon, an icy cratered world.' }),
  moon({ id: 'iapetus', name: 'Iapetus', parent: 'saturn', radiusKm: 734.5, massKg: 1.8056e21, semiMajorKm: 3_560_820, periodDays: 79.32, inclinationDeg: 15.47, texture: '2k_moon.jpg', color: '#9a938b', description: 'Famous for a striking two-tone surface and an equatorial ridge.' }),
  moon({ id: 'dione', name: 'Dione', parent: 'saturn', radiusKm: 561.4, massKg: 1.0955e21, semiMajorKm: 377_396, periodDays: 2.737, inclinationDeg: 0.02, texture: '2k_moon.jpg', color: '#c6c3bd', description: 'A bright, icy moon of Saturn with a network of tectonic fractures.' }),
  moon({ id: 'tethys', name: 'Tethys', parent: 'saturn', radiusKm: 531.1, massKg: 6.1745e20, semiMajorKm: 294_619, periodDays: 1.888, inclinationDeg: 1.12, texture: '2k_moon.jpg', color: '#d0ccc5', description: 'An icy moon marked by the immense Odysseus crater and Ithaca Chasma.' }),
  moon({ id: 'titania', name: 'Titania', parent: 'uranus', radiusKm: 788.9, massKg: 3.527e21, semiMajorKm: 435_910, periodDays: 8.706, inclinationDeg: 0.34, texture: '2k_moon.jpg', color: '#b4aca2', description: 'The largest moon of Uranus, with a complex network of canyons.' }),
  moon({ id: 'oberon', name: 'Oberon', parent: 'uranus', radiusKm: 761.4, massKg: 3.014e21, semiMajorKm: 583_520, periodDays: 13.463, inclinationDeg: 0.06, texture: '2k_moon.jpg', color: '#9d958c', description: 'The outermost major moon of Uranus, dark and heavily cratered.' }),
  moon({ id: 'ariel', name: 'Ariel', parent: 'uranus', radiusKm: 578.9, massKg: 1.353e21, semiMajorKm: 190_900, periodDays: 2.520, inclinationDeg: 0.26, texture: '2k_moon.jpg', color: '#c3bcb2', description: 'The brightest Uranian moon, with young-looking fault valleys.' }),
  moon({ id: 'umbriel', name: 'Umbriel', parent: 'uranus', radiusKm: 584.7, massKg: 1.172e21, semiMajorKm: 266_000, periodDays: 4.144, inclinationDeg: 0.13, texture: '2k_moon.jpg', color: '#807a72', description: 'A dark, ancient moon with a bright ring-like feature called the Bright Spot.' }),
  moon({ id: 'miranda', name: 'Miranda', parent: 'uranus', radiusKm: 235.8, massKg: 6.59e19, semiMajorKm: 129_900, periodDays: 1.413, inclinationDeg: 4.34, texture: '2k_moon.jpg', color: '#b9b4aa', description: 'A small moon with one of the most dramatic landscapes in the Solar System, including Verona Rupes.' }),
  moon({ id: 'triton', name: 'Triton', parent: 'neptune', radiusKm: 1353.4, massKg: 2.139e22, semiMajorKm: 354_759, periodDays: -5.877, inclinationDeg: 156.9, texture: '2k_moon.jpg', color: '#c5c2bb', description: 'A large retrograde moon, probably a captured Kuiper Belt object. Nitrogen geysers erupt from its southern hemisphere.' }),
  moon({ id: 'proteus', name: 'Proteus', parent: 'neptune', radiusKm: 210, massKg: 4.4e19, semiMajorKm: 117_647, periodDays: 1.122, inclinationDeg: 0.04, texture: '2k_moon.jpg', color: '#8e8981', description: 'An irregular, dark moon of Neptune discovered by Voyager 2.' }),
  moon({ id: 'nereid', name: 'Nereid', parent: 'neptune', radiusKm: 170, massKg: 3.1e19, semiMajorKm: 5_513_818, periodDays: 360.14, inclinationDeg: 7.23, texture: '2k_moon.jpg', color: '#8e8981', description: 'A small moon on a highly eccentric orbit around Neptune.' }),
  moon({ id: 'charon', name: 'Charon', parent: 'pluto', radiusKm: 606, massKg: 1.586e21, semiMajorKm: 19_591, periodDays: 6.387, inclinationDeg: 0.08, texture: '2k_moon.jpg', color: '#a9a39b', description: 'Pluto’s largest moon. The pair orbit a common centre of mass and are mutually tidally locked.' }),
];

/* -------------------------------------------------------------------------- */
/* Deep sky                                                                   */
/* -------------------------------------------------------------------------- */

export const MILKY_WAY = {
  kind: 'galaxy',
  id: 'milky-way',
  name: 'Milky Way',
  type: 'Barred spiral galaxy',
  subtype: 'SB(rs)bc',
  description: 'Our home galaxy: a barred spiral of several hundred billion stars, roughly 100,000 light-years across. The Sun sits about 26,000 light-years from the centre, within the Orion Arm.',
  diameterKpc: 30.6,
  diameterKly: 100,
  stellarMass: '≈ 6 × 10¹⁰ M☉',
  ageGyr: 13.6,
  centerRA: 266.4168,
  centerDec: -29.0078,
  sunGalacticRadiusKpc: 8.15,
  sunGalacticAU: 26_000,
  blackHole: 'Sagittarius A* — ≈ 4.3 million M☉',
  morphologyNote: 'Schematic 3D model. The structure is informed by published Milky Way parameters, not a photograph; individual star positions in the solar neighbourhood come from the HYG catalogue.',
  provenance: { source: 'NASA/IPAC, ESA Gaia, published Milky Way structure parameters', url: SOURCES.gaia.url, retrieved: '2026-11' },
  viz: { mode: 'model', label: 'Schematic model — not an observed image' },
};

/** Distances in Mpc. `distanceKind` distinguishes a measured distance from a redshift-derived value. */
export const GALAXIES = [
  {
    id: 'm31', name: 'Andromeda Galaxy', aliases: ['M31', 'NGC 224', 'Andromeda'],
    type: 'Barred spiral galaxy', subtype: 'SA(s)b',
    ra: 10.6847, dec: 41.2692, distMpc: 0.778, redShift: -0.001004,
    diameterKpc: 67, inclinationDeg: 77, positionAngleDeg: 35, magV: 3.44,
    group: 'Local Group', role: 'Largest Local Group galaxy',
    description: 'The nearest large spiral galaxy and the most massive member of the Local Group. It is on a collision course with the Milky Way in roughly 4–5 billion years.',
    facts: [
      { label: 'Morphology', value: 'SA(s)b — barred spiral' },
      { label: 'Distance', value: '≈ 0.78 Mpc (2.5 million ly)' },
      { label: 'Diameter', value: '≈ 67 kpc (220,000 ly)' },
      { label: 'Redshift', value: '−0.001004 (approaching)' },
      { label: 'Apparent magnitude', value: '3.44' },
      { label: 'Group', value: 'Local Group' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); values rounded', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative spiral model — structure informed by observations' },
    model: { type: 'spiral', arms: 2, bar: true, pitch: 12, seed: 31 },
  },
  {
    id: 'm33', name: 'Triangulum Galaxy', aliases: ['M33', 'NGC 598'],
    type: 'Spiral galaxy', subtype: 'SA(s)cd',
    ra: 23.4621, dec: 30.6602, distMpc: 0.85, redShift: -0.000607,
    diameterKpc: 18.5, inclinationDeg: 54, positionAngleDeg: 23, magV: 5.72,
    group: 'Local Group', role: 'Third-largest Local Group galaxy',
    description: 'A relatively small, low-metallicity spiral and the third-largest galaxy in the Local Group. It is forming stars vigorously.',
    facts: [
      { label: 'Morphology', value: 'SA(s)cd' },
      { label: 'Distance', value: '≈ 0.85 Mpc (2.7 million ly)' },
      { label: 'Diameter', value: '≈ 18.5 kpc (60,000 ly)' },
      { label: 'Group', value: 'Local Group' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative spiral model' },
    model: { type: 'spiral', arms: 2, bar: false, pitch: 18, seed: 57 },
  },
  {
    id: 'lmc', name: 'Large Magellanic Cloud', aliases: ['LMC', 'ESO 56-G115'],
    type: 'Irregular galaxy', subtype: 'SB(s)m',
    ra: 80.8938, dec: -69.7561, distMpc: 0.04997, redShift: 0.00093,
    diameterKpc: 4.3, inclinationDeg: 63, positionAngleDeg: 170, magV: 0.9,
    group: 'Local Group', role: 'Satellite of the Milky Way',
    description: 'A prominent satellite galaxy of the Milky Way, visible to the naked eye from the southern hemisphere and home to the Tarantula Nebula.',
    facts: [
      { label: 'Morphology', value: 'SB(s)m — irregular barred' },
      { label: 'Distance', value: '≈ 50 kpc (163,000 ly)' },
      { label: 'Diameter', value: '≈ 4.3 kpc (14,000 ly)' },
      { label: 'Group', value: 'Local Group' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative irregular model' },
    model: { type: 'irregular', seed: 88 },
  },
  {
    id: 'smc', name: 'Small Magellanic Cloud', aliases: ['SMC', 'ESO 29-G003'],
    type: 'Irregular galaxy', subtype: 'SB(s)m pec',
    ra: 13.1867, dec: -72.8286, distMpc: 0.0621, redShift: 0.000527,
    diameterKpc: 2.2, inclinationDeg: 45, positionAngleDeg: 135, magV: 2.7,
    group: 'Local Group', role: 'Satellite of the Milky Way',
    description: 'A smaller irregular companion to the Milky Way, interacting with the Large Magellanic Cloud and the Milky Way’s halo.',
    facts: [
      { label: 'Morphology', value: 'SB(s)m pec' },
      { label: 'Distance', value: '≈ 62 kpc (202,000 ly)' },
      { label: 'Diameter', value: '≈ 2.2 kpc (7,000 ly)' },
      { label: 'Group', value: 'Local Group' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative irregular model' },
    model: { type: 'irregular', seed: 103 },
  },
  {
    id: 'm51', name: 'Whirlpool Galaxy', aliases: ['M51', 'M51a', 'NGC 5194'],
    type: 'Spiral galaxy', subtype: 'SA(s)bc',
    ra: 202.4696, dec: 47.1953, distMpc: 8.58, redShift: 0.001544,
    diameterKpc: 23, inclinationDeg: 32, positionAngleDeg: 18, magV: 8.4,
    group: 'M51 Group', role: 'Interacting grand-design spiral',
    description: 'A textbook grand-design spiral caught in a gravitational interaction with its smaller companion NGC 5195. Its arms are rich in star-forming regions.',
    facts: [
      { label: 'Morphology', value: 'SA(s)bc' },
      { label: 'Distance', value: '≈ 8.6 Mpc (28 million ly)' },
      { label: 'Diameter', value: '≈ 23 kpc (76,000 ly)' },
      { label: 'Group', value: 'M51 Group' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative grand-design spiral model' },
    model: { type: 'spiral', arms: 2, bar: false, pitch: 22, seed: 211 },
  },
  {
    id: 'm101', name: 'Pinwheel Galaxy', aliases: ['M101', 'NGC 5457'],
    type: 'Spiral galaxy', subtype: 'SAB(rs)cd',
    ra: 210.8025, dec: 54.3492, distMpc: 6.7, redShift: 0.000804,
    diameterKpc: 52, inclinationDeg: 18, positionAngleDeg: 39, magV: 7.86,
    group: 'M101 Group', role: 'Large face-on spiral',
    description: 'A large, lopsided face-on spiral with a high star-formation rate and hundreds of H II regions.',
    facts: [
      { label: 'Morphology', value: 'SAB(rs)cd' },
      { label: 'Distance', value: '≈ 6.7 Mpc (21.8 million ly)' },
      { label: 'Diameter', value: '≈ 52 kpc (170,000 ly)' },
      { label: 'Group', value: 'M101 Group' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative spiral model' },
    model: { type: 'spiral', arms: 3, bar: false, pitch: 14, seed: 256 },
  },
  {
    id: 'm104', name: 'Sombrero Galaxy', aliases: ['M104', 'NGC 4594'],
    type: 'Lenticular / spiral galaxy', subtype: 'SA(s)a',
    ra: 189.9976, dec: -11.6231, distMpc: 9.55, redShift: 0.003416,
    diameterKpc: 14, inclinationDeg: 84, positionAngleDeg: 90, magV: 8.0,
    group: 'Virgo Cluster outskirts', role: 'Edge-on dust-lane galaxy',
    description: 'An almost edge-on galaxy with a brilliant central bulge and a sharp dust lane crossing its disk. It hosts a supermassive black hole of about one billion solar masses.',
    facts: [
      { label: 'Morphology', value: 'SA(s)a' },
      { label: 'Distance', value: '≈ 9.6 Mpc (31 million ly)' },
      { label: 'Diameter', value: '≈ 14 kpc (49,000 ly)' },
      { label: 'Black hole', value: '≈ 10⁹ M☉' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative edge-on model' },
    model: { type: 'edgeon', seed: 301 },
  },
  {
    id: 'm87', name: 'M87', aliases: ['NGC 4486', 'Virgo A'],
    type: 'Elliptical galaxy', subtype: 'E0-1 pec',
    ra: 187.7058, dec: 12.3911, distMpc: 16.4, redShift: 0.004283,
    diameterKpc: 40, inclinationDeg: 0, positionAngleDeg: 0, magV: 8.6,
    group: 'Virgo Cluster', role: 'Central giant elliptical',
    description: 'A giant elliptical galaxy at the heart of the Virgo Cluster. Its black hole, M87*, was the first ever imaged by the Event Horizon Telescope in 2019.',
    facts: [
      { label: 'Morphology', value: 'E0-1 pec' },
      { label: 'Distance', value: '≈ 16.4 Mpc (53.5 million ly)' },
      { label: 'Diameter', value: '≈ 40 kpc (132,000 ly)' },
      { label: 'Centre', value: 'Virgo Cluster' },
      { label: 'Black hole', value: 'M87* — ≈ 6.5 × 10⁹ M☉' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); EHT collaboration', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative elliptical model' },
    model: { type: 'elliptical', seed: 401 },
  },
  {
    id: 'm49', name: 'M49', aliases: ['NGC 4472'],
    type: 'Elliptical galaxy', subtype: 'E2',
    ra: 187.4446, dec: 8.0006, distMpc: 17.1, redShift: 0.003272,
    diameterKpc: 49, inclinationDeg: 0, magV: 8.4,
    group: 'Virgo Cluster', role: 'Brightest galaxy in the Virgo Cluster',
    description: 'One of the brightest galaxies in the Virgo Cluster and a giant elliptical with an extensive globular cluster system.',
    facts: [
      { label: 'Morphology', value: 'E2' },
      { label: 'Distance', value: '≈ 17.1 Mpc' },
      { label: 'Diameter', value: '≈ 49 kpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative elliptical model' },
    model: { type: 'elliptical', seed: 449 },
  },
  {
    id: 'cen-a', name: 'Centaurus A', aliases: ['NGC 5128', 'Cen A'],
    type: 'Lenticular galaxy', subtype: 'S0 pec',
    ra: 201.3651, dec: -43.0192, distMpc: 3.8, redShift: 0.001825,
    diameterKpc: 18, inclinationDeg: 45, positionAngleDeg: 15, magV: 6.84,
    group: 'Centaurus A/M83 Group', role: 'Active galaxy with dust lane',
    description: 'The nearest active galaxy and one of the closest radio galaxies. A dramatic dust lane crosses its elliptical body, and relativistic jets launch from its central black hole.',
    facts: [
      { label: 'Morphology', value: 'S0 pec — lenticular' },
      { label: 'Distance', value: '≈ 3.8 Mpc (12.4 million ly)' },
      { label: 'Diameter', value: '≈ 18 kpc' },
      { label: 'Black hole', value: '≈ 5.5 × 10⁷ M☉' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative lenticular model with dust lane' },
    model: { type: 'elliptical', dust: true, seed: 512 },
  },
  {
    id: 'm81', name: "Bode's Galaxy", aliases: ['M81', 'NGC 3031'],
    type: 'Spiral galaxy', subtype: 'SA(s)ab',
    ra: 148.8883, dec: 69.0653, distMpc: 3.6, redShift: -0.000113,
    diameterKpc: 27, inclinationDeg: 59, positionAngleDeg: 157, magV: 6.94,
    group: 'M81 Group', role: 'Dominant spiral of the M81 Group',
    description: 'A grand-design spiral interacting with M82 and NGC 3077. Its arms are traced by ultraviolet-emitting young stars.',
    facts: [
      { label: 'Morphology', value: 'SA(s)ab' },
      { label: 'Distance', value: '≈ 3.6 Mpc (11.8 million ly)' },
      { label: 'Diameter', value: '≈ 27 kpc (90,000 ly)' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative spiral model' },
    model: { type: 'spiral', arms: 2, bar: false, pitch: 20, seed: 607 },
  },
  {
    id: 'm82', name: 'Cigar Galaxy', aliases: ['M82', 'NGC 3034'],
    type: 'Starburst galaxy', subtype: 'I0 edge-on',
    ra: 148.9696, dec: 69.6797, distMpc: 3.8, redShift: 0.000677,
    diameterKpc: 11, inclinationDeg: 80, positionAngleDeg: 65, magV: 8.41,
    group: 'M81 Group', role: 'Nearest starburst galaxy',
    description: 'A starburst galaxy seen edge-on, with a powerful galactic wind of hot gas and dust. Its central star-formation rate is about ten times that of the Milky Way.',
    facts: [
      { label: 'Morphology', value: 'I0 edge-on' },
      { label: 'Distance', value: '≈ 3.8 Mpc (12 million ly)' },
      { label: 'Diameter', value: '≈ 11 kpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative starburst model' },
    model: { type: 'irregular', starburst: true, seed: 700 },
  },
  {
    id: 'ngc253', name: 'Sculptor Galaxy', aliases: ['NGC 253', 'Silver Coin Galaxy'],
    type: 'Starburst galaxy', subtype: 'SAB(s)c',
    ra: 11.8879, dec: -25.2883, distMpc: 3.4, redShift: 0.000811,
    diameterKpc: 27, inclinationDeg: 75, positionAngleDeg: 51, magV: 7.1,
    group: 'Sculptor Group', role: 'Starburst spiral',
    description: 'A dusty, actively star-forming spiral in the Sculptor Group, seen nearly edge-on.',
    facts: [
      { label: 'Morphology', value: 'SAB(s)c' },
      { label: 'Distance', value: '≈ 3.4 Mpc (11 million ly)' },
      { label: 'Diameter', value: '≈ 27 kpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative starburst spiral model' },
    model: { type: 'spiral', arms: 2, bar: true, pitch: 18, edge: 68, seed: 777 },
  },
  {
    id: 'm83', name: 'Southern Pinwheel Galaxy', aliases: ['M83', 'NGC 5236'],
    type: 'Barred spiral galaxy', subtype: 'SAB(s)c',
    ra: 204.2538, dec: -29.8658, distMpc: 4.6, redShift: 0.001711,
    diameterKpc: 17, inclinationDeg: 24, positionAngleDeg: 46, magV: 7.54,
    group: 'Centaurus A/M83 Group', role: 'Grand-design barred spiral',
    description: 'A bright, face-on barred spiral with a high supernova rate and prominent spiral arms.',
    facts: [
      { label: 'Morphology', value: 'SAB(s)c' },
      { label: 'Distance', value: '≈ 4.6 Mpc (15 million ly)' },
      { label: 'Diameter', value: '≈ 17 kpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative barred spiral model' },
    model: { type: 'spiral', arms: 2, bar: true, pitch: 16, seed: 823 },
  },
  {
    id: 'm64', name: 'Black Eye Galaxy', aliases: ['M64', 'NGC 4826'],
    type: 'Spiral galaxy', subtype: 'SA(rs)ab',
    ra: 194.1821, dec: 21.6828, distMpc: 5.3, redShift: 0.001361,
    diameterKpc: 16, inclinationDeg: 62, positionAngleDeg: 115, magV: 8.5,
    group: 'Coma I Group', role: 'Counter-rotating gas disk',
    description: 'A spiral with a dark dust band across its nucleus. Its inner and outer gas disks rotate in opposite directions — evidence of a past merger.',
    facts: [
      { label: 'Morphology', value: 'SA(rs)ab' },
      { label: 'Distance', value: '≈ 5.3 Mpc (17 million ly)' },
      { label: 'Diameter', value: '≈ 16 kpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative spiral model' },
    model: { type: 'spiral', arms: 2, bar: false, pitch: 22, dust: true, seed: 864 },
  },
  {
    id: 'm94', name: 'M94', aliases: ['NGC 4736', 'Croc\'s Eye Galaxy'],
    type: 'Spiral galaxy', subtype: 'SA(r)ab',
    ra: 192.7213, dec: 41.1206, distMpc: 4.7, redShift: 0.001027,
    diameterKpc: 15, inclinationDeg: 7, positionAngleDeg: 117, magV: 8.2,
    group: 'M94 Group', role: 'Inner ring starburst',
    description: 'A nearly face-on galaxy with a bright inner ring of vigorous star formation and a faint outer disk.',
    facts: [
      { label: 'Morphology', value: 'SA(r)ab' },
      { label: 'Distance', value: '≈ 4.7 Mpc (15 million ly)' },
      { label: 'Diameter', value: '≈ 15 kpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative ring galaxy model' },
    model: { type: 'ring', seed: 940 },
  },
  {
    id: 'ngc1300', name: 'NGC 1300', aliases: [],
    type: 'Barred spiral galaxy', subtype: 'SB(s)bc',
    ra: 49.9208, dec: -19.4111, distMpc: 18.1, redShift: 0.005244,
    diameterKpc: 34, inclinationDeg: 30, positionAngleDeg: 106, magV: 10.4,
    group: 'Eridanus Cluster', role: 'Classic barred spiral',
    description: 'A textbook barred spiral with a prominent bar and tightly wound arms. The bar itself spans roughly 5,000 light-years.',
    facts: [
      { label: 'Morphology', value: 'SB(s)bc' },
      { label: 'Distance', value: '≈ 18 Mpc (59 million ly)' },
      { label: 'Diameter', value: '≈ 34 kpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative barred spiral model' },
    model: { type: 'spiral', arms: 2, bar: true, pitch: 13, seed: 1200 },
  },
  {
    id: 'ngc1365', name: 'NGC 1365', aliases: ['Great Barred Spiral Galaxy'],
    type: 'Barred spiral galaxy', subtype: 'SB(s)b',
    ra: 53.4017, dec: -36.1403, distMpc: 17.3, redShift: 0.005457,
    diameterKpc: 33, inclinationDeg: 40, positionAngleDeg: 32, magV: 9.6,
    group: 'Fornax Cluster', role: 'Double-barred spiral',
    description: 'A giant barred spiral with a double bar and an active galactic nucleus, located in the Fornax Cluster.',
    facts: [
      { label: 'Morphology', value: 'SB(s)b' },
      { label: 'Distance', value: '≈ 17.3 Mpc (56 million ly)' },
      { label: 'Diameter', value: '≈ 33 kpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative barred spiral model' },
    model: { type: 'spiral', arms: 2, bar: true, pitch: 10, seed: 1365 },
  },
  {
    id: 'm46', name: 'Antennae Galaxies', aliases: ['NGC 4038', 'NGC 4039'],
    type: 'Interacting galaxies', subtype: 'SB(s)m pec / SB(s)m pec',
    ra: 180.4708, dec: -18.8672, distMpc: 22.6, redShift: 0.005477,
    diameterKpc: 30, inclinationDeg: 35, magV: 10.3,
    group: 'NGC 4038 Group', role: 'Ongoing galaxy collision',
    description: 'A pair of colliding galaxies whose stars and gas have been flung into enormous tidal tails, resembling insect antennae.',
    facts: [
      { label: 'Type', value: 'Interacting spiral pair' },
      { label: 'Distance', value: '≈ 22.6 Mpc (74 million ly)' },
      { label: 'Span', value: '≈ 30 kpc (including tails)' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative interacting model' },
    model: { type: 'interacting', seed: 4038 },
  },
  {
    id: 'm77', name: 'M77', aliases: ['NGC 1068', 'Cetus A'],
    type: 'Seyfert galaxy', subtype: 'SA(rs)b',
    ra: 40.6696, dec: -0.0133, distMpc: 14.4, redShift: 0.003793,
    diameterKpc: 26, inclinationDeg: 32, positionAngleDeg: 55, magV: 8.9,
    group: 'M77 Group', role: 'Nearby active galaxy',
    description: 'A barred spiral with an obscured active nucleus, one of the nearest luminous Seyfert galaxies and a prototype for AGN studies.',
    facts: [
      { label: 'Morphology', value: 'SA(rs)b' },
      { label: 'Distance', value: '≈ 14.4 Mpc (47 million ly)' },
      { label: 'Diameter', value: '≈ 26 kpc' },
      { label: 'Activity', value: 'Seyfert 2 nucleus' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative Seyfert spiral model' },
    model: { type: 'spiral', arms: 2, bar: true, pitch: 17, active: true, seed: 1068 },
  },
  {
    id: 'm106', name: 'M106', aliases: ['NGC 4258'],
    type: 'Spiral galaxy', subtype: 'SAB(s)bc',
    ra: 184.7396, dec: 47.304, distMpc: 7.2, redShift: 0.001494,
    diameterKpc: 43, inclinationDeg: 72, positionAngleDeg: 150, magV: 8.4,
    group: 'M106 Group', role: 'Megamaser galaxy',
    description: 'A spiral galaxy with an active nucleus and water megamasers, used to measure the Hubble constant geometrically.',
    facts: [
      { label: 'Morphology', value: 'SAB(s)bc' },
      { label: 'Distance', value: '≈ 7.2 Mpc (23.5 million ly)' },
      { label: 'Diameter', value: '≈ 43 kpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative spiral model' },
    model: { type: 'spiral', arms: 2, bar: true, pitch: 15, seed: 4258 },
  },
  {
    id: 'ngc1275', name: 'NGC 1275', aliases: ['Perseus A', '3C 84'],
    type: 'Central cluster galaxy', subtype: 'cD / S0',
    ra: 49.9507, dec: 41.5117, distMpc: 76, redShift: 0.017559,
    diameterKpc: 120, inclinationDeg: 30, magV: 11.9,
    group: 'Perseus Cluster', role: 'Brightest cluster galaxy',
    description: 'The central galaxy of the Perseus Cluster, powered by accretion onto a supermassive black hole and sculpted by rising bubbles of radio plasma.',
    facts: [
      { label: 'Morphology', value: 'cD / S0 pec' },
      { label: 'Distance', value: '≈ 76 Mpc (245 million ly)' },
      { label: 'Group', value: 'Perseus Cluster (Abell 426)' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
    viz: { mode: 'model', label: 'Illustrative cD model' },
    model: { type: 'elliptical', seed: 1275 },
  },
];

export const CLUSTERS = [
  {
    id: 'virgo-cluster', name: 'Virgo Cluster', aliases: ['Virgo', 'Abell 1213?'],
    type: 'Galaxy cluster', ra: 187.7058, dec: 12.3911, z: 0.0038, distMpc: 16.5,
    richness: '≈ 1,300 member galaxies', diameterMpc: 2.2,
    description: 'The nearest large galaxy cluster and the gravitational centre of the Local Supercluster. Its core is dominated by M87 and hot X-ray gas.',
    facts: [
      { label: 'Distance', value: '≈ 16.5 Mpc (54 million ly)' },
      { label: 'Members', value: 'About 1,300 confirmed galaxies' },
      { label: 'Core', value: 'M87' },
      { label: 'Redshift', value: '0.0038' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); NASA Chandra', url: 'https://chandra.harvard.edu/', retrieved: '2026-11' },
    memberIds: ['m87', 'm49', 'm84', 'm86', 'm60'],
  },
  {
    id: 'coma-cluster', name: 'Coma Cluster', aliases: ['Abell 1656', 'Coma'],
    type: 'Galaxy cluster', ra: 194.9529, dec: 27.98, z: 0.0231, distMpc: 99,
    richness: '> 1,000 member galaxies', diameterMpc: 3.0,
    description: 'One of the richest nearby clusters, dominated by elliptical and lenticular galaxies. Its hot intracluster gas was among the first evidence for dark matter.',
    facts: [
      { label: 'Distance', value: '≈ 99 Mpc (321 million ly)' },
      { label: 'Members', value: 'More than 1,000 galaxies' },
      { label: 'Redshift', value: '0.0231' },
      { label: 'Abell number', value: 'A1656' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
  },
  {
    id: 'perseus-cluster', name: 'Perseus Cluster', aliases: ['Abell 426', 'Perseus'],
    type: 'Galaxy cluster', ra: 49.9483, dec: 41.5131, z: 0.0179, distMpc: 75,
    richness: '≈ 500 member galaxies', diameterMpc: 2.5,
    description: 'A massive nearby cluster whose bright core is centred on NGC 1275. It is one of the brightest X-ray clusters in the sky.',
    facts: [
      { label: 'Distance', value: '≈ 75 Mpc (245 million ly)' },
      { label: 'Core', value: 'NGC 1275 / Perseus A' },
      { label: 'Redshift', value: '0.0179' },
      { label: 'Abell number', value: 'A426' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); NASA Chandra', url: 'https://chandra.harvard.edu/', retrieved: '2026-11' },
    memberIds: ['ngc1275'],
  },
  {
    id: 'fornax-cluster', name: 'Fornax Cluster', aliases: ['Abell S0373', 'Fornax'],
    type: 'Galaxy cluster', ra: 54.6213, dec: -35.4544, z: 0.0046, distMpc: 19,
    richness: '≈ 60 bright galaxies', diameterMpc: 1.5,
    description: 'A compact southern cluster of galaxies, dominated by the giant elliptical NGC 1399 and home to a rich population of dwarf galaxies.',
    facts: [
      { label: 'Distance', value: '≈ 19 Mpc (62 million ly)' },
      { label: 'Redshift', value: '0.0046' },
      { label: 'Core', value: 'NGC 1399' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
  },
  {
    id: 'hydra-cluster', name: 'Hydra Cluster', aliases: ['Abell 1060', 'Hydra'],
    type: 'Galaxy cluster', ra: 159.22, dec: -27.5289, z: 0.0129, distMpc: 54,
    richness: '≈ 150 galaxies', diameterMpc: 1.8,
    description: 'A rich cluster in the Hydra-Centaurus supercluster, notable for its high fraction of spiral galaxies.',
    facts: [
      { label: 'Distance', value: '≈ 54 Mpc (176 million ly)' },
      { label: 'Redshift', value: '0.0129' },
      { label: 'Abell number', value: 'A1060' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
  },
  {
    id: 'centaurus-cluster', name: 'Centaurus Cluster', aliases: ['Abell 3526', 'Centaurus'],
    type: 'Galaxy cluster', ra: 192.2158, dec: -41.3058, z: 0.0114, distMpc: 48,
    richness: '≈ 100 galaxies', diameterMpc: 1.6,
    description: 'A massive cluster in the Centaurus supercluster with a cool core and a prominent central galaxy, NGC 4696.',
    facts: [
      { label: 'Distance', value: '≈ 48 Mpc (157 million ly)' },
      { label: 'Core', value: 'NGC 4696' },
      { label: 'Redshift', value: '0.0114' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
  },
  {
    id: 'norma-cluster', name: 'Norma Cluster', aliases: ['Abell 3627', 'Great Attractor'],
    type: 'Galaxy cluster', ra: 243.8867, dec: -60.9083, z: 0.016, distMpc: 67,
    richness: 'Massive cluster', diameterMpc: 2.0,
    description: 'A massive cluster near the centre of the Great Attractor, a vast gravitational concentration toward which the Local Group is moving.',
    facts: [
      { label: 'Distance', value: '≈ 67 Mpc (220 million ly)' },
      { label: 'Redshift', value: '0.016' },
      { label: 'Context', value: 'Great Attractor / Norma supercluster' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED)', url: SOURCES.ned.url, retrieved: '2026-11' },
  },
  {
    id: 'abell-1689', name: 'Abell 1689', aliases: ['A1689'],
    type: 'Galaxy cluster', ra: 197.8729, dec: -1.3381, z: 0.1832,
    richness: 'Massive lensing cluster', diameterMpc: 2.0,
    description: 'A massive cluster whose gravity forms one of the largest gravitationally lensed arcs known, a powerful probe of dark matter and distant galaxies.',
    facts: [
      { label: 'Redshift', value: '0.1832' },
      { label: 'Role', value: 'Strong gravitational lens' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); Hubble Space Telescope', url: 'https://www.nasa.gov/', retrieved: '2026-11' },
  },
  {
    id: 'bullet-cluster', name: 'Bullet Cluster', aliases: ['1E 0657-56'],
    type: 'Merging galaxy cluster', ra: 104.675, dec: -55.95, z: 0.296,
    richness: 'Merging pair', diameterMpc: 2.5,
    description: 'Two galaxy clusters in the middle of a high-speed merger. The separation of its hot gas from its dark matter provided some of the strongest evidence for dark matter.',
    facts: [
      { label: 'Redshift', value: '0.296' },
      { label: 'Type', value: 'Merging cluster pair' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); NASA Chandra', url: 'https://chandra.harvard.edu/', retrieved: '2026-11' },
  },
  {
    id: 'abell-370', name: 'Abell 370', aliases: ['A370'],
    type: 'Galaxy cluster', ra: 39.9688, dec: -1.5853, z: 0.375,
    richness: 'Massive lensing cluster', diameterMpc: 2.0,
    description: 'A massive cluster famous for a striking gravitational lens arc nicknamed the Dragon, produced by a background spiral galaxy.',
    facts: [
      { label: 'Redshift', value: '0.375' },
      { label: 'Role', value: 'Strong gravitational lens' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); Hubble Space Telescope', url: 'https://www.nasa.gov/', retrieved: '2026-11' },
  },
  {
    id: 'macs0416', name: 'MACS J0416.1−2403', aliases: ['MACS 0416'],
    type: 'Galaxy cluster', ra: 64.0371, dec: -24.0744, z: 0.397,
    richness: 'Frontier Fields cluster', diameterMpc: 2.0,
    description: 'A massive, merging cluster observed in the Hubble Frontier Fields programme, used to study galaxies magnified by gravitational lensing.',
    facts: [
      { label: 'Redshift', value: '0.397' },
      { label: 'Role', value: 'Gravitational lens / Frontier Fields target' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); Hubble Frontier Fields', url: 'https://www.nasa.gov/', retrieved: '2026-11' },
  },
  {
    id: 'macs1149', name: 'MACS J1149.5+2223', aliases: ['MACS 1149'],
    type: 'Galaxy cluster', ra: 177.3979, dec: 22.3986, z: 0.544,
    richness: 'Frontier Fields cluster', diameterMpc: 2.0,
    description: 'A massive cluster that hosts a strongly lensed background galaxy and was targeted by the Hubble Frontier Fields programme.',
    facts: [
      { label: 'Redshift', value: '0.544' },
      { label: 'Role', value: 'Gravitational lens' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); Hubble Frontier Fields', url: 'https://www.nasa.gov/', retrieved: '2026-11' },
  },
  {
    id: 'el-gordo', name: 'El Gordo', aliases: ['ACT-CL J0102−4915'],
    type: 'Merging galaxy cluster', ra: 14.7167, dec: -49.2333, z: 0.87,
    richness: 'Merging pair', diameterMpc: 3.0,
    description: 'Nicknamed “the Fat One”, a colossal cluster merger seen at redshift 0.87. Its extreme mass challenges some models of cluster formation.',
    facts: [
      { label: 'Redshift', value: '0.87' },
      { label: 'Type', value: 'Merging cluster pair' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); NASA Chandra', url: 'https://chandra.harvard.edu/', retrieved: '2026-11' },
  },
  {
    id: 'shapley', name: 'Shapley Supercluster', aliases: ['Shapley Concentration'],
    type: 'Supercluster', ra: 201.25, dec: -31.0, z: 0.048, distMpc: 200,
    richness: 'One of the most massive nearby concentrations', diameterMpc: 30,
    description: 'A vast concentration of galaxy clusters at about 200 Mpc, one of the most massive structures in the nearby universe.',
    facts: [
      { label: 'Distance', value: '≈ 200 Mpc (650 million ly)' },
      { label: 'Redshift', value: '0.048' },
      { label: 'Extent', value: '≈ 30 Mpc' },
    ],
    provenance: { source: 'NASA/IPAC Extragalactic Database (NED); literature values rounded', url: SOURCES.ned.url, retrieved: '2026-11' },
  },
  {
    id: 'laniakea', name: 'Laniakea Supercluster', aliases: ['Laniakea'],
    type: 'Supercluster', ra: 201.0, dec: -30.0, z: 0.0, distMpc: 80,
    richness: '≈ 100,000 galaxies', diameterMpc: 160,
    description: 'The supercluster that contains the Local Group, as defined by the cosmic flows that funnel galaxies toward the Great Attractor. “Laniakea” means immeasurable heaven in Hawaiian.',
    facts: [
      { label: 'Extent', value: '≈ 160 Mpc (520 million ly)' },
      { label: 'Galaxies', value: 'About 100,000' },
      { label: 'Role', value: 'Our home supercluster' },
    ],
    provenance: { source: 'Tully et al. (2014), Nature; NASA/IPAC', url: 'https://www.nature.com/articles/nature13674', retrieved: '2026-11' },
  },
  {
    id: 'great-wall', name: 'Sloan Great Wall', aliases: ['SGW'],
    type: 'Galaxy filament / wall', ra: null, dec: null, z: 0.08, distMpc: 300, noPosition: true,
    extentMpc: 420,
    description: 'A huge filamentary structure of galaxies discovered in SDSS data, spanning roughly 420 Mpc. Galaxy surveys show the universe’s matter arranged in such walls, filaments and voids.',
    facts: [
      { label: 'Span', value: '≈ 420 Mpc (1.4 billion ly)' },
      { label: 'Discovered', value: '2003, Sloan Digital Sky Survey' },
      { label: 'Nature', value: 'Large-scale structure, not a gravitationally bound object' },
    ],
    provenance: { source: 'Gott et al. (2005); SDSS', url: SOURCES.sdss.url, retrieved: '2026-11' },
  },
];

export const NEBULAE = [
  { id: 'm42', name: 'Orion Nebula', aliases: ['M42', 'NGC 1976'], ra: 83.8221, dec: -5.3911, distKpc: 0.412, type: 'Emission nebula', color: '#80b7d8', description: 'The nearest large star-forming region, visible to the naked eye as the middle “star” of Orion’s sword.' },
  { id: 'm8', name: 'Lagoon Nebula', aliases: ['M8', 'NGC 6523'], ra: 270.925, dec: -24.383, distKpc: 1.25, type: 'Emission nebula', color: '#d88999', description: 'A giant interstellar cloud in Sagittarius, ionized by young hot stars.' },
  { id: 'm16', name: 'Eagle Nebula', aliases: ['M16', 'NGC 6611'], ra: 274.7, dec: -13.84, distKpc: 1.74, type: 'Emission nebula', color: '#b6c9a0', description: 'A young star cluster and nebula, home to the iconic Pillars of Creation.' },
  { id: 'm1', name: 'Crab Nebula', aliases: ['M1', 'NGC 1952'], ra: 83.6333, dec: 22.0145, distKpc: 2.0, type: 'Supernova remnant', color: '#c58a72', description: 'The expanding remnant of a supernova observed on Earth in 1054 CE.' },
  { id: 'm57', name: 'Ring Nebula', aliases: ['M57', 'NGC 6720'], ra: 283.396, dec: 33.029, distKpc: 0.79, type: 'Planetary nebula', color: '#8fc5b5', description: 'The glowing shell of a dying Sun-like star, in Lyra.' },
  { id: 'helix', name: 'Helix Nebula', aliases: ['NGC 7293'], ra: 337.41, dec: -20.84, distKpc: 0.201, type: 'Planetary nebula', color: '#83b6c4', description: 'One of the closest planetary nebulae, often called the Eye of God.' },
];

/**
 * Two named stars used by the UDA 2–3 journey. They are not in the named HYG
 * index, so their measured positions are kept here. Coordinates and modern
 * distances are J2000 values from SIMBAD/Wikipedia; presentation-era values
 * are preserved separately because the lesson cites the supplied slide.
 */
export const CURATED_STARS = [
  {
    id: 'vy-cma', name: 'VY Canis Majoris', aliases: ['VY CMa', 'VY Canis Majoris'],
    ra: 110.743033, dec: -25.767565, distPc: 1170, distLy: 3820,
    radiusSun: 1420, spectralType: 'M3–M4.5 Ia', kind: 'Red hypergiant',
    note: 'One of the largest known stars, shedding mass in a dense circumstellar envelope.',
    source: 'SIMBAD / Wittkowski et al.; radius 1,420 ± 120 R☉',
  },
  {
    id: 'uy-sct', name: 'UY Scuti', aliases: ['UY Sct', 'BD-12°5055'],
    ra: 276.902222, dec: -12.466352, distPc: 1800, distLy: 5871,
    radiusSun: 909, presentationDistLy: 9460, presentationRadiusSun: 1708,
    spectralType: 'M2–M4 Ia–Iab', kind: 'Red supergiant',
    note: 'A pulsating red supergiant in Scutum. Modern estimates are smaller and closer than the 2018 presentation values.',
    source: 'Gaia DR3 / Healy et al. 2023; presentation values 1,708 R☉ and 9,460 ly',
  },
];

/* -------------------------------------------------------------------------- */
/* Guided tours                                                               */
/* -------------------------------------------------------------------------- */

export const TOURS = [
  {
    id: 'solar-system',
    number: '01',
    title: 'Our Solar System',
    subtitle: 'From our world to the edge of the giant planets.',
    duration: '~2 min',
    stops: [
      { target: 'earth', mode: 'earth', seconds: 10, title: 'Earth', text: 'We begin on the only world known to host life: a water-rich planet with a protective atmosphere and a large Moon stabilising its tilt.' },
      { target: 'moon', mode: 'earth', seconds: 8, title: 'The Moon', text: 'Earth’s companion formed from debris after a giant impact. Its far side is more heavily cratered than the familiar near side.' },
      { target: 'mars', mode: 'solar', seconds: 9, title: 'Mars', text: 'A cold desert world with ancient river valleys. Its thin CO₂ atmosphere is less than one percent as dense as Earth’s.' },
      { target: 'jupiter', mode: 'solar', seconds: 9, title: 'Jupiter', text: 'A hydrogen–helium giant more massive than every other planet combined. The Great Red Spot is a storm wider than Earth.' },
      { target: 'saturn', mode: 'solar', seconds: 10, title: 'Saturn', text: 'Its rings span roughly 280,000 km yet are extraordinarily thin — a disk of ice and rock, sculpted by moons.' },
      { target: 'neptune', mode: 'solar', seconds: 9, title: 'Neptune', text: 'The outermost planet: an ice giant where supersonic winds reach over 2,000 km/h. Its moon Triton orbits backwards.' },
    ],
  },
  {
    id: 'stellar-neighborhood',
    number: '02',
    title: 'Our Stellar Neighbourhood',
    subtitle: 'The nearest stars, mapped in three dimensions.',
    duration: '~2 min',
    stops: [
      { target: 'sun', mode: 'solar', seconds: 8, title: 'The Sun', text: 'A G2V main-sequence star holding 99.86% of the Solar System’s mass. Its light takes 8 minutes 20 seconds to reach Earth.' },
      { target: 'Alpha Centauri A', mode: 'stars', seconds: 9, title: 'Alpha Centauri A', text: 'A Sun-like star 4.37 light-years away, orbiting a common centre of mass with Alpha Centauri B.' },
      { target: 'Proxima Centauri', mode: 'stars', seconds: 9, title: 'Proxima Centauri', text: 'The closest star to the Sun, a small red dwarf 4.24 light-years away. Its planet Proxima b lies in the habitable zone.' },
      { target: 'Sirius', mode: 'stars', seconds: 9, title: 'Sirius', text: 'The brightest star in Earth’s night sky. It is orbited by a white dwarf, Sirius B, the remnant of a Sun-like star.' },
      { target: 'Barnard’s Star', mode: 'stars', seconds: 9, title: "Barnard's Star", text: 'A faint red dwarf only 5.96 light-years away. It has the largest proper motion of any star known.' },
    ],
  },
  {
    id: 'exoplanets',
    number: '03',
    title: 'Worlds Beyond',
    subtitle: 'Confirmed planets around other stars.',
    duration: '~2 min',
    stops: [
      { target: 'Proxima b', mode: 'exo', seconds: 10, title: 'Proxima b', text: 'A planet slightly heavier than Earth orbiting in the habitable zone of the closest star. Its surface has never been observed.' },
      { target: 'TRAPPIST-1e', mode: 'exo', seconds: 11, title: 'TRAPPIST-1e', text: 'One of seven Earth-sized worlds around a cool red dwarf about 40 light-years away. The system is a prime target for atmospheric study.' },
      { target: '51 Peg b', mode: 'exo', seconds: 10, title: '51 Pegasi b', text: 'In 1995 this hot Jupiter became the first confirmed planet orbiting a Sun-like star, opening the exoplanet era.' },
      { target: 'Kepler-452 b', mode: 'exo', seconds: 10, title: 'Kepler-452 b', text: 'A super-Earth-sized world in the habitable zone of a Sun-like star about 1,800 light-years away.' },
    ],
  },
  {
    id: 'beyond-milky-way',
    number: '04',
    title: 'Beyond the Milky Way',
    subtitle: 'A journey through the Local Group.',
    duration: '~2 min',
    stops: [
      { target: 'milky-way', mode: 'galaxy', seconds: 10, title: 'The Milky Way', text: 'Our home galaxy: a barred spiral roughly 100,000 light-years across. The solar neighbourhood is about 26,000 light-years from its centre.' },
      { target: 'lmc', mode: 'cosmos', seconds: 9, title: 'Large Magellanic Cloud', text: 'A satellite galaxy 163,000 light-years away, visible to the naked eye from the southern sky.' },
      { target: 'smc', mode: 'cosmos', seconds: 8, title: 'Small Magellanic Cloud', text: 'A smaller, irregular companion interacting with both the Milky Way and the Large Magellanic Cloud.' },
      { target: 'm31', mode: 'cosmos', seconds: 11, title: 'Andromeda', text: 'The nearest large spiral galaxy, 2.5 million light-years away and approaching the Milky Way at about 110 km/s.' },
      { target: 'm33', mode: 'cosmos', seconds: 9, title: 'Triangulum', text: 'The third-largest galaxy in the Local Group, a low-metallicity spiral still actively forming stars.' },
    ],
  },
  {
    id: 'cosmic-web',
    number: '05',
    title: 'The Cosmic Web',
    subtitle: 'From clusters to the edge of observation.',
    duration: '~2 min',
    stops: [
      { target: 'virgo-cluster', mode: 'cosmos', seconds: 9, title: 'Virgo Cluster', text: 'The nearest large cluster, 54 million light-years away. Its gravity shapes the motion of hundreds of galaxies, including our own.' },
      { target: 'coma-cluster', mode: 'cosmos', seconds: 9, title: 'Coma Cluster', text: 'A rich cluster 321 million light-years away. The motions of its galaxies first revealed the presence of unseen mass.' },
      { target: 'laniakea', mode: 'cosmos', seconds: 10, title: 'Laniakea', text: 'Our home supercluster: about 100,000 galaxies flowing toward the Great Attractor, spanning roughly 520 million light-years.' },
      { target: 'sdss-web', mode: 'cosmos', seconds: 11, title: 'The Observable Web', text: 'Galaxies trace filaments and walls around vast voids. This map uses real SDSS redshifts; the observable horizon lies far beyond.' },
    ],
  },
];

export const SCALE_LEVELS = [
  { id: 'earth', label: 'Earth', sub: 'Planetary surface', meters: 6.4e6, mode: 'earth' },
  { id: 'earth-moon', label: 'Earth–Moon', sub: '384,400 km', meters: 6.0e8, mode: 'earth' },
  { id: 'solar-system', label: 'Solar System', sub: 'Neptune orbit', meters: 9.0e12, mode: 'solar' },
  { id: 'stellar', label: 'Stellar Neighbourhood', sub: 'tens of light-years', meters: 3.0e17, mode: 'stars' },
  { id: 'milky-way', label: 'Milky Way', sub: '100,000 light-years', meters: 9.5e20, mode: 'galaxy' },
  { id: 'local-group', label: 'Local Group', sub: 'millions of light-years', meters: 7.6e22, mode: 'cosmos' },
  { id: 'cosmic-web', label: 'Cosmic Web', sub: 'hundreds of megaparsecs', meters: 6.2e24, mode: 'cosmos' },
  { id: 'observable', label: 'Observable Universe', sub: '46.5 billion light-years', meters: 4.4e26, mode: 'cosmos' },
];

export const EARTH_LANDMARKS = [
  { name: 'Amazon Basin', lat: -3.4, lon: -62.2, kind: 'Biome', note: 'The largest tropical rainforest on Earth.' },
  { name: 'Sahara', lat: 23.4, lon: 12.0, kind: 'Desert', note: 'The largest hot desert, covering about 9.2 million km².' },
  { name: 'Himalaya', lat: 28.0, lon: 86.9, kind: 'Mountain range', note: 'Home to Mount Everest, 8,848.86 m above sea level.' },
  { name: 'Great Barrier Reef', lat: -18.3, lon: 147.7, kind: 'Reef system', note: 'The world’s largest coral reef system, visible from orbit.' },
  { name: 'Mariana Trench', lat: 11.35, lon: 142.2, kind: 'Ocean trench', note: 'The deepest known oceanic trench, about 10,935 m at Challenger Deep.' },
  { name: 'Antarctic Ice Sheet', lat: -82.0, lon: 0.0, kind: 'Ice sheet', note: 'The largest single mass of ice on Earth.' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, kind: 'City', note: 'One of the largest metropolitan areas on Earth.' },
  { name: 'New York City', lat: 40.7128, lon: -74.006, kind: 'City', note: 'A major Atlantic population centre.' },
  { name: 'Nile Delta', lat: 30.9, lon: 31.2, kind: 'River delta', note: 'A fertile delta supporting one of the world’s oldest civilisations.' },
];

export const FEATURED_STAR_NAMES = [
  'Sirius', 'Proxima Centauri', 'Alpha Centauri A', 'Alpha Centauri B',
  'Barnard’s Star', 'Vega', 'Betelgeuse', 'Rigel', 'Polaris', 'Antares',
  'Arcturus', 'Deneb', 'Altair', 'Fomalhaut', 'Aldebaran', 'Spica',
  'Canopus', 'Achernar', 'Capella', 'Bellatrix',
];

export const SCALE_BAR_TICKS = [
  { meters: 1e4, label: '10 km' },
  { meters: 1e7, label: '1,000 km' },
  { meters: 1e9, label: '1 million km' },
  { meters: 1.5e11, label: '1 AU' },
  { meters: 1e13, label: '1 light-day' },
  { meters: 9.46e15, label: '1 ly' },
  { meters: 3.09e16, label: '1 pc' },
  { meters: 3.09e19, label: '1 kpc' },
  { meters: 3.09e22, label: '1 Mpc' },
  { meters: 3.09e25, label: '1 Gpc' },
];

export const OBSERVABLE_UNIVERSE_RADIUS_MPC = 14_300; // ~46.5 Gly comoving
export const OBSERVABLE_UNIVERSE_LOOKBACK_GYR = 13.8;
