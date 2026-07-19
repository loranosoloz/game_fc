import photosPack from '@/data/world/coachPhotos.json'

type Pack = {
  byId?: Record<string, string>
  byName?: Record<string, string>
}

const BY_ID = (photosPack as Pack).byId ?? {}
const BY_NAME = (photosPack as Pack).byName ?? {}

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const BY_NORM: Record<string, string> = {}
for (const [name, id] of Object.entries(BY_NAME)) {
  BY_NORM[normalize(name)] = id
}

/** แผนที่โค้ช→รูป /coaches/{fotmobId}.png */
export function photoUrlForCoach(coachId?: string | null, name?: string | null): string | null {
  const id =
    (coachId && BY_ID[coachId]) ||
    (name && (BY_NAME[name] ?? BY_NORM[normalize(name)])) ||
    null
  if (!id) return null
  return `/coaches/${id}.png`
}

export function hasPhotoForCoach(coachId?: string | null, name?: string | null): boolean {
  return Boolean(photoUrlForCoach(coachId, name))
}

export function coachPhotoPackStats() {
  return { mapped: Object.keys(BY_ID).length }
}
