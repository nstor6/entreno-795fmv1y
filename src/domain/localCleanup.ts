// Housekeeping of per-device screen notes in localStorage. It never touches the database:
// sessions, sets, diary and measurements stay forever (progression needs them).
import { addDays } from './dates'
import type { Workout, WorkoutExercise } from './types'

/** Session notes are kept this long after the session is finished or deleted. */
export const SESSION_NOTES_KEEP_DAYS = 7
/** Edited weekly summaries are kept this many weeks. */
export const SUMMARY_KEEP_WEEKS = 12

const PER_WORKOUT = /^entreno:(warmup|rest|focus):(.+)$/
const PER_WORKOUT_EXERCISE = /^entreno:alt:(.+)$/
const SUMMARY = /^entreno:summary:(\d{4}-\d{2}-\d{2})$/

/**
 * localStorage keys that are safe to remove: screen notes of sessions finished or deleted
 * more than SESSION_NOTES_KEEP_DAYS ago (or of sessions that no longer exist), and summary
 * drafts older than SUMMARY_KEEP_WEEKS. Open sessions and every other key are left alone.
 */
export function staleLocalKeys(
  keys: string[],
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  today: string,
): string[] {
  const byId = new Map(workouts.map((w) => [w.id, w]))
  const workoutOfWe = new Map(workoutExercises.map((we) => [we.id, we.workoutId]))
  const cutoff = addDays(today, -SESSION_NOTES_KEEP_DAYS)

  const workoutIsStale = (workoutId: string | undefined): boolean => {
    const w = workoutId ? byId.get(workoutId) : undefined
    if (!w) return true // unknown session: nothing can use its notes
    const closedAt = w.deletedAt ?? w.finishedAt
    return closedAt !== null && closedAt.slice(0, 10) < cutoff
  }

  return keys.filter((key) => {
    let m = PER_WORKOUT.exec(key)
    if (m) return workoutIsStale(m[2])
    m = PER_WORKOUT_EXERCISE.exec(key)
    if (m) return workoutIsStale(workoutOfWe.get(m[1]!))
    m = SUMMARY.exec(key)
    if (m) return m[1]! < addDays(today, -7 * SUMMARY_KEEP_WEEKS)
    return false
  })
}
