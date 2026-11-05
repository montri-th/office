# CityMETER Office 0.1.0 — verification

Release 0.1.0 (cache tag `?v=20261105-r1`) is the first Office release, built on CityMETER · Hotel 0.3.6
(montri-th/hotel @177e592). Results are from 2026-11-05 (Asia/Bangkok). Section 4 (live) and section 5 (registry) are
recorded after publication; the final live attestation of the published commit belongs in `RELEASE_RECEIPT.json` of the
handoff bundle (it cannot live in the commit it attests).

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

Recorded after publication.

## 5. Registry

Recorded after the update.
