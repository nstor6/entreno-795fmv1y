// Past records of a planned exercise (SPEC §9 definitions).
import { isAlive, type SetLog, type Workout, type WorkoutExercise } from './types'

export interface ExerciseRecord {
  workout: Workout
  workoutExercise: WorkoutExercise
  /** Alive sets of this record, by setNumber. */
  sets: SetLog[]
}

/**
 * Records of planned exercise `plannedExerciseId` from any routine, strictly
 * before `current` (by date, then start time), oldest first.
 */
export function recordsOf(
  plannedExerciseId: string,
  current: Pick<Workout, 'id' | 'date' | 'startedAt'>,
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  sets: SetLog[],
): ExerciseRecord[] {
  const workoutById = new Map(workouts.filter(isAlive).map((w) => [w.id, w]))
  const isBefore = (w: Workout) =>
    w.id !== current.id && (w.date < current.date || (w.date === current.date && w.startedAt < current.startedAt))

  const records: ExerciseRecord[] = []
  for (const we of workoutExercises) {
    if (!isAlive(we) || we.plannedExerciseId !== plannedExerciseId) continue
    const workout = workoutById.get(we.workoutId)
    if (!workout || !isBefore(workout)) continue
    const own = sets.filter((s) => isAlive(s) && s.workoutExerciseId === we.id).sort((a, b) => a.setNumber - b.setNumber)
    records.push({ workout, workoutExercise: we, sets: own })
  }
  return records.sort(
    (a, b) => a.workout.date.localeCompare(b.workout.date) || a.workout.startedAt.localeCompare(b.workout.startedAt),
  )
}

/** `lastAny`: the most recent record, however it was done (it may have no sets). */
export function lastAny(records: ExerciseRecord[]): ExerciseRecord | null {
  return records[records.length - 1] ?? null
}

/** Most recent non-warmup set done as `exerciseId` in these records, to preload a new set. */
export function lastWorkingSetAs(records: ExerciseRecord[], exerciseId: string): SetLog | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const sets = records[i]!.sets
    for (let j = sets.length - 1; j >= 0; j--) {
      const s = sets[j]!
      if (!s.isWarmup && s.exerciseId === exerciseId) return s
    }
  }
  return null
}

/** Non-warmup sets grouped by the exercise actually done, in first-seen order. */
export function workingSetsByExercise(sets: SetLog[]): { exerciseId: string; sets: SetLog[] }[] {
  const groups = new Map<string, SetLog[]>()
  for (const s of sets) {
    if (s.isWarmup || !isAlive(s)) continue
    const g = groups.get(s.exerciseId)
    if (g) g.push(s)
    else groups.set(s.exerciseId, [s])
  }
  return [...groups].map(([exerciseId, sets]) => ({ exerciseId, sets }))
}
