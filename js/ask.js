/**
 * Contextual outbound actions: the next question a reader has at each view, answered outside the demo.
 *
 *  - ถาม Google AI — Google Search with a question written for the view: an office (who is in it now, space for rent
 *    and rents now, getting there), a district or a station (office buildings, rents, what is near), an organisation
 *    (its offices and portfolio), a building, or the country/province overview (office supply and rents news). Google
 *    answers at the top of the results (AI Overview) and its AI Mode tab carries the question on. Never a link straight
 *    into AI Mode (`udm=50`): Google stops one that comes from another site at “Continue with this search?” (Hotel
 *    0.3.3, measured 2026-11-02);
 *  - Street View — only where the view has a point (an office's selected point, or a station's reference point, which
 *    is not an entrance: the label says "ใกล้");
 *  - Google Maps — a search by office name + district + province (or "อาคารสำนักงาน" + place).
 *
 * Pure: builds labels and https URLs from public names only (no user data, no internal ids). The Google names on the
 * buttons say where the answers come from (owner rule: no caveat lines). Nothing from Google's answers enters the data.
 * An English page (citymeter-shell 0.5.0) asks in English, with the English names the data gives (js/lang.js); the
 * button labels are translated by js/shell/i18n.js like the rest of the page.
 */
import {LANG, englishName} from './shell/i18n.js';

const enc = encodeURIComponent;
export const googleAskURL = q => `https://www.google.com/search?q=${enc(q)}`;
export const mapsSearchURL = q => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
export const streetViewURL = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon)
  ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}` : '');

const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const join = (...parts) => clean(parts.filter(Boolean).join(' '));
/**
 * ctx: {kind: 'office'|'building'|'area'|'station'|'org'|'overview', row?, area?: {place, province}, station?, org?,
 *       province?, point?: {lat, lon, role}, rows?}
 * → [{id, label, href, note}] in display order (only the actions that apply).
 */
export function contextActions(ctx = {}, lang = LANG) {
  if (lang === 'en') return contextActionsEnglish(ctx);
  const out = [], place = ctx.area ? join(ctx.area.place, ctx.area.province) : '';
  const add = (id, label, href, note = '') => { if (href) out.push({id, label, href, note}); };
  if (ctx.kind === 'office' && ctx.row) {
    const r = ctx.row, name = clean(r.name);
    add('ai', 'ถาม Google AI', googleAskURL(`${join(name, place ? `(${place})` : '')} ตอนนี้มีพื้นที่สำนักงานให้เช่าไหม ค่าเช่าต่อตารางเมตรช่วงนี้เท่าไร มีบริษัทอะไรอยู่บ้าง และเดินทางจากรถไฟฟ้าอย่างไร`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, ctx.area?.place, ctx.area?.province)));
  } else if (ctx.kind === 'building') {
    const names = [...new Set((ctx.rows || []).map(r => clean(r.name)).filter(Boolean))].slice(0, 2);
    add('ai', 'ถาม Google AI', googleAskURL(`${join(names.join(' และ '), place)} อยู่อาคารเดียวกันไหม และในอาคารนี้มีสำนักงานหรือบริษัทอะไรอีกบ้าง`));
  } else if (ctx.kind === 'area' && ctx.area) {
    add('ai', 'ถาม Google AI', googleAskURL(`อาคารสำนักงานให้เช่าใน${clean(ctx.area.place)} ${clean(ctx.area.province)} มีที่ไหนบ้าง ค่าเช่าต่อตารางเมตรช่วงนี้ประมาณเท่าไร และใกล้รถไฟฟ้าสายไหน`));
    add('maps', 'Google Maps', mapsSearchURL(`อาคารสำนักงาน ${join(ctx.area.place, ctx.area.province)}`));
  } else if (ctx.kind === 'station' && ctx.station) {
    const s = ctx.station, line = (s.lines || []).join(' ');
    add('ai', 'ถาม Google AI', googleAskURL(`อาคารสำนักงานใกล้สถานี${clean(s.name)}${line ? ` (${clean(line)})` : ''} มีที่ไหนบ้าง เดินไปกี่นาที และค่าเช่าต่อตารางเมตรช่วงนี้เท่าไร`));
    add('maps', 'Google Maps', mapsSearchURL(`อาคารสำนักงานใกล้สถานี${clean(s.name)}`));
  } else if (ctx.kind === 'org' && ctx.org) {
    add('ai', 'ถาม Google AI', googleAskURL(`${clean(ctx.org.name)} มีสำนักงานหรืออาคารสำนักงานในประเทศไทยที่ไหนบ้าง และมีประกาศพื้นที่ให้เช่าหรือเปิดสาขาใหม่ไหม`));
  } else if (ctx.kind === 'overview') {
    const where = clean(ctx.province) || 'ประเทศไทย';
    add('ai', 'ถาม Google AI', googleAskURL(`ภาพรวมตลาดอาคารสำนักงานให้เช่าใน${where}ล่าสุด ค่าเช่าเฉลี่ยต่อตารางเมตรและอัตราการเช่าเป็นอย่างไร และมีอาคารใหม่ที่ไหนบ้าง`));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
    add('streetview', p.role === 'station' ? 'Street View ใกล้สถานี' : 'Street View', streetViewURL(p.lat, p.lon));
  }
  return out;
}

/** The same actions for an English page: English questions, English names where the data has them. */
function contextActionsEnglish(ctx = {}) {
  const out = [], N = s => englishName(clean(s));
  const add = (id, label, href) => { if (href) out.push({id, label, href, note: ''}); };
  const where = ctx.area ? [N(ctx.area.place), N(ctx.area.province)].filter(Boolean).join(', ') : '';
  if (ctx.kind === 'office' && ctx.row) {
    const name = N(ctx.row.name);
    add('ai', 'ถาม Google AI', googleAskURL(`${name}${where ? ` (${where})` : ''}: is office space for rent now, what is the rent per square metre, which companies are in it, and how do I get there from rail transit?`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, N(ctx.area?.place), N(ctx.area?.province))));
  } else if (ctx.kind === 'building') {
    const names = [...new Set((ctx.rows || []).map(r => N(r.name)).filter(Boolean))].slice(0, 2);
    add('ai', 'ถาม Google AI', googleAskURL(`Are ${names.join(' and ')}${where ? ` (${where})` : ''} in the same building, and which other offices or companies are in it?`));
  } else if (ctx.kind === 'area' && ctx.area) {
    add('ai', 'ถาม Google AI', googleAskURL(`Office buildings for rent in ${where}: where are they, what is the rent per square metre now, and which rail lines are near?`));
    add('maps', 'Google Maps', mapsSearchURL(`office building ${where}`));
  } else if (ctx.kind === 'station' && ctx.station) {
    const s = ctx.station, station = N(s.name);
    add('ai', 'ถาม Google AI', googleAskURL(`Office buildings near ${station} station: where are they, how many minutes' walk, and what is the rent per square metre now?`));
    add('maps', 'Google Maps', mapsSearchURL(`office building near ${station} station`));
  } else if (ctx.kind === 'org' && ctx.org) {
    add('ai', 'ถาม Google AI', googleAskURL(`Where in Thailand does ${clean(ctx.org.name)} have offices or office buildings, and is it advertising space for rent or opening new branches?`));
  } else if (ctx.kind === 'overview') {
    const place = N(ctx.province) || 'Thailand';
    add('ai', 'ถาม Google AI', googleAskURL(`Latest overview of the office rental market in ${place}: average rent per square metre, occupancy, and where the new buildings are`));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) add('streetview', p.role === 'station' ? 'Street View ใกล้สถานี' : 'Street View', streetViewURL(p.lat, p.lon));
  return out;
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/** The action bar (icon + short label). '' when nothing applies. */
export function actionBar(ctx) {
  const list = contextActions(ctx);
  if (!list.length) return '';
  return `<div class="ask-bar" role="group" aria-label="ค้นต่อใน Google">${list.map(a => `<a class="ask-link ask-${esc(a.id)}" href="${esc(a.href)}" target="_blank" rel="noopener noreferrer"${a.note ? ` title="${esc(a.note)}"` : ''}><i class="pictogram pic-${a.id === 'ai' ? 'ai' : a.id === 'streetview' ? 'streetview' : 'maps'}" aria-hidden="true"></i><span>${esc(a.label)}</span></a>`).join('')}</div>`;
}
