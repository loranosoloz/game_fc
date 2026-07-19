# FC Manager — Todo List

อ้างอิงจาก [GAME_SYSTEMS.md](./GAME_SYSTEMS.md) v0.2 (ผสมระบบ FM26 + manager อื่นๆ)  
ติ๊ก `[x]` เมื่อเสร็จ — โฟกัส **Phase 1** ก่อน

---

## Phase 0 — เตรียมโปรเจกต์

- [ ] เลือก tech stack (เช่น React + Vite / Next.js)
- [ ] Scaffold + โครงสร้างโฟลเดอร์
- [ ] Styling (แนะนำ Tailwind ตาม baseline-ui)
- [ ] Schema MVP (Club, Player, Fixture, Save) — เผื่อฟิลด์ขยาย Phase 2+
- [ ] Seed data ปลอม (ลีกเล็ก, คลับ, นักเตะ)
- [ ] Routing / navigation ตาม workflow: Portal, Squad, Tactics, Match, Table, Club, Save

---

## Phase 1 — MVP (เล่นจบฤดูกาลได้)

### Time & Portal
- [ ] โมเดลวัน / ฤดูกาล
- [ ] Advance Day + ไปถึงนัดถัดไป
- [ ] Portal อย่างง่าย (นัดถัดไป, สรุปคลับ, ข้อความพื้นฐาน)

### Club & Squad
- [ ] ข้อมูลคลับพื้นฐาน
- [ ] นักเตะ + แอตหลัก + สถานะ condition/form
- [ ] หน้า Squad

### Tactics (ยังไม่ dual)
- [ ] Formation 2–3 แบบ
- [ ] จัด XI + สต๊อก
- [ ] บันทึกลงเซฟ

### Match & League
- [ ] Instant Result
- [ ] สรุปสกอร์ / เหตุการณ์ง่าย
- [ ] Fixtures ทั้งฤดูกาล
- [ ] ตารางคะแนนอัปเดตหลังแข่ง
- [ ] หน้า Match + Table

### Finance & Save
- [ ] Balance + เงินเดือน + ตั๋วเหย้า
- [ ] New Game / Save 1 สล็อต / Load / Autosave

### เกณฑ์จบ Phase 1
- [ ] New Game → จัดทีม → แข่งครบฤดูกาล → เห็นอันดับ → เซฟ/โหลดได้

---

## Phase 2 — Manager feel

- [ ] Dual formation IP / OOP อย่างง่าย
- [ ] Team instructions ชุดย่อ (กด, โต้กลับ, ครองบอล, ความกว้าง)
- [ ] Tactical familiarity พื้นฐาน
- [ ] Transfer offer + ขาย + ต่อสัญญา
- [ ] Playing time / squad role → ความสุขนักเตะ
- [ ] Training สัปดาห์ + individual focus
- [ ] Medical: เจ็บ / ฟื้น / condition + sharpness
- [ ] Board confidence + เป้าหมายอันดับสั้นๆ
- [ ] Match event simulation / highlights
- [ ] Opposition report อย่างง่าย
- [ ] UI: Recruitment พื้นฐาน, Training, Medical สรุป

---

## Phase 3 — FM-depth

### Dynamics & Club Vision
- [ ] Hierarchy / relationships / cohesion
- [ ] Club Vision KPIs + สไตล์ที่บอร์ดต้องการ
- [ ] Facilities upgrades (คิวก่อสร้าง)

### Recruitment Hub
- [ ] Scouting knowledge + attribute fog
- [ ] Recruitment focuses (ตามบทบาท/ตำแหน่ง)
- [ ] Scout reports + shortlist
- [ ] Loans + add-ons / release clause
- [ ] Agents / negotiation หลายขั้น
- [ ] Squad Planner (ความลึก + สัญญาใกล้หมด)

### Tactics deep
- [ ] Instructions แยก Buildup / Progression / Final Third
- [ ] OOP: High press / Mid block / Low block
- [ ] Set pieces designer
- [ ] Opposition instructions
- [ ] Tactical Visualiser

### Match & Data
- [ ] Interactive match (เปลี่ยนแท็กติก / ตัวสำรอง / shout)
- [ ] Data Hub (ทีม, คน, แนวโน้มแท็กติก)
- [ ] xG / สถิติหลังแข่งละเอียดขึ้น

### Staff & Youth
- [ ] สตาฟหลายตำแหน่ง + ความสามารถ
- [ ] Responsibilities (มอบหมายงาน)
- [ ] Youth intake / newgens
- [ ] Mentoring
- [ ] Affiliates / loan-to-develop

### World & Media
- [ ] ถ้วยในประเทศ + แข่งทวีป
- [ ] ขึ้น–ตกชั้นหลายดิวิชัน
- [ ] Press conferences + news/gossip
- [ ] FFP-lite
- [ ] Career job market (สมัครงาน / ถูกเตะ / ว่างงาน)

---

## Phase 4 — World & polish (ออปชัน)

- [ ] International management / เรียกตัวทีมชาติ
- [ ] Women’s football mode
- [ ] TransferRoom-style marketplace board
- [ ] Vacation AI
- [ ] Glossary ศัพท์ในเกม (แนว FMPedia)
- [ ] Difficulty / realism toggles
- [ ] B team / โควต้าลงทะเบียนซับซ้อน
- [ ] Bookmarks / custom Portal layout

---

## นอกขอบเขต

- มัลติเพลเยอร์
- แมตช์ 3D เต็มรูปแบบ
- ฐานข้อมูลลิขสิทธิ์จริง
- Mobile native แยกแอป

---

## ลำดับทำแนะนำ (เริ่มโค้ด)

1. Phase 0 — scaffold + seed  
2. Time + Portal เปล่า  
3. Squad + Tactics (รูปเดียว)  
4. Instant Match + Table  
5. Finance เบาๆ + Save  
6. ลูบฤดูกาลให้จบได้ → แล้วค่อย Phase 2 (dual formation / ตลาด / medical)
