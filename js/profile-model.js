/**
 * Reading-panel view models. Pure: no DOM, no map.
 *
 * Every profile reads `scopeRows` (filters before any area selection) so ranks and comparisons keep the whole
 * selection as reference. A row is one office record of the research master (01_OFFICES); the default measure is
 * office records (“แห่ง”), the other the median of the dated asking rents (THB/m²/month, n stated, a median from
 * RENT_MIN_N rents). Organisations are the sheet's own roles (19_ORGANIZATION_ROLES → 18_ORGANIZATIONS) joined by id
 * at build time; nothing is joined by a name. Points are the sheet's selected points and are never upgraded; district
 * membership is the matched production code (row.admin says how).
 *
 * Distances (rent comparison set, station surroundings) are straight lines between reference points, computed here
 * from the published coordinates; they are not walking routes, travel times or catchments.
 */
import {mixOf, sizeMixOf, hasPoint, valueOf, railShare, rentStats, rentNearRail, measuredRent} from './model.js';
import {summarizeAreas, byMetric, levelWords} from './areas.js';

const COLLATOR = new Intl.Collator('th');
/** Lists: the tallest building first (unknown floors last), then name — the scale users scan by. */
export const listOrder = (a, b) => (b.floors || 0) - (a.floors || 0) || COLLATOR.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Rent lists: the highest asking rent first, then name. */
export const rentOrder = (a, b) => (b.rent?.min || 0) - (a.rent?.min || 0) || listOrder(a, b);

export function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371008.8, rad = Math.PI / 180;
  const p1 = lat1 * rad, p2 = lat2 * rad, dp = (lat2 - lat1) * rad, dl = (lon2 - lon1) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Organisations present in rows, most offices first (then dated rents, then name). */
export function orgsIn(rows, limit = 12) {
  const m = new Map();
  for (const r of rows) for (const o of r.orgs) {
    const e = m.get(o.org.id) || {org: o.org, count: 0, rentN: 0, roles: new Set()};
    e.count++; if (measuredRent(r) != null) e.rentN++;
    for (const x of o.roles) e.roles.add(x.th);
    m.set(o.org.id, e);
  }
  return [...m.values()].map(e => ({...e, value: e.count, roles: [...e.roles]}))
    .sort((a, b) => b.count - a.count || b.rentN - a.rentN || COLLATOR.compare(a.org.short, b.org.short)).slice(0, limit);
}

/** Offices linked to at least one organisation in the data. */
export const withOrgOf = rows => rows.filter(r => r.orgs.length).length;

/** Records per evidence group (every group listed). */
export function evidenceMixOf(rows, evidence = []) {
  const list = evidence.map(e => ({id: e.id, th: e.th, count: 0}));
  for (const r of rows) { const e = list.find(x => x.id === r.evidenceId); if (e) e.count++; }
  return list;
}

/** Districts of a selection ranked by the measure (ties: the other figures, then name). */
export function rankAreas(rows, index, {province = '', metric = 'count'} = {}) {
  return summarizeAreas(rows, index, {province}).map(a => ({...a, value: valueOf(a, metric)})).sort(byMetric(metric));
}

/** Rows of the selection that no district holds, by reason (rows are never placed by name at runtime). */
export function unplacedOf(rows) {
  let noArea = 0, noProvince = 0, conflict = 0;
  for (const r of rows) {
    if (r.area) continue;
    if (r.admin === 'conflict') conflict++;
    else if (r.province) noArea++;
    else noProvince++;
  }
  return {noArea, noProvince, conflict, total: noArea + noProvince + conflict};
}

export function buildOverview(scopeRows, index, {province = '', groups = [], evidence = [], metric = 'count'} = {}) {
  return {ranking: rankAreas(scopeRows, index, {province, metric}), orgs: orgsIn(scopeRows, 12), withOrg: withOrgOf(scopeRows), unplaced: unplacedOf(scopeRows),
    mix: mixOf(scopeRows, groups), sizes: sizeMixOf(scopeRows), evidence: evidenceMixOf(scopeRows, evidence), count: scopeRows.length,
    rent: rentStats(scopeRows), rail: railShare(scopeRows), rentRail: rentNearRail(scopeRows)};
}

/**
 * EVID-05 state of a selection: every district is in the national scope of the register, so a district with no
 * record is a measured zero of this dataset (“0 ที่พบ”), never no_data.
 */
const selectionState = count => (count ? 'measured' : 'measured_zero');

/**
 * Stations whose 500 m straight-line radius holds the most offices among `rows` (each row counted at its nearest
 * operating station only, so the list never adds a row twice), with the dated rents among them.
 */
export function stationsOf(rows, _metric = 'count', m = 500, limit = 6) {
  const by = new Map();
  for (const r of rows) {
    if (!r.rail || r.rail.m > m) continue;
    const s = r.rail.station, e = by.get(s.id) || {station: s, count: 0, value: 0, rows: []};
    e.count++; e.value++; e.rows.push(r); by.set(s.id, e);
  }
  return [...by.values()].map(e => ({...e, rent: rentStats(e.rows)})).sort((a, b) => b.value - a.value || COLLATOR.compare(a.station.name, b.station.name)).slice(0, limit);
}

export function buildAreaProfile(scopeRows, areaId, index, groups, {metric = 'count', evidence = []} = {}) {
  const area = index.byId.get(areaId);
  if (!area) return null;
  const ranking = rankAreas(scopeRows, index, {metric});
  const measured = a => (metric === 'rent' ? a.value != null : a.value > 0);
  const inProvince = ranking.filter(a => a.province === area.province);
  const mine = scopeRows.filter(r => r.area === areaId);
  // Share of the province's offices in the scope (placed rows and rows placed only at province level).
  const provinceRows = scopeRows.filter(r => r.province === area.province);
  const me = ranking.find(a => a.id === areaId);
  // Competition ranks: districts with the same value share a rank (“อันดับ 3 (ร่วม)”), never split by a tiebreak.
  const rankIn = list => {
    const m = list.filter(measured);
    if (!me || !measured(me)) return {rank: null, of: m.length, tied: false};
    return {rank: 1 + m.filter(a => a.value > me.value).length, of: m.length, tied: m.filter(a => a.value === me.value).length > 1};
  };
  const nat = rankIn(ranking), prv = rankIn(inProvince);
  const rent = rentStats(mine), provinceRent = rentStats(provinceRows);
  return {
    area, words: levelWords(area.province), metric, value: me ? me.value : valueOf({count: 0, rentN: 0}, metric), count: mine.length,
    km2: area.km2, coverageState: selectionState(mine.length), scopeCount: scopeRows.length,
    rank: nat.rank, rankOf: nat.of, rankTied: nat.tied,
    rankProvince: prv.rank, rankProvinceOf: prv.of, rankProvinceTied: prv.tied,
    provinceCount: provinceRows.length, share: provinceRows.length ? (mine.length / provinceRows.length) * 100 : null,
    rent, provinceRent, rentRows: mine.filter(r => r.rent).sort(rentOrder),
    points: mine.filter(hasPoint).length, ...mixOf(mine, groups), sizes: sizeMixOf(mine), evidence: evidenceMixOf(mine, evidence),
    orgs: orgsIn(mine, 12), withOrg: withOrgOf(mine), rail: railShare(mine), stations: stationsOf(mine),
    rows: [...mine].sort(listOrder),
  };
}

/** Organisation card: its offices in the data and in the scope, its roles, and where they are. */
export function buildOrgProfile(orgId, {allRows, scopeRows, index, data, metric = 'count'}) {
  const org = data.orgs.find(o => o.id === orgId);
  if (!org) return null;
  const has = r => r.orgs.some(o => o.org.id === orgId);
  const all = allRows.filter(has);
  const inScope = scopeRows.filter(has);
  const roles = new Map();
  for (const r of inScope) for (const o of r.orgs) if (o.org.id === orgId) for (const x of o.roles) roles.set(x.th, (roles.get(x.th) || 0) + 1);
  return {org, all: all.length, scopeCount: inScope.length, roles: [...roles].sort((a, b) => b[1] - a[1]),
    areas: rankAreas(inScope, index, {metric: 'count'}), provinces: new Set(inScope.map(r => r.province).filter(Boolean)).size,
    points: inScope.filter(hasPoint).length, placed: inScope.filter(r => r.area).length, rail: railShare(inScope), rent: rentStats(inScope), metric,
    rows: [...inScope].sort(listOrder)};
}

/**
 * A building the map draws, with the rows whose points fall inside it (building-join.js):
 * sel = {key, kind: 'osm' | 'cm', rows, height}. Not a venue: no name.
 */
export function buildBuildingProfile(sel, index, groups) {
  if (!sel?.rows?.length) return null;
  const rows = [...sel.rows].sort(listOrder);
  const area = index.byId.get(rows[0].area) || null;
  const areaIds = [...new Set(rows.map(r => r.area))];
  return {key: sel.key, kind: sel.kind || 'osm', rows, count: rows.length, rent: rentStats(rows),
    area, areaCount: areaIds.length, words: levelWords(rows[0].province), height: Number.isFinite(sel.height) ? sel.height : null,
    orgs: orgsIn(rows, 6), ...mixOf(rows, groups)};
}

export const COMPSET_RADIUS_M = 1000;
export const COMPSET_LIMIT = 8;

/**
 * Rent comparison set of an office (a screening aid, not a valuation): the other offices with an asking rent whose
 * point lies within COMPSET_RADIUS_M in a straight line, nearest first; beside it every office within the radius and
 * the median of their dated rents. Reads every row of the dataset (`allRows`), so the set does not move with the filters.
 */
export function compsetOf(row, allRows, {radius = COMPSET_RADIUS_M, limit = COMPSET_LIMIT} = {}) {
  if (!hasPoint(row)) return null;
  const dLat = radius / 110574, dLon = radius / (111320 * Math.cos((row.latitude * Math.PI) / 180));
  const near = [], around = [];
  for (const r of allRows) {
    if (r === row || !hasPoint(r)) continue;
    if (Math.abs(r.latitude - row.latitude) > dLat || Math.abs(r.longitude - row.longitude) > dLon) continue;
    const m = distanceM(row.latitude, row.longitude, r.latitude, r.longitude);
    if (m > radius) continue;
    around.push(r);
    if (r.rent) near.push({row: r, m});
  }
  near.sort((a, b) => a.m - b.m || listOrder(a.row, b.row));
  return {radius, around: {count: around.length, rent: rentStats(around)}, matches: near.length, rows: near.slice(0, limit)};
}

/** Office detail: the rent comparison set, the other offices of its organisations, and its rail context. */
export function buildOfficeDetail(row, {scopeRows, allRows, index, groups, building = null}) {
  if (!row) return null;
  const area = row.area ? index.byId.get(row.area) || null : null;
  const sameOrg = row.orgs.map(o => {
    const others = allRows.filter(r => r.id !== row.id && r.orgs.some(x => x.org.id === o.org.id));
    return {org: o.org, roles: o.roles, count: others.length, provinces: new Set(others.map(r => r.province).filter(Boolean)).size};
  });
  const sameArea = row.area ? scopeRows.filter(r => r.area === row.area && r.id !== row.id) : [];
  return {row, area, words: levelWords(row.province), group: groups[row.group], building,
    compset: compsetOf(row, allRows), sameOrg, sameArea: {count: sameArea.length, rent: rentStats(sameArea)}};
}

export const STATION_RADIUS_M = 500;

/**
 * A rail station of CityMETER · Transit and the offices whose points lie within STATION_RADIUS_M of its reference
 * point (straight line; an office near two stations is listed at both — this view never adds stations together).
 */
export function buildStationProfile(station, {scopeRows, groups, radius = STATION_RADIUS_M, metric = 'count'}) {
  if (!station) return null;
  const rows = [];
  const dLat = radius / 110574, dLon = radius / (111320 * Math.cos((station.lat * Math.PI) / 180));
  for (const r of scopeRows) {
    if (!hasPoint(r) || Math.abs(r.latitude - station.lat) > dLat || Math.abs(r.longitude - station.lon) > dLon) continue;
    const m = distanceM(station.lat, station.lon, r.latitude, r.longitude);
    if (m <= radius) rows.push({row: r, m});
  }
  rows.sort((a, b) => listOrder(a.row, b.row));
  const list = rows.map(x => x.row);
  return {station, radius, metric, count: list.length, value: list.length, rent: rentStats(list), ...mixOf(list, groups), sizes: sizeMixOf(list),
    orgs: orgsIn(list, 8), rows: list, distance: new Map(rows.map(x => [x.row.id, x.m]))};
}
