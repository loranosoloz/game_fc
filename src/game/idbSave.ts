import type { GameSave } from './types'
import { SAVE_KEY } from './types'

const IDB_NAME = 'fc-manager-db'
const IDB_STORE = 'saves'
const IDB_KEY = 'current'

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

/** เขียน IndexedDB + localStorage สำรอง */
export async function persistSaveAsync(save: GameSave): Promise<void> {
  const raw = JSON.stringify(save)
  try {
    localStorage.setItem(SAVE_KEY, raw)
  } catch {
    /* quota */
  }
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(raw, IDB_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    /* IDB unavailable */
  }
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
    return localStorage.getItem(SAVE_KEY)
  } catch {
    return null
  }
}

export function persistSaveSync(save: GameSave) {
  const raw = JSON.stringify(save)
  localStorage.setItem(SAVE_KEY, raw)
  void persistSaveAsync(save)
}

export function clearAllSaves() {
  try {
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem('fc-manager-save-v5')
    localStorage.removeItem('fc-manager-save-v4')
    localStorage.removeItem('fc-manager-save-v3')
    localStorage.removeItem('fc-manager-save-v2')
    localStorage.removeItem('fc-manager-save-v1')
  } catch {
    /* */
  }
  void openDb().then((db) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(IDB_KEY)
    db.close()
  })
}
