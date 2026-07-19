import type { GameSave } from './types'
import { SAVE_KEY } from './types'

const IDB_NAME = 'fc-manager-db'
const IDB_STORE = 'saves'
const IDB_KEY = 'current'

/** คีย์เก่าที่กินโควตา localStorage */
const LEGACY_SAVE_KEYS = [
  'fc-manager-save-v5',
  'fc-manager-save-v4',
  'fc-manager-save-v3',
  'fc-manager-save-v2',
  'fc-manager-save-v1',
]

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function clearLegacyLocalStorage() {
  for (const k of LEGACY_SAVE_KEYS) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* */
    }
  }
}

/**
 * ตัดก้อนหนักออกก่อนใส่ localStorage (โควตา ~5MB)
 * IndexedDB ยังเก็บเซฟเต็ม
 */
function slimForLocalStorage(rawFull: string): string | null {
  try {
    const save = JSON.parse(rawFull) as GameSave
    const slim: GameSave = {
      ...save,
      players: save.players.map((p) => {
        if (!p.fmInside && !p.bio) return p
        const { fmInside: _fm, bio, ...rest } = p
        return {
          ...rest,
          bio: bio?.nationality ? { nationality: bio.nationality } : null,
        }
      }),
      matchdayChronicle: (save.matchdayChronicle ?? []).slice(0, 20),
      playerMoveLog: (save.playerMoveLog ?? []).slice(0, 80),
      inbox: (save.inbox ?? []).slice(0, 25),
      dailyLogs: (save.dailyLogs ?? []).slice(0, 40),
    }
    return JSON.stringify(slim)
  } catch {
    return null
  }
}

function tryWriteLocalStorage(rawFull: string): boolean {
  clearLegacyLocalStorage()
  try {
    localStorage.setItem(SAVE_KEY, rawFull)
    return true
  } catch {
    /* quota — ลองเวอร์ชันบาง */
  }
  const slim = slimForLocalStorage(rawFull)
  if (slim) {
    try {
      localStorage.setItem(SAVE_KEY, slim)
      return true
    } catch {
      /* still too big */
    }
  }
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* */
  }
  // ใส่ตัวชี้ว่าเซฟจริงอยู่ใน IDB — ไม่ให้โหลดพัง
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ __idbOnly: true, version: 6, tip: 'full save in IndexedDB' }),
    )
  } catch {
    /* localStorage เต็มสนิท — พึ่ง IDB อย่างเดียว */
  }
  return false
}

async function writeIdb(raw: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(raw, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/** เขียน IndexedDB (หลัก) + localStorage สำรองแบบไม่โยน error */
export async function persistSaveAsync(save: GameSave): Promise<void> {
  const raw = JSON.stringify(save)
  try {
    await writeIdb(raw)
  } catch {
    /* IDB unavailable */
  }
  tryWriteLocalStorage(raw)
}

export async function loadSaveRawAsync(): Promise<string | null> {
  try {
    const db = await openDb()
    const raw = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => resolve((req.result as string) ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    if (raw) return raw
  } catch {
    /* fall through */
  }
  try {
    const ls = localStorage.getItem(SAVE_KEY)
    if (!ls) return null
    // stub ชี้ IDB — ไม่ใช่เซฟจริง
    if (ls.includes('"__idbOnly"')) return null
    return ls
  } catch {
    return null
  }
}

/** sync path ที่เกมเรียก — ห้าม throw QuotaExceeded */
export function persistSaveSync(save: GameSave) {
  const raw = JSON.stringify(save)
  // IDB ก่อน (async) — localStorage เป็นสำรองเบาๆ
  void writeIdb(raw).catch(() => {
    /* */
  })
  tryWriteLocalStorage(raw)
}

export function clearAllSaves() {
  clearLegacyLocalStorage()
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* */
  }
  void openDb().then((db) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(IDB_KEY)
    db.close()
  })
}
