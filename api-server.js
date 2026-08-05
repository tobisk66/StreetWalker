const http = require('http');
const { URL } = require('url');
const { nordreFolloStreets } = require('./nordre-follo-data');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
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

  if (url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'streetwalker-test-api' });
    return;
  }

  if (url.pathname === '/api/nordre-follo/streets') {
    sendJson(res, 200, { municipality: 'Nordre Follo', streets: nordreFolloStreets });
    return;
  }

  if (url.pathname === '/api/nordre-follo/streets/coverage') {
    sendJson(res, 200, { municipality: 'Nordre Follo', streets: nordreFolloStreets });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Test API listening on http://${HOST}:${PORT}`);
});
