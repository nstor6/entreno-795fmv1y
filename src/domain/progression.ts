// Progression engine (SPEC §9): one suggestion per planned exercise of today's session.
import { formatNumber, MEASURE_UNIT, setValue } from './format'
import type { ExerciseRecord } from './history'
import type { Exercise, SetLog, SleepQuality, WorkoutExercise } from './types'

export type Suggestion =
  | { kind: 'manual' }
  | { kind: 'knee_hold'; loadKg: number | null; alternativeIds: string[] }
  | { kind: 'first_time'; rirMin: number; rirMax: number }
  | { kind: 'sleep_hold'; loadKg: number; values: number[] }
  | { kind: 'revert'; loadKg: number }
  | { kind: 'increase'; loadKg: number; target: number }
  | { kind: 'hold'; loadKg: number; beat: number[] }

export interface ProgressionInput {
  /** The planned exercise P. */
  exercise: Pick<Exercise, 'id' | 'measure' | 'loadIncrementKg' | 'alternatives'>
  /** Today's target for P (already copied into today's WorkoutExercise). */
  today: Pick<WorkoutExercise, 'targetMin' | 'rirMin' | 'rirMax'>
  /** Records of P before today's session, oldest first (see recordsOf). */
  records: ExerciseRecord[]
  /** Sleep quality in today's daily log, if any. */
  sleepQuality: SleepQuality | null
}

/** Working sets of a record: not warm-up and done as P itself, by setNumber. */
function workingSets(record: ExerciseRecord, exerciseId: string): SetLog[] {
  return record.sets
    .filter((s) => !s.isWarmup && s.exerciseId === exerciseId && s.deletedAt === null)
    .sort((a, b) => a.setNumber - b.setNumber)
}

/** Load of the last working set. A missing load counts as 0 kg. */
function workLoad(sets: SetLog[]): number {
  return sets[sets.length - 1]?.loadKg ?? 0
}

function topSets(sets: SetLog[]): SetLog[] {
  const load = workLoad(sets)
  return sets.filter((s) => (s.loadKg ?? 0) === load)
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function suggest({ exercise, today, records, sleepQuality }: ProgressionInput): Suggestion {
  const P = exercise.id
  const increment = exercise.loadIncrementKg

  // 0. Manual
  if (today.rirMin === null || increment === null) return { kind: 'manual' }

  const lastAny = records[records.length - 1] ?? null
  const withWork = records.map((r) => ({ record: r, sets: workingSets(r, P) })).filter((r) => r.sets.length > 0)
  const last = withWork[withWork.length - 1] ?? null
  const prev = withWork[withWork.length - 2] ?? null
  const value = (s: SetLog) => setValue(exercise.measure, s) ?? 0

  // 1. Knee: discomfort in any set of lastAny, or lastAny done with a knee alternative.
  const kneeAlternatives = exercise.alternatives.filter((a) => a.reason === 'knee').map((a) => a.exerciseId)
  if (lastAny) {
    const alive = lastAny.sets.filter((s) => s.deletedAt === null)
    const hurt = alive.some((s) => (s.kneePain ?? 0) > 0)
    const kneeAlt = alive.some((s) => kneeAlternatives.includes(s.exerciseId))
    if (hurt || kneeAlt) {
      return { kind: 'knee_hold', loadKg: last ? workLoad(last.sets) : null, alternativeIds: kneeAlternatives }
    }
  }

  // 2. First time
  if (!last) return { kind: 'first_time', rirMin: today.rirMin, rirMax: today.rirMax ?? today.rirMin }

  const lastLoad = workLoad(last.sets)
  const lastTop = topSets(last.sets)
  const judged = last.record.workoutExercise // targets copied into last, not today's

  // 3. Sleep
  if (sleepQuality === 'bad') return { kind: 'sleep_hold', loadKg: lastLoad, values: lastTop.map(value) }

  // 4. Failed increase
  if (prev && lastLoad > workLoad(prev.sets) && lastTop.some((s) => value(s) < judged.targetMin)) {
    return { kind: 'revert', loadKg: workLoad(prev.sets) }
  }

  // 5. Increase: enough top sets, all at the top of the range with RIR logged and not below the minimum.
  const rirFloor = judged.rirMin ?? 0
  const earned =
    lastTop.length >= judged.targetSets &&
    lastTop.every((s) => value(s) >= judged.targetMax && s.rir !== null && s.rir >= rirFloor)
  if (earned) return { kind: 'increase', loadKg: round2(lastLoad + increment), target: today.targetMin }

  // 6. Hold
  return { kind: 'hold', loadKg: lastLoad, beat: lastTop.map(value) }
}

/** Load to preload in the first set, when the suggestion has one. */
export function suggestedLoad(s: Suggestion): number | null {
  return 'loadKg' in s ? s.loadKg : null
}

function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]}`
}

/** User-facing text of a suggestion (SPEC §9). */
export function suggestionText(
  s: Suggestion,
  exercise: Pick<Exercise, 'measure' | 'bodyweight'>,
  names: ReadonlyMap<string, string> = new Map(),
): string | null {
  const load = (kg: number) => (exercise.bodyweight ? (kg === 0 ? 'sin lastre' : `${formatNumber(kg)} kg de lastre`) : `${formatNumber(kg)} kg`)
  const values = (vs: number[]) => `${vs.map(formatNumber).join(', ')}${MEASURE_UNIT[exercise.measure]}`

  switch (s.kind) {
    case 'manual':
      return null
    case 'knee_hold': {
      const alts = s.alternativeIds.map((id) => (names.get(id) ?? id).toLowerCase())
      const base = 'Molestó la rodilla: no subas. Misma carga o menos recorrido'
      return alts.length ? `${base}; si vuelve, cambia a ${joinOr(alts)}.` : `${base}.`
    }
    case 'first_time':
      return s.rirMin === s.rirMax
        ? `Busca una carga que te deje en RIR ${s.rirMin}.`
        : `Busca una carga que te deje en RIR ${s.rirMin}-${s.rirMax}.`
    case 'sleep_hold':
      return `Has dormido mal: repite ${load(s.loadKg)} y ${values(s.values)}.`
    case 'revert':
      return `La subida no salió: vuelve a ${load(s.loadKg)} y sigue sumando reps.`
    case 'increase':
      return `Toca subir: ${load(s.loadKg)} y a por ${formatNumber(s.target)}.`
    case 'hold':
      return `Misma carga (${load(s.loadKg)}). Intenta superar: ${values(s.beat)}.`
  }
}
