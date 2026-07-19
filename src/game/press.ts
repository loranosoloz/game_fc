/** @deprecated prefer `@/game/media` — kept as thin re-export for older imports */
export {
  createPressFeed,
  gossipLine,
  createMediaFeed,
  ensureMediaFeed,
  newsAfterMatch,
  newsAfterTransfer,
  newsAfterInjury,
  newsAfterYouth,
  newsAfterTitle,
  newsAfterContract,
  newsRivalResult,
  detectNewInjuries,
  generateSocialBurst,
  generateRomanoIntel,
  advanceMediaWeek,
  pushNews,
  countTodaysNews,
  adjustManagerReputation,
} from './media'

export {
  plantRomanoStory,
  maybeAiRomanoPlants,
  canPlantRomano,
  romanoPlantCost,
  romanoPlantCooldownRemaining,
  ROMANO_PLANT_COOLDOWN_DAYS,
  ROMANO_PLANT_KINDS,
} from './romanoPlant'
export type { RomanoPlantKind, PlantOpts } from './romanoPlant'
