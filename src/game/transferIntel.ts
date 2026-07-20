import type { GameSave, Player, PositionGroup, TransferAddonPackage } from './types'
import { estimatedValue, marketSellPremium } from './transfer'
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
  const winterPrem = marketSellPremium(save, player)
  const askFloor = Math.round(value * winterPrem)
  const wageLoad = mine.reduce((s, p) => s + p.wage, 0)
  const points: IntelPoint[] = []
  let score = 50

  if (winterPrem > 1) {
    points.push({
      lens: 'จังหวะตลาด',
      tone: 'warning',
      score: 40,
      title: 'ตลาดวินเทอร์ — ราคาโหด',
      why: `กลางฤดูกาลสโมสรไม่ยอมปล่อยง่าย ค่าตัวประเมินถูกคูณ ~${winterPrem.toFixed(2)} (คีย์/ตัวจริงแพงกว่า) — ต้องจ่ายเกินซัมเมอร์ชัดเจน`,
    })
    score -= 8
  }

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
  const suggestedFee = Math.round(
    askFloor * (verdict === 'strongly_yes' ? 1.05 : verdict === 'yes' ? 1.0 : 0.95),
  )
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

export interface AddonIntel {
  verdict: TransferIntel['verdict']
  verdictLabel: string
  headline: string
  summary: string
  points: IntelPoint[]
  upfrontCost: number
  estimatedAddonMax: number
  totalDealEstimate: number
  budgetAfterUpfront: number
  addonShareOfDeal: number
  financeVoice: string
  suggestedNote: string
}

function addonVerdictLabel(v: TransferIntel['verdict'], mode: 'buy' | 'sell') {
  if (mode === 'buy') {
    switch (v) {
      case 'strongly_yes':
        return 'แพ็ก add-on คุ้มมาก'
      case 'yes':
        return 'แพ็ก add-on โอเค'
      case 'hold':
        return 'ปรับ add-on ก่อนเซ็น'
      case 'no':
        return 'add-on แพงเกิน'
      case 'strongly_no':
        return 'หลีกเลี่ยง add-on นี้'
    }
  }
  switch (v) {
    case 'strongly_yes':
      return 'add-on ดีมากสำหรับขาย'
    case 'yes':
      return 'add-on ช่วยปิดดีล'
    case 'hold':
      return 'เพิ่ม add-on อีกนิด'
    case 'no':
      return 'add-on น้อยเกิน'
    case 'strongly_no':
      return 'อย่าขายแบบนี้'
  }
}

function projectedAppsPerSeason(player: Player, save: GameSave, clubId: string): number {
  const squad = squadOf(save, clubId)
  const avg = avgOvr(squad)
  const tactics = save.tacticsByClub[clubId]
  const inXi = tactics?.startingXi.includes(player.id) ?? false
  if (inXi) return 34
  if (player.overall >= avg + 2) return 22
  if (player.overall >= avg - 2) return 14
  return 6
}

function sumAddonExposure(
  addons: TransferAddonPackage,
  player: Player,
  save: GameSave,
  clubId: string,
  contractYears: number,
): number {
  const appsPerSeason = projectedAppsPerSeason(player, save, clubId)
  const totalApps = appsPerSeason * contractYears
  let max = 0

  if (addons.appearanceFee > 0 && addons.appearanceNeeded > 0) {
    const prob = totalApps >= addons.appearanceNeeded ? 0.85 : 0.35
    max += addons.appearanceFee * prob
  }
  if (addons.goalsFee > 0 && addons.goalsNeeded > 0) {
    const goalsPerSeason =
      player.role === 'ST' || player.role === 'AM' ? 12 : player.role === 'W' ? 8 : 3
    const totalGoals = goalsPerSeason * contractYears
    max += totalGoals >= addons.goalsNeeded ? addons.goalsFee * 0.7 : addons.goalsFee * 0.2
  }
  if (addons.assistsFee > 0 && addons.assistsNeeded > 0) {
    const astPerSeason = player.role === 'W' || player.role === 'AM' ? 8 : 4
    const totalAst = astPerSeason * contractYears
    max += totalAst >= addons.assistsNeeded ? addons.assistsFee * 0.65 : addons.assistsFee * 0.15
  }
  if (addons.cleanSheetsFee > 0 && addons.cleanSheetsNeeded > 0) {
    const csPerSeason = player.position === 'GK' ? 14 : player.position === 'DEF' ? 8 : 0
    const totalCs = csPerSeason * contractYears
    max += totalCs >= addons.cleanSheetsNeeded ? addons.cleanSheetsFee * 0.6 : addons.cleanSheetsFee * 0.1
  }
  if (addons.intlCapsFee && addons.intlCapsFee > 0) {
    max += addons.intlCapsFee * 0.25
  }
  max += addons.promotionFee * 0.05
  max += addons.leagueTitleFee * 0.08
  max += addons.europeFee * 0.15

  return Math.round(max)
}

export function analyzeAddons(
  save: GameSave,
  player: Player,
  mode: 'buy' | 'sell',
  baseFee: number,
  wage: number,
  contractYears: number,
  addons: TransferAddonPackage,
): AddonIntel {
  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const value = estimatedValue(player)
  const upfrontCost = baseFee + (addons.signingOnFee ?? 0)
  const estimatedAddonMax = sumAddonExposure(addons, player, save, human.id, contractYears)
  const playerBonusMax =
    (addons.perAppearance ?? 0) * projectedAppsPerSeason(player, save, human.id) * contractYears +
    (addons.perGoal ?? 0) * 8 * contractYears +
    (addons.perAssist ?? 0) * 5 * contractYears +
    (addons.perCleanSheet ?? 0) * 6 * contractYears
  const totalDealEstimate = Math.round(upfrontCost + estimatedAddonMax + playerBonusMax * 0.5)
  const budgetAfterUpfront = human.balance - upfrontCost
  const addonShareOfDeal =
    totalDealEstimate > 0 ? (estimatedAddonMax + playerBonusMax * 0.5) / totalDealEstimate : 0
  const points: IntelPoint[] = []
  let score = 52

  const feePct = upfrontCost / Math.max(human.balance, 1)
  if (mode === 'buy') {
    if (feePct > 0.5 && estimatedAddonMax < baseFee * 0.15) {
      points.push({
        lens: 'การเงิน',
        tone: 'warning',
        score: 35,
        title: 'จ่ายหน้าเยอะเกิน — ควรผ่อน add-on',
        why: `ค่าตัวหน้า ${formatMoney(upfrontCost)} กิน ~${(feePct * 100).toFixed(0)}% งบ · ลองลดหน้าแล้วใส่โบนัสลงแข่ง/ประตูเพื่อกระจายความเสี่ยง`,
      })
      score -= 10
    } else if (feePct <= 0.25 && estimatedAddonMax > baseFee * 0.4) {
      points.push({
        lens: 'การเงิน',
        tone: 'positive',
        score: 82,
        title: 'โครงสร้างผ่อนจ่ายดี',
        why: `จ่ายหน้า ${formatMoney(upfrontCost)} (~${(feePct * 100).toFixed(0)}% งบ) · add-on สูงสุดประมาณ ${formatMoney(estimatedAddonMax)} — สภาพคล่องยังหมุนได้`,
      })
      score += 12
    } else {
      points.push({
        lens: 'การเงิน',
        tone: 'neutral',
        score: 58,
        title: `ภาระรวมประมาณ ${formatMoney(totalDealEstimate)}`,
        why: `หน้า ${formatMoney(upfrontCost)} + add-on คลับขาย ~${formatMoney(estimatedAddonMax)} + โบนัสนักเตะ ~${formatMoney(Math.round(playerBonusMax * 0.5))} · งบหลังจ่ายหน้า ${formatMoney(budgetAfterUpfront)}`,
      })
    }

    if (addons.sellOnPercent >= 20) {
      points.push({
        lens: 'ขายต่อ',
        tone: addons.sellOnPercent >= 30 ? 'critical' : 'warning',
        score: addons.sellOnPercent >= 30 ? 20 : 38,
        title: `Sell-on ${addons.sellOnPercent}% สูง`,
        why:
          addons.sellOnMode === 'profit'
            ? `ถ้าขายต่อกำไร คุณเสีย ${addons.sellOnPercent}% ของกำไร — นักเตะอายุน้อย/ดี จะกัดกำไรในอนาคต`
            : `ถ้าขายต่อ คุณเสีย ${addons.sellOnPercent}% จากค่าตัวถัดไป — แนะนำ ≤10% ถ้าเป็นโปรไฟล์เด็ก`,
      })
      score -= addons.sellOnPercent >= 30 ? 14 : 6
    } else if (addons.sellOnPercent > 0) {
      points.push({
        lens: 'ขายต่อ',
        tone: 'positive',
        score: 72,
        title: `Sell-on ${addons.sellOnPercent}% ยอมรับได้`,
        why: `ระดับนี้เป็นที่นิยมปิดดีล — ไม่กัดกำไรมากถ้าขายต่อในอนาคต`,
      })
      score += 4
    }

    if (addons.appearanceFee > 0) {
      const apps = projectedAppsPerSeason(player, save, human.id) * contractYears
      const likely = apps >= addons.appearanceNeeded
      points.push({
        lens: 'โบนัสลงแข่ง',
        tone: likely ? 'warning' : 'positive',
        score: likely ? 42 : 78,
        title: likely
          ? `โบนัส ${formatMoney(addons.appearanceFee)} น่าจะถึง (${addons.appearanceNeeded} นัด)`
          : `โบนัสลงแข่งปลอดภัย (${addons.appearanceNeeded} นัด)`,
        why: likely
          ? `คาดลง ~${apps} นัดใน ${contractYears} ปี — มีโอกาสจ่าย ${formatMoney(addons.appearanceFee)} ให้คลับขาย`
          : `เป้า ${addons.appearanceNeeded} นัดสูงกว่าที่คาดลง (~${apps}) — เงินอาจไม่จ่ายจริง`,
      })
      score += likely ? -5 : 6
    }

    if ((addons.signingOnFee ?? 0) > baseFee * 0.15) {
      points.push({
        lens: 'เงินเซ็น',
        tone: 'warning',
        score: 40,
        title: 'เงินเซ็นสัญญาหนัก',
        why: `เงินเซ็น ${formatMoney(addons.signingOnFee ?? 0)} กินงบทันที — รวมหน้าแล้ว ${formatMoney(upfrontCost)} ก่อนเริ่มเล่นนัดแรก`,
      })
      score -= 8
    }

    if (addons.buyBackFee && addons.buyBackFee > 0) {
      points.push({
        lens: 'ซื้อคืน',
        tone: 'neutral',
        score: 55,
        title: `สิทธิ์ซื้อคืน ${formatMoney(addons.buyBackFee)}`,
        why: `คลับขายเก็บทางกลับใน ${addons.buyBackYears ?? 3} ปี — ดีถ้าเป็นนักเตะดาวรุ่งที่ยังไม่พร้อมทันที`,
      })
    }

    const wageBump =
      (addons.annualWageRisePercent ?? 0) + (addons.europeWageBumpPercent ?? 0) * 0.3
    if (wageBump > 15) {
      points.push({
        lens: 'ค่าเหนื่อย',
        tone: 'warning',
        score: 38,
        title: 'โครงสร้างค่าเหนื่อยบวมในอนาคต',
        why: `ขึ้นเงินเดือน ${addons.annualWageRisePercent ?? 0}%/ปี + โบนัสยุโรป ${addons.europeWageBumpPercent ?? 0}% — ค่าเหนื่อยเริ่ม ${formatMoney(wage)}/สัปดาห์ จะแพงขึ้นเร็ว`,
      })
      score -= 9
    }
  } else {
    // sell mode — addons benefit seller
    if (estimatedAddonMax > baseFee * 0.3) {
      points.push({
        lens: 'การเงิน',
        tone: 'positive',
        score: 85,
        title: 'add-on เพิ่มมูลค่าดีลให้คุณ',
        why: `หน้า ${formatMoney(baseFee)} + add-on ที่อาจได้อีก ~${formatMoney(estimatedAddonMax)} — รวมประมาณ ${formatMoney(totalDealEstimate)}`,
      })
      score += 14
    } else {
      points.push({
        lens: 'การเงิน',
        tone: 'warning',
        score: 42,
        title: 'add-on น้อย — ได้เงินหน้าเป็นหลัก',
        why: `มูลค่าประเมิน ${formatMoney(value)} · ถ้าขาย ${formatMoney(baseFee)} โดยไม่มีโบนัส milestone อาจเสีย upside`,
      })
      score -= 6
    }

    if (addons.sellOnPercent >= 15) {
      points.push({
        lens: 'ขายต่อ',
        tone: 'positive',
        score: 80,
        title: `เก็บ sell-on ${addons.sellOnPercent}%`,
        why: `ถ้า ${player.name} โตต่อ คุณยังได้ส่วนแบ่งจากการขายครั้งถัดไป — ดีสำหรับนักเตะอายุน้อย`,
      })
      score += 10
    } else if (player.age <= 24 && addons.sellOnPercent < 10) {
      points.push({
        lens: 'ขายต่อ',
        tone: 'warning',
        score: 35,
        title: 'ควรใส่ sell-on สูงกว่านี้',
        why: `อายุ ${player.age} ยังมีเพดานโต — ขายโดยไม่เก็บ % ขายต่อ = เสียกำไรในอนาคต`,
      })
      score -= 8
    }

    if (addons.appearanceFee > 0) {
      points.push({
        lens: 'โบนัสลงแข่ง',
        tone: 'positive',
        score: 70,
        title: `โบนัสลงแข่ง ${formatMoney(addons.appearanceFee)}`,
        why: `ถ้าเขาลงจริงที่ทีมซื้อ คุณได้เงินเพิ่ม — เป้า ${addons.appearanceNeeded} นัด`,
      })
      score += 5
    }
  }

  if (addonShareOfDeal > 0.55 && mode === 'buy') {
    points.push({
      lens: 'ความเสี่ยงรวม',
      tone: 'critical',
      score: 25,
      title: 'add-on กินสัดส่วนดีลมาก',
      why: `~${(addonShareOfDeal * 100).toFixed(0)}% ของมูลค่าดีลเป็นเงื่อนไขทีหลัง/โบนัส — อ่าน fine print ให้ครบก่อนเซ็น`,
    })
    score -= 12
  }

  score = Math.max(0, Math.min(100, score))
  const verdict = verdictFromScore(score)

  const suggestedNote =
    mode === 'buy'
      ? feePct > 0.35
        ? `แนะนำ: ลดค่าตัวหน้า → เพิ่มโบนัสลงแข่ง ${formatMoney(Math.round(value * 0.08))} ที่ ${Math.max(15, addons.appearanceNeeded)} นัด · sell-on ≤10%`
        : `แนะนำ: หน้า ~${formatMoney(Math.round(value * 0.92))} · โบนัสประตู/แอสซิสต์ถ้าเป็นตำแหน่งรุก · หลีก sell-on สูง`
      : player.age <= 26
        ? `แนะนำ: ขอ sell-on ${Math.min(25, 15 + Math.round((26 - player.age) * 2))}% + โบนัสลงแข่ง ${formatMoney(Math.round(value * 0.06))}`
        : `แนะนำ: เน้นเงินหน้า ${formatMoney(Math.round(value * 1.05))} · add-on น้อยเพราะอายุ ${player.age}`

  return {
    verdict,
    verdictLabel: addonVerdictLabel(verdict, mode),
    headline: mode === 'buy' ? 'AI วิเคราะห์ Add-on / เงื่อนไข' : 'AI วิเคราะห์ Add-on ตอนขาย',
    summary: `ดีลรวมประมาณ ${formatMoney(totalDealEstimate)} (หน้า ${formatMoney(upfrontCost)} + add-on ~${formatMoney(estimatedAddonMax)}) · คะแนนคุ้มค่า ${score}/100`,
    points: points.sort((a, b) => b.score - a.score),
    upfrontCost,
    estimatedAddonMax,
    totalDealEstimate,
    budgetAfterUpfront,
    addonShareOfDeal,
    financeVoice: `「งบ ${formatMoney(human.balance)} · หลังจ่ายหน้าเหลือ ${formatMoney(budgetAfterUpfront)} · ค่าเหนื่อย ${formatMoney(wage)}/สัปดาห์ × ${contractYears} ปี」`,
    suggestedNote,
  }
}
