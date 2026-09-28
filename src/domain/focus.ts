// Focus mode: which exercise of the session is open, and where to go after a set.
// Supersets (consecutive exercises with the same supersetGroup) alternate without rest
// and rest after the last exercise of the pair.

import type { RestRequest } from './rest'
import type { SetLog } from './types'

/** A set was just finished in an exercise card. */
export interface SetLogged {
  workoutExerciseId: string
  /** Working sets of that exercise counting the one just finished. */
  doneSets: number
  /** Rest to start if it's time to rest (null when the plan has no rest). */
  rest: RestRequest | null
}

export interface FocusItem {
  /** WorkoutExercise id, in session order. */
  id: string
  supersetGroup: string | null
  targetSets: number
  /** Working sets logged so far (not warm-ups), whatever exercise was done. */
  doneSets: number
}

export interface AfterSet {
  /** Exercise to open next, or null when everything is done. */
  focus: string | null
  /** Whether to start the rest countdown now. */
  rest: boolean
}

export const isComplete = (item: FocusItem) => item.doneSets >= item.targetSets

/**
 * Sets that count as finished: working sets (not warm-ups) with their RIR logged when the
 * exercise has an RIR target; without one, every working set added.
 */
export function finishedSets(sets: Pick<SetLog, 'isWarmup' | 'rir'>[], hasRirTarget: boolean): number {
  return sets.filter((s) => !s.isWarmup && (!hasRirTarget || s.rir !== null)).length
}

/** The exercises of the same superset as `id` (just itself when it has none), in order. */
export function groupOf(items: FocusItem[], id: string): FocusItem[] {
  const i = items.findIndex((x) => x.id === id)
  const item = items[i]
  if (!item) return []
  if (!item.supersetGroup) return [item]
  let start = i
  while (start > 0 && items[start - 1]!.supersetGroup === item.supersetGroup) start--
  let end = i
  while (end < items.length - 1 && items[end + 1]!.supersetGroup === item.supersetGroup) end++
  return items.slice(start, end + 1)
}

/** First exercise with sets left, in session order. */
export function firstPending(items: FocusItem[]): string | null {
  return items.find((x) => !isComplete(x))?.id ?? null
}

/** Next exercise with sets left after `id` (and its superset), wrapping to the start. */
export function nextPendingAfter(items: FocusItem[], id: string): string | null {
  const group = groupOf(items, id)
  const last = items.findIndex((x) => x.id === group[group.length - 1]?.id)
  const later = items.slice(last + 1).find((x) => !isComplete(x))
  const earlier = items.slice(0, last + 1).find((x) => !isComplete(x) && !group.includes(x))
  return (later ?? earlier)?.id ?? null
}

/**
 * Where to go after a set of `loggedId` is logged. `items` must already count that set.
 * - Superset, not the last exercise with sets left: go to the next one, no rest.
 * - Otherwise rest, then go back to the first exercise of the superset with sets left,
 *   or stay on a single exercise with sets left, or move on to the next exercise.
 */
export function afterSet(items: FocusItem[], loggedId: string): AfterSet {
  const group = groupOf(items, loggedId)
  const pos = group.findIndex((x) => x.id === loggedId)
  if (pos === -1) return { focus: firstPending(items), rest: false }

  const partner = group.slice(pos + 1).find((x) => !isComplete(x))
  if (partner) return { focus: partner.id, rest: false }

  const again = group.find((x) => !isComplete(x))
  return { focus: again?.id ?? nextPendingAfter(items, loggedId), rest: true }
}
