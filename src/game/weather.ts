import type { MatchWeather } from './types'
import { mulberry32 } from './seed'

export const WEATHER_LABEL: Record<MatchWeather, string> = {
  clear: 'แจ่มใส',
  rain: 'ฝนตก',
  wind: 'ลมแรง',
  cold: 'หนาว',
  hot: 'ร้อนจัด',
}

const WEATHERS: MatchWeather[] = ['clear', 'rain', 'wind', 'cold', 'hot']

/** น้ำหนัก: แจ่มใสมากที่สุด */
const WEIGHTS = [0.42, 0.2, 0.14, 0.12, 0.12]

export function pickWeather(seed: number): MatchWeather {
  const rng = mulberry32(seed >>> 0)
  const roll = rng()
  let acc = 0
  for (let i = 0; i < WEATHERS.length; i++) {
    acc += WEIGHTS[i]
    if (roll <= acc) return WEATHERS[i]
  }
  return 'clear'
}

export function weatherMatchModifiers(weather: MatchWeather): {
  attack: number
  defend: number
  injury: number
  /** สนามแฉะ/ร้อน — ใช้คู่กับ pitchPhysics */
  fatigue: number
} {
  switch (weather) {
    case 'rain':
      return { attack: 0.96, defend: 0.98, injury: 1.35, fatigue: 1.1 }
    case 'wind':
      return { attack: 0.94, defend: 1.02, injury: 1.05, fatigue: 1.05 }
    case 'cold':
      return { attack: 0.97, defend: 0.97, injury: 1.25, fatigue: 1.08 }
    case 'hot':
      return { attack: 0.95, defend: 0.96, injury: 1.3, fatigue: 1.35 }
    case 'clear':
    default:
      return { attack: 1, defend: 1, injury: 1, fatigue: 1 }
  }
}

export function fixtureWeatherSeed(fixtureId: string, matchday: number): number {
  let h = matchday * 7919
  for (let i = 0; i < fixtureId.length; i++) {
    h = (h * 31 + fixtureId.charCodeAt(i)) >>> 0
  }
  return h
}
