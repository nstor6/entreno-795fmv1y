// Read models for the screens, meant to run inside useLive().
import { recordsOf, type ExerciseRecord } from '../domain/history'
import { nextDay, trainedYesterday } from '../domain/nextSession'
import { isAlive, type Exercise, type Routine, type RoutineDay, type RoutineExercise, type SetLog, type Workout, type WorkoutExercise } from '../domain/types'
import { weekLabel, weekNumber } from '../domain/weeks'
import type { EntrenoDB } from './db'

export interface TodayModel {
  routine: Routine | null
  days: RoutineDay[]
  week: number | null
  weekLabel: string | null
  nextDay: RoutineDay | null
  unfinished: Workout | null
  trainedYesterday: boolean
}

export async function loadToday(db: EntrenoDB, today: string): Promise<TodayModel> {
  const routine = (await db.routines.toArray()).find((r) => r.active && isAlive(r)) ?? null
  const workouts = (await db.workouts.toArray()).filter(isAlive)
  const unfinished =
    workouts.filter((w) => w.finishedAt === null).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null
  if (!routine) {
    return { routine, days: [], week: null, weekLabel: null, nextDay: null, unfinished, trainedYesterday: false }
  }
  const days = (await db.routineDays.where('routineId').equals(routine.id).toArray())
    .filter(isAlive)
    .sort((a, b) => a.order - b.order)
  const week = weekNumber(routine.startDate, today)
  return {
    routine,
    days,
    week,
    weekLabel: weekLabel(routine.weekOverrides, week),
    nextDay: nextDay(routine.id, days, workouts),
    unfinished,
    trainedYesterday: trainedYesterday(workouts, today),
  }
}

export interface SessionExercise {
  workoutExercise: WorkoutExercise
  planned: Exercise | undefined
  plan: RoutineExercise | undefined
  sets: SetLog[]
  records: ExerciseRecord[]
}

export interface SessionModel {
  workout: Workout
  routine: Routine | undefined
  day: RoutineDay | undefined
  exercises: Map<string, Exercise>
  items: SessionExercise[]
}

export async function loadSession(db: EntrenoDB, workoutId: string): Promise<SessionModel | null> {
  const workout = await db.workouts.get(workoutId)
  if (!workout || !isAlive(workout)) return null
  const [routine, day, planRows, wes, allExercises] = await Promise.all([
    db.routines.get(workout.routineId),
    db.routineDays.get(workout.routineDayId),
    db.routineExercises.where('routineDayId').equals(workout.routineDayId).toArray(),
    db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
    db.exercises.toArray(),
  ])
  const own = wes.filter(isAlive).sort((a, b) => a.order - b.order)
  const planned = [...new Set(own.map((w) => w.plannedExerciseId))]

  const pastWes = await db.workoutExercises.where('plannedExerciseId').anyOf(planned).toArray()
  const workouts = await db.workouts.bulkGet([...new Set(pastWes.map((w) => w.workoutId))])
  const sets = await db.sets
    .where('workoutExerciseId')
    .anyOf(pastWes.map((w) => w.id))
    .toArray()

  const exercises = new Map(allExercises.map((e) => [e.id, e]))
  const alivePlan = planRows.filter(isAlive)
  const aliveWorkouts = workouts.filter((w): w is Workout => w !== undefined)
  const items = own.map((we): SessionExercise => {
    const plan =
      alivePlan.find((p) => p.exerciseId === we.plannedExerciseId && p.order === we.order) ??
      alivePlan.find((p) => p.exerciseId === we.plannedExerciseId)
    return {
      workoutExercise: we,
      planned: exercises.get(we.plannedExerciseId),
      plan,
      sets: sets.filter((s) => isAlive(s) && s.workoutExerciseId === we.id).sort((a, b) => a.setNumber - b.setNumber),
      records: recordsOf(we.plannedExerciseId, workout, aliveWorkouts, pastWes, sets),
    }
  })
  return { workout, routine, day, exercises, items }
}

export interface HistoryRow {
  workout: Workout
  routineName: string
  setCount: number
}

export async function loadHistory(db: EntrenoDB): Promise<HistoryRow[]> {
  const [workouts, routines, wes, sets] = await Promise.all([
    db.workouts.orderBy('date').reverse().toArray(),
    db.routines.toArray(),
    db.workoutExercises.toArray(),
    db.sets.toArray(),
  ])
  const routineName = new Map(routines.map((r) => [r.id, r.shortName]))
  const workoutOfWe = new Map(wes.filter(isAlive).map((w) => [w.id, w.workoutId]))
  const counts = new Map<string, number>()
  for (const s of sets) {
    if (!isAlive(s) || s.isWarmup) continue
    const w = workoutOfWe.get(s.workoutExerciseId)
    if (w) counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  return workouts
    .filter(isAlive)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt.localeCompare(a.startedAt))
    .map((workout) => ({
      workout,
      routineName: routineName.get(workout.routineId) ?? '',
      setCount: counts.get(workout.id) ?? 0,
    }))
}
