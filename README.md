# FC Manager

เกม Football Club Manager (เว็บ) — ลีก **20 ทีม**: คุณคุม 1 ทีม ที่เหลือ **19 เป็น AI**

## เล่นทันที

```bash
npm install
npm run dev
```

เปิดเบราว์เซอร์ตาม URL ที่ Vite แสดง (ปกติ `http://localhost:5173`)

## โลกเกม (สำคัญ)

- ลีกเดียว 20 สโมสร
- ผู้เล่น = `controlledBy: 'human'` หนึ่งคลับ
- อีก 19 = `controlledBy: 'ai'`
- ปุ่ม **Play next matchday** จะจำลอง **ทุกนัดของวันนั้น** (นัดคุณ + นัด AI vs AI) แล้วอัปเดตตารางเดียวกัน

## สแต็ก

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Zustand + React Router
- Save ใน `localStorage`

## เอกสาร

- [ระบบเกม](docs/GAME_SYSTEMS.md)
- [Todo → GitHub Issues](https://github.com/loranosoloz/game_fc/issues)

## UI Skills

ติดตั้ง [ibelick/ui-skills](https://github.com/ibelick/ui-skills) ที่ `.agents/skills/`  
ตอนทำ UI: `npx ui-skills start`

Repo: https://github.com/loranosoloz/game_fc
