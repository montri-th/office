import test from 'node:test';
import assert from 'node:assert/strict';
import {load, readJSON, readBytes, frameFiles, sha256} from './helpers.js';
import {hasPoint, filterRows, summarize, rowValue, valueOf, unitWords, sizeOf, median, rentStats, SIZE_BANDS, RENT_MIN_N} from '../js/model.js';
import {distanceM} from '../js/profile-model.js';

test('offices.json decodes to every counted Office ID of 01_OFFICES, nothing dropped, ids unique; aggregate references stay out', () => {
  const {raw, data} = load();
  assert.equal(data.dropped, 0);
  assert.equal(data.rows.length, raw.meta.rows);
  assert.equal(data.rows.length, raw.meta.counts.rows);
  assert.equal(new Set(data.rows.map(r => r.id)).size, data.rows.length);
  assert.ok(data.rows.every(r => /^OFF-[0-9A-F]{12}$/.test(r.id)), 'every row is an Office ID');
  assert.equal(raw.meta.counts['excluded.aggregate'], raw.meta.excluded.length);
  for (const x of raw.meta.excluded) {
    assert.ok(!data.rows.some(r => r.id === x.office), `aggregate ${x.office} is not a row`);
    assert.ok(x.children.length > 0 && x.children.every(c => data.rows.some(r => r.id === c)), `${x.office}: its children are counted`);
  }
  assert.equal(raw.meta.registryId, 'research.TH.office');
  assert.match(raw.meta.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  for (const t of ['01_OFFICES', '28_OFFICE_METRICS', '18_ORGANIZATIONS', '19_ORGANIZATION_ROLES']) assert.match(raw.meta.inputs[t].sha256, /^[a-f0-9]{64}$/, t);
});

test('measure contract: records count once; the rent measure is the median of dated monthly asking rents, from RENT_MIN_N of them', () => {
  const {raw, data} = load();
  const rents = data.rows.filter(r => r.rent);
  assert.equal(rents.length, raw.meta.counts['rent.monthly']);
  assert.ok(rents.every(r => Number.isInteger(r.rent.min) && r.rent.min > 0 && (r.rent.max === null || r.rent.max >= r.rent.min)), 'rent ranges are ordered');
  assert.ok(rents.every(r => r.rent.basis), 'every rent says what it is');
  assert.ok(rents.every(r => r.rent.on === '' || /^\d{4}-\d{2}(-\d{2})?$/.test(r.rent.on)));
  assert.equal(rents.filter(r => !r.rent.on).length, raw.meta.counts['rent.monthly.undated']);
  assert.ok(data.rows.every(r => !(r.rent && r.legacyPrice)), 'a legacy price only where no monthly rent is selected');
  assert.equal(data.rows.filter(r => r.legacyPrice).length, raw.meta.counts['rent.legacyOnly']);
  const s = summarize(data.rows);
  assert.equal(s.count, data.rows.length);
  assert.equal(s.rentN, rents.filter(r => r.rent.on).length, 'undated rents stay out of the measure');
  assert.equal(rowValue({rent: {min: 500, on: ''}}, 'rent'), null);
  assert.equal(rowValue({rent: {min: 500, on: '2026-07'}}, 'rent'), 500);
  assert.equal(rowValue({}, 'count'), 1);
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 2, 3]), 2.5); assert.equal(median([]), null);
  assert.equal(valueOf({rentN: RENT_MIN_N - 1, rentMedian: 600}, 'rent'), null, 'below RENT_MIN_N no median is shown');
  assert.equal(valueOf({rentN: RENT_MIN_N, rentMedian: 600}, 'rent'), 600);
  assert.equal(rentStats([{rent: {min: 100, on: '2026-07'}}, {rent: {min: 300, on: ''}}]).n, 1);
  assert.deepEqual([unitWords('count').one, unitWords('rent').one, unitWords('').one], ['แห่ง', 'บาท/ตร.ม./เดือน', 'แห่ง']);
  assert.equal(sizeOf(null), '');
  assert.deepEqual([9, 10, 29, 39, 40, 61].map(sizeOf), ['f1', 'f2', 'f3', 'f4', 'f5', 'f5']);
  assert.equal(SIZE_BANDS.length, 5);
  assert.equal(data.rows.filter(r => r.floors).length, raw.meta.counts['floors.known']);
  assert.ok(data.rows.every(r => r.floors === null || (Number.isInteger(r.floors) && r.floors > 0 && r.floorStatus)), 'a floor count carries its status');
});

test('categories and evidence: every row in one category and one evidence group; the filters partition the rows', () => {
  const {raw, data} = load();
  assert.deepEqual(data.groups.map(g => g.id), ['rental', 'workspace', 'organization', 'hybrid', 'unresolved']);
  assert.deepEqual(data.evidence.map(e => e.id), ['confirmed', 'legacy', 'review']);
  for (const g of data.groups) assert.equal(filterRows(data.rows, {group: g.id}).length, raw.meta.counts[`group.${g.id}`] || 0, g.id);
  for (const e of data.evidence) assert.equal(filterRows(data.rows, {ev: e.id}).length, raw.meta.counts[`evidence.${e.id}`] || 0, e.id);
  assert.equal(data.groups.reduce((s, g) => s + filterRows(data.rows, {group: g.id}).length, 0), data.rows.length);
});

test('membership: a placed row sits in an existing production district of its own province; the rest stop at province or none', () => {
  const {raw, data, index} = load();
  const by = {};
  for (const r of data.rows) {
    by[r.admin] = (by[r.admin] || 0) + 1;
    if (r.area) {
      const a = index.byId.get(r.area);
      assert.ok(a, r.id);
      assert.equal(a.province, r.province, `${r.id} district in its own province`);
      assert.ok(['name', 'point'].includes(r.admin));
    } else assert.ok(['province', 'conflict', 'none'].includes(r.admin), r.id);
  }
  for (const k of ['name', 'point', 'province']) assert.equal(by[k] || 0, raw.meta.counts[`admin.${k}`] || 0, k);
  assert.equal(raw.meta.conflicts.length, by.conflict || 0);
});

test('points are the sheet’s selected points, inside Thailand, with their role; never invented', () => {
  const {raw, data} = load();
  const pts = data.rows.filter(hasPoint);
  assert.equal(pts.length, raw.meta.counts.points);
  assert.ok(pts.every(r => r.coordRole), 'every drawn point says what it is');
  assert.ok(data.rows.filter(r => !hasPoint(r)).every(r => r.latitude === null && r.longitude === null));
});

test('organisations join by id only; broker listings and unverified brands are not published; the filters partition with “none”', () => {
  const {raw, data} = load();
  assert.equal(new Set(data.orgs.map(o => o.id)).size, data.orgs.length);
  assert.ok(data.rows.every(r => r.orgs.every(o => data.orgs.includes(o.org) && o.roles.length > 0)));
  for (const left of ['commercial_leasing_agent_listing', 'unverified_brand_affiliation', 'co_marketing_association']) {
    assert.ok(raw.meta.organisations.leftOut.includes(left), left);
    assert.ok(!data.roles.some(x => x.id === left), `${left} is not a published role`);
  }
  assert.equal(data.rows.filter(r => r.orgs.length).length, raw.meta.counts['orgs.rows']);
  const none = filterRows(data.rows, {org: 'none'}).length;
  assert.equal(none + data.rows.filter(r => r.orgs.length).length, data.rows.length);
});

test('context from CityMETER Transit: straight-line distances agree with the published points', () => {
  const {raw, data} = load();
  assert.match(raw.meta.context.rail.commit, /^[0-9a-f]{40}$/);
  assert.match(raw.meta.context.rail.sha256, /^[0-9a-f]{64}$/);
  let checked = 0;
  for (const r of data.rows) {
    if (r.rail) {
      assert.ok(hasPoint(r) && r.rail.station.status === 'operating' && r.rail.m <= 2000, r.id);
      assert.ok(Math.abs(distanceM(r.latitude, r.longitude, r.rail.station.lat, r.rail.station.lon) - r.rail.m) <= 1.5, r.id);
      checked++;
    }
    if (r.railNext) assert.equal(r.railNext.station.status, 'construction');
  }
  assert.ok(checked > 100);
});

test('publication hygiene: no phone, address, researcher text or private link; links are https', () => {
  const {raw} = load();
  for (const f of ['office_location_reported', 'review_note', 'ownership_status', 'links to the private CityMETER repository']) assert.ok(raw.meta.excludedFields.includes(f), f);
  const text = JSON.stringify(raw);
  for (const k of ['phone', 'address', 'notes', 'latitude', 'longitude']) assert.ok(!Object.keys(raw.cols).includes(k), k);
  assert.ok(!/(docs|drive)\.google\.com/.test(text), 'no Google document link');
  assert.ok(!/github\.com\/theshifters/.test(text), 'no link to the private repository');
  assert.ok(!/google\.[a-z.]+\/maps|maps\.app\.goo\.gl/.test(text), 'no map links');
  assert.ok(!/landometer\.com\/api\//.test(raw.urls.join(' ')), 'no internal API link as a source link');
  assert.ok(raw.urls.every(u => /^https:\/\//.test(u)), 'source links are https');
  assert.ok(!/\b0[-\s]?\d{1,2}[-\s]?\d{3}[-\s]?\d{4}\b/.test(text), 'no telephone-like numbers');
  assert.ok(!/เลขที่|หมู่ที่|\bMoo\b/.test(text), 'no street addresses');
});

test('boundaries: 928 districts and 77 provinces from production; per-province frames match the index; receipts bound by hash', () => {
  const {index, indexJSON, provincesGeo} = load();
  assert.equal(index.areas.length, 928);
  assert.equal(index.provinces.length, 77);
  assert.equal(provincesGeo.features.length, 77);
  assert.ok(index.areas.every(a => a.km2 > 0 && Array.isArray(a.label) && Array.isArray(a.bbox)), 'production area, label and bbox for every district');
  const files = frameFiles();
  assert.equal(files.length, 77);
  let areas = 0;
  for (const f of files) {
    const code = f.replace('.json', ''), frame = readJSON(`data/frames/${f}`), p = index.provinceById.get(code);
    assert.ok(p, code);
    assert.equal(frame.areas.features.length, p.areaTotal, `${code} districts`);
    for (const ft of frame.areas.features) assert.equal(index.byId.get(String(ft.id ?? ft.properties.id))?.province, code);
    areas += frame.areas.features.length;
  }
  assert.equal(areas, 928);
  const receipts = readJSON('data/boundary-receipts.json');
  assert.equal(Object.keys(receipts.base).length, 78, 'the country list + 77 province base-info responses');
  assert.equal(indexJSON.metadata.receipts, 78);
  for (const r of Object.values(receipts.base)) {
    assert.match(r.sha256, /^[a-f0-9]{64}$/);
    assert.match(r.url, /^https:\/\/landometer\.com\/api\/v2\/citymeter-v3\/base\/info\//);
    assert.equal(r.status, 200);
  }
  const py = v => (Array.isArray(v) ? `[${v.map(py).join(', ')}]` : v && typeof v === 'object'
    ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}: ${py(v[k])}`).join(', ')}}` : JSON.stringify(v));
  assert.equal(sha256(Buffer.from(py(receipts.base))), receipts.baseSha256);
  assert.equal(indexJSON.metadata.receiptsSha256, receipts.baseSha256);
});

test('the build report matches the shipped data file', () => {
  const {raw} = load();
  const report = readJSON('data/build-report.json');
  assert.deepEqual(report.counts, raw.meta.counts);
  assert.equal(report.files[0].path, 'data/offices.json');
  assert.equal(report.files[0].sha256, sha256(readBytes('data/offices.json')));
  assert.equal(report.files[0].bytes, readBytes('data/offices.json').length);
});
