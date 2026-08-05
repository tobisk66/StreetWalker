const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (url.pathname === '/proxy/nominatim') {
    const query = new URL('https://nominatim.openstreetmap.org/search');
    query.searchParams.set('format', 'jsonv2');
    query.searchParams.set('limit', url.searchParams.get('limit') || '8');
    query.searchParams.set('addressdetails', url.searchParams.get('addressdetails') || '1');
    query.searchParams.set('q', url.searchParams.get('q') || '');

    try {
      const upstreamResponse = await fetch(query.toString(), {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'walker-streets-proxy-test',
        },
      });
      const data = await upstreamResponse.json();
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, { error: 'Unable to fetch place suggestions', details: error.message });
    }
    return;
  }

  if (url.pathname === '/proxy/overpass') {
    try {
      const bodyText = await readBody(req);
      const upstreamResponse = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: bodyText,
      });
      const text = await upstreamResponse.text();
      sendJson(res, 200, JSON.parse(text));
    } catch (error) {
      sendJson(res, 500, { error: 'Unable to fetch street data', details: error.message });
    }
    return;
  }

  if (url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'walker-streets-proxy' });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Proxy server is listening on http://${HOST}:${PORT}`);
});
