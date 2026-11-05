/**
 * Province frames for the country view: with the whole country on screen the map still shows where the offices
 * are — every one of the 77 provinces is a frame to drill down into.
 *
 * Below PROVINCE_FILL_MAX_ZOOM every frame is filled with the family of the measure (office records per province →
 * LDS `count`, a total; median dated asking rent → LDS `price`). From there up only the outline remains until
 * PROVINCE_OUTLINE_MAX_ZOOM, where the เขต/อำเภอ carry the reading. With a จังหวัด filter no frame is filled: the
 * selected one shows its own เขต/อำเภอ at every zoom (js/map-layers.js, province view) under its selection stroke, the
 * others go quiet (outline).
 *
 * Boundaries: data/provinces.geojson (copied unchanged from montri-th/pharmacy@98d9035, where it was dissolved
 * from CityMETER production subdistrict boundaries) — navigation frames, never an administrative claim.
 * EVID-05, count: measured · measured_zero (no office of the register under the filters — a 0 of this dataset, not a
 * census). Rent: measured (≥ RENT_MIN_N dated rents) · no_data (offices, fewer rents: hatch) · out_of_scope (no office:
 * bare). Rows without a province are not on any frame; the panel counts them apart (“ไม่ระบุจังหวัด”).
 */
import {provinceByCode, metricOf, valueOf, rentStats} from './model.js';
import {buildMetricRamp, classify} from './scales.js';
import {featureBounds, firstLineLayerId, hatchImage, GEOJSON_MAXZOOM} from './map-layers.js';

export const PROVINCE_FILL_MAX_ZOOM = 8;
export const PROVINCE_OUTLINE_MAX_ZOOM = 12;
export const PROVINCE_LABEL_MAX_ZOOM = 9;
const SOURCE = 'provinces';
export const PROVINCE_LAYERS = Object.freeze({fill: 'province-fill', hatch: 'province-nodata', zero: 'province-zero-outline', outline: 'province-outline', selected: 'province-selected'});
const HATCH = 'nodata-hatch';

function cssVar(name, fallback) {
  const value = typeof getComputedStyle === 'function' && typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
  return value || fallback;
}

/** Per-province model: the measure per province among `rows` (rows carry the production province code). */
export function buildProvinceModel(rows, geojson, {metric = 'count'} = {}) {
  const by = new Map();
  for (const r of rows || []) { let a = by.get(r.province); if (!a) by.set(r.province, a = []); a.push(r); }
  const provinces = (geojson?.features || []).map(f => {
    const code = String(f.id ?? f.properties?.id);
    const meta = provinceByCode(code) || {code, th: f.properties?.name || code, en: f.properties?.nameEn || code};
    const members = by.get(code) || [], rent = rentStats(members);
    const p = {id: code, code, name: meta.th, nameEn: meta.en, count: members.length, rentN: rent.n, rentMedian: rent.median, label: f.properties?.label || null, feature: f};
    p.value = valueOf(p, metric);
    return p;
  });
  const ramp = buildMetricRamp(provinces.map(p => p.value), {metric, unit: metricOf(metric).one});
  for (const p of provinces) {
    const c = metric !== 'rent' ? classify(p.value, ramp) : !p.count ? classify(null, ramp, 'out_of_scope') : p.value == null ? classify(null, ramp, 'no_data') : classify(p.value, ramp);
    p.state = c.state; p.fill = c.fill; p.ink = c.ink; p.outline = c.outline || null;
  }
  return {metric, provinces, ramp, zeroCount: provinces.filter(p => p.state === 'measured_zero').length, noDataCount: provinces.filter(p => p.state === 'no_data').length};
}

export function installProvinceLayers(map, geojson) {
  const beforeId = firstLineLayerId(map);
  map.addSource(SOURCE, {type: 'geojson', data: geojson, maxzoom: GEOJSON_MAXZOOM, promoteId: 'id'});
  if (!map.hasImage(HATCH)) map.addImage(HATCH, hatchImage(cssVar('--data-no-data', '#D5DAD6'), cssVar('--border-emphasis', '#7D877F')));
  const fs = (key, on, off = 0) => ['case', ['boolean', ['feature-state', key], false], on, off];
  map.addLayer({id: PROVINCE_LAYERS.fill, type: 'fill', source: SOURCE, maxzoom: PROVINCE_FILL_MAX_ZOOM,
    paint: {'fill-color': ['coalesce', ['feature-state', 'fill'], '#000000'], 'fill-opacity': fs('filled', 1), 'fill-antialias': true}}, beforeId);
  map.addLayer({id: PROVINCE_LAYERS.hatch, type: 'fill', source: SOURCE, maxzoom: PROVINCE_FILL_MAX_ZOOM,
    paint: {'fill-pattern': HATCH, 'fill-opacity': fs('nodata', 1)}}, beforeId);
  map.addLayer({id: PROVINCE_LAYERS.zero, type: 'line', source: SOURCE, maxzoom: PROVINCE_FILL_MAX_ZOOM,
    paint: {'line-color': cssVar('--data-zero-outline', '#7D877F'), 'line-width': 2, 'line-opacity': fs('zero', 1)}}, beforeId);
  map.addLayer({id: PROVINCE_LAYERS.outline, type: 'line', source: SOURCE, maxzoom: PROVINCE_OUTLINE_MAX_ZOOM,
    paint: {'line-color': ['case', ['boolean', ['feature-state', 'quiet'], false], cssVar('--border-default', '#C9D0CB'), cssVar('--border-emphasis', '#7D877F')],
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 9, 1.2, 12, 1.6], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10.5, 1, 12, 0.35]}});
  map.addLayer({id: PROVINCE_LAYERS.selected, type: 'line', source: SOURCE, maxzoom: 13,
    paint: {'line-color': cssVar('--map-selected-stroke', '#176B82'), 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 9, 2.4],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, fs('selected', 1), 13, fs('selected', 0.3)]}});
  let current = {provinces: [], ramp: null, zeroCount: 0};
  const ids = (geojson?.features || []).map(f => String(f.id ?? f.properties?.id));

  /** rows: the filtered scope WITHOUT the province filter (every frame keeps its own count); selectedCode: the จังหวัด filter. */
  function update({rows = [], selectedCode = '', visible = true, metric = 'count'} = {}) {
    current = buildProvinceModel(rows, geojson, {metric});
    const byId = new Map(current.provinces.map(p => [p.code, p]));
    for (const id of ids) {
      const p = byId.get(id);
      p.selected = id === selectedCode; p.quiet = Boolean(selectedCode) && !p.selected;
      const filled = !selectedCode; // a จังหวัด filter: its เขต/อำเภอ carry the reading (no count fill under them)
      map.setFeatureState({source: SOURCE, id}, {fill: p.fill, filled: filled && Boolean(p.fill), nodata: filled && p.state === 'no_data',
        zero: filled && p.state === 'measured_zero', quiet: p.quiet, selected: p.selected});
    }
    for (const id of Object.values(PROVINCE_LAYERS)) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    return current;
  }
  function dispose() {
    for (const id of Object.values(PROVINCE_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
  }
  return {update, dispose, model: () => current, layerIds: PROVINCE_LAYERS};
}

/** Bounds of one province frame (drill-down fit). */
export function provinceBounds(geojson, code, LngLatBounds) {
  const f = (geojson?.features || []).find(x => String(x.id ?? x.properties?.id) === code);
  return f ? featureBounds(f, LngLatBounds) : null;
}
