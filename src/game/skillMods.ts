/**
 * เอฟเฟกต์เชิงกลไกของแต่ละพลังแฝง
 * ค่าเป็นน้ำหนักสัมพัทธ์ — รวมใน XI แล้วคูณเข้าแมตช์ (มี soft-cap)
 */
export type SkillModKey =
  | 'attack'
  | 'defend'
  | 'finish'
  | 'create'
  | 'aerial'
  | 'setpiece'
  | 'pace'
  | 'press'
  | 'dribble'
  | 'duel'
  | 'save'
  | 'claim'
  | 'distribute'
  | 'focus'

export type SkillMods = Partial<Record<SkillModKey, number>>

/** น้ำหนักต่อสกิล (จะคูณด้วย power ของสกิลใน catalog) */
export const SKILL_MODS: Record<string, SkillMods> = {
  // ── GK ──
  gk_shot_stopper: { defend: 1, save: 1.4 },
  gk_reflex_wall: { defend: 1, save: 1.5 },
  gk_one_on_one: { defend: 0.8, save: 1.2, duel: 0.4 },
  gk_command_box: { defend: 0.7, claim: 1.3, aerial: 0.5 },
  gk_sweep_keeper: { defend: 0.8, pace: 0.6, claim: 0.5 },
  gk_long_throw: { attack: 0.5, distribute: 0.8, pace: 0.3 },
  gk_penalty_hero: { defend: 0.6, save: 1.1, focus: 0.8 },
  gk_calm_feet: { defend: 0.4, distribute: 0.7, focus: 0.5 },
  gk_cross_claimer: { defend: 0.7, claim: 1.5, aerial: 0.6 },
  gk_distribution: { attack: 0.7, distribute: 1.4, create: 0.4 },
  gk_long_kick: { attack: 0.6, distribute: 1.1, aerial: 0.3 },
  gk_rush_out: { defend: 0.7, pace: 0.5, duel: 0.5, save: 0.4 },
  gk_parry_wide: { defend: 0.5, save: 0.9 },
  gk_catch_clean: { defend: 0.6, claim: 1.2, focus: 0.4 },
  gk_low_dive: { defend: 0.7, save: 1.1 },
  gk_high_claim: { defend: 0.5, claim: 1.4, aerial: 0.7 },

  // ── DF ──
  df_last_man: { defend: 1.4, duel: 0.8, focus: 0.5 },
  df_aerial_duel: { defend: 1, aerial: 1.5, duel: 0.5 },
  df_slide_tackle: { defend: 0.9, duel: 1 },
  df_ball_playing: { attack: 0.9, create: 1, distribute: 0.6 },
  df_man_mark: { defend: 1.3, duel: 1, press: 0.3 },
  df_intercept: { defend: 1, press: 0.5, focus: 0.4 },
  df_overlap_wing: { attack: 0.9, pace: 0.8, create: 0.4 },
  df_whipped_cross: { attack: 0.8, create: 0.7, setpiece: 0.5, aerial: 0.3 },
  df_long_throw_in: { attack: 0.4, setpiece: 1.2, aerial: 0.4 },
  df_block_shot: { defend: 1, duel: 0.6 },
  df_recovery_pace: { defend: 0.9, pace: 1.1 },
  df_leadership_back: { defend: 0.8, focus: 1.2 },
  df_press_resist: { defend: 0.7, duel: 0.5, distribute: 0.5 },
  df_switch_play: { attack: 0.5, create: 0.8, distribute: 0.6 },
  df_setpiece_wall: { defend: 0.5, setpiece: 0.9 },
  df_aggressive_step: { defend: 0.8, press: 0.9, duel: 0.6 },
  df_cover_shadow: { defend: 1, focus: 0.5 },
  df_cut_inside_fb: { attack: 0.9, dribble: 0.7, finish: 0.3 },
  df_early_cross: { attack: 0.6, create: 0.7 },
  df_tackle_clean: { defend: 0.9, duel: 0.8 },
  df_hold_line: { defend: 1, focus: 0.6 },
  df_physical_duel: { defend: 0.9, duel: 1.2, aerial: 0.4 },
  df_carry_out: { attack: 0.8, dribble: 0.7, distribute: 0.4 },
  df_channel_wide: { defend: 0.6, press: 0.5 },
  df_second_ball: { defend: 0.8, duel: 0.7, aerial: 0.4 },
  df_night_watch: { defend: 0.5, focus: 1.3 },
  df_bypass_press: { attack: 0.7, distribute: 0.9, create: 0.4 },
  df_box_clearance: { defend: 1, aerial: 0.5 },
  df_underlap: { attack: 0.6, create: 0.5, pace: 0.4 },
  df_duel_winner: { defend: 1.2, duel: 1.4 },
  df_step_up_trap: { defend: 0.9, focus: 0.7 },
  df_blocking_lane: { defend: 0.8, duel: 0.5 },
  df_fullback_cutback: { attack: 0.7, create: 0.9 },
  df_center_build: { attack: 0.6, create: 0.7, distribute: 0.8 },
  df_wide_lock: { defend: 0.8, duel: 0.6, press: 0.4 },

  // ── MF ──
  mf_deep_playmaker: { attack: 1.1, create: 1.5, distribute: 0.6 },
  mf_box_to_box: { attack: 0.9, defend: 0.9, pace: 0.6, duel: 0.5 },
  mf_through_ball: { attack: 1, create: 1.4, finish: 0.2 },
  mf_press_engine: { defend: 0.9, press: 1.4 },
  mf_dictates_tempo: { attack: 0.8, create: 1, focus: 0.5 },
  mf_long_shot: { attack: 0.8, finish: 1 },
  mf_setpiece_taker: { attack: 0.7, setpiece: 1.5, create: 0.4 },
  mf_shield_defense: { defend: 1.3, duel: 0.8 },
  mf_carrier: { attack: 0.8, dribble: 1.2, pace: 0.4 },
  mf_late_box_run: { attack: 0.8, finish: 0.9, pace: 0.4 },
  mf_switch_field: { attack: 0.7, create: 0.9, distribute: 0.7 },
  mf_interception: { defend: 0.9, press: 0.6, focus: 0.4 },
  mf_one_two: { attack: 0.5, create: 0.6, dribble: 0.4 },
  mf_hold_ball: { attack: 0.6, duel: 0.5, create: 0.4 },
  mf_wide_creator: { attack: 0.8, create: 1.1, dribble: 0.4 },
  mf_track_back: { defend: 0.9, pace: 0.5, press: 0.4 },
  mf_killer_pass: { attack: 1.1, create: 1.5 },
  mf_second_striker_link: { attack: 0.8, create: 0.9, finish: 0.4 },
  mf_foul_smart: { defend: 0.5, press: 0.6, focus: 0.4 },
  mf_corner_delivery: { attack: 0.5, setpiece: 1.3, create: 0.4 },
  mf_press_bait: { attack: 0.7, create: 0.8, dribble: 0.4 },
  mf_cover_shadow_mid: { defend: 0.9, focus: 0.5 },
  mf_drive_forward: { attack: 0.8, pace: 0.7, dribble: 0.5 },
  mf_recycle: { attack: 0.5, create: 0.5, focus: 0.3 },
  mf_half_space: { attack: 0.8, create: 0.9, finish: 0.3 },
  mf_duel_mid: { defend: 0.8, duel: 1.2 },
  mf_vision_scan: { attack: 0.7, create: 1.1, focus: 0.4 },
  mf_counter_spark: { attack: 0.9, pace: 1, create: 0.6 },
  mf_anchor: { defend: 1.3, duel: 0.7, focus: 0.5 },
  mf_progressive_pass: { attack: 0.9, create: 1.1 },
  mf_no_look_pass: { attack: 0.5, create: 1 },
  mf_line_breaker: { attack: 0.8, create: 1, finish: 0.2 },
  mf_screen_pass: { attack: 0.4, create: 0.6, defend: 0.3 },
  mf_box_crash: { attack: 0.7, finish: 0.8, aerial: 0.4 },
  mf_wide_track: { defend: 0.6, press: 0.7, pace: 0.4 },

  // ── FW ──
  fw_poacher: { attack: 1.2, finish: 1.6 },
  fw_places_shots: { attack: 1.1, finish: 1.5 },
  fw_power_shot: { attack: 0.9, finish: 1.1 },
  fw_first_touch: { attack: 0.8, finish: 0.6, dribble: 0.5, create: 0.3 },
  fw_hold_up: { attack: 0.7, create: 0.8, duel: 0.6, aerial: 0.4 },
  fw_runs_in_behind: { attack: 1.1, pace: 1.2, finish: 0.6 },
  fw_aerial_threat: { attack: 0.9, aerial: 1.5, finish: 0.7 },
  fw_dribble_cut: { attack: 0.9, dribble: 1.3, finish: 0.4 },
  fw_clinical: { attack: 1.2, finish: 1.6, focus: 0.4 },
  fw_link_up: { attack: 0.7, create: 1, finish: 0.2 },
  fw_press_forward: { defend: 0.8, press: 1.3 },
  fw_weak_foot: { attack: 0.8, finish: 0.9 },
  fw_chip_finish: { attack: 0.5, finish: 0.8 },
  fw_volley: { attack: 0.7, finish: 0.9, aerial: 0.4 },
  fw_channel_run: { attack: 0.8, pace: 0.9, create: 0.3 },
  fw_drop_deep: { attack: 0.7, create: 1, dribble: 0.3 },
  fw_penalty_ice: { attack: 0.4, finish: 0.7, setpiece: 1.2, focus: 0.8 },
  fw_near_post: { attack: 0.8, finish: 0.9, aerial: 0.5, setpiece: 0.4 },
  fw_far_post: { attack: 0.8, finish: 0.9, aerial: 0.6, setpiece: 0.5 },
  fw_spin_marker: { attack: 0.8, dribble: 0.9, duel: 0.4 },
  fw_pace_burst: { attack: 0.8, pace: 1.3, dribble: 0.4 },
  fw_target_man: { attack: 0.8, aerial: 1.2, duel: 0.7, create: 0.4 },
  fw_false_nine: { attack: 0.8, create: 1.2, dribble: 0.4 },
  fw_cutback: { attack: 0.7, create: 1.1 },
  fw_acrobatic: { attack: 0.5, finish: 0.7, aerial: 0.5 },
  fw_occupy_cb: { attack: 0.7, create: 0.6, duel: 0.4 },
  fw_rebound_hunter: { attack: 0.8, finish: 1.1, focus: 0.4 },
  fw_solo_run: { attack: 0.9, dribble: 1.2, pace: 0.7, finish: 0.4 },
  fw_composure_box: { attack: 1.1, finish: 1.5, focus: 0.7 },
  fw_wide_finisher: { attack: 0.9, finish: 1, dribble: 0.5 },
  fw_tap_in_king: { attack: 0.7, finish: 1.3 },
  fw_curler: { attack: 0.7, finish: 1 },
  fw_overhead: { attack: 0.5, finish: 0.8, aerial: 0.9 },
  fw_smart_offside: { attack: 0.6, pace: 0.5, focus: 0.7 },
  fw_post_up: { attack: 0.6, duel: 0.8, create: 0.5 },
}

export const MOD_LABELS_TH: Record<SkillModKey, string> = {
  attack: 'รุก',
  defend: 'รับ',
  finish: 'จบสกอร์',
  create: 'สร้างโอกาส',
  aerial: 'ลูกกลางอากาศ',
  setpiece: 'ลูกตั้ง',
  pace: 'สปีด/โต้กลับ',
  press: 'เพรส',
  dribble: 'เลี้ยง',
  duel: 'คู่ต่อสู้',
  save: 'เซฟ',
  claim: 'เก็บลูก',
  distribute: 'แจกบอล',
  focus: 'สมาธิ',
}

/** สเกลน้ำหนัก → % ในแมตช์ (ก่อน soft-cap) */
export const MOD_SCALE = 0.0035

export const MOD_SOFT_CAP: Record<SkillModKey, number> = {
  attack: 0.18,
  defend: 0.18,
  finish: 0.16,
  create: 0.14,
  aerial: 0.14,
  setpiece: 0.16,
  pace: 0.12,
  press: 0.12,
  dribble: 0.12,
  duel: 0.14,
  save: 0.2,
  claim: 0.14,
  distribute: 0.1,
  focus: 0.1,
}

export type XiSkillProfile = Record<SkillModKey, number>

export function emptySkillProfile(): XiSkillProfile {
  return {
    attack: 1,
    defend: 1,
    finish: 1,
    create: 1,
    aerial: 1,
    setpiece: 1,
    pace: 1,
    press: 1,
    dribble: 1,
    duel: 1,
    save: 1,
    claim: 1,
    distribute: 1,
    focus: 1,
  }
}

export function describeMods(mods: SkillMods, power: number): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(mods) as [SkillModKey, number][]) {
    if (!v) continue
    const strength = v * power
    const tier = strength >= 3.5 ? 'แรง' : strength >= 2 ? 'กลาง' : 'เบา'
    parts.push(`${MOD_LABELS_TH[k]} ${tier}`)
  }
  return parts.length ? parts.join(' · ') : 'โบนัสเล็กน้อย'
}
