/**
 * Alias: fill gaps from FMInside faces (same as downloadPlayerPhotos).
 * Usage: node scripts/downloadFmInsideFaces.mjs [--league=esp]
 */
import { spawnSync } from 'child_process'

const extra = process.argv.slice(2)
const r = spawnSync(process.execPath, ['scripts/downloadPlayerPhotos.mjs', ...extra], {
  stdio: 'inherit',
  cwd: process.cwd(),
})
process.exit(r.status ?? 1)
