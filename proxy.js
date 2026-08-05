const http = require('http');
const { URL } = require('url');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8000');

  if (url.pathname === '/proxy/nominatim') {
    const upstream = new URL('https://nominatim.openstreetmap.org/search');
    upstream.searchParams.set('format', 'jsonv2');
    upstream.searchParams.set('limit', url.searchParams.get('limit') || '6');
    upstream.searchParams.set('addressdetails', url.searchParams.get('addressdetails') || '1');
    upstream.searchParams.set('q', url.searchParams.get('q') || '');

    fetch(upstream.toString(), {
      headers: { 'Accept-Language': 'en' },
    })
      .then((response) => response.json())
      .then((data) => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(data));
      })
      .catch((error) => {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: error.message }));
      });
    return;
  }

  if (url.pathname === '/proxy/overpass') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body,
      })
        .then((response) => response.text())
        .then((text) => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(text);
        })
        .catch((error) => {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: error.message }));
        });
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(9000, '127.0.0.1');
