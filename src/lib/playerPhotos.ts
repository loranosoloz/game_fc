import photosPack from '@/data/world/playerPhotos.json'

type Pack = { byName?: Record<string, string> }

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

/** แผนที่ชื่อ→รูปจาก playerPhotos.json → /players/{id}.png (id มักเป็น fmi-{fmId}) */
export function photoUrlForPlayerName(name: string): string | null {
  const id = BY_NAME[name] ?? BY_NORM[normalize(name)]
  if (!id) return null
  return `/players/${id}.png`
}

export function hasPhotoForPlayerName(name: string): boolean {
  return Boolean(BY_NAME[name] ?? BY_NORM[normalize(name)])
}

export function photoPackStats() {
  return { mapped: Object.keys(BY_NAME).length }
}
