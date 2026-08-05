import json
import math
import re
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / 'data' / 'Samferdsel_3207_Nordre_Follo_5973_NVDBVegnett_SOSI.sos'
OUTPUT_PATH = ROOT / 'data' / 'nordre-follo-roads-complete.json'

SECTION_PATTERN = re.compile(r'^\.(PUNKT|KURVE|LINJE|FLATE)\s+.*:$')


def sanitize_name(value):
    return str(value or '').strip().replace('"', '').replace("'", '').replace('\t', ' ').strip()


def normalize_name(value):
    return re.sub(r'[^a-z0-9]+', ' ', sanitize_name(value).lower()).strip()


def utm_to_latlon(easting, northing, zone=33):
    a = 6378137.0
    e = 0.00669438
    e1 = (1 - math.sqrt(1 - e)) / (1 + math.sqrt(1 - e))
    k0 = 0.9996
    x = easting - 500000.0
    y = northing
    M = y / k0
    mu = M / (a * (1 - e / 4 - 3 * e * e / 64 - 5 * e * e * e / 256))
    phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * math.sin(4 * mu) + (1097 * e1 * e1 * e1 / 512) * math.sin(6 * mu)
    C1 = e1 * math.cos(phi1) ** 2
    T1 = math.tan(phi1) ** 2
    N1 = a / math.sqrt(1 - e * math.sin(phi1) ** 2)
    R1 = a * (1 - e) / (1 - e * math.sin(phi1) ** 2) ** 1.5
    D = x / (N1 * k0)
    lat = phi1 - (N1 * math.tan(phi1) / R1) * (
        D * D / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e1) * D ** 4 / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e1 - 3 * C1 * C1) * D ** 6 / 720
    )
    lon = (
        D
        - (1 + 2 * T1 + C1) * D ** 3 / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e1 + 24 * T1 * T1) * D ** 5 / 120
    ) / math.cos(phi1)
    lon_deg = (lon * 180 / math.pi) + ((zone - 1) * 6 - 180 + 3)
    lat_deg = lat * 180 / math.pi
    return {
        'lng': ((lon_deg % 360) + 360) % 360 - 180,
        'lat': lat_deg,
    }


def parse_sosi_roads(path):
    lines = path.read_text(encoding='utf-8').splitlines()
    roads = OrderedDict()

    current_section = None
    current_object_type = None
    current_name = None
    current_type = 'road'
    current_points = []
    collecting_coords = False
    seen_veglenke = False

    def finalize_current():
        nonlocal current_object_type, current_name, current_type, current_points, collecting_coords, seen_veglenke
        if current_object_type == 'Veglenke' and current_name and len(current_points) >= 2:
            key = normalize_name(current_name)
            if key and key not in roads:
                roads[key] = {
                    'name': sanitize_name(current_name),
                    'type': sanitize_name(current_type) or 'road',
                    'geometry': current_points[:8],
                }
        current_object_type = None
        current_name = None
        current_type = 'road'
        current_points = []
        collecting_coords = False
        seen_veglenke = False

    for line in lines:
        section_match = SECTION_PATTERN.match(line)
        if section_match:
            finalize_current()
            current_section = section_match.group(1)
            continue

        if current_section != 'KURVE':
            continue

        if line.startswith('..OBJTYPE'):
            obj_type = sanitize_name(line.replace('..OBJTYPE', '').strip())
            if obj_type == 'Veglenke':
                current_object_type = 'Veglenke'
                current_name = None
                current_type = 'road'
                current_points = []
                collecting_coords = False
                seen_veglenke = True
            else:
                current_object_type = None
                current_name = None
                current_type = 'road'
                current_points = []
                collecting_coords = False
                seen_veglenke = False
            continue

        if not seen_veglenke or current_object_type != 'Veglenke':
            continue

        if line.startswith('...ADRESSENAVN'):
            current_name = sanitize_name(line.replace('...ADRESSENAVN', '').strip())
            continue

        if line.startswith('..TYPEVEG'):
            current_type = sanitize_name(line.replace('..TYPEVEG', '').strip()) or 'road'
            continue

        if line.startswith('..NØH'):
            collecting_coords = True
            current_points = []
            continue

        if collecting_coords:
            if line.strip() and not line.startswith('..') and not line.startswith('.'):
                parts = line.strip().split()
                if len(parts) >= 3:
                    try:
                        northing = float(parts[0])
                        easting = float(parts[1])
                        converted = utm_to_latlon(easting / 100.0, northing / 100.0, 33)
                        current_points.append([converted['lng'], converted['lat']])
                    except ValueError:
                        pass
            elif line.startswith('.'):
                collecting_coords = False

    finalize_current()

    road_entries = []
    for road in roads.values():
        if len(road['geometry']) >= 2 and road['name']:
            road_entries.append({
                'id': f"nf-kartverket-{len(road_entries) + 1:03d}",
                'name': road['name'],
                'type': road['type'],
                'municipality': 'Nordre Follo',
                'geometry': road['geometry'],
            })

    return road_entries


def main():
    roads = parse_sosi_roads(INPUT_PATH)
    payload = {
        'municipality': 'Nordre Follo',
        'source': 'kartverket-sosi',
        'version': '2.0',
        'roads': roads,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(roads)} roads to {OUTPUT_PATH}')
    if roads:
        print('Sample:', json.dumps(roads[:10], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
