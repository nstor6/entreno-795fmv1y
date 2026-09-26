// Progress charts data (SPEC §11). Pure functions: tables in, points out.
import { addDays } from './dates'
import { isAlive, type DailyLog, type Exercise, type Measurement, type SetLog, type Workout, type WorkoutExercise } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Estimated 1RM: load × (1 + (reps + RIR) / 30). Without RIR, 0 is used. */
export function e1rm(loadKg: number, reps: number, rir: number | null): number {
  return round2(loadKg * (1 + (reps + (rir ?? 0)) / 30))
}

/** Body weight on a date: the latest measurement with a weight on or before it. */
export function bodyweightOn(date: string, measurements: Measurement[]): number | null {
  let best: Measurement | null = null
  for (const m of measurements) {
    if (!isAlive(m) || m.weightKg === null || m.date > date) continue
    if (!best || m.date > best.date || (m.date === best.date && m.createdAt > best.createdAt)) best = m
  }
  return best?.weightKg ?? null
}

export interface E1rmPoint {
  date: string
  workoutId: string
  value: number
  /** The set that gave the best estimate. */
  set: SetLog
  /** Load used in the formula (body weight + ballast for bodyweight exercises). */
  loadKg: number
}

/**
 * Best e1RM per session among the working sets done as `exercise` (its own id,
 * not as an alternative). Only for exercises measured in reps. Bodyweight sessions
 * without a known body weight are skipped.
 */
export function e1rmSeries(
  exercise: Pick<Exercise, 'id' | 'measure' | 'bodyweight'>,
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  sets: SetLog[],
  measurements: Measurement[],
): E1rmPoint[] {
  if (exercise.measure !== 'reps') return []
  const workoutById = new Map(workouts.filter(isAlive).map((w) => [w.id, w]))
  const workoutOfWe = new Map<string, Workout>()
  for (const we of workoutExercises) {
    const w = isAlive(we) ? workoutById.get(we.workoutId) : undefined
    if (w) workoutOfWe.set(we.id, w)
  }

  const best = new Map<string, E1rmPoint>()
  for (const s of sets) {
    if (!isAlive(s) || s.isWarmup || s.exerciseId !== exercise.id || s.reps === null) continue
    const w = workoutOfWe.get(s.workoutExerciseId)
    if (!w) continue
    let load: number
    if (exercise.bodyweight) {
      const body = bodyweightOn(w.date, measurements)
      if (body === null) continue
      load = body + (s.loadKg ?? 0)
    } else {
      if (s.loadKg === null) continue
      load = s.loadKg
    }
    const value = e1rm(load, s.reps, s.rir)
    const current = best.get(w.id)
    if (!current || value > current.value) best.set(w.id, { date: w.date, workoutId: w.id, value, set: s, loadKg: load })
  }
  return [...best.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || workoutById.get(a.workoutId)!.startedAt.localeCompare(workoutById.get(b.workoutId)!.startedAt),
  )
}

export interface SessionRecord {
  exerciseId: string
  value: number
  previous: number
}

/**
 * Exercises of a session whose best e1RM beats every earlier session of that
 * exercise. A first time is not a record: there is nothing to beat.
 */
export function sessionRecords(
  workoutId: string,
  exercises: Exercise[],
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  sets: SetLog[],
  measurements: Measurement[],
): SessionRecord[] {
  const workout = workouts.find((w) => w.id === workoutId && isAlive(w))
  if (!workout) return []
  const ownWes = workoutExercises.filter((we) => isAlive(we) && we.workoutId === workoutId).sort((a, b) => a.order - b.order)
  const weOrder = new Map(ownWes.map((we, i) => [we.id, i]))
  // Exercises done in this session, in session order.
  const done = new Map<string, number>()
  for (const s of sets) {
    const order = weOrder.get(s.workoutExerciseId)
    if (order === undefined || !isAlive(s) || s.isWarmup) continue
    done.set(s.exerciseId, Math.min(done.get(s.exerciseId) ?? Infinity, order))
  }
  const startedAt = new Map(workouts.map((w) => [w.id, w.startedAt]))
  const isEarlier = (p: E1rmPoint) => p.date < workout.date || (p.date === workout.date && startedAt.get(p.workoutId)! < workout.startedAt)

  const out: (SessionRecord & { order: number })[] = []
  for (const [exerciseId, order] of done) {
    const exercise = exercises.find((e) => e.id === exerciseId && isAlive(e))
    if (!exercise) continue
    const points = e1rmSeries(exercise, workouts, workoutExercises, sets, measurements)
    const now = points.find((p) => p.workoutId === workoutId)
    const before = points.filter(isEarlier)
    if (!now || before.length === 0) continue
    const previous = Math.max(...before.map((p) => p.value))
    if (now.value > previous) out.push({ exerciseId, value: now.value, previous, order })
  }
  return out.sort((a, b) => a.order - b.order).map(({ order: _order, ...r }) => r)
}

/** Exercises (measured in reps) with at least one set logged as themselves, in catalog order. */
export function exercisesWithSets(exercises: Exercise[], sets: SetLog[]): Exercise[] {
  const done = new Set(sets.filter((s) => isAlive(s) && !s.isWarmup).map((s) => s.exerciseId))
  return exercises.filter((e) => isAlive(e) && e.measure === 'reps' && done.has(e.id))
}

export interface MeasurePoint {
  date: string
  value: number
}

/** Weight and waist series, one point per date (the latest measurement of that date). */
export function measurementSeries(measurements: Measurement[]): { weight: MeasurePoint[]; waist: MeasurePoint[] } {
  const byDate = new Map<string, Measurement>()
  for (const m of measurements) {
    if (!isAlive(m)) continue
    const prev = byDate.get(m.date)
    if (!prev || m.createdAt > prev.createdAt) byDate.set(m.date, m)
  }
  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  return {
    weight: rows.filter((m) => m.weightKg !== null).map((m) => ({ date: m.date, value: m.weightKg! })),
    waist: rows.filter((m) => m.waistCm !== null).map((m) => ({ date: m.date, value: m.waistCm! })),
  }
}

export interface DayPoint {
  date: string
  sleepHours: number | null
  /** Highest knee value of the day: daily log or any set that day. Null if nothing logged. */
  knee: number | null
}

/** One point per calendar day from `from` to `to`, both included. */
export function sleepKneeByDay(
  from: string,
  to: string,
  dailyLogs: DailyLog[],
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  sets: SetLog[],
): DayPoint[] {
  const logByDate = new Map(dailyLogs.filter(isAlive).map((d) => [d.date, d]))
  const workoutDate = new Map(workouts.filter(isAlive).map((w) => [w.id, w.date]))
  const weDate = new Map<string, string>()
  for (const we of workoutExercises) {
    const date = isAlive(we) ? workoutDate.get(we.workoutId) : undefined
    if (date) weDate.set(we.id, date)
  }
  const setKnee = new Map<string, number>()
  for (const s of sets) {
    if (!isAlive(s) || s.kneePain === null) continue
    const date = weDate.get(s.workoutExerciseId)
    if (date) setKnee.set(date, Math.max(setKnee.get(date) ?? 0, s.kneePain))
  }

  const out: DayPoint[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const log = logByDate.get(d)
    const values = [log?.kneePain, setKnee.get(d)].filter((v): v is number => v !== null && v !== undefined)
    out.push({ date: d, sleepHours: log?.sleepHours ?? null, knee: values.length ? Math.max(...values) : null })
  }
  return out
}
