import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeOfficeLogos, setOfficeLogos, officeLogo, officeLogoMarkup} from '../js/office-logos.js';

// Building logos (0.6.0): data/office-logos.json and assets/office-logos/ are written only by
// scripts/add-office-logos.py from the research team's office logo library (DATA_METHOD.md, “โลโก้อาคาร”).
const root = new URL('../', import.meta.url);
const json = JSON.parse(readFileSync(new URL('data/office-logos.json', root), 'utf8'));
const keys = new Set(JSON.parse(readFileSync(new URL('data/offices.json', root), 'utf8')).cols.key);
const sha256 = buf => createHash('sha256').update(buf).digest('hex');

test('every logo file is in the registry with its bytes, and nothing else is in the folder', () => {
  const files = readdirSync(new URL('assets/office-logos/', root)).sort();
  assert.deepEqual(files, Object.values(json.logos).map(x => x.file.split('/').pop()).sort());
  for (const [key, x] of Object.entries(json.logos)) {
    const bytes = readFileSync(new URL(x.file, root));
    assert.equal(sha256(bytes), x.sha256, key);
    assert.equal(bytes.length, x.bytes, key);
    assert.ok(x.mime === 'image/svg+xml' || Math.max(x.width, x.height) <= 512, `${key}: display-sized`);
    assert.ok(x.bytes <= 64 * 1024, `${key}: ≤ 64 KB`);
    assert.ok(x.transformation === 'none' ? x.original === null : x.original?.sha256?.length === 64, `${key}: a derived file keeps the original's SHA-256`);
    assert.ok(x.sourcePage === '' || (/^https:\/\//.test(x.sourcePage) && !/google|drive|localhost/i.test(x.sourcePage)), key);
  }
  assert.equal(json.meta.manifestSha256.length, 64);
  assert.ok(!JSON.stringify(json).includes('spreadsheet'), 'no sheet id or row link');
});

test('joined by Office ID: every linked office is in the data, one logo each', () => {
  const ids = Object.keys(json.offices);
  assert.equal(ids.length, json.meta.counts.used);
  assert.ok(ids.every(id => keys.has(id)), 'an Office ID of data/offices.json');
  assert.ok(Object.values(json.offices).every(k => json.logos[k]));
  assert.equal(json.meta.counts.collected + json.meta.counts.notFound, json.meta.counts.mappings, 'collected + not found = targeted');
});

test('the loader refuses a record outside the folder, a key that is not its hash or an unknown plate', () => {
  const reg = decodeOfficeLogos(json);
  assert.equal(reg.logos.size, Object.keys(json.logos).length, 'every record passes');
  const [k] = Object.keys(json.logos);
  const bad = structuredClone(json);
  bad.logos[k].file = 'https://example.com/x.png';
  assert.equal(decodeOfficeLogos(bad).logos.has(k), false);
  const plate = structuredClone(json);
  plate.logos[k].plate = '#FF0000';
  assert.equal(decodeOfficeLogos(plate).logos.has(k), false);
  assert.equal(decodeOfficeLogos(null), null);
});

test('views: a card and a row carry the plate of the office, decorative; nothing without the file or the logo', () => {
  const [id] = Object.keys(json.offices);
  setOfficeLogos(null);
  assert.equal(officeLogoMarkup(id), '');
  setOfficeLogos(decodeOfficeLogos(json));
  assert.match(officeLogoMarkup(id), /^<span class="logo-plate head-logo" style="background:#(FFFFFF|182327)"><img src="assets\/office-logos\/[0-9a-f]{20}\.\w+" alt="" width="\d+" height="32"/);
  assert.match(officeLogoMarkup(id, {row: true}), /class="logo-plate row-logo"[^>]*><img [^>]*height="20"/);
  const without = [...keys].find(k => !json.offices[k]);
  assert.equal(officeLogo(without), null);
  assert.equal(officeLogoMarkup(without), '', 'no empty box');
  const panel = readFileSync(new URL('js/panel.js', root), 'utf8');
  assert.equal((panel.match(/officeLogoMarkup\(r\.id, \{row: true\}\)/g) || []).length, 3, 'every office row (list, rents, comparison set)');
  assert.match(panel, /<\/div>\$\{officeLogoMarkup\(r\.id\)\}<\/div>/, 'the card head');
  setOfficeLogos(null);
});
