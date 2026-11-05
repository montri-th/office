import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {buildOverview, buildAreaProfile, buildOfficeDetail, buildBuildingProfile, buildOrgProfile, buildStationProfile, stationsOf, compsetOf, listOrder, unplacedOf, COMPSET_RADIUS_M} from '../js/profile-model.js';
import {renderOverview, renderArea, renderBuilding, renderOffice, renderStation, renderOrgCard, renderFilterChips, provenance, pct, monthSpan, rentText} from '../js/panel.js';
import {summarizeAreaInsight, filterAreaRows} from '../js/area-insight.js';
import {summarize, productionLink, filterRows, unitWords, hasPoint, stationLink, RENT_MIN_N} from '../js/model.js';
import {buildChartModel, areaMatrix, orgRanking} from '../js/chart-model.js';
import {buildBreadcrumb, renderBreadcrumb, breadcrumbText, productionHref} from '../js/breadcrumb.js';
import {CUES, CUE_PATHS, GROUP_SERIES, cueMarkup, seriesOf} from '../js/cues.js';
import {contextActions} from '../js/ask.js';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const ctxFor = (data, index, metric = 'count', filtered = false) => ({meta: data.meta, unit: unitWords(metric), index, filtered});
const OFFICE = 'OFF-C5E7382ADF31'; // 140 Wireless
const REGUS = 'ORG-6FC71948C40F';

function views(metric = 'count') {
  const {data, index} = load();
  const rows = data.rows, ctx = ctxFor(data, index, metric);
  const insight = summarizeAreaInsight(rows, index, {metric});
  const office = rows.find(r => r.id === OFFICE);
  const station = data.stations.find(s => s.name === 'ราชดำริ');
  const regus = filterRows(rows, {org: REGUS});
  return {
    overview: renderOverview({insight, summary: summarize(filterAreaRows(rows, new Set(insight.areaIds))), overview: buildOverview(rows, index, {groups: data.groups, evidence: data.evidence, metric}),
      focusMode: 'auto', provinces: [], unknownProvince: 0, province: '', stations: stationsOf(rows, metric), ctx}),
    area: renderArea(buildAreaProfile(rows, '1007', index, data.groups, {metric, evidence: data.evidence}), () => '#000', ctx),
    office: renderOffice(buildOfficeDetail(office, {scopeRows: rows, allRows: rows, index, groups: data.groups}), ctx),
    station: renderStation(buildStationProfile(station, {scopeRows: rows, groups: data.groups, metric}), ctx),
    building: renderBuilding(buildBuildingProfile({key: 'osm:1', kind: 'osm', rows: rows.filter(hasPoint).slice(0, 3), height: 24}, index, data.groups), ctx),
    org: renderOverview({insight: summarizeAreaInsight(regus, index, {metric}), summary: summarize(regus),
      overview: buildOverview(regus, index, {groups: data.groups, evidence: data.evidence, metric}), focusMode: 'auto', province: '',
      orgCard: renderOrgCard(buildOrgProfile(REGUS, {allRows: rows, scopeRows: regus, index, data, metric}), ctx), ctx}),
  };
}

test('every panel view ends with one provenance line — dataset · source · date · boundary, then the method — and carries no caveat on screen', () => {
  for (const metric of ['count', 'rent']) {
    for (const [name, html] of Object.entries(views(metric))) {
      const t = text(html);
      for (const k of ['dataset', 'source', 'date', 'boundary']) assert.equal((html.match(new RegExp(`data-prov="${k}"`, 'g')) || []).length, 1, `${name}: ${k}`);
      assert.ok(t.includes('ชุดข้อมูล CityMETER Office'), `${name}: dataset`);
      assert.ok(/แหล่ง\s*จาก CityMETER Office · หน้าทางการ · พอร์ตเจ้าของอาคาร/.test(t), `${name}: source`);
      assert.ok(t.includes('ตรวจ 2 พ.ย. 2569'), `${name}: date`);
      assert.ok(/ขอบเขต \S/.test(t), `${name}: boundary`);
      assert.ok(html.includes('<span class="prov-part prov-method"><a href="DATA_METHOD.md"'), `${name}: the method link`);
      assert.equal((html.match(/class="hint panel-foot provenance"/g) || []).length, 1, `${name}: exactly one provenance line`);
      // Owner rule (Hotel 0.3.1): “ไม่มี caveats เลย” — exactness comes from names, numerators and denominators, and the provenance.
      assert.ok(!/ไม่ใช่|ยังไม่ได้ตรวจ|ยังไม่ยืนยัน|อาจเป็น|ไม่ได้แปลว่า|ค่าประมาณ|นับในยอดรวม|undefined|NaN/.test(t), `${name}: no caveat on screen — ${(t.match(/.{0,40}(ไม่ใช่|ยังไม่ได้ตรวจ|ยังไม่ยืนยัน|อาจเป็น|ไม่ได้แปลว่า|ค่าประมาณ|นับในยอดรวม|undefined|NaN).{0,40}/) || [''])[0]}`);
      assert.ok(!/ตั้งอยู่ใน|ยอดขาย|ส่วนแบ่งตลาด|รายได้|ความหนาแน่น|ค่าเช่าเฉลี่ย|ค่าเช่าจริง/.test(t), `${name}: no located-inside, sales, share, revenue, density or achieved-rent claim`);
    }
  }
});

test('first screen (count): the Aha with numerator and denominator, the rail comparison as two bars with both bases, the outside finding', () => {
  const o = text(views().overview);
  assert.ok(o.includes('47% ของสำนักงานในกรุงเทพมหานคร อยู่ใน 4 เขตนี้'), o.slice(0, 300));
  assert.ok(o.includes('บางรัก · ห้วยขวาง · วัฒนา · ปทุมวัน') && o.includes('202 จาก 429 แห่ง'), 'the share of the province\'s offices');
  assert.ok(o.includes('ใกล้รถไฟฟ้า ≤ 500 ม. 4 เขตนี้ 71% 136 จาก 191 แห่ง') && o.includes('เขตอื่น 53% 93 จาก 175 แห่ง'), 'both bases in the accessible text');
  assert.ok(o.includes('อันดับ 1นอกกรุงเทพมหานคร: อำเภอเมืองเชียงใหม่ เชียงใหม่ 15 แห่ง') || o.includes('อันดับ 1 นอกกรุงเทพมหานคร: อำเภอเมืองเชียงใหม่ เชียงใหม่ 15 แห่ง'));
  assert.ok(o.includes('สถานีที่มีสำนักงานรอบ ๆ มากที่สุด'));
  assert.ok(o.includes('ระบุองค์กร 331 จาก 608 แห่ง'));
  assert.ok(o.includes('ไม่ทราบ 248'), 'unknown floors are their own (hatched) bar, never a band');
  assert.ok(o.includes('ยืนยันจากแหล่งหลัก 293') && o.includes('ข้อมูลเดิมจาก CityMETER production 312'), 'the evidence of the records as a filterable bar list');
});

test('first screen (rent): the districts with the highest median asking rent, each with its n, beside the province’s median; rail medians with n', () => {
  const o = text(views('rent').overview);
  assert.ok(o.includes('เขตที่ค่าเช่ากลางสูงสุดในกรุงเทพมหานคร'), o.slice(0, 300));
  assert.ok(o.includes('ปทุมวัน ฿983 26 ราคา') && o.includes('คลองเตย ฿713 24 ราคา') && o.includes('วัฒนา ฿665 29 ราคา'));
  assert.ok(o.includes('ทั้งกรุงเทพมหานคร ฿610 · 250 ราคา'));
  assert.ok(o.includes('≤ 500 ม. · 166 ราคา') && o.includes('ไกลกว่า · 80 ราคา') && o.includes('฿743') && o.includes('฿500'));
  assert.ok(o.includes('ค่าเช่าสูงสุดนอกกรุงเทพมหานคร: อำเภอบางพลี สมุทรปราการ ฿550 · 5 ราคา'));
  assert.ok(o.includes(`≥ ${RENT_MIN_N} ราคา`), 'the ranking states the rule of a median');
});

test('district, station, organisation and office panels: ranks, shares, rents with their month, straight-line context and the rent set', () => {
  const v = views();
  const a = text(v.area);
  assert.ok(a.includes('เขตปทุมวัน') && a.includes('อันดับ 3 (ร่วม) จาก 128 ทั่วประเทศ'), a.slice(0, 400));
  assert.ok(a.includes('ค่าเช่ากลาง/ตร.ม.') && a.includes('ค่าเช่าที่ประกาศ'), 'the district carries its median and its offices’ rents');
  assert.match(v.area, /href="https:\/\/landometer\.com\/v3\/citymeter\/BKK\/D\/1007\?d=office"/);
  const s = text(v.station);
  assert.ok(s.includes('สถานีราชดำริ') && s.includes('500 ม. รอบสถานี'));
  assert.ok(v.station.includes(`href="${stationLink({id: 'RAILCAT:BTS_SILOM:S1'})}"`), 'the station page on CityMETER Transit');
  const h = text(v.office);
  assert.ok(h.includes('140 Wireless') && h.includes('อาคาร 140 ไวร์เลส'), 'the name and the other name');
  assert.ok(h.includes('฿1,000–1,200 /ตร.ม./เดือน · มิ.ย. 2569'), 'the asking rent with its month');
  assert.ok(h.includes('22 ชั้น') && h.includes('24,000 ตร.ม.'));
  assert.ok(h.includes('ค่าเช่ารอบ ๆ') && h.includes('≤ 1 กม.'), 'the rent comparison set and its rule');
  assert.match(v.office, /href="https:\/\/www\.officebangkok\.com\/office-building\/140-wireless"[^>]*>หน้าประกาศ</);
  const g = text(v.org);
  assert.ok(g.includes('องค์กร Regus') && g.includes('อยู่ในเครือข่ายพื้นที่ทำงาน 65') && g.includes('ดูทุกองค์กร'));
});

test('rent comparison set: offices with an asking rent within 1 km in a straight line, nearest first; never itself; no point → none', () => {
  const {data} = load();
  const o = data.rows.find(r => r.id === OFFICE);
  const c = compsetOf(o, data.rows);
  assert.equal(c.radius, COMPSET_RADIUS_M);
  assert.ok(c.rows.length > 0 && c.rows.length <= 8);
  assert.ok(c.rows.every(x => x.row.id !== o.id && x.row.rent && x.m <= COMPSET_RADIUS_M));
  for (let i = 1; i < c.rows.length; i++) assert.ok(c.rows[i].m >= c.rows[i - 1].m, 'nearest first');
  assert.ok(c.around.count >= c.matches);
  assert.equal(compsetOf(data.rows.find(r => !hasPoint(r)), data.rows), null);
});

test('missing stays missing: no point, province only, no rent — each says so, never 0 or a guessed place', () => {
  const {data, index} = load();
  const ctx = ctxFor(data, index);
  const noPoint = data.rows.find(r => !hasPoint(r) && r.area);
  const t = text(renderOffice(buildOfficeDetail(noPoint, {scopeRows: data.rows, allRows: data.rows, index, groups: data.groups}), ctx));
  assert.ok(t.includes('ไม่มีพิกัด'));
  const provinceOnly = data.rows.find(r => r.admin === 'province');
  assert.ok(text(renderOffice(buildOfficeDetail(provinceOnly, {scopeRows: data.rows, allRows: data.rows, index, groups: data.groups}), ctx)).includes('ระบุได้แค่จังหวัด'));
  const u = unplacedOf(data.rows);
  assert.equal(u.total, data.rows.filter(r => !r.area).length);
  const empty = buildAreaProfile([], '1039', index, data.groups);
  assert.equal(empty.coverageState, 'measured_zero');
  assert.ok(text(renderArea(empty, () => '#000', ctx)).includes('ไม่พบสำนักงานในเขตวัฒนา'));
  // An area with fewer than RENT_MIN_N dated rents shows the count of its rents, never a median.
  const few = buildAreaProfile(data.rows, '5001', index, data.groups, {metric: 'rent'});
  assert.ok(few.rent.n < RENT_MIN_N);
  const ft = text(renderArea(few, () => '#000', ctxFor(data, index, 'rent')));
  assert.ok(ft.includes(`${few.rent.n} ราคาประกาศ`) && !ft.includes('ค่าเช่ากลาง/ตร.ม.'));
  assert.equal(rentText({min: 500, max: null}), '฿500');
  assert.equal(rentText({min: 500, max: 700}), '฿500–700');
});

test('charts: districts by the measure, district × category matrix of offices with equal cells, organisations by offices', () => {
  const {data, index} = load();
  const m = buildChartModel(data.rows, index, data.groups);
  assert.equal(m.areas.length, 20);
  assert.equal(m.totalAreas, 128);
  assert.equal(m.areas[0].name, 'บางรัก');
  const r = buildChartModel(data.rows, index, data.groups, {metric: 'rent'});
  assert.equal(r.totalAreas, 14, 'only districts with a median');
  assert.ok(r.areas.every(a => a.rentN >= RENT_MIN_N));
  const mx = areaMatrix(data.rows, index, data.groups);
  assert.equal(mx.cells.length, mx.areas.length * data.groups.length);
  for (const a of mx.areas) assert.equal(mx.cells.filter(c => c.areaId === a.id).reduce((s, c) => s + c.value, 0), a.value);
  const o = orgRanking(data.rows);
  assert.equal(o.orgs[0].org.name, 'กรมสรรพากร');
  assert.equal(o.orgs[0].count, 128);
  assert.equal(o.total, data.orgs.length);
});

test('breadcrumb follows production: ประเทศไทย › จังหวัด › เขต/อำเภอ with /D/ deep links and the office dataset', () => {
  const {index} = load();
  const area = index.byId.get('1007');
  const crumbs = buildBreadcrumb({province: 'BKK', area});
  assert.deepEqual(crumbs.map(c => c.label), ['ประเทศไทย', 'กรุงเทพมหานคร', 'เขตปทุมวัน']);
  assert.equal(breadcrumbText(crumbs), 'ประเทศไทย › กรุงเทพมหานคร › เขตปทุมวัน');
  assert.equal(productionHref(crumbs), 'https://landometer.com/v3/citymeter/BKK/D/1007?d=office');
  assert.equal(productionLink(), 'https://landometer.com/v3/citymeter?d=office');
  assert.ok(renderBreadcrumb(crumbs).includes('data-action="crumb-province"'));
});

test('office categories bind to LDS series by stable id with the series shape cue; no star (it would read as a rating)', () => {
  const {data} = load();
  assert.deepEqual(data.groups.map(g => g.series), [2, 1, 3, 4, 9]);
  assert.ok(!Object.values(GROUP_SERIES).includes(6), 'series 6 (star) is not used');
  for (const g of data.groups) {
    assert.equal(seriesOf(g.id), g.series);
    assert.ok(CUE_PATHS[CUES[g.series - 1]], g.id);
    assert.match(cueMarkup(g.series), /aria-hidden="true"/);
  }
});

test('lists put the tallest building first (unknown floors last), then name — deterministic', () => {
  const {data} = load();
  const rows = data.rows.filter(r => r.area === '1007').sort(listOrder);
  for (let i = 1; i < rows.length; i++) assert.ok((rows[i - 1].floors || 0) >= (rows[i].floors || 0));
  assert.ok(rows.findIndex(r => !r.floors) === -1 || rows.slice(rows.findIndex(r => !r.floors)).every(r => !r.floors), 'unknown floors last');
});

test('Google actions: public names and points only, https, the question of the view; Street View only with a point', () => {
  const {data} = load();
  const o = data.rows.find(r => r.id === OFFICE);
  const acts = contextActions({kind: 'office', row: o, area: {place: 'เขตปทุมวัน', province: 'กรุงเทพมหานคร'}, point: {lat: o.latitude, lon: o.longitude, role: 'point'}});
  assert.deepEqual(acts.map(a => a.id), ['ai', 'maps', 'streetview']);
  assert.ok(acts.every(a => a.href.startsWith('https://www.google.com/')));
  assert.ok(decodeURIComponent(acts[0].href).includes('ค่าเช่าต่อตารางเมตร'));
  const all = [acts, contextActions({kind: 'area', area: {place: 'เขตปทุมวัน', province: 'กรุงเทพมหานคร'}}),
    contextActions({kind: 'station', station: {name: 'ราชดำริ', lines: ['สีลม']}}), contextActions({kind: 'org', org: {name: 'Regus'}}),
    contextActions({kind: 'overview', province: 'กรุงเทพมหานคร'}), contextActions({kind: 'building', rows: [o], area: {place: 'เขตปทุมวัน', province: 'กรุงเทพมหานคร'}})];
  for (const list of all) {
    const ai = list.find(a => a.id === 'ai');
    assert.ok(ai, 'every view asks Google AI');
    assert.match(ai.href, /^https:\/\/www\.google\.com\/search\?q=[^&]+$/, 'a plain search, the question only');
    assert.ok(!/udm=/.test(ai.href), 'never straight into AI Mode');
  }
  assert.ok(!acts.some(a => a.href.includes(o.id)), 'no internal id leaves the page');
  const st = contextActions({kind: 'station', station: {name: 'ราชดำริ', lines: ['สีลม']}, point: {lat: 13.739, lon: 100.539, role: 'station'}});
  assert.equal(st.at(-1).label, 'Street View ใกล้สถานี');
});

test('filter chips escape user text, name the filters and offer one clear-all', () => {
  const html = renderFilterChips({search: '<b>ไวร์เลส</b>', group: 'rental', ev: 'legacy', size: 'f3', province: 'BKK', org: 'none'},
    {group: {rental: 'สำนักงานให้เช่า'}, ev: {legacy: 'ข้อมูลเดิมจาก CityMETER production'}, size: {f3: '20–29 ชั้น'}, province: {BKK: 'กรุงเทพมหานคร'}, org: {}});
  assert.ok(!html.includes('<b>'));
  for (const w of ['สำนักงานให้เช่า', 'ข้อมูลเดิมจาก CityMETER production', '20–29 ชั้น', 'กรุงเทพมหานคร', 'ไม่ระบุองค์กร']) assert.ok(text(html).includes(w), w);
  assert.equal((html.match(/data-id="all"/g) || []).length, 1);
});

test('shares print whole percentages; a non-zero part never prints as 0%; listing months read as one span', () => {
  assert.equal(pct(202, 429), '47%');
  assert.equal(pct(1, 352), '<1%');
  assert.equal(pct(0, 10), '0%');
  assert.equal(pct(3, 0), '—');
  assert.equal(monthSpan(['2026-07', '2026-05', '2026-10']), 'พ.ค.–ต.ค. 2569');
  assert.ok(text(provenance({meta: {checkedOn: '2026-11-02', rentMonths: ['2026-05', '2026-10'], context: {rail: {asOf: '2026-10-31'}}}, unit: unitWords('count')}, 'x', {rail: true, rent: true}))
    .includes('ราคาประกาศ พ.ค.–ต.ค. 2569 · CityMETER Transit 31 ต.ค. 2569'));
});
