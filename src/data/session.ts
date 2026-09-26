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
 * Finishes a session left open on an earlier day, at the time of its last change
 * (its last set, or its start if it has none), not at the moment you notice it.
 */
export async function finishForgottenWorkout(db: EntrenoDB, workoutId: string, now = nowIso()): Promise<void> {
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
    const workout = await db.workouts.get(workoutId)
    if (!workout) return
    const wes = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
    const sets = await db.sets
      .where('workoutExerciseId')
      .anyOf(wes.map((w) => w.id))
      .toArray()
    const lastChange = sets
      .filter((s) => s.deletedAt === null)
      .reduce((max, s) => (s.updatedAt > max ? s.updatedAt : max), workout.startedAt)
    await db.workouts.update(workoutId, { finishedAt: lastChange, updatedAt: now })
  })
}

/**
 * Logically deletes a session with its exercises and sets, all stamped with the
 * same `now` so restoreWorkout can bring back exactly what this call removed.
 */
export async function deleteWorkout(db: EntrenoDB, workoutId: string, now = nowIso()): Promise<string> {
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
    const wes = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
    const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => r.deletedAt === null)
    const sets = await db.sets
      .where('workoutExerciseId')
      .anyOf(wes.map((w) => w.id))
      .toArray()
    await db.sets.bulkPut(alive(sets).map((s) => ({ ...s, deletedAt: now, updatedAt: now })))
    await db.workoutExercises.bulkPut(alive(wes).map((w) => ({ ...w, deletedAt: now, updatedAt: now })))
    await db.workouts.update(workoutId, { deletedAt: now, updatedAt: now })
  })
  return now
}

/** Undoes deleteWorkout: restores the rows deleted at `deletedAt`, leaving older deletions alone. */
export async function restoreWorkout(db: EntrenoDB, workoutId: string, deletedAt: string, now = nowIso()): Promise<void> {
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.sets], async () => {
    const wes = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
    const sets = await db.sets
      .where('workoutExerciseId')
      .anyOf(wes.map((w) => w.id))
      .toArray()
    const back = <T extends { deletedAt: string | null }>(rows: T[]) =>
      rows.filter((r) => r.deletedAt === deletedAt).map((r) => ({ ...r, deletedAt: null, updatedAt: now }))
    await db.sets.bulkPut(back(sets))
    await db.workoutExercises.bulkPut(back(wes))
    await db.workouts.update(workoutId, { deletedAt: null, updatedAt: now })
  })
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

export async function restoreSet(db: EntrenoDB, id: string, now = nowIso()): Promise<void> {
  await db.sets.update(id, { deletedAt: null, updatedAt: now })
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
