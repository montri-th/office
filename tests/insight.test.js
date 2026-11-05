import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {summarizeAreaInsight, filterAreaRows, RAIL_M} from '../js/area-insight.js';
import {levelWords, areaLabel} from '../js/areas.js';
import {filterRows, RENT_MIN_N} from '../js/model.js';
import {buildAreaModel} from '../js/map-layers.js';
import {buildProvinceModel} from '../js/provinces.js';
import {PRICE_SCALE, COUNT_SCALE} from '../js/scales.js';

test('first Aha (snapshot fixture, count): the เขต with the most offices in the province holding the most placed offices; a tie joins within four', () => {
  const {data, index} = load();
  const a = summarizeAreaInsight(data.rows, index);
  assert.equal(a.metric, 'count');
  assert.equal(a.home, 'BKK');
  // บางรัก 63 · ห้วยขวาง 47 · then วัฒนา and ปทุมวัน tied at 46: the tie joins (four districts), never cut.
  assert.deepEqual(a.areas.map(x => [x.id, x.name, x.value]), [['1004', 'บางรัก', 63], ['1017', 'ห้วยขวาง', 47], ['1039', 'วัฒนา', 46], ['1007', 'ปทุมวัน', 46]]);
  assert.deepEqual([a.value, a.homePlacedValue, a.homeValue, Math.round(a.share)], [202, 413, 429, 47], 'the share is of the province\'s offices (placed and province-only rows)');
  assert.deepEqual([a.count, a.homePlaced, a.homeUnplacedValue], [202, 413, 16]);
  // Rail (CityMETER · Transit): within 500 m of an operating station, rows with a point only; both bases stated.
  assert.equal(RAIL_M, 500);
  assert.deepEqual([a.rail.focus.within, a.rail.focus.base, a.rail.focus.noPoint], [136, 191, 11]);
  assert.deepEqual([a.rail.rest.within, a.rail.rest.base, a.rail.rest.noPoint], [93, 175, 36]);
  assert.equal(a.rail.focus.base + a.rail.focus.noPoint, a.value, 'offices with and without a point add up to the focus');
  assert.deepEqual([a.outside.id, a.outside.name, a.outside.province, a.outside.value], ['5001', 'เมืองเชียงใหม่', 'CMI', 15]);
  assert.deepEqual(filterAreaRows(data.rows, new Set(a.areaIds)).length, a.count);
});

test('rent Aha (snapshot fixture): the districts of the leading province with the highest median dated asking rent, each with its n', () => {
  const {data, index} = load();
  const r = summarizeAreaInsight(data.rows, index, {metric: 'rent'});
  assert.equal(r.metric, 'rent');
  assert.equal(r.home, 'BKK');
  assert.deepEqual(r.areas.map(x => [x.id, x.name, x.value, x.rentN]), [['1007', 'ปทุมวัน', 982.5, 26], ['1033', 'คลองเตย', 712.5, 24], ['1039', 'วัฒนา', 665, 29]]);
  assert.ok(r.areas.every(x => x.rentN >= RENT_MIN_N), 'a median from at least RENT_MIN_N rents');
  assert.deepEqual([r.homeStats.n, r.homeStats.median, r.national.n, r.national.median], [250, 610, 256, 600]);
  assert.deepEqual([r.rail.near.n, r.rail.near.median, r.rail.far.n, r.rail.far.median], [166, 742.5, 80, 500]);
  assert.deepEqual([r.outside.name, r.outside.value, r.outside.rentN], ['บางพลี', 550, 5]);
  assert.deepEqual([r.measuredAreas, r.quotedAreas], [14, 22]);
});

test('the focus never cuts through a tie; a province where every district holds the same value is “spread”', () => {
  const {index} = load();
  const row = (area, i) => ({id: `t${area}-${i}`, area, province: index.byId.get(area).province, orgs: [], rent: null, latitude: null, longitude: null});
  const many = (area, n) => Array.from({length: n}, (_, i) => row(area, i));
  // Bangkok: 1033 (4), then 1037 and 1039 tied (2) above 1001 (1): the cut after three is above the tie.
  const tie = [...many('1033', 4), ...many('1037', 2), ...many('1039', 2), ...many('1001', 1)];
  assert.deepEqual(summarizeAreaInsight(tie, index).areas.map(a => a.id), ['1033', '1037', '1039']);
  // 1001 joins the tie at 2 (four districts, one left out): the tie joins.
  const tie4 = [...tie, row('1001', 9), ...many('1002', 1)];
  assert.deepEqual(summarizeAreaInsight(tie4, index).areas.map(a => a.id).sort(), ['1001', '1033', '1037', '1039']);
  // Five tied at 2 under 1033: the extended focus would be five, so only 1033 (above them) is the focus.
  const tie5 = [...tie4, ...many('1003', 2), ...many('1005', 1)];
  assert.deepEqual(summarizeAreaInsight(tie5, index).areas.map(a => a.id), ['1033']);
  const spread = ['1033', '1037', '1039', '1001'].flatMap(id => many(id, 2));
  const s = summarizeAreaInsight(spread, index);
  assert.deepEqual(s.areas, []);
  assert.deepEqual(s.spread, {areas: 4, value: 2});
});

test('the Aha follows the filters: a province, a category, nothing', () => {
  const {data, index} = load();
  const cmi = summarizeAreaInsight(filterRows(data.rows, {province: 'CMI'}), index);
  assert.equal(cmi.home, 'CMI');
  assert.deepEqual(cmi.areas.map(a => [a.name, a.value]), [['เมืองเชียงใหม่', 15]], 'two districts hold offices: the top one is the focus');
  assert.equal(cmi.outside, null, 'a one-province selection has no outside finding');
  const ws = summarizeAreaInsight(filterRows(data.rows, {group: 'workspace'}), index);
  assert.equal(ws.home, 'BKK');
  assert.ok(ws.areas.length > 0 && ws.areas.length <= 4);
  const none = summarizeAreaInsight([], index);
  assert.deepEqual([none.areas.length, none.share, none.home], [0, 0, '']);
  const noRent = summarizeAreaInsight([], index, {metric: 'rent'});
  assert.deepEqual([noRent.areas.length, noRent.home, noRent.national.n], [0, '', 0]);
});

test('district model: EVID-05 — count: an empty district is a measured zero; rent: fewer than RENT_MIN_N rents is no data, no office is out of scope', () => {
  const {data, index} = load();
  const count = buildAreaModel(data.rows, index);
  assert.equal(count.areas.length, 928);
  assert.equal(count.ramp.scaleId, COUNT_SCALE.scaleId);
  assert.equal(count.zeroCount, 800, '128 districts hold at least one office');
  assert.deepEqual([count.ramp.min, count.ramp.max, count.ramp.steps], [1, 63, 41]);
  assert.equal(count.byId.get('1004').fill, COUNT_SCALE.lut[40], 'บางรัก (the national maximum) closes the ramp on sample 40');
  assert.ok(count.areas.filter(a => a.state === 'measured_zero').every(a => a.count === 0));
  const rent = buildAreaModel(data.rows, index, {metric: 'rent'});
  assert.equal(rent.ramp.scaleId, PRICE_SCALE.scaleId);
  const states = rent.areas.reduce((m, a) => ({...m, [a.state]: (m[a.state] || 0) + 1}), {});
  assert.deepEqual(states, {measured: 14, no_data: 114, out_of_scope: 800});
  assert.ok(rent.areas.filter(a => a.state === 'measured').every(a => a.rentN >= RENT_MIN_N && a.value === a.rentMedian));
  assert.ok(rent.areas.filter(a => a.state === 'no_data').every(a => a.count > 0 && a.rentN < RENT_MIN_N && a.value === null && a.reason));
  assert.ok(rent.areas.filter(a => a.state === 'out_of_scope').every(a => a.count === 0 && a.fill === null));
  assert.equal(rent.byId.get('1007').fill, PRICE_SCALE.lut[40], 'ปทุมวัน (the highest median) closes the ramp on sample 40');
  assert.equal(rent.zeroCount, 0, 'a rent is never a measured zero');
});

test('province frames total offices per province (count) and carry a median from RENT_MIN_N rents (rent)', () => {
  const {data, provincesGeo} = load();
  const m = buildProvinceModel(data.rows, provincesGeo);
  assert.equal(m.provinces.length, 77);
  const by = new Map();
  for (const r of data.rows) if (r.province) by.set(r.province, (by.get(r.province) || 0) + 1);
  for (const p of m.provinces) assert.equal(p.value, by.get(p.code) || 0, p.code);
  assert.equal(m.provinces.find(p => p.code === 'BKK').fill, COUNT_SCALE.lut[40], 'Bangkok closes the province ramp');
  assert.equal(m.zeroCount, 0, 'every province holds an office record');
  const rent = buildProvinceModel(data.rows, provincesGeo, {metric: 'rent'});
  assert.deepEqual(rent.provinces.filter(p => p.state === 'measured').map(p => p.code).sort(), ['BKK', 'SPK']);
  assert.equal(rent.noDataCount, 75);
  const none = buildProvinceModel([], provincesGeo);
  assert.ok(none.provinces.every(p => p.state === 'measured_zero'));
  assert.ok(buildProvinceModel([], provincesGeo, {metric: 'rent'}).provinces.every(p => p.state === 'out_of_scope'));
});

test('level words follow the province: เขต in Bangkok, อำเภอ elsewhere', () => {
  const {index} = load();
  assert.deepEqual(levelWords('BKK'), {area: 'เขต'});
  assert.deepEqual(levelWords('PKT'), {area: 'อำเภอ'});
  assert.equal(areaLabel(index.byId.get('1039')), 'เขตวัฒนา');
  assert.equal(areaLabel(index.byId.get('8301')), 'อำเภอเมืองภูเก็ต');
});
