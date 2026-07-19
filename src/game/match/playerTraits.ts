/**
 * Player Traits & PPMs — พฤติกรรมฝังหัวทับ/บวก Utility ของแผน
 * ใช้ Player.skills ที่มีอยู่เป็น PPM proxies
 */

export type PpmAction = 'pass_short' | 'pass_long' | 'dribble' | 'shoot'

/** สกิลที่ชอบแทงยาว / สลับข้าง */
const LONG_PASS_SKILLS = new Set([
  'mf_switch_field',
  'mf_killer_pass',
  'mf_progressive_pass',
  'mf_line_breaker',
  'mf_through_ball',
  'mf_deep_playmaker',
  'df_switch_play',
  'df_ball_playing',
  'df_bypass_press',
  'gk_long_kick',
  'gk_distribution',
])

/** สกิลที่ชอบเคาะสั้น / one-two */
const SHORT_PASS_SKILLS = new Set([
  'mf_one_two',
  'mf_recycle',
  'mf_screen_pass',
  'mf_dictates_tempo',
  'fw_link_up',
  'fw_false_nine',
  'gk_calm_feet',
])

/** ชอบเลี้ยง / ตัดเข้า */
const DRIBBLE_SKILLS = new Set([
  'mf_carrier',
  'mf_drive_forward',
  'fw_dribble_cut',
  'fw_solo_run',
  'fw_pace_burst',
  'df_cut_inside_fb',
  'df_carry_out',
])

/** ชอบยิงไกล / จบสกอร์ */
const SHOOT_SKILLS = new Set([
  'mf_long_shot',
  'fw_places_shots',
  'fw_power_shot',
  'fw_clinical',
  'fw_poacher',
  'fw_curler',
])

function hasAny(skills: string[] | undefined, set: Set<string>): boolean {
  if (!skills?.length) return false
  return skills.some((s) => set.has(s))
}

/**
 * คูณ utility ของแอ็กชันตาม PPM
 * >1 = กล้าขัดแผนเพื่อทำตามนิสัย
 */
export function ppmUtilityMult(skills: string[] | undefined, action: PpmAction): number {
  switch (action) {
    case 'pass_long':
      return hasAny(skills, LONG_PASS_SKILLS) ? 1.2 : 1
    case 'pass_short':
      return hasAny(skills, SHORT_PASS_SKILLS) ? 1.15 : hasAny(skills, LONG_PASS_SKILLS) ? 0.92 : 1
    case 'dribble':
      return hasAny(skills, DRIBBLE_SKILLS) ? 1.18 : 1
    case 'shoot':
      return hasAny(skills, SHOOT_SKILLS) ? 1.16 : 1
    default:
      return 1
  }
}

export function ppmNote(skills: string[] | undefined, action: PpmAction): string | null {
  if (action === 'pass_long' && hasAny(skills, LONG_PASS_SKILLS)) {
    return 'PPM · ชอบวางบอลยาว'
  }
  if (action === 'pass_short' && hasAny(skills, SHORT_PASS_SKILLS)) {
    return 'PPM · ชอบเคาะสั้น'
  }
  if (action === 'dribble' && hasAny(skills, DRIBBLE_SKILLS)) {
    return 'PPM · ชอบเลี้ยงทะลุ'
  }
  if (action === 'shoot' && hasAny(skills, SHOOT_SKILLS)) {
    return 'PPM · ชอบจบเอง'
  }
  return null
}
