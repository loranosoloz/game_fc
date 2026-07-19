# FC Manager — ระบบเกม (Game Systems)

เอกสารนี้เป็น blueprint ระบบของเกมแบบ Football Club Manager  
ผสมโครงเดิมของเรา + แนวคิดจาก **Football Manager (โดยเฉพาะ FM26)** และเกม manager อื่นๆ (Career Mode, Soccer Manager, Championship Manager lineage)

สถานะ: **Draft v0.3 — MVP code in progress**  
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
| Women’s football (ออปชัน) | ลีกหญิงแยกเซฟหรือโหมด (แนว FM26) |
| Rules | โควต้าต่างชาติ, ลิสต์ A/B, VAR อย่างง่าย (ใบ/ล้ำ) |

**ตารางและสถิติลีก:** แข่ง ชนะ เสมอ แพ้ GF GA GD แต้ม อันดับ + top scorer / assist

---

## 11. Recruitment System (ศูนย์รวมตลาด) — จาก FM26 Recruitment Hub

รวม Scout + Shortlist + Transfer + Loan ไว้ที่เดียว

### 11.1 Scouting

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

### รายรับ
- ตั๋ว, ของที่ระลึก, สปอนเซอร์เสื้อ/สนาม
- เงินรางวัลลีก/ถ้วย/ทวีป
- ขายนักเตะ, TV money (อย่างง่าย)

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
| News feed | ผลแข่ง, ตลาด, ดราม่า |
| Gossip | นักเตะอยากย้าย, คลับสนใจ |
| Press conferences | ตอบคำถามก่อน/หลังแข่ง — กระทบโมราเล/บอร์ด |
| Manager reputation | มีผลต่องานใหม่, การดึงนักเตะ |
| Player media handling | บางคนชอบ/เกลียดสื่อ |
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
| Media | ข่าว, press |
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

### Phase 1 — MVP เล่นจบฤดูกาล
- Time + Advance (+ ไปถึงนัดถัดไป)
- Portal อย่างง่าย (นัดถัดไป + สรุป)
- Club + Squad พื้นฐาน
- Tactics ง่าย: formation เดียว + XI (ยังไม่ต้อง dual)
- Instant Match
- League table + fixtures
- Finance พื้นฐาน
- Save 1 สล็อต
- UI: Portal, Squad, Tactics, Match, Table, Finance, Save

### Phase 2 — Manager feel
- Dual formation IP/OOP อย่างง่าย
- Team instructions ชุดย่อ
- Transfer + contract พื้นฐาน
- Training + Medical พื้นฐาน
- Morale + Board confidence
- Match highlights / event sim
- Opposition report อย่างง่าย
- Squad role + playing time happiness

### Phase 3 — FM-depth (คัดจากแคตตาล็อก)
- Dynamics เต็มรูป
- Recruitment hub + scouting knowledge + focuses
- Data Hub
- Set pieces + opposition instructions
- Staff + responsibilities
- Youth / newgens / affiliates
- Club Vision KPIs + facilities upgrades
- Press / media
- FFP-lite
- Tactical visualiser
- Interactive match + shouts
- Cups + continental
- Career job market

### Phase 4 — World & polish (ออปชัน)
- International management
- Women’s football mode
- TransferRoom-style marketplace board
- Vacation AI
- Glossary ในเกม
- Difficulty / realism toggles ละเอียด
- B team / multi-league registration ซับซ้อน

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
