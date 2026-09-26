// Rest countdown between sets, using the rest range of the plan (restSecMin–restSecMax).

export type RestPhase = 'resting' | 'ready' | 'over'

export interface RestRequest {
  /** Exercise just done, shown in the bar. */
  name: string
  minSec: number
  maxSec: number
}

export interface RunningRest extends RestRequest {
  startedAt: number
}

export interface RestState {
  phase: RestPhase
  elapsedSec: number
  /** Seconds left until the minimum rest (0 once reached). */
  remainingSec: number
}

/** resting: before the minimum · ready: between minimum and maximum · over: past the maximum. */
export function restState(startedAtMs: number, nowMs: number, minSec: number, maxSec: number): RestState {
  const elapsedSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
  const remainingSec = Math.max(0, minSec - elapsedSec)
  const phase: RestPhase = elapsedSec < minSec ? 'resting' : elapsedSec < Math.max(minSec, maxSec) ? 'ready' : 'over'
  return { phase, elapsedSec, remainingSec }
}

/** «1:05» */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
