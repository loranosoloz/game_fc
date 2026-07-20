import { SAVE_KEY } from '@/game/types'
import { loadSaveRawAsync } from '@/game/idbSave'

/** เช็คว่ามีเซฟไหม โดยไม่ดึง createNewGame / worldSeed */
export function peekHasSaveSync(): boolean {
  try {
    return Boolean(localStorage.getItem(SAVE_KEY))
  } catch {
    return false
  }
}

export async function peekHasSaveAsync(): Promise<boolean> {
  if (peekHasSaveSync()) return true
  try {
    const raw = await loadSaveRawAsync()
    return Boolean(raw)
  } catch {
    return false
  }
}
