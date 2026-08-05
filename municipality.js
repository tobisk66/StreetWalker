const proxyBaseUrl = window.PROXY_BASE_URL || (typeof window !== 'undefined' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://127.0.0.1:3000'
  : 'https://streetwalker.onrender.com');
const testApiBaseUrl = 'http://127.0.0.1:3001';
const municipalityInput = document.getElementById('municipalityInput');
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
let nordreFolloRowsPromise = null;
let nordreFolloRowsCache = [];

const LOCAL_PLACE_SUGGESTIONS = ['Nordre Follo'];

function sanitizeQuery(text) {
  return text.replace(/['"`]/g, '').trim();
}

function normalizeStreetName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAllSavedWalkPoints() {
  return (saveHistory || []).flatMap((entry) => entry.points || []);
}

function computeStreetCoveragePercentage(points, streetCenter, streetId, savedEntries = []) {
  if (savedEntries.length && streetId != null) {
    const matchedWalks = savedEntries.filter((entry) => (entry.matchedStreetIds || []).some((id) => String(id) === String(streetId)));
    if (matchedWalks.length) {
      return Math.min(100, Math.round((matchedWalks.length / savedEntries.length) * 100));
    }
  }

  if (!streetCenter || !points.length) return 0;
  const centerPoint = { lat: Number(streetCenter.lat), lng: Number(streetCenter.lon) };
  const matchedPoints = points.filter((trackPoint) => haversineDistance(trackPoint, centerPoint) < 30);
  return Math.min(100, Math.round((matchedPoints.length / points.length) * 100));
}

function buildStreetRows(elements, walkedPoints, savedEntries = []) {
  const grouped = new Map();

  const ways = Array.isArray(elements)
    ? elements.filter((element) => element?.type === 'way')
    : [];

  ways.forEach((way) => {
    const rawName = way?.tags?.name || '';
    const normalizedName = normalizeStreetName(rawName);
    if (!normalizedName || normalizedName === 'unnamed street' || normalizedName === 'unnamed') {
      return;
    }

    const streetId = way?.id != null ? String(way.id) : null;
    const streetKey = streetId || normalizedName;
    const existing = grouped.get(streetKey);
    if (existing) {
      return;
    }

    let center = null;
    if (way?.center && typeof way.center === 'object') {
      center = way.center;
    } else if (Array.isArray(way?.geometry) && way.geometry.length) {
      const firstPoint = way.geometry[0];
      center = firstPoint?.lat != null && firstPoint?.lon != null
        ? { lat: firstPoint.lat, lon: firstPoint.lon }
        : null;
    }

    grouped.set(streetKey, {
      id: streetId,
      name: rawName,
      normalizedName,
      center,
      percentage: walkedPoints.length || savedEntries.length
        ? computeStreetCoveragePercentage(walkedPoints, center, streetId, savedEntries)
        : 0,
    });
  });

  return sortStreetRows(
    Array.from(grouped.values()).filter((street) => street.name && street.name !== 'Unnamed street')
  );
}

function sortStreetRows(rows) {
  return [...rows].sort((a, b) => {
    const aPercentage = Number(a.percentage) || 0;
    const bPercentage = Number(b.percentage) || 0;
    const aCovered = aPercentage > 0;
    const bCovered = bPercentage > 0;

    if (aCovered !== bCovered) {
      return aCovered ? -1 : 1;
    }

    if (aPercentage !== bPercentage) {
      return bPercentage - aPercentage;
    }

    const aName = String(a.name || '');
    const bName = String(b.name || '');
    const nameCompare = aName.localeCompare(bName, 'nb', { sensitivity: 'base' });
    if (nameCompare !== 0) {
      return nameCompare;
    }

    const aOrder = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return 0;
  });
}

function renderSuggestions(results) {
  municipalitySuggestionsList.innerHTML = '';

  const normalizedInput = sanitizeQuery(municipalityInput.value || '').toLowerCase();
  const fallbackSuggestions = normalizedInput.includes('nordre follo')
    ? [{ display_name: 'Nordre Follo' }]
    : [];
  const finalResults = (Array.isArray(results) ? results : []).length
    ? results
    : fallbackSuggestions;

  if (!finalResults.length) {
    municipalitySuggestionsList.classList.add('hidden');
    return;
  }

  municipalitySuggestionsList.classList.remove('hidden');

  finalResults.slice(0, 8).forEach((place) => {
    const displayName = typeof place === 'string' ? place : place?.display_name;
    const suggestionText = displayName ? displayName.trim() : '';
    const shortName = suggestionText.split(',')[0].trim();

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
    municipalitySuggestionsList.innerHTML = '';
    municipalitySuggestionsList.classList.add('hidden');
    return;
  }

  const requestId = ++latestSuggestionRequest;
  const localMatches = LOCAL_PLACE_SUGGESTIONS.filter((place) => place.toLowerCase().includes(municipalityName.toLowerCase())).slice(0, 8);

  if (localMatches.length) {
    renderSuggestions(localMatches.map((place) => ({ display_name: place })));
  }

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

      const remoteResults = Array.isArray(results)
        ? results.filter((place, index, list) => {
            const displayName = typeof place === 'string' ? place : place?.display_name;
            const key = (displayName || '').trim().toLowerCase();
            return key && list.findIndex((candidate) => {
              const candidateName = typeof candidate === 'string' ? candidate : candidate?.display_name;
              return (candidateName || '').trim().toLowerCase() === key;
            }) === index;
          })
        : [];

      const suggestions = [
        ...localMatches.map((place) => ({ display_name: place })),
        ...remoteResults,
      ];

      const uniqueResults = suggestions.filter((place, index, list) => {
        const displayName = typeof place === 'string' ? place : place?.display_name;
        const key = (displayName || '').trim().toLowerCase();
        return key && list.findIndex((candidate) => {
          const candidateName = typeof candidate === 'string' ? candidate : candidate?.display_name;
          return (candidateName || '').trim().toLowerCase() === key;
        }) === index;
      });

      renderSuggestions(uniqueResults);
    })
    .catch(() => {
      if (requestId !== latestSuggestionRequest) {
        return;
      }
      renderSuggestions(localMatches.map((place) => ({ display_name: place })));
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

function autoLoadNordreFolloIfNeeded() {
  const value = sanitizeQuery(municipalityInput.value || '').toLowerCase();
  if (value.includes('nordre follo')) {
    loadMunicipalityStreetList();
  }
}

async function loadLocalNordreFolloRows(savedEntries = []) {
  if (nordreFolloRowsPromise) {
    return nordreFolloRowsPromise;
  }

  const datasetCandidates = [
    './data/nordre-follo-roads-complete.json',
  ];

  nordreFolloRowsPromise = (async () => {
    for (const datasetPath of datasetCandidates) {
      try {
        const response = await fetch(datasetPath, { cache: 'no-store' });
        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        const roads = Array.isArray(data?.roads) ? data.roads : [];
        const rows = roads
          .map((road, index) => {
            const geometry = Array.isArray(road?.geometry) ? road.geometry : [];
            const firstPoint = geometry[0] || [];
            const center = firstPoint.length >= 2 ? { lat: Number(firstPoint[1]), lon: Number(firstPoint[0]) } : null;
            const name = typeof road?.name === 'string' ? road.name.trim() : '';
            return {
              id: road?.id || `nf-${String(index + 1).padStart(3, '0')}`,
              name,
              percentage: savedEntries.length ? computeStreetCoveragePercentage([], center, road?.id, savedEntries) : 0,
              sortOrder: index,
              center,
            };
          })
          .filter((street) => Boolean(street.name));

        if (rows.length) {
          nordreFolloRowsCache = sortStreetRows(rows);
          return nordreFolloRowsCache;
        }
      } catch (error) {
        console.warn(`Unable to load local Nordre Follo dataset ${datasetPath}`, error);
      }
    }

    console.error('Unable to load local Nordre Follo road data');
    nordreFolloRowsCache = [];
    return [];
  })();

  return nordreFolloRowsPromise;
}

async function loadMunicipalityStreetList() {
  const municipalityName = sanitizeQuery(municipalityInput.value);
  if (!municipalityName) {
    streetList.innerHTML = '<div class="street-entry">Enter a municipality/city to load streets.</div>';
    return;
  }

  const walkedPoints = getAllSavedWalkPoints();
  const normalized = municipalityName.toLowerCase();

  if (normalized.includes('nordre follo')) {
    streetList.innerHTML = '<div class="street-entry">Loading local road dataset…</div>';

    const savedEntries = Array.isArray(saveHistory) ? saveHistory : [];
    const rows = await loadLocalNordreFolloRows(savedEntries);
    if (rows.length) {
      currentMunicipalityResults = rows;
      currentPage = 1;
      renderStreetTable();
      return;
    }

    currentMunicipalityResults = [];
    currentPage = 1;
    streetList.innerHTML = '<div class="street-entry">No streets were loaded from the local dataset.</div>';
    return;
  }

  currentMunicipalityResults = [];
  currentPage = 1;
  streetList.innerHTML = '<div class="street-entry">No local street dataset is available for this place.</div>';
  return;

  const geocodeUrl = `${proxyBaseUrl}/proxy/nominatim?format=jsonv2&limit=1&q=${encodeURIComponent(municipalityName)}`;
  streetList.innerHTML = '<div class="street-entry">Loading streets…</div>';

  fetch(geocodeUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }
      return response.json();
    })
    .then((results) => {
      if (!Array.isArray(results) || !results.length) {
        const fallbackRows = getFallbackStreetRows(municipalityName, walkedPoints, Array.isArray(saveHistory) ? saveHistory : []);
        if (fallbackRows.length) {
          currentMunicipalityResults = fallbackRows;
          currentPage = 1;
          renderStreetTable();
          return;
        }

        streetList.innerHTML = '<div class="street-entry">No place match was found for that municipality name.</div>';
        return;
      }

      const bbox = results[0].boundingbox;
      const minLat = Number(bbox[0]);
      const maxLat = Number(bbox[1]);
      const minLng = Number(bbox[2]);
      const maxLng = Number(bbox[3]);
      const overpassQuery = `[out:json][timeout:60];(
        way["highway"]["name"](${minLat},${minLng},${maxLat},${maxLng});
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
        .then(async (response) => {
          const text = await response.text();
          let data = null;
          try {
            data = JSON.parse(text);
          } catch (error) {
            console.error('Overpass response was not valid JSON', error, text);
            throw error;
          }
          return data;
        })
        .then((data) => {
          const elements = Array.isArray(data?.elements) ? data.elements : [];
          const savedEntries = Array.isArray(saveHistory) ? saveHistory : [];
          const streetRows = buildStreetRows(elements, walkedPoints, savedEntries);

          if (streetRows.length) {
            currentMunicipalityResults = streetRows;
            currentPage = 1;
            renderStreetTable();
            return;
          }

          currentMunicipalityResults = [];
          currentPage = 1;
          streetList.innerHTML = '<div class="street-entry">No streets were loaded from the local dataset.</div>';
        });
    })
    .catch((error) => {
      console.error('Unable to load municipality street list', error);
      currentMunicipalityResults = [];
      currentPage = 1;
      streetList.innerHTML = '<div class="street-entry">Street list could not be loaded because no local dataset is configured for this place.</div>';
    });
}

function renderStreetTable() {
  const rows = Array.isArray(currentMunicipalityResults) ? currentMunicipalityResults : [];
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = rows.slice(start, end);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${rows.length} streets)`;
  }
  if (prevPageBtn) {
    prevPageBtn.disabled = currentPage === 1;
  }
  if (nextPageBtn) {
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  if (streetList) {
    streetList.innerHTML = '';
  }
  if (!pageItems.length) {
    if (streetList) {
      streetList.innerHTML = '<div class="street-entry">No streets found.</div>';
    }
    return;
  }

  pageItems.forEach((street) => {
    const entry = document.createElement('div');
    entry.className = 'street-entry';
    entry.innerHTML = `<strong>${(street && street.name) || 'Unnamed street'}</strong><span>${street && street.percentage != null ? street.percentage : 0}% walked</span>`;
    if (streetList) {
      streetList.appendChild(entry);
    }
  });
}

window.renderStreetTable = renderStreetTable;

async function initializeMunicipalityView() {
  municipalityInput.value = 'Nordre Follo';
  streetList.innerHTML = '<div class="street-entry">Loading local road dataset…</div>';

  try {
    const rows = await loadLocalNordreFolloRows([]);
    currentMunicipalityResults = Array.isArray(rows) ? rows : [];
    currentPage = 1;
    renderStreetTable();
  } catch (error) {
    console.error('Unable to load the local Nordre Follo dataset', error);
    currentMunicipalityResults = [];
    currentPage = 1;
    streetList.innerHTML = '<div class="street-entry">No streets were loaded from the local dataset.</div>';
  }
}

window.initializeMunicipalityView = initializeMunicipalityView;
window.loadMunicipalityStreetList = loadMunicipalityStreetList;
window.renderStreetTable = renderStreetTable;

window.addEventListener('load', () => {
  initializeMunicipalityView();
});

initializeMunicipalityView();

municipalityInput.addEventListener('input', () => {
  scheduleSuggestionLookup();
  autoLoadNordreFolloIfNeeded();
});
municipalityInput.addEventListener('focus', () => {
  if (municipalityInput.value.trim()) {
    fetchMunicipalitySuggestions();
    autoLoadNordreFolloIfNeeded();
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
