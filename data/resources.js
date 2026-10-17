/**
 * NOVA Space Exploration - Cosmic Compendium & Resources Database
 * Curated scientific observatories, verified space exploration databases, and seminal literature.
 */
export const RESOURCES_DATA = [
  // --- USEFUL SITES & OBSERVATORIES ---
  {
    id: 'nasa-eyes',
    title: 'NASA Eyes on the Solar System',
    type: 'site',
    category: 'Interactive Visualization',
    organization: 'NASA / Jet Propulsion Laboratory',
    url: 'https://eyes.nasa.gov/',
    description: 'Real-time 3D orbital trajectory simulation using authentic spacecraft telemetry. Fly alongside active missions, track Asteroid belt objects, and explore planetary flybys.',
    tags: ['Real-time Telemetry', '3D Simulation', 'JPL'],
    accent: '#5cc8ff'
  },
  {
    id: 'webb-archive',
    title: 'James Webb Space Telescope Gallery',
    type: 'site',
    category: 'Observatory Archive',
    organization: 'NASA / ESA / CSA / STScI',
    url: 'https://webbtelescope.org/resource-gallery/images',
    description: 'Primary public data depository for JWST infrared observations, high-resolution deep field mosaics, spectroscopic exoplanet data, and early universe cosmology.',
    tags: ['Infrared Astronomy', 'STScI', 'Deep Space'],
    accent: '#ffd285'
  },
  {
    id: 'stellarium-web',
    title: 'Stellarium Web Online Planetarium',
    type: 'site',
    category: 'Virtual Planetarium',
    organization: 'Stellarium Open Source Project',
    url: 'https://stellarium-web.org/',
    description: 'Realistic sky dome simulator rendering over 60,000 stars, constellation boundaries, real-time satellite passes, and solar system ephemerides directly in the browser.',
    tags: ['Sky Map', 'Ephemerides', 'Constellations'],
    accent: '#6aeeff'
  },
  {
    id: 'eso-portal',
    title: 'European Southern Observatory (ESO)',
    type: 'site',
    category: 'Ground-Based Astronomy',
    organization: 'ESO / Atacama Desert Facilities',
    url: 'https://www.eso.org/public/',
    description: 'World-leading ground observatories in northern Chile, including the Very Large Telescope (VLT), ALMA submillimeter array, and the upcoming 39m Extremely Large Telescope (ELT).',
    tags: ['VLT & ELT', 'ALMA', 'Interferometry'],
    accent: '#8b7cff'
  },
  {
    id: 'apod-nasa',
    title: 'Astronomy Picture of the Day (APOD)',
    type: 'site',
    category: 'Daily Scientific Imaging',
    organization: 'NASA / Michigan Technological University',
    url: 'https://apod.nasa.gov/apod/',
    description: 'The longest-running astronomy visual archive on the internet since 1995. Features daily cosmic imagery annotated by professional research astrophysicists.',
    tags: ['Astrophotography', 'Daily Archive', 'Astrophysics'],
    accent: '#5cc8ff'
  },
  {
    id: 'adsabs-harvard',
    title: 'NASA Astrophysics Data System (ADS)',
    type: 'site',
    category: 'Scientific Research Database',
    organization: 'Smithsonian Astrophysical Observatory / NASA',
    url: 'https://ui.adsabs.harvard.edu/',
    description: 'The premier open digital library portal for peer-reviewed astrophysics, planetary science, and physics literature, indexing over 15 million scientific publications.',
    tags: ['Peer-Reviewed Papers', 'Academic Research', 'Harvard SAO'],
    accent: '#a7b3c5'
  },

  // --- SEMINAL BOOKS & LITERATURE ---
  {
    id: 'book-cosmos',
    title: 'Cosmos',
    type: 'book',
    category: 'Cosmology & Philosophy',
    organization: 'Carl Sagan (1980)',
    url: 'https://www.goodreads.com/book/show/55030.Cosmos',
    description: 'The landmark masterwork exploring 15 billion years of cosmic evolution, tracing the rise of human science, planetary geology, and our civilization\'s profound place in the universe.',
    tags: ['Carl Sagan', 'Foundational', 'Pulitzer Finalist'],
    accent: '#5cc8ff'
  },
  {
    id: 'book-pale-blue-dot',
    title: 'Pale Blue Dot: A Vision of the Human Future in Space',
    type: 'book',
    category: 'Space Exploration & Destiny',
    organization: 'Carl Sagan (1994)',
    url: 'https://www.goodreads.com/book/show/54940.Pale_Blue_Dot',
    description: 'Inspired by Voyager 1\'s iconic photograph of Earth from 6 billion kilometers away, Sagan reflects on human fragility and argues for our inevitable journey to settle other worlds.',
    tags: ['Voyager 1', 'Future of Humanity', 'Planetary Habitats'],
    accent: '#6aeeff'
  },
  {
    id: 'book-brief-history',
    title: 'A Brief History of Time',
    type: 'book',
    category: 'Theoretical Physics & Cosmology',
    organization: 'Stephen Hawking (1988)',
    url: 'https://www.goodreads.com/book/show/3869.A_Brief_History_of_Time',
    description: 'Hawking\'s legendary exploration of spacetime, black holes, the Big Bang, light cones, quantum mechanics, and the ultimate quest for a Unified Theory of Everything.',
    tags: ['Stephen Hawking', 'Black Holes', 'Quantum Spacetime'],
    accent: '#8b7cff'
  },
  {
    id: 'book-astrophysics-hurry',
    title: 'Astrophysics for People in a Hurry',
    type: 'book',
    category: 'Astrophysics Essentials',
    organization: 'Neil deGrasse Tyson (2017)',
    url: 'https://www.goodreads.com/book/show/32191675-astrophysics-for-people-in-a-hurry',
    description: 'A crisp, lucid synthesis of fundamental astrophysics: from cosmic microwave background radiation and dark matter to quantum fluctuations and exoplanet spectroscopy.',
    tags: ['Neil deGrasse Tyson', 'Dark Matter', 'Modern Physics'],
    accent: '#ffd285'
  },
  {
    id: 'book-elegant-universe',
    title: 'The Elegant Universe',
    type: 'book',
    category: 'Superstring Theory',
    organization: 'Brian Greene (1999)',
    url: 'https://www.goodreads.com/book/show/8049273-the-elegant-universe',
    description: 'A mind-expanding breakdown of string theory, Calabi-Yau multidimensional geometry, and the mathematical resolution of general relativity with quantum mechanics.',
    tags: ['String Theory', 'Dimensions', 'Brian Greene'],
    accent: '#8b7cff'
  },
  {
    id: 'book-modern-astrophysics',
    title: 'An Introduction to Modern Astrophysics ("BOB")',
    type: 'book',
    category: 'University Textbook Reference',
    organization: 'Bradley W. Carroll & Dale A. Ostlie (2017)',
    url: 'https://www.cambridge.org/highereducation/books/an-introduction-to-modern-astrophysics/F5EB32FA0A03C1A3F7BAA1491B330F7C',
    description: 'Revered in academic astrophysics as the "Big Orange Book", this comprehensive 1,400-page treatise covers stellar dynamics, radiation physics, galactic evolution, and general relativity.',
    tags: ['Academic Standard', 'Stellar Physics', 'Astrophysics'],
    accent: '#a7b3c5'
  }
];
