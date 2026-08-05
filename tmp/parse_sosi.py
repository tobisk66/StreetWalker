import re
from pathlib import Path

input_path = Path(r"C:\Users\tobis\walker-app\data\Samferdsel_3207_Nordre_Follo_5973_NVDBVegnett_SOSI.sos")
out_path = Path(r"C:\Users\tobis\walker-app\tmp\parsed_roads.json")

text = input_path.read_text(encoding='utf-8')
lines = text.splitlines()

roads = []
current = None
current_name = None
current_type = None
collecting = False
coords = []
seen_veglenke = False
section_pattern = re.compile(r'^\.(PUNKT|KURVE|LINJE|FLATE)\s+.*:$')

for line in lines:
    m = section_pattern.match(line)
    if m:
        if current and current_name and len(current.get('points', [])) >= 2:
            roads.append({
                'name': current_name,
                'type': current_type or 'road',
                'points': current['points'],
            })
        current = None
        current_name = None
        current_type = None
        collecting = False
        coords = []
        seen_veglenke = False
        continue

    if line.startswith('.OBJTYPE'):
        obj_type = line.replace('.OBJTYPE', '').strip()
        if obj_type == 'Veglenke':
            current = {'points': []}
            seen_veglenke = True
        else:
            current = None
            seen_veglenke = False
        continue

    if not seen_veglenke or not current:
        continue

    if 'ADRESSENAVN' in line:
        current_name = line.replace('...ADRESSENAVN', '').strip()
        continue

    if '..TYPEVEG' in line:
        current_type = line.replace('..TYPEVEG', '').strip() or 'road'
        continue

    if '..NØH' in line:
        collecting = True
        coords = []
        continue

    if collecting:
        if line.strip() and not line.startswith('..') and not line.startswith('.'):
            parts = line.strip().split()
            if len(parts) >= 3:
                try:
                    northing = float(parts[0])
                    easting = float(parts[1])
                    if easting and northing:
                        current['points'].append([easting / 100, northing / 100])
                except ValueError:
                    pass
        elif line.startswith('.'):
            collecting = False

if current and current_name and len(current.get('points', [])) >= 2:
    roads.append({'name': current_name, 'type': current_type or 'road', 'points': current['points']})

# Deduplicate by normalized name
seen = {}
for item in roads:
    key = re.sub(r'[^a-z0-9]+', ' ', item['name'].lower()).strip()
    if not key:
        continue
    if key not in seen:
        seen[key] = item

final_roads = []
for item in seen.values():
    points = item['points'][:8]
    if len(points) >= 2:
        final_roads.append({
            'name': item['name'],
            'type': item['type'],
            'points': points,
        })

out_path.write_text(__import__('json').dumps({'roads': final_roads}, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'parsed={len(final_roads)}')
print(final_roads[:5])
