/**
 * Office labels near the middle of the view and the hover card (the CityMETER · Hotel 0.2.0 contract, owner
 * 2026-11-01: names near the middle of the viewport as the map pans, tilts and zooms; the important ones first; icons
 * instead of long text in map labels).
 *
 * From LABEL_MIN_ZOOM, the focus rows whose point lies in the central ellipse of the visible map (CENTRE_SHARE of its
 * half-width and half-height) compete for a short label: the category cue, the short name (a leading “อาคาร” and the
 * place words dropped — the cue and the map say them) and the asking rent (price pictogram + ฿, left out when there is
 * none — never 0). Ranking: row.importance (js/model.js#importanceScores — floors and asking-rent percentiles), then
 * nearness to the centre. At most LABEL_MAX labels (desktop / phone). Each label is measured and placed above its
 * point, else below it; it never covers the map chrome, another label or the open popup. During a camera move the
 * placed labels follow their points every frame (no re-ranking); the set is ranked again when the move ends. Labels
 * are buttons (Tab, Enter opens the office); on a fine pointer, hover or focus opens a card of icon chips — category,
 * floors, asking rent, organisation. Full sentences live in the accessible names and chip titles only; the provenance
 * line stays in the panel.
 */
import {cueMarkup} from './cues.js';
import {subName} from './model.js';

export const LABEL_MIN_ZOOM = 12.5;
export const LABEL_MAX = Object.freeze({desktop: 9, phone: 5});
export const CENTRE_SHARE = 0.36;
const GAP = 6;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Pure: importance first (floors + asking rent), then nearer the centre, then id (stable). */
export function rankLabelCandidates(cands) {
  return cands.sort((a, b) => (b.row.importance || 0) - (a.row.importance || 0) || a.d - b.d || String(a.row.id).localeCompare(String(b.row.id)));
}

const TYPE_WORDS = /^(อาคารสำนักงาน|อาคาร|ตึก|สำนักงาน)\s*/;
const escapeRe = v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Pure: the short name of a label (short, icons before words). The cue already says the category and the map says the
 * place, so a leading type word (อาคาร …) and a trailing place name (`places`, e.g. the province in Thai and English,
 * กรุงเทพฯ) are dropped. The full name stays in the accessible name and the card. Never shorter than 3 characters.
 */
export function shortName(row, {places = []} = {}) {
  let name = String(row.name || row.alt || '').replace(/^[\s(（[]+|[\s)）\]]+$/g, '');
  const original = name;
  const placeList = places.filter(Boolean).sort((a, b) => b.length - a.length);
  for (let i = 0; i < 2; i++) {
    name = name.replace(TYPE_WORDS, '');
    for (const p of placeList) name = name.replace(new RegExp(`^${escapeRe(p)}[\\s,·\\-–—]+`, 'i'), '');
  }
  for (let i = 0; i < 2; i++) for (const p of placeList) name = name.replace(new RegExp(`[\\s,·\\-–—]*${escapeRe(p)}\\.?$`, 'i'), '');
  name = name.trim();
  return name.length >= 3 ? name : original;
}

/** Pure: what a label says: {name, rent} (rent = the asking rent's starting value, or null). */
export function labelParts(row, {places = []} = {}) {
  return {name: shortName(row, {places}), rent: Number.isFinite(row.rent?.min) && row.rent.min > 0 ? row.rent.min : null};
}

/**
 * Pure: candidates inside the central ellipse. project(lngLat) → {x, y}; box = visible box {left, right, top, bottom}.
 * Returns [{row, x, y, d}] with d = normalised ellipse distance (≤ 1).
 */
export function centreCandidates(rows, project, box, {share = CENTRE_SHARE, skip = ''} = {}) {
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  const rx = Math.max(40, (box.right - box.left) * share), ry = Math.max(40, (box.bottom - box.top) * share);
  const out = [];
  for (const row of rows) {
    if (row.id === skip || !Number.isFinite(row.longitude) || !Number.isFinite(row.latitude)) continue;
    const p = project([row.longitude, row.latitude]);
    const d = ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2;
    if (d <= 1) out.push({row, x: p.x, y: p.y, d});
  }
  return out;
}

/**
 * Pure: place measured labels. cands ranked; size(row) → {w, h}; radius(row) → symbol radius px; returns
 * [{row, x, y, box, below}] (x, y = the label's top-left).
 */
export function placeLabels(cands, size, radius, box, {max = LABEL_MAX.desktop, blockers = []} = {}) {
  const placed = [];
  for (const c of cands) {
    if (placed.length >= max) break;
    const {w, h} = size(c.row), lift = radius(c.row) + GAP + 4;
    for (const below of [false, true]) {
      const x = Math.round(c.x - w / 2), y = Math.round(below ? c.y + lift - 4 : c.y - lift - h);
      const b = {left: x - 3, right: x + w + 3, top: y - 2, bottom: y + h + 2};
      if (b.left < box.left || b.right > box.right || b.top < box.top || b.bottom > box.bottom) continue;
      if (placed.some(p => overlaps(b, p.box)) || blockers.some(k => overlaps(b, k))) continue;
      placed.push({row: c.row, x, y, box: b, below, ax: c.x, ay: c.y});
      break;
    }
  }
  return placed;
}

/**
 * Mount on a MapLibre map and its container. options:
 *  onSelect(row) · bounds() → {left, right, top, bottom, exclusions} (js/pins.js) · radius(row, zoom) → px ·
 *  isPhone() · finePointer() · num(n) · priceText(price) · groupName(row) · onCard(open).
 * Returns {update(rows, {selectedId}), layout, hover(row|null, anchor?), dispose}.
 */
export function installOfficeLabels(map, container, {onSelect, bounds, avoid = () => [], radius = () => 6, isPhone = () => false, finePointer = () => true, num = n => String(n), priceText = () => '', groupName = () => '', placesOf = () => []} = {}) {
  const host = document.createElement('div');
  host.className = 'poi-labels';
  host.setAttribute('aria-label', 'ชื่อสำนักงานกลางแผนที่');
  const card = document.createElement('div');
  card.className = 'poi-card';
  card.hidden = true;
  card.setAttribute('role', 'status');
  container.append(host, card);
  let rows = [], selectedId = '', placed = [], frame = 0, timer = 0, moving = false, cardRow = null, cardAnchor = null;
  const pool = new Map();  // id → {el, w, h}

  function element(row) {
    let e = pool.get(row.id);
    if (e) return e;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'poi-label';
    el.dataset.id = row.id;
    const parts = labelParts(row, {places: placesOf(row)});
    el.setAttribute('aria-label', [row.name, row.floors ? `${num(row.floors)} ชั้น` : '', row.rent ? `ค่าเช่าที่ประกาศ ${priceText(row.rent)} ต่อตารางเมตรต่อเดือน` : ''].filter(Boolean).join(' · '));
    el.innerHTML = `<span class="hl-cue" aria-hidden="true">${cueMarkup(row.series)}</span><span class="hl-text"><span class="hl-name">${esc(parts.name)}</span></span>${parts.rent ? `<span class="hl-fig data-number"><i class="pictogram pic-price" aria-hidden="true"></i>${esc(`฿${num(parts.rent)}`)}</span>` : ''}`;
    el.onclick = () => onSelect?.(row);
    el.onmouseenter = () => { if (finePointer()) showCard(row, el); };
    el.onmouseleave = () => hideCard(row);
    el.onfocus = () => showCard(row, el);
    el.onblur = () => hideCard(row);
    el.hidden = true;
    host.append(el);
    e = {el, w: 0, h: 0};
    pool.set(row.id, e);
    return e;
  }
  const measure = row => { const e = element(row); if (!e.w) { e.el.hidden = false; e.el.style.transform = 'translate(-9999px, -9999px)'; e.w = e.el.offsetWidth; e.h = e.el.offsetHeight; } return {w: e.w, h: e.h}; };

  function layout() {
    frame = 0;
    const zoom = map.getZoom();
    const b = bounds();
    let next = [];
    if (zoom >= LABEL_MIN_ZOOM && rows.length) {
      const cands = rankLabelCandidates(centreCandidates(rows, p => map.project(p), b, {skip: selectedId}));
      const popup = [...container.querySelectorAll('.maplibregl-popup')].map(el => { const r = el.getBoundingClientRect(), c = container.getBoundingClientRect(); return {left: r.left - c.left - 4, right: r.right - c.left + 4, top: r.top - c.top - 4, bottom: r.bottom - c.top + 4}; });
      next = placeLabels(cands.slice(0, 40), measure, row => radius(row, zoom), b, {max: isPhone() ? LABEL_MAX.phone : LABEL_MAX.desktop, blockers: [...(b.exclusions || []), ...popup, ...avoid()]});
    }
    const keep = new Set(next.map(p => p.row.id));
    for (const [id, e] of pool) if (!keep.has(id)) { e.el.hidden = true; e.el.classList.remove('is-on'); }
    for (const p of next) {
      const e = element(p.row);
      e.el.hidden = false;
      e.el.classList.toggle('is-below', p.below);
      e.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      requestAnimationFrame(() => e.el.classList.add('is-on'));
    }
    placed = next.map(p => ({...p, dx: p.x - p.ax, dy: p.y - p.ay}));
    // Bounded pool: drop labels not shown (oldest first) beyond 80.
    if (pool.size > 80) for (const [id, e] of pool) { if (pool.size <= 60) break; if (!keep.has(id)) { e.el.remove(); pool.delete(id); } }
    if (cardRow) placeCard();
  }
  /** Follow the points during a move: same set, same offsets, new anchors. */
  function follow() {
    frame = 0;
    const b = bounds();
    for (const p of placed) {
      const e = pool.get(p.row.id);
      if (!e) continue;
      const a = map.project([p.row.longitude, p.row.latitude]);
      const x = Math.round(a.x + p.dx), y = Math.round(a.y + p.dy);
      const off = x < b.left - 40 || x > b.right + 40 || y < b.top - 30 || y > b.bottom + 30;
      e.el.hidden = off;
      if (!off) e.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (cardRow) placeCard();
  }
  const schedule = () => { if (frame) return; frame = requestAnimationFrame(() => (moving ? follow() : layout())); };
  // A full layout waits one frame more than the district chips (js/map-layers.js), which keep priority: their boxes
  // are read as blockers.
  const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { frame = requestAnimationFrame(layout); }); };
  const onMove = () => { if (!moving) { moving = true; } schedule(); clearTimeout(timer); timer = setTimeout(() => { moving = false; later(); }, 260); };
  const onMoveEnd = () => { clearTimeout(timer); moving = false; later(); };
  map.on('move', onMove);
  map.on('moveend', onMoveEnd);
  map.on('resize', schedule);
  // Label widths are measured once: measure again when a web font finishes loading.
  const onFonts = () => { for (const e of pool.values()) e.w = 0; schedule(); };
  document.fonts?.addEventListener?.('loadingdone', onFonts);

  /* ---------- hover card ---------- */
  function chip(kind, text, title = '') {
    return `<span class="hc-chip"${title ? ` title="${esc(title)}"` : ''}>${kind ? `<i class="pictogram pic-${esc(kind)}" aria-hidden="true"></i>` : ''}${esc(text)}</span>`;
  }
  /** Beside its label or point (right, else left, else below), inside the usable map, never over the label itself. */
  function placeCard() {
    if (!cardRow) return;
    const c = container.getBoundingClientRect();
    let a;
    if (cardAnchor?.isConnected) { const r = cardAnchor.getBoundingClientRect(); a = {left: r.left - c.left, right: r.right - c.left, top: r.top - c.top, bottom: r.bottom - c.top}; }
    else { const p = map.project([cardRow.longitude, cardRow.latitude]); a = {left: p.x - 8, right: p.x + 8, top: p.y - 8, bottom: p.y + 8}; }
    const w = card.offsetWidth || 280, h = card.offsetHeight || 120, b = bounds();
    let x = a.right + 10, y = a.top - 6;
    if (x + w > b.right) x = a.left - w - 10;
    if (x < b.left) { x = Math.min(Math.max(b.left, a.left), b.right - w); y = a.bottom + 8; }
    if (y + h > b.bottom) y = b.bottom - h;
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(b.top, y))}px)`;
  }
  function showCard(row, anchor = null) {
    if (!row) return;
    cardRow = row; cardAnchor = anchor;
    const chips = [
      `<span class="hc-chip">${cueMarkup(row.series)}${esc(groupName(row))}</span>`,
      row.floors ? chip('relief', `${num(row.floors)} ชั้น`, 'จำนวนชั้นของอาคาร') : '',
      row.rent ? chip('price', `${priceText(row.rent)} /ตร.ม./เดือน`, 'ค่าเช่าเริ่มต้นที่ประกาศ') : '',
      row.orgs?.[0] ? chip('chain', row.orgs[0].org.short, row.orgs[0].roles.map(x => x.th).join(' · ')) : '',
    ].filter(Boolean).join('');
    card.innerHTML = `<div class="hc-head"><div><strong>${esc(row.name)}</strong>${subName(row) ? `<span class="hc-sub">${esc(subName(row))}</span>` : ''}</div></div>
      <div class="hc-chips">${chips}</div>`;
    card.hidden = false;
    placeCard();
  }
  function hideCard(row = null) {
    if (row && cardRow && row.id !== cardRow.id) return;
    cardRow = null; cardAnchor = null; card.hidden = true;
  }

  return {
    update(list, {selectedId: sel = ''} = {}) { rows = list || []; selectedId = sel; later(); },
    layout: later,
    /** Hover from a pin or a map symbol (fine pointer only); null hides the card. */
    hover(row, anchor = null) { if (!row) hideCard(); else if (finePointer() && (!cardRow || cardRow.id !== row.id)) showCard(row, anchor); },
    placedIds: () => placed.map(p => p.row.id),
    /** Rebuild every label (after the fonts arrive). */
    refresh() { for (const e of pool.values()) e.el.remove(); pool.clear(); placed = []; later(); },
    dispose() { cancelAnimationFrame(frame); clearTimeout(timer); map.off('move', onMove); map.off('moveend', onMoveEnd); map.off('resize', schedule); document.fonts?.removeEventListener?.('loadingdone', onFonts); host.remove(); card.remove(); pool.clear(); },
  };
}
