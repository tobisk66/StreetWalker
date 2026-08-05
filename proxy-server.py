import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen

PORT = int(os.environ.get('PORT', '3000'))
HOST = os.environ.get('HOST', '0.0.0.0')


class ProxyHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/health':
            self._send_json(200, {'ok': True, 'service': 'walker-streets-proxy'})
            return

        if parsed.path == '/proxy/nominatim':
            params = parse_qs(parsed.query)
            q = params.get('q', [''])[0]
            limit = params.get('limit', ['8'])[0]
            addressdetails = params.get('addressdetails', ['1'])[0]
            upstream_url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=' + limit + '&addressdetails=' + addressdetails + '&q=' + q
            req = Request(upstream_url, headers={'Accept-Language': 'en', 'User-Agent': 'walker-streets-proxy-test'})
            try:
                with urlopen(req, timeout=30) as resp:
                    data = json.load(resp)
                self._send_json(200, data)
            except Exception as exc:
                self._send_json(500, {'error': 'Unable to fetch place suggestions', 'details': str(exc)})
            return

        self._send_json(404, {'error': 'Not found'})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/proxy/overpass':
            self._send_json(404, {'error': 'Not found'})
            return

        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length).decode('utf-8') if length else ''
        query = body.strip()
        upstream_url = 'https://overpass-api.de/api/interpreter'
        req = Request(upstream_url, data=query.encode('utf-8'), headers={'Accept': 'application/json', 'Content-Type': 'text/plain; charset=utf-8', 'User-Agent': 'walker-streets-proxy/1.0'}, method='POST')
        try:
            with urlopen(req, timeout=60) as resp:
                text = resp.read().decode('utf-8')
            data = json.loads(text)
            self._send_json(200, data)
        except Exception as exc:
            self._send_json(500, {'error': 'Unable to fetch street data', 'details': str(exc)})


if __name__ == '__main__':
    server = HTTPServer((HOST, PORT), ProxyHandler)
    print(f'Proxy server listening on http://{HOST}:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
