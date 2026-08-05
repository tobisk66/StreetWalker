const map = L.map('map').setView([51.5074, -0.1278], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const roadsLayer = L.layerGroup().addTo(map);
const trackingLayer = L.layerGroup().addTo(map);
const livePointLayer = L.layerGroup().addTo(map);

const toggleTrackingBtn = document.getElementById('toggleTrackingBtn');
const clearButton = document.getElementById('clearButton');
const gpsStatus = document.getElementById('gpsStatus');
const distanceValue = document.getElementById('distanceValue');
const matchedRoadsValue = document.getElementById('matchedRoadsValue');
const walkHistoryList = document.getElementById('walkHistoryList');

const STORAGE_KEY = 'walker-streets-history';
window.PROXY_BASE_URL = window.PROXY_BASE_URL || 'https://streetwalker.onrender.com';

let watchId = null;
let isTracking = false;
let trackPoints = [];
let roadFeatures = [];
let saveHistory = [];
let currentTrackLine = null;
let currentMarker = null;
let replayedRouteLayer = null;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistance(pointA, pointB) {
  const earthRadius = 6371000;
  const dLat = toRadians(pointB.lat - pointA.lat);
  const dLon = toRadians(pointB.lng - pointA.lng);
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function pointToSegmentDistance(point, a, b) {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) return haversineDistance(point, a);

  const t = ((point.lng - a.lng) * dx + (point.lat - a.lat) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const closest = {
    lng: a.lng + clampedT * dx,
    lat: a.lat + clampedT * dy,
  };
  return haversineDistance(point, closest);
}

function isTrackNearRoad(trackPoint, roadPoints) {
  for (let i = 0; i < roadPoints.length - 1; i += 1) {
    const a = { lat: roadPoints[i][1], lng: roadPoints[i][0] };
    const b = { lat: roadPoints[i + 1][1], lng: roadPoints[i + 1][0] };
    if (pointToSegmentDistance(trackPoint, a, b) < 25) {
      return true;
    }
  }
  return false;
}

function updateDistanceStats() {
  let totalDistance = 0;
  for (let i = 1; i < trackPoints.length; i += 1) {
    totalDistance += haversineDistance(trackPoints[i - 1], trackPoints[i]);
  }
  distanceValue.textContent = `${Math.round(totalDistance)} m`;
}

let deferredInstallPrompt = null;

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('Unable to register service worker', error);
    });
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

function loadWalkHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    saveHistory = raw ? JSON.parse(raw) : [];
  } catch (error) {
    saveHistory = [];
  }
}

function saveWalkHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saveHistory));
}

function renderHistory() {
  walkHistoryList.innerHTML = '';
  saveHistory.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'history-entry';
    card.innerHTML = `<strong>${new Date(entry.startedAt).toLocaleString()}</strong><span>${Math.round(entry.distance)} m</span>`;
    card.addEventListener('click', () => {
      if (replayedRouteLayer) {
        trackingLayer.removeLayer(replayedRouteLayer);
      }
      replayedRouteLayer = L.polyline(entry.points.map((point) => [point.lat, point.lng]), {
        color: '#2fbf71',
        weight: 6,
        opacity: 0.9,
      }).addTo(trackingLayer);
      map.fitBounds(replayedRouteLayer.getBounds());
    });
    walkHistoryList.appendChild(card);
  });
}

function updateLivePath() {
  if (currentTrackLine) {
    trackingLayer.removeLayer(currentTrackLine);
  }

  if (trackPoints.length < 2) {
    return;
  }

  currentTrackLine = L.polyline(trackPoints, {
    color: '#da5c5c',
    weight: 5,
    opacity: 0.95,
  }).addTo(trackingLayer);

  updateDistanceStats();
}

function refreshRoadStatus() {
  const matchedCount = roadFeatures.reduce((count, feature) => {
    const hasCloseTrack = trackPoints.some((trackPoint) => isTrackNearRoad(trackPoint, feature.points));
    return count + (hasCloseTrack ? 1 : 0);
  }, 0);

  matchedRoadsValue.textContent = String(matchedCount);

  roadsLayer.clearLayers();
  roadFeatures.forEach((feature) => {
    const isWalked = trackPoints.some((trackPoint) => isTrackNearRoad(trackPoint, feature.points));
    const color = isWalked ? '#2fbf71' : '#95a3ae';
    L.polyline(feature.points.map(([lng, lat]) => [lat, lng]), {
      color,
      weight: 6,
      opacity: 0.9,
    }).addTo(roadsLayer);
  });
}

function computeDistanceInMeters(points) {
  let totalDistance = 0;
  for (let i = 1; i < points.length; i += 1) {
    totalDistance += haversineDistance(points[i - 1], points[i]);
  }
  return totalDistance;
}

function stopTrackingAndSave() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
  }

  if (trackPoints.length > 1) {
    const matchedStreetIds = roadFeatures
      .filter((feature) => trackPoints.some((trackPoint) => isTrackNearRoad(trackPoint, feature.points)))
      .map((feature) => feature.id)
      .filter(Boolean);

    saveHistory.push({
      startedAt: new Date().toISOString(),
      points: [...trackPoints],
      distance: computeDistanceInMeters(trackPoints),
      matchedStreetIds,
    });
    saveWalkHistory();
    renderHistory();
  }

  pauseTracking();
  trackPoints = [];
  if (currentTrackLine) {
    trackingLayer.removeLayer(currentTrackLine);
    currentTrackLine = null;
  }
  if (currentMarker) {
    livePointLayer.removeLayer(currentMarker);
    currentMarker = null;
  }
  distanceValue.textContent = '0 m';
  matchedRoadsValue.textContent = '0';
  gpsStatus.textContent = 'Walk saved';
}

function drawRoadsInMap(bbox) {
  const minLat = bbox._southWest.lat;
  const minLng = bbox._southWest.lng;
  const maxLat = bbox._northEast.lat;
  const maxLng = bbox._northEast.lng;

  const query = `[out:json][timeout:25];(
    way["highway"](${minLat},${minLng},${maxLat},${maxLng});
    >;
  );
  out geom;`;

  fetch(`${window.PROXY_BASE_URL}/proxy/overpass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: query,
  })
    .then((response) => response.json())
    .then((data) => {
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      const nodes = new Map();
      elements.forEach((element) => {
        if (element.type === 'node') {
          nodes.set(element.id, [element.lon, element.lat]);
        }
      });

      roadFeatures = elements
        .filter((element) => element.type === 'way')
        .map((way) => ({
          id: way.id,
          name: way.tags?.name || 'Street',
          points: way.geometry
            .map((node) => nodes.get(node?.id || node) || [])
            .filter((point) => point.length === 2),
        }))
        .filter((feature) => feature.points.length > 1);

      refreshRoadStatus();
    })
    .catch((error) => {
      console.error('Unable to fetch public street list', error);
      gpsStatus.textContent = 'Street data unavailable';
    });
}

function setCurrentLocationMarker(position) {
  const latLng = { lat: position.coords.latitude, lng: position.coords.longitude };

  if (!currentMarker) {
    currentMarker = L.circleMarker([latLng.lat, latLng.lng], {
      color: '#1b6dc1',
      fillColor: '#4db0ff',
      fillOpacity: 0.8,
      radius: 6,
    }).addTo(livePointLayer);
  } else {
    currentMarker.setLatLng([latLng.lat, latLng.lng]);
  }

  if (trackPoints.length === 0 || haversineDistance(trackPoints[trackPoints.length - 1], latLng) > 10) {
    trackPoints.push(latLng);
    updateLivePath();
    refreshRoadStatus();
  }
}

function startTracking() {
  if (!navigator.geolocation) {
    gpsStatus.textContent = 'GPS not supported';
    return;
  }

  isTracking = true;
  toggleTrackingBtn.textContent = 'Stop walk';
  gpsStatus.textContent = 'Locating…';

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      gpsStatus.textContent = 'Tracking';
      setCurrentLocationMarker(position);
    },
    (error) => {
      gpsStatus.textContent = `GPS error: ${error.message}`;
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    }
  );
}

function pauseTracking() {
  isTracking = false;
  toggleTrackingBtn.textContent = 'Start walk';
  gpsStatus.textContent = 'Paused';
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
  }
}

function clearWalk() {
  trackPoints = [];
  if (currentTrackLine) {
    trackingLayer.removeLayer(currentTrackLine);
    currentTrackLine = null;
  }
  if (currentMarker) {
    livePointLayer.removeLayer(currentMarker);
    currentMarker = null;
  }
  distanceValue.textContent = '0 m';
  matchedRoadsValue.textContent = '0';
  refreshRoadStatus();
}

toggleTrackingBtn.addEventListener('click', () => {
  if (isTracking) {
    stopTrackingAndSave();
  } else {
    startTracking();
  }
});

clearButton.addEventListener('click', clearWalk);

map.on('moveend', () => {
  drawRoadsInMap(map.getBounds());
});

registerServiceWorker();
loadWalkHistory();
renderHistory();
map.locate({ setView: true, maxZoom: 16 });
drawRoadsInMap(map.getBounds());
