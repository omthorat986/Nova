/**
 * NOVA Space Exploration - 3D WebGL Procedural Engine & Shaders
 * Premium astrophysical rendering engine: dual-layer volumetric atmosphere shaders,
 * high-contrast day/night planetary textures, and a 4-tier cosmological depth field.
 */

// Check WebGL availability
export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

/**
 * Procedural Texture Generator
 * Generates dynamic, high-resolution astronomical textures on off-screen HTML5 canvases.
 */
export class ProceduralTextures {
  static createEarthTexture(width = 2048, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Abyssal Pelagic Ocean Base (Deep midnight navy to abyssal trenches)
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, '#020713');
    oceanGrad.addColorStop(0.18, '#041026');
    oceanGrad.addColorStop(0.5, '#010816');
    oceanGrad.addColorStop(0.82, '#041026');
    oceanGrad.addColorStop(1, '#020713');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle bathymetric ridges (Mid-Atlantic Ridge & oceanic trenches)
    ctx.strokeStyle = 'rgba(10, 35, 65, 0.4)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(width * 0.46, height * 0.15);
    ctx.bezierCurveTo(width * 0.44, height * 0.4, width * 0.50, height * 0.65, width * 0.47, height * 0.85);
    ctx.stroke();

    // Helper: Draw organic geographic landmass with realistic jagged coastline jitter
    const drawLandmass = (points, fillStyle, shelfColor = 'rgba(14, 60, 92, 0.35)') => {
      // Continental shelf margin (shallow turquoise-teal coastal shelf)
      if (shelfColor) {
        ctx.fillStyle = shelfColor;
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          const pt = points[i];
          const x = (pt[0] / 360) * width;
          const y = (pt[1] / 180) * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.lineWidth = 18;
        ctx.strokeStyle = shelfColor;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Core landmass
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const x = (pt[0] / 360) * width;
        const y = (pt[1] / 180) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };

    // --- CONTINENTAL LANDMASS DEFINITIONS (Equirectangular Degrees: X [0..360], Y [0..180]) ---
    // 0 deg longitude = 180 on X axis, 0 deg lat (equator) = 90 on Y axis

    // North America (Alaska, Canada, USA, Mexico, Baja)
    const northAmerica = [
      [30, 25], [55, 20], [80, 22], [95, 28], [115, 35], [110, 48],
      [100, 60], [92, 70], [84, 76], [80, 84], [87, 88], [94, 78],
      [104, 70], [118, 62], [114, 52], [108, 44], [100, 36], [82, 38],
      [72, 45], [60, 52], [48, 48], [40, 38], [30, 25]
    ];
    drawLandmass(northAmerica, '#162d1e');

    // Central America & Caribbean isthmus
    const centralAmerica = [
      [84, 76], [88, 82], [96, 92], [102, 98], [105, 96], [98, 88], [90, 80], [84, 76]
    ];
    drawLandmass(centralAmerica, '#12301b');

    // South America (Colombia, Brazil, Amazon, Andes, Patagonia)
    const southAmerica = [
      [102, 98], [118, 96], [130, 102], [145, 108], [142, 122], [132, 138],
      [122, 152], [115, 168], [110, 172], [106, 162], [108, 142], [104, 126],
      [98, 112], [96, 104], [102, 98]
    ];
    drawLandmass(southAmerica, '#112b18');

    // Greenland
    const greenland = [
      [125, 12], [140, 14], [152, 22], [145, 34], [132, 36], [122, 26], [125, 12]
    ];
    drawLandmass(greenland, '#dbebf7', 'rgba(120, 180, 220, 0.4)');

    // Eurasia (Europe, Russia, Siberia, China, SE Asia, India, Arabia)
    const eurasia = [
      [170, 48], [185, 38], [200, 34], [215, 30], [235, 26], [260, 24],
      [285, 28], [305, 35], [320, 42], [325, 54], [315, 62], [305, 74],
      [295, 88], [285, 96], [275, 102], [268, 92], [260, 84], [252, 74],
      [244, 82], [236, 94], [228, 86], [220, 78], [212, 70], [205, 78],
      [198, 70], [188, 64], [178, 58], [170, 48]
    ];
    drawLandmass(eurasia, '#183422');

    // British Isles & Scandinavia
    const britishIsles = [
      [174, 40], [180, 38], [182, 45], [176, 47], [174, 40]
    ];
    drawLandmass(britishIsles, '#1a3d24');

    // Africa (Sahara, Sahel, Congo, South Africa, Horn)
    const africa = [
      [175, 68], [195, 64], [212, 70], [220, 78], [232, 85], [236, 94],
      [228, 110], [220, 125], [212, 140], [200, 146], [192, 138], [186, 120],
      [178, 104], [168, 96], [162, 84], [168, 74], [175, 68]
    ];
    drawLandmass(africa, '#1f3520');

    // Madagascar
    const madagascar = [
      [226, 124], [230, 122], [232, 136], [228, 140], [226, 124]
    ];
    drawLandmass(madagascar, '#18341e');

    // Indian Subcontinent (Deccan & Indo-Gangetic)
    const india = [
      [244, 82], [258, 82], [264, 92], [256, 108], [252, 102], [248, 94], [244, 82]
    ];
    drawLandmass(india, '#1f3d26');

    // Australia & New Zealand
    const australia = [
      [294, 120], [314, 116], [330, 124], [336, 138], [328, 150], [312, 152],
      [298, 146], [290, 134], [294, 120]
    ];
    drawLandmass(australia, '#243a22');

    const newZealand = [
      [350, 145], [354, 142], [356, 154], [352, 156], [350, 145]
    ];
    drawLandmass(newZealand, '#183622');

    // Japan Archipelago
    const japan = [
      [315, 60], [320, 56], [324, 62], [318, 66], [315, 60]
    ];
    drawLandmass(japan, '#1c3d25');

    // Indonesia & Philippines island arcs
    const indonesia = [
      [275, 102], [288, 104], [302, 106], [312, 102], [304, 108], [286, 110], [275, 102]
    ];
    drawLandmass(indonesia, '#12331b');

    // 2. BIOME OVERLAYS (Deserts, Arid Steppes, Mountain Belts)
    // Sahara & Sahel Desert (North Africa)
    const sahara = [
      [170, 70], [195, 66], [212, 72], [220, 78], [215, 88], [195, 92], [172, 88], [168, 78], [170, 70]
    ];
    drawLandmass(sahara, '#785f36', null);

    // Arabian & Middle Eastern Deserts
    const arabia = [
      [218, 76], [232, 82], [235, 94], [224, 96], [218, 86], [218, 76]
    ];
    drawLandmass(arabia, '#87693b', null);

    // Gobi & Central Asian Deserts
    const gobi = [
      [260, 52], [285, 50], [298, 56], [288, 64], [264, 62], [260, 52]
    ];
    drawLandmass(gobi, '#665337', null);

    // Australian Outback (Red-ochre interior)
    const outback = [
      [300, 126], [320, 124], [326, 136], [320, 144], [304, 142], [298, 134], [300, 126]
    ];
    drawLandmass(outback, '#734426', null);

    // American Southwest & Atacama
    const swDesert = [
      [80, 55], [92, 54], [96, 64], [84, 68], [80, 55]
    ];
    drawLandmass(swDesert, '#6b5333', null);

    // 3. MOUNTAIN SYSTEMS (Himalayas, Andes, Rockies, Alps with snowy peaks)
    const mountainRanges = [
      // Himalayas & Tibetan Plateau
      { pts: [[250, 74], [265, 72], [282, 75], [292, 78]], w: 14, color: '#3d3834', snow: '#edf4fb' },
      // Andes (South American Western Spine)
      { pts: [[102, 100], [98, 114], [104, 130], [108, 148], [112, 168]], w: 10, color: '#403b36', snow: '#edf4fb' },
      // North American Rockies
      { pts: [[60, 35], [72, 45], [82, 58], [88, 70]], w: 12, color: '#423d38', snow: '#edf4fb' },
      // European Alps
      { pts: [[188, 52], [196, 50], [202, 54]], w: 8, color: '#443e39', snow: '#edf4fb' }
    ];

    mountainRanges.forEach(m => {
      // Base rock ridge
      ctx.strokeStyle = m.color;
      ctx.lineWidth = m.w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      m.pts.forEach((pt, idx) => {
        const x = (pt[0] / 360) * width;
        const y = (pt[1] / 180) * height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Jagged snow-caps
      ctx.strokeStyle = m.snow;
      ctx.lineWidth = m.w * 0.45;
      ctx.stroke();
    });

    // 4. NATURAL TOPOGRAPHICAL TEXTURE GRAIN (Procedural terrain realism pass)
    // Eliminates any flat vector feel with organic elevation speckles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let i = 0; i < 280; i++) {
      const rx = Math.random() * width;
      const ry = height * 0.16 + Math.random() * height * 0.68;
      const rw = 12 + Math.random() * 35;
      const rh = 6 + Math.random() * 16;
      ctx.fillRect(rx, ry, rw, rh);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let i = 0; i < 280; i++) {
      const rx = Math.random() * width;
      const ry = height * 0.16 + Math.random() * height * 0.68;
      const rw = 10 + Math.random() * 30;
      const rh = 5 + Math.random() * 14;
      ctx.fillRect(rx, ry, rw, rh);
    }

    // 5. POLAR ICE PACKS (High-Albedo Glaciers with Jagged Margins)
    // Arctic North Polar Cap
    const arcticGrad = ctx.createLinearGradient(0, 0, 0, height * 0.14);
    arcticGrad.addColorStop(0, '#f2f8fd');
    arcticGrad.addColorStop(0.75, 'rgba(235, 246, 255, 0.92)');
    arcticGrad.addColorStop(1, 'rgba(235, 246, 255, 0.0)');
    ctx.fillStyle = arcticGrad;
    ctx.fillRect(0, 0, width, height * 0.14);

    // Antarctica South Polar Continent (Vast southern ice sheet with ice shelves)
    const antarcticGrad = ctx.createLinearGradient(0, height * 0.84, 0, height);
    antarcticGrad.addColorStop(0, 'rgba(235, 246, 255, 0.0)');
    antarcticGrad.addColorStop(0.25, 'rgba(235, 246, 255, 0.92)');
    antarcticGrad.addColorStop(0.65, '#f4f9fd');
    antarcticGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = antarcticGrad;
    ctx.fillRect(0, height * 0.84, width, height * 0.16);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * NASA Black Marble style global city lights emissive map.
   * Illuminates the unlit night side of Earth with glowing golden metropolitan clusters.
   */
  static createEarthNightTexture(width = 2048, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Deep cosmic shadow baseline
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Major global metropolitan nodes (lon [-180..180], lat [-90..90], intensity, radius)
    const cities = [
      // North America
      { lon: -74, lat: 40.7, r: 32, i: 1.0 }, // New York / BosWash
      { lon: -71, lat: 42.3, r: 20, i: 0.9 }, // Boston
      { lon: -77, lat: 38.9, r: 24, i: 0.95 }, // Washington DC
      { lon: -87.6, lat: 41.8, r: 28, i: 0.95 }, // Chicago
      { lon: -83, lat: 42.3, r: 18, i: 0.8 }, // Detroit
      { lon: -118.2, lat: 34.0, r: 34, i: 1.0 }, // Los Angeles
      { lon: -122.4, lat: 37.7, r: 24, i: 0.9 }, // San Francisco
      { lon: -95.3, lat: 29.7, r: 24, i: 0.85 }, // Houston
      { lon: -96.8, lat: 32.7, r: 22, i: 0.85 }, // Dallas
      { lon: -80.2, lat: 25.7, r: 20, i: 0.8 }, // Miami / Florida
      { lon: -123.1, lat: 49.2, r: 16, i: 0.75 }, // Vancouver / Seattle

      // Western Europe & Mediterranean
      { lon: -0.1, lat: 51.5, r: 30, i: 1.0 }, // London
      { lon: 2.3, lat: 48.8, r: 28, i: 0.95 }, // Paris
      { lon: 4.8, lat: 52.3, r: 24, i: 0.9 }, // Benelux / Rhine-Ruhr
      { lon: 9.1, lat: 45.4, r: 22, i: 0.85 }, // Milan / Po Valley
      { lon: -3.7, lat: 40.4, r: 18, i: 0.8 }, // Madrid
      { lon: 13.4, lat: 52.5, r: 20, i: 0.85 }, // Berlin
      { lon: 12.5, lat: 41.9, r: 18, i: 0.8 }, // Rome

      // Middle East & Africa
      { lon: 31.2, lat: 30.0, r: 26, i: 0.95 }, // Cairo / Nile Delta
      { lon: 55.3, lat: 25.2, r: 22, i: 0.9 }, // Dubai / Persian Gulf
      { lon: 28.0, lat: -26.2, r: 18, i: 0.75 }, // Johannesburg
      { lon: 18.4, lat: -33.9, r: 14, i: 0.7 }, // Cape Town

      // South Asia
      { lon: 77.2, lat: 28.6, r: 34, i: 1.0 }, // New Delhi / Indo-Gangetic
      { lon: 72.8, lat: 18.9, r: 30, i: 1.0 }, // Mumbai
      { lon: 88.3, lat: 22.5, r: 26, i: 0.9 }, // Kolkata
      { lon: 77.5, lat: 12.9, r: 24, i: 0.9 }, // Bangalore
      { lon: 80.2, lat: 13.0, r: 22, i: 0.85 }, // Chennai

      // East & Southeast Asia
      { lon: 139.7, lat: 35.7, r: 42, i: 1.0 }, // Tokyo-Yokohama Mega-Core
      { lon: 135.5, lat: 34.7, r: 30, i: 0.95 }, // Osaka / Kyoto
      { lon: 126.9, lat: 37.5, r: 28, i: 0.95 }, // Seoul
      { lon: 121.4, lat: 31.2, r: 36, i: 1.0 }, // Shanghai / Yangtze Delta
      { lon: 116.4, lat: 39.9, r: 32, i: 0.95 }, // Beijing
      { lon: 113.2, lat: 23.1, r: 36, i: 1.0 }, // Pearl River Delta (Guangzhou, HK, Shenzhen)
      { lon: 100.5, lat: 13.7, r: 22, i: 0.85 }, // Bangkok
      { lon: 103.8, lat: 1.3, r: 20, i: 0.9 }, // Singapore
      { lon: 106.8, lat: -6.2, r: 24, i: 0.85 }, // Jakarta
      { lon: 120.9, lat: 14.6, r: 22, i: 0.85 }, // Manila

      // South America & Australia
      { lon: -46.6, lat: -23.5, r: 30, i: 0.95 }, // Sao Paulo
      { lon: -43.2, lat: -22.9, r: 24, i: 0.9 }, // Rio de Janeiro
      { lon: -58.4, lat: -34.6, r: 24, i: 0.85 }, // Buenos Aires
      { lon: -70.6, lat: -33.4, r: 18, i: 0.8 }, // Santiago
      { lon: 151.2, lat: -33.8, r: 24, i: 0.9 }, // Sydney
      { lon: 144.9, lat: -37.8, r: 22, i: 0.85 }, // Melbourne
      { lon: 153.0, lat: -27.4, r: 16, i: 0.8 } // Brisbane
    ];

    // Helper: Convert lat/long to canvas coordinates
    const toCoords = (lon, lat) => ({
      x: ((lon + 180) / 360) * width,
      y: ((90 - lat) / 180) * height
    });

    // 1. Draw interconnected arterial roadway corridors (golden transit filaments)
    const corridors = [
      [{ lon: -71, lat: 42.3 }, { lon: -74, lat: 40.7 }, { lon: -77, lat: 38.9 }], // BosWash
      [{ lon: -74, lat: 40.7 }, { lon: -87.6, lat: 41.8 }], // East-Midwest
      [{ lon: -118.2, lat: 34.0 }, { lon: -122.4, lat: 37.7 }], // California coast
      [{ lon: -0.1, lat: 51.5 }, { lon: 2.3, lat: 48.8 }, { lon: 4.8, lat: 52.3 }, { lon: 9.1, lat: 45.4 }], // Europe Blue Banana
      [{ lon: 31.2, lat: 30.0 }, { lon: 32.5, lat: 24.0 }], // Nile river corridor
      [{ lon: 77.2, lat: 28.6 }, { lon: 88.3, lat: 22.5 }], // Indo-Gangetic ribbon
      [{ lon: 116.4, lat: 39.9 }, { lon: 121.4, lat: 31.2 }, { lon: 113.2, lat: 23.1 }], // China coastal corridor
      [{ lon: 139.7, lat: 35.7 }, { lon: 135.5, lat: 34.7 }] // Tokaido corridor
    ];

    ctx.strokeStyle = 'rgba(255, 175, 65, 0.35)';
    ctx.lineWidth = 1.8;
    corridors.forEach(line => {
      ctx.beginPath();
      line.forEach((node, idx) => {
        const c = toCoords(node.lon, node.lat);
        if (idx === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
    });

    // 2. Draw city light clusters with realistic radiant bloom
    cities.forEach(city => {
      const { x, y } = toCoords(city.lon, city.lat);

      // Wide ambient atmospheric light pollution halo (warm amber)
      const grad = ctx.createRadialGradient(x, y, 1, x, y, city.r);
      grad.addColorStop(0, `rgba(255, 215, 120, ${0.95 * city.i})`);
      grad.addColorStop(0.3, `rgba(255, 175, 60, ${0.65 * city.i})`);
      grad.addColorStop(0.7, `rgba(255, 140, 30, ${0.25 * city.i})`);
      grad.addColorStop(1, 'rgba(255, 120, 20, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, city.r, 0, Math.PI * 2);
      ctx.fill();

      // Intense high-density metropolitan center core
      ctx.fillStyle = `rgba(255, 250, 230, ${0.98 * city.i})`;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.8, city.r * 0.16), 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Thousands of regional micro-settlements along coastlines and river valleys
    ctx.fillStyle = 'rgba(255, 195, 95, 0.75)';
    for (let s = 0; s < 450; s++) {
      const parent = cities[s % cities.length];
      const offsetLon = (Math.random() - 0.5) * 12;
      const offsetLat = (Math.random() - 0.5) * 8;
      const c = toCoords(parent.lon + offsetLon, parent.lat + offsetLat);
      ctx.fillRect(c.x, c.y, 1.2, 1.2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  /**
   * Elevation bump map providing topographical relief on the illuminated day terminator.
   */
  static createEarthBumpMap(width = 2048, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Ocean surface is mirror-smooth (zero elevation)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Helper: Draw elevation zones
    const drawElevation = (points, elevationHex, blurPx = 4) => {
      ctx.fillStyle = elevationHex;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const x = (pt[0] / 360) * width;
        const y = (pt[1] / 180) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };

    // Lowland continental base relief
    ctx.fillStyle = '#222222';
    // North America, South America, Eurasia, Africa, Australia
    ctx.fillRect(width * 0.08, height * 0.15, width * 0.32, height * 0.55);
    ctx.fillRect(width * 0.26, height * 0.52, width * 0.16, height * 0.42);
    ctx.fillRect(width * 0.46, height * 0.12, width * 0.48, height * 0.52);
    ctx.fillRect(width * 0.46, height * 0.36, width * 0.22, height * 0.46);
    ctx.fillRect(width * 0.80, height * 0.64, width * 0.16, height * 0.24);

    // High mountain ridges (Himalayas, Andes, Rockies, Alps)
    const ranges = [
      [[250, 74], [265, 72], [282, 75], [292, 78]], // Himalayas
      [[102, 100], [98, 114], [104, 130], [108, 148], [112, 168]], // Andes
      [[60, 35], [72, 45], [82, 58], [88, 70]], // Rockies
      [[188, 52], [196, 50], [202, 54]] // Alps
    ];

    ranges.forEach(r => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      r.forEach((pt, idx) => {
        const x = (pt[0] / 360) * width;
        const y = (pt[1] / 180) * height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  static createEarthCloudsTexture(width = 2048, height = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, width, height);

    // 1. Equatorial Intertropical Convergence Zone (ITCZ) convective bands
    for (let i = 0; i < 45; i++) {
      const cx = (i / 45) * width + (Math.sin(i * 1.8) * 35);
      const cy = height * 0.48 + Math.sin(i * 0.9) * height * 0.05;
      const rx = 35 + Math.random() * 65;
      const ry = 14 + Math.random() * 22;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
      grad.addColorStop(0.5, 'rgba(245, 250, 255, 0.24)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Realistic mid-latitude cyclonic spiral storm systems
    const cyclones = [
      { x: width * 0.22, y: height * 0.32, r: 120, dir: 1 },
      { x: width * 0.72, y: height * 0.28, r: 140, dir: 1 },
      { x: width * 0.42, y: height * 0.68, r: 130, dir: -1 },
      { x: width * 0.88, y: height * 0.65, r: 110, dir: -1 }
    ];

    cyclones.forEach(cyc => {
      for (let a = 0; a < 6; a++) {
        const armAngle = (a / 6) * Math.PI * 2;
        for (let step = 0; step < 18; step++) {
          const dist = 12 + step * (cyc.r / 18);
          const theta = armAngle + (cyc.dir * step * 0.22);
          const px = (cyc.x + Math.cos(theta) * dist + width) % width;
          const py = cyc.y + Math.sin(theta) * dist * 0.65;
          const r = 10 + step * 1.8;
          const alpha = (1 - step / 20) * 0.32;
          const grad = ctx.createRadialGradient(px, py, 1, px, py, r);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // 3. Diffuse wispy cirrus streaks across the globe
    for (let s = 0; s < 95; s++) {
      const sx = Math.random() * width;
      const sy = height * 0.14 + Math.random() * height * 0.72;
      const len = 45 + Math.random() * 130;
      const thick = 8 + Math.random() * 18;
      const angle = (Math.random() - 0.5) * 0.35;
      const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, len * 0.6);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
      grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(sx, sy, len, thick, angle, 0, Math.PI * 2);
      ctx.fill();

      // Wrap-around for seamless sphere texture
      if (sx + len > width) {
        ctx.beginPath();
        ctx.ellipse(sx - width, sy, len, thick, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  static createMarsTexture(width = 1024, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#752306');
    grad.addColorStop(0.5, '#a83c0d');
    grad.addColorStop(1, '#661c03');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(50, 16, 8, 0.5)';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width;
      const y = height * 0.18 + Math.random() * height * 0.64;
      const r = 25 + Math.random() * 85;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(250, 245, 240, 0.92)';
    ctx.beginPath();
    ctx.arc(width * 0.5, 0, 75, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width * 0.5, height, 60, Math.PI, 0);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  static createJupiterTexture(width = 1024, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const bands = [
      '#dfbf92', '#a85f2b', '#dab07a', '#873f13',
      '#d7b587', '#bf7339', '#e3c9a4', '#79330a',
      '#dfbf92', '#9d5423', '#e0c59e', '#8e4516'
    ];
    const bandHeight = height / bands.length;

    bands.forEach((color, idx) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, idx * bandHeight, width, bandHeight + 1);
    });

    for (let y = 0; y < height; y += 4) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(y * 0.08) * 0.07})`;
      ctx.fillRect(0, y, width, 2);
    }

    const spotX = width * 0.62;
    const spotY = height * 0.64;
    const spotGrad = ctx.createRadialGradient(spotX, spotY, 4, spotX, spotY, 48);
    spotGrad.addColorStop(0, '#c73c17');
    spotGrad.addColorStop(0.6, '#b53310');
    spotGrad.addColorStop(1, 'rgba(181, 51, 16, 0)');
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.ellipse(spotX, spotY, 54, 32, -0.08, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  static createSaturnTexture(width = 1024, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#947e58');
    grad.addColorStop(0.2, '#d6ba87');
    grad.addColorStop(0.4, '#e4cb9c');
    grad.addColorStop(0.6, '#d6ba87');
    grad.addColorStop(0.8, '#c2a167');
    grad.addColorStop(1, '#846e48');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 40; i++) {
      const y = (i / 40) * height;
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(255, 255, 255, 0.05)' : 'rgba(100, 75, 30, 0.07)';
      ctx.fillRect(0, y, width, height / 40);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  static createSaturnRingsTexture(width = 1024, height = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const ringGrad = ctx.createLinearGradient(0, 0, width, 0);
    ringGrad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
    ringGrad.addColorStop(0.05, 'rgba(195, 175, 140, 0.3)');
    ringGrad.addColorStop(0.25, 'rgba(225, 205, 165, 0.85)');
    ringGrad.addColorStop(0.55, 'rgba(240, 220, 180, 0.95)');
    ringGrad.addColorStop(0.58, 'rgba(10, 8, 5, 0.04)'); // Cassini Division
    ringGrad.addColorStop(0.64, 'rgba(10, 8, 5, 0.04)');
    ringGrad.addColorStop(0.66, 'rgba(215, 195, 160, 0.8)');
    ringGrad.addColorStop(0.90, 'rgba(180, 160, 130, 0.6)');
    ringGrad.addColorStop(0.94, 'rgba(0, 0, 0, 0)');
    ringGrad.addColorStop(0.96, 'rgba(160, 140, 115, 0.28)');
    ringGrad.addColorStop(1.00, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = ringGrad;
    ctx.fillRect(0, 0, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  static createSunTexture(width = 1024, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffaa11';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 300; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = 15 + Math.random() * 45;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, '#fff4cc');
      grad.addColorStop(0.4, '#ffc02e');
      grad.addColorStop(1, 'rgba(255, 120, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  static createGenericTexture(colorHex, band = false, width = 512, height = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, width, height);

    if (band) {
      for (let y = 0; y < height; y += 8) {
        ctx.fillStyle = (y % 16 === 0) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
        ctx.fillRect(0, y, width, 8);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }
}

/**
 * Custom GLSL Fresnel Atmospheric Rim Glow Shader
 * Dual-layer volumetric rim light producing authentic atmospheric grazing.
 */
export function createAtmosphereShader(glowColor = 0x5cc8ff, power = 3.6, intensity = 1.35) {
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 glowColor;
    uniform float power;
    uniform float intensity;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), power);
      gl_FragColor = vec4(glowColor, fresnel * intensity);
    }
  `;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      glowColor: { value: new THREE.Color(glowColor) },
      power: { value: power },
      intensity: { value: intensity }
    },
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
}

/**
 * 4-Tier Cosmological Starfield & Cosmic Dust System
 * Tier 1: 14,000 deep micro-stars
 * Tier 2: 2,500 spectral class colored stars (O, B, A, F, G, K, M)
 * Tier 3: 120 bright navigational beacons with diffraction twinkle
 * Tier 4: Volumetric drifting cosmic dust particles
 */
export function createCosmicStarfield(count = 14000, radius = 900) {
  const group = new THREE.Group();

  // Tier 1: Distant faint micro-stars (14,000 points)
  const geom1 = new THREE.BufferGeometry();
  const pos1 = new Float32Array(count * 3);
  const col1 = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * (0.75 + 0.25 * Math.random());

    pos1[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos1[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos1[i * 3 + 2] = r * Math.cos(phi);

    // Subtle brightness variation
    const b = 0.5 + Math.random() * 0.45;
    col1[i * 3] = b * 0.9;
    col1[i * 3 + 1] = b * 0.95;
    col1[i * 3 + 2] = b;
  }

  geom1.setAttribute('position', new THREE.BufferAttribute(pos1, 3));
  geom1.setAttribute('color', new THREE.BufferAttribute(col1, 3));

  const mat1 = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true
  });
  group.add(new THREE.Points(geom1, mat1));

  // Tier 2: Mid-field Spectral Stars (2,500 points)
  const count2 = 2500;
  const geom2 = new THREE.BufferGeometry();
  const pos2 = new Float32Array(count2 * 3);
  const col2 = new Float32Array(count2 * 3);

  for (let i = 0; i < count2; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * 0.85 * (0.6 + 0.4 * Math.random());

    pos2[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos2[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos2[i * 3 + 2] = r * Math.cos(phi);

    const spectralRand = Math.random();
    if (spectralRand > 0.88) {
      // Class O/B: Cyan-Blue (Hot young stars)
      col2[i * 3] = 0.60; col2[i * 3 + 1] = 0.82; col2[i * 3 + 2] = 1.0;
    } else if (spectralRand > 0.72) {
      // Class G/K: Warm Amber / Gold
      col2[i * 3] = 1.0; col2[i * 3 + 1] = 0.86; col2[i * 3 + 2] = 0.65;
    } else if (spectralRand > 0.62) {
      // Class M: Subtle Red Dwarf
      col2[i * 3] = 1.0; col2[i * 3 + 1] = 0.55; col2[i * 3 + 2] = 0.45;
    } else {
      // Class A/F: Pure White
      col2[i * 3] = 0.95; col2[i * 3 + 1] = 0.98; col2[i * 3 + 2] = 1.0;
    }
  }

  geom2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
  geom2.setAttribute('color', new THREE.BufferAttribute(col2, 3));

  const mat2 = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true
  });
  group.add(new THREE.Points(geom2, mat2));

  // Tier 3: Navigational Beacons (120 prominent stars)
  const count3 = 120;
  const geom3 = new THREE.BufferGeometry();
  const pos3 = new Float32Array(count3 * 3);
  const col3 = new Float32Array(count3 * 3);

  for (let i = 0; i < count3; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * 0.7 * Math.random() + 200;

    pos3[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos3[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos3[i * 3 + 2] = r * Math.cos(phi);

    col3[i * 3] = 0.85; col3[i * 3 + 1] = 0.95; col3[i * 3 + 2] = 1.0;
  }

  geom3.setAttribute('position', new THREE.BufferAttribute(pos3, 3));
  geom3.setAttribute('color', new THREE.BufferAttribute(col3, 3));

  const mat3 = new THREE.PointsMaterial({
    size: 4.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.98,
    sizeAttenuation: true
  });
  group.add(new THREE.Points(geom3, mat3));

  // Tier 4: Drifting Interstellar Dust Particles (350 points)
  const count4 = 350;
  const geom4 = new THREE.BufferGeometry();
  const pos4 = new Float32Array(count4 * 3);

  for (let i = 0; i < count4; i++) {
    pos4[i * 3] = (Math.random() - 0.5) * 80;
    pos4[i * 3 + 1] = (Math.random() - 0.5) * 80;
    pos4[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }

  geom4.setAttribute('position', new THREE.BufferAttribute(pos4, 3));
  const mat4 = new THREE.PointsMaterial({
    size: 2.0,
    color: 0x5cc8ff,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const dustPoints = new THREE.Points(geom4, mat4);
  group.add(dustPoints);
  group.userData = { dustPoints };

  return group;
}
