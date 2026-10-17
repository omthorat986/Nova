/**
 * NOVA Space Exploration - Observatory & Star Catalog
 * Verified astronomical coordinates, spectral classes, magnitudes, and constellations.
 */
export const STARS_DATA = [
  {
    id: 'sirius',
    name: 'Sirius (Alpha Canis Majoris)',
    constellation: 'Canis Major',
    distanceLY: '8.60 Light-Years',
    spectralClass: 'A1V (White Main Sequence)',
    apparentMagnitude: -1.46,
    surfaceTemp: '9,940 K',
    mass: '2.06 M☉',
    radius: '1.71 R☉',
    rightAscension: '06h 45m 09s',
    declination: '-16° 42′ 58″',
    description: 'The brightest star in the night sky. Sirius is a binary star system comprising a luminous A-type main-sequence star and a faint white dwarf companion (Sirius B / "The Pup").',
    x: 0.35,
    y: -0.42,
    brightness: 1.0,
    color: '#EAF7FF',
    wavelengths: {
      visible: 'Brilliant blue-white dazzling illumination with intense scintillation.',
      infrared: 'Faint circumstellar dust envelope detected at longer wavelengths.',
      xray: 'Sirius B dominates the X-ray spectrum as an intensely hot 25,000 K white dwarf surface.',
      radio: 'Non-thermal thermal wind emission detected with ALMA interferometry.'
    }
  },
  {
    id: 'betelgeuse',
    name: 'Betelgeuse (Alpha Orionis)',
    constellation: 'Orion',
    distanceLY: '642.5 Light-Years',
    spectralClass: 'M1-2 Ia-ab (Red Supergiant)',
    apparentMagnitude: 0.50,
    surfaceTemp: '3,600 K',
    mass: '16.5 – 19 M☉',
    radius: '764 – 1,020 R☉ (Envelopes Jupiter)',
    rightAscension: '05h 55m 10s',
    declination: '+07° 24′ 25″',
    description: 'A colossal red supergiant near the end of its stellar lifespan. If placed at the center of our Solar System, its pulsating atmosphere would engulf the orbits of Mercury, Venus, Earth, and Mars.',
    x: -0.22,
    y: 0.18,
    brightness: 0.85,
    color: '#FF6B4A',
    wavelengths: {
      visible: 'Distinct reddish-orange hue with periodic episodic dimming events.',
      infrared: 'Gigantic nested shells of expelled dusty carbonaceous gas spanning light-years.',
      xray: 'Quiescent corona with sparse hard X-ray shocks from asymmetric stellar pulsations.',
      radio: 'Massive molecular outflow envelopes clearly resolved by the ALMA millimeter array.'
    }
  },
  {
    id: 'rigel',
    name: 'Rigel (Beta Orionis)',
    constellation: 'Orion',
    distanceLY: '860 Light-Years',
    spectralClass: 'B8 Ia (Blue-White Supergiant)',
    apparentMagnitude: 0.13,
    surfaceTemp: '12,100 K',
    mass: '21 M☉',
    radius: '78.9 R☉',
    rightAscension: '05h 14m 32s',
    declination: '-08° 12′ 06″',
    description: 'Luminous blue supergiant shining with the radiance of 120,000 Suns. Rigel illuminates several vast interstellar dust clouds in its cosmic vicinity, including the Witch Head Nebula.',
    x: -0.15,
    y: -0.25,
    brightness: 0.9,
    color: '#5CC8FF',
    wavelengths: {
      visible: 'Piercing cyan-white beacon anchoring the knee of the Orion constellation.',
      infrared: 'Clear stellar photosphere with minimal dust obscuration.',
      xray: 'Moderate colliding-wind X-ray emission produced by high-speed stellar outflows.',
      radio: 'Ionized stellar wind free-free emission observed at gigahertz frequencies.'
    }
  },
  {
    id: 'vega',
    name: 'Vega (Alpha Lyrae)',
    constellation: 'Lyra',
    distanceLY: '25.04 Light-Years',
    spectralClass: 'A0V (Rapidly Rotating White Star)',
    apparentMagnitude: 0.03,
    surfaceTemp: '9,600 K',
    mass: '2.135 M☉',
    radius: '2.36 – 2.82 R☉ (Flattened)',
    rightAscension: '18h 36m 56s',
    declination: '+38° 47′ 01″',
    description: 'Historically the baseline zero-point for photometric calibration of stellar brightness. Vega spins so rapidly (equatorial velocity 236 km/s) that its equator bulges outward and is significantly cooler than its poles.',
    x: 0.55,
    y: 0.48,
    brightness: 0.92,
    color: '#6AEEFF',
    wavelengths: {
      visible: 'Pure crisp white anchor of the famous Summer Triangle asterism.',
      infrared: 'Historic IRAS discovery of an extensive circumstellar debris ring of planetesimals.',
      xray: 'Very low coronal activity typical of intermediate-mass A-type main-sequence stars.',
      radio: 'Submillimeter thermal dust emission from collisional debris cascade.'
    }
  },
  {
    id: 'polaris',
    name: 'Polaris (Alpha Ursae Minoris)',
    constellation: 'Ursa Minor',
    distanceLY: '433 Light-Years',
    spectralClass: 'F7Ib (Yellow Supergiant Cepheid)',
    apparentMagnitude: 1.98,
    surfaceTemp: '6,015 K',
    mass: '5.4 M☉',
    radius: '37.5 R☉',
    rightAscension: '02h 31m 49s',
    declination: '+89° 15′ 51″',
    description: 'The North Star, marking the celestial pole around which all northern sky stars appear to rotate. It is a classical Cepheid variable star pulsating every 3.99 days, serving as a cosmic distance ladder standard.',
    x: 0.05,
    y: 0.75,
    brightness: 0.7,
    color: '#FFD285',
    wavelengths: {
      visible: 'Stable navigation beacon aligned nearly precisely with Earth\'s rotational axis.',
      infrared: 'Modulated infrared pulsation amplitude tracking atmospheric expansion/contraction.',
      xray: 'Weak magnetic reconnection flares originating from its binary companion dwarf.',
      radio: 'Quiet stellar radio baseline.'
    }
  },
  {
    id: 'alpha-centauri',
    name: 'Alpha Centauri A & B',
    constellation: 'Centaurus',
    distanceLY: '4.37 Light-Years',
    spectralClass: 'G2V + K1V (Binary Pair)',
    apparentMagnitude: -0.27,
    surfaceTemp: '5,790 K / 5,260 K',
    mass: '1.1 M☉ + 0.9 M☉',
    radius: '1.22 R☉ + 0.86 R☉',
    rightAscension: '14h 39m 36s',
    declination: '-60° 50′ 02″',
    description: 'Our closest stellar neighbors. A gravitationally bound binary system accompanied by Proxima Centauri (a red dwarf hosting a temperate rocky exoplanet orbiting at 4.24 light-years).',
    x: -0.45,
    y: -0.55,
    brightness: 0.95,
    color: '#FFE1A8',
    wavelengths: {
      visible: 'Brilliant golden-yellow jewel dominating the Southern Cross region.',
      infrared: 'Detailed spectral fingerprint matching closely with solar spectral indices.',
      xray: 'Coronal loop heating and variable magnetic cycle closely mimicking our Sun.',
      radio: 'Microwave flux measurements used to constrain stellar radius down to milliarcseconds.'
    }
  }
];

export const CONSTELLATIONS_DATA = [
  {
    id: 'orion',
    name: 'Orion (The Hunter)',
    stars: ['betelgeuse', 'rigel'],
    lines: [
      { from: [-0.22, 0.18], to: [-0.05, 0.08] },  // Betelgeuse to Bellatrix
      { from: [-0.05, 0.08], to: [-0.15, -0.25] }, // Bellatrix to Rigel
      { from: [-0.22, 0.18], to: [-0.30, -0.20] }, // Betelgeuse to Saiph
      { from: [-0.30, -0.20], to: [-0.15, -0.25] }, // Saiph to Rigel
      // Belt
      { from: [-0.20, -0.05], to: [-0.15, -0.04] },
      { from: [-0.15, -0.04], to: [-0.10, -0.03] }
    ]
  },
  {
    id: 'ursa-major',
    name: 'Ursa Major (The Great Bear)',
    stars: [],
    lines: [
      { from: [-0.4, 0.55], to: [-0.25, 0.58] },
      { from: [-0.25, 0.58], to: [-0.15, 0.52] },
      { from: [-0.15, 0.52], to: [-0.18, 0.40] },
      { from: [-0.18, 0.40], to: [-0.32, 0.42] },
      { from: [-0.32, 0.42], to: [-0.4, 0.55] },
      { from: [-0.15, 0.52], to: [0.0, 0.58] },
      { from: [0.0, 0.58], to: [0.15, 0.55] }
    ]
  },
  {
    id: 'cassiopeia',
    name: 'Cassiopeia (The Queen)',
    stars: [],
    lines: [
      { from: [0.25, 0.65], to: [0.35, 0.72] },
      { from: [0.35, 0.72], to: [0.42, 0.64] },
      { from: [0.42, 0.64], to: [0.50, 0.70] },
      { from: [0.50, 0.70], to: [0.60, 0.66] }
    ]
  }
];
