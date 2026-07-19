/** Minimal agent shape for set-piece resolution (avoid circular import with simulateMatch). */
export interface AgentLike {
  id: string
  name: string
  role: string
  overall: number
  attrs: {
    crossing: number
    passing: number
    technique: number
    finishing: number
    composure: number
    heading: number
    jumping: number
    strength: number
    handling: number
    reflexes: number
    aerialReach: number
  }
}
