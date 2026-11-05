#!/usr/bin/env python3
"""Build data/offices.json from the office research master, the CityMETER district index and CityMETER · Transit.

Inputs (internal, never committed):
  --csv      a directory of <tab>.csv read from “CityMETER Office — Venue, Company & Building Research Master 2026-10-24”
             (the internal Google Sheets research master, registry id research.TH.office), one file per tab, header row
             first. Tabs read: 01_OFFICES, 15_PROJECTS, 18_ORGANIZATIONS, 19_ORGANIZATION_ROLES, 23_OFFICE_ALIASES,
             28_OFFICE_METRICS. The SHA-256 of every file is recorded (meta.inputs).
Public inputs:
  --index    data/area-index.json, --frames data/frames/ (district outlines, display geometry)
  --transit  a checkout of montri-th/transit (data/transit.json: rail stations of CityMETER · Transit)

Output: data/offices.json — columnar rows + dictionaries + provenance; data/build-report.json — counts and checks.

ONE ROW = one Office ID of 01_OFFICES: an office record as the sheet defines it — an organisation's office premises, a
rental office building or office component, or a managed-workspace centre inside a host building. An Office ID can be
a few floors of a building, so a count of rows is a count of office records, never a count of buildings. Nothing is
merged, split, moved or re-labelled. A row that only stands for its own child rows (the sheet's aggregate references:
qualification_status `aggregate_reference_excluded`, or a `multi_building_project_reference` whose role is
`parent_reference_not_additive_to_children`, when its project has child rows) is kept out of every figure, as the sheet
says (“CP3/Ninth parent ไม่ถูกนับซ้ำกับอาคารย่อย”), and named in meta.excluded.

CATEGORY = office_supply_model of 01_OFFICES (the sheet's own classification): rental office · managed workspace ·
organisation's own office · own use and rental · not yet classified (`unresolved`, `rental_office_candidate`).
EVIDENCE = qualification_status: confirmed office use from a primary source · legacy record of CityMETER production
(not re-verified) · held for review.

RENT = rent_min_thb_sqm_month of 28_OFFICE_METRICS — the starting ASKING rent a public listing shows, THB per m² per
month, with its own source page, month and basis (VAT and service-charge inclusion mostly not verified). Never a
contract rent, an achieved rent or an average of the building. The legacy production price (legacy_rent_min/max, period
not stated) is published for the rows without an explicit monthly figure, labelled as such, and never enters a measure.
FLOORS, AREA = 28_OFFICE_METRICS floors / area_sqm with their status and basis (GLA/GFA often unstated). OCCUPANCY and
LEASABLE AREA = the owner-published figures of 28_OFFICE_METRICS with their reference date and scope (never averaged).

DISTRICT (ADMIN METHODS, the first that applies)
  name      the row's own district name (sheet field `district`; “เมือง” alone = เมือง{province}; a Latin name is read
            against the English district names of the index) is a production district of the row's province
  point     the row's selected point lies in a production district of the row's province (display outline)
  province  province only
  conflict  the row's point lies in another province than its own: placed nowhere, reported (meta.conflicts)
A district name that disagrees with the row's point is kept (the row's own name is the membership) and counted in the
report (checks.namePointDisagree) for the research team.

CONTEXT (CityMETER · Transit, straight-line distances from the row's selected point; never a travel time, a walking
route or a catchment; a row without a point has none): the nearest operating rail station and the nearest station
under construction, within RAIL_MAX_M.

ORGANISATIONS = 19_ORGANIZATION_ROLES of the row (office user, operator, workspace provider or network, leasing
brand, published portfolio, source-reported property manager, rental provider) → 18_ORGANIZATIONS. Broker listings
(`commercial_leasing_agent_listing`), unverified brand affiliations and co-marketing links are not published as
organisations of the office. A role is a source claim (claim_status kept), not a tenancy, ownership or occupancy check.

Not copied (meta.excludedFields): addresses (office_location_reported, address_reported), telephone numbers, company
location candidates, tenant counts, raw ids of the private repository, researcher notes, ownership notes, internal sheet
URLs and links to the private repository. Source links are public https pages; legacy CityMETER production rows link
to the same district on CityMETER production (?d=office).
"""
import argparse, collections, csv, datetime, hashlib, json, math, os, re, sys, unicodedata

RAIL_MAX_M = 2000
TABS = ['01_OFFICES', '15_PROJECTS', '18_ORGANIZATIONS', '19_ORGANIZATION_ROLES', '23_OFFICE_ALIASES', '28_OFFICE_METRICS']
SHEET_TITLE = 'CityMETER Office — Venue, Company & Building Research Master 2026-10-24'

# Categories: office_supply_model of 01_OFFICES → product group (cue series in js/cues.js).
GROUPS = [
    ('rental', 'สำนักงานให้เช่า', 'Rental office', ['rental_office']),
    ('workspace', 'พื้นที่ทำงานแบบบริการ', 'Managed workspace', ['managed_workspace_component']),
    ('organization', 'สำนักงานขององค์กร', "Organisation's own office", ['organization_use_record']),
    ('hybrid', 'ใช้เองและให้เช่า', 'Own use and rental', ['hybrid_organization_use_and_rental']),
    ('unresolved', 'ยังไม่ระบุรูปแบบ', 'Not yet classified', ['unresolved', 'rental_office_candidate']),
]
MODEL_GROUP = {m: i for i, g in enumerate(GROUPS) for m in g[3]}
MODEL_TH = {'rental_office': 'สำนักงานให้เช่า', 'managed_workspace_component': 'พื้นที่ทำงานแบบบริการในอาคาร',
            'organization_use_record': 'สถานที่ทำงานขององค์กร', 'hybrid_organization_use_and_rental': 'ใช้เองและให้เช่าบางส่วน',
            'unresolved': 'ยังไม่จำแนกรูปแบบ', 'rental_office_candidate': 'สำนักงานให้เช่า (รอตรวจ)'}
# Evidence: qualification_status → evidence group.
EVIDENCE = [
    ('confirmed', 'ยืนยันจากแหล่งหลัก', ['source_confirmed_office_site', 'source_confirmed_office_purpose', 'office_use_confirmed_physical_split_pending']),
    ('legacy', 'ข้อมูลเดิมจาก CityMETER production', ['legacy_source_only']),
    ('review', 'รอตรวจหลักฐาน', ['candidate_source_provenance_hold', 'source_office_purpose_conflict_review']),
]
STATUS_EVIDENCE = {s: i for i, e in enumerate(EVIDENCE) for s in e[2]}
AGGREGATE_STATUS = 'aggregate_reference_excluded'
# Floor bands (floors of 28_OFFICE_METRICS, the building the record sits in). Unknown floors stay out of every band.
SIZES = [('f1', 'ไม่ถึง 10 ชั้น', '<10', 1, 9), ('f2', '10–19 ชั้น', '10–19', 10, 19), ('f3', '20–29 ชั้น', '20–29', 20, 29),
         ('f4', '30–39 ชั้น', '30–39', 30, 39), ('f5', '40 ชั้นขึ้นไป', '40+', 40, 10 ** 4)]
ADMIN = ['name', 'point', 'province', 'conflict', 'none']
COORD = [  # coordinate_basis (regular expression, first match) → what the point is; kept with the row, never upgraded
    (r'^repository_insert_plus_amendments', 'จุดจาก CityMETER production (รวมการแก้ไขในชีต)'),
    (r'^source_published_office_location_target', 'จุดตามที่แหล่งเผยแพร่'),
    (r'^cross_source_named_office_map_target', 'จุดบนแผนที่ของแหล่งที่ระบุชื่อสำนักงาน (ตรวจข้ามแหล่ง)'),
    (r'^representative_point_inside_exact_named_original_OSM_building_polygon', 'จุดตัวแทนภายในรูปอาคาร OpenStreetMap ที่ชื่อตรงกัน'),
    (r'^primary_owner(_or_tenant)?_linked_named_feature', 'จุดของสถานที่ที่เจ้าของหรือผู้ใช้อ้างถึง'),
    (r'Google|google', 'จุดแผนที่ที่องค์กรหรือผู้ดำเนินการเผยแพร่'),
    (r'explicit_lat_lng|business_location_WGS84|map_positions', 'พิกัดที่หน้าทางการระบุ'),
    (r'', 'จุดจากแหล่งข้อมูล'),  # anything else with a point (accuracy as the sheet's coordinate_basis says)
]
MASS = ['contained', 'api', 'pending', 'conflict', 'none', 'not_checked']
MASS_OF = {
    'building_returned_current_osm_containment': 'contained', 'source_point_containment': 'contained',
    'building_returned_api_context': 'api', 'footprint_pending_named_host_identity_only': 'pending',
    'source_geometry_conflict_review': 'conflict', 'no_containing_building_returned': 'none',
    'not_queried': 'not_checked', 'not_queried_no_selected_point': 'not_checked', 'unmatched': 'not_checked', '': 'not_checked',
}
FLOOR_STATUS = {  # floor_status / area_status of 28_OFFICE_METRICS → label (a value is published only with one of these)
    'corroborated_published_value': 'ตรงกันมากกว่าหนึ่งแหล่ง',
    'published_primary_value': 'จากแหล่งหลัก',
    'published_broker_value': 'จากหน้าประกาศของนายหน้า',
    'legacy_value_unverified_scope': 'ค่าเดิมใน CityMETER production',
    'source_scope_or_value_conflict': 'แหล่งข้อมูลขัดกัน',
}
CONFLICT_STATUS = 'source_scope_or_value_conflict'
def area_basis_th(code):
    """area_basis of 28_OFFICE_METRICS → a short Thai label: what the area measures and who reported it (the sheet keeps
    the exact basis). Rule-based, because the sheet writes one-off bases for single buildings."""
    c = (code or '').strip()
    if not c:
        return 'ไม่ระบุฐานพื้นที่'
    who = next((th for k, th in (('self_published', 'ตามผู้ให้เช่า'), ('owner_', 'ตามเจ้าของ'), ('broker_', 'ตามนายหน้า'),
                                 ('operator_', 'ตามผู้ดำเนินการ'), ('publisher_', 'ตามผู้เผยแพร่'), ('published_', 'ตามที่เผยแพร่'),
                                 ('source_', 'ตามแหล่งเดิม')) if c.startswith(k)), 'ตามแหล่ง')
    approx = ' โดยประมาณ' if 'approximate' in c else ''
    if 'coworking' in c or 'meeting_rooms' in c:
        what = 'พื้นที่ทำงานและห้องประชุมที่ประกาศ ไม่ระบุฐาน'
    elif re.search(r'unspecified', c):
        what = 'พื้นที่ไม่ระบุว่าเป็นพื้นที่เช่าหรือพื้นที่อาคารรวม'
    elif 'gross_floor_area' in c:
        what = 'พื้นที่อาคารรวม (GFA)'
    elif re.search(r'net_?leasable|net_lettable|nettable', c):
        what = 'พื้นที่ให้เช่าสุทธิ'
    elif re.search(r'lettable|leasable|TLA', c):
        what = 'พื้นที่ให้เช่า'
    else:
        sys.exit(f'28_OFFICE_METRICS: area_basis {c!r} has no rule')
    return f'{what}{approx} {who}'


RENT_BASIS = {  # rent_basis → the name of the figure on screen; the verification status (VAT, service charge) is in meta
    'broker_displayed_starting_rent; VAT_service_charge_inclusion_not_verified': 'ราคาเริ่มต้นที่ประกาศ',
    'broker_displayed_starting_asking_quote; VAT_and_service_charge_inclusion_not_independently_verified': 'ราคาเริ่มต้นที่ประกาศ',
    'broker_displayed_starting_rent; VAT_service_inclusion_not_verified': 'ราคาเริ่มต้นที่ประกาศ',
    'THB/sqm/month;published_office_asking_rate;unit_or_floor_may_vary;not_uniform_contract_rent': 'ราคาเสนอเช่าที่ประกาศ ต่างกันตามชั้นหรือยูนิต',
    'self_published_broker_asking_rent_explicit_monthly_period': 'ราคาเสนอเช่ารายเดือนที่ผู้ให้เช่าหรือนายหน้าประกาศเอง',
    'broker_published_named_child_asking_quote_VAT_service_scope_unverified': 'ราคาเสนอเช่าของอาคารย่อยที่ประกาศ',
    'publisher_attributed_Tower_A_standard_office_starting_asking_rent_excludes_separate_CAM': 'ราคาเริ่มต้นของสำนักงานมาตรฐานอาคาร A ไม่รวมค่าส่วนกลาง',
    'THB/sqm/month;published_asking_rate_not_uniform_contract_rent': 'ราคาเสนอเช่าที่ประกาศ',
}
RENT_STATUS = ('published_broker_value',)
# Organisation roles of 19_ORGANIZATION_ROLES published with the office (label shown in the profile).
ROLES = [
    ('office_user', 'ใช้เป็นสำนักงาน'),
    ('office_unit_operator', 'ดำเนินการสำนักงานแห่งนี้'),
    ('workspace_service_operator', 'ผู้ให้บริการพื้นที่ทำงาน'),
    ('workspace_network_affiliation', 'อยู่ในเครือข่ายพื้นที่ทำงาน'),
    ('leasing_portfolio_brand', 'แบรนด์ให้เช่าพื้นที่สำนักงาน'),
    ('published_property_portfolio_affiliation', 'อยู่ในพอร์ตอาคารที่เผยแพร่'),
    ('property_manager_source_reported', 'ผู้บริหารอาคารตามแหล่ง'),
    ('rental_office_provider', 'ผู้ให้เช่าพื้นที่'),
]
ROLE_INDEX = {r[0]: i for i, r in enumerate(ROLES)}
ROLES_LEFT_OUT = ('commercial_leasing_agent_listing', 'unverified_brand_affiliation', 'co_marketing_association')
ALIAS_TYPES_LEFT_OUT = re.compile(r'address', re.I)
SOURCE_KIND = [  # source_dataset_version prefix → readable source (Thai), public landing page
    ('V3', 'CityMETER Office (ชุดข้อมูลสำนักงานของ CityMETER production)', 'https://landometer.com/v3/citymeter?d=office'),
    ('primary_source_expansion', 'หน้าทางการขององค์กรหรืออาคาร (รอบขยายจากแหล่งหลัก)', ''),
    ('operator_portfolio', 'พอร์ตที่เจ้าของอาคารหรือผู้ให้บริการพื้นที่ทำงานเผยแพร่', ''),
    ('regional_private_research', 'หน้าทางการของสำนักงานเอกชนในภูมิภาค', ''),
    ('regional_office_spatial', 'หน้าทางการของสำนักงานเอกชนในภูมิภาค (รอบตรวจตำแหน่ง)', ''),
    ('regional_address', 'หน้าทางการของสำนักงานเอกชนในภูมิภาค (รอบตรวจที่อยู่)', ''),
    ('sixgroups_broker_portfolio', 'พอร์ตอาคารที่นายหน้าเผยแพร่ ตรวจชื่อ ที่อยู่ และพิกัดกับแหล่งหลัก', ''),
]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def fnum(v):
    try:
        x = float(str(v).replace(',', '').strip())
        return x if math.isfinite(x) else None
    except (TypeError, ValueError):
        return None


def th_norm(s):
    s = unicodedata.normalize('NFC', str(s or '')).replace('​', '').replace('\xa0', ' ').replace('ํา', 'ำ').strip()
    s = re.sub(r'^(?:กิ่งอำเภอ|อำเภอ|เขต|อ\.)\s*', '', s)
    return re.sub(r'\s+', '', s)


def haversine(lat1, lon1, lat2, lon2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


class Grid:
    """Points bucketed in ~0.02° cells for nearest-within-radius queries."""
    def __init__(self, items, cell=0.02):
        self.cell, self.cells = cell, collections.defaultdict(list)
        for it in items:
            self.cells[(int(it['lat'] // cell), int(it['lon'] // cell))].append(it)

    def nearest(self, lat, lon, max_m):
        reach = int(math.ceil((max_m / 111320) / self.cell)) + 1
        ci, cj = int(lat // self.cell), int(lon // self.cell)
        best, best_d = None, max_m + 1e-9
        for i in range(ci - reach, ci + reach + 1):
            for j in range(cj - reach, cj + reach + 1):
                for it in self.cells.get((i, j), ()):
                    d = haversine(lat, lon, it['lat'], it['lon'])
                    if d < best_d:
                        best, best_d = it, d
        return (best, best_d) if best else (None, None)


def ring_contains(ring, x, y):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


class Locator:
    """District outlines of data/frames, by province; display geometry (used for the `point` method and checks)."""
    def __init__(self, frames_dir, provinces):
        self.by_province = collections.defaultdict(list)
        for code in provinces:
            frame = json.load(open(os.path.join(frames_dir, f'{code}.json'), encoding='utf-8'))
            for f in frame['areas']['features']:
                g = f['geometry']
                polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
                polys = [[[tuple(p) for p in ring] for ring in poly] for poly in polys]
                xs = [p[0] for poly in polys for p in poly[0]]
                ys = [p[1] for poly in polys for p in poly[0]]
                self.by_province[code].append((str(f['id']), polys, min(xs), min(ys), max(xs), max(ys)))

    def find(self, lon, lat, provinces):
        for code in provinces:
            for did, polys, w, s, e, n in self.by_province.get(code, ()):
                if lon < w or lon > e or lat < s or lat > n:
                    continue
                for poly in polys:
                    if ring_contains(poly[0], lon, lat) and not any(ring_contains(h, lon, lat) for h in poly[1:]):
                        return code, did
        return None, None


PRIVATE = re.compile(r'docs\.google\.com|drive\.google\.com|landometer\.com/api/|/papi/api/|github\.com/theshifters|localhost|\.local/', re.I)


def public_urls(value):
    """Every public https link of a source field (several are separated by '|', ';' or spaces), in order."""
    out = []
    for u in re.split(r'\s*[|;]\s*|\s+', (value or '').strip()):
        u = u.strip().rstrip('.,')
        if u.startswith('https://') and not PRIVATE.search(u) and u not in out:
            out.append(u)
    return out


def us_date(v):
    """'10/24/2026' (the sheet's display format) or '2026-10-24' → '2026-10-24'; anything else → ''."""
    v = (v or '').strip()
    m = re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{4})', v)
    if m:
        return f'{m[3]}-{int(m[1]):02d}-{int(m[2]):02d}'
    m = re.fullmatch(r'(\d{4}-\d{2}-\d{2})(?:T.*)?', v)
    return m[1] if m else ''


def month_or_date(v):
    v = (v or '').strip()
    return v if re.fullmatch(r'\d{4}-\d{2}(?:-\d{2})?', v) else ''


def repo_commit(path):
    head = open(os.path.join(path, '.git', 'HEAD')).read().strip()
    if head.startswith('ref:'):
        ref = head.split(' ', 1)[1]
        p = os.path.join(path, '.git', ref)
        if os.path.exists(p):
            return open(p).read().strip()
        for line in open(os.path.join(path, '.git', 'packed-refs')):
            if line.strip().endswith(ref):
                return line.split()[0]
    return head


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--csv', required=True, help='directory of <tab>.csv read from the research master (SHA-256 of each recorded)')
    ap.add_argument('--read-on', required=True, help='date the tabs were read from the live sheet (YYYY-MM-DD)')
    ap.add_argument('--index', required=True)
    ap.add_argument('--frames', required=True)
    ap.add_argument('--transit', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    tabs, inputs = {}, {}
    for t in TABS:
        path = os.path.join(a.csv, t + '.csv')
        with open(path, encoding='utf-8') as fh:
            tabs[t] = list(csv.DictReader(fh))
        inputs[t] = {'sha256': sha256_file(path), 'rows': len(tabs[t])}
    offices = tabs['01_OFFICES']
    metrics = {r['office_id']: r for r in tabs['28_OFFICE_METRICS'] if r.get('office_id')}

    # ---------- gazetteer (CityMETER production base info, via data/area-index.json) ----------
    index = json.load(open(a.index, encoding='utf-8'))
    prov_by_th = {th_norm(p['name']): p['id'] for p in index['provinces']}
    prov_name = {p['id']: p['name'] for p in index['provinces']}
    ar = index['areas']
    district_by_name, district_by_en = {}, {}
    for i, did in enumerate(ar['id']):
        district_by_name[(ar['province'][i], th_norm(ar['name'][i]))] = did
        if ar['nameEn'][i]:
            district_by_en[(ar['province'][i], ar['nameEn'][i].casefold().strip())] = did
    index_ids = set(ar['id'])
    locator = Locator(a.frames, [p['id'] for p in index['provinces']])

    def district_of(prov, text):
        t = (text or '').strip()
        if not prov or not t:
            return ''
        if re.search(r'[A-Za-z]', t):
            k = t.casefold().strip()
            if k in ('muang', 'mueang', 'mueang district', 'muang district'):
                return district_by_name.get((prov, th_norm('เมือง' + prov_name[prov])), '')
            return district_by_en.get((prov, k), '')
        n = th_norm(t)
        if n == 'เมือง':
            n = th_norm('เมือง' + prov_name[prov])
        return district_by_name.get((prov, n), '')

    # ---------- CityMETER · Transit ----------
    transit_path = os.path.join(a.transit, 'data', 'transit.json')
    transit = json.load(open(transit_path, encoding='utf-8'))
    lines = {l['id']: l for l in transit['lines']}
    stations = []
    for s in transit['stations']:
        if not (isinstance(s.get('lat'), (int, float)) and isinstance(s.get('lng'), (int, float))):
            continue
        if s.get('status') not in ('operating', 'construction'):
            continue
        stations.append({'id': s['id'], 'name': s['name'], 'nameEn': s.get('nameEn') or '', 'lat': s['lat'], 'lon': s['lng'], 'status': s['status'],
                         'lines': [lines[l]['short'] or lines[l]['name'] for l in s.get('lineIds', []) if l in lines],
                         'lineIds': s.get('lineIds', [])})
    stations.sort(key=lambda s: s['id'])
    for i, s in enumerate(stations):
        s['i'] = i
    grid_op = Grid([s for s in stations if s['status'] == 'operating'])
    grid_cx = Grid([s for s in stations if s['status'] == 'construction'])

    # ---------- excluded aggregate rows ----------
    def project_key(r):
        p = (r.get('project_id') or '').strip()
        parent = (r.get('office_supply_parent_id') or '').strip()
        return p or (parent if parent.startswith('PRJ-') else '')
    children = collections.defaultdict(list)
    for r in offices:
        for k in {(r.get('project_id') or '').strip(), (r.get('office_supply_parent_id') or '').strip()} - {''}:
            children[k].append(r['office_id'])
    excluded = {}
    for r in offices:
        aggregate = r.get('qualification_status') == AGGREGATE_STATUS
        project_ref = (r.get('office_supply_scope') == 'multi_building_project_reference'
                       and r.get('office_supply_aggregation_role') == 'parent_reference_not_additive_to_children')
        if not (aggregate or project_ref):
            continue
        key = project_key(r)
        kids = [k for k in children.get(key, []) if k != r['office_id']] if key else []
        if kids:
            excluded[r['office_id']] = {'office': r['office_id'], 'name': (r.get('current_display_name') or r.get('office_name') or '').strip(),
                                        'project': key, 'children': sorted(kids),
                                        'reason': 'aggregate reference of its child rows (counted once, through the children)'}

    # ---------- organisations, projects, aliases ----------
    org_rows = {r['organization_id']: r for r in tabs['18_ORGANIZATIONS'] if r.get('organization_id')}
    roles_by_office = collections.defaultdict(list)
    role_counts = collections.Counter()
    for r in tabs['19_ORGANIZATION_ROLES']:
        rt, oid, org = r.get('role_type', ''), (r.get('office_id') or '').strip(), (r.get('organization_id') or '').strip()
        role_counts[rt] += 1
        if rt in ROLES_LEFT_OUT or not oid or not org:
            continue
        if rt not in ROLE_INDEX:
            sys.exit(f'19_ORGANIZATION_ROLES: role_type {rt!r} has no label in ROLES (add it, or list it in ROLES_LEFT_OUT)')
        if org not in org_rows:
            sys.exit(f'19_ORGANIZATION_ROLES: organization {org!r} is not in 18_ORGANIZATIONS')
        roles_by_office[oid].append((org, rt, (r.get('claim_status') or '').strip()))
    projects = {r['project_id']: (r.get('project_name') or '').strip() for r in tabs['15_PROJECTS'] if r.get('project_id')}
    aliases = collections.defaultdict(list)
    alias_left_out = 0
    for r in tabs['23_OFFICE_ALIASES']:
        if ALIAS_TYPES_LEFT_OUT.search(r.get('alias_type') or ''):
            alias_left_out += 1
            continue
        t = (r.get('alias_text') or '').strip()
        if t and t not in aliases[r['office_id']]:
            aliases[r['office_id']].append(t)

    # ---------- rows ----------
    urls, url_index, sources, source_index = [], {}, [], {}
    orgs, org_index, project_list, project_index = [], {}, [], {}
    provinces_list, districts_list, prov_i, dist_i = [], [], {}, {}
    coord_used = collections.Counter()

    def intern(lst, idx, value):
        if value not in idx:
            idx[value] = len(lst)
            lst.append(value)
        return idx[value]

    def vocab_i(lst, value):
        if value not in lst:
            lst.append(value)
        return lst.index(value)

    def url_i(u):
        return intern(urls, url_index, u) if u else -1

    def source_of(version):
        for prefix, th, url in SOURCE_KIND:
            if version.startswith(prefix):
                return intern(sources, source_index, (prefix, th, url))
        sys.exit(f'01_OFFICES: source_dataset_version {version!r} has no SOURCE_KIND')

    def coord_of(basis):
        for k, (pattern, th) in enumerate(COORD):
            if re.search(pattern, basis):
                coord_used[th] += 1
                return k
        return len(COORD) - 1

    cols = {k: [] for k in ('key', 'name', 'alt', 'group', 'model', 'ev', 'floors', 'fst', 'area', 'ast', 'abasis', 'rmin', 'rmax', 'rurl', 'ron',
                            'rbasis', 'year', 'province', 'district', 'admin', 'lat', 'lon', 'coord', 'src', 'url', 'mass', 'bld',
                            'rail', 'railM', 'rail2', 'rail2M', 'proj')}
    row_orgs, occupancy, lease, legacy_price, row_aliases = {}, {}, {}, {}, {}
    counts = collections.Counter()
    conflicts, disagree = [], []
    rent_bases, area_bases = [], []
    rent_basis_counts = collections.Counter()
    seen = set()
    models = list(MODEL_TH)
    for r in offices:
        oid = (r.get('office_id') or '').strip()
        if not oid or oid in seen:
            continue
        seen.add(oid)
        if oid in excluded:
            counts['excluded.aggregate'] += 1
            continue
        qs = r.get('qualification_status', '')
        if qs not in STATUS_EVIDENCE:
            sys.exit(f'01_OFFICES: qualification_status {qs!r} of {oid} has no evidence group')
        model = r.get('office_supply_model', '')
        if model not in MODEL_GROUP:
            sys.exit(f'01_OFFICES: office_supply_model {model!r} of {oid} has no group')
        prov = prov_by_th.get(th_norm(r.get('province')), '')
        if r.get('province') and not prov:
            sys.exit(f'01_OFFICES: province {r.get("province")!r} of {oid} is not a production province')
        lat, lon = fnum(r.get('latitude')), fnum(r.get('longitude'))
        if lat is not None and lon is not None and not (5 <= lat <= 21 and 97 <= lon <= 106):
            lat = lon = None
            counts['point.outOfRange'] += 1
        has_point = lat is not None and lon is not None
        # District membership
        admin, dcode = 'none', ''
        d2 = district_of(prov, r.get('district'))
        if d2:
            admin, dcode = 'name', d2
        elif r.get('district'):
            counts['district.nameUnmatched'] += 1
        if not dcode and has_point and prov:
            pc, d3 = locator.find(lon, lat, [prov])
            if d3:
                admin, dcode = 'point', d3
            else:
                pc2, d4 = locator.find(lon, lat, [p['id'] for p in index['provinces'] if p['id'] != prov])
                if d4:
                    admin = 'conflict'
                    conflicts.append({'office': oid, 'province': prov, 'pointProvince': pc2})
        if not dcode and admin == 'none' and prov:
            admin = 'province'
        if dcode and dcode not in index_ids:
            counts['district.notInIndex'] += 1
            dcode, admin = '', ('province' if prov else 'none')
        if admin == 'name' and has_point:
            pc, d5 = locator.find(lon, lat, [prov])
            if d5 and d5 != dcode:
                disagree.append(oid)
        counts['admin.' + admin] += 1
        # Metrics (28_OFFICE_METRICS)
        m = metrics.get(oid, {})
        fl = fnum(m.get('floors'))
        fst = m.get('floor_status', '')
        floors = int(round(fl)) if fl and fl > 0 and fst in FLOOR_STATUS else -1
        if fl and fl > 0 and fst not in FLOOR_STATUS:
            sys.exit(f'28_OFFICE_METRICS: floor_status {fst!r} of {oid} has a value but no label')
        area = fnum(m.get('area_sqm'))
        ast = m.get('area_status', '')
        abasis = (m.get('area_basis') or '').strip()
        if area and area > 0:
            if ast not in FLOOR_STATUS:
                sys.exit(f'28_OFFICE_METRICS: area_status {ast!r} of {oid} has a value but no label')
            area = int(round(area))
        else:
            area = -1
        rmin, rmax = fnum(m.get('rent_min_thb_sqm_month')), fnum(m.get('rent_max_thb_sqm_month'))
        rbasis = -1
        rurl, ron = -1, ''
        if rmin and rmin > 0:
            if m.get('rent_status') not in RENT_STATUS:
                sys.exit(f'28_OFFICE_METRICS: rent_status {m.get("rent_status")!r} of {oid} with a monthly rent')
            basis = (m.get('rent_basis') or '').strip()
            rent_basis_counts[basis] += 1
            if basis not in RENT_BASIS:
                sys.exit(f'28_OFFICE_METRICS: rent_basis {basis!r} of {oid} has no label')
            rbasis = vocab_i(rent_bases, RENT_BASIS[basis])
            link = public_urls(m.get('rent_source_url'))
            rurl = url_i(link[0]) if link else -1
            ron = month_or_date(m.get('rent_source_date'))
            rmin = int(round(rmin))
            rmax = int(round(rmax)) if rmax and rmax >= rmin else -1
            counts['rent.monthly'] += 1
            counts['rent.monthly.undated'] += 0 if ron else 1
            counts['rent.monthly.noPublicLink'] += 0 if rurl >= 0 else 1
        else:
            rmin = rmax = -1
            lmin, lmax = fnum(m.get('legacy_rent_min_thb_sqm')), fnum(m.get('legacy_rent_max_thb_sqm'))
            if lmin and lmin > 0:
                legacy_price[len(cols['key'])] = [int(round(lmin)), int(round(lmax)) if lmax and lmax >= lmin else -1]
                counts['rent.legacyOnly'] += 1
        year = fnum(r.get('source_year_built'))
        year = int(year) if year and 1900 <= year <= 2030 else -1
        # Source + public link: the source page of the row, else its supply-classification source.
        version = (r.get('source_dataset_version') or '').strip()
        si = source_of(version)
        link = (public_urls(r.get('source_url')) + public_urls(r.get('office_supply_source_url')))
        ui = url_i(link[0]) if link else -1
        counts['link.public' if ui >= 0 else 'link.none'] += 1
        # Building join (01_OFFICES building_join_status of 2026-11-02) and the OpenStreetMap way, when contained.
        bjs = (r.get('building_join_status') or '').strip()
        if bjs not in MASS_OF:
            sys.exit(f'01_OFFICES: building_join_status {bjs!r} of {oid} has no code')
        mass = MASS_OF[bjs]
        bm = re.fullmatch(r'osm:(way|relation)/(\d+)', (r.get('building_id') or '').strip())
        bld = url_i(f'https://www.openstreetmap.org/{bm[1]}/{bm[2]}') if bm and mass == 'contained' else -1
        # Rail context
        rail = rail2 = railm = rail2m = -1
        if has_point:
            s, d = grid_op.nearest(lat, lon, RAIL_MAX_M)
            if s:
                rail, railm = s['i'], int(round(d))
            s, d = grid_cx.nearest(lat, lon, RAIL_MAX_M)
            if s:
                rail2, rail2m = s['i'], int(round(d))
        name = (r.get('current_display_name') or r.get('office_name') or '').strip()
        alt = ''
        for cand in ((r.get('name_th') or '').strip(), (r.get('name_en') or '').strip(), (r.get('office_name') or '').strip()):
            if cand and cand.casefold() != name.casefold():
                alt = cand
                break
        i = len(cols['key'])
        cols['key'].append(oid)
        cols['name'].append(name)
        cols['alt'].append(alt)
        cols['group'].append(MODEL_GROUP[model])
        cols['model'].append(models.index(model))
        cols['ev'].append(STATUS_EVIDENCE[qs])
        cols['floors'].append(floors)
        cols['fst'].append(list(FLOOR_STATUS).index(fst) if floors > 0 else -1)
        cols['area'].append(area)
        cols['ast'].append(list(FLOOR_STATUS).index(ast) if area > 0 else -1)
        cols['abasis'].append(vocab_i(area_bases, area_basis_th(abasis)) if area > 0 else -1)
        cols['rmin'].append(rmin)
        cols['rmax'].append(rmax)
        cols['rurl'].append(rurl)
        cols['ron'].append(ron)
        cols['rbasis'].append(rbasis)
        cols['year'].append(year)
        cols['province'].append(intern(provinces_list, prov_i, prov) if prov else -1)
        cols['district'].append(intern(districts_list, dist_i, dcode) if dcode else -1)
        cols['admin'].append(ADMIN.index(admin))
        cols['lat'].append(round(lat, 6) if has_point else None)
        cols['lon'].append(round(lon, 6) if has_point else None)
        cols['coord'].append(coord_of((r.get('coordinate_basis') or '').strip()) if has_point else -1)
        cols['src'].append(si)
        cols['url'].append(ui)
        cols['mass'].append(MASS.index(mass))
        cols['bld'].append(bld)
        cols['rail'].append(rail); cols['railM'].append(railm)
        cols['rail2'].append(rail2); cols['rail2M'].append(rail2m)
        pid = (r.get('project_id') or '').strip()
        cols['proj'].append(intern(project_list, project_index, projects[pid]) if pid in projects and projects[pid] else -1)
        # Organisations of the office (one entry per organisation, its roles in ROLES order)
        mine = collections.OrderedDict()
        for org, rt, claim in roles_by_office.get(oid, []):
            mine.setdefault(org, set()).add(ROLE_INDEX[rt])
        if mine:
            entry = []
            for org, rset in mine.items():
                if org not in org_index:
                    o = org_rows[org]
                    org_index[org] = len(orgs)
                    orgs.append({'id': org, 'name': (o.get('organization_name') or org).strip(), 'kind': (o.get('organization_kind') or '').strip()})
                entry.append([org_index[org], sorted(rset)])
            row_orgs[i] = entry
            counts['orgs.rows'] += 1
        # Owner-published figures (never averaged): leasable office area and occupancy, with reference and scope.
        la = fnum(m.get('office_leasable_area_sqm'))
        if la and la > 0:
            link = public_urls(m.get('office_area_source_url'))
            lease[i] = [int(round(la)), (m.get('office_area_reference') or '').strip()[:60], url_i(link[0]) if link else -1]
        occ = (m.get('occupancy_rate') or '').strip()
        if occ:
            link = public_urls(m.get('occupancy_source_url'))
            ref = us_date(m.get('occupancy_as_of_date')) or (m.get('occupancy_reference') or '').strip()[:60]
            occupancy[i] = [occ, ref, re.sub(r'[_;]+', ' ', (m.get('occupancy_scope') or '').strip())[:90], url_i(link[0]) if link else -1]
        if aliases.get(oid):
            row_aliases[i] = [x for x in aliases[oid] if x.casefold() not in (name.casefold(), alt.casefold())][:12]
            if not row_aliases[i]:
                del row_aliases[i]
        counts['rows'] += 1
        counts['points'] += 1 if has_point else 0
        counts['floors.known'] += 1 if floors > 0 else 0
        counts['area.known'] += 1 if area > 0 else 0
        counts['group.' + GROUPS[MODEL_GROUP[model]][0]] += 1
        counts['evidence.' + EVIDENCE[STATUS_EVIDENCE[qs]][0]] += 1

    used_stations = sorted({x for x in cols['rail'] + cols['rail2'] if x >= 0})
    keep_st = sorted(set(used_stations) | {s['i'] for s in stations if s['status'] == 'operating'})
    st_map = {old: new for new, old in enumerate(keep_st)}
    for k in ('rail', 'rail2'):
        cols[k] = [st_map[x] if x >= 0 else -1 for x in cols[k]]
    out_stations = [{k: stations[i][k] for k in ('id', 'name', 'nameEn', 'lat', 'lon', 'status', 'lines', 'lineIds')} for i in keep_st]

    checked = sorted({us_date(r.get('checked_on')) for r in offices if us_date(r.get('checked_on'))}
                     | {us_date(m.get('checked_on')) for m in metrics.values() if us_date(m.get('checked_on'))}
                     | {us_date(m.get('owner_metrics_checked_on')) for m in metrics.values() if us_date(m.get('owner_metrics_checked_on'))})
    rent_months = sorted({x[:7] for x in cols['ron'] if x})
    built_on = datetime.date.today().isoformat()
    meta = {
        'dataset': 'CityMETER Office', 'datasetTh': 'สำนักงานในประเทศไทย', 'registryId': 'research.TH.office', 'registryRole': 'Land · TH',
        'productionDataset': 'office', 'sheetTitle': SHEET_TITLE, 'sheetStatus': 'research_master', 'readOn': a.read_on,
        'inputs': inputs, 'checkedOn': checked[-1] if checked else '', 'checkedDates': checked, 'spatialJoinOn': '2026-11-02',
        'rentMonths': rent_months, 'builtOn': built_on, 'rows': counts['rows'], 'counts': dict(sorted(counts.items())),
        'rentBases': {'rule': 'the sheet\'s rent_basis, named on screen by what the figure is; VAT and service-charge inclusion is not verified for the broker-displayed starting rents (rent_basis says so) — stated in DATA_METHOD.md, never on screen', 'basisCounts': dict(rent_basis_counts)},
        'unit': {
            'row': 'one Office ID of 01_OFFICES — an office record (an organisation’s office premises, a rental office building or component, or a managed-workspace centre in a host building); a record can be a few floors of a building, so a count of rows is never a count of buildings; not a census',
            'rent': 'rent_min_thb_sqm_month of 28_OFFICE_METRICS — the starting asking rent a public listing shows (THB per m² per month), with its page, month and basis; VAT and service-charge inclusion mostly not verified; never a contract or achieved rent',
            'legacyPrice': 'legacy_rent_min/max of CityMETER production (THB per m²; period not stated): shown per office only when no monthly figure is selected; never in a measure',
            'floors': 'floors of 28_OFFICE_METRICS — storeys of the building the record sits in, with status (a legacy value keeps its unverified scope)',
        },
        'excluded': sorted(excluded.values(), key=lambda x: x['office']),
        'adminMethods': {
            'name': "the row's own district name (เมือง alone = เมือง{province}; Latin names read against the English district names) is a production district of its province",
            'point': "the row's selected point lies in a production district of its province (display outline)",
            'province': 'province only', 'conflict': "the row's point lies in another province: placed nowhere",
            'none': 'no province',
        },
        'districts': 'CityMETER production base info (%s, retrieved %s, %d receipts, sha256 %s) + district outlines of data/frames/{CODE}.json' % (
            index['metadata'].get('attributeEndpoint', ''), index['metadata'].get('retrievedOn', ''), index['metadata'].get('receipts', 0),
            index['metadata'].get('receiptsSha256', '')),
        'context': {
            'rail': {'source': 'CityMETER · Transit (montri-th/transit)', 'commit': repo_commit(a.transit), 'file': 'data/transit.json', 'sha256': sha256_file(transit_path),
                     'release': (transit.get('meta') or {}).get('release', ''), 'asOf': (transit.get('meta') or {}).get('asOf', ''),
                     'rule': 'operating = on the operator roster of CityMETER · Transit; construction = a project station, not a service; straight-line distance from the office point to the station reference point, up to %d m' % RAIL_MAX_M},
        },
        'organisations': {'tab': '19_ORGANIZATION_ROLES', 'roles': {r[0]: r[1] for r in ROLES}, 'leftOut': list(ROLES_LEFT_OUT),
                          'roleRows': dict(role_counts), 'organisations': len(orgs),
                          'rule': 'a published role is a source claim of the sheet (claim_status kept in the sheet), not a tenancy, ownership or occupancy check; broker listings, unverified brand affiliations and co-marketing links are not published as organisations of the office'},
        'aliases': {'tab': '23_OFFICE_ALIASES', 'rows': sum(len(v) for v in row_aliases.values()), 'leftOut': alias_left_out,
                    'rule': 'other names of the office (sheet aliases), used for search only; address aliases are left out'},
        'conflicts': conflicts,
        'excludedFields': ['office_location_reported', '15_PROJECTS.address_reported', 'telephone numbers in source text', 'company_location_candidate_links',
                           'distinct_candidate_companies', 'verified_tenant_count', 'source_repo_commit', 'source_live_url', 'review_note', 'hierarchy_note',
                           'ownership_status', 'office_supply_review_note', 'owner_metrics_note', 'other_published_metrics', 'source_observation_ids',
                           '18_ORGANIZATIONS.legal_registration_id', 'links to the private CityMETER repository'],
        'checks': {'namePointDisagree': len(disagree), 'namePointDisagreeSample': disagree[:20], 'coordinateBases': dict(coord_used)},
        'limits': [
            'Office records come from CityMETER production (legacy, not re-verified), official pages of organisations and buildings, operator portfolios and broker portfolios checked against primary pages; the register is not a census and has no national denominator.',
            'A record is an office premises, building or component; workspace centres inside a host building are separate records. A count of records is not a count of buildings or of floor area.',
            'Rents are starting asking rents of public listings (THB/m²/month) with their month; VAT and service charges mostly unverified; not contract, achieved or average rents.',
            'Floors and areas carry their own status; GLA/GFA is often unstated; legacy values keep an unverified scope.',
            'Organisation roles are source claims; an organisation named with an office is not a verified current tenant or owner.',
            'Distances to rail stations are straight-line distances between reference points.',
        ],
    }
    data = {
        'meta': meta,
        'groups': [{'id': g[0], 'th': g[1], 'en': g[2], 'models': g[3]} for g in GROUPS],
        'models': [MODEL_TH[k] for k in models],
        'evidence': [{'id': e[0], 'th': e[1], 'statuses': e[2]} for e in EVIDENCE],
        'sizes': [{'id': s[0], 'th': s[1], 'short': s[2], 'min': s[3], 'max': s[4]} for s in SIZES],
        'sources': [{'id': s[0], 'th': s[1], 'url': s[2]} for s in sources],
        'orgs': orgs, 'roles': [{'id': r[0], 'th': r[1]} for r in ROLES], 'projects': project_list,
        'stations': out_stations,
        'urls': urls, 'provinces': provinces_list, 'districts': districts_list,
        'vocab': {'admin': ADMIN, 'coord': [c[1] for c in COORD], 'mass': MASS, 'status': list(FLOOR_STATUS.values()),
                  'areaBasis': area_bases, 'rentBasis': rent_bases},
        'rowOrgs': {str(k): v for k, v in sorted(row_orgs.items())},
        'occupancy': {str(k): v for k, v in sorted(occupancy.items())},
        'lease': {str(k): v for k, v in sorted(lease.items())},
        'legacyPrice': {str(k): v for k, v in sorted(legacy_price.items())},
        'aliases': {str(k): v for k, v in sorted(row_aliases.items())},
        'cols': cols,
    }
    os.makedirs(os.path.join(a.out, 'data'), exist_ok=True)
    path = os.path.join(a.out, 'data', 'offices.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
    report = {'release': 'office-data-' + built_on, 'sheet': {'title': SHEET_TITLE, 'readOn': a.read_on, 'inputs': inputs}, 'counts': meta['counts'],
              'excluded': [x['office'] for x in meta['excluded']], 'checks': meta['checks'], 'conflicts': len(conflicts),
              'stations': len(out_stations), 'organisations': len(orgs), 'projects': len(project_list),
              'files': [{'path': 'data/offices.json', 'bytes': os.path.getsize(path), 'sha256': sha256_file(path)}]}
    with open(os.path.join(a.out, 'data', 'build-report.json'), 'w', encoding='utf-8') as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
