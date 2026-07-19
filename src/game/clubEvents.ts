import type { GameSave, InboxMessage } from './types'
import { pickOutlet, pickTalkShow } from './mediaOutlets'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

type EventGen = (save: GameSave) => InboxMessage | null

const EVENT_POOL: EventGen[] = [
  (save) => {
    if (Math.random() > 0.22) return null
    const outlet = pickOutlet(save, 1)
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: `${outlet.name}: พาดหัวสัปดาห์`,
      body: `${outlet.name} จัดอันดับผู้จัดการเด่นประจำสัปดาห์ — ชื่อ ${save.managerName} ถูกพูดถึงในคอลัมน์วิเคราะห์`,
      read: false,
    }
  },
  (save) => {
    if (save.fans.mood < 55 || Math.random() > 0.18) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: 'แฟนจัดแฟลชม็อบเชียร์',
      body: 'กลุ่มซอฟต์นัดรวมตัวหน้าสนามก่อนซ้อม — ขอให้ทีมโชว์ตัวทักทาย 5 นาที',
      read: false,
    }
  },
  (save) => {
    if (save.fans.mood > 45 || Math.random() > 0.2) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: 'แบนเนอร์วิจารณ์ในอัฒจันทร์',
      body: 'Ultras เตรียมป้ายข้อความกดดันบอร์ด — ตำรวจสนามขอความร่วมมือลดความรุนแรง',
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.15) return null
    const talk = pickTalkShow(save, 2)
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: `${talk} เชิญวิจารณ์`,
      body: `รายการ ${talk} เปิดสายคุยเรื่องสไตล์การเล่นของสโมสร — แขกรับเชิญถกเถียงกันดุเดือด`,
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.12) return null
    const p = save.players
      .filter((x) => x.clubId === save.humanClubId && x.overall >= 75)
      .sort(() => Math.random() - 0.5)[0]
    if (!p) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: `เอเยนต์ของ ${p.name} โผล่สนามซ้อม`,
      body: 'ยังไม่มีการเจรจาเป็นทางการ แต่สตาฟสื่อบันทึกภาพไว้ — บอร์ดขอให้เงียบไว้ก่อน',
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.14) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: 'สปอนเซอร์ขอแคมเปญพิเศษ',
      body: 'พาร์ทเนอร์เสื้อขอให้ดาวทีมถ่ายโฆษณา 1 วัน — ฝ่ายการค้าบอกว่ารายได้เสริมเล็กน้อย',
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.16) return null
    const rival = save.clubs
      .filter((c) => c.id !== save.humanClubId && c.division === 1)
      .sort((a, b) => b.reputation - a.reputation)[0]
    if (!rival) return null
    const outlet = pickOutlet(save, 4)
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: `${outlet.name}: เทียบกับ ${rival.shortName}`,
      body: `คอลัมน์เปรียบเทียบวิสัยทัศน์ — ชี้ว่า ${save.managerName} ต้องเร่งสร้างเอกลักษณ์ให้ชัดกว่าคู่แข่ง`,
      read: false,
    }
  },
  (save) => {
    if (save.board.confidence > 55 || Math.random() > 0.25) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: 'บอร์ดประชุมลับนอกวาระ',
      body: 'มีรายงานว่ามีการประชุมสั้นๆ เรื่องเป้าฤดูกาล — ยังไม่ถึงขั้นคำขาด แต่บรรยากาศตึง',
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.11) return null
    const youth = save.players.filter((p) => p.clubId === save.humanClubId && p.isYouth)[0]
    if (!youth) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: `อะคาเดมี่ป้าย ${youth.name}`,
      body: 'โค้ชเยาวชนย้ำว่าเด็กคนนี้พร้อมโอกาสชุดใหญ่ — สื่อท้องถิ่นเริ่มติดตาม',
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.13) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: 'ดราม่าโซเชียลในห้องแต่งตัว',
      body: 'มีสตอรี่ลับถูกแคปไปแพร่ — ฝ่ายสื่อขอให้นักเตะลดการโพสต์ก่อนแมตช์ใหญ่',
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.1) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: 'เทศบาลคุยเรื่องจราจรวันแข่ง',
      body: 'นัดเหย้าถัดไปคาดรถติด — สโมสรประสานเปิดลานจอดเสริมและรถรับส่งแฟน',
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.12) return null
    const injured = save.players.filter(
      (p) => p.clubId === save.humanClubId && p.injuryDays > 3,
    )[0]
    if (!injured) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: `อัปเดตอาการ ${injured.name}`,
      body: 'ทีมแพทย์ออกแถลงสั้นๆ — แฟนในกลุ่มแชทแตกเป็นสองฝ่ายเรื่องเร่งกลับมาลง',
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.09) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: 'อดีตผู้เล่นมาเยือน',
      body: 'ตำนานสโมสรแวะทักทายชุดปัจจุบันหลังซ้อม — โมราเลห้องแต่งตัวดีขึ้นเล็กน้อย',
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.1) return null
    const outlet = pickOutlet(save, 9)
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: `${outlet.name} จัดโพลแฟน`,
      body: `ผลโหวต “ผู้จัดการที่อยากเห็นนานสุด” ประจำเดือน — ${save.managerName} อยู่ในกลุ่มที่ถูกพูดถึง`,
      read: false,
    }
  },
  (save) => {
    if (Math.random() > 0.08) return null
    return {
      id: uid('evt'),
      date: save.currentDate,
      title: 'พายุ/หมอกกระทบตารางซ้อม',
      body: 'โค้ชปรับเซสชันในร่ม — นักเตะบางคนบ่นเรื่องจังหวะการเตรียมเกม',
      read: false,
    }
  },
]

/** สุ่ม 1–3 เหตุการณ์โลก/สโมสรต่อแมตช์เดย์ */
export function rollClubWorldEvents(save: GameSave): GameSave {
  const shuffled = [...EVENT_POOL].sort(() => Math.random() - 0.5)
  const msgs: InboxMessage[] = []
  const max = 1 + (Math.random() < 0.45 ? 1 : 0) + (Math.random() < 0.2 ? 1 : 0)
  for (const gen of shuffled) {
    if (msgs.length >= max) break
    const m = gen(save)
    if (m) msgs.push(m)
  }
  if (!msgs.length) return save

  // soft mood bumps for positive fan events
  let fans = save.fans
  if (msgs.some((m) => m.title.includes('แฟลชม็อบ'))) {
    fans = { ...fans, mood: Math.min(100, fans.mood + 1), lastEvent: msgs[0]!.body }
  }
  if (msgs.some((m) => m.title.includes('แบนเนอร์'))) {
    fans = { ...fans, mood: Math.max(0, fans.mood - 1), lastEvent: msgs[0]!.body }
  }

  return {
    ...save,
    fans,
    inbox: [...msgs, ...save.inbox].slice(0, 45),
  }
}
