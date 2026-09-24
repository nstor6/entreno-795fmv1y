// Text formatting shared by the screens and the weekly summary (SPEC §8, §12).
import { workingSetsByExercise } from './history'
import type { Exercise, Measure, SetLog } from './types'

const NUMBER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, useGrouping: false })

/** Comma decimal, no trailing zeros: 62,5 · 60 · 94,2 */
export function formatNumber(n: number): string {
  return NUMBER.format(n)
}

export function formatRange(min: number, max: number): string {
  return min === max ? formatNumber(min) : `${formatNumber(min)}-${formatNumber(max)}`
}

export const MEASURE_UNIT: Record<Measure, string> = { reps: '', meters: ' m', seconds: ' s' }

export function setValue(measure: Measure, s: Pick<SetLog, 'reps' | 'distanceM' | 'durationS'>): number | null {
  if (measure === 'meters') return s.distanceM
  if (measure === 'seconds') return s.durationS
  return s.reps
}

/** «2-3 min», «2 min», «90 s». */
export function formatRest(minSec: number, maxSec: number): string {
  if (minSec % 60 === 0 && maxSec % 60 === 0) return `${formatRange(minSec / 60, maxSec / 60)} min`
  return `${formatRange(minSec, maxSec)} s`
}

export interface TargetText {
  sets: number
  targetMin: number
  targetMax: number
  rirMin: number | null
  rirMax: number | null
}

/** «3 × 6-8 · RIR 3 · 2-3 min», with the unit and «por lado» when they apply. */
export function formatTarget(
  t: TargetText,
  exercise: Pick<Exercise, 'measure' | 'perSide'>,
  rest?: { minSec: number; maxSec: number },
): string {
  let s = `${t.sets} × ${formatRange(t.targetMin, t.targetMax)}${MEASURE_UNIT[exercise.measure]}`
  if (exercise.perSide) s += ' por lado'
  if (t.rirMin !== null && t.rirMax !== null) s += ` · RIR ${formatRange(t.rirMin, t.rirMax)}`
  if (rest) s += ` · ${formatRest(rest.minSec, rest.maxSec)}`
  return s
}

/**
 * One exercise line (SPEC §12), without the note:
 * «Prensa de piernas 100 kg: 12, 11, 10 · RIR 3, 3, 2 · rodilla 3/10».
 * `sets` must already be the working sets to show, in order.
 */
export function formatExerciseLine(
  label: string,
  exercise: Pick<Exercise, 'measure' | 'perSide' | 'bodyweight'>,
  sets: SetLog[],
): string {
  const values = sets.map((s) => {
    const v = setValue(exercise.measure, s)
    return v === null ? '–' : formatNumber(v)
  })
  const unit = MEASURE_UNIT[exercise.measure] + (exercise.perSide ? ' por lado' : '')
  const loads = sets.map((s) => s.loadKg)
  const sameLoad = loads.every((l) => l === loads[0])
  const first = loads[0] ?? null

  let line: string
  if (sameLoad && (first === null || (exercise.bodyweight && first === 0))) {
    line = `${label}: ${values.join(', ')}${unit}`
  } else if (sameLoad && first !== null) {
    line = `${label} ${exercise.bodyweight ? '+' : ''}${formatNumber(first)} kg: ${values.join(', ')}${unit}`
  } else {
    const parts = sets.map((s, i) => {
      if (s.loadKg === null) return values[i]
      return `${exercise.bodyweight ? '+' : ''}${formatNumber(s.loadKg)} kg × ${values[i]}`
    })
    line = `${label}: ${parts.join(', ')}${unit}`
  }

  const rirs = sets.map((s) => s.rir)
  if (rirs.some((r) => r !== null)) line += ` · RIR ${rirs.map((r) => (r === null ? '–' : String(r))).join(', ')}`

  const knee = Math.max(0, ...sets.map((s) => s.kneePain ?? 0))
  if (knee > 0) line += ` · rodilla ${knee}/10`
  return line
}

/**
 * Lines for one planned exercise of a session (SPEC §12): one line per exercise
 * actually done, «(en lugar de …)» for alternatives, «no hecho» without working
 * sets, and the user's note at the end.
 */
export function formatWorkoutExerciseLines(
  planned: Pick<Exercise, 'id' | 'name' | 'measure' | 'perSide' | 'bodyweight'>,
  exercises: ReadonlyMap<string, Pick<Exercise, 'name' | 'measure' | 'perSide' | 'bodyweight'>>,
  sets: SetLog[],
  note = '',
): string[] {
  const groups = workingSetsByExercise(sets)
  const lines =
    groups.length === 0
      ? [`${planned.name}: no hecho`]
      : groups.map(({ exerciseId, sets }) => {
          const done = exerciseId === planned.id ? planned : exercises.get(exerciseId)
          if (!done) return formatExerciseLine(planned.name, planned, sets)
          const label = done === planned ? planned.name : `${done.name} (en lugar de ${planned.name})`
          return formatExerciseLine(label, done, sets)
        })
  const text = note.trim()
  if (text) lines[lines.length - 1] += ` · nota: ${text}`
  return lines
}
