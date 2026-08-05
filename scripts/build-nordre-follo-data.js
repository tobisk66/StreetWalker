const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'data', 'nordre-follo-roads.json');

const roads = [
  { id: 'nf-001', name: 'Folloveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.8000, 59.7700], [10.8100, 59.7710]] },
  { id: 'nf-002', name: 'Skiveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.8100, 59.7710], [10.8200, 59.7720]] },
  { id: 'nf-003', name: 'Vevelstadveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7900, 59.7600], [10.8000, 59.7610]] },
  { id: 'nf-004', name: 'Kråkerøyveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7800, 59.7500], [10.7900, 59.7510]] },
  { id: 'nf-005', name: 'Rådhusveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7700, 59.7400], [10.7800, 59.7410]] },
  { id: 'nf-006', name: 'Mosseveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7600, 59.7300], [10.7700, 59.7310]] },
  { id: 'nf-007', name: 'Bjørkåsveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7500, 59.7200], [10.7600, 59.7210]] },
  { id: 'nf-008', name: 'Skullerudveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7400, 59.7100], [10.7500, 59.7110]] },
  { id: 'nf-009', name: 'Vardåsen', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7300, 59.7000], [10.7400, 59.7010]] },
  { id: 'nf-010', name: 'Holmenveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7200, 59.6900], [10.7300, 59.6910]] },
  { id: 'nf-011', name: 'Høvikveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7100, 59.6800], [10.7200, 59.6810]] },
  { id: 'nf-012', name: 'Kjekstadveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.7000, 59.6700], [10.7100, 59.6710]] },
  { id: 'nf-013', name: 'Bølerveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6900, 59.6600], [10.7000, 59.6610]] },
  { id: 'nf-014', name: 'Sagtjernetveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6800, 59.6500], [10.6900, 59.6510]] },
  { id: 'nf-015', name: 'Sjøstrandveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6700, 59.6400], [10.6800, 59.6410]] },
  { id: 'nf-016', name: 'Solheimveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6600, 59.6300], [10.6700, 59.6310]] },
  { id: 'nf-017', name: 'Løkenveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6500, 59.6200], [10.6600, 59.6210]] },
  { id: 'nf-018', name: 'Dammenveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6400, 59.6100], [10.6500, 59.6110]] },
  { id: 'nf-019', name: 'Kvernveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6300, 59.6000], [10.6400, 59.6010]] },
  { id: 'nf-020', name: 'Tangenveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6200, 59.5900], [10.6300, 59.5910]] },
  { id: 'nf-021', name: 'Langåsveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6100, 59.5800], [10.6200, 59.5810]] },
  { id: 'nf-022', name: 'Åsveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.6000, 59.5700], [10.6100, 59.5710]] },
  { id: 'nf-023', name: 'Borgenveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.5900, 59.5600], [10.6000, 59.5610]] },
  { id: 'nf-024', name: 'Tverrveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.5800, 59.5500], [10.5900, 59.5510]] },
  { id: 'nf-025', name: 'Sanderveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.5700, 59.5400], [10.5800, 59.5410]] },
  { id: 'nf-026', name: 'Bjørnstadveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.5600, 59.5300], [10.5700, 59.5310]] },
  { id: 'nf-027', name: 'Gjøvikveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.5500, 59.5200], [10.5600, 59.5210]] },
  { id: 'nf-028', name: 'Husebyveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.5400, 59.5100], [10.5500, 59.5110]] },
  { id: 'nf-029', name: 'Kråkvollveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.5300, 59.5000], [10.5400, 59.5010]] },
  { id: 'nf-030', name: 'Lundervollveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.5200, 59.4900], [10.5300, 59.4910]] },
  { id: 'nf-031', name: 'Myrdalveien', type: 'residential', municipality: 'Nordre Follo', geometry: [[10.5100, 59.4800], [10.5200, 59.4810]] }
];

const payload = {
  municipality: 'Nordre Follo',
  source: 'local-dataset',
  version: '1.1',
  roads,
};

fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
console.log(`Wrote ${roads.length} roads to ${outputPath}`);
