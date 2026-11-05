/**
 * Reading panel views as HTML strings. Pure: no DOM access, no map.
 *
 * Every actionable element carries data-action (+ data-id / data-value); the app binds one delegated handler.
 * Actions: select-area · select-office · select-building · select-station · select-province · filter-org ·
 * filter-group · filter-ev · set-metric · back · explore-top · clear-focus · open-charts · open-table · clear-filter ·
 * leave-area.
 *
 * Copy (owner rule carried from CityMETER · Hotel 0.3.1, “เรื่องภาษา ขอที่ กระชับอ่านเข้าใจง่าย ใช้ symbol, logo,
 * icon, charts มาช่วยทำให้ text กระชับ … ไม่มี caveats เลย และเป็นธรรมชาติ”): short Thai in the words of the people
 * choosing office space, buildings and locations; pictograms and small bar charts carry what a sentence used to; no
 * caveat on screen. Exactness comes from the names themselves — “ค่าเช่าที่ประกาศ”, “ราคาที่บันทึก (เดิม)”, a rank
 * “จาก N”, the n of every median, the numerator and denominator of every share (visible, or in the tile's title and
 * accessible name) — and from one provenance line per view: dataset · source · date · boundary, then “วิธีนับ”
 * (DATA_METHOD.md, where the method and its limits live). Two measures (js/model.js#METRICS): แห่ง (default) · ค่าเช่า.
 * A median rent needs RENT_MIN_N dated rents; with fewer the area lists its offices' own rents. Distances are straight
 * lines (the distance pictogram; “ระยะตรง” in titles). An office's pin inside a drawn building is “สำนักงานในอาคารนี้” /
 * “อีก N แห่งในอาคารนี้”, never “ตั้งอยู่ใน”. Sources, methods and ids sit in one closed <details>.
 */
import {productionLink, provinceByCode, hasPoint, stationLink, SIZE_BANDS, subName, RENT_MIN_N} from './model.js';
import {areaWord} from './areas.js';
import {cueMarkup} from './cues.js';
import {actionBar} from './ask.js';

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const num = n => NUMBER.format(n);
/** Whole-number share; a non-zero part never prints as 0% ("<1%"). */
export const pct = (part, whole) => (!whole ? '—' : part && Math.round((part / whole) * 100) === 0 ? '<1%' : `${NUMBER.format(Math.round((part / whole) * 100))}%`);
/** A number and its unit never split across lines in running text. */
const nw = html => `<span class="nowrap">${html}</span>`;
const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
/** Straight-line distance for display: "320 ม." / "1.4 กม.". */
export const meters = m => (!Number.isFinite(m) ? '' : m < 1000 ? `${num(Math.round(m / 10) * 10)} ม.` : `${(m / 1000).toLocaleString('th-TH', {maximumFractionDigits: 1})} กม.`);
const baht = v => `฿${num(v)}`;
/** A decorative pictogram of the approved subset (js/navigation.js PICTOGRAM_CONTRACT); the text carries the meaning. */
const pic = (kind, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(kind)}" aria-hidden="true"></i>`;
/** The method and its limits (one link at the end of every provenance line). */
export const METHOD_URL = 'DATA_METHOD.md';

export function link(url, label, cls = 'source-link') {
  const u = safeURL(url);
  return u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : '';
}

/** The line under an office's name (model.js#subName): its other name, Thai or English. */
export function subLine(r, cls, tag = 'p') {
  const sub = subName(r);
  return sub ? `<${tag} class="${cls}">${esc(sub)}</${tag}>` : '';
}

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export function thaiDate(iso) {
  if (/^\d{4}-\d{2}-\d{2}/.test(iso || '')) {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y + 543}`;
  }
  if (/^\d{4}-\d{2}$/.test(iso || '')) { const [y, m] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${y + 543}`; }
  return iso || '';
}
/** "พ.ค.–ต.ค. 2569" from listing months. */
export function monthSpan(months = []) {
  const list = [...months].filter(m => /^\d{4}-\d{2}/.test(m)).sort();
  if (!list.length) return '';
  const a = list[0].slice(0, 7), b = list.at(-1).slice(0, 7);
  if (a === b) return thaiDate(a);
  return a.slice(0, 4) === b.slice(0, 4) ? `${MONTHS[Number(a.slice(5)) - 1]}–${thaiDate(b)}` : `${thaiDate(a)}–${thaiDate(b)}`;
}

/** Asking rent of an office as text: "฿1,000–1,200" (one value when there is no top of the range). */
export function rentText(rent) {
  if (!rent) return '';
  return rent.max && rent.max !== rent.min ? `${baht(rent.min)}–${num(rent.max)}` : baht(rent.min);
}
/** Labels and the hover card read the same text. */
export const priceText = rentText;
/** A median rent with its n: "฿683 · 30 ราคา". */
const medianText = s => (s?.median != null ? `${baht(Math.round(s.median))}` : '');

/** Metric tile with a decorative pictogram; value may be a preformatted string. `detail` (numerator and denominator)
 *  is the tile's title and part of its accessible text. */
export function metricTile(value, label, kind = '', detail = '', sub = '') {
  const shown = typeof value === 'string' ? value : num(value);
  return `<div class="metric${kind ? ` metric-${kind}` : ''}"${detail ? ` title="${esc(detail)}"` : ''}>${pic(kind || 'plain', 'metric-symbol')}<strong class="data-number">${esc(shown)}</strong><span>${esc(label)}</span>${sub ? `<span class="metric-sub" aria-hidden="true">${esc(sub)}</span>` : ''}${detail ? `<span class="sr-only">${esc(detail)}</span>` : ''}</div>`;
}
export const heading = (kind, text, id = '') => `<h3${id ? ` id="${esc(id)}"` : ''}>${pic(kind)}${esc(text)}</h3>`;

const provinceName = code => provinceByCode(code)?.th || code || '';
/** "เขตบางรัก" / "อำเภอเมืองเชียงใหม่". */
const placeName = a => (a ? `${areaWord(a.province)}${a.name}` : '');
/** One word for a list of districts: เขต (all Bangkok), อำเภอ (none), else เขต/อำเภอ. */
export const words = areas => {
  const p = new Set(areas.map(a => a.province));
  return p.size === 1 ? areaWord([...p][0]) : 'เขต/อำเภอ';
};
const valueText = (v, unit) => nw(`<strong class="data-number">${num(v)}</strong> ${esc(unit.one)}`);
/** "อโศก (สุขุมวิท)" — next to the rail pictogram; "สถานีอโศก (สุขุมวิท)" in running text. */
const stationShort = s => (s ? `${s.name}${s.lines?.length ? ` (${s.lines.join(' · ')})` : ''}` : '');
const stationName = s => (s ? `สถานี${stationShort(s)}` : '');
/** The rent tile of a selection: its median from RENT_MIN_N dated rents, else the rents it has (“3 ราคา”), else “—”. */
const rentTile = (s, place = '') => (s?.n >= RENT_MIN_N
  ? metricTile(medianText(s), 'ค่าเช่ากลาง/ตร.ม./เดือน', 'price', `ค่ากลางของค่าเช่าเริ่มต้นที่ประกาศ ${num(s.n)} ราคา${place ? ` ใน${place}` : ''} บาทต่อตารางเมตรต่อเดือน`, `${num(s.n)} ราคา`)
  : metricTile(s?.n || 0, 'ราคาประกาศ', 'price', s?.n ? `ราคาประกาศ ${num(s.n)} รายการ ค่ากลางใช้ ${RENT_MIN_N} รายการขึ้นไป` : 'ไม่มีราคาประกาศในชุดข้อมูล'));

/* ---------- vocabularies (source details only) ---------- */

/** How the row's district was matched at build time (row.admin). */
export const ADMIN_TH = Object.freeze({
  name: 'จากชื่อเขต/อำเภอในข้อมูลของสำนักงาน',
  point: 'จากหมุดของสำนักงาน',
  province: 'ระบุได้แค่จังหวัด',
  conflict: 'หมุดกับข้อมูลอยู่คนละจังหวัด',
  none: 'ไม่ระบุจังหวัด',
});
/** What the building join of the research master says (01_OFFICES building_join_status, 2 Nov 2026), in reader words. */
const MASS_TH = Object.freeze({
  contained: 'หมุดอยู่ในรูปอาคาร', api: 'พบอาคารจากข้อมูลอาคารของ CityMETER', pending: 'รู้ชื่ออาคารที่ตั้ง ยังไม่มีรูปอาคาร',
  conflict: 'ข้อมูลอาคารขัดกัน', none: 'ไม่พบรูปอาคารที่หมุด', not_checked: 'ยังไม่ตรวจอาคาร',
});

/**
 * The provenance line every view that shows numbers ends with: dataset · source · date · boundary (each part in
 * `data-prov`, its word for screen readers), then the method link. Rent listings, rail and terrain sources join the
 * source part when the view shows them.
 */
export function provenance(ctx = {}, boundary = '', {rail = false, rent = false, terrain = false} = {}) {
  const meta = ctx.meta || {};
  const sources = ['CityMETER Office', 'หน้าทางการ', 'พอร์ตเจ้าของอาคาร',
    rent ? `ราคาประกาศ ${monthSpan(meta.rentMonths || [])}`.trim() : '',
    rail ? `CityMETER Transit ${thaiDate(meta.context?.rail?.asOf || '')}`.trim() : '',
    terrain ? `SRTM 30 ม. (2543)${ctx.osmDate ? ` · OSM ${thaiDate(ctx.osmDate)}` : ''}` : ''].filter(Boolean);
  return `<p class="hint panel-foot provenance"><span class="prov-part" data-prov="dataset">${pic('dataset')}<span class="sr-only">ชุดข้อมูล </span>CityMETER Office</span> <span class="prov-part" data-prov="source"><span class="sr-only">แหล่ง</span>จาก ${esc(sources.join(' · '))}</span><span class="prov-part" data-prov="date">${pic('date')}<span class="sr-only">ตรวจ </span>${esc(thaiDate(meta.checkedOn || ''))}</span><span class="prov-part" data-prov="boundary">${pic('area')}<span class="sr-only">ขอบเขต </span>${esc(boundary)}</span><span class="prov-part prov-method"><a href="${METHOD_URL}" target="_blank" rel="noopener">วิธีนับ</a></span></p>`;
}

/* ---------- shared fragments ---------- */

/** Bars per office category in the category's series colour + shape cue; value = offices. */
function groupBars(byGroup) {
  const list = byGroup.filter(g => g.count > 0).sort((a, b) => b.count - a.count || a.index - b.index);
  if (!list.length) return '<p class="hint">ไม่มีสำนักงาน</p>';
  const max = Math.max(1, ...list.map(g => g.count));
  return `<ul class="mix-list" aria-label="รูปแบบสำนักงาน (แห่ง)">${list.map(g => `
    <li><button type="button" class="mix-row" data-action="filter-group" data-value="${esc(g.id)}" title="ดูเฉพาะ${esc(g.th)}"><span class="mix-label">${cueMarkup(g.series)}${esc(g.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill category-${g.series}" style="width:${Math.max(3, Math.round((g.count / max) * 100))}%"></span></span>
      <span class="mix-value data-number">${num(g.count)}</span></button></li>`).join('')}</ul>`;
}

/** Offices per floor band; unknown floors are their own hatched bar (never a band). */
function sizeBars(sizes) {
  if (!sizes.bands.some(b => b.count) && !sizes.unknown) return '';
  const max = Math.max(1, sizes.unknown || 0, ...sizes.bands.map(b => b.count));
  const width = n => (n ? Math.max(3, Math.round((n / max) * 100)) : 0);
  return `<ul class="mix-list size-list" aria-label="ความสูงอาคาร (แห่ง)">${sizes.bands.map(b => `
    <li><span class="mix-label">${esc(b.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill size-fill" style="width:${width(b.count)}%"></span></span>
      <span class="mix-value data-number">${num(b.count)}</span></li>`).join('')}${sizes.unknown ? `
    <li title="ไม่ทราบจำนวนชั้น"><span class="mix-label">ไม่ทราบ</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill legend-nodata" style="width:${width(sizes.unknown)}%"></span></span>
      <span class="mix-value data-number">${num(sizes.unknown)}</span></li>` : ''}</ul>`;
}

/** Offices per evidence group (a filter each). */
function evidenceBars(list) {
  const shown = list.filter(e => e.count);
  if (shown.length < 2) return '';
  const max = Math.max(1, ...shown.map(e => e.count));
  return `<ul class="mix-list" aria-label="ที่มาของรายการ (แห่ง)">${shown.map(e => `
    <li><button type="button" class="mix-row" data-action="filter-ev" data-value="${esc(e.id)}" title="ดูเฉพาะ${esc(e.th)}"><span class="mix-label">${esc(e.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill size-fill" style="width:${Math.max(3, Math.round((e.count / max) * 100))}%"></span></span>
      <span class="mix-value data-number">${num(e.count)}</span></button></li>`).join('')}</ul>`;
}

const floorsText = r => (r?.floors ? `${num(r.floors)} ชั้น` : '');
function rowMeta(r, {showArea = false, index = null, distance = null} = {}) {
  const area = showArea && index && r.area ? index.byId.get(r.area) : null;
  const d = distance?.get?.(r.id);
  return [floorsText(r), r.rent ? `${rentText(r.rent)}/ตร.ม./เดือน` : '', r.orgs[0]?.org.short || '',
    area ? placeName(area) : showArea && !r.area ? (r.province ? provinceName(r.province) : 'ไม่ระบุจังหวัด') : '',
    Number.isFinite(d) ? meters(d) : ''].filter(Boolean).join(' · ');
}

/** Offices: cue (category) + name, then floors · rent · organisation · where · distance. */
export function officeList(rows, opts = {}) {
  return `<ul class="outlet-list">${rows.map(r => `<li><button type="button" class="brand-row" data-action="select-office" data-id="${esc(r.id)}">${cueMarkup(r.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(r.name || 'ไม่มีชื่อ')}</strong>${subLine(r, 'row-branch', 'span')}<span class="row-meta">${esc(rowMeta(r, opts))}</span></span></button></li>`).join('')}</ul>`;
}

/** "ดูทั้งหมด 193 แห่ง" under a shortened list. */
const moreButton = count => `<p class="list-more"><button type="button" class="link-button" data-action="open-table">ดูทั้งหมด ${num(count)} แห่ง</button></p>`;

/** Organisations as chips; each filters the map to that organisation's offices. */
function orgChips(list) {
  if (!list.length) return '<p class="hint">ไม่มีองค์กรในตัวกรองนี้</p>';
  return `<ul class="chip-list">${list.map(o => `<li><button type="button" class="brand-chip" data-action="filter-org" data-value="${esc(o.org.id)}" title="${esc(o.org.name)} — ${num(o.count)} แห่ง${o.roles.length ? ` · ${esc(o.roles.join(' · '))}` : ''} (ดูเฉพาะองค์กรนี้)">${pic('chain', 'chip-pic')}<span>${esc(o.org.short)}</span><small class="data-number">${num(o.count)}</small></button></li>`).join('')}</ul>`;
}

/** Districts ranked by the measure, bars in the map's 41-sample ramp colour (classOf). */
function areaRanking(list, classOf, unit, {title, note = '', limit = 10, showProvince = false, id = 'rank-title'} = {}) {
  const rent = unit.id === 'rent';
  const top = list.filter(a => (rent ? a.value != null : a.value > 0)).slice(0, limit);
  if (!top.length) return '';
  const max = Math.max(1, ...top.map(a => a.value));
  const shown = a => (rent ? baht(Math.round(a.value)) : num(a.value));
  return `<section class="panel-section" aria-labelledby="${esc(id)}">
    <div class="section-heading">${heading(rent ? 'price' : 'area', title, id)}<span class="hint">${esc(note)}</span></div>
    <ol class="rank-list">${top.map((a, i) => {
      const other = rent ? `${num(a.rentN)} ราคา · ${num(a.count)} แห่ง` : a.rentN >= RENT_MIN_N ? `ค่าเช่ากลาง ${baht(Math.round(a.rentMedian))} (${num(a.rentN)} ราคา)` : '';
      const where = [showProvince ? provinceName(a.province) : '', rent ? '' : `${num(a.value)} ${unit.one}`, other].filter(Boolean).join(' · ');
      return `<li><button type="button" class="rank-row" data-action="select-area" data-id="${esc(a.id)}" aria-label="อันดับ ${i + 1} ${esc(placeName(a))} ${showProvince ? esc(provinceName(a.province)) : ''} ${esc(shown(a))} ${esc(unit.one)} ${esc(other)}">
        <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
        <span class="rank-name">${esc(placeName(a))}<small>${esc(where)}</small></span>
        <span class="rank-track" aria-hidden="true"><span class="rank-fill" style="width:${Math.max(3, Math.round((a.value / max) * 100))}%;background:${esc(classOf(a))}"></span></span>
        <span class="rank-value data-number" aria-hidden="true">${esc(shown(a))}</span></button></li>`;
    }).join('')}</ol>
  </section>`;
}

/** Stations of CityMETER · Transit whose 500 m holds the most offices (each row at its nearest station). */
function stationRanking(list, {title = 'สถานีที่มีสำนักงานรอบ ๆ มากที่สุด', limit = 6} = {}) {
  const top = list.slice(0, limit);
  if (!top.length) return '';
  const max = Math.max(1, ...top.map(s => s.value));
  return `<section class="panel-section"><div class="section-heading">${heading('rail', title)}<span class="hint" title="ระยะตรงจากสถานีที่เปิดแล้ว">${pic('distance', 'hint-pic')}≤ 500 ม.</span></div>
    <ol class="rank-list">${top.map((s, i) => `<li><button type="button" class="rank-row" data-action="select-station" data-id="${esc(s.station.id)}" aria-label="${esc(stationName(s.station))} ${num(s.value)} แห่ง">
      <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
      <span class="rank-name">${esc(stationShort(s.station))}<small>${esc([`${num(s.count)} แห่ง`, s.rent.n >= RENT_MIN_N ? `ค่าเช่ากลาง ${baht(Math.round(s.rent.median))}` : ''].filter(Boolean).join(' · '))}</small></span>
      <span class="rank-track" aria-hidden="true"><span class="rank-fill rail-fill" style="width:${Math.max(3, Math.round((s.value / max) * 100))}%"></span></span>
      <span class="rank-value data-number" aria-hidden="true">${num(s.value)}</span></button></li>`).join('')}</ol></section>`;
}

/** "x จาก y แห่ง ห่างสถานีที่เปิดแล้วไม่เกิน 500 ม." — the title and accessible text of a rail share. */
const railDetail = s => `${num(s.within)} จาก ${num(s.base)} แห่ง ห่างสถานีรถไฟฟ้าที่เปิดแล้วไม่เกิน 500 ม. (ระยะตรง)`;

/* ---------- Organisation card (organisation filter) ---------- */

export function renderOrgCard(p, ctx = {}) {
  if (!p) return '';
  const o = p.org;
  const roles = p.roles.length ? `<p class="rule-chips">${p.roles.map(([th, n]) => `<span class="rule-chip">${esc(th)} ${nw(`<span class="data-number">${num(n)}</span>`)}</span>`).join('')}</p>` : '';
  const rail = p.rail?.base ? metricTile(pct(p.rail.within, p.rail.base), 'ใกล้รถไฟฟ้า', 'rail', railDetail(p.rail)) : '';
  return `<section class="brand-card detail-head" aria-labelledby="org-title">
      <div class="identity">${pic('chain', 'identity-pic')}<div>
        <p class="eyebrow">องค์กร</p>
        <h2 id="org-title">${esc(o.short)}</h2>${o.short !== o.name ? `<p class="subtle">${esc(o.name)}</p>` : ''}</div></div>
      ${p.scopeCount ? `<div class="metrics compact">${metricTile(p.scopeCount, 'แห่ง', 'building')}${metricTile(p.provinces, 'จังหวัด', 'province')}${rail}${p.rent.n ? rentTile(p.rent) : ''}</div>` : ''}
      ${roles}
      ${actionBar({kind: 'org', org: o})}
      <div class="detail-actions"><button type="button" class="btn quiet" data-action="clear-filter" data-id="org">ดูทุกองค์กร</button></div>
    </section>`;
}

/* ---------- Overview ---------- */

/** The district(s) with the most of the measure outside the leading province — every district tied at that value. */
function outsideLine(insight, home, unit, province) {
  const o = insight.outside;
  const rent = insight.mode === 'rent';
  if (!o || province || (!rent && o.value < 2)) return '';
  const linkTo = a => `<button type="button" class="link-button" data-action="select-area" data-id="${esc(a.id)}">${esc(placeName(a))}</button> ${esc(provinceName(a.province))}`;
  const tied = o.tied || [o];
  const top = insight.areas[0];
  const lead = `${pic('rank')}${rent ? 'ค่าเช่าสูงสุด' : 'อันดับ 1'}นอก${esc(home)}`;
  const figure = rent ? nw(`<strong class="data-number">${baht(Math.round(o.value))}</strong> · ${num(o.rentN)} ราคา`) : valueText(o.value, unit);
  if (tied.length === 1) {
    const more = !rent && top && o.value > top.value ? ` · มากกว่าทุก${esc(areaWord(insight.home))}ของ${esc(home)}` : '';
    return `<p class="aha-secondary">${lead}: ${linkTo(tied[0])} ${figure}${more}</p>`;
  }
  const shown = tied.slice(0, 3), rest = tied.length - shown.length;
  return `<p class="aha-secondary">${lead} (เท่ากัน ${num(tied.length)} พื้นที่): ${shown.map(linkTo).join(' · ')}${rest ? ` +${num(rest)}` : ''} · ${figure}</p>`;
}

/** Rail comparison of the count Aha as two bars: the focus vs the rest of the province (bases in the title and for
 *  screen readers); hidden when nothing is near rail. */
function railCompare(insight, count, w) {
  const f = insight.rail?.focus, r = insight.rail?.rest;
  if (!f || !r || !f.base || !r.base || !(f.within + r.within)) return '';
  const here = count === 1 ? placeName(insight.areas[0]) : `${num(count)} ${w}นี้`;
  const bar = (label, s) => `<li title="${esc(railDetail(s))}"><span class="mix-label">${esc(label)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill rail-fill" style="width:${Math.max(2, Math.round((s.within / s.base) * 100))}%"></span></span>
      <span class="mix-value data-number">${pct(s.within, s.base)}</span><span class="sr-only">${esc(railDetail(s))}</span></li>`;
  return `<div class="aha-rail"><p class="aha-rail-title">${pic('rail')}ใกล้รถไฟฟ้า ≤ 500 ม.</p>
    <ul class="mix-list rail-compare">${bar(here, f)}${bar(`${w}อื่น`, r)}</ul></div>`;
}

/** Rent near rail and farther (the province's dated rents with a point): two medians with their n; hidden without both. */
function rentRailCompare(rr) {
  if (!rr || rr.near.n < RENT_MIN_N || rr.far.n < RENT_MIN_N) return '';
  const max = Math.max(rr.near.median, rr.far.median);
  const detail = (s, where) => `ค่ากลางค่าเช่าที่ประกาศ ${where} ${baht(Math.round(s.median))} จาก ${num(s.n)} ราคา (ระยะตรงจากสถานีที่เปิดแล้ว)`;
  const bar = (label, s, where) => `<li title="${esc(detail(s, where))}"><span class="mix-label">${esc(label)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill rail-fill" style="width:${Math.max(2, Math.round((s.median / max) * 100))}%"></span></span>
      <span class="mix-value data-number">${baht(Math.round(s.median))}</span><span class="sr-only">${esc(detail(s, where))}</span></li>`;
  return `<div class="aha-rail"><p class="aha-rail-title">${pic('rail')}ค่าเช่ากลางตามระยะถึงรถไฟฟ้า</p>
    <ul class="mix-list rail-compare">${bar(`≤ 500 ม. · ${num(rr.near.n)} ราคา`, rr.near, 'ไม่เกิน 500 ม.')}${bar(`ไกลกว่า · ${num(rr.far.n)} ราคา`, rr.far, 'ไกลกว่า 500 ม.')}</ul></div>`;
}

/** The rent Aha: the districts of the leading province with the highest median asking rent, beside its own median. */
function rentAha(insight, focusMode, province) {
  const home = provinceName(insight.home);
  const count = insight.areas.length;
  const w = words(insight.areas);
  if (!count) {
    return `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p><h2><span class="aha-headline">ยังไม่มี${esc(w)}ที่มีราคาประกาศครบ ${num(RENT_MIN_N)} รายการในตัวกรองนี้</span></h2>
      <p class="aha-copy">${nw(`ราคาประกาศ ${num(insight.national.n)} รายการ`)}${insight.national.n ? ` · ${nw(`ค่ากลาง ${baht(Math.round(insight.national.median))}`)}` : ''}</p>
      <div class="aha-actions"><button type="button" data-action="set-metric" data-value="count" class="btn">ดูจำนวนสำนักงาน</button></div></section>`;
  }
  const toggle = focusMode === 'auto'
    ? '<button type="button" data-action="clear-focus" class="btn">ดูทุกพื้นที่</button>'
    : `<button type="button" data-action="explore-top" class="btn primary">โฟกัส ${num(count)} ${esc(w)}นี้</button>`;
  const list = `<ol class="aha-rent">${insight.areas.map(a => `<li><button type="button" class="link-button" data-action="select-area" data-id="${esc(a.id)}">${esc(a.name)}</button> ${nw(`<strong class="data-number">${baht(Math.round(a.value))}</strong>`)} <small>${nw(`${num(a.rentN)} ราคา`)}</small></li>`).join('')}</ol>`;
  const hs = insight.homeStats;
  return `<section class="aha${focusMode === 'auto' ? ' is-auto' : ''}" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ · ค่าเช่าที่ประกาศ /ตร.ม./เดือน</p>
      <h2><span class="aha-headline">${esc(w)}ที่ค่าเช่ากลางสูงสุดใน${esc(home)}</span></h2>
      ${list}
      <p class="aha-copy" title="ค่ากลางของค่าเช่าเริ่มต้นที่ประกาศทุกรายการใน${esc(home)}">${nw(`ทั้ง${esc(home)} <strong class="data-number">${baht(Math.round(hs.median))}</strong>`)} · ${nw(`${num(hs.n)} ราคา`)}</p>
      ${rentRailCompare(insight.rail)}${outsideLine(insight, home, null, province)}
      <div class="aha-actions">${toggle}<button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
}

/**
 * focusMode: 'auto' (default top districts) · 'explicit' (user-chosen) · 'none' (every district).
 */
export function renderOverview({insight, summary, overview, focusMode = 'auto', classOf = () => 'var(--scale-count-3)', provinces = [], unknownProvince = 0,
  province = '', orgCard = '', stations = [], ctx = {}}) {
  const unit = ctx.unit;
  const rent = unit.id === 'rent';
  const count = insight.areas.length;
  const w = words(insight.areas);
  const names = insight.areas.map(a => `<button type="button" class="link-button" data-action="select-area" data-id="${esc(a.id)}">${esc(a.name)}</button>`).join(' · ');
  const home = provinceName(insight.home);
  let aha;
  if (!summary.count && focusMode !== 'explicit') {
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p><h2>ไม่พบสำนักงานตามตัวกรองนี้</h2>
      <div class="aha-actions"><button type="button" data-action="clear-filter" data-id="all" class="btn">ล้างตัวกรอง</button></div></section>`;
  } else if (focusMode === 'explicit') {
    const figure = rent
      ? (summary.rentN >= RENT_MIN_N ? `${nw(`ค่าเช่ากลาง <strong class="data-number">${baht(Math.round(summary.rentMedian))}</strong>`)} · ${nw(`${num(summary.rentN)} ราคา`)} · ` : '')
      : '';
    aha = `<section class="aha is-focused" aria-label="ข้อค้นพบ"><p class="eyebrow">โฟกัส ${num(count)} ${esc(w)}</p>
      <h2>${insight.areas.map(a => esc(a.name)).join(' · ')}</h2>
      <p class="aha-copy">${figure}${nw(`<strong class="data-number">${num(insight.count)}</strong> แห่ง`)}</p>
      <div class="aha-actions"><button type="button" data-action="clear-focus" class="btn">ดูทุกพื้นที่</button><button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  } else if (rent) {
    aha = rentAha(insight, focusMode, province);
  } else if (!count && insight.spread) {
    const sw = areaWord(insight.home), sp = insight.spread;
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${num(sp.areas)}</span><span class="aha-headline">${esc(sw)}ใน${esc(home)} มีสำนักงานเท่ากัน ${esc(sw)}ละ ${num(sp.value)} แห่ง</span></h2>
      ${outsideLine(insight, home, unit, province)}
      <div class="aha-actions"><button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  } else if (!count) {
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p><h2><span class="aha-number data-number">${num(summary.count)}</span><span class="aha-headline">แห่ง · ไม่ระบุเขต/อำเภอ</span></h2>
      <div class="aha-actions"><button type="button" data-action="open-table" class="btn">ดูรายชื่อ</button></div></section>`;
  } else {
    const toggle = focusMode === 'auto'
      ? '<button type="button" data-action="clear-focus" class="btn">ดูทุกพื้นที่</button>'
      : `<button type="button" data-action="explore-top" class="btn primary">โฟกัส ${num(count)} ${esc(w)}นี้</button>`;
    const where = count === 1 ? esc(placeName(insight.areas[0])) : ` ${nw(`${num(count)} ${esc(w)}นี้`)}`;
    const total = insight.homeValue ?? insight.homePlacedValue;
    aha = `<section class="aha${focusMode === 'auto' ? ' is-auto' : ''}" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${pct(insight.value, total)}</span><span class="aha-headline">ของสำนักงานใน${esc(home)} อยู่ใน${where}</span></h2>
      <p class="aha-copy">${names}<br>${nw(`<strong class="data-number">${num(insight.value)}</strong> จาก ${num(total)} แห่ง`)}</p>
      ${railCompare(insight, count, w)}${outsideLine(insight, home, unit, province)}
      <div class="aha-actions">${toggle}<button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  }
  const narrowed = focusMode !== 'none' && count > 0 && summary.count !== overview.count;
  const metrics = `<section class="metrics" aria-label="${narrowed ? 'ตัวเลขของพื้นที่ที่โฟกัส' : 'ตัวเลขรวมของข้อมูลที่เลือก'}">
    ${metricTile(summary.count, `แห่ง${narrowed ? ' ในโฟกัส' : ''}`, 'building')}
    ${rentTile(summary.rent)}
    ${metricTile(summary.areas, narrowed ? w : 'เขต/อำเภอ', 'area')}
    ${metricTile(summary.provinces, 'จังหวัด', 'province')}
  </section>`;
  const scopeText = province ? provinceName(province) : 'ประเทศไทย';
  const provinceValue = p => (rent ? baht(Math.round(p.value)) : num(p.value));
  const provinceRows = p => `<li><button type="button" class="province-row" data-action="select-province" data-id="${esc(p.code)}" aria-label="${esc(p.name)} ${esc(provinceValue(p))} ${esc(unit.one)}${rent ? ` ${num(p.rentN)} ราคา` : ''} กดเพื่อดูจังหวัด"><i class="province-swatch" style="background:${esc(p.fill)}" aria-hidden="true"></i><span class="province-name">${esc(p.name)}</span><span class="province-count data-number">${esc(provinceValue(p))}<small>${esc(rent ? `${num(p.rentN)} ราคา` : unit.one)}</small></span></button></li>`;
  const shown = provinces.slice(0, 8), rest = provinces.slice(8);
  const unknown = unknownProvince ? `<p class="hint">ไม่ระบุจังหวัด ${nw(`${num(unknownProvince)} แห่ง`)}</p>` : '';
  const provinceList = provinces.length > 1 ? `<section class="panel-section" aria-labelledby="province-title">
    <div class="section-heading">${heading('province', rent ? 'จังหวัดที่ค่าเช่าที่ประกาศสูงสุด' : 'จังหวัดที่มีสำนักงานมากที่สุด', 'province-title')}<span class="hint">${num(provinces.length)} จังหวัด</span></div>
    <ul class="province-list">${shown.map(provinceRows).join('')}</ul>
    ${rest.length ? `<details class="more-provinces"><summary>อีก ${num(rest.length)} จังหวัด</summary><ul class="province-list">${rest.map(provinceRows).join('')}</ul></details>` : ''}
    ${unknown}</section>` : '';
  const rw = province ? areaWord(province) : 'เขต/อำเภอ';
  const measuredCount = overview.ranking.filter(a => (rent ? a.value != null : a.value > 0)).length;
  const ranking = areaRanking(overview.ranking, classOf, unit, {title: rent ? `${rw}ที่ค่าเช่าที่ประกาศสูงสุด` : `${rw}ที่มีสำนักงานมากที่สุด`,
    note: rent ? `${num(measuredCount)} ${rw} · ≥ ${num(RENT_MIN_N)} ราคา` : `${num(measuredCount)} ${rw}`, showProvince: !province});
  const mix = overview.count ? `<section class="panel-section"><div class="section-heading">${heading('segment', 'รูปแบบสำนักงาน')}<span class="hint">แห่ง</span></div>${groupBars(overview.mix.byGroup)}</section>` : '';
  const sizes = overview.count ? `<section class="panel-section"><div class="section-heading">${heading('relief', 'ความสูงอาคาร')}<span class="hint">แห่ง</span></div>${sizeBars(overview.sizes)}</section>` : '';
  const ev = overview.count ? evidenceBars(overview.evidence) : '';
  const evidence = ev ? `<section class="panel-section"><div class="section-heading">${heading('dataset', 'ที่มาของรายการ')}<span class="hint">แห่ง</span></div>${ev}</section>` : '';
  const orgs = overview.orgs.length && !orgCard ? `<section class="panel-section"><div class="section-heading">${heading('chain', 'องค์กรที่มีสำนักงานมากที่สุด')}<span class="hint"><button type="button" class="link-button" data-action="open-charts" data-value="orgs">ดูทุกองค์กร</button></span></div>${orgChips(overview.orgs)}
    <p class="fact-line">${pic('chain', 'fact-icon')}ระบุองค์กร ${nw(`<strong class="data-number">${num(overview.withOrg)}</strong> จาก ${num(overview.count)} แห่ง`)}</p></section>` : '';
  const rail = stationRanking(stations);
  return `${orgCard}${aha}${metrics}${provinceList}${ranking}${rail}${mix}${sizes}${orgs}${evidence}${orgCard ? '' : actionBar({kind: 'overview', province: province ? provinceName(province) : ''})}${provenance(ctx, scopeText, {rail: Boolean(rail || insight.rail?.focus?.within || insight.rail?.near?.n), rent: rent || summary.rentN > 0})}`;
}

/* ---------- Empty selections (EVID-05) ---------- */

/**
 * measured_zero: every district is in the register's national scope, so a district with no office under the
 * filters is a measured 0 of this dataset — offered with where the same filters match. Never "no data".
 */
function selectionNote(p, place, ctx) {
  if (p.coverageState !== 'measured_zero') return '';
  const elsewhere = p.scopeCount > 0
    ? `<span>พบในพื้นที่อื่น <strong class="data-number">${num(p.scopeCount)}</strong> แห่ง</span><button type="button" class="btn quiet" data-action="leave-area">ดูพื้นที่ที่พบ</button>`
    : '';
  return `<div class="empty-note" role="note"><strong>ไม่พบสำนักงานใน${esc(place)}${ctx.filtered ? 'ตามตัวกรองนี้' : ''}</strong>${elsewhere}</div>`;
}

/** The asking rents of an area's offices, highest first (the median's own rows; each office's month beside it). */
function rentList(rows, limit = 8) {
  if (!rows.length) return '';
  const shown = rows.slice(0, limit);
  return `<ul class="outlet-list rent-list">${shown.map(r => `<li><button type="button" class="brand-row" data-action="select-office" data-id="${esc(r.id)}">${cueMarkup(r.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(r.name)}</strong><span class="row-meta">${esc([`${rentText(r.rent)} /ตร.ม./เดือน`, r.rent.on ? thaiDate(r.rent.on) : 'ไม่ระบุเดือน', floorsText(r)].filter(Boolean).join(' · '))}</span></span></button></li>`).join('')}</ul>${rows.length > limit ? `<p class="hint">อีก ${num(rows.length - limit)} ราคาในรายชื่อ</p>` : ''}`;
}

/* ---------- District (เขต/อำเภอ) ---------- */

export function renderArea(p, classOf, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit, a = p.area, w = p.words, rent = unit.id === 'rent';
  const place = `${w.area}${a.name}`, prov = provinceName(a.province);
  const tie = t => (t ? ' (ร่วม)' : '');
  const rank = p.rank ? `<p class="rank-line">${pic('rank')}${rent ? 'ค่าเช่าสูงอันดับ' : 'อันดับ'} ${num(p.rank)}${tie(p.rankTied)} จาก ${num(p.rankOf)} ทั่วประเทศ${p.rankProvince && p.rankProvinceOf > 1 ? ` · ${num(p.rankProvince)}${tie(p.rankProvinceTied)} จาก ${num(p.rankProvinceOf)} ใน${esc(prov)}` : ''}</p>` : '';
  const listLimit = 30;
  const share = p.count && p.provinceCount ? pct(p.count, p.provinceCount) : '—';
  const shareDetail = p.count && p.provinceCount ? `${num(p.count)} จาก ${num(p.provinceCount)} แห่งของ${prov}` : '';
  const railShare = p.rail?.base ? pct(p.rail.within, p.rail.base) : '—';
  const head = `<section class="detail-head">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${esc(w.area)} · <button type="button" class="link-button" data-action="select-province" data-id="${esc(a.province)}">${esc(prov)}</button></p>
      <h2>${esc(place)}</h2>${a.nameEn ? `<p class="subtle">${esc(a.nameEn)}</p>` : ''}
      ${rank}
      <div class="metrics compact">${metricTile(p.count, 'แห่ง', 'building')}${rentTile(p.rent, place)}${metricTile(share, `ของ${prov}`, 'province', shareDetail)}${metricTile(railShare, 'ใกล้รถไฟฟ้า', 'rail', p.rail?.base ? railDetail(p.rail) : '')}</div>
      ${selectionNote(p, place, ctx)}
      ${actionBar({kind: 'area', area: {place, province: prov}})}
      <div class="detail-actions">${p.count ? '<button type="button" class="btn" data-action="open-table">ดูรายชื่อ</button><button type="button" class="btn quiet" data-action="open-charts">เปรียบเทียบพื้นที่</button>' : ''}${link(productionLink({province: a.province, area: a.id}), 'ดูใน CityMETER', 'btn quiet source-link')}</div>
    </section>
`;
  const boundary = `${place} ${prov}`;
  if (!p.count) return `${head}${provenance(ctx, boundary)}`;
  const rents = p.rentRows.length ? `<section class="panel-section"><div class="section-heading">${heading('price', 'ค่าเช่าที่ประกาศ')}<span class="hint">/ตร.ม./เดือน</span></div>${rentList(p.rentRows)}
    ${p.provinceRent.n >= RENT_MIN_N ? `<p class="fact-line" title="ค่ากลางของค่าเช่าเริ่มต้นที่ประกาศทุกรายการใน${esc(prov)}">${pic('price', 'fact-icon')}ทั้ง${esc(prov)} ${nw(`<strong class="data-number">${baht(Math.round(p.provinceRent.median))}</strong>`)} · ${nw(`${num(p.provinceRent.n)} ราคา`)}</p>` : ''}</section>` : '';
  const orgs = p.orgs.length ? `<section class="panel-section"><div class="section-heading">${heading('chain', 'องค์กร')}<span class="hint">ระบุองค์กร ${num(p.withOrg)} แห่ง</span></div>${orgChips(p.orgs)}</section>` : '';
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('segment', 'รูปแบบสำนักงาน')}<span class="hint">แห่ง</span></div>${groupBars(p.byGroup)}</section>
    ${rents}
    <section class="panel-section"><div class="section-heading">${heading('relief', 'ความสูงอาคาร')}<span class="hint">แห่ง</span></div>${sizeBars(p.sizes)}</section>
    ${stationRanking(p.stations, {title: 'สถานีใกล้สำนักงาน'})}
    ${orgs}
    <section class="panel-section"><div class="section-heading">${heading('building', 'สำนักงาน')}<span class="hint">เรียงตามความสูง</span></div>${officeList(p.rows.slice(0, listLimit))}
      ${p.count > listLimit ? moreButton(p.count) : ''}</section>
    ${provenance(ctx, boundary, {rail: Boolean(p.rail?.base), rent: Boolean(p.rentRows.length)})}`;
}

/* ---------- Station (CityMETER · Transit) ---------- */

export function renderStation(p, ctx = {}) {
  if (!p) return '';
  const s = p.station;
  const building = s.status !== 'operating';
  const listLimit = 40;
  const head = `<section class="detail-head station">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity">${pic('rail', 'identity-pic')}<div>
        <p class="eyebrow">สถานีรถไฟฟ้า${s.lines?.length ? ` · ${esc(s.lines.join(' · '))}` : ''}${building ? ` · ${pic('construction')}กำลังสร้าง` : ''}</p>
        <h2>สถานี${esc(s.name)}</h2>${s.nameEn ? `<p class="subtle">${esc(s.nameEn)}</p>` : ''}</div></div>
      <div class="metrics compact">${metricTile(p.count, 'แห่ง', 'building')}${rentTile(p.rent, `รัศมี ${meters(p.radius)}`)}${metricTile(p.radius, 'ม. รอบสถานี', 'distance', `ระยะตรงจากจุดอ้างอิงของสถานี ${meters(p.radius)}`)}</div>
      ${actionBar({kind: 'station', station: s, point: {lat: s.lat, lon: s.lon, role: 'station'}})}
      <div class="detail-actions">${link(stationLink(s), 'ดูใน CityMETER Transit', 'btn quiet source-link')}</div>
    </section>
`;
  const boundary = `รัศมี ${meters(p.radius)} จากสถานี${s.name}`;
  if (!p.count) return `${head}<div class="empty-note" role="note"><strong>ไม่พบสำนักงานรอบสถานีนี้</strong></div>${provenance(ctx, boundary, {rail: true})}`;
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('segment', 'รูปแบบสำนักงาน')}<span class="hint">แห่ง</span></div>${groupBars(p.byGroup)}</section>
    ${p.orgs.length ? `<section class="panel-section"><div class="section-heading">${heading('chain', 'องค์กร')}</div>${orgChips(p.orgs)}</section>` : ''}
    <section class="panel-section"><div class="section-heading">${heading('building', 'สำนักงาน')}<span class="hint">เรียงตามความสูง</span></div>${officeList(p.rows.slice(0, listLimit), {showArea: true, index: ctx.index, distance: p.distance})}
      ${p.count > listLimit ? moreButton(p.count) : ''}</section>
    ${provenance(ctx, boundary, {rail: true, rent: p.rent.n > 0})}`;
}

/* ---------- Building (display-time spatial join) ---------- */

/** Where a drawn building's outline and height come from (per อปท./เขต, js/building-units.js). */
export const BUILDING_SOURCE_TH = Object.freeze({osm: 'OpenStreetMap', cm: 'CityMETER Building V4'});

export function renderBuilding(b, ctx = {}) {
  if (!b) return '';
  const w = b.words;
  const area = b.area ? `${w.area}${b.area.name}` : '';
  const source = BUILDING_SOURCE_TH[b.kind] || BUILDING_SOURCE_TH.osm;
  // “สูงราว”: a CityMETER height is the dataset's model estimate, an OSM height a tag or the schema's default; the
  // source is named in the title and in the provenance line.
  const height = b.height != null ? `<span title="ความสูงจาก ${esc(source)}">สูงราว ${num(Math.round(b.height))} ม.</span>` : '';
  const withPoint = b.rows.find(hasPoint);
  return `<section class="detail-head building">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${pic('building')} ${b.area ? `<button type="button" class="link-button" data-action="select-area" data-id="${esc(b.area.id)}">${esc(area)}</button>` : 'อาคาร'}${height ? ` · ${height}` : ''}</p>
      <h2>สำนักงานในอาคารนี้</h2>
      <div class="metrics compact">${metricTile(b.count, 'แห่ง', 'building')}${b.rent.n ? rentTile(b.rent) : ''}</div>
      ${actionBar({kind: 'building', rows: b.rows, area: b.area ? {place: area, province: provinceName(b.area.province)} : null,
        point: withPoint ? {lat: withPoint.latitude, lon: withPoint.longitude, role: 'point'} : null})}
    </section>
    <section class="panel-section"><div class="section-heading">${heading('building', 'สำนักงาน')}<span class="hint">${num(b.count)}</span></div>${officeList(b.rows.slice(0, 40), {showArea: b.areaCount > 1, index: ctx.index})}
      ${b.count > 40 ? moreButton(b.count) : ''}</section>
    ${provenance(ctx, `หมุดในขอบอาคาร ${source}${area ? ` · ${area}` : ''}`, {rent: b.rent.n > 0})}`;
}

/* ---------- Office ---------- */

/** Rent comparison set: offices with an asking rent within the radius, nearest first, and every office round it. */
function compsetSection(c) {
  if (!c) return '';
  const rule = [`${pic('price')}มีค่าเช่าที่ประกาศ`, `${pic('distance')}≤ ${esc(meters(c.radius))}`].map(t => `<span class="rule-chip">${t}</span>`).join('');
  const list = c.rows.length
    ? `<ul class="outlet-list compset">${c.rows.map(({row: r, m}) => `<li><button type="button" class="brand-row" data-action="select-office" data-id="${esc(r.id)}">${cueMarkup(r.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(r.name)}</strong><span class="row-meta">${esc([meters(m), `${rentText(r.rent)} /ตร.ม./เดือน`, r.rent.on ? thaiDate(r.rent.on) : '', floorsText(r)].filter(Boolean).join(' · '))}</span></span></button></li>`).join('')}</ul>`
    : '<p class="hint">ไม่พบค่าเช่าที่ประกาศในรัศมีนี้</p>';
  const around = c.around.rent.n >= RENT_MIN_N ? ` · ค่ากลาง ${nw(`<strong class="data-number">${baht(Math.round(c.around.rent.median))}</strong>`)} (${nw(`${num(c.around.rent.n)} ราคา`)})` : '';
  return `<section class="panel-section"><div class="section-heading">${heading('compare', 'ค่าเช่ารอบ ๆ')}<span class="hint">${num(c.matches)} แห่ง</span></div>
    <p class="rule-chips" title="สำนักงานที่มีค่าเช่าที่ประกาศ ในระยะตรง ${esc(meters(c.radius))} เรียงใกล้ก่อน">${rule}</p>${list}
    <p class="fact-line">${pic('building', 'fact-icon')}สำนักงานรอบ ${esc(meters(c.radius))} ${nw(`<strong class="data-number">${num(c.around.count)}</strong> แห่ง`)}${around}</p></section>`;
}

export function renderOffice(d, ctx = {}) {
  if (!d) return '';
  const r = d.row, w = d.words;
  const prov = provinceName(r.province);
  const coords = hasPoint(r) ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : '';
  const areaChip = d.area
    ? `<button type="button" class="fact-chip" data-action="select-area" data-id="${esc(d.area.id)}">${pic('area')}${esc(w.area)}${esc(d.area.name)} · ${esc(prov)}</button>`
    : r.province ? `<button type="button" class="fact-chip" data-action="select-province" data-id="${esc(r.province)}">${pic('province')}${esc(prov)}</button>` : '<span class="fact-chip is-quiet">ไม่ระบุจังหวัด</span>';
  const size = SIZE_BANDS.find(b => b.id === r.size);
  const floorsChip = r.floors ? `<span class="fact-chip" title="จำนวนชั้นของอาคาร · ${esc(r.floorStatus)}">${pic('relief')}${nw(`${num(r.floors)} ชั้น`)}${size ? ` · ${esc(size.short)}` : ''}</span>` : '';
  const rentChip = r.rent ? `<span class="fact-chip" title="ค่าเช่าเริ่มต้นที่ประกาศ บาทต่อตารางเมตรต่อเดือน · ${esc(r.rent.basis)}">${pic('price')}${esc(rentText(r.rent))} ${nw('/ตร.ม./เดือน')}${r.rent.on ? ` · ${nw(esc(thaiDate(r.rent.on)))}` : ''}</span>` : '';
  const legacyChip = !r.rent && r.legacyPrice ? `<span class="fact-chip" title="ราคาเดิมใน CityMETER production บาทต่อตารางเมตร">${pic('price')}${esc(rentText(r.legacyPrice))} ${nw('/ตร.ม. ที่บันทึก (เดิม)')}</span>` : '';
  const spaceChip = r.space ? `<span class="fact-chip" title="${esc(r.space.basis)} · ${esc(r.space.status)}">${pic('area')}${nw(`${num(r.space.sqm)} ตร.ม.`)}</span>` : '';
  const occChip = r.occupancy ? `<span class="fact-chip" title="อัตราการเช่าตามรายงานของเจ้าของ · ${esc(r.occupancy.scope)}">${pic('meeting')}เช่าแล้ว ${esc(r.occupancy.rate)}${r.occupancy.ref ? ` · ${esc(/^\d{4}-\d{2}-\d{2}$/.test(r.occupancy.ref) ? thaiDate(r.occupancy.ref) : r.occupancy.ref)}` : ''}</span>` : '';
  const railChip = r.rail ? `<button type="button" class="fact-chip" data-action="select-station" data-id="${esc(r.rail.station.id)}" title="สถานีที่เปิดแล้วที่ใกล้ที่สุด · ระยะตรง">${pic('rail')}${esc(stationShort(r.rail.station))} ${nw(esc(meters(r.rail.m)))}</button>` : '';
  const nextChip = r.railNext && (!r.rail || r.railNext.m < r.rail.m)
    ? `<span class="fact-chip" title="สถานีที่กำลังสร้างที่ใกล้ที่สุด · ระยะตรง">${pic('construction')}${esc(stationShort(r.railNext.station))} ${nw(esc(meters(r.railNext.m)))} · กำลังสร้าง</span>` : '';
  const orgChipsHTML = r.orgs.map(o => `<button type="button" class="fact-chip" data-action="filter-org" data-value="${esc(o.org.id)}" title="${esc(o.org.name)} · ${esc(o.roles.map(x => x.th).join(' · '))} (ดูทุกสำนักงานขององค์กรนี้)">${pic('chain')}${esc(o.org.short)}</button>`).join('');
  const bd = d.building;
  const buildingChip = bd?.others ? `<button type="button" class="fact-chip" data-action="select-building" data-id="${esc(bd.key)}" title="หมุดของสำนักงานอีก ${num(bd.others)} แห่งอยู่ในอาคารนี้บนแผนที่">${pic('building')}อีก ${num(bd.others)} แห่งในอาคารนี้</button>` : '';
  const sameOrg = d.sameOrg.filter(x => x.count).map(x => `<p class="fact-line">${pic('chain', 'fact-icon')}${esc(x.org.short)} อีก ${nw(`<button type="button" class="link-button" data-action="filter-org" data-value="${esc(x.org.id)}">${num(x.count)} แห่ง</button>`)} · ${nw(`${num(x.provinces)} จังหวัด`)}</p>`).join('');
  const point = coords
    ? `<span class="data-number">${esc(coords)}</span>${r.coordRole ? `<br><span class="hint">${esc(r.coordRole)}</span>` : ''}`
    : '<span>ไม่มีพิกัด</span>';
  const roleLines = r.orgs.map(o => `${esc(o.org.name)} · ${esc(o.roles.map(x => x.th).join(' · '))}`).join('<br>');
  return `<section class="detail-head store">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity"><span class="identity-cue">${cueMarkup(r.series)}</span><div>
        <p class="eyebrow eyebrow-cue">${esc(d.group?.th || '')}${r.model && r.model !== d.group?.th ? ` · ${esc(r.model)}` : ''}</p>
        <h2>${esc(r.name || 'ไม่มีชื่อ')}</h2>
        ${subLine(r, 'branch-name', 'p')}</div></div>
      <div class="fact-chips">${rentChip}${legacyChip}${floorsChip}${spaceChip}${occChip}${orgChipsHTML}${areaChip}${railChip}${nextChip}${buildingChip}${coords ? '' : '<span class="fact-chip is-quiet">ไม่มีพิกัด</span>'}</div>
      ${sameOrg}
      ${actionBar({kind: 'office', row: r, area: d.area ? {place: `${w.area}${d.area.name}`, province: prov} : r.province ? {place: '', province: prov} : null,
        point: hasPoint(r) ? {lat: r.latitude, lon: r.longitude, role: 'point'} : null})}
      <details class="source-details"><summary>ที่มาและพิกัด</summary>
        <dl class="facts">
          <dt>แหล่ง</dt><dd>${esc(r.source?.th || 'แหล่งทางการ')}${r.url ? ` · ${link(r.url, 'หน้าแหล่ง')}` : r.source?.url ? ` · ${link(r.source.url, 'CityMETER production')}` : ''}</dd>
          <dt>หลักฐาน</dt><dd>${esc(r.evidence?.th || '')}</dd>
          ${r.project ? `<dt>โครงการ</dt><dd>${esc(r.project)}</dd>` : ''}
          ${r.orgs.length ? `<dt>องค์กร</dt><dd>${roleLines}</dd>` : ''}
          ${r.rent ? `<dt>ค่าเช่าที่ประกาศ</dt><dd>${esc(rentText(r.rent))} บาท/ตร.ม./เดือน · ${esc(r.rent.basis)}${r.rent.url ? ` · ${link(r.rent.url, 'หน้าประกาศ')}` : ''}</dd><dt>เดือนที่ประกาศ</dt><dd>${r.rent.on ? esc(thaiDate(r.rent.on)) : 'ไม่ระบุในแหล่ง'}</dd>` : ''}
          ${!r.rent && r.legacyPrice ? `<dt>ราคาที่บันทึก (เดิม)</dt><dd>${esc(rentText(r.legacyPrice))} บาท/ตร.ม. · CityMETER production · ไม่ระบุรอบ</dd>` : ''}
          ${r.floors ? `<dt>จำนวนชั้น</dt><dd>${num(r.floors)} ชั้น · ${esc(r.floorStatus)}</dd>` : ''}
          ${r.space ? `<dt>พื้นที่</dt><dd>${num(r.space.sqm)} ตร.ม. · ${esc(r.space.basis)} · ${esc(r.space.status)}</dd>` : ''}
          ${r.lease ? `<dt>พื้นที่ให้เช่า</dt><dd>${num(r.lease.sqm)} ตร.ม. · ตามเจ้าของ${r.lease.ref ? ` · ${esc(r.lease.ref)}` : ''}${r.lease.url ? ` · ${link(r.lease.url, 'หน้าอ้างอิง')}` : ''}</dd>` : ''}
          ${r.occupancy ? `<dt>อัตราการเช่า</dt><dd>${esc(r.occupancy.rate)} · ${esc(r.occupancy.scope)}${r.occupancy.ref ? ` · ${esc(r.occupancy.ref)}` : ''}${r.occupancy.url ? ` · ${link(r.occupancy.url, 'หน้าอ้างอิง')}` : ''}</dd>` : ''}
          ${r.year ? `<dt>ปีที่สร้าง</dt><dd>${esc(String(r.year))} · ค่าเดิมใน CityMETER production</dd>` : ''}
          <dt>พื้นที่ปกครอง</dt><dd>${esc(ADMIN_TH[r.admin] || '')}</dd>
          <dt>พิกัด</dt><dd>${point}</dd>
          <dt>อาคาร</dt><dd>${esc(MASS_TH[r.mass] || MASS_TH.not_checked)}${r.osmUrl ? ` · ${link(r.osmUrl, 'OpenStreetMap')}` : ''}</dd>
          <dt>รหัส</dt><dd><span class="hint data-number">${esc(r.id)}</span></dd>
        </dl>
        <p class="links">${d.area ? link(productionLink({province: r.province, area: r.area}), 'ดูพื้นที่นี้ใน CityMETER') : ''}</p>
      </details>
    </section>
    ${compsetSection(d.compset)}
    ${provenance(ctx, d.area ? `${w.area}${d.area.name} ${prov}` : prov || 'ไม่ระบุจังหวัด', {rail: Boolean(r.rail || r.railNext), rent: Boolean(r.rent || d.compset?.matches)})}`;
}

/** Terrain chips (js/terrain.js#terrainChips) as fact chips; '' when nothing is known. */
export function terrainChipsHTML(chips) {
  return chips.map(c => `<span class="fact-chip" title="${esc(c.title)}">${pic(c.kind)}${esc(c.text)}</span>`).join('');
}

/* ---------- Active filter chips ---------- */

export function renderFilterChips(values, labels) {
  const chips = [];
  const push = (key, text) => chips.push(`<li><button type="button" class="filter-chip" data-action="clear-filter" data-id="${esc(key)}" aria-label="ล้างตัวกรอง ${esc(text)}"><span>${esc(text)}</span><i aria-hidden="true">×</i></button></li>`);
  if (values.search) push('search', `ค้นหา “${values.search}”`);
  if (values.group) push('group', labels.group[values.group] || values.group);
  if (values.ev) push('ev', labels.ev[values.ev] || values.ev);
  if (values.size) push('size', labels.size[values.size] || values.size);
  if (values.province) push('province', labels.province[values.province] || values.province);
  if (values.org) push('org', values.org === 'none' ? 'ไม่ระบุองค์กร' : labels.org[values.org] || values.org);
  return chips.length ? `<ul class="filter-chips" aria-label="ตัวกรองที่ใช้อยู่">${chips.join('')}<li><button type="button" class="filter-chip clear-all" data-action="clear-filter" data-id="all">ล้างทั้งหมด</button></li></ul>` : '';
}
