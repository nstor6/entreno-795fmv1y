// Plan weeks and the day's target (SPEC §6).
import { daysBetween, mondayOf } from './dates'
import type { RoutineExercise, WeekOverride } from './types'

/** Weeks run Monday–Sunday; week 1 is the one containing startDate. */
export function weekNumber(startDate: string, date: string): number {
  return Math.floor(daysBetween(mondayOf(startDate), mondayOf(date)) / 7) + 1
}

/** Merge of every override that covers `week`, in file order (later fields win). */
export function overrideForWeek(overrides: WeekOverride[], week: number): Omit<WeekOverride, 'weeks'> {
  const merged: Omit<WeekOverride, 'weeks'> = {}
  for (const o of overrides) {
    if (!o.weeks.includes(week)) continue
    if (o.sets !== undefined) merged.sets = o.sets
    if (o.rirMin !== undefined) merged.rirMin = o.rirMin
    if (o.rirMax !== undefined) merged.rirMax = o.rirMax
    if (o.label !== undefined) merged.label = o.label
  }
  return merged
}

export function weekLabel(overrides: WeekOverride[], week: number): string | null {
  return overrideForWeek(overrides, week).label ?? null
}

export interface DayTarget {
  sets: number
  targetMin: number
  targetMax: number
  rirMin: number | null
  rirMax: number | null
}

/** `sets` applies to every exercise; RIR only to exercises that have an RIR target. */
export function dayTarget(re: RoutineExercise, overrides: WeekOverride[], week: number): DayTarget {
  const o = overrideForWeek(overrides, week)
  const hasRir = re.rirMin !== null || re.rirMax !== null
  return {
    sets: o.sets ?? re.sets,
    targetMin: re.targetMin,
    targetMax: re.targetMax,
    rirMin: hasRir ? (o.rirMin ?? re.rirMin) : null,
    rirMax: hasRir ? (o.rirMax ?? re.rirMax) : null,
  }
}
