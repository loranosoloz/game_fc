# FC Manager — Todo List

| เฟส | สถานะ | Git |
|------|--------|-----|
| Phase 0–4 | ✅ | ✅ committed |
| Phase Final — 6 ลีกโลก + ไทย | ✅ | ✅ committed |
| Full real names + Champions League | ✅ | ✅ committed |
| Referees (50 + strictness) | ✅ | ✅ committed |
| Discipline + Medical + Contracts + Match stats + UI polish | ✅ | ✅ committed |
| Staff pool 200 + daily life + one head coach | ✅ | ✅ committed |
| Media: news + social + Romano (+ press / plant) | ✅ | ✅ committed |
| Scouting 0%/alumni 50% + stadium guests + form watch | ✅ | ✅ committed |
| Gate tickets/shirts + player wallets + spending DB | ✅ | ✅ committed |
| Discipline fines (สุ่มหน้างาน → หัก cash) | ✅ | ✅ committed |

Data packs: `src/data/` + `src/data/world/` · Save **v6**

อ้างอิง: [GAME_SYSTEMS.md](./GAME_SYSTEMS.md)

## Git

- สาขา: `master` · งานชุดล่าสุดอยู่ใน commit ท้องถิ่นแล้ว (working tree สะอาด)
- สถานะกับ remote: **ahead of `origin/master`** — ยังไม่ `git push` จนกว่าจะสั่ง
- คอมมิตที่เกี่ยวข้องโดยตรงกับเฟสล่าสุด: `2fc0062` (media / Romano / scouting / gate+wallets ฯลฯ)

### Todo ฝั่ง Git (ค้าง)

- [ ] `git push origin master` เมื่อพร้อมเผยแพร่ remote
- [ ] (ออปชัน) เปิด GitHub Issues จากรายการด้านล่างถ้าอยาก track นอก repo

## ขยายต่อได้ (ออปชัน)

- หลายลีกในโลกเดียว / ย้ายข้ามลีก
- UCL แบบ league phase / สองนัด
- IndexedDB เมื่อ data ใหญ่ขึ้น
- สปอนเซอร์ / TV money / เงินรางวัลถ้วย (ขยายจาก gate ที่มีแล้ว)
- Press conference ลึกขึ้น / shortlist / loan
