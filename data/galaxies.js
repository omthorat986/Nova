/**
 * NOVA Space Exploration - Galactic Database
 * Verified astronomical parameters for major galaxy morphologies and archetypes.
 */
export const GALAXIES_DATA = [
  {
    id: 'spiral',
    name: 'Milky Way & Andromeda',
    type: 'Barred Spiral (SBbc)',
    diameter: '105,700 Light-Years',
    starCount: '100 – 400 Billion',
    mass: '1.5 × 10¹² Solar Masses (M☉)',
    centralObject: 'Sagittarius A* (4.15M M☉)',
    constellation: 'Sagittarius (Galactic Core)',
    color: '#5CC8FF',
    accent: '#8B7CFF',
    description: 'Spiral galaxies are dynamic rotating pinwheels characterized by a luminous central bulge, a prominent stellar bar, and curving logarithmic spiral arms rich in interstellar dust, molecular clouds, and active star-forming nebulae.',
    keyAttributes: [
      { label: 'Rotation Period', value: '~230 Million Years (Sun\'s Orbit)' },
      { label: 'Spiral Arms', value: 'Perseus, Scutum-Centaurus, Sagittarius, Orion Spur' },
      { label: 'Halo Structure', value: 'Over 150 Ancient Globular Clusters & Dark Matter Halo' },
      { label: 'Star Formation Rate', value: '~1.5 to 2.0 Solar Masses / Year' }
    ]
  },
  {
    id: 'elliptical',
    name: 'Messier 87 (Virgo A)',
    type: 'Giant Elliptical (E0-E1)',
    diameter: '240,000 Light-Years',
    starCount: 'Over 1 Trillion Stars',
    mass: '2.7 × 10¹² Solar Masses (M☉)',
    centralObject: 'M87* Relativistic Singularity (6.5B M☉)',
    constellation: 'Virgo (Center of Virgo Cluster)',
    color: '#FFB86B',
    accent: '#FFA500',
    description: 'Elliptical galaxies are massive, smooth, ellipsoidal swarms of ancient stars with virtually no cool gas or current star formation. Often formed by catastrophic mergers of spiral galaxies, they host the most colossal supermassive black holes known to astrophysics.',
    keyAttributes: [
      { label: 'Relativistic Jet', value: 'Extends 5,000 light-years at 99% the speed of light' },
      { label: 'Globular Clusters', value: 'Over 12,000 clusters orbiting the core' },
      { label: 'Interstellar Gas', value: 'Hot, X-ray emitting plasma (Millions of Kelvin)' },
      { label: 'EHT Imaging', value: 'First black hole shadow directly photographed in 2019' }
    ]
  },
  {
    id: 'irregular',
    name: 'Large Magellanic Cloud',
    type: 'Magellanic Spiral / Irregular (SB(s)m)',
    diameter: '14,000 Light-Years',
    starCount: 'Approximately 30 Billion',
    mass: '1.0 × 10¹⁰ Solar Masses (M☉)',
    centralObject: 'Diffuse intermediate-mass core',
    constellation: 'Dorado / Mensa (Southern Sky)',
    color: '#6AEEFF',
    accent: '#5CC8FF',
    description: 'Irregular galaxies lack rotational symmetry, distinct spiral arms, or organized bulges. Often gravitational victims of tidal harassment and close encounters with massive neighbors, they frequently experience violent bursts of newborn star formation.',
    keyAttributes: [
      { label: 'Distance from Earth', value: '163,000 Light-Years (Satellite of Milky Way)' },
      { label: 'Tarantula Nebula', value: 'Most luminous starburst region in the Local Group' },
      { label: 'Supernova 1987A', value: 'Closest observed modern core-collapse supernova' },
      { label: 'Tidal Interaction', value: 'Magellanic Stream trailing toward the Milky Way' }
    ]
  }
];
