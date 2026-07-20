/**
 * คลังสถิติแมตช์ — IndexedDB (runtime ของเกม Vite)
 * คู่กับ MySQL schema ที่ db/schema.sql (export/sync ทีหลัง)
 */
import type { GameSave } from './types'
import type { MatchArchiveEntry } from './matchArchive'
import { appendMatchArchive, MATCH_ARCHIVE_CAP } from './matchArchive'

const DB_NAME = 'fc-manager-match-stats'
const DB_VERSION = 1
const STORE = 'matches'
/** เก็บใน JSON เซฟแค่สำรองเบา ๆ — คลังเต็มอยู่ IDB */
export const MATCH_ARCHIVE_SAVE_SLIM = 48

export type MatchStatsRow = MatchArchiveEntry & {
  careerId: string
  sortKey: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('matchStatsDb open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: ['careerId', 'id'] })
        store.createIndex('byCareer', 'careerId', { unique: false })
        store.createIndex('byCareerSort', 'sortKey', { unique: false })
        store.createIndex('byCareerMd', ['careerId', 'season', 'matchday'], { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
  return dbPromise
}

/** คีย์อาชีพคงที่ต่อเซฟ — แยกคลังสถิติระหว่างเซฟ */
export function careerIdFromSave(save: Pick<GameSave, 'createdAt' | 'humanClubId' | 'leagueId'>): string {
  return `${save.createdAt}|${save.leagueId}|${save.humanClubId}`
}

function sortKeyFor(entry: MatchArchiveEntry, careerId: string): string {
  const inv = entry.involvesHuman ? '1' : '0'
  return `${careerId}|${String(9999 - entry.season).padStart(4, '0')}|${String(999 - entry.matchday).padStart(3, '0')}|${entry.date}|${inv}|${entry.id}`
}

function toRow(careerId: string, entry: MatchArchiveEntry): MatchStatsRow {
  return {
    ...entry,
    careerId,
    sortKey: sortKeyFor(entry, careerId),
  }
}

export async function putMatchStatsBatch(
  careerId: string,
  entries: MatchArchiveEntry[],
): Promise<void> {
  if (!entries.length) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const e of entries) store.put(toRow(careerId, e))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listMatchStats(
  careerId: string,
  opts?: { limit?: number },
): Promise<MatchArchiveEntry[]> {
  const db = await openDb()
  const limit = opts?.limit ?? MATCH_ARCHIVE_CAP
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const idx = tx.objectStore(STORE).index('byCareer')
    const req = idx.getAll(IDBKeyRange.only(careerId))
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const rows = (req.result as MatchStatsRow[]) ?? []
      rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      resolve(
        rows.slice(0, limit).map(({ careerId: _c, sortKey: _s, ...entry }) => entry),
      )
    }
  })
}

export async function countMatchStats(careerId: string): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).index('byCareer').count(IDBKeyRange.only(careerId))
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
  })
}

export async function clearMatchStatsForCareer(careerId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const idx = store.index('byCareer')
    const req = idx.openCursor(IDBKeyRange.only(careerId))
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearAllMatchStats(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** ย้ายคลังจาก JSON เซฟเข้า IDB ครั้งแรก แล้วคืนคลังเต็ม */
export async function ensureMatchStatsHydrated(save: GameSave): Promise<MatchArchiveEntry[]> {
  const careerId = careerIdFromSave(save)
  const fromSave = save.matchArchive ?? []
  let fromDb: MatchArchiveEntry[] = []
  try {
    fromDb = await listMatchStats(careerId)
  } catch {
    fromDb = []
  }
  if (fromSave.length && fromDb.length < fromSave.length) {
    try {
      await putMatchStatsBatch(careerId, fromSave)
      fromDb = await listMatchStats(careerId)
    } catch {
      /* IDB ใช้ไม่ได้ — คืนจากเซฟ */
      return appendMatchArchive([], fromSave)
    }
  }
  if (fromDb.length) return fromDb
  return fromSave
}

/** เขียนแบตช์เข้า IDB + คืนคลังบางสำหรับฝังในเซฟ */
export function persistMatchArchiveSideEffect(
  save: GameSave,
  batch: MatchArchiveEntry[],
): MatchArchiveEntry[] {
  const careerId = careerIdFromSave(save)
  if (batch.length) {
    void putMatchStatsBatch(careerId, batch).catch(() => {
      /* */
    })
  }
  return slimMatchArchiveForSave(appendMatchArchive(save.matchArchive, batch))
}

export function slimMatchArchiveForSave(
  archive: MatchArchiveEntry[] | null | undefined,
): MatchArchiveEntry[] {
  const list = archive ?? []
  if (list.length <= MATCH_ARCHIVE_SAVE_SLIM) return list
  const human = list.filter((e) => e.involvesHuman)
  const ai = list.filter((e) => !e.involvesHuman)
  const keepHuman = human.slice(0, Math.min(32, MATCH_ARCHIVE_SAVE_SLIM))
  const keepAi = ai.slice(0, Math.max(0, MATCH_ARCHIVE_SAVE_SLIM - keepHuman.length))
  return appendMatchArchive([], [...keepHuman, ...keepAi]).slice(0, MATCH_ARCHIVE_SAVE_SLIM)
}
