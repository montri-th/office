# CityMETER · Office — data and method

How `data/offices.json` is built, what one row and one figure mean, and what the demo never claims. Every number below is
a snapshot of release 0.1.0 (data built 2026-11-05 from the research master tabs read the same day; the sheet's own
checks run 2026-10-24 to 2026-11-02); the page computes everything from the data at run time, so these are fixtures, not
constants.

## วิธีนับ — อ่านตัวเลขในหน้าอย่างไร

หน้าจอไม่มีคำเตือน (กติกาเจ้าของจาก CityMETER · Hotel 1 พ.ย. 2569: “ไม่มี caveats เลย”) ทุกบรรทัดที่มาท้ายหน้ามีลิงก์ “วิธีนับ” มาที่นี่ ขอบเขตของตัวเลขอยู่ตรงนี้ที่เดียว

- **แห่ง (สำนักงาน)** = รายการสำนักงานหนึ่งรายการ (Office ID ของชีตวิจัย) อาจเป็นสำนักงานขององค์กร อาคารหรือส่วนสำนักงานให้เช่า หรือศูนย์พื้นที่ทำงานแบบบริการในอาคาร สำนักงานหนึ่งแห่งอาจเป็นแค่บางชั้นของอาคาร และศูนย์พื้นที่ทำงานในอาคารเป็นอีกรายการหนึ่ง จำนวนแห่งจึงไม่ใช่จำนวนอาคารหรือพื้นที่สำนักงาน ชุดข้อมูลเป็น research master ไม่ใช่สำมะโนสำนักงานทั้งประเทศ และไม่มีตัวหารระดับประเทศ เขตที่ “0 ที่พบ” คือไม่พบในชุดข้อมูลนี้
- **ค่าเช่าที่ประกาศ** = ค่าเช่าเริ่มต้นที่หน้าประกาศสาธารณะแสดง (ส่วนใหญ่เป็นหน้าของนายหน้า) บาทต่อตารางเมตรต่อเดือน พร้อมเดือนที่ประกาศ (พ.ค.–ต.ค. 2569) ราคาที่มีเดือนกำกับเกือบทั้งหมดมาจากเว็บประกาศรายเดียว (officebangkok.com 255 จาก 256 ราคา) ไม่ใช่ค่าเช่าตามสัญญา ค่าเช่าที่ตกลงกันจริง หรือค่าเฉลี่ยของอาคาร ส่วนใหญ่ยังไม่ได้ตรวจว่ารวม VAT และค่าบริการหรือไม่ (ชีตบันทึกฐานของทุกราคา)
- **ค่าเช่ากลาง** ของพื้นที่ = ค่ากลาง (median) ของค่าเช่าที่ประกาศของสำนักงานในพื้นที่ที่มีเดือนกำกับ ใช้เมื่อมีอย่างน้อย 5 ราคา พื้นที่ที่มีน้อยกว่าเป็นลายทแยงบนแผนที่ (“< 5 ราคา”) และแผงบอกจำนวนราคาที่มีพร้อมราคาของแต่ละสำนักงาน ราคาที่ไม่มีเดือนกำกับ (20 รายการ) แสดงรายสำนักงานเท่านั้น ไม่เข้าค่ากลาง พื้นที่ที่ไม่มีสำนักงานเลยไม่มีสี (นอกขอบเขตของมาตรวัดค่าเช่า)
- **ราคาที่บันทึก (เดิม)** = ราคาต่อตารางเมตรของ CityMETER production รุ่นเดิม ไม่ระบุรอบเวลา แสดงเฉพาะสำนักงานที่ไม่มีค่าเช่ารายเดือน ไม่เข้าค่ากลางหรือการจัดอันดับ
- **ชั้น** = จำนวนชั้นของอาคารที่สำนักงานอยู่ตามแหล่ง พร้อมสถานะ (ตรงกันมากกว่าหนึ่งแหล่ง · จากแหล่งหลัก · จากหน้าประกาศ · ค่าเดิมใน CityMETER production · แหล่งข้อมูลขัดกัน) ค่าที่แหล่งขัดกันแสดงพร้อมสถานะ แต่ไม่เข้ากลุ่มความสูง
- **พื้นที่ (ตร.ม.)** = พื้นที่ตามแหล่งพร้อมฐาน ส่วนใหญ่ไม่ระบุว่าเป็นพื้นที่เช่าหรือพื้นที่อาคารรวม ไม่นำมาบวกหรือหาค่าเฉลี่ย
- **อัตราการเช่า** = ตัวเลขที่เจ้าของรายงาน (เช่น รายงานประจำปีของกองทรัสต์) พร้อมวันที่อ้างอิงและขอบเขต (บางรายการเป็นทั้งพอร์ต ไม่ใช่เฉพาะสำนักงาน) แสดงรายสำนักงาน ไม่นำมาเฉลี่ย
- **สัดส่วนของจังหวัด** = สำนักงานในพื้นที่ ÷ สำนักงานทั้งจังหวัดในตัวกรอง รวมรายการที่ระบุได้แค่จังหวัด ซึ่งนับในยอดจังหวัดแต่ไม่อยู่ในสีของเขต/อำเภอใด
- **ใกล้รถไฟฟ้า** = ห่างจุดอ้างอิงของสถานีที่เปิดแล้วไม่เกิน 500 ม. เป็นระยะตรง ไม่ใช่ระยะเดินหรือเวลาเดินทาง นับเฉพาะสำนักงานที่มีพิกัด (ตัวตั้งและตัวหารอยู่ในคำอธิบายของแต่ละแท่ง) ค่าเช่ากลาง “≤ 500 ม.” กับ “ไกลกว่า” เทียบราคาที่ประกาศสองกลุ่มในจังหวัดเดียวกัน เป็นสิ่งที่วัดได้ในชุดข้อมูล ไม่ได้พิสูจน์ว่ารถไฟฟ้าทำให้ค่าเช่าสูงขึ้น
- **ค่าเช่ารอบ ๆ** = สำนักงานที่มีค่าเช่าที่ประกาศในระยะตรง 1 กม. เรียงใกล้ก่อน (ไม่เกิน 8 แห่ง) พร้อมจำนวนสำนักงานในรัศมีเดียวกันและค่ากลางของราคาที่มีเดือนกำกับ (เมื่อมีอย่างน้อย 5 ราคา) เป็นรายชื่อเริ่มต้นสำหรับเทียบ ไม่ใช่การประเมินมูลค่า
- **องค์กร** = องค์กรที่ชีตวิจัยผูกกับสำนักงานพร้อมบทบาท (ใช้เป็นสำนักงาน · ดำเนินการสำนักงาน · ผู้ให้บริการพื้นที่ทำงาน · เครือข่ายพื้นที่ทำงาน · แบรนด์ให้เช่า · อยู่ในพอร์ตที่เผยแพร่ · ผู้บริหารอาคารตามแหล่ง · ผู้ให้เช่าพื้นที่) เป็นข้อมูลตามแหล่ง ไม่ใช่การยืนยันว่าเป็นผู้เช่าหรือเจ้าของปัจจุบัน รายการประกาศของนายหน้า (เช่น CBRE) และแบรนด์ที่ยังไม่ยืนยันไม่แสดงเป็นองค์กรของสำนักงาน สำนักงานที่ไม่มีองค์กรในข้อมูลไม่ได้แปลว่าไม่มีผู้ใช้
- **ที่มาของรายการ** = ยืนยันจากแหล่งหลัก (หลักฐานจากองค์กร อาคาร หรือผู้ดำเนินการว่าเป็นสำนักงาน) · ข้อมูลเดิมจาก CityMETER production (312 รายการที่ยังมีแหล่งเดียวคือข้อมูลเดิมของระบบจริง ยังไม่ได้ตรวจซ้ำ) · รอตรวจหลักฐาน
- **อาคาร** = อาคารบนแผนที่ (CityMETER Building V4 หรือ OpenStreetMap ตามพื้นที่) ความสูง “สูงราว” เป็นค่าของชุดข้อมูลอาคาร ไม่ใช่ผลรังวัด “สำนักงานในอาคารนี้” = หมุดของสำนักงานอยู่ในขอบอาคาร · “อาคารใกล้หมุด” เป็นการเลือกมุมกล้องเท่านั้น ไม่ใช่การยืนยันว่าสำนักงานอยู่ในอาคารนั้น
- **สถานีที่กำลังสร้าง** = โครงการ ยังไม่ใช่บริการ

## 1. Sources

| Input | What it is | Published here? |
|---|---|---|
| Research master | Google Sheets “CityMETER Office — Venue, Company & Building Research Master 2026-10-24” (registry id `research.TH.office`, internal). Tabs read: `01_OFFICES`, `15_PROJECTS`, `18_ORGANIZATIONS`, `19_ORGANIZATION_ROLES`, `23_OFFICE_ALIASES`, `28_OFFICE_METRICS`, read from the live sheet on 2026-11-05 (one CSV per tab) | No. Only the SHA-256 and row count of each tab read (`meta.inputs`) and the derived columns in `data/offices.json` |
| CityMETER production base info | `https://landometer.com/api/v2/citymeter-v3/base/info/lv0` and `…/lv1/{uuid}` (77 provinces, 928 districts, production codes, Thai and English names, areaSqm) | Receipts only (`data/boundary-receipts.json`) |
| English district names | OpenGISData-Thailand `districts.geojson` @ `fafcea1` (CC BY 4.0, DOPA-credited; SHA-256 in `data/area-index.json → metadata.englishNames`), joined by production district code; read on the English page and in search, never as a boundary | Yes (the names, in `data/area-index.json`) |
| District outlines | Display geometry per province (`data/frames/{CODE}.json`) and province frames (`data/provinces.geojson`), unchanged from CityMETER · Hotel 0.3.6 | Yes |
| CityMETER · Transit | `montri-th/transit` `data/transit.json` @5f5232d (release `transit-data-2026-10-31-r1`, as of 2026-10-31, SHA-256 in `meta.context.rail`): the 195 operating stations and the stations under construction nearest an office | Station id, name, line labels, status and reference point of those stations |
| Building units | `data/building-units/` (which อปท./เขต draws CityMETER Building V4), unchanged from CityMETER · Hotel 0.3.6; a unit not in the files draws OpenStreetMap | Yes |

The rows come from the sources the research master lists per row (`sources[]` in the data): CityMETER Office V3 (the
office dataset of CityMETER production, 336 rows before the exclusions below; repository snapshot recorded in the
sheet), official pages of organisations and buildings (the Revenue Department office directory, corporate contact
pages), owner and workspace-operator portfolios, regional private offices, and broker portfolios checked against
primary pages (name, address, point, building scope and duplicates).

## 2. One row, two measures

**One row = one Office ID of `01_OFFICES`** (608 rows). The sheet's aggregate references are kept out of every figure
and named in `meta.excluded`, because the sheet counts them through their child rows (“CP3/Ninth parent ไม่ถูกนับซ้ำกับ
อาคารย่อย”): a row whose `qualification_status` is `aggregate_reference_excluded`, or a `multi_building_project_reference`
whose `office_supply_aggregation_role` is `parent_reference_not_additive_to_children`, when its project has child rows —
CP Tower 3 (2 children), The 9th Towers Grand Rama 9 (2), All Seasons Place (3: CRC, M.Thai and Capital Tower) and the
Royal Phuket Marina office rental components (7). Every other row counts once, as the sheet keeps it.

**Category** = `office_supply_model`: rental office (216) · managed workspace (59) · organisation's own office (168) · own
use and rental (3) · not yet classified (`unresolved` 157 + `rental_office_candidate` 5 = 162).
**Evidence** = `qualification_status`: confirmed from a primary source (293: `source_confirmed_office_site`,
`source_confirmed_office_purpose`, `office_use_confirmed_physical_split_pending`) · legacy record of CityMETER production
(312: `legacy_source_only`) · held for review (3).

**Measure `count` (default)** — offices per area, LDS `count` (a total, no denominator). A district with none under the
filters is a measured zero of this dataset (EVID-05 `measured_zero`: lowest sample + zero outline).

**Measure `rent`** — the median of the dated starting asking rents of an area's offices (THB per m² per month, LDS
`price`, “มูลค่าภายใต้หน่วยและช่วงเวลาเดียวกัน”): `28_OFFICE_METRICS.rent_min_thb_sqm_month` where `rent_status` is
`published_broker_value` and `rent_source_date` gives the month (256 of 276 monthly rents; listing months 2026-05 to
2026-10). EVID-05: an area with at least `RENT_MIN_N` = 5 such rents is `measured`; an area with offices but fewer is
`no_data` (hatch; its reason “ราคาประกาศ n รายการ” or “ไม่มีราคาประกาศ”); an area with no office is `out_of_scope` (bare
basemap). A rent is never 0. The 20 undated rents and the 72 legacy prices (`legacy_rent_min/max`, period not stated,
only for rows without a monthly rent) are shown per office only. The rent basis of each figure is kept with it
(`vocab.rentBasis`, named by what it is); the sheet's verification state — VAT and service-charge inclusion not verified
for 252 of the 276 monthly rents — is in `meta.rentBases`. Listing pages: the 256 dated rents come from
officebangkok.com (255) and ddproperty.com (1); the 20 undated ones from property.cbre.co.th (12), irentoffice.com (7)
and thelist.group (1). Every median therefore reads, in practice, one broker site's displayed starting rents.

Snapshot (no filter): offices 608 · dated rents 256, median ฿600 · Bangkok 429 offices, 250 dated rents, median ฿610 ·
districts with offices 128 · districts with a median 14 (all in Bangkok but one: บางพลี, Samut Prakan, ฿550 from 5).

## 3. District membership (build time, never re-assigned on screen)

The row's own district name (`01_OFFICES.district`) is matched to a production district of its own province: Thai names
after the usual prefixes (อำเภอ, เขต) are dropped; “เมือง” alone is เมือง{province}; a Latin name (“Si Racha”, “Muang”) is
read against the English district names of the index (543 rows, `admin = name`). A row without a usable name is placed by
its selected point in a district outline of its own province (45, `point`). The rest stop at province (20). No point lies
in another province than its row's (0 conflicts), and no matched name disagrees with its point
(`checks.namePointDisagree` = 0).

## 4. Points

The sheet's selected point, unchanged (427 rows). The basis of each point is kept (`coordRole`: CityMETER production
point with the sheet's amendments, a point the source publishes, a map target of a named source, a representative point
inside the named OpenStreetMap building, a place the owner or user refers to, an organisation's published map point, a
point the official page states). None is a survey. 181 rows have no point and are drawn nowhere; they stay in every total.

## 5. Context (straight lines, build time)

- Rail (CityMETER · Transit): the nearest operating station within 2 km of the office's point, and the nearest station
  under construction (a project). Distances are great-circle lines between reference points.
- Building join (`01_OFFICES.building_join_status`, the sheet's join of 2 Nov 2026): the point inside an OpenStreetMap
  building (with the way's link), a CityMETER building context, a named host without an outline yet, a conflict, none,
  or not checked — shown as the office's building status, never re-joined from it.
- Organisations: `19_ORGANIZATION_ROLES` → `18_ORGANIZATIONS` by id. Left out as organisations of the office:
  `commercial_leasing_agent_listing` (CBRE 15, Cushman & Wakefield 1), `unverified_brand_affiliation` (6) and
  `co_marketing_association` (1). The sheet keeps two names for some companies as separate organisations (for example
  บริษัท ซี.พี.แลนด์ จำกัด (มหาชน) and C.P.Land Public Company Limited); the demo keeps them as the sheet has them.
- Projects (`15_PROJECTS.project_name`) and other names (`23_OFFICE_ALIASES`, address aliases left out) for search.

## 6. What the page computes

- The Aha (`js/area-insight.js`): count — the province with the most placed offices, its top districts (≤ 3; a tie at the
  cut joins while the focus stays ≤ 4 and leaves a district out, otherwise only the districts above the tie), the share of
  the province's offices, rail shares of the focus and the rest, and the district with the most outside the province;
  rent — the province with the most dated rents, its districts with the highest median (n ≥ 5), the province's median,
  the medians near rail (≤ 500 m) and farther, and the highest median outside the province.
- District and province choropleths: a 41-sample rank ramp of the measure (`js/scales.js#buildRamp`) over the areas being
  read; competition ranks in the district panel (tied districts share a rank, “อันดับ 3 (ร่วม)”).
- Charts: districts by the measure; district × category matrix of offices; organisations by offices.
- The rent comparison set (`compsetOf`): offices with a rent within 1 km, nearest first, every row of the dataset.

## 7. Colour and categorical rules

LDS 0.9.7 (v0.9.7-owner.1, color-srgb-10, base SHA-256 d3085cbc…96): `count` and `price` 41-sample LUTs copied exactly
(scaleVersion 4ff5c1fb… and a4fcda65…), identical HEX on both themes; EVID-05 treatments from the base `dataState`.
Categories bind to LDS series by stable id with the series shape cue (rental 2 square, workspace 1 circle, organisation 3
triangle, own use and rental 4 diamond, not yet classified 9 dash; no star). `npm run check:lds -- --lds <file>` compares
every shipped value with the source file.

## 8. Not published

Addresses (`office_location_reported`, `15_PROJECTS.address_reported`), telephone numbers, company location candidates,
tenant counts, researcher notes, ownership notes and owner-metric notes, observation ids, legal registration ids, the
private repository's raw ids and links, internal sheet URLs, and the README text of the sheet (`meta.excludedFields`).
Source links are public https pages only; legacy production rows link to CityMETER production.

The research master says “ยังไม่รับรองสิทธิ์การเผยแพร่ข้อมูลต้นทาง Office หรือ upstream datasets ต่อสาธารณะ”. The demo is
published on the owner's request of 2026-11-05; the rights of each upstream source stay with that source. OpenStreetMap
data © OpenStreetMap contributors (ODbL).

## 9. Research follow-ups (reported, not patched in `data/`)

- 135 rows have no public source link (their supply-classification source is the private repository); they link to
  CityMETER production.
- Some companies appear as two organisations (Thai and English names); merging them is the sheet's call.
- An organisation name in `18_ORGANIZATIONS` reads like an office (“Haadyai Nakarin office at ASEAN City Resort C.3”).
- 16 floor counts and 37 areas carry `source_scope_or_value_conflict`.
- Rent sources: 255 of the 256 dated rents come from one broker site; a second listing source (or the owners' own
  pages) would show whether the medians hold beyond that site.
- Dated rents outside Bangkok and Samut Prakan: 1 (Nonthaburi). The regional C.P. Tower rents (Hat Yai, Nakhon
  Ratchasima, Phitsanulok, Surat Thani, Udon Thani) have no listing month, so they are shown per office and stay out of
  every median.

## 10. Rebuild

```sh
python3 -I scripts/build-data.py --csv <dir of tab CSVs> --read-on YYYY-MM-DD \
  --index data/area-index.json --frames data/frames --transit <montri-th/transit checkout> --out .
npm test
```

The build stops on any value it has no rule for (a new category, evidence status, role, rent basis, floor status or
source version), so a sheet change is decided in the code, never guessed.
