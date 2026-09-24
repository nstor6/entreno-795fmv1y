// Session writes. Every change is saved at once (SPEC §2 «Autoguardado»).
import { newId } from '../domain/ids'
import type { SetLog, Workout, WorkoutExercise } from '../domain/types'
import { buildWorkout } from '../domain/workout'
import type { SetValues } from '../domain/setDraft'
import type { EntrenoDB } from './db'

const nowIso = () => new Date().toISOString()

/** Creates the Workout and its WorkoutExercises with the day's target. Returns the workout id. */
export async function startWorkout(db: EntrenoDB, routineDayId: string, date: string, now = nowIso()): Promise<string> {
  return db.transaction('rw', [db.routines, db.routineDays, db.routineExercises, db.workouts, db.workoutExercises], async () => {
    const day = await db.routineDays.get(routineDayId)
    if (!day || day.deletedAt) throw new Error('Ese día ya no está en la rutina.')
    const routine = await db.routines.get(day.routineId)
    if (!routine || routine.deletedAt) throw new Error('No encuentro la rutina de ese día.')
    const res = await db.routineExercises.where('routineDayId').equals(day.id).toArray()
    const { workout, workoutExercises } = buildWorkout(routine, day, res, date, now)
    await db.workouts.add(workout)
    await db.workoutExercises.bulkAdd(workoutExercises)
    return workout.id
  })
}

export async function finishWorkout(db: EntrenoDB, workoutId: string, now = nowIso()): Promise<void> {
  await db.workouts.update(workoutId, { finishedAt: now, updatedAt: now })
}

export async function reopenWorkout(db: EntrenoDB, workoutId: string, now = nowIso()): Promise<void> {
  await db.workouts.update(workoutId, { finishedAt: null, updatedAt: now })
}

/**
 * Adds a set. `values` may be a function of the previous alive set, read inside
 * the same transaction so it sees every change already queued for that set.
 */
export async function addSet(
  db: EntrenoDB,
  workoutExerciseId: string,
  exerciseId: string,
  values: SetValues | ((previous: SetLog | null) => SetValues),
  now = nowIso(),
): Promise<SetLog> {
  return db.transaction('rw', db.sets, async () => {
    const existing = await db.sets.where('workoutExerciseId').equals(workoutExerciseId).toArray()
    const setNumber = Math.max(0, ...existing.map((s) => s.setNumber)) + 1
    const previous =
      existing.filter((s) => s.deletedAt === null).sort((a, b) => b.setNumber - a.setNumber)[0] ?? null
    if (typeof values === 'function') values = values(previous)
    const set: SetLog = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      workoutExerciseId,
      exerciseId,
      setNumber,
      isWarmup: false,
      kneePain: null,
      note: '',
      ...values,
    }
    await db.sets.add(set)
    return set
  })
}

export type SetPatch = Partial<Pick<SetLog, 'loadKg' | 'reps' | 'distanceM' | 'durationS' | 'rir' | 'isWarmup' | 'kneePain' | 'exerciseId' | 'note'>>

export async function updateSet(db: EntrenoDB, id: string, patch: SetPatch, now = nowIso()): Promise<void> {
  await db.sets.update(id, { ...patch, updatedAt: now })
}

export async function deleteSet(db: EntrenoDB, id: string, now = nowIso()): Promise<void> {
  await db.sets.update(id, { deletedAt: now, updatedAt: now })
}

export async function updateWorkoutExercise(
  db: EntrenoDB,
  id: string,
  patch: Partial<Pick<WorkoutExercise, 'notes'>>,
  now = nowIso(),
): Promise<void> {
  await db.workoutExercises.update(id, { ...patch, updatedAt: now })
}

export async function updateWorkout(db: EntrenoDB, id: string, patch: Partial<Pick<Workout, 'notes'>>, now = nowIso()): Promise<void> {
  await db.workouts.update(id, { ...patch, updatedAt: now })
}
