/**
 * Dataset vocabulary, decoding, shared filter and summary helpers.
 *
 * Rows are the office records of “CityMETER Office — Venue, Company & Building Research Master 2026-10-24”
 * (data/offices.json, built by scripts/build-data.py). One row = one Office ID of the sheet's 01_OFFICES: an
 * organisation's office premises, a rental office building or office component, or a managed-workspace centre in a
 * host building. An Office ID can be a few floors of a building: a count of rows is a count of offices (“แห่ง”), never
 * of buildings. Nothing here merges, moves or mutates a row.
 *
 * Two measures (a contract, see DATA_METHOD.md §2):
 *   count (default) — office records (“แห่ง”, LDS `count`).
 *   rent            — the median of the starting asking rents that public listings show, THB per m² per month
 *                     (28_OFFICE_METRICS.rent_min_thb_sqm_month with a listing month; LDS `price`). An area needs at
 *                     least RENT_MIN_N such rents to carry a median; with fewer it reads “ราคาประกาศ n รายการ” (EVID-05
 *                     no_data) and its offices keep their own rents. An undated rent is shown per office only.
 * The legacy production price (period not stated) is shown per office only, named as such, never in a measure.
 *
 * Area = the เขต/อำเภอ (DISTRICT) of CityMETER production the build matched for the row (row.admin: name · point ·
 * province · conflict · none). Points are the sheet's selected points (row.coordRole says what they are).
 */
import {seriesOf} from './cues.js';

/** Short labels for tight places (matrix columns); the full Thai label stays in titles, legends and lists. */
export const GROUP_SHORT = Object.freeze({
  rental: 'ให้เช่า', workspace: 'พื้นที่ทำงาน', organization: 'องค์กร', hybrid: 'ใช้เอง+ให้เช่า', unresolved: 'ยังไม่ระบุ',
});

/** Measures: `count` (default) and `rent`. */
export const METRICS = Object.freeze({
  count: Object.freeze({id: 'count', one: 'แห่ง', label: 'สำนักงาน', subject: 'สำนักงาน', per: 'แห่ง'}),
  rent: Object.freeze({id: 'rent', one: 'บาท/ตร.ม./เดือน', label: 'ค่าเช่าที่ประกาศ', subject: 'ค่าเช่าที่ประกาศ', per: 'บาท/ตร.ม./เดือน', median: true}),
});
export const metricOf = id => METRICS[id] || METRICS.count;
/** Unit words for a measure ('' = records). */
export const unitWords = (metric = '') => ({...metricOf(metric), mode: metricOf(metric).id});
/** An area carries a median rent only with at least this many dated asking rents. */
export const RENT_MIN_N = 5;

/** Floor bands of the building the record sits in (28_OFFICE_METRICS floors); unknown floors are in none. */
export const SIZE_BANDS = Object.freeze([
  Object.freeze({id: 'f1', th: 'ไม่ถึง 10 ชั้น', short: '<10', min: 1, max: 9}),
  Object.freeze({id: 'f2', th: '10–19 ชั้น', short: '10–19', min: 10, max: 19}),
  Object.freeze({id: 'f3', th: '20–29 ชั้น', short: '20–29', min: 20, max: 29}),
  Object.freeze({id: 'f4', th: '30–39 ชั้น', short: '30–39', min: 30, max: 39}),
  Object.freeze({id: 'f5', th: '40 ชั้นขึ้นไป', short: '40+', min: 40, max: Infinity}),
]);
export const sizeOf = floors => (Number.isFinite(floors) && floors > 0 ? SIZE_BANDS.find(b => floors >= b.min && floors <= b.max)?.id || '' : '');

/**
 * Symbol size on the map: one size for every office (a record can be a few floors or a whole tower, so no record is
 * drawn larger than another); radius = k(zoom), never below PIN_MIN_RADIUS. PIN_SCALE gives k by zoom; the legend
 * and the HTML pins use the same numbers.
 */
export const PIN_SCALE = Object.freeze([[6, 0.9], [8, 1.3], [10, 2.0], [12, 3.2], [14, 4.8], [16, 5.8], [18, 6.4]]);
export const PIN_MIN_RADIUS = 1.6;
export function pinK(zoom) {
  const s = PIN_SCALE;
  if (!(zoom > s[0][0])) return s[0][1];
  for (let i = 1; i < s.length; i++) if (zoom <= s[i][0]) return s[i - 1][1] + (s[i][1] - s[i - 1][1]) * (zoom - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
  return s.at(-1)[1];
}
/** Symbol radius in px at a zoom (the same for every office). */
export const pinRadius = (_row, zoom) => Math.max(PIN_MIN_RADIUS, pinK(zoom) * 1.4);
/** The same size as a MapLibre expression: min(cap, `factor` × radius) + `add` px (zoom stays the top-level input). */
export function pinSizeExpression(factor = 1, add = 0, cap = 1e6) {
  const at = k => ['+', add, ['min', cap, ['*', factor, ['max', PIN_MIN_RADIUS, k * 1.4]]]];
  return ['interpolate', ['linear'], ['zoom'], ...PIN_SCALE.flatMap(([z, k]) => [z, at(k)])];
}
/** Size class kept for HTML pins and lists (one class: offices are drawn alike). */
export const pinSizeOf = () => 1;

/** Median of finite numbers (null for none). */
export function median(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
/** The rent a row adds to the rent measure: its dated asking rent (THB/m²/month), else null. */
export const measuredRent = r => (r?.rent && r.rent.on ? r.rent.min : null);
/** Dated asking rents of rows: n, median, range (the rent measure of a selection). */
export function rentStats(rows) {
  const values = [];
  for (const r of rows || []) { const v = measuredRent(r); if (v != null) values.push(v); }
  return {n: values.length, median: median(values), min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null};
}

/**
 * Importance of a record for labels: the mean of its percentile among all records by floors (its building) and by
 * asking rent. A record without one uses the other; with neither, 0. Ranking only — never shown as a figure.
 */
export function importanceScores(rows) {
  const pct = values => {
    const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    const n = sorted.length;
    return v => {
      if (!Number.isFinite(v) || !n) return null;
      let lo = 0, hi = n;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= v) lo = mid + 1; else hi = mid; }
      return lo / n;  // share of records at or below v
    };
  };
  const floorsPct = pct(rows.map(r => r.floors)), rentPct = pct(rows.map(r => r.rent?.min));
  return rows.map(r => {
    const parts = [floorsPct(r.floors), rentPct(r.rent?.min)].filter(v => v !== null);
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  });
}

/** The value a row adds to the count measure (1 record); for rent, its dated asking rent or null. */
export const rowValue = (r, metric = 'count') => (metric === 'rent' ? measuredRent(r) : 1);
/** The value of an aggregate ({count, rentN, rentMedian}) under a measure: records, or the median rent (null below RENT_MIN_N). */
export const valueOf = (a, metric = 'count') => (metric === 'rent' ? (a?.rentN >= RENT_MIN_N ? a.rentMedian : null) : a?.count || 0);

/** Every province of the production base info, keyed by the production route code (/v3/citymeter/{code}). */
let PROVINCE_LIST = [];
export function setProvinces(list) { PROVINCE_LIST = Object.freeze((list || []).map(p => Object.freeze({code: p.id, dopa: p.code, th: p.name, en: p.nameEn}))); }
export const provinces = () => PROVINCE_LIST;
export const provinceByCode = code => PROVINCE_LIST.find(p => p.code === String(code || '').toUpperCase()) || null;
/** Accept a production code (BKK), a DOPA code (10) or an English/Thai name; returns the production code or ''. */
export const provinceCodeFrom = value => {
  const v = String(value || '').trim();
  const p = PROVINCE_LIST.find(x => x.code === v.toUpperCase() || x.dopa === v || x.en.toLowerCase() === v.toLowerCase() || x.th === v);
  return p ? p.code : '';
};

/** A usable coordinate inside Thailand's bounding box (never invented). */
export const hasPoint = r => Number.isFinite(r?.latitude) && Number.isFinite(r?.longitude) &&
  r.latitude >= 5 && r.latitude <= 21 && r.longitude >= 97 && r.longitude <= 106;

const lower = v => String(v || '').toLocaleLowerCase('th-TH');
const pos = v => (Number.isFinite(v) && v > 0 ? v : null);
const plain = v => String(v || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
/** An organisation's name without the sheet's trailing note in brackets (“Central Pattana Office (official …)”). */
export const shortOrgName = name => String(name || '').replace(/\s*\([^)]*(?:official|website|portfolio|brand|group)[^)]*\)\s*$/i, '').trim() || String(name || '');

/** The line under an office's name: its other name (Thai or English) when it differs. '' when there is none. */
export const subName = r => (r?.alt && r.alt !== r.name ? r.alt : '');

/**
 * Decode data/offices.json into row objects plus dictionaries.
 * `index` is the area index (js/areas.js#buildAreaIndex): every placed district code must exist there.
 */
export function decodeDataset(json, index) {
  if (!json?.cols || !Array.isArray(json.cols.key)) throw new Error('Invalid office dataset');
  const c = json.cols, n = c.key.length, V = json.vocab || {};
  const groups = (json.groups || []).map((g, i) => ({...g, index: i, series: seriesOf(g.id), short: GROUP_SHORT[g.id] || g.th}));
  const evidence = (json.evidence || []).map((e, i) => ({...e, index: i}));
  const roles = (json.roles || []).map((x, i) => ({...x, index: i}));
  const orgs = (json.orgs || []).map((o, i) => ({...o, index: i, short: shortOrgName(o.name)}));
  const sources = json.sources || [];
  const stations = (json.stations || []).map((s, i) => ({...s, index: i}));
  const urls = json.urls || [];
  const url = i => (i >= 0 ? urls[i] || '' : '');
  const rowOrgs = json.rowOrgs || {}, occupancy = json.occupancy || {}, lease = json.lease || {}, legacy = json.legacyPrice || {}, aliases = json.aliases || {};
  const rows = [];
  let dropped = 0;
  for (let i = 0; i < n; i++) {
    const area = c.district[i] >= 0 ? json.districts[c.district[i]] : '';
    const province = c.province[i] >= 0 ? json.provinces[c.province[i]] : '';
    if (area && !index?.byId.has(area)) { dropped++; continue; }
    const group = groups[c.group[i]] || groups.at(-1);
    const floors = pos(c.floors[i]);
    const source = sources[c.src[i]] || {id: '', th: '', url: ''};
    const lat = c.lat[i], lon = c.lon[i];
    const k = String(i);
    const row = {
      id: c.key[i], name: plain(c.name[i]), alt: plain(c.alt[i]), nameEn: '', index: i,
      group: group.index, groupId: group.id, series: group.series, model: json.models?.[c.model[i]] || '',
      evidence: evidence[c.ev[i]] || null, evidenceId: evidence[c.ev[i]]?.id || '',
      floors, floorStatus: c.fst[i] >= 0 ? V.status?.[c.fst[i]] || '' : '', size: sizeOf(floors),
      space: pos(c.area[i]) ? {sqm: c.area[i], basis: V.areaBasis?.[c.abasis[i]] || '', status: V.status?.[c.ast[i]] || ''} : null,
      rent: pos(c.rmin[i]) ? {min: c.rmin[i], max: pos(c.rmax[i]), on: c.ron[i] || '', basis: V.rentBasis?.[c.rbasis[i]] || '', url: url(c.rurl[i])} : null,
      legacyPrice: legacy[k] ? {min: pos(legacy[k][0]), max: pos(legacy[k][1])} : null,
      year: pos(c.year[i]),
      lease: lease[k] ? {sqm: lease[k][0], ref: lease[k][1] || '', url: url(lease[k][2])} : null,
      occupancy: occupancy[k] ? {rate: occupancy[k][0], ref: occupancy[k][1] || '', scope: occupancy[k][2] || '', url: url(occupancy[k][3])} : null,
      orgs: (rowOrgs[k] || []).map(([o, rs]) => ({org: orgs[o], roles: rs.map(x => roles[x]).filter(Boolean)})).filter(x => x.org),
      project: c.proj[i] >= 0 ? json.projects?.[c.proj[i]] || '' : '',
      aliases: aliases[k] || [],
      area, province, admin: V.admin?.[c.admin[i]] || 'none',
      longitude: Number.isFinite(lon) ? lon : null, latitude: Number.isFinite(lat) ? lat : null, coordRole: c.coord[i] >= 0 ? V.coord?.[c.coord[i]] || '' : '',
      source, url: url(c.url[i]), mass: V.mass?.[c.mass[i]] || 'not_checked', osmUrl: url(c.bld[i]),
      rail: c.rail[i] >= 0 ? {station: stations[c.rail[i]], m: c.railM[i]} : null,
      railNext: c.rail2[i] >= 0 ? {station: stations[c.rail2[i]], m: c.rail2M[i]} : null,
    };
    const a = area ? index.byId.get(area) : null;
    const p = province ? PROVINCE_LIST.find(x => x.code === province) : null;
    row.haystack = lower([row.name, row.alt, ...row.aliases, ...row.orgs.map(o => o.org.name), row.project, a?.name, a?.nameEn, p?.th, p?.en, group.th].filter(Boolean).join(' '));
    rows.push(row);
  }
  const scores = importanceScores(rows);
  rows.forEach((r, i) => { r.importance = scores[i]; });
  return {meta: json.meta || {}, rows, groups, evidence, roles, orgs, stations, sources, dropped};
}

/**
 * Shared filter used by map, counters, charts, panel and table.
 * f = {search, group, ev, size, province, org}; org 'none' = offices with no organisation in the data.
 * Area selection and area focus are applied by the caller (row scopes, see app.js).
 */
export function filterRows(rows, f = {}) {
  // Every word of the search, anywhere in the office's names, other names, organisations, project, area or type.
  const terms = lower(f.search).trim().split(/\s+/).filter(Boolean);
  return rows.filter(r => {
    if (f.group && r.groupId !== f.group) return false;
    if (f.ev && r.evidenceId !== f.ev) return false;
    if (f.size && r.size !== f.size) return false;
    if (f.province && r.province !== f.province) return false;
    if (f.org === 'none' ? r.orgs.length : f.org && !r.orgs.some(o => o.org.id === f.org)) return false;
    return terms.every(t => r.haystack.includes(t));
  });
}

/** Totals for a selection: records, points, placement, organisations, floors known and the rent measure. */
export function summarize(rows) {
  let points = 0, placed = 0, provinced = 0, withOrg = 0, floorsKnown = 0;
  const orgs = new Set(), areas = new Set(), provinces = new Set();
  for (const r of rows) {
    if (hasPoint(r)) points++;
    if (r.area) { placed++; areas.add(r.area); }
    if (r.province) { provinced++; provinces.add(r.province); }
    if (r.orgs.length) withOrg++;
    for (const o of r.orgs) orgs.add(o.org.id);
    if (r.floors) floorsKnown++;
  }
  const rent = rentStats(rows);
  return {count: rows.length, points, placed, provinced, withOrg, floorsKnown, orgs: orgs.size, areas: areas.size, provinces: provinces.size,
    rentN: rent.n, rentMedian: rent.median, rent};
}

/** Records and dated rents per group for a selection (every group listed, zero kept as a measured 0). */
export function mixOf(rows, groups) {
  const byGroup = groups.map(g => ({id: g.id, index: g.index, series: g.series, th: g.th, short: g.short, count: 0, rentN: 0}));
  for (const r of rows) { const g = byGroup[r.group]; g.count++; if (measuredRent(r) != null) g.rentN++; }
  return {byGroup};
}

/** Records per floor band (unknown floors apart). */
export function sizeMixOf(rows) {
  const bands = SIZE_BANDS.map(b => ({...b, count: 0}));
  let unknown = 0;
  for (const r of rows) {
    const b = r.size ? bands.find(x => x.id === r.size) : null;
    if (b) b.count++; else unknown++;
  }
  return {bands, unknown};
}

/** Share of the offices within `m` metres (straight line) of an operating rail station; rows with a point only. */
export function railShare(rows, _metric = 'count', m = 500) {
  let within = 0, base = 0, noPoint = 0;
  for (const r of rows) {
    if (!hasPoint(r)) { noPoint++; continue; }
    base++;
    if (r.rail && r.rail.m <= m) within++;
  }
  return {within, base, noPoint, share: base ? (within / base) * 100 : null};
}

/** Asking rents near rail and farther from it (rows with a point and a dated rent): median and n of each side. */
export function rentNearRail(rows, m = 500) {
  const near = [], far = [];
  for (const r of rows) {
    if (!hasPoint(r) || measuredRent(r) == null) continue;
    (r.rail && r.rail.m <= m ? near : far).push(r);
  }
  return {m, near: rentStats(near), far: rentStats(far)};
}

export const safeURL = value => {
  try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; }
  catch { return ''; }
};

/**
 * Production CityMETER deep links (route scheme observed in the production bundle, 2026-10-22). Production has an
 * office dataset (`?d=office`, dataset code `office` in web-v3 datasets.ts), so the link opens the same area with it.
 */
export const PRODUCTION = 'https://landometer.com/v3/citymeter';
export function productionLink({province = '', area = ''} = {}) {
  if (!province) return `${PRODUCTION}?d=office`;
  if (area) return `${PRODUCTION}/${province}/D/${area}?d=office`;
  return `${PRODUCTION}/${province}?d=office`;
}
/** CityMETER sibling demo linked by registry id. */
export const TRANSIT_SITE = 'https://montri-th.github.io/transit/';
export const stationLink = s => (s?.id ? `${TRANSIT_SITE}?station=${encodeURIComponent(s.id)}` : '');
