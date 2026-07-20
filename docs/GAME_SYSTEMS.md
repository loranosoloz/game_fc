# FC Manager — ระบบเกม (Game Systems)

เอกสารนี้เป็น blueprint ระบบของเกมแบบ Football Club Manager  
ผสมโครงเดิมของเรา + แนวคิดจาก **Football Manager (โดยเฉพาะ FM26)** และเกม manager อื่นๆ (Career Mode, Soccer Manager, Championship Manager lineage)

สถานะ: **Draft v1.4 — sync ก.ค. 2026 (§27–§28)**  
หมายเหตุ: รายการนี้คือ **แคตตาล็อกระบบ** — ส่วนที่ ship แล้วดูเฟส §24 + sync §27–§28 · ส่วน blueprint ยังเป็นเป้าหมายระยะยาว

### หลักการโลกเกม (ล็อกแล้ว)

- ลีก **20 ทีม**
- ผู้เล่นคุม **1 ทีม** (`human`)
- อีก **19 ทีมเป็น AI** (`ai`) — แข่ง, มีสควอด, อัปเดตตารางร่วมกัน
- ทุก matchday จำลอง **ทุกนัดของวัน** ไม่ใช่แค่นัดของผู้เล่น

แรงบันดาลใจสั้นๆ

| แหล่ง | สิ่งที่ดึงมา |
|--------|-------------|
| FM26 | Dual formation IP/OOP, Portal, Recruitment hub, Data Hub, Visualiser, Team instructions ตามเฟส |
| FM ทั่วไป | Dynamics, Club Vision, Medical, Scouting knowledge, Set pieces, Opposition instructions |
| EA FC Career | เป้าหมายบอร์ดชัด, growth นักเตะ, โหมดอาชีพผู้จัดการ |
| Soccer Manager / mobile FM-likes | การเงินกระชับ, ลูปเร็ว, UI ที่อ่านง่าย |
| Championship Manager DNA | ข่าว/ซุบซิบ, ความกดดันห้องแต่งตัว, อารมณ์ผู้จัดการ |

---

## 0. แผนที่ระบบ (System Map)

```
Portal/Hub
├── Time & Calendar
├── Club Vision / Board / Fans
├── Squad ↔ Dynamics ↔ Medical
├── Tactics (IP/OOP) ↔ Data Hub ↔ Opposition
├── Match Day ↔ Match Engine
├── Training ↔ Development / Mentoring
├── Recruitment (Scout → Shortlist → Transfer → Contract)
├── Finance / FFP-lite
├── Competitions (League / Cup / Continental / International)
├── Staff / Responsibilities
├── Youth / Newgens / Affiliates
├── Media / Press / Gossip
└── Save / Career Progress
```

---

## 1. Core Loop (วงจรหลัก)

```
Portal → เตรียมทีม → นัดแข่ง → หลังแข่ง → จัดการคลับ → Advance Day
```

| ขั้น | คำอธิบาย |
|------|----------|
| Portal | หน้าบ้านรวมข้อความ, นัดถัดไป, งานด่วน, ข่าว |
| Prepare | สควอด, แท็กติก, ซ้อม, opposition report |
| **พรีแมตช์ hub** (`/match`) | รายงานคู่แข่ง · ฟอร์ม · XI คาดการณ์ · ยืนยัน XI · ทีมทอล์ค · อากาศ/เป่า — แล้วค่อยเตะ |
| Match Day | ชมสด / ผลทันที (หลังเตรียมครบ หรือเตะแบบรีบ) |
| Aftermath | ผล, rating, ตาราง, โมราเล, สื่อ, การเงิน |
| Club Ops | ซื้อขาย, สัญญา, สตาฟ, สิ่งอำนวยความสะดวก |
| Advance | เดินเวลาไปวัน/ถึงนัดถัดไป |

---

## 2. Portal / Inbox System (หน้าบ้านผู้จัดการ) — จาก FM26 Portal

แทน Inbox แบบเก่าด้วย **Portal** เป็นศูนย์กลาง

| โมดูล | รายละเอียด |
|--------|------------|
| Messages | ข้อเสนอ, สัญญา, บอร์ด, สื่อ, สตาฟ |
| Priorities / To-do | งานที่ต้องทำก่อน advance (ต่อสัญญา, เลือก XI) |
| Next Match card | คู่แข่ง, ฟอร์ม, ลิงก์เตรียมนัด |
| News & Gossip | ข่าวลีก, ซุบซิบนักเตะ |
| Bookmarks | ทางลัดไปหน้าที่ใช้บ่อย (แนว FM26) |
| Club pulse | สุขภาพคลับ: อันดับ, งบ, โมราเลสควอด, ความมั่นใจบอร์ด |

---

## 3. Time & Calendar System

| รายการ | รายละเอียด |
|--------|------------|
| หน่วยเวลา | วัน (หลัก) + ตัวเลือก “ไปถึงนัดถัดไป” |
| Season cycle | พรีซีซัน → ฤดูกาล → ปิดตลาดฤดูหนาว → จบฤดูกาล → ออฟซีซัน |
| Fixtures | ลีก, ถ้วย, ทวีป, กระชับมิตร, ทีมชาติ (เรียกตัว) |
| Windows | เปิด–ปิดตลาด, วันลงทะเบียนนักเตะ |
| Payroll days | จ่ายเงินเดือน / โบนัส |
| Holiday / Vacation | ให้ AI คุมช่วงสั้นๆ (เฟสหลัง) |
| International breaks | นักเตะไปทีมชาติ → ความเหนื่อย/เจ็บเพิ่มความเสี่ยง |

---

## 4. Club System + Club Vision (คลับ / วิสัยทัศน์) — จาก FM Club Vision

### 4.1 โปรไฟล์คลับ

| ฟิลด์ | ความหมาย |
|-------|----------|
| Identity | ชื่อ, สี, โลโก้, ฉายา |
| Stadium | ความจุ, สภาพ, บรรยากาศ, รายได้ตั๋ว/พาณิชย์ |
| Reputation | ชื่อเสียงในประเทศ / ทวีป |
| Facilities | ซ้อม, เยาวชน, แพทย์, วิทยาศาสตร์การกีฬา, ข้อมูลวิเคราะห์ |
| Identity / Playing style preference | สไตล์ที่บอร์ดอยากให้เล่น (ครองบอล, โต้กลับ ฯลฯ) |
| Fan base | ขนาดฐานแฟน, ความคาดหวัง, ความจงรัก |

### 4.2 Club Vision / Board

| รายการ | รายละเอียด |
|--------|------------|
| Short-term objectives | อันดับลีก, รอบถ้วย, สไตล์การเล่น |
| Long-term objectives | อัปเกรดสนาม, พัฒนาเยาวชน, พึ่งพาน้อยลงเรื่องซื้อแพง |
| KPIs | งบไม่ติดลบ, ใช้เยาวชน X คน, ไม่แพ้ติด X นัด |
| Board confidence | เกจความมั่นใจ → เตะออกถ้าต่ำนาน |
| Job security / promises | สัญญาที่ให้ไว้ตอนเซ็นงาน |
| Takeover / Investment | กลุ่มทุน 100 · ประเมินเหตุผลขาย/ซื้อ + แฟน/บอร์ด · ไม่ขายเลย |

---

## 5. Squad & Player System

### 5.1 โปรไฟล์นักเตะ

| กลุ่ม | ตัวอย่าง |
|-------|----------|
| Identity | ชื่อ, อายุ, สัญชาติ, เท้าข้างถนัด, ส่วนสูง |
| Positions | ตำแหน่งหลัก/รอง + ความคุ้นเคย (familiarity) |
| Technical / Physical / Mental / GK | แอตทริบิวต์แบบ manager |
| Hidden / Personality | ความมุ่งมั่น, กดดัน, ความมืออาชีพ, ความก้าวร้าว (บางตัวซ่อนจนกว่าจะ scout) |
| Traits / สกิลพิเศษ | พูล 121 สกิล (GK 16 · DF/MF/FW อย่างละ 35) · สูงสุด 10 สล็อตตาม OVR · **Active ในแมตช์คูณตามฟอร์ม** (ร้อนแรงขึ้น / เย็นหลับสกิลอ่อน) · ฝั่ง human·AI·AI vs AI ใช้สูตรเดียวกันผ่าน `xiSkillProfile` |
| Status | Condition, Match sharpness, Injury, Morale, Form, Happiness |
| Playing time | บทบาทในสควอด: Key / Regular / Squad / Prospect |
| Development | Current ability, Potential ability (หรือแถบศักยภาพ) |
| International | สถานะทีมชาติ, caps |

### 5.2 สควอดโครงสร้าง

- First team / Reserves / Youth / Loan list
- Captain, Vice-captain, Penalty / FK / Corner / Throw-in takers (`setPieceTakers`)
- **Squad registration (ship)** — โผลีก + UCL · เบอร์เสื้อ 1–99 · หมุดปฏิทินทุกฤดูกาล · บล็อกเดินวัน/เล่นนัดถ้าไม่ส่ง · **ไม่มีโควตาสัญชาติ/HG** · AI ส่งอัตโนมัติ (`squadRegistration.ts`, `/registration`)
- Squad depth view ตามตำแหน่ง (+ Squad Planner)
- **สไตล์เล่นถนัด** (สูงสุด 3) + ฝึกสไตล์ / คำสั่งฝึก (`playerTacticalRoles.ts`, `styleTraining.ts`)
- **ความดัง / แฟนคลับ / แอนตี้ / แบรนด์พรีเซ็นเตอร์** (`playerFame.ts`)

### 5.3 Player Development & Mentoring

| ระบบ | รายละเอียด |
|------|------------|
| Growth / decline | โตตามอายุ + ซ้อม + เวลาเล่น; แก่แล้วแอตลด |
| Individual training | โฟกัสแอต/บทบาทเฉพาะคน |
| Mentoring groups | นักเตะอาวุโสส่งต่อ personality/traits ให้เด็ก |
| Playing time promises | สัญญาเวลาเล่น → ผิดสัญญา = ไม่มีความสุข |

---

## 6. Dynamics System (ห้องแต่งตัว) — จาก FM Dynamics

| องค์ประกอบ | รายละเอียด | สถานะ |
|------------|------------|--------|
| Hierarchy | Leader / Influential / Squad / Peripheral + คะแนนอิทธิพล | ✅ `/dynamics` แท็บลำดับชั้น |
| Social groups | แกนนำ · ดาวรุ่ง · เกมรุก · ต่างชาติ · ขอบสนาม | ✅ แท็บกลุ่มสังคม |
| Rivalries ในทีม | คู่ขัดแย้ง (ม้านั่งคีย์ / want-away) | ✅ แท็บความขัดแย้ง |
| Team cohesion | ความเข้าขากันของสควอด | ✅ เมตริก + โบนัสแมตช์ |
| Manager trust | ความเชื่อมั่นต่อผู้จัดการ 0–100 | ✅ |
| Dressing room atmosphere | บรรยากาศรวม | ✅ `dressingRoomMood` |

ไฟล์: `dynamics.ts` · UI: `/dynamics` (แท็บภาพรวม/ลำดับชั้น/กลุ่ม/ความขัดแย้ง) + สรุปใน `/data`  
กระทบ: โบนัสแมตช์ (`dynamicsMatchBonus`) · โน้ตห้องแต่งตัว · Data Hub

---

## 7. Medical Centre (แพทย์ / สภาพร่างกาย) — จาก FM Medical

| รายการ | รายละเอียด |
|--------|------------|
| Condition & fatigue | พลังชีวิตวันต่อวัน |
| Match sharpness | คมจากการได้ลงเล่น |
| Injury risk | จากนาทีเล่น, ซ้อมหนัก, สนาม, อายุ |
| Injury types | กล้ามเนื้อ, เอ็น, กระดูก — ระยะพักต่างกัน |
| Body map | แผนที่ร่างกายรายส่วน เขียว/เหลือง/แดง (ทุกสโมสรรวม AI) |
| Illness | ป่วย (หวัด/ไข้/ท้องเสีย/ไวรัส) — ไม่พร้อมลงแข่ง · ติดในห้องแต่งตัวได้ |
| Treatment / recovery | physio, พัก, ฉีดยา (อย่างง่าย) |
| Return timeline | ประมาณวันกลับมาซ้อม/แข่ง |
| Injury history | ประวัติเจ็บ (กระทบมูลค่า/ต่อสัญญา) |

---

## 8. Tactics System — ผสม FM26 Dual Formation

### 8.1 Dual Formation (In / Out of Possession)

| มุมมอง | ความหมาย |
|--------|----------|
| In Possession (IP) | แผนตอนมีบอล — บิลด์อัปถึงเขตสุดท้าย |
| Out of Possession (OOP) | แผนตอนไม่มีบอล — กด/บล็อก |
| Both / Combined | เทียบการสลับรูป + จุดเลือก XI |

### 8.2 Roles

- บทบาทแท็กติกต่อช่อง XI (`slotRoles` / `tacticalRoles.ts`) — สไตล์ถนัดสูงสุด 3 + familiarity
- ความคุ้นเคยบทบาทมีผลต่อ rating / ความผิดพลาด
- Mentality ทีม + pressing / tempo / width / style

### 8.3 Team Instructions ตามเฟส (แนว FM26) — ship lite

เก็บใน `Tactics.phaseInstructions` · แก้ที่ `/tactics` แท็บ **ตามเฟส**:

| เฟส | ตัวเลือก |
|------|----------|
| Build-up | play_out / mixed / long_ball |
| Progression | patient / direct / wing_play |
| Final third | work_ball / shoot / cross |
| Defensive block | high / mid / low |
| Counter-press | เปิด/ปิด |

คำสั่งทีมรวม (mentality, pressing, tempo, width, style) อยู่แท็บ **รูป + คำสั่งทีม**

### 8.4 Set pieces + opposition

- แผนมุม/ฟรีคิก (`SetPiecePlan`) + **ผู้รับผิดชอบ** จุดโทษ/ฟรีคิก/มุม/ทุ่ม (`setPieceTakers`)
- Opposition: กดสูง / มาร์ก / show onto — แท็บ **คู่แข่ง**

### 8.5 Tactical Visualiser (เฟสลึก)

- ยังเป็นเป้าหมายระยะยาว (heatmap / average positions / โซน instruction)
- ตอนนี้มี `FormationLineupBoard` จัด XI + บทบาทบนสนาม

### 8.6 Tactical Familiarity

ทีมต้อง “เรียนรู้” แท็กติก — เปลี่ยนของบ่อย = ความคุ้นเคยตก = เล่นแย่ลงชั่วคราว (`familiarity` บน `Tactics`)

---

## 9. Match Engine & Match Day

### 9.1 โหมดชมเกม + พรีแมตช์
- **ศูนย์พรีแมตช์** (`/match`): เช็คลิสต์ก่อนเตะ — อ่านรายงาน · ยืนยัน XI · ทีมทอล์ค (calm/inspire/focus/trust) · มีโบนัสแมตช์
- แสดงฟอร์ม WDL · XI คาดการณ์คู่แข่ง · คนขาด (เจ็บ/แบน) · อากาศ · ผู้ตัดสิน · ลูกตั้งเตะ
- ปุ่มแถบบน「เตรียมนัด」→ `/match` · พอร์ทัลมีลิงก์「เตรียมนัด →」
- ชมสด / ผลทันที · ข้ามพิธีได้ด้วย「เตะแบบรีบ」

| โหมด | รายละเอียด |
|------|------------|
| Instant result | คำนวณเร็วจากเรตติ้ง+แท็กติก+ฟอร์ม+variance |
| Extended highlights | เหตุการณ์สำคัญ |
| Comprehensive / full sim | ละเอียดขึ้น |
| Interactive | เปลี่ยนแท็กติก, ตัวคน, shout กลางเกม |
| Dynamic highlight density (แนว FM26) | ความถี่ไฮไลต์ตามความเข้มของเกม |

### 9.2 ปัจจัยในเครื่องคำนวณ

- Ability + Form + Morale + Condition + Sharpness ของ XI
- **พลังแฝง (Active)** — `xiSkillProfile` จาก XI ทั้งสองฝั่ง × `formSkillMul` · กระทบ utility พาส/เลี้ยง/ยิง · ความสำเร็จแอ็กชัน · เซฟ GK / จุดโทษ · PPM ใช้ Active skills (ไม่ใช่แค่ Owned)
- **ยิง → ประตู** — ยิงที่ผ่านเช็ค = เข้ากรอบ แล้วแปลงเป็นประตูตาม xG + finishing vs GK (ไม่ใช่ยิงโดนแล้วเข้าทันที)
- **แมตช์เชิงพื้นที่ (Live)** — ซิม snapshot `MatchSpatialFrame` ทุกไฮไลต์ → `LiveMatchPage` / demo อนิเมตบน `MatchPitch` · พิกัดโลกในซิม: เหย้าบุก +y · เยือนพลิก `100−y` ตอนวางตัว (วาดตรงๆ ไม่พลิกซ้ำ)
- ความเข้ากันของบทบาท IP/OOP กับผู้เล่น
- Familiarity แท็กติก
- Home advantage + บรรยากาศสนาม
- **โค้ช / ผู้จัดการ** — `coachMatchModifiers` (Power · Attack/Defend IQ · Man Mgmt · Adapt · สไตล์ถนัด/ไม่ถนัด)
- การแข่งขัน (derby, must-win)
- การปรับของ AI ตามสกอร์/เวลา
- สภาพอากาศ / สนาม (เฟสหลัง)
- Variance (โชคควบคุมได้)
- หมายเหตุ: สูตรสกิลใช้ path เดียวกับทุกคู่ (`simulateLayeredMatch`) — ไม่แยก human พิเศษ

### 9.3 ระหว่างแข่ง (Interactive)

| การกระทำ | ผล |
|----------|-----|
| Change tactics / mentality | ปรับรูป IP หรือ OOP |
| Substitutions | คนใหม่ + บทบาท |
| Shouts | Encourage, Demand more, Calm down ฯลฯ |
| Opposition tweaks | มาร์ค/กดคนที่กำลังครองเกม |

### 9.4 หลังแข่ง

- สกอร์, xG อย่างง่าย, สถิติทีม/คน
- Player ratings + MOM
- การ์ด, บาดเจ็บเกิดใหม่
- อัปเดตตาราง, โมราเล, Dynamics, การเงินตั๋ว
- Post-match press (เฟสหลัง)

---

## 10. Competition System

| ประเภท | รายละเอียด |
|--------|------------|
| Domestic league Div 1 | 20 ทีม · ตารางเต็มฤดูกาล |
| Domestic league Div 2 | ลีกล่าง 20 ทีมต่อประเทศ (`DIV2_CLUB_NAMES`) |
| Promotion / Relegation | ท้ายฤดูกาล **3 ทีมท้าย Div1 ตกชั้น** ↔ **3 ทีมนำ Div2 เลื่อนชั้น** |
| National cup | Knockout top 16 ตาม reputation (รวมทั้งสองดิวิชัน) |
| League Cup | ถ้วยในลีก 32 ทีม (Div1+Div2) — ชื่อตามประเทศ เช่น EFL Cup |
| Lower-league Trophy | ถ้วยลีกล่าง 16 ทีม (เฉพาะ Div2) |
| Continental | UCL league phase → Top 8 → QF/SF/Final (เฉพาะ Div1 + invite) |
| Super Cup / Friendly | พรีซีซัน, การกุศล |
| Nations / International | เรียกตัว, แข่งทีมชาติ (ถ้าเปิดโหมด) |
| Women’s football | **ตัดออกจากแผน** — ไม่ทำโหมดทีมหญิง |
| Rules | โควต้าต่างชาติ, ลิสต์ A/B, VAR อย่างง่าย (ใบ/ล้ำ) |

**ตารางและสถิติลีก:** แข่ง ชนะ เสมอ แพ้ GF GA GD แต้ม อันดับ · หน้า Table แยกแท็บ Div1/Div2 · โซนตกชั้น/เลื่อนชั้น

**ข้อมูล:** `src/data/world/div2Clubs.ts` · ฟอร์แมตถ้วย `leagueCupFormat.json` / `trophyFormat.json` · Save มี `tableDiv2`, `leagueCup`, `trophy`

---

## 11. Recruitment System (ศูนย์รวมตลาด) — จาก FM26 Recruitment Hub

รวม Scout + Shortlist + Transfer + Loan ไว้ที่เดียว

### 11.1 Scouting
- ความรู้เริ่ม **0%** (คนในทีม 100%) · อดีตลูกทีมที่ย้ายออก **พื้น 50%**
- ส่งสเกาต์ / จ้างดูฟอร์มนัดต่อนัด (คะแนน 1–10 แค่นัดนั้น) · หน้า `/scouting` แท็บ **ดูฟอร์ม / แขก**
- **แขกเข้าสนาม** (นัดเหย้า): นักเตะ/โค้ชที่ไม่มีแข่งวันนั้น + คนดัง — มาดูทีม / เช็คฟอร์ม / ส่องนักเตะ
- Fog of knowledge: OVR/PA/attrs ตาม % ความรู้
- **โฟกัสสรรหา + รายงาน** (`assignments` / `reports`) — แท็บโฟกัส · แท็บรายงาน · `runScoutFocusPass` หลังแมตช์เดย์

| รายการ | รายละเอียด | สถานะ |
|--------|------------|--------|
| Scout knowledge | % ความรู้รายคน + alumni floor | ✅ |
| Recruitment focuses | โซน (domestic/europe/…) + ตำแหน่ง + อายุสูงสุด | ✅ lite |
| Scout assignments | โฟกัสสูงสุด 6 รายการ · เปิด/ลบได้ | ✅ |
| Scout reports | verdict sign / monitor / avoid + สรุปไทย | ✅ lite |
| Attribute fog | ค่าที่ยังไม่ชัวร์ตาม % ความรู้ | ✅ |
| Shortlist | รายชื่อติดตาม + heat คู่แข่ง | ✅ (หน้าตลาด) |

### 11.2 Transfer Market

| การกระทำ | รายละเอียด |
|----------|------------|
| Transfer offer | ค่าตัว, ผ่อนชำระ, add-ons, % ขายต่อ |
| Player exchange | แลกนักเตะ |
| Auction / bidding war | แข่งกับคลับอื่น |
| **มูลค่าไดนามิก** | `estimatedValue` คูณตาม **ฟอร์มเฉลี่ยสัปดาห์ (4 MD) + เดือน (12 MD)** + **`marketHeat`** · ฟอร์มร้อนต่อเนื่อง **โก่งค่าตัว** ได้ · อายุ/เจ็บ/สัญญา/listed/wantAway |
| **ค่าเหนื่อย** | ล็อกตามสัญญา — **ไม่**ขยับรายสัปดาห์ตามฟอร์ม · ประเมินใหม่ตอน **ซื้อ / ต่อสัญญา / พรี-คอนแทรกต์ / ข้อขึ้นค่าเหนื่อยตามฤดูกาล** |
| **ค่าเหนื่อยตอนเจรจา** | wageFloor / ask ใช้ฟอร์มเฉลี่ย+heat เฉพาะตอนคุยโต๊ะ |
| **ทวงสัญญา** | นักเตะ/เอเยนต์ที่อยากอยู่ + เหลือ ≤1 ปี → inbox + เปิด `contractTalks` · คุย `new_contract`/`wage_rise` แล้วยอมรับก็เปิดโต๊ะจริง |
| **เอเยนต์ยื่นขาย** | เอเยนต์ (คนเดียวดูได้หลายลูกค้า) มายื่นขายให้ human ตาม wantAway / ความสุข / ทีมในฝัน / listed / สัญญาใกล้หมด · ครอบครัวยื่นยากกว่า · greedy ยื่นบ่อยกว่า (`agentApproach.ts`) |
| **ผู้ช่วยเตือนสัญญา** | เหลือ ≤1 ปี เตือนครั้งแรก · แล้วทุก ~1 เดือน (`CONTRACT_REMIND_INTERVAL_MD`) จนกว่าจะต่อหรือขาย |
| **ปาดหน้า (gazump)** | มีข้อเสนอซื้อค้าง → AI ยื่นสูงกว่าได้ · reject ข้อ human + inbox/Romano + ดัน heat |
| **ทีมในฝัน (`clubAffinity`)** | `dreamClubIds` / `liked` / `avoid` — กระทบต่อสัญญา · รับซื้อ · wantAway · ค่าเหนื่อยย้ายเข้า dream ลด · เปิดเผยตาม scout knowledge |
| **สัญญาใจ (tapping-up)** | ก่อนหน้าต่างบอสแมน: โน้มน้าวให้ `refuseContractRenewal` · เสี่ยงโดนจับ (~18%) → แบนซื้อจากต้นสังกัด · AI ย้อนแท็บได้ · มี handshake แล้ว `signPreContract` ง่ายขึ้น |
| TransferRoom-style board (แนว FM26) | กระดานนักเตะที่คลับเปิดขาย/สนใจ |
| Sell-on / release clause | ประโยคสัญญาพิเศษ |
| Agent fee / intermediary | ค่าเอเยนต์ — **เอเยนต์อาชีพชื่อจริง** (Mendes, Pimenta, Barnett…) ผูกดาว · คนทั่วไป = **พ่อ/แม่ครอบครัว** · ครอบครัวคิดค่าเอเยนต์ถูกกว่า |

`marketHeat` (0–20): ดันจาก shortlist คู่แข่ง · ฟอร์มร้อน · listed/wantAway · คลายหลังแมตช์เดย์ (`tickMarketHeatAndGazumps`)

`formHistory` + โมดูล `contractLifecycle.ts` (ค่าตัว rolling · ทวงสัญญา · ผู้ช่วยเตือน) · ต่อกับ `transferAdvanced.ts` (Bosman / pre-contract)

### 11.3 Loans

- ยืมธรรมดา / ยืมมีออปชันซื้อ / บังคับซื้อ
- Obligation, recall, ไม่ให้ลงแข่งกับต้นสังกัด
- Loan to develop (ส่งเด็กไปโต)

### 11.4 Contracts & Agents

| รายการ | รายละเอียด |
|--------|------------|
| Wage, bonuses | ลงเล่น, ประตู, คลีนชีต, โบนัสแชมป์ — **ค่าเหนื่อยฐานเปลี่ยนตอนเซ็น/ต่อเท่านั้น** |
| Contract length | ปีสัญญา, สัญญาขยายอัตโนมัติ |
| Release clause / minimum fee | |
| Squad role promise | Key player ฯลฯ |
| Negotiation stages | รอบ 1…N ตามนิสัยเอเยนต์+personality · จุดติด: ค่าเหนื่อย / ปี / เงินเซ็น / โบนัสนัด·ประตู · **ยกเลิกได้** (`cancelled`) · ครบรอบแล้วยังไม่ตกลง = `walked` |
| Unhappy / transfer request | |
| **ความภักดีต่อสโมสร (`clubLoyalty` 1–20)** | ขึ้นจากลงเล่น/ชนะ/ความสุข · ลงจากม้านั่งคีย์·อยากย้าย·ambition · กระทบต่อสัญญา · wantAway · เอเยนต์ยื่นขาย · ค่าเหนื่อยต่อสัญญา · ย้ายทีมแล้วรีเซ็ต |
| Renew / release / mutual termination | |
| ทวงสัญญา + ผู้ช่วยเตือน | ดู §11.2 · `contractLifecycle.ts` |

### 11.5 Squad Planner

- ช่องว่างความลึกตามตำแหน่ง
- สัญญาใกล้หมด (< 12 เดือนไฮไลต์)
- แผนอายุสควอด (aging curve)
- Immediate needs จากบอร์ด/แท็กติก

---

## 12. Finance & Fair Play Lite

### รายรับ (ship แล้วบางส่วน)
- **ตั๋วเข้าสนาม** นัดเหย้า → เข้าบัญชีสโมสร (สเกลความจุ × ชื่อเสียง × มู้ดแฟน × ผลแข่ง)
- **ขายเสื้อ** นัดเหย้า → เข้าบัญชีสโมสร (อัตราขายผันตามผล/ชื่อเสียง)
- ของที่ระลึกอื่นๆ / สปอนเซอร์ / TV — เฟสถัดไป
- ขายนักเตะ

### กระเป๋านักเตะ
- `Player.cash` — ได้ค่าเหนื่อยทุกแมตช์เดย์ (คลับหัก → นักเตะได้)
- DB `playerSpendings.json` (~38 รายการ): เกียร์ / หรู / ครอบครัว / อบายมุข / การกุศล / ลงทุน
- จำลองใช้เงินตาม professionalism / ambition / เงินในกระเป๋า · กระทบโมราเล/ความฟิต
- หน้า **การเงิน**: สมุดบัญชีสนาม + ล็อกการใช้จ่าย

### รายจ่าย
- เงินเดือนนักเตะ/สตาฟ, โบนัส
- ค่าซื้อ + ค่าเอเยนต์
- สนาม, สิ่งอำนวยความสะดวก, เยาวชน
- ค่าปรับสหพันธ์ / ค่าชดเชย

### เครื่องมือผู้จัดการ
- Balance, Transfer budget, Wage budget
- Cashflow forecast
- Budget adjustment ขอเพิ่มจากบอร์ด
- **FFP** — เพดานขาดทุนฤดูกาล (~28% ต้นดุล) · ค่าเหนื่อย vs งบสัปดาห์ · **ซื้อสุทธิ** (จ่ายซื้อ − รับขาย) vs เพดานที่ขยายตามรายได้ · ฝ่าเพดานหนัก = บอร์ดระงับตลาด 3 MD · บล็อกดีลซื้อในตลาด
- แยกงบซื้อกับงบเดือน (board ล็อกได้)

---

## 13. Training System

| โมดูล | รายละเอียด |
|--------|------------|
| Team schedule | ปฏิทินซ้อมรายสัปดาห์ (ก่อนแข่ง / ฟื้นตัว) |
| Session types | แท็กติก, ฟิตเนส, เซ็ตพีซ, การแข่งขันภายใน |
| Intensity | ส่งผลต่อ growth vs injury risk |
| Individual focus | แอต/บทบาทรายคน |
| Rest & recovery | ลดความเสี่ยงเจ็บ |
| Pre-match training | เน้น opposition / set piece |
| Shadow / opposition training | ซ้อมตามรูปคู่แข่ง (เฟสหลัง) |
| Coach assignment | โค้ชคนไหนสอนหน่วยไหน |

---

## 14. Data Hub / Analytics — จาก FM Data Hub

ศูนย์วิเคราะห์เชื่อมกับแท็กติกและสเกาต์

| รายงาน | ตัวอย่าง |
|--------|----------|
| Team performance | xG, การครองบอล, กด, โซนยิง |
| Player performance | Rating, minutes, key actions ตามบทบาท |
| Tactical trends | รูปที่ใช้บ่อย, จุดอ่อนที่โดนจับได้ |
| Opposition patterns | รูปที่เจอ, จุดทำประตูของคู่แข่ง |
| Recruitment data | เปรียบเทียบเป้าหมายกับสควอดปัจจุบัน |
| Season run-in | นัดเหลือ, ความเหนื่อย, ความเสี่ยงเจ็บ |

ลิงก์ตรงจากหน้า Team Instructions → Data Hub (แนว FM26)

---

## 15. Staff System & Responsibilities

### 15.1 ที่ปรึกษาแผน / โค้ชโลก (`WorldCoach`)

พูลโค้ชชื่อจริงใน `src/data/worldCoaches.json` (~100 คน) · ผูกกับ `Club.coachId` หรือสมาคมทีมชาติ  
หน้า `/staff` (จ้าง/ตลาด) + แท็บโค้ชใน `/browse` (อ่านอย่างเดียว)

| ค่า (สเกล **1–100**) | ใช้ทำอะไร |
|----------------------|-----------|
| **Power** | บูสต์โจมตี/รับในแมตช์ · ค่าจ้าง/ค่าเหนื่อย · จับคู่คลับตามชื่อเสียง · มาตรฐานจ้างทีมชาติ (FIFA tier) · โบนัสที่ปรึกษาใต้ผู้จัดการ |
| **Attacking IQ** | คูณพลังโจมตีใน `coachMatchModifiers` |
| **Defending IQ** | คูณพลังรับในแมตช์ |
| **Man Management** | บูสต์รวมโจมตี+รับเล็กน้อย (ห้องแต่งตัว) · ที่ปรึกษาแผนช่วยเพิ่มได้อีกนิด |
| **Adaptability** | เจอแผนที่ไม่ถนัด → โทษเบาลงถ้า Adapt สูง · โค้ชทีมชาติ Adapt ต่ำ+ฟอร์มแย่ → โอกาสลาออกสูงขึ้น |

อื่น ๆ ต่อโค้ช: สไตล์ / แผน IP·OOP / strongVs·weakVs / ค่าจ้าง·hireFee / tier / ประวัติงาน (`coachCareers.json`)

ผู้จัดการมนุษย์มีชุดสถิติเดียวกัน (derive จากแอต 1–20 ใน `managerProfile`) แล้วส่งเข้าแมตช์ผ่าน `humanCtx`

### 15.2 สตาฟหลังบ้าน (`StaffPerson`)

| ตำแหน่ง | หน้าที่หลัก |
|---------|-------------|
| Coach (slot สโมสร) | คุณภาพซ้อม · ความคม — **1 คนต่อสโมสร** (จ้างใหม่ปล่อยคนเดิม) |
| Scout | ความรู้ตลาด · PA / fog |
| Physio | ฟื้นจากบาดเจ็บ |
| (เป้าหมายระยะยาว) Assistant / Analyst / DoF / Youth / Loan | ยังเป็น blueprint — ยังไม่ครบทุกบทบาท FM |

พูล ~200 คนในเซฟ · JSON เก็บแค่ชื่อ · สกิล/บุคลิกสุ่มตอนสร้างโลก · อดีตนักเตะ→สตาฟได้  
UI: `/staff` แท็บ **ทีมงาน / ตลาด** + แท็บสตาฟใน `/browse`

### 15.3 Responsibilities (มอบหมายงาน) ✅

แท็บ **มอบหมายงาน** ที่ `/staff` · โมดูล `staffResponsibilities.ts` · รันหลังแมตช์เดย์

| งาน | ผู้รับได้ | พฤติกรรมอัตโนมัติ |
|------|-----------|-------------------|
| แผนซ้อม | manager / assistant / coach / none | โน้ตดูแลซ้อม |
| รายงานคู่แข่ง | assistant… | สรุป formation + advice ก่อนนัด |
| เตือน/ต่อสัญญา | manager / assistant… | เตือนใกล้หมด · ผู้ช่วยระดับสูงต่อคีย์อัตโนมัติได้ |
| สั่งดูฟอร์ม | scout… | `assignFormWatch` เมื่องบพอ |
| แนะนำเซ็ตพีซ | assistant… | ตั้ง `setPieceTakers` ถ้ายังว่าง |
| เตรียมแถลงข่าว | manager / assistant… | โน้ตเตรียมประเด็น |

ยังเป็น blueprint: บทบาท DoF / Analyst / Youth / Loan manager แยก slot เต็มแบบ FM

---

## 16. Youth, Newgens & Affiliates

| ระบบ | รายละเอียด |
|------|------------|
| Youth intake | เยาวชนเกิดเป็นรอบฤดูกาล (newgens) |
| Academy level | สิ่งอำนวยความสะดวกเยาวชน → คุณภาพ/ปริมาณ |
| Youth facilities | `FacilityKind: 'youth'` · เสนอเจ้าของ · ซิงก์ `academyLevel = min(20, youthTier×2)` |
| Promote / demote | เลื่อนชั้นทีม |
| Personality inheritance | จาก mentoring + สุ่ม |
| Affiliates / feeder clubs | 1–2 feeder · level 1–5 · โบนัส OVR/PA ตอน intake · เสริมความสัมพันธ์ด้วยเงินคลับ |
| B team | ทีมสำรองแข่งลีกล่าง (ถ้าระบบลีกซัพพอร์ต) |

---

## 17. Media, Press & Reputation

| ระบบ | รายละเอียด |
|------|------------|
| News feed | ผลแข่ง, ตลาด — หน้า `/media` แท็บข่าว |
| Club social | ทุกสโมสรมี `handle` / followers / engagement / brand |
| Player social | ทุกนักเตะมี `handle` / followers / heat / verified |
| Social feed | โพสต์แฟน / สตอรี่นักเตะ / ทอล์คโชว์ หลังแมตช์เดย์ |
| Romano | ข่าวหลังบ้าน + reliability % · **จ้างปล่อยข่าว** (90 วัน/ครั้ง, แพง, มีโอกาสเปิดโปง) · AI ทำได้ |
| Gossip (Portal) | บรรทัด Romano ล่าสุดบนพอร์ทัล |
| Press conferences | หลังนัดมนุษย์ — 3 คำถามบนพอร์ทัล (ผลงาน / XI / ตลาด) |
| Manager reputation | 0–100 · กระทบตลาดเล็กน้อย + แถลงข่าว |
| Player media handling | 1–20 · ลด leak / ผ่อนผลกระทบแถลงข่าว |
| Social growth | ชนะ/แพ้ + **เรตติ้งรายคน** ขยับ followers/heat · ด่า/ชม/ตัดพ้อที่ `/media` + Squad |

---

## 18. Career / Job Market (อาชีพผู้จัดการ)

| รายการ | รายละเอียด |
|--------|------------|
| Start modes | ว่างงานสมัครงาน / เริ่มกับคลับที่เลือก / สร้างผู้จัดการ |
| Job applications | สมัครเมื่อบอร์ดเปิดรับ |
| Interviews | คำถามวิสัยทัศน์, สไตล์, งบ |
| Sack / resign | ถูกเตะหรือลาออก |
| Unemployed period | รอข้อเสนอ |
| National team job | คุมทีมชาติได้ (สมาคมจ้าง / `__human__`) · คู่ขนานกับงานคลับผ่าน NT camp + associations |
| Achievements / hall of fame | ถ้วย, สถิติอาชีพ · รางวัลฤดูกาลที่ `/awards` |

---

## 19. Facilities & Infrastructure

| สิ่งก่อสร้าง | ผล |
|-------------|-----|
| Stadium expansion | ความจุ, รายได้, บรรยากาศ |
| Training ground | คุณภาพซ้อม, ลดเจ็บ |
| Youth facilities | newgen ดีขึ้น · เสนอเจ้าของ · ซิงก์ academy level |
| Medical / science | ฟื้นตัว, ความแม่นความเสี่ยง |
| Data / analysis suite | คุณภาพรายงาน Data Hub |
| Corporate facilities | สปอนเซอร์, รายได้พาณิชย์ |

คิวก่อสร้างใช้เวลาหลายเดือน + ค่าใช้จ่าย · **5 ประเภท** (สนาม · ฝึก · แพทย์ · พาณิชย์ · เยาวชน)

### Match weather (เบา) ✅
- `Fixture.weather`: clear / rain / wind / cold / hot
- สุ่มตอน `prepareMatchday` · กระทบโจมตี/รับ + ความเสี่ยงเจ็บ (ฝน/หนาว/ร้อน)
- แสดงบน Portal / หน้าแมตช์

---

## 20. Rules, Integrity & World Simulation (เบาๆ)

| ระบบ | รายละเอียด |
|------|------------|
| AI clubs | ซื้อขาย, แท็กติก, ไล่ผู้จัดการ |
| World reputation shifts | คลับ/นักเตะดังขึ้น–ตก |
| Disciplinary | การ์ดสะสม, แบน, ค่าปรับ |
| Registration deadlines | พ้นกำหนด = ลงแข่งไม่ได้ |
| Financial regulation | FFP-lite |
| Match integrity | ไม่มี online cheating ในเวอร์ชันซิงเกิล |

---

## 21. Save / Progress / Meta

| รายการ | รายละเอียด |
|--------|------------|
| New Game | เลือกโลก/ลีกที่โหลด, สร้างผู้จัดการ, เลือกคลับหรือว่างงาน |
| Save slots | หลายสล็อต + autosave |
| Cloud optional | เฟสหลัง |
| Difficulty / realism toggles | ความโหด AI, ความยาวบาดเจ็บ, attribute masking |
| Tutorial / FMPedia-like glossary | อธิบายศัพท์แท็กติกในเกม |

---

## 22. UI Surfaces (จัดตาม workflow แนว FM26)

| พื้นผิว | ระบบที่อยู่ในนั้น |
|--------|-------------------|
| Portal | ข้อความ, นัดถัดไป, pulse |
| Squad | ผู้เล่น, Medical สรุป, สไตล์/ชื่อเสียง |
| **Dynamics** (`/dynamics`) | ลำดับชั้น · กลุ่ม · ความขัดแย้ง · ความเชื่อมั่น |
| **Registration** (`/registration`) | โผลีก/UCL + เบอร์เสื้อ |
| Tactics (`/tactics`) | แท็บ: รูป+คำสั่ง · ตามเฟส · เซ็ตพีซ · คู่แข่ง · XI board |
| Training | ตารางซ้อม, individual, สไตล์ฝึก |
| Recruitment / Scouting (`/scouting`) | แท็บ: โฟกัสสรรหา · รายงาน · ดูฟอร์ม/แขก |
| Data Hub (`/data`) | แท็บ: ภาพรวม · คู่แข่ง · พงศาวดาร · ไดนามิกส์ |
| Matches | เตรียมนัด, แข่ง, รายงานหลังแข่ง |
| Competitions | ตาราง, ถ้วย, สถิติ |
| Club | Vision, board, facilities, finances, staff (**มอบหมายงาน**) |
| Media | ข่าว / โซเชียล / Romano (`/media`) |
| **ฐานข้อมูล** (`/browse`) | นักเตะ Live/Pack · โค้ชโลก · สตาฟ — ประวัติอาชีพจริง · ตราคลับ · ค่าพลัง |
| Calendar | ปฏิทินฤดูกาล + **หมุดทะเบียนนักเตะ** (`/calendar`) |
| History | ประวัติโลก / ฤดูกาล (`/history`) |
| Career | งาน, โปรไฟล์ผู้จัดการ |
| Settings / Save | เซฟ, ตัวเลือกความจริง |

---

## 23. Data Model ขยาย (เป้าหมายระยะยาว)

```
GameSave
├── Manager (career, reputation, coaching badges)
├── Calendar
├── World
│   ├── Nations / Leagues / Clubs (AI)
│   └── Competitions + Fixtures
├── PlayerClub
│   ├── ClubVision + BoardConfidence
│   ├── Facilities
│   ├── Finances + FFP state
│   ├── Squad + Registration
│   ├── Dynamics
│   ├── Medical states
│   ├── Tactics (IP, OOP, set pieces, familiarity)
│   ├── Training plan
│   ├── Staff + Responsibilities
│   ├── Scouting knowledge + Focuses + Shortlist
│   └── Youth academy + Affiliates
├── DataHub snapshots
├── Portal messages
└── Settings (difficulty, masking)
```

---

## 24. แผนพัฒนาเป็นเฟส (อัปเดต)

### Phase 1 — MVP เล่นจบฤดูกาล ✅
- Time + Advance (+ ไปถึงนัดถัดไป)
- Portal อย่างง่าย (นัดถัดไป + สรุป)
- Club + Squad พื้นฐาน
- Tactics ง่าย: formation เดียว + XI (ยังไม่ต้อง dual)
- Instant Match + Live pitch
- League table + fixtures
- Finance พื้นฐาน
- Save 1 สล็อต
- Transfers + Fan system
- UI: Portal, Squad, Tactics, Match, Table, Finance, Save, Transfers

### Phase 2 — Manager feel ✅
- Dual formation IP/OOP อย่างง่าย
- Team instructions ชุดย่อ (mentality / pressing / tempo / width / style)
- Tactical familiarity
- Transfer + contract พื้นฐาน
- Training + Medical พื้นฐาน
- Morale + Board confidence + playing-time happiness
- Match highlights / event sim
- Opposition report อย่างง่าย
- Squad role (Key / Regular / Squad / Prospect)
- ชื่อนักเตะ/สโมสรภาษาอังกฤษ · ตำแหน่งย่อ ST / SS / CB ฯลฯ
- **ไม่มีโหมดทีมหญิง**

### Phase 3 — FM-depth (lite ที่ ship แล้ว) ✅
- Dynamics (cohesion / hierarchy / dressing room)
- Youth academy + intake newgens
- National Cup (knockout คู่ขนานลีก)
- Staff lite (Coach / Scout / Physio)
- Club Vision KPIs + board
- Press / gossip
- Scout fog (ความรู้บัง PA)
- Data Hub
- FFP-lite
- Set pieces lite
- Save **v3**

### Phase 4 — Player development DB ✅
Data packs ใน `src/data/`:
- attributes / personalities / development / staff / cup / **mentoring**
ระบบ:
- Visible attrs กว้าง (Technical / Mental / Physical / GK)
- Hidden + Growth (`learningRate` ฯลฯ)
- CA / PA + overall derive
- Age curve + mentor (XI อัตโนมัติ + **เมนเทอร์ที่ตั้งเอง**)
- Development tick หลังแมตช์เดย์
- **Individual training focus** ต่อนักเตะ
- **Personality events** (ambition clash, model pro, temper, wonderkid spark)
- **Attribute / growth / hidden masking** ตาม scout knowledge
- หน้า `/development` · Save **v4**

**Roster catalog (pack JSON)** = แม่แบบตอนเริ่มอาชีพ · **Live DB** = `GameSave.players` (สถานะในเซฟ)  
หน้า **`/browse` (ฐานข้อมูล)** — standalone นอก AppShell · ความกว้างเต็มจอ:

- Navbar แท็บ **นักเตะ / โค้ชโลก / สตาฟ** + สลับ Live↔Pack · dropdown มีไอคอน
- ตารางแสดง **ตราคลับ** (`ClubCrest` จาก `crestKey`)
- แท็บ **นักเตะ** — แผงรายละเอียดนำด้วย **ประวัติอาชีพจริง** (IndexedDB) แล้วค่อยสถานะ / attrs / Growth·Hidden / พลังแฝง / ประวัติย้ายในเซฟ · Pack โชว์ Bio + FMInside ด้วย
- แท็บ **โค้ชโลก** — พูล `WorldCoach` + ค่าพลัง 1–100 + งานปัจจุบัน (คลับ / ทีมชาติ / ว่าง)
- แท็บ **สตาฟ** — พูล `StaffPerson` ในเซฟ (โค้ช/สเกาต์/แพทย์ + สถานะทักษะ)

### ประวัติอาชีพจริง (Transfermarkt → IndexedDB) ✅
- ไฟล์ต้นทาง `public/data/realPlayerCareers.json` (~19MB) — **ไม่** `import` เข้า JS bundle
- Runtime: `careerDb.ts` เปิด IndexedDB (`fc-manager-careers`) · ครั้งแรก `fetch` แล้ว bulk put · lookup ตามชื่อ `getCareerByName`
- UI: `PlayerCareerHistory` + หน้า Squad / `/browse` โหลด async ตอนเปิดโปรไฟล์
- เซฟ **ไม่เก็บ** `careerSeasons` / `careerProfile` ก้อนใหญ่ (`ensurePlayerCareerSeeds` ล้างของเก่า) — เบา localStorage
- Pack id ไม่ซ้ำ: `leagueId-clubKey-index-name` · ข้ามชื่อซ้ำในคลับตอน seed (`worldSeed`)

คู่มือ [DATA_IMPORT.md](./DATA_IMPORT.md#นักเตะกับ-db-ตอนนี้ทำยังไง) · Data Hub (`/data`) = วิเคราะห์แมตช์

### พรีซีซันปฏิทิน + ข่าวเปิดอาชีพ ✅
- วันเริ่มบนแถบวันที่ = **หลังบอลโลก** · `preSeasonCalendarStart` = เปิดลีก −26 วัน → **20 ก.ค.** (เปิดลีก 15 ส.ค.)
- `seedOpeningNews` — พาดหัวเปิดเกมทุกอาชีพใหม่ (พอร์ทัล / สื่อ)

### Phase Final — World leagues (ชื่อจริง) ✅
โหลดลีกจริง 20 ทีม/ลีก + นักเตะดาวชื่อจริง + ชื่อ filler ตามภูมิภาค:
- อังกฤษ — Premier League / FA Cup
- สเปน — La Liga / Copa del Rey
- เยอรมัน — Bundesliga / DFB-Pokal
- ฝรั่งเศส — Ligue 1 / Coupe de France
- อิตาลี — Serie A / Coppa Italia
- ไทย — Thai League 1 / FA Cup Thailand

Data: `src/data/world/` · New game เลือกลีก+สโมสร · Save **v5**

### Phase UCL + Full real names ✅
- **ทุกคนในสควอดใช้ชื่อนักเตะจริง** (stars + ธนาคารชื่อต่อลีก + overflow โลก) — ไม่สุ่ม First+Last
- **ถ้วยยุโรป (5 ลีก · ไม่มีไทย)**: โควตาตายตัวจากอันดับจบลีกก่อนหน้า
  - **1–4 → UCL** (20 ทีม · league phase → top 8 → QF/SF/F)
  - **5–6 → Europa League** (play-off → QF/SF/F)
  - **7–8 → Conference League** (play-off → QF/SF/F)
- ซีซันแรกใช้เรียงชื่อเสียงแทนอันดับจบ · จบลีกแล้ว snapshot เข้า `euroAccess`
- หน้า `/competitions` · Save **v6**

### Referees ✅
- พูลกรรมการ **50 คน** (`src/data/referees.json`) — `reputation` (สถานะ Elite/FIFA/Pro) + `strictness` (ผ่อนปรน→เข้มงวดมาก)
- จับสลากต่อนัด (UCL/ถ้วยได้กรรมการชื่อเสียงสูงกว่า) · เข้มงวดกระทบใบเหลือง/แดงในแมตช์
- แสดงก่อนแมตช์ + ในคำบรรยายสด

### Depth + UI polish ✅
- **วินัย**: ใบแดง / สะสมเหลือง 5 ใบ → แบน · กระทบ XI
- **แพทย์**: อายุกระทบวันเจ็บ · คำใบ้แผนรักษา · ฉีดยามีโอกาส setback · แสดงแบนใน Medical
- **สัญญา**: ซื้อพร้อมระยะปี · ต่อสัญญาในตลาด · release clause
- **สถิติแมตช์**: ยิง / เข้ากรอบ / มุม / ฟาล์ว / ใบ / ครองบอล
- **UI**: AppShell จัดกลุ่มเมนู · Panel/StatTile · ฟอนต์ IBM Plex Sans Thai · หน้า Finance/Staff/Medical/Match/Youth/Save หนาขึ้น

### Staff pool 200 + Daily lifestyle ✅
- พูลสตาฟ **200 คน** — JSON เก็บ**แค่ชื่อ**; สถานะ/สกิล/บุคลิก/พลังงานสุ่มตอนสร้างโลก (ไม่ล็อก role ในไฟล์)
- **โค้ชหลัก 1 คนต่อสโมสร** — จ้าง/เลื่อนคนใหม่จะปล่อยคนเดิม · AI สลับบทบาท · อดีตนักเตะ→สตาฟ
- **โค้ชโลก (`WorldCoach`)** — ค่า Power / Attack·Defend IQ / Man Mgmt / Adapt สเกล **1–100** มีผลแมตช์ + งานทีมชาติ (ดู §15.1) · UI ไม่แสดงเป็น `/20`
- ไดอารี่รายวัน ~50 กิจกรรม — **ทั้งนักเตะและสตาฟ** ตาม professionalism/ambition/personality

### Media: ข่าว · โซเชียล · Romano ✅
- `GameSave.media` = news / social / romano · sync กับ `press` เดิม
- **ทุกสโมสร + ทุกนักเตะมีบัญชีโซเชียล** (`Club.social` / `Player.social`) — handle, followers, engagement/brand หรือ heat · **mood + recentPosts**
- **ดราม่าหลังแมตช์** (`socialDrama.ts`): เรตติ้งต่ำ → แฟนด่า/มีม · นักเตะตัดพ้อ/ตอกกลับ/เอเยนต์ PR · เพื่อนป้อง · เรตติ้งสูง/MOM → แฟนชม + โพสฉลอง · กระทบ happiness/heat/followers/ภักดี
- หลังแมตช์เดย์: ชนะ/แพ้ขยับยอดติดตาม · หน้า `/media` แสดงอันดับสโมสร/นักเตะ
- หลังแมตช์เดย์: ข่าวผลแข่ง + โซเชียล burst + Romano วงใน (ดีล / ออก / แพทย์ / บอร์ด / โค้ช)
- ทริกเกอร์ข่าวเพิ่ม: เจ็บ / เยาวชน / แชมป์ถ้วย·UCL / ต่อสัญญา / คู่แข่งใกล้ตาราง
- ดีลตลาด → ข่าว · หน้า `/media` + พอร์ทัล (พาดหัว + โซเชียล + badge ใหม่)
- **แถลงข่าวหลังเกม** บนพอร์ทัล · `managerReputation` · `mediaHandling` นักเตะ
- **จ้าง Romano ข่าวปลอม**: คูลดาวน์ 90 วัน · ค่า ~12M+ ตามชื่อเสียง · โอกาสเปิดโปง ~18%
  - โปรโมทสโมสร / โปรโมทดาว / ใส่ร้ายคู่แข่ง / เหยื่อดีล — กระทบแฟน บอร์ด โมราเล ชื่อเสียง
  - **AI สโมสร** สุ่มจ้างได้เช่นกัน (หลังแมตช์เดย์)

### Scouting 0% + แขกสนาม + ฟอร์มนัดต่อนัด ✅
- ความรู้เริ่ม 0% · อดีตลูกทีมที่ย้ายออกพื้น 50% · OVR ในตลาดถูกหมอก
- จ้างสเกาต์ดูนัด → ฟอร์ม 1–10 แค่นัดนั้น · หน้า `/scouting` + ปุ่มบนแมตช์
- แขกเข้าสนามเหย้า: นักเตะ/โค้ชที่ไม่มีแข่ง + คนดัง — ดูทีม / ฟอร์ม / ส่องนักเตะ (เฉลยคุณภาพ)
- **ศูนย์สรรหา (แท็บ)**: โฟกัสโซน+ตำแหน่ง (`ScoutAssignment`) · ใบรายงาน sign/monitor/avoid · รันหลังแมตช์เดย์ (`runScoutFocusPass`)

### ลงทะเบียนนักเตะลีก / UCL ✅
- `squadRegistration.ts` · หน้า `/registration` · หมุดใน `seasonCalendar.registrationPins`
- ทุกทีมต้องมีโผลีก (+ UCL ถ้าแข่ง) พร้อมเบอร์เสื้อ · เดดไลน์ 1 วันก่อนนัดแรก
- ไม่ส่ง = บล็อกเดินวัน / เล่นแมตช์เดย์ · AI ส่งอัตโนมัติ · **ไม่มีโควตา HG/นอกยุโรป** (ขนาดสควอดสูงสุด 25 สำหรับซื้อเข้า)

### Dynamics ห้องแต่งตัวเต็มหน้า ✅
- `/dynamics` · hierarchy / กลุ่มสังคม / ความขัดแย้ง / managerTrust · โบนัสแมตช์

### Staff Responsibilities ✅
- `/staff` แท็บมอบหมายงาน · `tickStaffResponsibilities` หลังแมตช์เดย์

### แท็กติกตามเฟส + ผู้ยิงเซ็ตพีซ ✅
- `/tactics` แท็บตามเฟส / เซ็ตพีซ / คู่แข่ง · `phaseInstructions` + `setPieceTakers`

### Data Hub แท็บพงศาวดาร ✅
- `/data` · chronicle จาก `matchdayChronicle` + สรุปไดนามิกส์

### สไตล์เล่น · ความดัง · แบรนด์ ✅
- `preferredTacticalRoles` + ฝึกสไตล์ · `playerFame` / fan club / anti / brand deals · `lifeDigest` inbox

### Club gate + player wallets ✅
- นัดเหย้า: ตั๋ว + ขายเสื้อ → บัญชีสโมสร · สมุดบัญชีในหน้าการเงิน
- `Player.cash` จากค่าเหนื่อย · DB `playerSpendings.json` · จำลองใช้เงินหลังแมตช์เดย์
- **ค่าปรับวินัย**: DB `disciplineFines.json` — สุ่มตามหน้างาน (ขาดซ้อม/ผับ/พนัน/ใบแดง…) หักจากกระเป๋านักเตะเข้าคลับ

### ผู้จัดการคุยกับนักเตะ ✅
- หน้า `/meetings`: ประชุมทีม / คุยส่วนตัว (ชม·ติง·สัญญานาที·เตือนวินัย·รับฟัง)
- **100 ประเภทคำขอ** · **~600 บทสนทนา** ใน `src/data/talkDialogs.json`
- **ทีม AI**: นักเตะเรียกคุย + โค้ช AI ตอบอัตโนมัติ

### เจ้าของ · บอร์ด · แฟนบอล ✅
- หน้า `/club-vision` (เมนู **บอร์ด/แฟน**)
- **เจ้าของ**: บุคลิก 6 แบบ · ความสัมพันธ์ · ความอดทน · war chest · ข่าวลือเทคโอเวอร์ · ของบฉีดเงิน
  - **มาดูที่สนาม**: ชมห้องแต่งตัว / ถ่ายรูปแฟน / เดินออกก่อนจบ / แถลงไม่พอใจ / ส่งคำสั่งค้าง
  - ผู้จัดการเชิญมาดูได้จาก Club Vision
- **บอร์ด**: KPI / Club Vision · ความมั่นใจ · **คำขาด** · **ปลดผู้จัดการ**
  - มาดู VIP · แถลงสนับสนุนสาธารณะ · ประชุมฉุกเฉิน · **แช่แข็งตลาด** ชั่วคราว
- **แฟน 5 กลุ่ม**: หัวรุนแรง · ซอฟต์/ครอบครัว · ทั่วไป · คอร์ป · ต่างชาติ/ทัวร์
  - อีเวนต์สนาม: tifo / จุดพลุโดนปรับ · Family Day · ขายเสื้อทัวร์ต่างชาติ
  - เข้าหากลุ่มได้จาก Club Vision (มีค่าใช้จ่าย) · ประท้วง/คว่ำบาตรตั๋ว
  - บันทึกบรรยากาศสนามในหน้า Club Vision

### Holiday / AI คุมช่วงสั้น ✅
- ปุ่ม **พักร้อน 3 MD** ที่แถบบน · AI เลือก XI แล้วจำลองแมตช์เดย์ต่อเนื่อง

### UCL League phase ✅
- 16 ทีมเล่น 6 นัด (MD 4–14) · Top 8 เข้า QF สองนัด · SF · Final

### ลีกอื่นในโลก (เบา) ✅
- `worldPulse` อัปเดตหลังแมตช์เดย์ · แสดงในหน้าถ้วย (ผู้นำลีกอื่น)

### เจรจาสัญญาหลายรอบ + ค่าเอเยนต์ ✅
- ต่อสัญญาหลายรอบตามนิสัยเอเยนต์/นักเตะ · จุดติดค่าเหนื่อย·ปี·โบนัส · เซ็นแล้วหักค่าเอเยนต์+เงินเซ็น · **ยกเลิกโต๊ะได้**เมื่อไม่ลงตัว · ครบรอบแล้วยังไม่ตกลง = walked

### หน้าต่างตลาด (ซัมเมอร์ / วินเทอร์) ✅
- เปิด: MD≤6 (ซัมเมอร์) · MD19–23 (วินเทอร์) · ออฟซีซัน
- ปิดนอกช่วง: ซื้อ/ขาย/เจรจา/ยืมไม่ได้ · แบนเนอร์หน้าตลาด + inbox ตอนเปิดวินเทอร์

### สนาม / สิ่งอำนวยความสะดวก ✅
- **ผู้จัดการเสนอ** ที่หน้าการเงิน (หรือ Youth สำหรับอะคาเดมี่) · **เจ้าของอนุมัติ/ปฏิเสธ** ที่ Club Vision (บอร์ด/แฟน)
- เงินหักจาก **บัญชีสโมสร** เมื่ออนุมัติ (ไม่พอ = อนุมัติไม่ได้ — ของบ war chest / หาเงินก่อน)
- **5 ประเภท**: สนาม · ศูนย์ฝึก · การแพทย์ · โซนพาณิชย์ · **อะคาเดมี่เยาวชน** (ทีละโครงการ)
- สนาม **Lv.n ≈ n×10,000 ที่นั่ง** (Lv.10 = 100,000) · แสดงเป็น `7/10` = ~70k จากเพดานคลับ
- **เพดานตามขนาดทีม** (ชื่อเสียง + ดิวิชัน) — ทีมเล็กอาจหยุดที่ 6–7 · บิ๊กคลับถึง 10
- Youth: เสร็จแล้ว bump `youthTier` + ซิงก์ `academyLevel = min(20, youthTier×2)` · seed จาก academy
- เจ้าของประหยัดอนุมัติยาก · ทะเยอทะยาน/รักถิ่นชอบขยายสนามมากกว่า
- ผล: ความจุตั๋ว · ฝึก/แพทย์ช่วยทีม · พาณิชย์คูณรายได้ · เยาวชน intake · แฟนซอฟต์/ต่างชาติ/คอร์ปตอบสนอง

### Affiliates / feeder (เบา) ✅
- 1–2 สโมสรพันธมิตร · level 1–5 · โบนัส youth intake
- ปุ่มเสริมความสัมพันธ์ (หักเงินคลับโดยตรง)

### Match weather (เบา) ✅
- สภาพอากาศต่อนัด · กระทบเรตติ้ง + เจ็บเล็กน้อย · UI บน Portal/Match

### Player Depth Pack ✅
- **Transfer clauses**: appearance / goals / assists / clean sheets milestones · sell-on % · เลื่อนชั้น · แชมป์ลีก · โซนยุโรป
- **โบนัสนักเตะ**: เงินเซ็นสัญญา · ต่อนัด · ต่อประตู · ต่อแอสซิสต์ · ต่อคลีนชีต (GK/DF)
- **เอเยนต์**: บุคลิก greedy/loyal/aggressive/balanced กระทบต่อสัญญาและค่าเหนื่อย
- **ตลาด**: แลกตัว · กดเงื่อนไขซื้อขาด · shortlist มีคู่แข่งกดดัน **heat + ปาดหน้าจริง** (ไม่ใช่แค่ inbox)
- **ค่าตัว/เจรจา**: ฟอร์ม + `marketHeat` ใน `estimatedValue` · ค่าเหนื่อยขอตอนเจรจาตามฟอร์ม
- **พัฒนา**: mentor ส่งต่อ growth/บุคลิก · โฟกัสซ้อมเข้า/ไม่เข้าตำแหน่ง · `trainingFacilityBonus`
- **ไลฟ์สไตล์**: คำสั่งเคอร์ฟิว/ยิม/พัก/เงียบสื่อ + ไดอารี่บนหน้า Squad

### ตลาดงานผู้จัดการ ✅
- ถูกปลด → ว่างงาน + สุ่มข้อเสนองานจากคลับ AI (ตามชื่อเสียงผู้จัดการ)
- รับงาน → สลับ `humanClubId` · บอร์ด/เจ้าของ/แฟนใหม่ · คลับเก่าเป็น AI
- UI: Club Vision (หน้าว่างงาน) + แบนเนอร์พอร์ทัล · รีเฟรชข้อเสนอระหว่างว่างงาน

### ลูปฤดูกาลใหม่ / ออฟซีซัน ✅
- เมื่อลีกครบทุกนัด → `seasonComplete` · ปุ่ม **เริ่มฤดูกาลใหม่** (Portal / แถบบน / แมตช์)
- `startNextSeason`: ปี +1 · อายุนักเตะ +1 · รีเซ็ตตาราง/ถ้วย/UCL invite · คืนยืมตัว
- สัญญาหมด → ต่ออัตโนมัติ 1 ปี (หรือเลิกเล่นถ้าแก่และคุณภาพต่ำ)
- รีเซ็ต KPI เยาวชน/อันดับ · takeover cadence ปีใหม่ · แชมป์ลีกทีมคุณได้โบนัส

### ตลาดเทคโอเวอร์ ✅
- กลุ่มทุน **100** กลุ่ม (`src/data/investorGroups.json`) — สไตล์ต่างกัน (PE, แฟนโอนเนอร์, ทุนพลังงาน, รักถิ่น ฯลฯ)
- **จังหวะ**: ปีละไม่เกิน 1 รอบ (หน้าต่างกลางฤดูกาล / ปลายฤดูกาล) · หลังเข้ามาแล้วสุ่มรอรอบถัดไป **1 / 2 / 3 ปี**
- **ย่ำแย่ 2–3 ปีติด**: ปลายฤดูกาลนับปีที่พลาดเป้า/ติดครึ่งล่าง+หนี้/แฟนโกรธ → โอกาสทุนเข้าสูงขึ้น + เจ้าของอยากขายมากขึ้น
- คะแนนแยก: **เจ้าของจะขายไหม** · **ทุนจะซื้อไหม** · **แฟน** · **บอร์ด** — ไม่ใช่ขายเลย
- ผู้จัดการให้คำแนะนำได้ แต่ปิดดีลต้องผ่านเกณฑ์สองฝ่าย + สุ่มเจรจา
- รับดีลแล้ว: เปลี่ยนเจ้าของ · ฉีดเงิน · มู้ดแฟนตามสไตล์ทุน · คูลดาวน์/เลื่อนรอบถัดไป

### Expansion pack ✅
- **ยืมตัว** (`loans.ts`): ยืมเข้า/ออก · ออปชันซื้อ · เรียกกลับ · AI ยืมกัน · จบนับถอยหลัง
- **รายได้**: สปอนเซอร์ + TV รายแมตช์เดย์ · เงินรางวัลถ้วย/UCL/UEL/UECL (แชมป์·รอง·QF/SF จาก `prizeMoney.json`) · พยากรณ์กระแสเงิน 6 MD
- **FFP**: ขาดทุน · ค่าเหนื่อย · ซื้อสุทธิ — บล็อกซื้อ + ระงับตลาดเมื่อฝ่าเพดาน
- **Press**: 5 คำถามสุ่มจากพูล (ผลเกม·XI·ตลาด·ดาร์บี้·เจ็บ·ห้องแต่งตัว·งบ)
- **Shortlist** + เจรจาโต้กลับ / แลกตัว / ประมูลขาย
- **UCL QF/SF สองนัด** (aggregate) · ตลาดข้ามลีกผ่านคลับเชิญ `originLeagueId`
- **OOP + opposition instructions** มีผลใน match engine
- **IndexedDB** + localStorage สำรอง (`idbSave.ts`)

### นอกแผน (ตัดออก)
- Women’s football mode — **ไม่ทำ**
---

## 25. นอกขอบเขต (โดยเจตนา)

- มัลติเพลเยอร์ / eSports ladder
- กราฟิกแมตช์ 3D ระดับ FM/FIFA เต็มรูปแบบ (ใช้ 2D/ไฮไลต์/อินสแตนต์ก่อน)
- ฐานข้อมูลลิขสิทธิ์ลีก/นักเตะจริง (ใช้ชื่อสมมติหรือ data ปลอมจนกว่าจะมีสิทธิ์) — *หมายเหตุ: เกมใช้ชื่อจริงใน pack แล้ว แต่เอกสารลิขสิทธิ์ยังถือเป็นข้อควรระวัง*
- Editor โลกแบบเต็ม (เพิ่มทีหลังถ้าต้องการ)
- Mobile native แยกแอป (เริ่มเว็บก่อน)

---

## 26. หลักการออกแบบของเรา (ไม่ให้กลายเป็นโคลน FM)

1. **แคตตาล็อกครบ แต่ ship เป็นชั้น** — ระบบลึกเปิดทีหลังได้โดยไม่รื้อ save ถ้าออกแบบ schema ดีตั้งแต่ต้น  
2. **Portal-first** — ผู้เล่นไม่หลงเมนู  
3. **แท็กติกอ่านง่าย** — dual formation เป็นเป้าหมาย แต่ MVP ใช้รูปเดียวก่อน  
4. **Fog of knowledge** — สเกาต์มีความหมาย (ไม่โชว์ทุกแอตโลกตั้งแต่วันแรก)  
5. **ผลจากการตัดสินใจ ไม่ใช่เมนูสวยอย่างเดียว** — Dynamics/Medical/Vision ต้องกระทบผลการแข่งจริง  
6. **ความเร็วลูป** — มี Instant + ไปถึงนัดถัดไปเสมอ แม้ระบบลึกขึ้น  

---

## 27. Sync เอกสาร (ก.ค. 2026) — เพิ่มอะไร / ยังไม่เพิ่มอะไร

รอบนี้ sync จากโค้ดจริง + career IndexedDB + UI `/browse` + มิติตลาด (ฟอร์ม/heat/ปาดหน้า)

### ✅ เพิ่มเข้าเอกสารรอบนี้

| หัวข้อ | ที่อัปเดต |
|--------|-----------|
| ค่าพลังโค้ชโลก 1–100 + ผลในแมตช์/ทีมชาติ | §15.1, §9.2, Staff pool phase note |
| หน้า `/browse` ครบ 3 แท็บ + navbar/ไอคอน/ตราคลับ/ความกว้างเต็ม | Phase 4 blurb, §22 |
| ประวัติอาชีพจริง Transfermarkt → IndexedDB (ไม่พอง bundle/เซฟ) | Phase 4 — careerDb |
| พรีซีซันเริ่ม 20 ก.ค. + ข่าวเปิดอาชีพ | Phase note พรีซีซัน |
| ค่าตัวตามฟอร์ม + marketHeat · ค่าเหนื่อยตอนเจรจา · ปาดหน้า | §11.2, Expansion pack |
| งานทีมชาติมีในเกมแล้ว (ไม่ใช่「เฟสหลัง」อย่างเดียว) | §18 |
| ลบข้อความ「International management — นอกแผน」ที่คลาดกับโค้ด | ท้าย §24 |

### ❌ ยังไม่เพิ่มหัวข้อเต็มในเอกสารรอบนี้

มีในโค้ดแล้ว แต่**ยังไม่มีหมวด/หัวข้อละเอียด**ในไฟล์นี้ (ค้าง sync ครั้งหน้า):

| ระบบในโค้ด | ไฟล์หลัก |
|------------|----------|
| รางวัล (TOTW/TOTM, Ballon d'Or, ดาวซัลโว, Golden Shoe/Glove) | `awards.ts`, `/awards` |
| ปรีซีซั่นทัวร์ (รายละเอียดแมตช์อุ่น) | `preSeason.ts`, `/preseason` |
| ซูเปอร์คัพในประเทศ | `superCup.ts` |
| ACL Elite / ACL Two / ASEAN Cup | `asiaAccess.ts` + format JSON |
| FIFA Club World Cup | `clubWorldCup.ts` |
| ฟุตบอลโลก + คัดเลือก | `worldCup.ts` |
| สมาคมฟุตบอล / FIFA ranking / จ้างโค้ชชาติ | `associations.ts` |
| แคมป์ทีมชาติ + หน้าต่าง FIFA | `ntCamp.ts`, `internationalBreaks.ts` |
| ประวัติโลก 10 ปี / หน้า History | `worldHistory.ts`, `/history` |
| วิกฤตสภาพคล่อง / Administration | `insolvency.ts` |
| Want Away เต็มระบบ | `wantAway.ts` |
| คู่อริสโมสร | `rivalries.ts` |
| ภาษาโค้ช↔นักเตะ | `languages.ts` |
| Manager XP / Level / Club Quests | `managerProgress.ts` |
| แอตทริบิวต์ผู้จัดการ 1–20 (รายละเอียด) | `managerProfile.ts` |
| Deadline Day | `transferDeadline.ts` |
| Transfer Intel | `transferIntel.ts` |
| หมอกราคาปล่อยตัว + rapport | `releaseClauseIntel.ts` |
| ผ่อนค่าตัวหลายงวด | `transferPayments.ts` |
| ดีลขั้นสูง (Bosman, buy-back, ROFR, pre-contract) | `transferAdvanced.ts`, `transferExtras.ts` |
| ทีมในฝัน + สัญญาใจ (tapping-up) | `playerAmbition.ts` |
| ฟอร์มย้อนหลังค่าตัว · ทวงสัญญา · ผู้ช่วยเตือนหมดสัญญา | `contractLifecycle.ts` |
| เอเยนต์ชื่อจริง / พ่อแม่ครอบครัว | `famousAgents.json`, `agents.ts` |
| เอเยนต์มายื่นขายลูกค้า (หลายคนต่อเอเยนต์) | `agentApproach.ts` |
| ความภักดีนักเตะต่อสโมสร | `playerLoyalty.ts` |
| ดราม่าโซเชียลหลังแมตช์ (ด่า/ชม/ตัดพ้อ) | `socialDrama.ts` |
| สัมภาษณ์นักเตะหลังเกม | `playerInterview.ts` |
| สื่อท้องถิ่น / ตำนานพากย์ | `mediaOutlets.ts`, `mediaPersonalities.ts` |
| เดินเวลาทีละวัน + ปฏิทินสัปดาห์ | `calendarDay.ts`, `seasonCalendar.ts`, `/calendar` |
| Matchday Report / Chronicle | `matchdayReport.ts` |
| อีเวนต์คลับสุ่ม | `clubEvents.ts` |
| ลีกโลก pack นอก Big-5+ไทย (รายชื่อครบ) | `src/data/world/*` |

### ไม่ทำ / นอกขอบเขต (ยืนยัน)

- Women’s football mode
- มัลติเพลเยอร์ / editor โลกเต็ม / แอปมือถือ native
- MySQL เป็น runtime ของเกม Vite — ใช้ IndexedDB ในเบราว์เซอร์แทน (MySQL ได้ทีหลังเป็น pipeline export)

---

## 28. Sync เอกสาร (ก.ค. 2026 รอบ 2) — FM-depth lite + ทะเบียน

### ✅ เพิ่ม/อัปเดตในเอกสารรอบนี้

| หัวข้อ | ที่อัปเดต |
|--------|-----------|
| ลงทะเบียนลีก/UCL + หมุดปฏิทิน + บล็อกเกต | §5.2, phase note, §22 |
| Dynamics hierarchy/กลุ่ม/ขัดแย้ง/trust + `/dynamics` | §6, §22 |
| Staff Responsibilities แท็บมอบหมาย | §15.3, §22 |
| สเกาต์โฟกัส + รายงานซื้อ/เฝ้า/เลี่ยง | phase Scouting, §22 |
| แท็กติกตามเฟส + setPieceTakers | §8.3–8.4 |
| Data Hub แท็บ chronicle/dynamics | §22 |
| สไตล์เล่น · ความดัง/แบรนด์ · ไม่มีโควตา HG | §5.2, phase notes |

### ยัง blueprint / ลึกต่อได้

- Tactical visualiser เต็ม · IP/OOP roles แยกช่อง
- บทบาทสตาฟ DoF / Analyst / Youth / Loan
- โควต้าต่างชาติ (ตัดออกโดยเจตนา — ไม่ทำ HG)
- Relationships เพื่อนรายคู่แบบกราฟเต็ม FM

---

## หมายเหตุ

- รายละเอียดตัวเลขสูตร (match engine weights, wage formulas) ยังไม่ล็อก — จะแตกไฟล์ `docs/FORMULAS.md` ตอนเริ่มโค้ด Phase 1  
- Todo ปฏิบัติการอยู่ที่ [TODO.md](./TODO.md) — ควรซิงค์กับเฟสในข้อ 24
- รายการ「ยังไม่เพิ่มหัวข้อเต็ม」ใน §27 = มีโค้ดแล้ว รอ sync เอกสาร ไม่ได้หมายความว่ายังไม่ ship
- §28 = sync รอบ Dynamics / Responsibilities / Scouting hub / Registration / Tactics phase
