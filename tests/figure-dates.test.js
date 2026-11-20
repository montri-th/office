import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {load} from './helpers.js';
import {whenText} from '../js/panel.js';
import {registerDictionary, translate} from '../js/shell/i18n.js';
import OFFICE_EN from '../js/lang-en.js';

// Published figures (leasable area, occupancy) say the date they refer to and the day the page was checked, worded from
// a token (scripts/build-data.py#ref_when → js/panel.js#whenText), instead of the sheet's reference text cut at 60
// characters, which showed “checked 2026-11-2” (owner 2026-11-20: “ปรับ demo office ให้เรียบร้อยด้วย”).
const TOKEN = /^(|d:\d{4}-\d{2}-\d{2}|m:\d{4}-\d{2}|r:\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}|q:\d{4}-[1-4]|fy:\d{4}|p:\d{4}(-\d{2}-\d{2})?)$/;
const DAY = /^(|\d{4}-\d{2}-\d{2})$/;

test('the shipped figures carry a date token, a check day and the scope in the source’s words, never a cut reference', () => {
  const {raw, data} = load();
  for (const [k, e] of Object.entries(raw.lease)) {
    assert.equal(e.length, 6, `lease ${k}: sqm, when, checked, url, by, scope`);
    assert.ok(TOKEN.test(e[1]) && DAY.test(e[2]), `lease ${k}: ${e[1]} ${e[2]}`);
    assert.ok(!/_/.test(e[5]), `lease ${k}: scope reads as words`);
  }
  for (const [k, e] of Object.entries(raw.occupancy)) {
    assert.equal(e.length, 5, `occupancy ${k}: rate, when, checked, scope, url`);
    assert.ok(TOKEN.test(e[1]) && DAY.test(e[2]), `occupancy ${k}: ${e[1]} ${e[2]}`);
  }
  const kinds = ['d', 'm', 'r', 'q', 'fy', 'p'];
  for (const [what, list] of [['lease', Object.values(raw.lease)], ['occupancy', Object.values(raw.occupancy)]]) {
    for (const kind of [...kinds, 'none']) {
      const n = list.filter(e => (e[1] ? e[1].split(':')[0] : 'none') === kind).length;
      assert.equal(n, raw.meta.counts[`${what}.when.${kind}`] || 0, `${what} ${kind}`);
    }
  }
  assert.ok(data.rows.filter(r => r.lease).every(r => !r.lease.when || whenText(r.lease.when)), 'every token has words');
});

test('the build reads the sheet’s reference text the same way every time (scripts/build-data.py#ref_when)', t => {
  const cases = [
    ['2025-12-31', ['d:2025-12-31', '']],
    ['FY2025', ['fy:2025', '']],
    ['undated;checked2026-11-01', ['', '2026-11-01']],
    ['Undated Savills listing; checked 2026-11-20', ['', '2026-11-20']],
    ['Undated owner-linked brochure PDF17; retrieved2026-11-01, filename26Jan2024notverifiedasof', ['', '2026-11-01']],
    ['CBRE Bangkok office figures Q4 2023; checked 2026-11-20', ['q:2023-4', '2026-11-20']],
    ['2026-Q2', ['q:2026-2', '']],
    ['2025-Q2;asof2025-06-30', ['d:2025-06-30', '']],
    ['QHBREIT2025 Annual Report, PDF117/printed114, footnote2 snapshot31Dec2025', ['d:2025-12-31', '']],
    ['POPF Q3/2024presentation published2024-12-03; actualPDF13newsletter footnoteNLAasof2024-09-30', ['d:2024-09-30', '']],
    ['FY2024ownerassetprofilePDF34/printed33; fiscalreference2024-12-31', ['fy:2024', '']],
    ['2025-01-01/2025-12-31', ['r:2025-01-01/2025-12-31', '']],
    ['survey 2025-07-31; valuation 2025-10-01', ['d:2025-07-31', '']],
    ['owner_press_release_publication2021-08-13;measurement_asof_not_separately_stated', ['p:2021-08-13', '']],
    ['2022-06-21 owner article: area for rent over 52,000 sq.m.', ['p:2022-06-21', '']],
    ['2012 press release (two 35-storey towers); checked 2026-11-20', ['p:2012', '2026-11-20']],
    ['2026-06 (source month precision)', ['m:2026-06', '']],
    ['Bangkok Post citing owner factsheet (about 39,000); checked 2026-11-20', ['', '2026-11-20']],
    ['', ['', '']],
  ];
  const script = fileURLToPath(new URL('../scripts/build-data.py', import.meta.url));
  const code = 'import importlib.util, json, sys\n' +
    'spec = importlib.util.spec_from_file_location("bd", sys.argv[1]); bd = importlib.util.module_from_spec(spec)\n' +
    'sys.dont_write_bytecode = True; spec.loader.exec_module(bd)\n' +
    'print(json.dumps([list(bd.ref_when(x)) for x in json.loads(sys.argv[2])]))';
  const run = spawnSync('python3', ['-I', '-B', '-c', code, script, JSON.stringify(cases.map(c => c[0]))], {encoding: 'utf8'});
  if (run.error || run.status !== 0 && /No module named/.test(run.stderr)) { t.skip('python3 with the build’s modules is not available'); return; }
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  cases.forEach(([text, want], i) => assert.deepEqual(out[i], want, text));
});

test('the panel words each date in Thai, and the English page reads it', () => {
  const words = [
    ['d:2025-12-31', 'ข้อมูล ณ 31 ธ.ค. 2568', 'as of 31 Dec 2025'],
    ['m:2026-06', 'ข้อมูล ณ มิ.ย. 2569', 'as of Jun 2026'],
    ['q:2023-4', 'ไตรมาส 4/2566', 'Q4 2023'],
    ['fy:2025', 'ปีบัญชี 2568', 'fiscal year 2025'],
    ['r:2025-01-01/2025-12-31', 'ทั้งปี 2568', 'the whole of 2025'],
    ['r:2026-04-01/2026-06-30', 'ข้อมูลช่วง เม.ย.–มิ.ย. 2569', 'for Apr–Jun 2026'],
    ['p:2022-06-21', 'เผยแพร่ 21 มิ.ย. 2565', 'published 21 Jun 2022'],
    ['p:2012', 'เผยแพร่ปี 2555', 'published in 2012'],
  ];
  registerDictionary(OFFICE_EN);
  for (const [token, th, en] of words) {
    assert.equal(whenText(token), th, token);
    assert.equal(translate(th), en, th);
  }
  assert.equal(whenText(''), '');
  assert.equal(whenText('d:2025-12-31', {short: true}), '31 ธ.ค. 2568');
  assert.equal(whenText('r:2026-04-01/2026-06-30', {short: true}), 'เม.ย.–มิ.ย. 2569');
  assert.equal(translate('ตรวจ 20 พ.ย. 2569'), 'checked 20 Nov 2026');
  assert.equal(translate('ไม่ระบุวันที่ของตัวเลข'), 'figure not dated');
  assert.equal(translate('ขอบเขตตามแหล่ง'), 'Scope as the source states it');
  assert.equal(translate('ตามนายหน้า'), 'per the broker');
  assert.equal(translate('ตามข่าวประชาสัมพันธ์'), 'per a press release');
});
