import type { Player } from '../types'

export type TouchlineShout =
  | 'demand_more'
  | 'berate'
  | 'praise'
  | 'encourage'
  | 'focus'

export type PsychState = 'neutral' | 'motivated' | 'stressed' | 'complacent' | 'frustrated'

export interface MatchContextLite {
  homeGoals: number
  awayGoals: number
  minute: number
  humanIsHome: boolean
}

export interface AgentPsychMods {
  moraleMod: number
  focusMod: number
  aggressionMod: number
  perceptionMod: number
  state: PsychState
  expiresMinute: number
  note: string
}

export function defaultPsych(): AgentPsychMods {
  return {
    moraleMod: 1,
    focusMod: 1,
    aggressionMod: 1,
    perceptionMod: 1,
    state: 'neutral',
    expiresMinute: 0,
    note: '',
  }
}

function humanLosing(ctx: MatchContextLite): boolean {
  const hg = ctx.humanIsHome ? ctx.homeGoals : ctx.awayGoals
  const ag = ctx.humanIsHome ? ctx.awayGoals : ctx.homeGoals
  return hg < ag
}

function humanWinningBig(ctx: MatchContextLite): boolean {
  const hg = ctx.humanIsHome ? ctx.homeGoals : ctx.awayGoals
  const ag = ctx.humanIsHome ? ctx.awayGoals : ctx.homeGoals
  return hg - ag >= 2
}

function humanWinning(ctx: MatchContextLite): boolean {
  const hg = ctx.humanIsHome ? ctx.homeGoals : ctx.awayGoals
  const ag = ctx.humanIsHome ? ctx.awayGoals : ctx.homeGoals
  return hg > ag
}

/**
 * Compatibility check + per-player psych response
 * ไม่ใช่บัฟ OVR ตรงๆ
 */
export function processTouchlineShout(
  player: Player,
  shout: TouchlineShout,
  ctx: MatchContextLite,
): AgentPsychMods {
  const determination = player.growth?.determination ?? 10
  const pressureTol = (player.attrs.composure + player.attrs.decision) / 10 // ~1–20 scale proxy
  const professionalism = player.growth?.professionalism ?? 10
  const young = player.age <= 21
  const base = defaultPsych()
  const until = Math.min(90, ctx.minute + 12)

  if (shout === 'demand_more' || shout === 'berate') {
    if (humanLosing(ctx) || (!humanWinning(ctx) && ctx.minute > 60)) {
      if (determination >= 12 || professionalism >= 13) {
        return {
          ...base,
          moraleMod: 1.08,
          focusMod: 1.05,
          state: 'motivated',
          expiresMinute: until,
          note: `${player.name}: ฮึดสู้จากคำสั่งโค้ช`,
        }
      }
      if (pressureTol < 11 || young) {
        return {
          ...base,
          moraleMod: 0.95,
          focusMod: 0.9,
          perceptionMod: 0.8,
          state: 'stressed',
          expiresMinute: until,
          note: `${player.name}: กดดันจนลน`,
        }
      }
      return {
        ...base,
        moraleMod: 1.03,
        focusMod: 1.02,
        state: 'motivated',
        expiresMinute: until,
        note: `${player.name}: รับคำสั่งได้`,
      }
    }
    if (humanWinningBig(ctx)) {
      return {
        ...base,
        moraleMod: 0.9,
        aggressionMod: 1.2,
        state: 'frustrated',
        expiresMinute: until,
        note: `${player.name}: หงุดหงิด — ถูกด่าตอนนำห่าง`,
      }
    }
  }

  if (shout === 'praise' || shout === 'encourage') {
    if (humanWinningBig(ctx) && shout === 'praise') {
      return {
        ...base,
        moraleMod: 1.1,
        focusMod: 0.85,
        state: 'complacent',
        expiresMinute: until,
        note: `${player.name}: ชมจนประมาท`,
      }
    }
    if (humanLosing(ctx) && shout === 'encourage') {
      return {
        ...base,
        moraleMod: 1.06,
        focusMod: 1.04,
        state: 'motivated',
        expiresMinute: until,
        note: `${player.name}: ได้กำลังใจ`,
      }
    }
    return {
      ...base,
      moraleMod: 1.04,
      state: 'motivated',
      expiresMinute: until,
      note: `${player.name}: บรรยากาศดีขึ้น`,
    }
  }

  if (shout === 'focus') {
    if (humanWinning(ctx) && !humanWinningBig(ctx)) {
      return {
        ...base,
        focusMod: 1.08,
        moraleMod: 1.02,
        state: 'motivated',
        expiresMinute: until,
        note: `${player.name}: โฟกัสไม่ประมาท`,
      }
    }
    if (humanLosing(ctx)) {
      return {
        ...base,
        focusMod: 0.95,
        aggressionMod: 1.1,
        state: 'frustrated',
        expiresMinute: until,
        note: `${player.name}: ไม่เห็นด้วยกับคำสั่งโฟกัส`,
      }
    }
  }

  return base
}

/** ตั้งต้นจาก pre-match team talk */
export function psychFromTeamTalk(
  kind: 'calm' | 'inspire' | 'focus_weakness' | 'trust_xi' | null | undefined,
): Pick<AgentPsychMods, 'moraleMod' | 'focusMod'> {
  if (kind === 'inspire') return { moraleMod: 1.05, focusMod: 1.02 }
  if (kind === 'focus_weakness') return { moraleMod: 1.02, focusMod: 1.06 }
  if (kind === 'trust_xi') return { moraleMod: 1.03, focusMod: 1.03 }
  if (kind === 'calm') return { moraleMod: 1.02, focusMod: 1.04 }
  return { moraleMod: 1, focusMod: 1 }
}
