const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'data', 'Samferdsel_3207_Nordre_Follo_5973_NVDBVegnett_SOSI.sos');
const outputPath = path.join(__dirname, '..', 'data', 'nordre-follo-roads.json');

function sanitizeName(value) {
  return String(value || '')
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value) {
  return sanitizeName(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function utmToLatLon(easting, northing, zone = 33) {
  const a = 6378137;
  const e = 0.00669438;
  const e1 = (1 - Math.sqrt(1 - e)) / (1 + Math.sqrt(1 - e));
  const k0 = 0.9996;
  const x = easting - 500000;
  const y = northing;
  const M = y / k0;
  const mu = M / (a * (1 - e / 4 - 3 * e * e / 64 - 5 * e * e * e / 256));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
    + (1097 * e1 * e1 * e1 / 512) * Math.sin(6 * mu);
  const C1 = e1 * Math.cos(phi1) * Math.cos(phi1);
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e * Math.sin(phi1) * Math.sin(phi1));
  const R1 = a * (1 - e) / Math.pow(1 - e * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = x / (N1 * k0);
  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e1) * Math.pow(D, 4) / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e1 - 3 * C1 * C1) * Math.pow(D, 6) / 720
  );
  const lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e1 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(phi1);
  return {
    lng: ((lon * 180 / Math.PI) + ((zone - 1) * 6 - 180 + 3)) % 360 - 180,
    lat: lat * 180 / Math.PI,
  };
}

function parseSosiRoads(fileText) {
  const lines = fileText.split(/\r?\n/);
  const roadsByName = new Map();
  let currentObject = null;
  let currentName = null;
  let currentType = null;
  let collectingCoordinates = false;
  let currentCoordinates = [];
  let currentSectionType = null;
  let seenVeglenke = false;

  const sectionPattern = /^\.(PUNKT|KURVE|LINJE|FLATE)\s+.*:$/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const sectionMatch = line.match(sectionPattern);

    if (sectionMatch) {
      if (currentObject && currentObject.name && currentObject.points.length >= 2) {
        const key = normalizeName(currentObject.name);
        if (key) {
          const existing = roadsByName.get(key);
          if (existing) {
            existing.points.push(...currentObject.points);
            existing.count += 1;
          } else {
            roadsByName.set(key, {
              name: currentObject.name,
              points: currentObject.points,
              count: 1,
              type: currentObject.type || 'road',
            });
          }
        }
      }

      currentObject = null;
      currentName = null;
      currentType = null;
      collectingCoordinates = false;
      currentCoordinates = [];
      currentSectionType = sectionMatch[1];
      seenVeglenke = false;
      continue;
    }

    if (currentSectionType !== 'KURVE') {
      continue;
    }

    if (line.includes('..OBJTYPE')) {
      const objType = sanitizeName(line.replace('..OBJTYPE', '').trim());
      if (objType === 'Veglenke') {
        currentObject = { name: '', points: [], type: 'road' };
        seenVeglenke = true;
      } else {
        currentObject = null;
        seenVeglenke = false;
      }
      continue;
    }

    if (!seenVeglenke || !currentObject) {
      continue;
    }

    if (line.includes('...ADRESSENAVN')) {
      currentName = sanitizeName(line.replace('...ADRESSENAVN', '').trim());
      currentObject.name = currentName;
      continue;
    }

    if (line.includes('..TYPEVEG')) {
      currentType = sanitizeName(line.replace('..TYPEVEG', '').trim());
      currentObject.type = currentType || currentObject.type;
      continue;
    }

    if (line.includes('..NØH')) {
      collectingCoordinates = true;
      currentCoordinates = [];
      continue;
    }

    if (collectingCoordinates) {
      if (line.trim() && !line.startsWith('..') && !line.startsWith('.')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const northing = Number(parts[0]);
          const easting = Number(parts[1]);
          if (Number.isFinite(easting) && Number.isFinite(northing)) {
            const converted = utmToLatLon(easting / 100, northing / 100, 33);
            currentCoordinates.push([converted.lng, converted.lat]);
          }
        }
      } else if (line.startsWith('.')) {
        if (currentCoordinates.length) {
          currentObject.points = currentCoordinates.slice(0, 8);
        }
        collectingCoordinates = false;
      }
    }
  }

  if (currentObject && currentObject.name && currentObject.points.length >= 2) {
    const key = normalizeName(currentObject.name);
    if (key) {
      const existing = roadsByName.get(key);
      if (existing) {
        existing.points.push(...currentObject.points);
        existing.count += 1;
      } else {
        roadsByName.set(key, {
          name: currentObject.name,
          points: currentObject.points,
          count: 1,
          type: currentObject.type || 'road',
        });
      }
    }
  }

  return Array.from(roadsByName.values())
    .filter((road) => road.name && road.points.length >= 2)
    .map((road, index) => ({
      id: `nf-kartverket-${String(index + 1).padStart(3, '0')}`,
      name: road.name,
      type: road.type || 'road',
      municipality: 'Nordre Follo',
      geometry: road.points.slice(0, 8),
    }));
}

function main() {
  const text = fs.readFileSync(inputPath, 'utf8');
  const roads = parseSosiRoads(text);
  const payload = {
    municipality: 'Nordre Follo',
    source: 'kartverket-sosi',
    version: '1.0',
    roads,
  };
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${roads.length} roads to ${outputPath}`);
  if (roads.length) {
    console.log(JSON.stringify(roads.slice(0, 5), null, 2));
  }
}

main();
