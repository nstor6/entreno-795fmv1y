// Values a new set starts with (SPEC §8): the first set takes the load from last
// time; every later set copies the previous one's load and value. The RIR is not
// copied: it's judged set by set, logging it marks the set as done (focus mode and
// rest), and a stale copied RIR would feed the progression rules a value never felt.
import type { Exercise, SetLog } from './types'

export type SetValues = Pick<SetLog, 'loadKg' | 'reps' | 'distanceM' | 'durationS' | 'rir'>

function withValue(measure: Exercise['measure'], value: number | null): Pick<SetLog, 'reps' | 'distanceM' | 'durationS'> {
  return {
    reps: measure === 'reps' ? value : null,
    distanceM: measure === 'meters' ? value : null,
    durationS: measure === 'seconds' ? value : null,
  }
}

export function draftSet(
  exercise: Pick<Exercise, 'measure' | 'bodyweight'>,
  targetMin: number,
  previous: SetLog | null,
  lastTime: SetLog | null,
  suggestedLoadKg: number | null = null,
): SetValues {
  if (previous) {
    return {
      loadKg: previous.loadKg,
      reps: previous.reps,
      distanceM: previous.distanceM,
      durationS: previous.durationS,
      rir: null,
    }
  }
  const loadKg = suggestedLoadKg ?? lastTime?.loadKg ?? (exercise.bodyweight ? 0 : null)
  return { loadKg, rir: null, ...withValue(exercise.measure, targetMin) }
}

/** Load step for the +/− buttons: the exercise increment, or 2.5 kg when it has none. */
export function loadStep(exercise: Pick<Exercise, 'loadIncrementKg'>): number {
  return exercise.loadIncrementKg ?? 2.5
}

/** Step for the value buttons: 1 rep, 5 m or 5 s. */
export function valueStep(measure: Exercise['measure']): number {
  return measure === 'reps' ? 1 : 5
}

/** Adds `delta` without float noise (62.5 + 2.5 stays 65) and never goes below 0. */
export function stepValue(value: number | null, delta: number): number {
  const next = Math.round(((value ?? 0) + delta) * 100) / 100
  return Math.max(0, next)
}
