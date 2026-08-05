const http = require('http');
const https = require('https');
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

function requestUpstream(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const req = transport.request(parsedUrl, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 0, body });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
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
      const upstreamResponse = await requestUpstream(query.toString(), {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'walker-streets-proxy-test',
        },
      });
      if (upstreamResponse.statusCode >= 400) {
        throw new Error(`Nominatim returned ${upstreamResponse.statusCode}`);
      }

      let data;
      try {
        data = JSON.parse(upstreamResponse.body);
      } catch (parseError) {
        throw new Error(`Unable to parse Nominatim response: ${parseError.message}`);
      }

      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, { error: 'Unable to fetch place suggestions', details: error.message });
    }
    return;
  }

  if (url.pathname === '/proxy/overpass') {
    try {
      const bodyText = await readBody(req);
      const query = (bodyText || '').trim();
      const upstreamUrl = new URL('https://overpass-api.de/api/interpreter');
      if (query) {
        upstreamUrl.searchParams.set('data', query);
      }

      const upstreamResponse = await requestUpstream(upstreamUrl.toString(), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'text/plain; charset=utf-8',
          'User-Agent': 'walker-streets-proxy/1.0 (+https://streetwalker.onrender.com)',
        },
        body: query,
      });

      if (upstreamResponse.statusCode >= 400) {
        throw new Error(`Overpass returned ${upstreamResponse.statusCode}`);
      }

      const text = upstreamResponse.body;
      if (!text) {
        throw new Error('Upstream returned an empty response');
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          throw new Error(`Overpass returned HTML instead of JSON: ${text.slice(0, 160)}`);
        }
        throw parseError;
      }

      sendJson(res, 200, parsed);
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
