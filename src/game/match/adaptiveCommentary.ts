/**
 * Adaptive Match Commentary — แปลง State Change เป็นข้อความเตือนโค้ช
 */

export type CommentarySide = 'home' | 'away'

export interface AdaptiveHint {
  text: string
  side: CommentarySide
  kind: 'underload' | 'crowd' | 'counter' | 'fatigue' | 'ppm'
}

/** นับ underload ติดต่อกันต่อฝั่ง */
export class UnderloadTracker {
  private ticks = { home: 0, away: 0 }

  /** คืน hint เมื่อครบ threshold ticks */
  observe(
    side: CommentarySide,
    underloaded: boolean,
    threshold = 3,
  ): AdaptiveHint | null {
    if (!underloaded) {
      this.ticks[side] = 0
      return null
    }
    this.ticks[side] += 1
    if (this.ticks[side] < threshold) return null
    this.ticks[side] = 0
    const wing = side === 'home' ? 'แบ็ก/ปีกซ้าย-ขวาฝั่งเรา' : 'แนวรับฝั่งตรงข้าม'
    return {
      side,
      kind: 'underload',
      text:
        side === 'home'
          ? `${wing} กำลังโดนรุมบุกต่อเนื่อง! ควรสั่งปีกถอยช่วยหรือปรับความกว้าง`
          : `เราสร้าง Numerical Overload ริมเส้น — กดต่อเนื่องได้`,
    }
  }
}

export function crowdCommentary(intensity: number, isHome: boolean): string | null {
  if (intensity < 0.7 || isHome) return null
  return 'เสียงเชียร์เจ้าบ้านกดดัน — นักเตะใจไม่นิ่งอาจมองช่องส่งแคบลง'
}

export function lateHomeFightCommentary(trailing: boolean, minute: number): string | null {
  if (!trailing || minute < 85) return null
  return 'เจ้าบ้านฮึดช่วงท้าย! ความเหนื่อยล้าเฉียบพลันฟื้นตัวจากเสียงเชียร์'
}
