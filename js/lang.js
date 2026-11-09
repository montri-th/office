/**
 * Office · page language (citymeter-shell 0.5.0, js/shell/i18n.js). js/app.js imports this module first, so an
 * English page is translated before anything renders. The words are in js/lang-en.js. Names come from the data's own
 * English and are never translated here (demo-platform-review §5.8): provinces and districts from the area index
 * (OpenGISData-Thailand names, DOPA-credited, data/area-index.json metadata.englishNames), stations from their nameEn,
 * office groups from groups[].en, an office's Latin-script alias (aliases). A name without English stays Thai
 * (keepThai: organisations, offices, projects).
 */
import {LANG, registerDictionary, registerNames, keepThai, startTranslation} from './shell/i18n.js';
import {shortOrgName} from './model.js';
import OFFICE_EN from './lang-en.js';

if (LANG === 'en') {
  registerDictionary(OFFICE_EN);
  startTranslation();
  // The English is a draft until reviewed (demo-platform-review §5.8): the help dialog says so.
  const note = () => {
    const intro = document.querySelector('.usage-dialog .help-intro');
    if (!intro || document.getElementById('draft-english-note')) return;
    const p = document.createElement('p');
    p.id = 'draft-english-note';
    p.className = 'help-intro';
    p.textContent = 'English is a draft translation from the Thai. Names with no English in the data stay in Thai, and the product statement is in Thai.';
    intro.after(p);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', note, {once: true}); else note();
}

/** Register the English the data carries. index = js/areas.js buildAreaIndex, raw = data/offices.json. */
export function registerDataNames({index, raw}) {
  if (LANG !== 'en') return;
  const labels = {};
  for (const g of raw?.groups || []) if (g.th && g.en) labels[g.th] = g.en;
  registerDictionary({exact: labels});
  const pairs = [];
  for (const p of index?.provinces || []) if (p.nameEn) pairs.push([p.name, p.nameEn], [`จังหวัด${p.name}`, p.nameEn]);
  const bangkok = (index?.provinces || []).find(p => p.id === 'BKK')?.nameEn;
  if (bangkok) pairs.push(['กรุงเทพฯ', bangkok], ['กรุงเทพ', bangkok]);
  for (const a of index?.areas || []) {
    if (!a.nameEn) continue;
    pairs.push([a.name, a.nameEn], [`${a.province === 'BKK' ? 'เขต' : 'อำเภอ'}${a.name}`, a.nameEn]);
  }
  // Stations: the name alone, with “สถานี”, and with their lines as js/panel.js writes them (“อโศก (สุขุมวิท)”).
  const thaiText = /[\u0E01-\u0E3A\u0E40-\u0E4E]/;
  const lineEn = l => (thaiText.test(l) ? OFFICE_EN.exact[l] || null : l);
  for (const s of raw?.stations || []) {
    if (!s.nameEn) continue;
    pairs.push([s.name, s.nameEn], [`สถานี${s.name}`, `${s.nameEn} station`]);
    const lines = (s.lines || []).map(lineEn);
    if (s.lines?.length && lines.every(Boolean)) {
      const th = `${s.name} (${s.lines.join(' · ')})`, en = `(${lines.join(' · ')})`;
      pairs.push([th, `${s.nameEn} ${en}`], [`สถานี${th}`, `${s.nameEn} station ${en}`]);
    }
  }
  // An office with a Thai name and a Latin-script alias in the data (data/offices.json aliases, by row) reads the alias.
  const c = raw?.cols || {};
  const thai = /[\u0E01-\u0E3A\u0E40-\u0E4E]/;
  for (const [row, list] of Object.entries(raw?.aliases || {})) {
    const name = c.name?.[Number(row)], en = (list || []).find(x => x && !thai.test(x));
    if (name && thai.test(name) && en) pairs.push([name, en]);
  }
  registerNames(pairs);
  // Names with no English in the data stay Thai: organisations, offices and their other names, projects.
  keepThai([...(raw?.orgs || []).flatMap(o => [o.name, shortOrgName(o.name)]), ...(c.name || []), ...(c.alt || []),
    ...(raw?.projects || []), ...Object.values(raw?.aliases || {}).flat()].filter(x => typeof x === 'string'));
}
