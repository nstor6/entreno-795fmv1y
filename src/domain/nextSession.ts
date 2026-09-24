// Next session and rest warning (SPEC §7).
import { addDays } from './dates'
import { isAlive, type RoutineDay, type Workout } from './types'

export const REST_WARNING = 'Ayer entrenaste. Lo ideal es dejar un día de descanso entre sesiones.'

function byDateThenStart(a: Workout, b: Workout): number {
  return a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt)
}

export function latestWorkout(workouts: Workout[]): Workout | null {
  const alive = workouts.filter(isAlive).sort(byDateThenStart)
  return alive[alive.length - 1] ?? null
}

/** Cyclic by `order`: the day after the last session of this routine; the first one if none. */
export function nextDay(routineId: string, days: RoutineDay[], workouts: Workout[]): RoutineDay | null {
  const ordered = days.filter((d) => isAlive(d) && d.routineId === routineId).sort((a, b) => a.order - b.order)
  if (ordered.length === 0) return null
  const last = latestWorkout(workouts.filter((w) => w.routineId === routineId))
  if (!last) return ordered[0]!
  const i = ordered.findIndex((d) => d.id === last.routineDayId)
  if (i === -1) return ordered[0]!
  return ordered[(i + 1) % ordered.length]!
}

/** True when the most recent session (any routine) was yesterday. */
export function trainedYesterday(workouts: Workout[], today: string): boolean {
  return latestWorkout(workouts)?.date === addDays(today, -1)
}
