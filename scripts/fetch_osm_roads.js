const fs = require('fs');
const path = require('path');

const bboxList = [
  [10.65, 59.72, 10.78, 59.80],
  [10.78, 59.72, 10.90, 59.80],
  [10.65, 59.80, 10.90, 59.90],
  [10.65, 59.60, 10.90, 59.72],
  [10.90, 59.60, 11.05, 59.80],
];

const outputPath = path.join(__dirname, '..', 'data', 'nordre-follo-roads.json');

async function fetchBBox(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(`[out:json][timeout:90];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|track|path|footway|cycleway)$"](${minLat},${minLon},${maxLat},${maxLon}););out body;`)}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

async function main() {
  const allRoads = [];
  const seen = new Set();

  for (const bbox of bboxList) {
    const data = await fetchBBox(bbox);
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    for (const element of elements) {
      const name = element?.tags?.name || '';
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const geometry = Array.isArray(element?.geometry)
        ? element.geometry.map((point) => [Number(point.lon), Number(point.lat)])
        : [];
      allRoads.push({
        id: `osm-${allRoads.length + 1}`,
        name,
        type: element?.tags?.highway || 'unknown',
        municipality: 'Nordre Follo',
        geometry,
      });
    }
  }

  const payload = {
    municipality: 'Nordre Follo',
    source: 'osm-overpass',
    version: '1.0',
    roads: allRoads,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${allRoads.length} roads to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
