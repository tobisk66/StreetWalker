const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'data', 'Samferdsel_3207_Nordre_Follo_5973_NVDBVegnett_SOSI.sos');
const outputPath = path.join(__dirname, '..', 'data', 'nordre-follo-roads-from-kartverket.json');

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

function parseSosiRoadNames(fileText) {
  const lines = fileText.split(/\r?\n/);
  const results = [];
  let currentName = '';
  let currentType = '';
  let currentCoordinates = [];
  let collectingCoordinates = false;
  let currentSectionType = null;
  let objectType = null;
  let insideRoadObject = false;

  const sectionPattern = /^\.(PUNKT|KURVE|LINJE|FLATE)\s+.*:$/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const sectionMatch = line.match(sectionPattern);

    if (sectionMatch) {
      if (insideRoadObject && currentName && currentCoordinates.length >= 2) {
        results.push({
          name: currentName,
          type: currentType || objectType || 'road',
          geometry: currentCoordinates,
        });
      }

      currentName = '';
      currentType = '';
      currentCoordinates = [];
      collectingCoordinates = false;
      currentSectionType = sectionMatch[1];
      objectType = null;
      insideRoadObject = false;
      continue;
    }

    if (currentSectionType !== 'KURVE') {
      continue;
    }

    if (line.includes('..OBJTYPE')) {
      objectType = sanitizeName(line.replace('..OBJTYPE', '').trim());
      insideRoadObject = objectType === 'Veglenke';
      continue;
    }

    if (!insideRoadObject) {
      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith('...ADRESSENAVN')) {
      currentName = sanitizeName(trimmed.replace('...ADRESSENAVN', '').trim());
      continue;
    }

    if (trimmed.startsWith('..TYPEVEG')) {
      currentType = sanitizeName(trimmed.replace('..TYPEVEG', '').trim());
      continue;
    }

    if (trimmed.startsWith('..NØH')) {
      collectingCoordinates = true;
      currentCoordinates = [];
      continue;
    }

    if (collectingCoordinates) {
      if (trimmed && !trimmed.startsWith('..') && !trimmed.startsWith('.')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const first = Number(parts[0]);
          const second = Number(parts[1]);
          if (Number.isFinite(first) && Number.isFinite(second)) {
            currentCoordinates.push([first / 100000, second / 100000]);
          }
        }
      } else if (trimmed.startsWith('.')) {
        collectingCoordinates = false;
      }
    }
  }

  if (insideRoadObject && currentName && currentCoordinates.length >= 2) {
    results.push({
      name: currentName,
      type: currentType || objectType || 'road',
      geometry: currentCoordinates,
    });
  }

  return results;
}

function dedupeByName(records) {
  const map = new Map();
  for (const record of records) {
    const key = normalizeName(record.name);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, record);
    }
  }
  return Array.from(map.values());
}

function main() {
  const text = fs.readFileSync(inputPath, 'utf8');
  const parsed = dedupeByName(parseSosiRoadNames(text));
  const roads = parsed.map((record, index) => ({
    id: `nf-kv-${String(index + 1).padStart(3, '0')}`,
    name: record.name,
    type: record.type || 'residential',
    municipality: 'Nordre Follo',
    geometry: record.geometry.length >= 2 ? record.geometry.slice(0, 8) : [[10.79, 59.77], [10.792, 59.7708], [10.794, 59.7715]],
  }));

  const payload = {
    municipality: 'Nordre Follo',
    source: 'kartverket-sosi',
    version: '1.0',
    roads,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${roads.length} roads to ${outputPath}`);
  console.log(JSON.stringify(roads.slice(0, 10), null, 2));
}

main();
