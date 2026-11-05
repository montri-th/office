/**
 * Comparison charts rendered as plain HTML — no chart vendor.
 *
 * Three views share the committed selection (scopeRows) and the map's membership:
 *  - areas (URL view key `areas`): offices per เขต/อำเภอ, or the median dated asking rent of the districts that carry
 *    one (n beside it), bars in the map's colour (the same 41-sample rank ramp over the same districts,
 *    js/scales.js#buildMetricRamp)
 *  - mix: district × office category, a numeric table of offices with equal cells (its own 41-sample count ramp)
 *  - orgs: offices per organisation as the sheet's roles link them, one neutral bar colour (an organisation is not a
 *    category of the map)
 * District marks emit {type:'area', id}; organisation marks emit {type:'org', id}.
 */
import {buildChartModel, areaMatrix, orgRanking} from './chart-model.js';
import {buildMetricRamp, classify, rampLegendHTML} from './scales.js';
import {cueMarkup} from './cues.js';
import {areaWord} from './areas.js';
import {provinceByCode, RENT_MIN_N} from './model.js';

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = n => NUMBER.format(n);
const place = a => `${areaWord(a.province)}${a.name}`;
const where = (a, national) => (national ? provinceByCode(a.province)?.th || '' : '');

function empty(element, message) {
  element.innerHTML = `<div class="chart-empty"><p>${esc(message)}</p></div>`;
}

function areas(element, model, select, selectedId, unit, national) {
  // Every district of the reading, not only the 20 drawn: the same ramp as the map's district layer.
  const ramp = buildMetricRamp(model.values, {metric: model.metric, unit: unit.one});
  const rent = model.metric === 'rent';
  const max = Math.max(1, ...model.areas.map(a => a.value));
  const other = a => (rent ? `${num(a.rentN)} ราคา · ${num(a.count)} แห่ง` : a.rentN >= RENT_MIN_N ? `ค่าเช่ากลาง ฿${num(a.rentMedian)}` : '');
  const shown = a => (rent ? `฿${num(a.value)}` : num(a.value));
  const rows = model.areas.map((a, i) => {
    const cls = classify(a.value, ramp);
    const pressed = a.id === selectedId;
    return `<li><button type="button" class="bar-row${pressed ? ' is-selected' : ''}" data-area="${esc(a.id)}" aria-pressed="${pressed}"
      aria-label="อันดับ ${i + 1} ${esc(place(a))} ${esc(where(a, national))}: ${esc(shown(a))} ${esc(unit.one)} ${esc(other(a))} กดเพื่อดูพื้นที่นี้">
      <span class="bar-rank data-number" aria-hidden="true">${i + 1}</span>
      <span class="bar-label">${esc(place(a))}<small>${esc([where(a, national), other(a)].filter(Boolean).join(' · '))}</small></span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${Math.max(2, Math.round((a.value / max) * 100))}%;background:${cls.fill}"></span></span>
      <span class="bar-value" aria-hidden="true"><b class="data-number">${esc(shown(a))}</b><small>${esc(rent ? '/ตร.ม./เดือน' : unit.one)}</small></span>
    </button></li>`;
  }).join('');
  const w = national ? 'เขต/อำเภอ' : areaWord(model.areas[0]?.province);
  const caption = rent
    ? `ค่ากลางค่าเช่าที่ประกาศต่อ${w} · ${num(model.areas.length)} จาก ${num(model.totalAreas)} ${w} ที่มีราคาอย่างน้อย ${num(RENT_MIN_N)} รายการ · สีเดียวกับแผนที่`
    : `${unit.subject}ต่อ${w} · ${num(model.areas.length)} จาก ${num(model.totalAreas)} ${w} · สีเดียวกับแผนที่`;
  element.innerHTML = `<p class="chart-caption">${esc(caption)}</p><ol class="chart-bars">${rows}</ol>`;
  element.querySelectorAll('[data-area]').forEach(b => b.addEventListener('click', () => select({type: 'area', id: b.dataset.area})));
}

function matrix(element, rows, index, groups, select, selectedId) {
  const m = areaMatrix(rows, index, groups, {areaLimit: 12});
  if (!m.areas.length) { empty(element, 'ไม่มีเขต/อำเภอในตัวกรองนี้'); return; }
  const ramp = buildMetricRamp(m.cells.map(c => c.value), {metric: 'count', unit: 'แห่ง'});
  const head = m.groups.map(g => `<th scope="col" title="${esc(g.th)}"><span class="matrix-col">${cueMarkup(g.series)}<span>${esc(g.short || g.th)}</span></span></th>`).join('');
  const body = m.areas.map(a => {
    const pressed = a.id === selectedId;
    const cells = m.groups.map(g => {
      const cell = m.cells.find(c => c.areaId === a.id && c.group === g.index);
      const cls = classify(cell.value, ramp);
      // measured_zero: sample 0 + the theme's dataState.zero outline (EVID-05 treatment), never a blank cell.
      const style = cls.state === 'measured_zero' ? `background:${cls.fill};color:${cls.ink};box-shadow:inset 0 0 0 2px var(--data-zero-outline)` : `background:${cls.fill};color:${cls.ink}`;
      return `<td><button type="button" class="matrix-cell is-${cls.state}" data-area="${esc(a.id)}" style="${style}"
        aria-label="${esc(place(a))} × ${esc(g.th)}: ${num(cell.value)} แห่ง กดเพื่อดูพื้นที่นี้" title="${esc(place(a))} × ${esc(g.th)} — ${num(cell.value)} จาก ${num(cell.total)} แห่ง"><span class="data-number${cls.plate ? ' on-plate' : ''}">${num(cell.value)}</span></button></td>`;
    }).join('');
    return `<tr${pressed ? ' class="is-selected"' : ''}><th scope="row"><button type="button" class="matrix-row" data-area="${esc(a.id)}" aria-pressed="${pressed}">${esc(a.name)}<small class="data-number">${num(a.value)}</small></button></th>${cells}</tr>`;
  }).join('');
  const columns = `<colgroup><col class="matrix-head-col">${m.groups.map(() => '<col class="matrix-cell-col">').join('')}</colgroup>`;
  element.innerHTML = `<p class="chart-caption">${num(m.areas.length)} เขต/อำเภอที่มีสำนักงานมากที่สุด × ${num(m.groups.length)} รูปแบบ · ตัวเลข = แห่ง</p>
    <div class="matrix-scroll"><table class="matrix" style="--matrix-columns:${m.groups.length}">${columns}<thead><tr><th scope="col" class="matrix-corner">พื้นที่ · แห่ง</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <p class="chart-legend"><span class="legend-title">แห่งในช่อง · สีเข้ม = มาก</span>${rampLegendHTML(ramp)}<span class="legend-step"><i class="legend-zero" aria-hidden="true"></i>0 = ไม่พบในตัวกรองนี้</span></p>`;
  element.querySelectorAll('[data-area]').forEach(b => b.addEventListener('click', () => select({type: 'area', id: b.dataset.area})));
}

function orgs(element, rows, select, selectedOrg) {
  const r = orgRanking(rows, {limit: 20});
  if (!r.orgs.length) { empty(element, 'ไม่มีองค์กรในตัวกรองนี้'); return; }
  const max = Math.max(1, ...r.orgs.map(o => o.value));
  const list = r.orgs.map((o, i) => {
    const pressed = o.org.id === selectedOrg;
    const sub = o.roles.slice(0, 2).join(' · ');
    return `<li><button type="button" class="bar-row${pressed ? ' is-selected' : ''}" data-org="${esc(o.org.id)}" aria-pressed="${pressed}"
      aria-label="อันดับ ${i + 1} ${esc(o.org.name)}: ${num(o.value)} แห่ง ${esc(sub)} กดเพื่อดูเฉพาะองค์กรนี้">
      <span class="bar-rank data-number" aria-hidden="true">${i + 1}</span>
      <span class="bar-label">${esc(o.org.short)}<small>${esc(sub)}</small></span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill chain-fill" style="width:${Math.max(2, Math.round((o.value / max) * 100))}%"></span></span>
      <span class="bar-value" aria-hidden="true"><b class="data-number">${num(o.value)}</b><small>แห่ง</small></span></button></li>`;
  }).join('');
  element.innerHTML = `<p class="chart-caption">สำนักงานต่อองค์กร · ${num(r.orgs.length)} จาก ${num(r.total)} องค์กร</p><ol class="chart-bars">${list}</ol>`;
  element.querySelectorAll('[data-org]').forEach(b => b.addEventListener('click', () => select({type: 'org', id: b.dataset.org})));
}

/** Render one view into #elementId. Returns an idempotent disposer. */
export function renderInsightChart({elementId, view = 'areas', rows = [], index, groups, theme, selectedAreaId = '', selectedOrg = '', unit, national = true} = {}, onSelect = () => {}) {
  const element = document.getElementById(elementId);
  if (!element) return () => {};
  const select = typeof onSelect === 'function' ? onSelect : () => {};
  element.replaceChildren();
  if (theme) element.dataset.chartTheme = theme;
  const labels = {areas: `เขต/อำเภอเรียงตาม${unit.subject}`, mix: 'รูปแบบสำนักงานในแต่ละเขต/อำเภอ', orgs: 'องค์กรเรียงตามจำนวนสำนักงาน'};
  element.setAttribute('aria-label', labels[view] || labels.areas);
  if (!Array.isArray(rows) || !rows.length) { empty(element, 'ไม่พบสำนักงานตามตัวกรอง'); return () => element.replaceChildren(); }
  try {
    if (view === 'orgs') orgs(element, rows, select, selectedOrg);
    else if (view === 'mix') matrix(element, rows, index, groups, select, selectedAreaId);
    else {
      const model = buildChartModel(rows, index, groups, {metric: unit.id});
      if (!model.areas.length) { empty(element, unit.id === 'rent' ? `ยังไม่มีเขต/อำเภอที่มีราคาประกาศอย่างน้อย ${RENT_MIN_N} รายการในตัวกรองนี้` : 'ไม่มีเขต/อำเภอในตัวกรองนี้'); return () => element.replaceChildren(); }
      areas(element, model, select, selectedAreaId, unit, national);
    }
  } catch (error) {
    console.error('CityMETER chart could not render:', error);
    empty(element, 'แสดงกราฟไม่ได้ · ดูในตารางแทน');
  }
  return () => element.replaceChildren();
}
