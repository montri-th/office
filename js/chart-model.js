/**
 * Chart models — every chart describes scopeRows (filters before any area selection) over the same membership as
 * the map (the row's own matched district). Ranking and top-N trimming happen only after every district has been
 * summarised. The district bars read the map's measure (offices, or the median dated asking rent of the districts that
 * carry one); the matrix and the organisation bars count offices.
 */
import {rankAreas, orgsIn} from './profile-model.js';

export function buildChartModel(rows, index, groups, {limit = 20, metric = 'count'} = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const measured = a => (metric === 'rent' ? a.value != null : a.value > 0);
  const ranking = rankAreas(list, index, {metric}).filter(measured);
  const unplaced = list.filter(r => !r.area);
  return {metric, areas: ranking.slice(0, limit), totalAreas: ranking.length, values: ranking.map(a => a.value), groups, totalRows: list.length,
    placedRows: list.length - unplaced.length, unplacedCount: unplaced.length,
    quotedAreas: metric === 'rent' ? rankAreas(list, index, {metric}).filter(a => a.rentN > 0).length : 0};
}

/** District × office category matrix of office counts (equal cells; zero is a measured 0 in this selection). */
export function areaMatrix(rows, index, groups, {areaLimit = 12} = {}) {
  const areas = rankAreas(Array.isArray(rows) ? rows : [], index, {metric: 'count'}).filter(a => a.value > 0).slice(0, areaLimit);
  const cells = areas.flatMap(a => {
    const counts = new Array(groups.length).fill(0);
    for (const r of a.rows) counts[r.group]++;
    return groups.map(g => ({areaId: a.id, areaName: a.name, groupId: g.id, group: g.index, groupName: g.th, value: counts[g.index], count: counts[g.index], total: a.value}));
  });
  return {areas, groups, cells, max: Math.max(0, ...cells.map(c => c.value))};
}

/** Organisations of the selection ranked by offices; every organisation counted, the list cut after ranking. */
export function orgRanking(rows, {limit = 20} = {}) {
  const all = orgsIn(Array.isArray(rows) ? rows : [], Infinity);
  return {orgs: all.slice(0, limit), total: all.length};
}
