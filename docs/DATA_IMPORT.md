# คู่มือนำเข้านักเตะ · สถานะ · รูป

แหล่งหลัก: **[fminside.net](https://fminside.net)**  
ใช้แสดงผลส่วนตัวเท่านั้น **ห้ามขาย / redistribute**

---

## หลักการ (FMInside เป็นศูนย์กลาง)

| ชั้น | ดึงจากไหน | URL / ไฟล์ |
|------|-----------|------------|
| **สถานะ (attrs 1–99)** | fminside หน้าผู้เล่น | `fminside.net/players/7-fm-26/{fmId}-{slug}` → `fmInsideAttrs.json` |
| **รูปนักเตะ** | FMInside face CDN | `img.fminside.net/facesfm26/{fmId}.png` → `public/players/fmi-{fmId}.png` |
| **ตราทีม** | FMInside logo CDN | `img.fminside.net/logos/Men/Clubs/Normal/{clubId}.png` → `public/crests/{key}.png` |
| **รายชื่อทีม (roster)** | fmtransferupdate *(หา fmId)* | `playersXxx.json` + `*_fm_ids.json` |

Roster ยังใช้ FMTU เพราะหน้าสโมสรจัด squad depth ง่าย — แต่ **fmId ชุดเดียวกับ FMInside**  
ต่อไปถ้าจะรวม roster เข้า FMInside คลับเพจได้ (มี face + ลิงก์ผู้เล่น)

BIO (SortItOutSI) = **ออปชัน** ไม่บังคับ  
Pack: `playerBiosEng.json` (PL+Championship) · `playerBiosEsp/Ger/Fra/Ita.json` · `playerBiosEsp2/Ger2/Fra2/Ita2/Eng2.json` · `playerBiosSau/Tur.json`  
สร้างเพิ่ม: `node scripts/buildLeagueBios.mjs <esp|ger|fra|ita|esp2|ger2|fra2|ita2|eng2|sau|tur|all|div2|extra> --all`  
แมปชื่อ roster ↔ BIO ด้วยชื่อ / accent / **fmId** / หน้า person SI (`--fetch-missing`)  
ลีกรอง: `node scripts/buildLeagueBios.mjs div2 --all`  
ซาอุ+ตุรกี: `node scripts/buildLeagueBios.mjs extra --all`

---

## สถานะใน UI

| แท็ก | ความหมาย |
|------|----------|
| **FM** | มีใน `fmInsideAttrs.json` |
| **PIC** | มีไฟล์รูป (`playerPhotos.json`) |
| **BIO** | มี bio เสริม (optional) |

หน้า **ฐานข้อมูลนักเตะ** แสดง `รูป x/y · FM x/y` ต่อลีก

---

## Pipeline ต่อลีก (สั่งสั้นๆ)

```bash
# 1) roster + fmId
node scripts/buildSpainPack.mjs --download-clubs
node scripts/buildSpainPack.mjs --resolve

# 2) สถานะจาก FMInside
node scripts/buildSpainPack.mjs --fetch-fminside
node scripts/buildFmInsideAttrs.mjs

# 3) รูปจาก FMInside
node scripts/downloadPlayerPhotos.mjs --league=esp

# 4) ตราทีมจาก FMInside (ทุกลีกใน fmClubIds.json)
node scripts/downloadCrests.mjs
```

แทน `buildSpainPack` ด้วย `buildGermanyPack` / `buildFrancePack` / `buildItalyPack` / `buildChampionshipPack` / `buildSpain2Pack` ตามลีก

- **LaLiga2 (`esp2`)** — 20 สโมสร  
  ```bash
  node scripts/buildSpain2Pack.mjs --download-clubs
  node scripts/buildSpain2Pack.mjs --resolve
  node scripts/buildSpain2Pack.mjs --fetch-fminside
  node scripts/buildFmInsideAttrs.mjs
  node scripts/downloadPlayerPhotos.mjs --league=esp2
  node scripts/downloadCrests.mjs
  ```
  หมายเหตุ: Burgos = `brg`/`BRG` (ไม่ใช้ BUR) · Andorra FM id = `1709`

- **2. Bundesliga (`ger2`)** · `buildGermany2Pack.mjs` (18)
- **Ligue 2 (`fra2`)** · `buildFrance2Pack.mjs` (18)
- **Serie B (`ita2`)** · `buildItaly2Pack.mjs` (20 · UBS = Union Brescia)
- **Thai League 2 (`tha2`)** · `buildThai2Pack.mjs` (16)

```bash
node scripts/buildGermany2Pack.mjs --download-clubs   # หรือ France2 / Italy2 / Thai2
node scripts/buildGermany2Pack.mjs --resolve
node scripts/buildGermany2Pack.mjs --fetch-fminside
node scripts/buildFmInsideAttrs.mjs
node scripts/downloadPlayerPhotos.mjs --league=ger2
node scripts/downloadCrests.mjs
```

- **Thai League 1 (`tha`)** — 16 สโมสร  
  ```bash
  node scripts/buildThaiPack.mjs --download-clubs
  node scripts/buildThaiPack.mjs --resolve
  node scripts/buildThaiPack.mjs --fetch-fminside
  node scripts/buildFmInsideAttrs.mjs
  node scripts/downloadPlayerPhotos.mjs --league=tha
  node scripts/downloadCrests.mjs
  ```
  หมายเหตุ: ขนาดลีก = **16** ทีม (`leagueSize.ts`) · key `utt`/`ryg` ไม่ชน Udinese/Rayo

### Youth / U16–U23 (ลีกชั้นนำ)

FMTU ไม่มีหน้า U21 แยก — ใช้แผง **Wonderkids** แล้วจัดกลุ่มตามอายุ:

| อายุ | กลุ่ม |
|------|--------|
| ≤16 | U16 |
| ≤18 | U18 |
| ≤21 | U21 |
| ≤23 | U23 |

```bash
node scripts/buildYouthFromFmtu.mjs
# หรือเฉพาะลีก
node scripts/buildYouthFromFmtu.mjs --league=eng,esp,ger,fra,ita
```

ข้อมูลอยู่ใน `players{Eng,Esp,Ger,Fra,Ita}.json` → คีย์ `youth` · seed เป็น `isYouth: true`  
**ต้องเริ่มอาชีพใหม่** ถึงจะได้เด็กในเซฟ

---

## ไฟล์สำคัญ

| ไฟล์ | บทบาท |
|------|--------|
| `src/data/world/players{Eng,Eng2,Esp,Esp2,Ger,Ger2,Fra,Fra2,Ita,Ita2,Tha,Tha2,Jpn,Jpn2,Kor,Kor2,Bra,Tur,Ned,Prt,Bel,Sco,Aut,Sui,Den,Gre}.json` | roster |
| `scripts/_fm26_dumps/{eng,eng2,esp,esp2,ger,ger2,fra,fra2,ita,ita2,tha,tha2,jpn,jpn2,kor,kor2,bra,tur,ned,prt,bel,sco,aut,sui,den,gre}_fm_ids.json` | ชื่อ → fmId |
| `scripts/_fm26_dumps/fminside/{fmId}.md` | dump หน้าผู้เล่น |
| `src/data/world/fmInsideAttrs.json` | attrs + ค่าตัว/ค่าเหนื่อย |
| `src/data/world/playerPhotos.json` | ชื่อ → `fmi-{fmId}` / `soi-{fmId}` |
| `public/players/fmi-*.png` · `soi-*.png` | รูป (FMInside → SortItOutSI fallback) |
| `src/data/world/fmClubIds.json` | club key → FM club id |
| `public/crests/{key}.png` | ตราทีม |

---

## สคริปต์

| สคริปต์ | ทำอะไร |
|---------|--------|
| `buildXxxPack.mjs --download-clubs` | โหลดหน้าสโมสร FMTU |
| `buildXxxPack.mjs --resolve` | สร้าง roster + fm_ids |
| `buildXxxPack.mjs --fetch-fminside` | ดึง attrs จาก fminside (รวม **Goalkeeping**) |
| `refetchGkFmInside.mjs` | ดึง GK ที่ dump เก่ายังไม่มี Goalkeeping ซ้ำ |
| `buildFmInsideAttrs.mjs` | รวม md → `fmInsideAttrs.json` |
| `downloadPlayerPhotos.mjs` | รูป: **FMInside** → fallback **SortItOutSI cutout** |
| `retryMissingFaces.mjs` | โหลดซ้ำคนที่ยังขาด (SOI / FotMob) |
| `downloadCrests.mjs` | ตราจาก **FMInside logos** |
| `buildPlayerBios.mjs` | BIO เสริม PL (optional) |
| `buildChampionshipBios.mjs` | BIO Championship → merge Eng |
| `buildLeagueBios.mjs` | BIO top + div2 (`all` / `div2`) |

```bash
# รูปทุกลีก
node scripts/downloadPlayerPhotos.mjs

# รูปเฉพาะลีก
node scripts/downloadPlayerPhotos.mjs --league=esp,ger,fra,ita
```

---

## เช็กสถานะ

```bash
node -e "
const fs=require('fs');
const photos=JSON.parse(fs.readFileSync('src/data/world/playerPhotos.json','utf8')).byName||{};
const fm=JSON.parse(fs.readFileSync('src/data/world/fmInsideAttrs.json','utf8')).byName||{};
const leagues={eng:'playersEng',eng2:'playersEng2',esp:'playersEsp',esp2:'playersEsp2',ger:'playersGer',ger2:'playersGer2',fra:'playersFra',fra2:'playersFra2',ita:'playersIta',ita2:'playersIta2',tha:'playersTha',tha2:'playersTha2'};
for (const [id,file] of Object.entries(leagues)) {
  if (!fs.existsSync('src/data/world/'+file+'.json')) continue;
  const pack=JSON.parse(fs.readFileSync('src/data/world/'+file+'.json','utf8'));
  let t=0,p=0,f=0;
  for (const rows of Object.values(pack.clubs||{}))
    for (const r of rows) { t++; if(photos[r.name])p++; if(fm[r.name])f++; }
  console.log(id, 'PIC', p+'/'+t, 'FM', f+'/'+t);
}
"
```

---

## แบ่งงาน

| คน | งาน |
|----|-----|
| A–D | คนละลีก: `--resolve` → `--fetch-fminside` → `downloadPlayerPhotos --league=…` |
| รวม | `buildFmInsideAttrs.mjs` + `downloadCrests.mjs` ครั้งเดียว |

อย่ารัน `--fetch-fminside` แรงเกินบน IP เดียว

---

## นักเตะกับ “DB” ตอนนี้ทำยังไง

มี **สองชั้น**:

| ชั้น | เก็บที่ไหน | ตามย้าย/เจ็บ/โตไหม |
|------|-----------|-------------------|
| **Live DB (อาชีพนี้)** | `GameSave.players` ใน IndexedDB (`fc-manager-db`) + `playerMoveLog` | **ใช่** — อัปเดตทุกครั้งที่ย้าย/ยืม/เจ็บ/พัฒนา |
| **Pack (แม่แบบ)** | `src/data/world/players*.json` | **ไม่** — โหลดตอนเริ่มอาชีพใหม่เท่านั้น |

หน้า `/database`:
- แท็บ **Live** = query จากเซฟปัจจุบัน (สถานะ·คลับ·ประวัติย้าย)
- แท็บ **Pack** = catalog JSON สำหรับ import / เริ่มอาชีพใหม่

```text
playersXxx.json ──┐
fmInsideAttrs.json ─┼→ worldSeed → createNewGame → GameSave.players  → IndexedDB
playerPhotos.json ──┘                                    ↕
                                              ย้าย/ยืม/เจ็บ/โตระหว่างเล่น
                                              + playerMoveLog
```

ไฟล์โค้ด: `src/game/playerWorldDb.ts` · `src/game/idbSave.ts` · `src/pages/PlayerDatabasePage.tsx`

### วิธีใส่นักเตะเข้า pack (แม่แบบ)

1. แก้ JSON ของลีกนั้น **หรือ** รัน pipeline ในเอกสารนี้  
2. (ออปชัน) ใส่ attrs / รูป / bio ตามชื่อ  
3. **เริ่มอาชีพใหม่** — เซฟเก่าไม่ได้นักเตะใหม่จาก pack  

สถานะหลังเริ่มอาชีพดูที่แท็บ **Live** — ไม่ต้องแก้ pack เพื่อตามการย้าย

### ยังไม่มี

- Editor แก้ pack จากในเกม (เขียนกลับไฟล์ JSON)  
- AI-to-AI transfer log ครบทุกดีลโลก (ตอนนี้ล็อกย้ายที่เกี่ยวกับดีล human / ยืมหลัก)

---

## Pack vs เซฟเกม (การพัฒนาตัวละคร)

| | Pack JSON (`fmInsideAttrs` / `players*`) | เซฟเกม (Live DB) |
|--|------------------------------------------|------------------|
| บทบาท | **แม่แบบตอนเริ่มอาชีพ** (catalog) | ค่าที่โต/เปลี่ยนระหว่างเล่น |
| attrs / CA / PA | ค่าเริ่มจาก FMInside | พัฒนาตามฝึก·แข่ง·อายุ |
| คลับ / สถานะ | คงที่ในไฟล์ | ย้าย·เจ็บ·แบน·ขึ้นขาย |
| เขียนทับตอน re-import? | ได้ (อัปเดตแม่แบบ) | **ห้าม** — อยู่คนละชั้น |

**Live DB คือสิ่งที่ต้องใช้ตอนเล่น** — pack แค่ seed  
หน้าแก้ catalog ในเกม (ถ้าทำทีหลัง) เป็นเครื่องมือ import ไม่ใช่ที่เก็บ state ที่กำลังโต

ถ้า GK dump เก่ายังไม่มี Goalkeeping:
```bash
node scripts/refetchGkFmInside.mjs
node scripts/buildFmInsideAttrs.mjs
```

---

## ลีกใหม่ (scaffold พร้อม — roster ยังว่างจนกว่าจะรัน pack)

| LeagueId | ลีก | ทีม | Pack script |
|----------|-----|-----|-------------|
| `jpn` | J1 League | 20 | `buildNationPack.mjs --league=jpn` |
| `jpn2` | J2 (div2 pack) | 20 | `--league=jpn2` |
| `kor` | K League 1 | 12 | `--league=kor` |
| `kor2` | K League 2 (div2) | 12* | `--league=kor2` |
| `bra` | Brasileirão | 20 | `--league=bra` |
| `tur` | Süper Lig | 18 | `--league=tur` |
| `ned` | Eredivisie | 18 | `--league=ned` |
| `prt` | Primeira Liga | 18 | `--league=prt` (ไม่ใช้ `por`) |
| `bel` | Pro League | 16 | `--league=bel` |
| `sco` | Scottish Premiership | 12 | `--league=sco` |
| `aut` | Austrian Bundesliga | 12 | `--league=aut` |
| `sui` | Swiss Super League | 12 | `--league=sui` |
| `den` | Superliga | 12 | `--league=den` |
| `gre` | Super League Greece | 14 | `--league=gre` |
| `vie` | V.League 1 (เวียดนาม) | 14 | `--league=vie` |
| `idn` | Liga 1 (อินโดฯ) | 18 | `--league=idn` |
| `mys` | Super League (มาเลย์) | 12 | `--league=mys` |
| `sgp` | Premier League (สิงคโปร์) | 8 | `--league=sgp` |
| `sau` | Saudi Pro League | 18 | `--league=sau` · **ไม่บังคับ FFP** · งบสูง · Div2 = Saudi First Division (`sau2` pack จริง 18) · ตกชั้น 2 |

\* kor2 = 12 สโมสรที่มี FM id ยืนยันแล้ว (drop NEED_LOOKUP)

คลับคอนฟิก: `scripts/leagueClubConfigs.json`  
- ยุโรปถ้วย: `tur/ned/prt/bel/sco/aut/sui/den/gre`  
- **ASEAN** (`tha/vie/idn/mys/sgp`): ถ้วย `ASEAN Club Championship`  
- **ACL**: `tha/jpn/kor/vie/idn/mys/sgp/sau`

```bash
node scripts/buildNationPack.mjs --league=jpn --download-clubs
node scripts/buildNationPack.mjs --league=jpn --resolve
node scripts/buildNationPack.mjs --league=jpn --fetch-fminside
node scripts/buildFmInsideAttrs.mjs
node scripts/downloadPlayerPhotos.mjs --league=jpn
node scripts/downloadCrests.mjs
```

---

## ลีกใหม่ (ขั้นตอนทั่วไป)

1. ใส่สโมสรใน `leagues*.ts` + FM club id ใน `fmClubIds.json` / `leagueClubConfigs.json`  
2. `buildNationPack.mjs --league=xxx` หรือคัดลอก `buildXxxPack.mjs`  
3. `--download-clubs` → `--resolve` → `--fetch-fminside`  
4. wire `*Players.ts` / `worldSeed` / `playerPackBrowser`  
5. `buildFmInsideAttrs.mjs` · `downloadPlayerPhotos --league=xxx` · `downloadCrests.mjs`
