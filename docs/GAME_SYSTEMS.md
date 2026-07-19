# FC Manager — ระบบเกม (Game Systems)

เอกสารนี้เป็น blueprint ระบบของเกมแบบ Football Club Manager  
ผสมโครงเดิมของเรา + แนวคิดจาก **Football Manager (โดยเฉพาะ FM26)** และเกม manager อื่นๆ (Career Mode, Soccer Manager, Championship Manager lineage)

สถานะ: **Draft v1.0 — Phase Final world leagues**  
หมายเหตุ: รายการนี้คือ **แคตตาล็อกระบบที่อยากมีครบ** ไม่ใช่สิ่งที่ทำใน MVP พร้อมกัน — ดูเฟสท้ายเอกสาร

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
| Match Day | อุ่นเครื่อง, XI, shout, ชม/จำลอง |
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
| Takeover / Investment (เฟสหลัง) | เจ้าของใหม่, งบพุ่ง/ล่ม |

---

## 5. Squad & Player System

### 5.1 โปรไฟล์นักเตะ

| กลุ่ม | ตัวอย่าง |
|-------|----------|
| Identity | ชื่อ, อายุ, สัญชาติ, เท้าข้างถนัด, ส่วนสูง |
| Positions | ตำแหน่งหลัก/รอง + ความคุ้นเคย (familiarity) |
| Technical / Physical / Mental / GK | แอตทริบิวต์แบบ manager |
| Hidden / Personality | ความมุ่งมั่น, กดดัน, ความมืออาชีพ, ความก้าวร้าว (บางตัวซ่อนจนกว่าจะ scout) |
| Traits | เช่น Places Shots, Gets Forward |
| Status | Condition, Match sharpness, Injury, Morale, Form, Happiness |
| Playing time | บทบาทในสควอด: Key / Regular / Squad / Prospect |
| Development | Current ability, Potential ability (หรือแถบศักยภาพ) |
| International | สถานะทีมชาติ, caps |

### 5.2 สควอดโครงสร้าง

- First team / Reserves / Youth / Loan list
- Captain, Vice-captain, Penalty / FK / Corner takers
- Squad registration (โควต้าต่างชาติ, ลิสต์แข่งขัน)
- Squad depth view ตามตำแหน่ง (+ Squad Planner)

### 5.3 Player Development & Mentoring

| ระบบ | รายละเอียด |
|------|------------|
| Growth / decline | โตตามอายุ + ซ้อม + เวลาเล่น; แก่แล้วแอตลด |
| Individual training | โฟกัสแอต/บทบาทเฉพาะคน |
| Mentoring groups | นักเตะอาวุโสส่งต่อ personality/traits ให้เด็ก |
| Playing time promises | สัญญาเวลาเล่น → ผิดสัญญา = ไม่มีความสุข |

---

## 6. Dynamics System (ห้องแต่งตัว) — จาก FM Dynamics

| องค์ประกอบ | รายละเอียด |
|------------|------------|
| Hierarchy | Leader / Influential / Peripheral |
| Relationships | เพื่อน, คู่แข่ง, ไม่ถูกกัน |
| Team cohesion | ความเข้าขากันของสควอด |
| Social groups | กลุ่มในห้องแต่งตัว |
| Manager relationship | ความเชื่อมั่นต่อผู้จัดการ |
| Dressing room atmosphere | บรรยากาศรวมหลังผลงาน/การตัดสินใจ |

กระทบ: โมราเล, ฟอร์ม, การยอมรับแท็กติก, คำร้องขอขาย/ย้าย

---

## 7. Medical Centre (แพทย์ / สภาพร่างกาย) — จาก FM Medical

| รายการ | รายละเอียด |
|--------|------------|
| Condition & fatigue | พลังชีวิตวันต่อวัน |
| Match sharpness | คมจากการได้ลงเล่น |
| Injury risk | จากนาทีเล่น, ซ้อมหนัก, สนาม, อายุ |
| Injury types | กล้ามเนื้อ, เอ็น, กระดูก — ระยะพักต่างกัน |
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

- บทบาทตอนมีบอล และตอนไม่มีบอลแยกกัน (แนว FM26)
- ความคุ้นเคยบทบาทมีผลต่อ rating / ความผิดพลาด
- Mentality ทีม หรือ risk/tempo แบบสไลเดอร์

### 8.3 Team Instructions ตามเฟส (แนว FM26)

**In Possession**
- Overview
- Buildup (ออกจากหลัง, แจกบอล GK)
- Progression (ผ่านแดนกลาง)
- Final Third (สร้างโอกาส, ยิง, ครอส)

**Out of Possession**
- Overview
- High Press / Mid Block / Low Block
- ไลน์รับ, ความกระชับ, กดหลังเสียบอล (counter-press)

ตัวอย่างพารามิเตอร์: ความกว้าง, จังหวะ (tempo), ความเสี่ยง, ความอดทน, สไตล์ครอส, โต้กลับ vs ตั้งรูป

### 8.4 Tactical Visualiser (เฟสลึก)

แสดงตำแหน่งเฉลี่ย / โซนบนสนามเมื่อเปลี่ยน instruction — ช่วยให้ผู้เล่นเข้าใจรูปทีมโดยไม่ต้องเดา

### 8.5 Set Pieces

| ประเภท | รายละเอียด |
|--------|------------|
| Corners | โซนเป้า, ผู้ชนะลูกกลางอากาศ, ผู้คอยรีบาวด์ |
| Free kicks | ตรง / ด้านข้าง |
| Throw-ins | ยาว/สั้นในเขตอันตราย |
| Penalties | ลำดับผู้ยิง |
| Defensive routines | กันลูกตั้งเตะคู่แข่ง |

### 8.6 Opposition Instructions

- มาร์คคนอันตรายเป็นพิเศษ
- ห้ามให้หมุน/กดเฉพาะคน
- ปรับตาม opposition report

### 8.7 Tactical Familiarity

ทีมต้อง “เรียนรู้” แท็กติก — เปลี่ยนของบ่อย = ความคุ้นเคยตก = เล่นแย่ลงชั่วคราว

---

## 9. Match Engine & Match Day

### 9.1 โหมดชมเกม

| โหมด | รายละเอียด |
|------|------------|
| Instant result | คำนวณเร็วจากเรตติ้ง+แท็กติก+ฟอร์ม+variance |
| Extended highlights | เหตุการณ์สำคัญ |
| Comprehensive / full sim | ละเอียดขึ้น |
| Interactive | เปลี่ยนแท็กติก, ตัวคน, shout กลางเกม |
| Dynamic highlight density (แนว FM26) | ความถี่ไฮไลต์ตามความเข้มของเกม |

### 9.2 ปัจจัยในเครื่องคำนวณ

- Ability + Form + Morale + Condition + Sharpness ของ XI
- ความเข้ากันของบทบาท IP/OOP กับผู้เล่น
- Familiarity แท็กติก
- Home advantage + บรรยากาศสนาม
- การแข่งขัน (derby, must-win)
- การปรับของ AI ตามสกอร์/เวลา
- สภาพอากาศ / สนาม (เฟสหลัง)
- Variance (โชคควบคุมได้)

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
| Domestic league | ตาราง, ขึ้น–ตกชั้น, พลย์ออฟ |
| Domestic cups | Knockout, แบ่งสาย, แข่งสองนัด |
| Continental | กลุ่ม + น็อคเอาต์ (แชมเปียนส์/ยูโรปา-สไตล์) |
| Super Cup / Friendly | พรีซีซัน, การกุศล |
| Nations / International | เรียกตัว, แข่งทีมชาติ (ถ้าเปิดโหมด) |
| Women’s football | **ตัดออกจากแผน** — ไม่ทำโหมดทีมหญิง |
| Rules | โควต้าต่างชาติ, ลิสต์ A/B, VAR อย่างง่าย (ใบ/ล้ำ) |

**ตารางและสถิติลีก:** แข่ง ชนะ เสมอ แพ้ GF GA GD แต้ม อันดับ + top scorer / assist

---

## 11. Recruitment System (ศูนย์รวมตลาด) — จาก FM26 Recruitment Hub

รวม Scout + Shortlist + Transfer + Loan ไว้ที่เดียว

### 11.1 Scouting
- ความรู้เริ่ม **0%** (คนในทีม 100%) · อดีตลูกทีมที่ย้ายออก **พื้น 50%**
- ส่งสเกาต์ / จ้างดูฟอร์มนัดต่อนัด (คะแนน 1–10 แค่นัดนั้น) · หน้า `/scouting`
- **แขกเข้าสนาม** (นัดเหย้า): นักเตะ/โค้ชที่ไม่มีแข่งวันนั้น + คนดัง — มาดูทีม / เช็คฟอร์ม / ส่องนักเตะ
- Fog of knowledge: OVR/PA/attrs ตาม % ความรู้

| รายการ | รายละเอียด |
|--------|------------|
| Scout knowledge | แผนที่ความรู้ประเทศ/ลีก — ไม่รู้ = แอตไม่ชัด |
| Recruitment focuses | หาตำแหน่ง/บทบาท IP–OOP ตามแท็กติกปัจจุบัน |
| Scout assignments | ส่งสเกาต์ไปลีก/หา wonderkid |
| Scout reports | ความเหมาะกับแท็กติก, จุดแข็ง–อ่อน, แนะนำซื้อ/ไม่ซื้อ |
| Attribute fog | ค่าที่ยังไม่ชัวร์แสดงเป็นช่วง |
| Shortlist | รายชื่อติดตาม + แจ้งเตือนเมื่อมีข่าว |

### 11.2 Transfer Market

| การกระทำ | รายละเอียด |
|----------|------------|
| Transfer offer | ค่าตัว, ผ่อนชำระ, add-ons, % ขายต่อ |
| Player exchange | แลกนักเตะ |
| Auction / bidding war | แข่งกับคลับอื่น |
| TransferRoom-style board (แนว FM26) | กระดานนักเตะที่คลับเปิดขาย/สนใจ |
| Sell-on / release clause | ประโยคสัญญาพิเศษ |
| Agent fee / intermediary | ค่าเอเยนต์ |

### 11.3 Loans

- ยืมธรรมดา / ยืมมีออปชันซื้อ / บังคับซื้อ
- Obligation, recall, ไม่ให้ลงแข่งกับต้นสังกัด
- Loan to develop (ส่งเด็กไปโต)

### 11.4 Contracts & Agents

| รายการ | รายละเอียด |
|--------|------------|
| Wage, bonuses | ลงเล่น, ประตู, คลีนชีต, โบนัสแชมป์ |
| Contract length | ปีสัญญา, สัญญาขยายอัตโนมัติ |
| Release clause / minimum fee | |
| Squad role promise | Key player ฯลฯ |
| Negotiation stages | ข้อเสนอ ↔ ปฏิเสธ/ทบ ↔ ตกลง |
| Unhappy / transfer request | |
| Renew / release / mutual termination | |

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
- **FFP-lite / เพดานขาดทุน** — จำกัดขาดทุนสะสมต่อรอบบัญชี
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

| ตำแหน่ง | หน้าที่หลัก |
|---------|-------------|
| Assistant Manager | รายงานทีม, ช่วยแท็กติก, แข่งแทนได้ |
| Coaches | คุณภาพเทรนตามหน่วย |
| Scouts / Chief Scout | ความแม่นรายงาน + ความเร็วความรู้ |
| Analysts | คุณภาพ Data Hub / opposition report |
| Physios / Sports scientists | ฟื้นตัว, ความเสี่ยงเจ็บ |
| Set-piece coach | ประสิทธิภาพลูกตั้งเตะ |
| Director of Football | ช่วยตลาด (delegate) |
| Head of Youth | คุณภาพ intake เยาวชน |
| Loan manager | ติดตามเด็กที่ยืม |

**Responsibilities (มอบหมายงาน)**  
ให้สตาฟทำ: กดต่อสัญญาอัตโนมัติ, จัด reserve, สเกาต์คู่แข่ง, จัด set piece — ผู้เล่นโฟกัสงานใหญ่

---

## 16. Youth, Newgens & Affiliates

| ระบบ | รายละเอียด |
|------|------------|
| Youth intake | เยาวชนเกิดเป็นรอบฤดูกาล (newgens) |
| Academy level | สิ่งอำนวยความสะดวกเยาวชน → คุณภาพ/ปริมาณ |
| Promote / demote | เลื่อนชั้นทีม |
| Personality inheritance | จาก mentoring + สุ่ม |
| Affiliates / feeder clubs | สโมสรพันธมิตรส่งยืม |
| B team | ทีมสำรองแข่งลีกล่าง (ถ้าระบบลีกซัพพอร์ต) |

---

## 17. Media, Press & Reputation

| ระบบ | รายละเอียด |
|------|------------|
| News feed | ผลแข่ง, ตลาด — หน้า `/media` แท็บข่าว |
| Social | โพสต์แฟน / สตอรี่นักเตะ / ทอล์คโชว์ หลังแมตช์เดย์ |
| Romano | ข่าวหลังบ้าน + reliability % · **จ้างปล่อยข่าว** (90 วัน/ครั้ง, แพง, มีโอกาสเปิดโปง) · AI ทำได้ |
| Gossip (Portal) | บรรทัด Romano ล่าสุดบนพอร์ทัล |
| Press conferences | หลังนัดมนุษย์ — 3 คำถามบนพอร์ทัล (ผลงาน / XI / ตลาด) |
| Manager reputation | 0–100 · กระทบตลาดเล็กน้อย + แถลงข่าว |
| Player media handling | 1–20 · ลด leak / ผ่อนผลกระทบแถลงข่าว |
| Social sentiment (อย่างง่าย) | ความพอใจแฟน |

---

## 18. Career / Job Market (อาชีพผู้จัดการ)

| รายการ | รายละเอียด |
|--------|------------|
| Start modes | ว่างงานสมัครงาน / เริ่มกับคลับที่เลือก / สร้างผู้จัดการ |
| Job applications | สมัครเมื่อบอร์ดเปิดรับ |
| Interviews | คำถามวิสัยทัศน์, สไตล์, งบ |
| Sack / resign | ถูกเตะหรือลาออก |
| Unemployed period | รอข้อเสนอ |
| National team job | คุมทีมชาติคู่ขนานหรือเต็มเวลา (เฟสหลัง) |
| Achievements / hall of fame | ถ้วย, สถิติอาชีพ |

---

## 19. Facilities & Infrastructure

| สิ่งก่อสร้าง | ผล |
|-------------|-----|
| Stadium expansion | ความจุ, รายได้, บรรยากาศ |
| Training ground | คุณภาพซ้อม, ลดเจ็บ |
| Youth facilities | newgen ดีขึ้น |
| Medical / science | ฟื้นตัว, ความแม่นความเสี่ยง |
| Data / analysis suite | คุณภาพรายงาน Data Hub |
| Corporate facilities | สปอนเซอร์, รายได้พาณิชย์ |

คิวก่อสร้างใช้เวลาหลายเดือน + ค่าใช้จ่าย

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
| Squad | ผู้เล่น, Dynamics, Medical สรุป |
| Tactics | IP/OOP, roles, instructions, set pieces, visualiser |
| Training | ตารางซ้อม, individual |
| Recruitment | Scout, shortlist, transfers, loans, contracts, planner |
| Data Hub | วิเคราะห์ทีม/คน/คู่แข่ง |
| Matches | เตรียมนัด, แข่ง, รายงานหลังแข่ง |
| Competitions | ตาราง, ถ้วย, สถิติ |
| Club | Vision, board, facilities, finances, staff |
| Media | ข่าว / โซเชียล / Romano (`/media`) |
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
- **UEFA Champions League**: Top 4 ลีกในประเทศ (ทีมผู้เล่นติดเสมอ) + 12 สโมสรเชิญจากลีกอื่น → R16 → QF → SF → Final
- หน้า `/competitions` แสดง UCL + ถ้วยในประเทศ · ไม่มีเสมอใน UCL/ถ้วย · Save **v6** (`fc-manager-save-v6`)

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
- ไดอารี่รายวัน ~50 กิจกรรม — **ทั้งนักเตะและสตาฟ** ตาม professionalism/ambition/personality

### Media: ข่าว · โซเชียล · Romano ✅
- `GameSave.media` = news / social / romano · sync กับ `press` เดิม
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

### Club gate + player wallets ✅
- นัดเหย้า: ตั๋ว + ขายเสื้อ → บัญชีสโมสร · สมุดบัญชีในหน้าการเงิน
- `Player.cash` จากค่าเหนื่อย · DB `playerSpendings.json` · จำลองใช้เงินหลังแมตช์เดย์
- **ค่าปรับวินัย**: DB `disciplineFines.json` — สุ่มตามหน้างาน (ขาดซ้อม/ผับ/พนัน/ใบแดง…) หักจากกระเป๋านักเตะเข้าคลับ

### นอกแผน (ตัดออก)
- Women’s football mode — **ไม่ทำ**
- International management (อาจกลับมาทีหลังถ้าต้องการ)
---

## 25. นอกขอบเขต (โดยเจตนา)

- มัลติเพลเยอร์ / eSports ladder
- กราฟิกแมตช์ 3D ระดับ FM/FIFA เต็มรูปแบบ (ใช้ 2D/ไฮไลต์/อินสแตนต์ก่อน)
- ฐานข้อมูลลิขสิทธิ์ลีก/นักเตะจริง (ใช้ชื่อสมมติหรือ data ปลอมจนกว่าจะมีสิทธิ์)
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

## หมายเหตุ

- รายละเอียดตัวเลขสูตร (match engine weights, wage formulas) ยังไม่ล็อก — จะแตกไฟล์ `docs/FORMULAS.md` ตอนเริ่มโค้ด Phase 1  
- Todo ปฏิบัติการอยู่ที่ [TODO.md](./TODO.md) — ควรซิงค์กับเฟสในข้อ 24
