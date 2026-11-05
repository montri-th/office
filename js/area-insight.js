/**
 * First Aha: where the offices of the register concentrate — the top เขต/อำเภอ of the leading province — and how close
 * they sit to rail; on the rent measure, where the asking rents are highest.
 *
 * count (default): offices per district (LDS `count`). One 3D frame: the leading province is the province holding the
 * most offices placed at district level; the Aha shows up to three districts of that province with the most of them
 * (one coherent city scene) and their share of the province's offices in the selection (`homeValue`: placed rows and
 * rows the sources place only at province level), numerator and denominator stated. The focus is never every district
 * that holds offices (a province with N ≤ 3 such districts shows its top N − 1). The district with the most outside
 * that province is the third finding.
 *
 * rent: the median of the dated asking rents (LDS `price`, THB per m² per month) per district with at least
 * RENT_MIN_N of them. The leading province holds the most dated rents; the Aha shows up to three of its districts with
 * the highest median, each with its n, beside the province's own median (every dated rent of its offices, n stated).
 * Rail: the median rent within RAIL_M metres in a straight line of an operating station against the rest of the
 * province (n of each side). The district with the highest median outside the province is the third finding.
 *
 * Ties: the focus never cuts through a tie. When the district after the last one shown has the same value, the tied
 * districts join the focus while it stays within limit + 1 districts and leaves at least one district of the province
 * out; otherwise only the districts strictly above that value are shown (possibly one, possibly none). With none —
 * every district of the province holds the same value — the Aha says the supply is spread (`spread`). The outside
 * finding lists every district tied at its top value.
 *
 * Rail (CityMETER · Transit, a dataset of the same registry): straight-line radius from the station reference point,
 * never a walking route or a catchment; rows without a point are left out of both bases.
 *
 * Snapshot values in the handoff JSON are regression fixtures, never UI constants.
 */
import {summarizeAreas, byMetric} from './areas.js';
import {valueOf, rowValue, railShare, rentStats, rentNearRail, measuredRent, RENT_MIN_N} from './model.js';

export const RAIL_M = 500;

/** Top districts of the leading province without cutting through a tie (see the header). */
function focusOf(homeRanked, limit) {
  const cap = Math.min(limit, Math.max(1, homeRanked.length - 1));
  let areas = homeRanked.slice(0, cap);
  const cut = homeRanked[cap];
  if (cut && areas.at(-1).value === cut.value) {
    const extended = homeRanked.filter(a => a.value >= cut.value);
    areas = extended.length <= limit + 1 && extended.length < homeRanked.length ? extended : areas.filter(a => a.value > cut.value);
  }
  return areas;
}

function outsideOf(ranked, home) {
  const outsideRanked = ranked.filter(a => a.province !== home);
  const outsideTop = outsideRanked.filter(a => a.value === outsideRanked[0]?.value);
  return outsideTop.length ? {id: outsideTop[0].id, name: outsideTop[0].name, province: outsideTop[0].province, value: outsideTop[0].value,
    count: outsideTop[0].count, rentN: outsideTop[0].rentN, tied: outsideTop.map(a => ({id: a.id, name: a.name, province: a.province}))} : null;
}

function rentInsight(selected, index, {limit}) {
  const summaries = summarizeAreas(selected, index).map(a => ({...a, value: valueOf(a, 'rent')}));
  const ranked = summaries.filter(a => a.value != null).sort(byMetric('rent'));
  const quotesBy = new Map();
  for (const r of selected) if (r.province && measuredRent(r) != null) quotesBy.set(r.province, (quotesBy.get(r.province) || 0) + 1);
  const home = [...quotesBy].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] || '';
  const homeRanked = ranked.filter(a => a.province === home);
  const areas = focusOf(homeRanked, limit);
  const spread = !areas.length && homeRanked.length > 1 ? {areas: homeRanked.length, value: homeRanked[0].value} : null;
  const ids = new Set(areas.map(a => a.id));
  const homeRows = home ? selected.filter(r => r.province === home) : [];
  const focusRows = homeRows.filter(r => ids.has(r.area));
  const homeStats = rentStats(homeRows);
  return {
    mode: 'rent', metric: 'rent', areas, areaIds: areas.map(a => a.id), home, spread, homeAreaIds: homeRanked.map(a => a.id),
    value: areas[0]?.value ?? null, count: focusRows.length, focusRent: rentStats(focusRows),
    homeRows: homeRows.length, homeStats, homeValue: homeStats.median, national: rentStats(selected), minN: RENT_MIN_N,
    rail: rentNearRail(homeRows, RAIL_M), measuredAreas: ranked.length,
    quotedAreas: summaries.filter(a => a.rentN > 0).length,
    totalRows: selected.length, placedRows: selected.filter(r => r.area).length, areaCount: summaries.length,
    outside: outsideOf(ranked, home),
  };
}

export function summarizeAreaInsight(rows = [], index, {limit = 3, metric = 'count'} = {}) {
  const selected = Array.isArray(rows) ? rows : [];
  if (metric === 'rent') return rentInsight(selected, index, {limit});
  const summaries = summarizeAreas(selected, index).map(a => ({...a, value: valueOf(a, 'count')}));
  const ranked = summaries.filter(a => a.value > 0).sort(byMetric('count'));
  const placedBy = new Map();
  for (const r of selected) if (r.area && r.province) placedBy.set(r.province, (placedBy.get(r.province) || 0) + 1);
  const home = [...placedBy].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] || '';
  const homeRanked = ranked.filter(a => a.province === home);
  const areas = focusOf(homeRanked, limit);
  const spread = !areas.length && homeRanked.length ? {areas: homeRanked.length, value: homeRanked[0].value} : null;
  const ids = new Set(areas.map(a => a.id));
  const value = areas.reduce((s, a) => s + a.value, 0);
  const homeRows = home ? selected.filter(r => r.province === home) : [];
  const homePlaced = homeRows.filter(r => r.area);
  const focusRows = homePlaced.filter(r => ids.has(r.area));
  const rest = homePlaced.filter(r => !ids.has(r.area));
  const sum = list => list.reduce((s, r) => s + rowValue(r, 'count'), 0);
  const homePlacedValue = sum(homePlaced), homeValue = sum(homeRows);
  return {
    mode: 'count', metric: 'count', areas, areaIds: areas.map(a => a.id), home, value, count: focusRows.length, spread, homeAreaIds: homeRanked.map(a => a.id),
    homeRows: homeRows.length, homeValue, homePlaced: homePlaced.length, homePlacedValue, homeUnplaced: homeRows.length - homePlaced.length,
    homeUnplacedValue: sum(homeRows.filter(r => !r.area)),
    share: homeValue ? (value / homeValue) * 100 : 0,
    rail: {m: RAIL_M, focus: railShare(focusRows, 'count', RAIL_M), rest: railShare(rest, 'count', RAIL_M)},
    totalRows: selected.length, placedRows: selected.filter(r => r.area).length, areaCount: summaries.length,
    outside: outsideOf(ranked, home),
  };
}

/** Rows inside a set of district ids (membership = the row's own matched district). */
export function filterAreaRows(rows, areaIdsSet) {
  if (!(areaIdsSet instanceof Set) || !areaIdsSet.size) return [];
  return (Array.isArray(rows) ? rows : []).filter(r => areaIdsSet.has(r.area));
}
