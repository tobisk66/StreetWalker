const proxyBaseUrl = window.PROXY_BASE_URL || 'https://streetwalker.onrender.com';
const municipalityInput = document.getElementById('municipalityInput');
const municipalitySuggestions = document.getElementById('municipalitySuggestions');
const loadMunicipalityBtn = document.getElementById('loadMunicipalityBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const streetList = document.getElementById('streetList');
const municipalitySuggestionsList = document.getElementById('municipalitySuggestionsList');

const PAGE_SIZE = 25;
let currentMunicipalityResults = [];
let currentPage = 1;
let latestSuggestionRequest = 0;
let suggestionDebounceTimer = null;

const LOCAL_MUNICIPALITIES = [
  'Oslo',
  'Bergen',
  'Trondheim',
  'Stavanger',
  'Drammen',
  'Fredrikstad',
  'Skien',
  'Tromsø',
  'Kristiansand',
  'Alesund',
  'Hamar',
  'Narvik',
  'Bodø',
  'Arendal',
  'Lillestrøm',
  'Molde',
  'Moss',
  'Sandefjord',
  'Kongsberg',
  'Haugesund',
];

const FALLBACK_STREETS = {
  Oslo: ['Karl Johans gate', 'Storgata', 'Akersgata', 'Pilestredet', 'Biskop Gunnerus gate', 'Kirkeveien', 'Ullevålsveien', 'Torggata', 'Nobels gate', 'Østbanestredet', 'Grefsenveien', 'Sofienbergveien', 'Schweigaards gate', 'Rosenborgveien', 'Sinsenveien'],
  Bergen: ['Bryggen', 'Kong Oscars gate', 'Vetrlidsallmenningen', 'Strandsveien', 'Nordahl Griegsgate', 'Lille Øvregaten', 'Bergenhus', 'Fjellveien', 'Kalfarveien', 'Bergensgata'],
  Trondheim: ['Prinsens gate', 'Nordre gate', 'Olav Tryggvasons gate', 'Sverres gate', 'Elgeseter gate', 'Munkegaten', 'Fjordgata', 'Bakkeveien', 'Ladeveien', 'Dronningens gate'],
  Stavanger: ['Kirkegata', 'Stavangergata', 'Eiendomsveien', 'Sørmarkveien', 'Munkegata', 'Nedre Strandgate', 'Vålandsgata', 'Jåttåvågen', 'Østergata'],
  Drammen: ['Bragernes torg', 'Kirkegata', 'Nedre gate', 'Tollbodgata', 'Strømsø', 'Vestregate', 'Drammensveien', 'Bjørndalsveien'],
  Fredrikstad: ['Storgata', 'Østregata', 'Vestregata', 'Løkkevikveien', 'Kirkegata', 'Bakkeveien', 'Rådhusgata', 'Parkveien'],
  Skien: ['Storgata', 'Langesundsgate', 'Kirkegata', 'Tollbodgata', 'Høgskoleveien', 'Midtbyen', 'Jernbanegata'],
  Tromsø: ['Storgata', 'Sjøgata', 'Kirkegata', 'Prestegata', 'Nordre Tollbodgate', 'Sofies gate', 'Tromsøya'],
  Kristiansand: ['Storgata', 'Østregate', 'Vestregate', 'Markens gate', 'Kirkegata', 'Rådhusgata', 'Korsgata'],
  Alesund: ['Kirkegata', 'Brekkeveien', 'Søndre gate', 'Øvre gate', 'Nørvegen', 'Mørevegen'],
  Hamar: ['Storgata', 'Kirkegata', 'Torggata', 'Rådhusgata', 'Vestervegen', 'Guldsmedvegen', 'Nordre gate'],
  Narvik: ['Storgata', 'Kirkegata', 'Berggata', 'Tromsøgata', 'Fjellvegen', 'Rådhusgata'],
  Bodø: ['Storgata', 'Kirkegata', 'Torget', 'Kongsveien', 'Rådhusgata', 'Østergata', 'Havnegata'],
  Arendal: ['Kirkegata', 'Østregate', 'Torggata', 'Lilleveien', 'Bakkeveien', 'Nesetveien'],
  Lillestrøm: ['Storgata', 'Kirkegata', 'Kirkegaten', 'Rådhusgata', 'Brønnveien', 'Søndre gate'],
  Molde: ['Storgata', 'Kirkegata', 'Bakkeveien', 'Christiansundvegen', 'Rådhusgata'],
  Moss: ['Storgata', 'Kirkegata', 'Vestsiden', 'Torggata', 'Østregata', 'Sørbyen'],
  Sandefjord: ['Storgata', 'Kirkegata', 'Nedre gate', 'Tollbodgata', 'Rådhusgata'],
  Kongsberg: ['Storgata', 'Kirkegata', 'Torggata', 'Bergensgata', 'Nordagata'],
  Haugesund: ['Storgata', 'Kirkegata', 'Rådhusgata', 'Sørveien', 'Torggata', 'Nedre gate'],
};

function sanitizeQuery(text) {
  return text.replace(/['"`]/g, '').trim();
}

function getAllSavedWalkPoints() {
  return (saveHistory || []).flatMap((entry) => entry.points || []);
}

function computeStreetCoveragePercentage(points, streetCenter) {
  if (!streetCenter || !points.length) return 0;
  const centerPoint = { lat: Number(streetCenter.lat), lng: Number(streetCenter.lon) };
  const matchedPoints = points.filter((trackPoint) => haversineDistance(trackPoint, centerPoint) < 30);
  return Math.min(100, Math.round((matchedPoints.length / points.length) * 100));
}

function renderSuggestions(results) {
  municipalitySuggestions.innerHTML = '';
  municipalitySuggestionsList.innerHTML = '';

  if (!results.length) {
    municipalitySuggestionsList.classList.add('hidden');
    return;
  }

  municipalitySuggestionsList.classList.remove('hidden');

  results.slice(0, 8).forEach((place) => {
    const option = document.createElement('option');
    const displayName = typeof place === 'string' ? place : place.display_name;
    const suggestionText = displayName ? displayName.trim() : '';
    const shortName = suggestionText.split(',')[0].trim();
    option.value = shortName;
    municipalitySuggestions.appendChild(option);

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggestion-item';
    item.textContent = suggestionText;
    item.addEventListener('click', () => selectSuggestion(shortName));
    municipalitySuggestionsList.appendChild(item);
  });
}

function fetchMunicipalitySuggestions() {
  const municipalityName = sanitizeQuery(municipalityInput.value);
  if (!municipalityName) {
    municipalitySuggestions.innerHTML = '';
    municipalitySuggestionsList.innerHTML = '';
    municipalitySuggestionsList.classList.add('hidden');
    return;
  }

  const requestId = ++latestSuggestionRequest;

  fetch(`${proxyBaseUrl}/proxy/nominatim?format=jsonv2&limit=8&addressdetails=1&q=${encodeURIComponent(municipalityName)}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Search request failed');
      }
      return response.json();
    })
    .then((results) => {
      if (requestId !== latestSuggestionRequest) {
        return;
      }

      renderSuggestions(Array.isArray(results) ? results : []);
    })
    .catch(() => {
      if (requestId !== latestSuggestionRequest) {
        return;
      }
      municipalitySuggestions.innerHTML = '';
      municipalitySuggestionsList.innerHTML = '';
      municipalitySuggestionsList.classList.add('hidden');
    });
}

function scheduleSuggestionLookup() {
  if (suggestionDebounceTimer) {
    clearTimeout(suggestionDebounceTimer);
  }

  suggestionDebounceTimer = setTimeout(() => {
    fetchMunicipalitySuggestions();
  }, 180);
}

function hideSuggestionList() {
  municipalitySuggestionsList.classList.add('hidden');
}

function selectSuggestion(placeName) {
  municipalityInput.value = placeName;
  municipalitySuggestionsList.classList.add('hidden');
  loadMunicipalityStreetList();
}

function loadMunicipalityStreetList() {
  const municipalityName = sanitizeQuery(municipalityInput.value);
  if (!municipalityName) {
    streetList.innerHTML = '<div class="street-entry">Enter a municipality/city to load streets.</div>';
    return;
  }

  const walkedPoints = getAllSavedWalkPoints();
  const geocodeUrl = `${proxyBaseUrl}/proxy/nominatim?format=jsonv2&limit=1&q=${encodeURIComponent(municipalityName)}`;
  streetList.innerHTML = '<div class="street-entry">Loading streets…</div>';

  fetch(geocodeUrl)
    .then((response) => response.json())
    .then((results) => {
      if (!results.length) {
        const normalized = municipalityName.toLowerCase();
        const selected = LOCAL_MUNICIPALITIES.find((place) => place.toLowerCase() === normalized);
        if (selected && FALLBACK_STREETS[selected]) {
          const streetRows = FALLBACK_STREETS[selected].map((name) => ({
            name,
            percentage: 0,
          })).sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));

          currentMunicipalityResults = streetRows;
          currentPage = 1;
          renderStreetTable();
          return;
        }

        streetList.innerHTML = '<div class="street-entry">That municipality is not in the local test list yet. Try one of the suggested names like Oslo, Bergen, Trondheim, or Stavanger.</div>';
        return;
      }

      const bbox = results[0].boundingbox;
      const minLat = Number(bbox[0]);
      const maxLat = Number(bbox[1]);
      const minLng = Number(bbox[2]);
      const maxLng = Number(bbox[3]);
      const overpassQuery = `[out:json][timeout:25];(
        way["highway"](${minLat},${minLng},${maxLat},${maxLng});
        >;
      );
      out tags center;`;

      return fetch(`${proxyBaseUrl}/proxy/overpass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: overpassQuery,
      })
        .then((response) => response.json())
        .then((data) => {
          const elements = Array.isArray(data?.elements) ? data.elements : [];
          const streetRows = elements
            .filter((element) => element.type === 'way')
            .map((way) => ({
              name: way.tags?.name || 'Unnamed street',
              percentage: walkedPoints.length ? computeStreetCoveragePercentage(walkedPoints, way.center || way.geometry?.[0]) : 0,
            }))
            .sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));

          currentMunicipalityResults = streetRows;
          currentPage = 1;
          renderStreetTable();
        });
    })
    .catch((error) => {
      console.error('Unable to load municipality street list', error);
      const normalized = municipalityName.toLowerCase();
      const selected = LOCAL_MUNICIPALITIES.find((place) => place.toLowerCase() === normalized);
      if (selected && FALLBACK_STREETS[selected]) {
        const streetRows = FALLBACK_STREETS[selected].map((name) => ({
          name,
          percentage: 0,
        })).sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));

        currentMunicipalityResults = streetRows;
        currentPage = 1;
        renderStreetTable();
        return;
      }

      streetList.innerHTML = '<div class="street-entry">Street list could not be loaded. Try one of the suggested municipality names and try again.</div>';
    });
}

function renderStreetTable() {
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = currentMunicipalityResults.slice(start, end);

  pageInfo.textContent = `Page ${currentPage} of ${Math.max(1, Math.ceil(currentMunicipalityResults.length / PAGE_SIZE))}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= Math.ceil(currentMunicipalityResults.length / PAGE_SIZE);

  streetList.innerHTML = '';
  if (!pageItems.length) {
    streetList.innerHTML = '<div class="street-entry">No streets found.</div>';
    return;
  }

  pageItems.forEach((street) => {
    const entry = document.createElement('div');
    entry.className = 'street-entry';
    entry.innerHTML = `<strong>${street.name}</strong><span>${street.percentage}% walked</span>`;
    streetList.appendChild(entry);
  });
}

municipalityInput.addEventListener('input', scheduleSuggestionLookup);
municipalityInput.addEventListener('focus', () => {
  if (municipalityInput.value.trim()) {
    fetchMunicipalitySuggestions();
  }
});
municipalityInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    selectSuggestion(municipalityInput.value.trim());
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.search-box')) {
    hideSuggestionList();
  }
});
loadMunicipalityBtn.addEventListener('click', loadMunicipalityStreetList);
prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderStreetTable();
  }
});
nextPageBtn.addEventListener('click', () => {
  const maxPage = Math.ceil(currentMunicipalityResults.length / PAGE_SIZE);
  if (currentPage < maxPage) {
    currentPage += 1;
    renderStreetTable();
  }
});
