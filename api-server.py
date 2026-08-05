import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

PORT = int(__import__('os').environ.get('PORT', '3001'))
HOST = __import__('os').environ.get('HOST', '0.0.0.0')

NORDRE_FOLLO_STREETS = [
    {"id": "nf-001", "name": "Folloveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-002", "name": "Skiveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-003", "name": "Vevelstadveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-004", "name": "Kråkerøyveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-005", "name": "Rådhusveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-006", "name": "Mosseveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-007", "name": "Bjørkåsveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-008", "name": "Skullerudveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-009", "name": "Vardåsen", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-010", "name": "Holmenveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-011", "name": "Høvikveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-012", "name": "Kjekstadveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-013", "name": "Bølerveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-014", "name": "Sagtjernetveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-015", "name": "Sjøstrandveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-016", "name": "Solheimveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-017", "name": "Løkenveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-018", "name": "Dammenveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-019", "name": "Kvernveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-020", "name": "Tangenveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-021", "name": "Langåsveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-022", "name": "Åsveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-023", "name": "Borgenveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-024", "name": "Tverrveien", "municipality": "Nordre Follo", "coverage": 0},
    {"id": "nf-025", "name": "Sanderveien", "municipality": "Nordre Follo", "coverage": 0},
]


class Handler(BaseHTTPRequestHandler):
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
            self._send_json(200, {"ok": True, "service": "streetwalker-test-api"})
            return
        if parsed.path == '/api/nordre-follo/streets':
            self._send_json(200, {"municipality": "Nordre Follo", "streets": NORDRE_FOLLO_STREETS})
            return
        if parsed.path == '/api/nordre-follo/streets/coverage':
            self._send_json(200, {"municipality": "Nordre Follo", "streets": NORDRE_FOLLO_STREETS})
            return
        self._send_json(404, {"error": "Not found"})


if __name__ == '__main__':
    server = HTTPServer((HOST, PORT), Handler)
    print(f'Test API listening on http://{HOST}:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
