# CityMETER Office — Implementation Plan (0.1.0)

คู่กับ `implementation-plan.json`

## สถาปัตยกรรม

Static site บน GitHub Pages · ES modules ผ่าน import map (ทุกโมดูลมี `?v=` เดียวกัน) · ไม่มี build step · Node ≥ 20 สำหรับ tests · Python 3 สำหรับสร้างข้อมูล · MapLibre GL JS 5.6.2 จาก unpkg (ล็อกรุ่น) · tiles/glyphs จาก OpenFreeMap · ฐานโค้ด CityMETER · Hotel 0.3.6 (montri-th/hotel @177e592)

| โมดูล | หน้าที่ |
|---|---|
| `js/app.js` | ประสาน state, row scopes, โหมดแผง, URL, กล้อง, คลิกบนแผนที่ (`selectOffice`, `filterOrg`, `setMetric`) |
| `js/model.js` | decode `data/offices.json`, มาตรวัด (`count` · `rent`, `RENT_MIN_N` = 5), ตัวกรอง, สรุป, ลิงก์ production/Transit |
| `js/area-insight.js` | ข้อค้นพบแรกของทั้งสองมาตรวัด (กฎ tie และ N − 1, แท่งหรือค่ากลางรถไฟฟ้า, นอกจังหวัด) |
| `js/profile-model.js` | โมเดลแผง: overview, area, station, building, office (`compsetOf`), organisation |
| `js/panel.js` | HTML ของแผงทุกโหมด + บรรทัดที่มา |
| `js/charts.js` · `js/chart-model.js` | กราฟ areas / mix / orgs |
| `js/scales.js` · `js/cues.js` | สเกล LDS `count` + `price` 41 ระดับ, EVID-05, series + shape cue ของรูปแบบสำนักงาน |
| `js/map-layers.js` · `js/provinces.js` · `js/frames.js` · `js/areas.js` | choropleth เขต/อำเภอ, กรอบจังหวัด (ลายทแยง no data บนมาตรวัดค่าเช่า), ขอบเขตรายจังหวัด, ดัชนีพื้นที่ |
| `js/pins.js` · `js/stations.js` · `js/labels.js` | หมุดสำนักงาน (ขนาดเดียว), สถานีและวงรัศมี, ชื่อกลางจอ (ชั้น + ค่าเช่าที่ประกาศ) |
| `js/ask.js` · `js/breadcrumb.js` · `js/navigation.js` | ปุ่ม Google (Search + AI Overview, Maps, Street View), เส้นทาง, ไอคอนและวิธีใช้ |
| `js/massing.js` · `js/shell/camera.js` · `js/shell/venue-xray.js` · `js/shell/building-join.js` · `js/shell/maplibre-guard.js` · `js/shell/map-style.js` · `js/shell/mvt.js` · `js/shell/geometry.js` · `js/shell/building-units.js` · `js/shell/terrain.js` | มวลอาคาร กล้อง มุมมองอาคาร x-ray ภูมิประเทศ และ guard ของ MapLibre — สืบทอดจาก Hotel 0.3.6 โดยไม่เปลี่ยนพฤติกรรม |

สคริปต์: `scripts/build-data.py` (ชีตวิจัย → `data/offices.json` + `data/build-report.json`) · `build-boundaries.py` · `build-receipts.py` · `fetch-base.py` · `build-building-units.py` · `check-lds-parity.mjs` · `build-handoff.mjs` · `verify-live.mjs`

## งาน (ทั้งหมดเสร็จในรุ่นนี้)

T1 สร้างข้อมูลจาก 6 แท็บของชีตวิจัย + base info ของ production + Transit · T2 สัญญามาตรวัดและสี (count + price, EVID-05) · T3 ข้อค้นพบแรกทั้งสองมาตรวัด · T4 แผงสำนักงาน สถานี องค์กร อาคาร และค่าเช่ารอบ ๆ · T5 กราฟ ตาราง ปุ่ม Google ไอคอน ชื่อกลางจอ · T6 มุมมองอาคาร มวลอาคาร ภูมิประเทศ (สืบทอด) · T7 เอกสาร · T8 เผยแพร่และตรวจ live · T9 ปรับแถว Office ใน CityMETER Dataset Registry

## Acceptance criteria

A1 decode 608 แถว ไม่ซ้ำ ไม่รวมรายการอ้างอิงรวม · A2 ความเป็นส่วนตัวและความสะอาดของ repository · A3 มาตรวัดค่าเช่า (≥ 5 ราคา, no data, ไม่เป็น 0) · A4 parity สี · A5 จอแรก · A6 แผงสถานี · A7 ค่าเช่ารอบ ๆ · A8 บรรทัดที่มาและภาษาไทยทุกจอ · A9 live · A10 tie · A11 กฎ N − 1 · A12 การจับคู่เขต · A13 มุมมองอาคาร · A14 จอโทรศัพท์ · A15 ตัวกรององค์กร · A16 แถวใน registry — รายละเอียดและวิธีตรวจใน JSON

## Backlog

B1 แหล่งค่าเช่าที่สอง (ราคาที่มีเดือน 255 จาก 256 มาจากเว็บประกาศรายเดียว) · B2 ตรวจซ้ำ 312 รายการเดิมของ production · B3 พิกัดของ 181 รายการที่ยังไม่มี · B4 รวมองค์กรชื่อไทย/อังกฤษที่ซ้ำในชีต · B5 ราคาที่มีเดือนนอกกรุงเทพฯ และสมุทรปราการ · B6 ตรวจสิทธิ์ของแหล่งต้นทางก่อนเผยแพร่กว้างขึ้น · B7 หน่วยอาคารสำหรับสำนักงานนอกหน่วยของ Hotel · B8 Locale Insight / Population รายเขต และ feed สำหรับ agent
