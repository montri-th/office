/**
 * This demo's navigation on the shared header code: the titles of its controls and its pictogram subset. The
 * nav-7 glyphs and the help dialog are js/shell/navigation.js, the dataset picker js/shell/header.js
 * (citymeter-shell: edit those in every repository at once, js/shell/manifest.json).
 */
import {installNavigation, NAV_GLYPHS, NAV_ICON_CONTRACT} from './shell/navigation.js';
import {installHeader} from './shell/header.js';

export {NAV_GLYPHS, NAV_ICON_CONTRACT};

/**
 * Metric-tile pictograms (test exception approved by the owner 2026-10-22 for the
 * Luxury Brands demo; this demo builds its own subset from the same source font with
 * scripts/build-pictogram-font.py; to be registered in LDS if it proves itself). Same family and axes as nav-7, a separate subset so the
 * approved nav-7 bytes stay unchanged. The subset is the CityMETER · Hotel 0.3.6 file, unchanged (same bytes and
 * SHA-256). Glyph → meaning in Office:
 * building (apartment) = สำนักงาน (records, แห่ง) and อาคาร · area (map) = เขต/อำเภอ · province (location_city) =
 * จังหวัด · segment (category) = รูปแบบสำนักงาน · chain (account_tree) = องค์กร · rail (train) = สถานีราง ·
 * price (payments) = ค่าเช่าที่ประกาศ · relief (height) = จำนวนชั้น/ความสูงอาคาร · meeting (groups) = อัตราการเช่า ·
 * compare (compare_arrows) = ค่าเช่ารอบ ๆ · rank, date, distance, construction, dataset as in Hotel; hotel, rooms, venue,
 * sea, elevation, forest stay in the file but are not used (owner 2026-11-01: icons instead of long text on the map).
 */
export const PICTOGRAM_CONTRACT = Object.freeze({
  family: 'LDS Material Symbols Rounded Pictogram',
  file: 'assets/icons/material-pictogram-300.woff2', bytes: 3540,
  sha256: '0e68b6b0207bf62a5c592dba7dfb5149dceb951e5548c931289192cb1244f52b',
  manifest: 'assets/icons/material-pictogram-300.json',
  axes: Object.freeze({FILL: 0, wght: 300, GRAD: 0, opsz: 24}),
  glyphs: Object.freeze({area: '\uE55B', province: '\uE7F1', segment: '\uE72C', venue: '\uE54C', ai: '\uE65F', streetview: '\uE56E', maps: '\uE0C8', building: '\uEA40',
    hotel: '\uE53A', rooms: '\uEFDF', rail: '\uE570', meeting: '\uF233', price: '\uEF63', chain: '\uE97A', compare: '\uE915',
    sea: '\uE176', elevation: '\uE564', relief: '\uEA16', forest: '\uEA99',
    rank: '\uF20C', date: '\uE878', distance: '\uE41C', construction: '\uEA3C', dataset: '\uF20E'}),
  status: 'test exception to LDS nav-7 (owner 2026-10-22; action and building glyphs 2026-10-29; hotel glyphs 2026-11-01; terrain glyphs 2026-11-01; rank, date, distance, construction and dataset glyphs 2026-11-01 for short copy)',
  fallback: 'Text labels carry the meaning; pictograms stay hidden until the font has loaded.',
});
const TITLES = {
  'fit-map': 'ปรับแผนที่ให้เห็นพื้นที่ที่โฟกัสหรือพื้นที่ที่เลือก',
  'country-map': 'ดูทั้งประเทศรายจังหวัด',
  'toggle-3d': 'สลับ 3 มิติ / 2 มิติ',
  'toggle-neighborhoods': 'แสดงหรือซ่อนสีและขอบเขตเขต/อำเภอ',
  'mobile-panel': 'เปิดแผงข้อมูลและตัวกรอง',
  'open-help': 'เปิดวิธีใช้',
  'open-help-sheet': 'เปิดวิธีใช้',
  'toggle-insights': 'เปิดหรือย่อกราฟเปรียบเทียบพื้นที่',
  'open-table': 'เปิดตารางสำนักงานตามตัวกรอง',
  'toggle-table': 'ปิดตารางและกลับไปแผนที่',
  'search': 'ค้นหาชื่อสำนักงาน อาคาร องค์กร เขต/อำเภอ หรือจังหวัด',
  'group': 'กรองตามรูปแบบสำนักงาน',
  'ev': 'กรองตามที่มาของรายการ',
  'size': 'กรองตามความสูงอาคาร (จำนวนชั้น)',
  'province': 'กรองตามจังหวัด',
  'org': 'กรองตามองค์กร',
  'prev-page': 'ดูหน้าก่อนหน้าของตาราง',
  'next-page': 'ดูหน้าถัดไปของตาราง',
  'tab-areas': 'เปรียบเทียบสำนักงานหรือค่าเช่าที่ประกาศของแต่ละเขต/อำเภอ',
  'tab-mix': 'ดูรูปแบบสำนักงานในแต่ละเขต/อำเภอ',
  'tab-orgs': 'เปรียบเทียบจำนวนสำนักงานของแต่ละองค์กร',
};

if (typeof document !== 'undefined') {
  installNavigation({titles: TITLES, pictogramProbe: PICTOGRAM_CONTRACT.glyphs.building});
  installHeader();
}
