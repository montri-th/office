# CityMETER Office 0.1.0 — verification

Release 0.1.0 is the first Office release, built on CityMETER · Hotel 0.3.6 (montri-th/hotel @177e592): r1 (`5e2d128`,
cache tag `?v=20261105-r1`) and r2 (`fb2bbe7`, `?v=20261105-r2`, fixes found on the live r1 walk). Results are from
2026-11-05 (Asia/Bangkok). The commit that adds sections 4 and 5 changes documentation only; the final live attestation
of the published commit belongs in `RELEASE_RECEIPT.json` of the handoff bundle (it cannot live in the commit it attests).

## 0. Owner request

“จากที่เราทำ demo ของ CityMETER: Hotel มาแล้ว ใน https://montri-th.github.io/hotel ขอให้ทำแบบเดียวกันให้กับ CityMETER:
Office แล้ว publish ที่ https://github.com/montri-th/office โดยใช้ข้อมูลจาก [the office research master] ซึ่งรวบรวมมาจาก
งานเดิมใน production ที่เป็น CityMETER: Office มาปรับปรุง … update registry sheet” — with the owner's choice of the same day:
read “CityMETER Office — Venue, Company & Building Research Master 2026-10-24” and update the Office row of the CityMETER
Dataset Registry (`R01_DATASETS`, `research.TH.office`).

## 1. Data build

- Tabs read from the live research master on 2026-11-05 (one CSV each, kept out of the repository; SHA-256 and row count
  in `meta.inputs` and `data/build-report.json`): `01_OFFICES` 612 rows · `15_PROJECTS` 76 · `18_ORGANIZATIONS` 80 ·
  `19_ORGANIZATION_ROLES` 582 · `23_OFFICE_ALIASES` 1,068 · `28_OFFICE_METRICS` 612.
- Output `data/offices.json`: 608 offices (4 aggregate references with child rows kept out: CP Tower 3, The 9th Towers
  Grand Rama 9, All Seasons Place, Royal Phuket Marina office rental components) · categories rental 216 · workspace 59 ·
  organisation 168 · own use and rental 3 · not yet classified 162 · evidence confirmed 293 · legacy 312 · review 3.
- District membership: name 543 · point 45 · province only 20 · conflicts 0 · name/point disagreements 0.
- Points 427 (181 rows without a point, kept in every total) · monthly rents 276 (dated 256: officebangkok.com 255,
  ddproperty.com 1; undated 20) · legacy-only prices 72 · floors known 360 · areas known 346 · organisations 77 (331 rows
  with one) · Transit stations 215 (@5f5232d, SHA-256 in `meta.context.rail`).
- Privacy: no address, telephone number, researcher note, ownership note, legal registration id or private repository
  link in the data (`meta.excludedFields`; `tests/data.test.js`); source links are public https pages; 135 rows without a
  public source link point to CityMETER production.

## 2. Tests and colour parity

- `npm test`: 125 pass, 0 fail (data invariants, both Aha fixtures and the tie rule, EVID-05 states, panels and copy
  rules, charts, scales, cues, camera, massing, building join and units, terrain, MapLibre guards, release consistency,
  handoff schema 1.5.0, publication hygiene).
- `npm run check:lds -- --lds <LDS 0.9.7 file>` against the normative file with SHA-256
  `d3085cbc0a50195f1cbf0c77b1d77c0d19b84364daf2948eb367348d65432d96`: **130 ok, 0 failed** (`count` and `price` LUTs,
  anchors, scale versions, `dataState`, series fills, theme tokens).

## 3. Local render (before publication)

Playwright + MapLibre GL JS 5.6.2 in the build container; the basemap, glyph and building tiles are stubbed there (no
network to OpenFreeMap or the production tile API), so these frames check layout, copy and data, not the city scene.
Frames at 1440 × 900 and 393 × 852, light and dark: overview (count Aha), rent switch (Bangkok and country), a district on
the rent measure, an office (dark), a station, the organisation chart and filter, the table, phone light overview and
phone dark rent. No page error, no horizontal overflow, no “undefined”/“NaN” in the text, Thai unclipped; ties read
“อันดับ 3 (ร่วม)”. Local renders are not proof of the live release — see section 4.

## 4. Live release

- GitHub Pages enabled on 2026-11-05 from `main` / root (repository settings, the owner's browser session); the site
  answered HTTP 200 about a minute later.
- r1 `5e2d128`: `npm run handoff:manifest` then `npm run verify:live` — **241 ok, 0 failed** (every published file:
  all tracked files but `tests/`, `scripts/`, dotfiles and `package.json`).
- Live walk of r1 in Chrome, desktop 1710 × 873 CSS px, dark (system theme): the first screen is the 3D city scene over
  บางรัก · ห้วยขวาง · วัฒนา · ปทุมวัน with “47% ของสำนักงานในกรุงเทพมหานคร อยู่ใน 4 เขตนี้ · 202 จาก 429 แห่ง”, rail
  71% / 53%, “อันดับ 1 นอกกรุงเทพมหานคร: อำเภอเมืองเชียงใหม่ 15 แห่ง”; the rent switch (ปทุมวัน ฿983 · 26 ราคา, คลองเตย
  ฿713 · 24, วัฒนา ฿665 · 29, ทั้งกรุงเทพมหานคร ฿610 · 250, ≤ 500 ม. ฿743 · 166 vs ฿500 · 80, บางพลี ฿550 · 5); district
  ปทุมวัน (rank 1 of 14 nationally, 46 แห่ง, 11%, 89% near rail); office 140 Wireless from its map label — the map turned
  3D and framed its CityMETER Building V4 footprint in the two-point view with the x-ray (“อาคารของสำนักงาน”), rent chip
  ฿1,000–1,200 /ตร.ม./เดือน · มิ.ย. 2569, ค่าเช่ารอบ ๆ 15 แห่ง (8 listed), one provenance line; station ราชดำริ (3 แห่ง,
  500 m ring, link to CityMETER Transit); the organisation chart (กรมสรรพากร 128, Regus 65, UnionSPACE 15 …). No console
  error, no horizontal overflow, no Hotel words, no “undefined”/“NaN”.
- Phone width: the window could not be resized (maximised), so the live page was framed at 393 × 852 CSS px in a
  same-origin iframe (media queries read the frame; touch-only behaviour is not exercised there): light overview (dock
  with the Aha and legend), light office 140 Wireless (building above the 56% sheet), dark rent overview. Layout held,
  Thai unclipped, no overflow.
- Found on the r1 walk and fixed in r2: the rent tile read “ค่าเช่ากลาง/ตร.ม.” without the month and the number of
  rents; list rows and the rent set read “/ตร.ม.”; the phone dock named the top median without its n; the district chart
  printed ฿982.5 beside the Aha's ฿983. r2: tile “ค่าเช่ากลาง/ตร.ม./เดือน” + “n ราคา”, rows “/ตร.ม./เดือน”, “(n ราคา)” with
  every secondary median, chart values rounded. (The pin layer's accessible name “หมุดสำนักงาน” was already corrected
  in r1 before publication; the r2 commit message lists it by mistake.) `npm test` 125 pass; local renders of the
  district rent panel (1440 × 900 dark) and the phone dock (393 × 852 dark, touch emulation) before the push.
- r2 `fb2bbe7`: Pages served the r2 tag about a minute after the push; `verify:live` **241 ok, 0 failed**; live walk:
  every script and stylesheet carries `?v=20261105-r2`, the ปทุมวัน rent tile reads “฿983 · ค่าเช่ากลาง/ตร.ม./เดือน · 26
  ราคา”, no console error.

## 5. Registry

CityMETER Dataset Registry — Product, Evidence, Usage & SEO, tab `R01_DATASETS`, edited in place in the owner's browser
on 2026-11-05 after re-reading the header (V `demo_web_url`, W `demo_repository_url`, X `demo_checked_on`, Y
`demo_check_note`) and confirming A11 = `research.TH.office`:

| Cell | Before | After |
|---|---|---|
| V11 | (empty) | https://montri-th.github.io/office/ |
| W11 | (empty) | https://github.com/montri-th/office |
| X11 | 11/1/2026 | 11/5/2026 |
| Y11 | ยังไม่พบ demo ใน repo ที่ตรวจ | HTTP 200; ชื่อหน้าตรงชุดข้อมูล; รุ่น 0.1.0 ?v=20261105-r2 (commit fb2bbe7); ไฟล์บน GitHub Pages ตรง repo 241/241; เดินเว็บจริง desktop และ 393 px ไม่มี console error |

The cell notes of V11, X11 and Y11 (the 1 Nov check: “ยังไม่พบ demo …”, check date) were rewritten to the 5 Nov
evidence, keeping the 1 Nov result as history. Read back from the sheet's CSV export (rows 10–12: only row 11 changed)
and by opening each note; Sheets showed “Saved to Drive”. No validation, protected range, row or column was touched.
The file also runs its own sync every 60 minutes (`R08_SYNC_STATUS`); the demo columns filled on 1 Nov for other rows
are still in place after many runs.
