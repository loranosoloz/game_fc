import type { GameSave, Player, PositionGroup } from './types'
import { estimatedValue } from './transfer'
import { groupLabel, roleLabel } from './positions'
import { formatMoney } from '@/lib/format'
import { fanMoodLabel } from './fans'
import type { FanState } from './types'

export type IntelTone = 'positive' | 'neutral' | 'warning' | 'critical'

export interface IntelPoint {
  lens: string
  tone: IntelTone
  score: number
  title: string
  why: string
}

export interface TransferIntel {
  playerId: string
  mode: 'buy' | 'sell'
  verdict: 'strongly_yes' | 'yes' | 'hold' | 'no' | 'strongly_no'
  verdictLabel: string
  confidence: number
  headline: string
  summary: string
  ifSkip: string
  points: IntelPoint[]
  fanVoice: string
  coachVoice: string
  financeVoice: string
  suggestedFee: number
  suggestedWage?: number
}

function squadOf(save: GameSave, clubId: string) {
  return save.players.filter((p) => p.clubId === clubId)
}

function avgOvr(players: Player[]) {
  if (players.length === 0) return 60
  return players.reduce((s, p) => s + p.overall, 0) / players.length
}

function depthAt(players: Player[], pos: PositionGroup) {
  return players.filter((p) => p.position === pos).length
}

function bestAt(players: Player[], pos: PositionGroup) {
  return players.filter((p) => p.position === pos).sort((a, b) => b.overall - a.overall)[0]
}

function rankOfPlayer(xiLike: Player[], player: Player) {
  const same = xiLike
    .filter((p) => p.position === player.position)
    .sort((a, b) => b.overall - a.overall)
  return same.findIndex((p) => p.id === player.id) + 1 || same.length + 1
}

function verdictFromScore(score: number): TransferIntel['verdict'] {
  if (score >= 78) return 'strongly_yes'
  if (score >= 62) return 'yes'
  if (score >= 48) return 'hold'
  if (score >= 32) return 'no'
  return 'strongly_no'
}

function verdictLabel(v: TransferIntel['verdict'], mode: 'buy' | 'sell') {
  if (mode === 'buy') {
    switch (v) {
      case 'strongly_yes':
        return 'ควรซื้อเดี๋ยวนี้'
      case 'yes':
        return 'น่าซื้อ'
      case 'hold':
        return 'รอดูตลาด'
      case 'no':
        return 'ไม่แนะนำให้ซื้อ'
      case 'strongly_no':
        return 'ห้ามซื้อ'
    }
  }
  switch (v) {
    case 'strongly_yes':
      return 'ควรขาย'
    case 'yes':
      return 'ขายได้'
    case 'hold':
      return 'เก็บไว้ก่อน'
    case 'no':
      return 'ไม่ควรขาย'
    case 'strongly_no':
      return 'ห้ามขาย'
  }
}

export function analyzeBuy(save: GameSave, player: Player, fans: FanState): TransferIntel {
  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const seller = save.clubs.find((c) => c.id === player.clubId)!
  const mine = squadOf(save, human.id)
  const avg = avgOvr(mine)
  const depth = depthAt(mine, player.position)
  const best = bestAt(mine, player.position)
  const value = estimatedValue(player)
  const wageLoad = mine.reduce((s, p) => s + p.wage, 0)
  const points: IntelPoint[] = []
  let score = 50

  if (depth <= 2) {
    points.push({
      lens: 'ความลึกสควอด',
      tone: 'critical',
      score: 90,
      title: `ตำแหน่ง${roleLabel(player.role)}ขาดแคลน`,
      why: `ตอนนี้มีเพียง ${depth} คน — ถ้ามีเจ็บ/ใบแดง แผนจะพังทันที การซื้อครั้งนี้แก้ปัญหาโครงสร้าง ไม่ใช่แค่เสริมสวย`,
    })
    score += 18
  } else if (depth >= 5 && (!best || player.overall <= best.overall)) {
    points.push({
      lens: 'ความลึกสควอด',
      tone: 'warning',
      score: 30,
      title: 'ตำแหน่งนี้คนล้นแล้ว',
      why: `มี ${depth} คนในตำแหน่งเดียวกัน ถ้า ${player.name} ไม่ชัดว่าจะแย่งตัวจริง เงินก้อนนี้มีต้นทุนค่าเสียโอกาสสูง`,
    })
    score -= 12
  } else {
    points.push({
      lens: 'ความลึกสควอด',
      tone: 'positive',
      score: 65,
      title: 'เสริมความลึกได้พอดี',
      why: `มี ${depth} คนอยู่แล้ว การเพิ่ม ${player.name} ทำให้หมุนเวียนได้โดยไม่เบียดจนเกิดดราม่าม้านั่งยาว`,
    })
    score += 6
  }

  const gap = player.overall - avg
  if (gap >= 4) {
    points.push({
      lens: 'คุณภาพ',
      tone: 'positive',
      score: 88,
      title: 'เหนือค่าเฉลี่ยทีมชัด',
      why: `OVR ${player.overall} สูงกว่าค่าเฉลี่ยสควอด (~${avg.toFixed(0)}) ราว ${gap.toFixed(1)} แต้ม — นี่คืออัปเกรดที่แฟนและโค้ชอ่านออกทันที`,
    })
    score += 14
  } else if (gap <= -3) {
    points.push({
      lens: 'คุณภาพ',
      tone: 'warning',
      score: 28,
      title: 'ต่ำกว่ามาตรฐานทีม',
      why: `OVR ต่ำกว่าค่าเฉลี่ยทีม — เสี่ยงถูกมองว่าซื้อผิดคน ยกเว้นจะซื้อเพื่ออนาคตอายุน้อยจริงๆ`,
    })
    score -= 14
  } else if (best && player.overall > best.overall) {
    points.push({
      lens: 'คุณภาพ',
      tone: 'positive',
      score: 80,
      title: `แซงตัวท็อปตำแหน่ง (${best.name})`,
      why: `ดีกว่าตัวหลักปัจจุบัน ${player.overall - best.overall} แต้ม — เหตุผลแท็กติกแข็งแรงมาก`,
    })
    score += 12
  }

  if (player.age <= 23 && player.overall >= avg - 1) {
    points.push({
      lens: 'เส้นโค้งอายุ',
      tone: 'positive',
      score: 84,
      title: 'โปรไฟล์อนาคต (อายุน้อย)',
      why: `อายุ ${player.age} ยังมีเพดานโต — มูลค่า ${formatMoney(value)} มีโอกาสพองตัวถ้าได้ลงเล่นสม่ำเสมอ`,
    })
    score += 10
  } else if (player.age >= 32) {
    points.push({
      lens: 'เส้นโค้งอายุ',
      tone: 'warning',
      score: 35,
      title: 'ใกล้ขาลง',
      why: `อายุ ${player.age} ค่าตัวอาจระบายยากในอีก 1–2 ปี ซื้อได้ถ้าต้องการผลทันที แต่ไม่ใช่สินทรัพย์ระยะยาว`,
    })
    score -= 8
  }

  const feeShare = value / Math.max(human.balance, 1)
  if (feeShare > 0.45) {
    points.push({
      lens: 'การเงิน',
      tone: 'critical',
      score: 25,
      title: 'กินงบก้อนใหญ่เกินไป',
      why: `ค่าตัวราว ${formatMoney(value)} ≈ ${(feeShare * 100).toFixed(0)}% ของเงินในบัญชี — พลาดนัดเดียวแล้วสภาพคล่องจะตึง`,
    })
    score -= 16
  } else if (player.wage > human.wageBudgetWeekly * 0.08) {
    points.push({
      lens: 'การเงิน',
      tone: 'warning',
      score: 40,
      title: 'ค่าเหนื่อยหนักเทียบงบ',
      why: `ค่าเหนื่อย ${formatMoney(player.wage)}/สัปดาห์ กดโครงสร้างเงินเดือน (ภาระรวมตอนนี้ ${formatMoney(wageLoad)})`,
    })
    score -= 7
  } else {
    points.push({
      lens: 'การเงิน',
      tone: 'positive',
      score: 70,
      title: 'โครงสร้างเงินรับได้',
      why: `เทียบเงินคงเหลือ ${formatMoney(human.balance)} แล้วดีลนี้อยู่ในกรอบที่คลับยังหมุนต่อได้`,
    })
    score += 5
  }

  const rivals = save.clubs
    .filter((c) => c.controlledBy === 'ai' && c.id !== seller.id)
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 3)
  points.push({
    lens: 'ภัยคุกคามตลาด',
    tone: rivals[0] && rivals[0].reputation >= human.reputation ? 'warning' : 'neutral',
    score: 55,
    title: 'คลับอื่นอาจแย่งได้',
    why: `${seller.name} อาจเปิดรับข้อเสนอแข่ง หาก ${rivals.map((r) => r.shortName).join(', ')} สนใจ คุณอาจโดนดันราคา — ตัดสินใจช้ามีต้นทุน`,
  })
  if (player.overall >= avg + 3) score += 4

  if (gap >= 3) {
    points.push({
      lens: 'แฟนบอล',
      tone: 'positive',
      score: 86,
      title: 'อัฒจันทร์จะเชียร์ดีลนี้',
      why: `สถานะแฟนตอนนี้「${fanMoodLabel(fans.mood)}」(${fans.mood}/100) การเสริมดาวจะเติมพลังกลุ่ม Ultras โดยเฉพาะ`,
    })
    score += 8
  } else if (fans.mood < 45 && gap < 0) {
    points.push({
      lens: 'แฟนบอล',
      tone: 'critical',
      score: 22,
      title: 'แฟนไม่พร้อมกับดีลคุณภาพต่ำ',
      why: `ความพอใจแฟนเหลือ ${fans.mood} — ถ้าซื้อคนที่ดูอ่อนกว่ามาตรฐาน อาจถูกมองว่าไร้ทิศทางซ้อนปัญหาผลงาน`,
    })
    score -= 10
  } else {
    points.push({
      lens: 'แฟนบอล',
      tone: 'neutral',
      score: 55,
      title: 'ปฏิกิริยาแฟนปานกลาง',
      why: `คาดว่าแฟนจะเงียบๆ ถ้าดีลจบเร็วและได้ลงสนามจริง ไม่ใช่แค่ชื่อบนกระดาษ`,
    })
  }

  score = Math.max(0, Math.min(100, score))
  const verdict = verdictFromScore(score)
  const confidence = Math.round(58 + Math.abs(score - 50) * 0.7)
  const suggestedFee = Math.round(value * (verdict === 'strongly_yes' ? 1.05 : verdict === 'yes' ? 1.0 : 0.95))
  const suggestedWage = Math.round(player.wage * 1.08)

  return {
    playerId: player.id,
    mode: 'buy',
    verdict,
    verdictLabel: verdictLabel(verdict, 'buy'),
    confidence,
    headline:
      verdict === 'strongly_yes' || verdict === 'yes'
        ? `ทำไมต้องซื้อ ${player.name}`
        : `ทำไมยังไม่ควรซื้อ ${player.name}`,
    summary: `คะแนนรวมโมเดล ${score}/100 · ความมั่นใจ ${confidence}% · จากมุมแท็กติก/การเงิน/แฟน/ตลาดพร้อมกัน ไม่ใช่แค่ตัวเลข OVR`,
    ifSkip:
      depth <= 2
        ? `ถ้าไม่ซื้อ: ความเสี่ยงพังแผนตอนมีคนเจ็บสูงมาก — นัดใหญ่ถัดไปคุณอาจถูกบังคับใช้คนผิดบทบาท`
        : gap >= 4
          ? `ถ้าไม่ซื้อ: ทีมอันดับใกล้เคียงอาจแย่ง ${player.name} แล้วคุณเสียทั้งคุณภาพและโมเมนตัมแฟน`
          : `ถ้าไม่ซื้อ: ไม่พังทันที แต่คุณเสียโอกาสจัดสรรเงินให้ตรงตำแหน่งที่สร้างแต้มจริง`,
    points: points.sort((a, b) => b.score - a.score),
    fanVoice:
      gap >= 3
        ? `「ซื้อเลย เราอยากเห็นความทะเยอทะยานบนสนาม ไม่ใช่แค่พูดในแถลงข่าว」`
        : `「ซื้อได้ถ้าใช่คน — แต่ถ้าซื้อแล้วไม่ลงเล่น เราจะจำ」`,
    coachVoice:
      best && player.overall > best.overall
        ? `「เขาดีกว่าตัวหลักตำแหน่งนี้ (${best.name}) — ใส่ระบบเราได้ทันที」`
        : `「รับได้เป็นตัวหมุน ถ้าไม่แย่งเคมีห้องแต่งตัว」`,
    financeVoice: `「มูลค่าประเมิน ${formatMoney(value)} · งบเหลือ ${formatMoney(human.balance)} · อย่าให้ดีลเดียวล็อกอนาคตคลับ」`,
    suggestedFee,
    suggestedWage,
  }
}

export function analyzeSell(save: GameSave, player: Player, fans: FanState): TransferIntel {
  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const mine = squadOf(save, human.id)
  const avg = avgOvr(mine)
  const depth = depthAt(mine, player.position)
  const value = estimatedValue(player)
  const tactics = save.tacticsByClub[human.id]
  const inXi = tactics.startingXi.includes(player.id)
  const rank = rankOfPlayer(mine, player)
  const points: IntelPoint[] = []
  let score = 45

  if (depth <= 2) {
    points.push({
      lens: 'ความลึกสควอด',
      tone: 'critical',
      score: 15,
      title: 'ขายแล้วตำแหน่งจะแห้ง',
      why: `เหลือเพียง ${depth} คนในกลุ่ม${groupLabel(player.position)} — การขายตอนนี้คือการพนันสุขภาพทั้งฤดูกาล`,
    })
    score -= 22
  } else if (depth >= 5 && rank >= 3) {
    points.push({
      lens: 'ความลึกสควอด',
      tone: 'positive',
      score: 82,
      title: 'ตัวสำรองส่วนเกิน',
      why: `อันดับคุณภาพในตำแหน่งประมาณที่ ${rank}/${depth} — ปล่อยแล้วทีมยังหมุนได้ และได้เงินไปเสริมจุดอ่อนอื่น`,
    })
    score += 16
  }

  if (inXi && player.overall >= avg) {
    points.push({
      lens: 'แท็กติก',
      tone: 'critical',
      score: 20,
      title: 'กำลังเป็นตัวจริงคุณภาพสูง',
      why: `${player.name} อยู่ใน XI และ OVR ไม่ต่ำกว่าทีม — ขายตอนนี้เท่ากับลดเพดานแผนทันที`,
    })
    score -= 18
  } else if (!inXi && player.overall + 3 < avg) {
    points.push({
      lens: 'แท็กติก',
      tone: 'positive',
      score: 75,
      title: 'ไม่ได้ถูกใช้ในระบบหลัก',
      why: `ไม่ได้อยู่ XI และคุณภาพต่ำกว่าค่าเฉลี่ย — ค่าเหนื่อย ${formatMoney(player.wage)}/สัปดาห์ กำลังเป็นต้นทุนนิ่ง`,
    })
    score += 12
  }

  if (player.age >= 32) {
    points.push({
      lens: 'เส้นโค้งอายุ',
      tone: 'positive',
      score: 78,
      title: 'ขายตอนมูลค่ายังไม่ยุบ',
      why: `อายุ ${player.age} — อีกฤดูกาลสองฤดูกาลค่าตัวจะลดฮวบ ขายตอนนี้คือการบริหารสินทรัพย์`,
    })
    score += 10
  } else if (player.age <= 23 && player.overall >= avg - 1) {
    points.push({
      lens: 'เส้นโค้งอายุ',
      tone: 'warning',
      score: 25,
      title: 'กำลังจะแพงขึ้นในอนาคต',
      why: `โปรไฟล์เด็กมีคุณภาพ — ขายตอนนี้มักเสียส่วนต่างในอนาคต ยกเว้นราคาบ้าคลั่งจริงๆ`,
    })
    score -= 12
  }

  const wageShare = player.wage / Math.max(mine.reduce((s, p) => s + p.wage, 1), 1)
  if (wageShare > 0.09 && !inXi) {
    points.push({
      lens: 'การเงิน',
      tone: 'positive',
      score: 80,
      title: 'ปลดล็อกงบเดือน',
      why: `กินค่าเหนื่อยสัดส่วนสูงแต่ไม่ได้ลงเล่นหลัก — ขายแล้วได้ทั้งเงินก้อนและลดภาระรายสัปดาห์`,
    })
    score += 11
  } else {
    points.push({
      lens: 'การเงิน',
      tone: 'neutral',
      score: 55,
      title: `มูลค่าตลาด ~${formatMoney(value)}`,
      why: `ถ้าราคาเสนอสูงกว่าประเมินชัด ดีลจะสมเหตุสมผล — ถ้าราคาต่ำ เก็บไว้ดีกว่า`,
    })
  }

  if (inXi && player.overall >= avg + 1) {
    points.push({
      lens: 'แฟนบอล',
      tone: 'critical',
      score: 12,
      title: 'ขายแล้วอัฒจันทร์จะลุก',
      why: `สถานะแฟน「${fanMoodLabel(fans.mood)}」(${fans.mood}/100) — การขายดาว/ตัวจริงมักทำลายความเชื่อถือระยะยาว แม้ได้เงิน`,
    })
    score -= 20
  } else if (fans.mood < 40 && inXi) {
    points.push({
      lens: 'แฟนบอล',
      tone: 'critical',
      score: 10,
      title: 'จังหวะแย่สุดที่จะขายตัวจริง',
      why: `แฟนกำลังไม่พอใจอยู่แล้ว การขายตอนนี้ซ้อนวิกฤต — ความเสี่ยงโดนกดดันให้ออกสูง`,
    })
    score -= 15
  } else {
    points.push({
      lens: 'แฟนบอล',
      tone: 'positive',
      score: 70,
      title: 'แฟนพอเข้าใจได้',
      why: `ถ้าสื่อสารว่าขายเพื่อเสริมจุดอ่อน และได้คนใหม่เร็ว ปฏิกิริยาจะควบคุมได้`,
    })
    score += 5
  }

  score = Math.max(0, Math.min(100, score))
  const verdict = verdictFromScore(score)
  const confidence = Math.round(56 + Math.abs(score - 50) * 0.75)
  const suggestedFee = Math.round(value * (verdict === 'strongly_yes' ? 1.1 : 1.0))

  return {
    playerId: player.id,
    mode: 'sell',
    verdict,
    verdictLabel: verdictLabel(verdict, 'sell'),
    confidence,
    headline:
      verdict === 'strongly_yes' || verdict === 'yes'
        ? `ทำไมควรขาย ${player.name}`
        : `ทำไมยังไม่ควรขาย ${player.name}`,
    summary: `คะแนน「ความสมเหตุสมผลในการขาย」 ${score}/100 · โมเดลชั่งแท็กติก เงิน แฟน และเส้นมูลค่าพร้อมกัน`,
    ifSkip:
      player.age >= 32
        ? `ถ้าไม่ขาย: อีกปีมูลค่าอาจหายไปมหาศาล ทั้งที่ตอนนี้ตลาดยังรับได้`
        : inXi
          ? `ถ้าไม่ขาย: คุณรักษาเพดานทีมและความเชื่อมั่นแฟนไว้ — นี่คือทางที่ถูกต้องถ้าไม่ได้เงินบ้า`
          : `ถ้าไม่ขาย: คุณยังแบกค่าเหนื่อยนิ่งต่อไป เงินที่ควรไปจุดอ่อนจะถูกแช่แข็ง`,
    points: points.sort((a, b) => b.score - a.score),
    fanVoice: inXi
      ? `「ขายเขาตอนนี้ = บอกว่าคลับไม่โต เราไม่ยอม」`
      : `「ขายตัวสำรองได้ ถ้าเอาเงินมาเสริมจุดที่แพ้เกม」`,
    coachVoice: inXi
      ? `「อย่าเพิ่งขาย แผนตอนนี้ยังพึ่งเคมีเขาอยู่」`
      : `「ปล่อยได้ ผมมีคนหมุนแทนในซ้อม」`,
    financeVoice: `「เป้าขายที่สมเหตุสมผลประมาณ ${formatMoney(suggestedFee)} (ประเมินกลาง ${formatMoney(value)})」`,
    suggestedFee,
  }
}

export function toneClass(tone: IntelTone) {
  switch (tone) {
    case 'positive':
      return 'border-lime-300 bg-lime-50 text-lime-950'
    case 'warning':
      return 'border-amber-300 bg-amber-50 text-amber-950'
    case 'critical':
      return 'border-red-300 bg-red-50 text-red-950'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-800'
  }
}
