# FC Manager — Todo List

**ที่ติดตามหลัก: [GitHub Issues](https://github.com/loranosoloz/game_fc/issues)**

กรองตามเฟส:

| เฟส | Label | ลิงก์ |
|------|--------|--------|
| Phase 0 — เตรียมโปรเจกต์ | `phase-0` | [เปิด Issues](https://github.com/loranosoloz/game_fc/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-0) |
| Phase 1 — MVP | `phase-1` | [เปิด Issues](https://github.com/loranosoloz/game_fc/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-1) |
| Phase 2 — Manager feel | `phase-2` | [เปิด Issues](https://github.com/loranosoloz/game_fc/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-2) |
| Phase 3 — FM-depth | `phase-3` | [เปิด Issues](https://github.com/loranosoloz/game_fc/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-3) |
| Phase 4 — polish (ออปชัน) | `phase-4` | [เปิด Issues](https://github.com/loranosoloz/game_fc/issues?q=is%3Aissue+is%3Aopen+label%3Aphase-4) |

ทั้งหมด: [issues?q=label:todo](https://github.com/loranosoloz/game_fc/issues?q=is%3Aissue+label%3Atodo)

อ้างอิงระบบ: [GAME_SYSTEMS.md](./GAME_SYSTEMS.md)

เมื่อทำเสร็จ ให้ **Close issue** บน GitHub (ไม่ต้องติ๊กในไฟล์นี้เป็นหลัก)

---

## ลำดับทำแนะนำ

1. Phase 0 — scaffold + seed (`#1`–`#6`)
2. Time + Portal (`#7`–`#9`)
3. Squad + Tactics (`#10`–`#15`)
4. Instant Match + Table (`#16`–`#20`)
5. Finance + Save (`#21`–`#22`)
6. เกณฑ์จบฤดูกาล (`#23`) → แล้วค่อย Phase 2

---

## สร้าง Issues ซ้ำ (ถ้าจำเป็น)

```bash
node scripts/create-github-todos.mjs
```

ข้อมูลต้นทาง: [`scripts/github-todos.json`](../scripts/github-todos.json)
