import json
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

HOST = '127.0.0.1'
PORT = 3000

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/health':
            self.send_json(200, {'ok': True, 'service': 'osm-proxy'})
            return
        if parsed.path == '/proxy/nominatim':
            params = parse_qs(parsed.query)
            q = params.get('q', [''])[0]
            if not q:
                self.send_json(400, {'error': 'missing q'})
                return
            url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=' + urllib.parse.quote(q)
            req = urllib.request.Request(url, headers={'User-Agent': 'walker-streets-proxy/1.0'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode('utf-8')
                self.send_json(200, json.loads(body))
            return
        if parsed.path == '/proxy/overpass':
            params = parse_qs(parsed.query)
            data = params.get('data', [''])[0]
            if not data:
                self.send_json(400, {'error': 'missing data'})
                return
            url = 'https://overpass-api.de/api/interpreter?data=' + urllib.parse.quote(data)
            req = urllib.request.Request(url, headers={'User-Agent': 'walker-streets-proxy/1.0'})
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = resp.read().decode('utf-8')
                self.send_json(200, json.loads(body))
            return
        self.send_json(404, {'error': 'not found'})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/proxy/overpass':
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length).decode('utf-8')
            url = 'https://overpass-api.de/api/interpreter?data=' + urllib.parse.quote(body)
            req = urllib.request.Request(url, headers={'User-Agent': 'walker-streets-proxy/1.0'})
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = resp.read().decode('utf-8')
                self.send_json(200, json.loads(payload))
            return
        self.send_json(404, {'error': 'not found'})

    def send_json(self, status_code, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == '__main__':
    httpd = HTTPServer((HOST, PORT), Handler)
    print('osm proxy listening on http://127.0.0.1:3000')
    httpd.serve_forever()
