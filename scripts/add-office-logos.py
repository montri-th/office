#!/usr/bin/env python3
"""CityMETER · Office — building logos from the research team's office logo library (release 0.6.0).

    python3 -I scripts/add-office-logos.py --manifest <manifest.json of the office web logo library>
        --assets <folder of the library's files> --checked-on <YYYY-MM-DD>

Owner 2026-11-26 06:14, VERBATIM: “เช็คหน่อยว่า โลโก้ขึ้นหรือยัง ใน web demo ทุกๆ dataset … แก้จุดที่แก้ง่ายก่อน”.
The manifest and its files stay outside the repository (the library's Drive folder and the research sheet are private);
only the SHA-256 of the manifest, public facts of each file and its public source page are published. Rules
(DATA_METHOD.md §logos):
  * a mapping is used when its result is `collected`, its role `venue_specific` (the building's own logo) and its
    `entity_id` is an Office ID of data/offices.json — joined by id, never by name;
  * its file is found by the manifest's SHA-256 only, never by file name;
  * display (the family rule of Fitness and Hotel): SVG and rasters ≤ 512 px and ≤ 64 KB keep their bytes; a
    transparent canvas whose artwork fills under 60 % is trimmed to the artwork's alpha box + 6 % (transparent pixels
    only), and so is an opaque canvas whose border is near-white when the plate is white (white margin only);
    anything larger is scaled uniformly to 384 px on its longest side as WebP (lossless with alpha); the
    original's SHA-256 is kept. No recolouring, ink cropping, tracing or upscaling;
  * plate: the library's recommended surface — dark → #182327, any other → #FFFFFF; the same on both themes.
"""
import argparse, hashlib, io, json, os, re, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_EDGE, MAX_BYTES, TARGET_EDGE = 512, 64 * 1024, 384
PLATES = {'dark': '#182327'}
EXT = {'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'}
PRIVATE = re.compile(r'google\.com|googleusercontent|drive\.|localhost|file:', re.I)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def white_margin_box(rgb):
    """The artwork's box on an opaque canvas whose whole border is near-white (every channel ≥ 245 on ≥ 98 % of the
    border pixels), the same colour as the light plate it is shown on: pixels that differ from white by more than 24 in
    any channel. None for any other canvas — a coloured or photographic background is never cut."""
    w, h = rgb.size
    px = rgb.load()
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    if sum(1 for c in border if min(c) >= 245) < 0.98 * len(border):
        return None
    ink = rgb.point(lambda v: 255 if v < 231 else 0).convert('L')
    return ink.getbbox()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--assets', required=True)
    ap.add_argument('--checked-on', required=True)
    a = ap.parse_args()
    raw_manifest = open(a.manifest, 'rb').read()
    m = json.loads(raw_manifest)
    if m.get('dataset') != 'office' or m.get('schema_version') != 1:
        sys.exit('not an office web logo library manifest (schema 1)')
    keys = set(json.load(open(os.path.join(ROOT, 'data/offices.json'), encoding='utf-8'))['cols']['key'])
    by_sha = {}
    for base, _, names in os.walk(a.assets):
        for name in names:
            p = os.path.join(base, name)
            by_sha[sha(open(p, 'rb').read())] = p
    assets = {x['asset_id']: x for x in m['assets']}
    out_dir = os.path.join(ROOT, 'assets/office-logos')
    shutil.rmtree(out_dir, ignore_errors=True)
    os.makedirs(out_dir)
    logos, offices = {}, {}
    counts = {'mappings': len(m['mappings']), 'collected': 0, 'notFound': 0, 'notInDemo': 0, 'used': 0, 'kept': 0, 'derived': 0}
    for x in m['mappings']:
        if x.get('result') != 'collected':
            counts['notFound'] += 1
            continue
        if x.get('logo_role') != 'venue_specific':
            sys.exit(f'{x.get("mapping_id")}: role {x.get("logo_role")} has no rule here')
        counts['collected'] += 1
        if x.get('entity_id') not in keys:
            counts['notInDemo'] += 1
            continue
        asset = assets[x['asset_id']]
        path = by_sha.get(asset['sha256'])
        if not path:
            sys.exit(f'no file with the SHA-256 of {asset["asset_id"]}')
        raw = open(path, 'rb').read()
        mime, w, h = asset['mime_type'], asset.get('width'), asset.get('height')
        transformations, original = [], None
        trim = None
        if mime != 'image/svg+xml':
            im = Image.open(io.BytesIO(raw))
            im.load()
            w, h = im.size
            alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
            box, how = None, ''
            if alpha:
                box = im.convert('RGBA').getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
                how = 'transparent'
            elif PLATES.get(asset.get('recommended_surface') or '', '#FFFFFF') == '#FFFFFF':
                box = white_margin_box(im.convert('RGB'))
                how = 'solid white'
            if box:
                bw, bh = box[2] - box[0], box[3] - box[1]
                if bw * bh < 0.6 * im.size[0] * im.size[1]:
                    pad = max(2, round(0.06 * max(bw, bh)))
                    trim = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.size[0], box[2] + pad), min(im.size[1], box[3] + pad))
            if trim or max(w, h) > MAX_EDGE or len(raw) > MAX_BYTES:
                im = im.convert('RGBA' if alpha else 'RGB')
                if trim:
                    im = im.crop(trim)
                    transformations.append(f'trim {how} margin to the artwork + 6 % (box {list(trim)})')
                scale = min(1.0, TARGET_EDGE / max(im.size))
                size = (max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale)))
                if size != im.size:
                    im = im.resize(size, Image.LANCZOS)
                    transformations.append(f'uniform scale to {TARGET_EDGE} px longest side')
                buf = io.BytesIO()
                im.save(buf, 'WEBP', **({'lossless': True, 'quality': 100, 'method': 6} if alpha else {'quality': 90, 'method': 6}))
                original = {'sha256': asset['sha256'], 'mime': mime, 'bytes': len(raw), 'width': w, 'height': h}
                raw, mime, (w, h) = buf.getvalue(), 'image/webp', im.size
                transformations.append('WebP ' + ('lossless' if alpha else 'quality 90'))
        elif len(raw) > MAX_BYTES:
            sys.exit(f'{asset["asset_id"]}: an SVG over {MAX_BYTES} bytes needs a rule')
        digest = sha(raw)
        key = 'OLG-' + digest[:16]
        name = f'{digest[:20]}.{EXT[mime]}'
        open(os.path.join(out_dir, name), 'wb').write(raw)
        source = asset.get('source_page_url') or ''
        if not source.startswith('https://') or PRIVATE.search(source):
            source = ''
        surface = asset.get('recommended_surface') or ''
        logos[key] = {'file': f'assets/office-logos/{name}', 'sha256': digest, 'mime': mime, 'bytes': len(raw), 'width': w, 'height': h,
                      'plate': PLATES.get(surface, '#FFFFFF'), 'surface': surface, 'label': x.get('canonical_name') or x.get('raw_label') or '',
                      'role': 'venue_specific', 'sourcePage': source,
                      'transformation': '; '.join(transformations) or 'none', 'original': original}
        if x['entity_id'] in offices:
            sys.exit(f'{x["entity_id"]}: two logos')
        offices[x['entity_id']] = key
        counts['used'] += 1
        counts['derived' if original else 'kept'] += 1
    meta = {'schemaVersion': 1, 'checkedOn': a.checked_on,
            'source': f'CityMETER Office — Venue, Company & Building Research Master, office web logo library (checked {m.get("checked_on")})',
            'manifestSha256': sha(raw_manifest), 'libraryCheckedOn': m.get('checked_on'), 'counts': counts,
            'rule': 'collected venue_specific mappings joined by Office ID; files found by the manifest SHA-256',
            'display': f'SVG and rasters ≤ {MAX_EDGE} px and ≤ {MAX_BYTES // 1024} KB keep their bytes; a large empty transparent margin, or a near-white margin on a white plate, is trimmed to the artwork + 6 %; larger files are scaled to {TARGET_EDGE} px longest side (WebP); the original SHA-256 is kept; no recolouring, ink cropping, tracing or upscaling',
            'rights': 'เครื่องหมายเป็นของเจ้าของแต่ละราย การแสดงเพื่อระบุอาคารไม่ใช่ใบอนุญาตเครื่องหมายการค้า'}
    path = os.path.join(ROOT, 'data/office-logos.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'meta': meta, 'logos': dict(sorted(logos.items())), 'offices': dict(sorted(offices.items()))}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(json.dumps(counts))


if __name__ == '__main__':
    main()
