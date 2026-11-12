/**
 * What the search box of CityMETER · Office knows by name: the entries js/shell/fuzzy.js matches and js/shell/search.js
 * lists (release 0.6.0; owner 2026-11-12 12:05, VERBATIM: “ศึกษาแนวคิดเรื่อง Fuzzy search แล้ว implement กับ demo web
 * ให้ได้ user benefit สูงสุดตาม user intent ในขณะนั้น และตาม product statement”).
 *
 * The product statement asks where offices cluster, what rent is announced and how near the rail is. So a name typed
 * here opens the level that answers it: a province or a เขต/อำเภอ (its offices and announced rents), a rail station
 * (the offices round it), an organisation or an office type (where it is), or one office (its profile). The order
 * below is the order among equal matches: places first, as the statement reads an area before a building.
 *
 * Pure: entries from the decoded dataset; no DOM, no numbers shown (a row names what it is and where).
 */
import {areaWord} from './areas.js';
import {provinces} from './model.js';
import {PROVINCE_AKA, withoutMueang} from './shell/fuzzy.js';

export const SEARCH_KINDS = Object.freeze([
  {id: 'province', level: 'province', auto: true}, {id: 'area', level: 'district', auto: true}, {id: 'station', level: 'station', auto: true},
  {id: 'org', auto: true}, {id: 'group', auto: true}, {id: 'office'},
]);
/** Words an office's name may begin with, or carry, that people add or leave out; an array is one word said two ways. */
export const SEARCH_HEADS = Object.freeze(['อาคารสำนักงาน', ['อาคาร', 'ตึก'], 'เดอะ', 'the', 'tower', 'building', 'office']);
/** What to try when nothing is found: the kinds of name this demo knows. */
export const SEARCH_HINT = 'ลองชื่ออาคาร องค์กร สถานี เขต/อำเภอ หรือจังหวัด';

/** Every entry, the few places and filters first, then the offices. */
export function* searchEntries({data, index}) {
  const byCode = new Map(provinces().map(p => [p.code, p]));
  for (const p of provinces()) yield {id: p.code, kind: 'province', name: p.th, nameEn: p.en, aka: PROVINCE_AKA[p.th], codes: [p.code, p.dopa], province: p.code};
  const places = new Map();
  for (const a of index.byId.values()) {
    const p = byCode.get(a.province);
    places.set(a.id, [a.name, a.nameEn, p?.th, p?.en]);
    yield {id: a.id, kind: 'area', name: a.name, nameEn: a.nameEn, also: withoutMueang(a.name), codes: [a.id], within: [p?.th, p?.en], province: a.province, area: a.id};
  }
  for (const s of data.stations) yield {id: s.id, kind: 'station', name: s.name, nameEn: s.nameEn, station: s};
  // An organisation is listed when an office of the data names it (the filter offers no other).
  const named = new Set();
  for (const r of data.rows) for (const o of r.orgs) named.add(o.org.id);
  for (const o of data.orgs) if (named.has(o.id)) yield {id: o.id, kind: 'org', name: o.short, aka: o.name !== o.short ? [o.name] : undefined};
  for (const g of data.groups) yield {id: g.id, kind: 'group', name: g.th, nameEn: g.en};
  const provinceOnly = new Map();
  for (const r of data.rows) {
    let within = r.area ? places.get(r.area) : provinceOnly.get(r.province);
    if (!within) { const p = byCode.get(r.province); within = [p?.th, p?.en]; provinceOnly.set(r.province, within); }
    yield {id: r.id, kind: 'office', name: r.name, aka: [r.alt, ...r.aliases, r.project], within, province: r.province, area: r.area, weight: r.importance || 0, row: r};
  }
}

/** The line under a name in the list: what it is and where. Thai; an English page translates it part by part. */
export function searchNote(entry, {index, data}) {
  const province = code => provinces().find(p => p.code === code)?.th || '';
  if (entry.kind === 'province') return 'จังหวัด';
  if (entry.kind === 'area') return [areaWord(entry.province), province(entry.province)].filter(Boolean).join(' · ');
  // A station reads as the head of its own panel does: the word, its lines, “กำลังสร้าง” while it is being built.
  if (entry.kind === 'station') return ['สถานีรถไฟฟ้า', ...(entry.station.lines || []), entry.station.status === 'construction' ? 'กำลังสร้าง' : ''].filter(Boolean).join(' · ');
  if (entry.kind === 'org') return 'องค์กร';
  if (entry.kind === 'group') return 'รูปแบบสำนักงาน';
  const r = entry.row, a = r.area ? index.byId.get(r.area) : null;
  return [data.groups[r.group]?.th, a?.name, province(r.province)].filter(Boolean).join(' · ');
}
