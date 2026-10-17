/**
 * NOVA Space Exploration - Powers of Ten Scale Database
 * Continuous cosmological scale progression from 1 meter to the Observable Universe.
 */
export const SCALE_STEPS = [
  {
    step: 0,
    exponent: '10⁰ m',
    valueMeters: 1,
    label: 'Human Scale',
    title: 'THE OBSERVER',
    unitStr: '1 Meter',
    comparison: 'Human height & immediate biological environment',
    description: 'At the human scale, physical reality is governed by electromagnetic interactions between atoms, terrestrial gravity, and the sensory apparatus of biological consciousness looking upward toward the night sky.',
    icon: '⊙',
    accent: '#5CC8FF'
  },
  {
    step: 1,
    exponent: '10⁷ m',
    valueMeters: 1.27e7,
    label: 'Planetary Realm',
    title: 'PLANET EARTH',
    unitStr: '12,742 Kilometers',
    comparison: '~1.3 × 10⁷ meters across',
    description: 'Earth is a fragile oasis suspended in the cosmic void. An unbroken nitrogen-oxygen atmosphere barely 100 kilometers thick protects all known living organisms from the cryogenic vacuum of space.',
    icon: '⊕',
    accent: '#5CC8FF'
  },
  {
    step: 2,
    exponent: '10¹¹ m',
    valueMeters: 1.496e11,
    label: 'Astronomical Unit',
    title: 'EARTH-SUN DISTANCE',
    unitStr: '1 Astronomical Unit (149.6M km)',
    comparison: 'Light takes 8 minutes and 20 seconds to travel this distance',
    description: 'The baseline measuring stick of our planetary neighborhood. At this scale, Earth orbits inside the Sun\'s Goldilocks zone, receiving the precise solar flux required to maintain liquid water across its surface.',
    icon: '☉',
    accent: '#FFD285'
  },
  {
    step: 3,
    exponent: '10¹³ m',
    valueMeters: 1.5e13,
    label: 'Heliospheric Boundary',
    title: 'THE SOLAR SYSTEM & KUIPER BELT',
    unitStr: '~100 Astronomical Units',
    comparison: 'Voyager 1 traveled for 35 years before crossing this frontier',
    description: 'The heliopause is the boundary where the solar wind from our star is halted by the interstellar medium. Beyond lies the cold, sparse realm of interstellar space and trillions of icy comets in the distant Oort Cloud.',
    icon: '♄',
    accent: '#8B7CFF'
  },
  {
    step: 4,
    exponent: '10¹⁶ m',
    valueMeters: 4.0e16,
    label: 'Interstellar Neighborhood',
    title: 'PROXIMA CENTAURI',
    unitStr: '4.246 Light-Years',
    comparison: '40 Trillion kilometers to our nearest stellar neighbor',
    description: 'Even at 60,000 km/h, a conventional chemical spacecraft requires over 70,000 years to cross this void. Space between stars is intensely quiet and overwhelmingly empty.',
    icon: '✦',
    accent: '#6AEEFF'
  },
  {
    step: 5,
    exponent: '10²¹ m',
    valueMeters: 9.5e20,
    label: 'Galactic Horizon',
    title: 'THE MILKY WAY GALAXY',
    unitStr: '~100,000 Light-Years',
    comparison: 'Home to 100 to 400 billion stars and 100 billion planets',
    description: 'A barred spiral galaxy revolving around Sagittarius A*, a supermassive black hole of 4 million solar masses. Our Solar System completes one cosmic year every 230 million years in the Orion Arm.',
    icon: '∿',
    accent: '#8B7CFF'
  },
  {
    step: 6,
    exponent: '10²³ m',
    valueMeters: 9.5e22,
    label: 'Extragalactic Cluster',
    title: 'THE LOCAL GROUP & VIRGO SUPERCLUSTER',
    unitStr: '~10 Million Light-Years',
    comparison: 'Gravitational cluster of 80+ galaxies including Andromeda and Triangulum',
    description: 'Galaxies are not scattered randomly; they are bound by invisible dark matter filaments into colossal cosmic webs, racing toward gravitational attractors across deep spacetime.',
    icon: '⌬',
    accent: '#EAF7FF'
  },
  {
    step: 7,
    exponent: '10²⁶ m',
    valueMeters: 8.8e26,
    label: 'Cosmic Horizon',
    title: 'THE OBSERVABLE UNIVERSE',
    unitStr: '93 Billion Light-Years',
    comparison: 'Contains an estimated 2 Trillion galaxies and 10²⁴ stars',
    description: 'The cosmic light horizon defines the boundary of all matter and energy whose radiation has had time to reach us since the Big Bang 13.787 billion years ago. Beyond lies the unobservable infinite expanse.',
    icon: '∞',
    accent: '#5CC8FF'
  }
];
