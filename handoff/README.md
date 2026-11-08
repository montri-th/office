# CityMETER Office — handoff

สำหรับนักพัฒนาที่รับงานต่อ เอกสารในโฟลเดอร์นี้มีสองรูปแบบที่ต้องตรงกัน: Markdown สำหรับคนอ่าน และ JSON (schema `handoff.schema.json` 1.5.0) สำหรับเครื่องตรวจ (`tests/release.test.js` ตรวจ schema และเลขรุ่น)

| ไฟล์ | อ่านเพื่อ |
|---|---|
| `../PRODUCT_STATEMENT.md` · `product-statement.json` | ผู้ใช้ ปัญหา ทางเลือกที่ใช้อยู่ กลยุทธ์ claim boundary และสมมติฐานที่ต้องทดสอบ |
| `PRODUCT_BRIEF.md` · `product-brief.json` | สัญญาของหน้าจอ: ข้อค้นพบแรก มาตรวัด สี บริบท ค่าเช่า องค์กร แผง กราฟ กล้อง |
| `IMPLEMENTATION_PLAN.md` · `implementation-plan.json` | สถาปัตยกรรม โมดูล งาน acceptance criteria และ backlog |
| `VERIFICATION.md` | ผลตรวจของรุ่นนี้: tests, LDS parity, render, live attestation, live walk, registry |
| `../DATA_METHOD.md` | ที่มาของทุกตัวเลข วิธีจับคู่เขต/อำเภอ บริบท และสิ่งที่ไม่เผยแพร่ |
| `../AGENTS.md` | ความต้องการของเจ้าของที่เป็นสัญญา — อ่านก่อนแก้ |

## ลำดับการทำงาน

1. แก้ข้อมูลในชีตวิจัยเท่านั้น แล้ว export แท็บที่อ่านเป็น CSV (ไม่ commit ไฟล์เหล่านี้)
2. `python3 -I scripts/build-data.py …` ตาม `DATA_METHOD.md` §10
3. `npm test` และ `npm run check:lds -- --lds <LDS 0.9.7 .md>`
4. ขยับ `?v=YYYYMMDD-rN` ใน `index.html` + `package.json` + `design-intent.json` + handoff JSON
5. push `main` → GitHub Pages → `npm run handoff:manifest` → `npm run verify:live`
6. เดินเว็บจริงที่ 1440 และ 393 px ทั้ง light และ dark ก่อนบอกว่าเสร็จ

## จุดที่ต้องระวัง

- สำนักงานหนึ่งแห่ง ≠ อาคารหนึ่งหลัง · ค่าเช่า = ค่าเช่าเริ่มต้นที่ประกาศ (ส่วนใหญ่จากเว็บประกาศรายเดียว) · ค่ากลางต้องมีอย่างน้อย 5 ราคาและบอกจำนวนเสมอ · ระยะ = ระยะตรง · ไม่มีคำเตือนบนหน้าจอ ข้อจำกัดอยู่หลังลิงก์ “วิธีนับ” (DATA_METHOD.md)
- เขต/อำเภอของแถวมาจาก build (`row.admin`) ห้ามจับคู่ใหม่บนหน้าจอ
- องค์กรผูกด้วย id และเป็นข้อมูลตามแหล่ง ไม่ใช่การยืนยันผู้เช่าหรือเจ้าของ
- MapLibre ล็อกที่ 5.6.2 พร้อม `js/shell/maplibre-guard.js` อย่าอัปเกรดโดยไม่ตรวจบั๊ก tile cover ซ้ำ
- ลำดับ layer มวลอาคาร x-ray สถานี และหมุด มีผลต่อมุมมองอาคาร อย่าสลับโดยไม่ทดสอบ
