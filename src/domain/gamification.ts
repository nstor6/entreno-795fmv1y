// Weekly streak, points, levels and badges. Everything rewards sticking to the plan
// (sessions, planned sets, diary, measurements), never doing more sets or more weight.
// Computed from the stored data only, so history counts and backups carry it.
import { addDays, mondayOf } from './dates'
import { finishedSets } from './focus'
import { e1rmSeries } from './progress'
import { isAlive, type DailyLog, type Exercise, type Measurement, type SetLog, type Workout, type WorkoutExercise } from './types'

export const POINTS = {
  session: 10,
  exerciseDone: 5,
  fullSession: 10,
  diaryDay: 5,
  measurementWeek: 5,
  weekDone: 30,
} as const

export interface GameInput {
  /** Sessions per week asked by the plan: the days of the active routine. */
  weeklyTarget: number
  /** Start of the active routine: its first (partial) week never breaks the streak. */
  routineStartDate: string | null
  workouts: Workout[]
  workoutExercises: WorkoutExercise[]
  sets: SetLog[]
  exercises: Exercise[]
  measurements: Measurement[]
  dailyLogs: DailyLog[]
}

interface SessionInfo {
  workout: Workout
  week: string
  exercisesDone: number
  full: boolean
}

/** Sessions that count: alive, with at least one working set. Oldest first. */
function sessions(input: GameInput): SessionInfo[] {
  const setsByWe = new Map<string, SetLog[]>()
  for (const s of input.sets) {
    if (!isAlive(s)) continue
    const list = setsByWe.get(s.workoutExerciseId)
    if (list) list.push(s)
    else setsByWe.set(s.workoutExerciseId, [s])
  }
  const wesByWorkout = new Map<string, WorkoutExercise[]>()
  for (const we of input.workoutExercises) {
    if (!isAlive(we)) continue
    const list = wesByWorkout.get(we.workoutId)
    if (list) list.push(we)
    else wesByWorkout.set(we.workoutId, [we])
  }
  const out: SessionInfo[] = []
  for (const w of input.workouts) {
    if (!isAlive(w)) continue
    const wes = wesByWorkout.get(w.id) ?? []
    const working = wes.some((we) => (setsByWe.get(we.id) ?? []).some((s) => !s.isWarmup))
    if (!working) continue
    const done = wes.filter((we) => finishedSets(setsByWe.get(we.id) ?? [], we.rirMin !== null) >= we.targetSets).length
    out.push({ workout: w, week: mondayOf(w.date), exercisesDone: done, full: wes.length > 0 && done === wes.length })
  }
  return out.sort((a, b) => a.workout.date.localeCompare(b.workout.date) || a.workout.startedAt.localeCompare(b.workout.startedAt))
}

export interface WeekProgress {
  weekStart: string
  sessions: number
  target: number
  done: boolean
}

export interface StreakInfo {
  /** Weeks in a row done, counting this week once it's done. */
  current: number
  best: number
  thisWeek: WeekProgress
  /** Weeks done, oldest first, with the date their target was reached. */
  doneWeeks: { weekStart: string; reachedOn: string }[]
}

export function streakInfo(input: GameInput, today: string): StreakInfo {
  const target = Math.max(1, input.weeklyTarget)
  const list = sessions(input)
  const byWeek = new Map<string, SessionInfo[]>()
  for (const s of list) {
    const l = byWeek.get(s.week)
    if (l) l.push(s)
    else byWeek.set(s.week, [s])
  }
  const doneOn = (week: string) => {
    const l = byWeek.get(week) ?? []
    return l.length >= target ? l[target - 1]!.workout.date : null
  }
  const thisWeekStart = mondayOf(today)
  const startWeek = input.routineStartDate ? mondayOf(input.routineStartDate) : null
  const thisWeek: WeekProgress = {
    weekStart: thisWeekStart,
    sessions: byWeek.get(thisWeekStart)?.length ?? 0,
    target,
    done: doneOn(thisWeekStart) !== null,
  }

  // Walk every week from the first session to this one: runs of done weeks. The routine's
  // first week is neutral when not done, and this week can't break anything yet.
  const doneWeeks: StreakInfo['doneWeeks'] = []
  let run = 0
  let best = 0
  const first = list[0]?.week
  if (first) {
    for (let w = first; w <= thisWeekStart; w = addDays(w, 7)) {
      const reachedOn = doneOn(w)
      if (reachedOn) {
        doneWeeks.push({ weekStart: w, reachedOn })
        run++
        best = Math.max(best, run)
      } else if (w !== startWeek && w !== thisWeekStart) {
        run = 0
      }
    }
  }
  return { current: run, best, thisWeek, doneWeeks }
}

export interface PointsInfo {
  total: number
  thisWeek: number
}

export function pointsInfo(input: GameInput, streak: StreakInfo, today: string): PointsInfo {
  const thisWeekStart = mondayOf(today)
  let total = 0
  let thisWeek = 0
  const add = (points: number, date: string) => {
    total += points
    if (mondayOf(date) === thisWeekStart) thisWeek += points
  }
  for (const s of sessions(input)) {
    add(POINTS.session + POINTS.exerciseDone * s.exercisesDone + (s.full ? POINTS.fullSession : 0), s.workout.date)
  }
  for (const d of input.dailyLogs) {
    if (isAlive(d) && (d.sleepHours !== null || d.sleepQuality !== null || d.kneePain !== null)) add(POINTS.diaryDay, d.date)
  }
  const measuredWeeks = new Map<string, string>()
  for (const m of input.measurements) {
    if (!isAlive(m) || (m.weightKg === null && m.waistCm === null)) continue
    const week = mondayOf(m.date)
    const prev = measuredWeeks.get(week)
    if (!prev || m.date < prev) measuredWeeks.set(week, m.date)
  }
  for (const date of measuredWeeks.values()) add(POINTS.measurementWeek, date)
  for (const w of streak.doneWeeks) add(POINTS.weekDone, w.reachedOn)
  return { total, thisWeek }
}

/** Points needed to reach `level`: 0, 100, 300, 600, 1000, 1500… */
export function levelThreshold(level: number): number {
  return (100 * level * (level - 1)) / 2
}

export interface LevelInfo {
  level: number
  /** Points of the current level and of the next one, to draw the bar. */
  from: number
  to: number
}

export function levelFor(points: number): LevelInfo {
  let level = 1
  while (points >= levelThreshold(level + 1)) level++
  return { level, from: levelThreshold(level), to: levelThreshold(level + 1) }
}

export type BadgeIcon = 'session' | 'full' | 'streak' | 'record' | 'diary' | 'measure'

export interface Badge {
  id: string
  name: string
  /** How to earn it. */
  description: string
  icon: BadgeIcon
  /** Date it was earned, or null while locked. */
  earnedOn: string | null
}

/** Date of the first set of any exercise that beat its best earlier session (e1RM). */
function firstRecordDate(input: GameInput): string | null {
  let first: string | null = null
  for (const ex of input.exercises) {
    if (!isAlive(ex)) continue
    const points = e1rmSeries(ex, input.workouts, input.workoutExercises, input.sets, input.measurements)
    let best = -Infinity
    for (const [i, p] of points.entries()) {
      if (i > 0 && p.value > best) {
        if (!first || p.date < first) first = p.date
        break
      }
      best = Math.max(best, p.value)
    }
  }
  return first
}

/** Last day of the first run of `n` consecutive days with the diary filled in. */
function diaryRunDate(logs: DailyLog[], n: number): string | null {
  const days = [...new Set(logs.filter((d) => isAlive(d) && (d.sleepHours !== null || d.sleepQuality !== null)).map((d) => d.date))].sort()
  let run = 0
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && addDays(days[i - 1]!, 1) === days[i] ? run + 1 : 1
    if (run >= n) return days[i]!
  }
  return null
}

export function badges(input: GameInput, streak: StreakInfo): Badge[] {
  const list = sessions(input)
  const nth = (n: number) => list[n - 1]?.workout.date ?? null
  const bestRunDate = (n: number): string | null => {
    // Date the streak first reached n weeks, following the same neutral-week rule.
    let run = 0
    let prev: string | null = null
    const startWeek = input.routineStartDate ? mondayOf(input.routineStartDate) : null
    for (const w of streak.doneWeeks) {
      const gap = prev ? weeksBetweenNotNeutral(prev, w.weekStart, startWeek) : 0
      run = prev && gap === 0 ? run + 1 : 1
      prev = w.weekStart
      if (run >= n) return w.reachedOn
    }
    return null
  }
  const firstMeasure = input.measurements
    .filter((m) => isAlive(m) && (m.weightKg !== null || m.waistCm !== null))
    .map((m) => m.date)
    .sort()[0]

  const b = (id: string, name: string, description: string, icon: BadgeIcon, earnedOn: string | null | undefined): Badge => ({
    id,
    name,
    description,
    icon,
    earnedOn: earnedOn ?? null,
  })
  return [
    b('session-1', 'Primera sesión', 'Registra tu primera sesión.', 'session', nth(1)),
    b('session-10', '10 sesiones', 'Llega a 10 sesiones registradas.', 'session', nth(10)),
    b('session-25', '25 sesiones', 'Llega a 25 sesiones registradas.', 'session', nth(25)),
    b('session-50', '50 sesiones', 'Llega a 50 sesiones registradas.', 'session', nth(50)),
    b('session-100', '100 sesiones', 'Llega a 100 sesiones registradas.', 'session', nth(100)),
    b('full-1', 'Sesión completa', 'Haz todas las series del plan en una sesión.', 'full', list.find((s) => s.full)?.workout.date),
    b('week-1', 'Semana cumplida', 'Haz todas las sesiones de la semana.', 'streak', streak.doneWeeks[0]?.reachedOn),
    b('streak-4', 'Racha de 4 semanas', 'Cumple 4 semanas seguidas.', 'streak', bestRunDate(4)),
    b('streak-8', 'Racha de 8 semanas', 'Cumple 8 semanas seguidas.', 'streak', bestRunDate(8)),
    b('streak-12', 'Racha de 12 semanas', 'Cumple 12 semanas seguidas.', 'streak', bestRunDate(12)),
    b('record-1', 'Primer récord', 'Supera tu mejor 1RM estimado en un ejercicio.', 'record', firstRecordDate(input)),
    b('diary-7', 'Una semana de diario', 'Rellena el diario 7 días seguidos.', 'diary', diaryRunDate(input.dailyLogs, 7)),
    b('measure-1', 'Primera medida', 'Apunta tu peso o tu cintura.', 'measure', firstMeasure),
  ]
}

/** Weeks strictly between two done weeks that break a run (the routine's first week doesn't). */
function weeksBetweenNotNeutral(a: string, b: string, neutral: string | null): number {
  let n = 0
  for (let w = addDays(a, 7); w < b; w = addDays(w, 7)) if (w !== neutral) n++
  return n
}

export interface GameSummary {
  streak: StreakInfo
  points: PointsInfo
  level: LevelInfo
  badges: Badge[]
}

export function gameSummary(input: GameInput, today: string): GameSummary {
  const streak = streakInfo(input, today)
  const points = pointsInfo(input, streak, today)
  return { streak, points, level: levelFor(points.total), badges: badges(input, streak) }
}
