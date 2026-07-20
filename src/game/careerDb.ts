/**
 * ประวัติอาชีพ Transfermarkt — เก็บใน IndexedDB
 * ไม่ bundle JSON ก้อนใหญ่เข้า JS
 */
import type {
  BodyPartId,
  InjuryRecord,
  InjuryType,
  PlayerCareerClubStint,
  PlayerCareerIntl,
  PlayerCareerProfile,
  PlayerCareerSeason,
  PlayerCareerTitle,
  PlayerCareerTransfer,
} from './types'

const DB_NAME = 'fc-manager-careers'
const DB_VERSION = 1
const STORE = 'careers'
const META_STORE = 'meta'
/** เปลี่ยนเมื่อ regenerate public/data/realPlayerCareers.json */
export const CAREER_DATA_VERSION = 2
const DATA_URL = '/data/realPlayerCareers.json'
const PROFILE_VERSION = 4 as const

export type RealCareerEntry = {
  source?: string
  tmPlayerId?: number
  seasons?: PlayerCareerSeason[]
  clubs?: PlayerCareerClubStint[]
  transfers?: PlayerCareerTransfer[]
  titles?: PlayerCareerTitle[]
  intl?: PlayerCareerIntl
  debutYear?: number | null
  summaryTh?: string
  injuries?: Array<{
    date?: string | null
    season?: number | null
    type?: string
    typeTh?: string
    bodyPart?: BodyPartId | null
    daysOut?: number
    gamesMissed?: number | null
    source?: string
    noteTh?: string | null
    chronic?: boolean
  }>
}

type CareersFile = {
  version?: number
  byName?: Record<string, RealCareerEntry>
}

let dbPromise: Promise<IDBDatabase> | null = null
let readyPromise: Promise<void> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
  return dbPromise
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly')
        const req = tx.objectStore(store).get(key)
        req.onerror = () => reject(req.error)
        req.onsuccess = () => resolve(req.result as T | undefined)
      }),
  )
}

function idbPut(store: string, key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

function idbClear(store: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).clear()
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

async function bulkPutCareers(byName: Record<string, RealCareerEntry>): Promise<void> {
  const db = await openDb()
  const names = Object.keys(byName)
  const CHUNK = 200
  for (let i = 0; i < names.length; i += CHUNK) {
    const slice = names.slice(i, i + CHUNK)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const os = tx.objectStore(STORE)
      for (const name of slice) {
        os.put(byName[name], name)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

async function importFromNetwork(): Promise<void> {
  const res = await fetch(DATA_URL)
  if (!res.ok) throw new Error(`Failed to fetch career data: ${res.status}`)
  const json = (await res.json()) as CareersFile
  const byName = json.byName ?? {}
  await idbClear(STORE)
  await bulkPutCareers(byName)
  await idbPut(META_STORE, 'dataVersion', CAREER_DATA_VERSION)
  await idbPut(META_STORE, 'fileVersion', json.version ?? 0)
  await idbPut(META_STORE, 'count', Object.keys(byName).length)
}

/** เตรียม IDB — เรียกครั้งเดียวตอนบูตเกม / ก่อนเปิด Squad */
export function ensureCareerDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve()
  }
  if (!readyPromise) {
    readyPromise = (async () => {
      const ver = await idbGet<number>(META_STORE, 'dataVersion')
      if (ver === CAREER_DATA_VERSION) return
      await importFromNetwork()
    })().catch((err) => {
      readyPromise = null
      console.warn('[careerDb] import failed', err)
      throw err
    })
  }
  return readyPromise
}

export async function getCareerByName(playerName: string): Promise<RealCareerEntry | null> {
  if (!playerName || typeof indexedDB === 'undefined') return null
  try {
    await ensureCareerDb()
    const row = await idbGet<RealCareerEntry>(STORE, playerName)
    return row ?? null
  } catch {
    return null
  }
}

function mapInjuryType(name: string | undefined): InjuryType {
  const n = (name ?? '').toLowerCase()
  if (/fracture|broken|bone|rib|fibula|tibia|metatarsal|collarbone/.test(n)) return 'bone'
  if (/ligament|acl|mcl|cruciate|sprain|ankle|knee/.test(n)) return 'ligament'
  return 'muscle'
}

function mapBodyPart(name: string | undefined): BodyPartId | undefined {
  const n = (name ?? '').toLowerCase()
  if (/hamstring|thigh|quad/.test(n)) return 'thighR'
  if (/calf|achilles/.test(n)) return 'calfR'
  if (/ankle/.test(n)) return 'ankleR'
  if (/knee/.test(n)) return 'kneeR'
  if (/groin|adductor|hip/.test(n)) return 'groin'
  if (/back|lumbar/.test(n)) return 'back'
  if (/shoulder/.test(n)) return 'shoulderR'
  if (/foot|toe|metatarsal/.test(n)) return 'footR'
  if (/abdomen|abdominal/.test(n)) return 'abdomen'
  return undefined
}

export function mapRealInjuries(real: RealCareerEntry): InjuryRecord[] {
  return (real.injuries ?? [])
    .map((inj) => {
      const label = inj.typeTh || inj.noteTh || inj.type || ''
      return {
        type: mapInjuryType(label),
        days: Math.max(1, Number(inj.daysOut) || 7),
        source: 'history' as const,
        bodyPart: inj.bodyPart ?? mapBodyPart(label),
        date: inj.date ?? undefined,
        season: inj.season ?? undefined,
        chronic: Boolean(inj.chronic),
        noteTh: inj.noteTh || inj.typeTh || undefined,
      }
    })
    .slice(0, 16)
}

/** แปลงแถว IDB → โปรไฟล์ + seasons สำหรับ UI (ไม่เขียนลงเซฟ) */
export function realCareerToView(real: RealCareerEntry, playerName: string, age = 25): {
  careerSeasons: PlayerCareerSeason[]
  careerProfile: PlayerCareerProfile
  injuryHistory: InjuryRecord[]
} {
  const seasons = (real.seasons ?? []).map((s) => ({
    season: s.season,
    label: s.label,
    clubName: s.clubName,
    leagueId: s.leagueId,
    apps: s.apps,
    goals: s.goals,
    assists: s.assists,
    minutes: s.minutes,
    yellows: s.yellows,
    reds: s.reds,
  }))
  const careerProfile: PlayerCareerProfile = {
    version: PROFILE_VERSION,
    source: 'transfermarkt',
    debutYear: real.debutYear ?? seasons[0]?.season - 1 ?? age,
    clubs: real.clubs ?? [],
    transfers: real.transfers ?? [],
    titles: real.titles ?? [],
    intl: real.intl ?? {
      nation: '—',
      nationTh: '—',
      caps: 0,
      goals: 0,
      worldCups: [],
      majorTournaments: [],
    },
    summaryTh:
      real.summaryTh ??
      `${playerName} · ข้อมูลจริง Transfermarkt · ${seasons.reduce((a, s) => a + s.apps, 0)} นัด`,
  }
  return {
    careerSeasons: seasons,
    careerProfile,
    injuryHistory: mapRealInjuries(real),
  }
}

/** เรียกตอนบูตแอปแบบไม่บล็อก UI */
export function prefetchCareerDb(): void {
  void ensureCareerDb().catch(() => {})
}
