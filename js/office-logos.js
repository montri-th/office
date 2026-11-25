/**
 * CityMETER · Office — building logos (0.6.0; owner 2026-11-26 06:14, VERBATIM: “เช็คหน่อยว่า โลโก้ขึ้นหรือยัง ใน
 * web demo ทุกๆ dataset … แก้จุดที่แก้ง่ายก่อน”). data/office-logos.json is written only by
 * scripts/add-office-logos.py from the research team's office logo library: the building's own logo
 * (`venue_specific`), joined by Office ID, every file's bytes checked by SHA-256. A logo sits beside the office's name
 * in its card and in a row; the name stays the identity, so the image is decorative (`alt=""`). The file is
 * optional: without it, or for an office without a logo, nothing is drawn — never an empty box.
 */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const PLATES = new Set(['#FFFFFF', '#182327']);
let registry = null;

/** data/office-logos.json → {logos: Map(key → logo), offices: Map(Office ID → logo)}; null on a bad file. */
export function decodeOfficeLogos(json) {
  if (!json || typeof json.logos !== 'object' || typeof json.offices !== 'object') return null;
  const logos = new Map();
  for (const [key, x] of Object.entries(json.logos)) {
    if (!/^OLG-[0-9a-f]{16}$/.test(key) || !/^assets\/office-logos\/[0-9a-f]{20}\.(svg|png|jpg|webp)$/.test(x?.file || '')) continue;
    if (!x.sha256?.startsWith(key.slice(4)) || !PLATES.has(x.plate) || !(x.width > 0 && x.height > 0)) continue;
    logos.set(key, Object.freeze({key, file: x.file, plate: x.plate, width: x.width, height: x.height, label: x.label || ''}));
  }
  const offices = new Map();
  for (const [id, key] of Object.entries(json.offices)) if (logos.has(key)) offices.set(id, logos.get(key));
  return {logos, offices};
}

/** Installs the decoded registry the views read (null: no logos). */
export function setOfficeLogos(reg) { registry = reg || null; }

/** The logo of an office by its Office ID, or null. */
export const officeLogo = id => registry?.offices.get(id) || null;

/** A logo on its library plate (the same on both themes), never recoloured; '' without a logo. */
export function logoPlate(logo, {height = 32, cls = ''} = {}) {
  if (!logo) return '';
  const width = Math.max(1, Math.round(Math.min(height * 3.5, (logo.width / logo.height) * height)));
  return `<span class="logo-plate${cls ? ` ${cls}` : ''}" style="background:${esc(logo.plate)}"><img src="${esc(logo.file)}" alt="" width="${width}" height="${height}" loading="lazy" decoding="async"></span>`;
}

/** The plate of an office for a card (32 px) or a row (20 px). */
export const officeLogoMarkup = (id, {row = false} = {}) => logoPlate(officeLogo(id), row ? {height: 20, cls: 'row-logo'} : {height: 32, cls: 'head-logo'});
