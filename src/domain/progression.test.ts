import { describe, expect, it } from 'vitest'
import type { ExerciseRecord } from './history'
import { suggest, suggestedLoad, suggestionText, type ProgressionInput, type Suggestion } from './progression'
import type { Exercise, SetLog, SleepQuality, WorkoutExercise } from './types'

// Exercises as described in SPEC §9.
const base = { createdAt: 'T', updatedAt: 'T', deletedAt: null }
const ex = (over: Partial<Exercise> & Pick<Exercise, 'id'>): Exercise => ({
  ...base,
  name: over.id,
  measure: 'reps',
  perSide: false,
  bodyweight: false,
  loadIncrementKg: 2.5,
  alternatives: [],
  ...over,
})
const BENCH = ex({ id: 'press-banca', name: 'Press banca' })
const SQUAT = ex({
  id: 'sentadilla-trasera',
  name: 'Sentadilla trasera',
  loadIncrementKg: 5,
  alternatives: [
    { exerciseId: 'sentadilla-cajon', reason: 'knee' },
    { exerciseId: 'prensa', reason: 'knee' },
  ],
})
const ROW = ex({ id: 'remo-mancuernas-inclinado', loadIncrementKg: 2 })
const PULLUP = ex({ id: 'dominadas', bodyweight: true, alternatives: [{ exerciseId: 'jalon-al-pecho', reason: 'easier' }] })
const DEADBUG = ex({ id: 'dead-bug', loadIncrementKg: null, perSide: true })

interface Target {
  sets: number
  min: number
  max: number
  rirMin: number | null
}
const BENCH_TARGET: Target = { sets: 3, min: 6, max: 8, rirMin: 3 }

type S = [load: number, reps: number, rir: number | null, extra?: Partial<SetLog>]

let n = 0
/** A record on `date`: sets are [load, reps, rir, extra?]; `copied` is the target copied into it. */
function rec(date: string, exerciseId: string, sets: S[], copied: Target = BENCH_TARGET): ExerciseRecord {
  const weId = `we${++n}`
  const workoutExercise: WorkoutExercise = {
    ...base,
    id: weId,
    workoutId: `w${n}`,
    plannedExerciseId: exerciseId,
    order: 1,
    targetSets: copied.sets,
    targetMin: copied.min,
    targetMax: copied.max,
    rirMin: copied.rirMin,
    rirMax: copied.rirMin,
    supersetGroup: null,
    notes: '',
  }
  return {
    workout: {
      ...base,
      id: `w${n}`,
      date,
      startedAt: `${date}T10:00`,
      finishedAt: `${date}T11:00`,
      routineId: 'r',
      routineDayId: 'd',
      dayKey: 'A',
      weekNumber: 2,
      notes: '',
    },
    workoutExercise,
    sets: sets.map(([loadKg, reps, rir, extra], i) => ({
      ...base,
      id: `${weId}-s${i + 1}`,
      workoutExerciseId: weId,
      exerciseId,
      setNumber: i + 1,
      isWarmup: false,
      loadKg,
      reps,
      distanceM: null,
      durationS: null,
      rir,
      kneePain: null,
      note: '',
      ...extra,
    })),
  }
}

function input(
  exercise: Exercise,
  records: ExerciseRecord[],
  opts: { today?: Target; sleep?: SleepQuality } = {},
): ProgressionInput {
  const t = opts.today ?? BENCH_TARGET
  return {
    exercise,
    today: { targetMin: t.min, rirMin: t.rirMin, rirMax: t.rirMin },
    records,
    sleepQuality: opts.sleep ?? null,
  }
}

const set3 = (load: number, reps: [number, number, number], rir: [number | null, number | null, number | null]): S[] =>
  reps.map((r, i) => [load, r, rir[i]!] as S)

describe('suggest (SPEC §9, 17 mandatory cases)', () => {
  it('1 · no records → first_time (RIR 3-3)', () => {
    expect(suggest(input(BENCH, []))).toEqual({ kind: 'first_time', rirMin: 3, rirMax: 3 })
  })

  it('2 · 60 kg: 8, 8, 8 · RIR 3, 3, 3 → increase 62,5 kg, target 6', () => {
    const last = rec('2026-10-01', 'press-banca', set3(60, [8, 8, 8], [3, 3, 3]))
    expect(suggest(input(BENCH, [last]))).toEqual({ kind: 'increase', loadKg: 62.5, target: 6 })
  })

  it('3 · 60 kg: 8, 8, 7 · RIR 3, 3, 3 → hold 60 kg, beat [8, 8, 7]', () => {
    const last = rec('2026-10-01', 'press-banca', set3(60, [8, 8, 7], [3, 3, 3]))
    expect(suggest(input(BENCH, [last]))).toEqual({ kind: 'hold', loadKg: 60, beat: [8, 8, 7] })
  })

  it('4 · 60 kg: 8, 8, 8 · RIR 3, 2, 3 → hold 60 kg, beat [8, 8, 8]', () => {
    const last = rec('2026-10-01', 'press-banca', set3(60, [8, 8, 8], [3, 2, 3]))
    expect(suggest(input(BENCH, [last]))).toEqual({ kind: 'hold', loadKg: 60, beat: [8, 8, 8] })
  })

  it('5 · 60 kg: 8, 8 · RIR 3, 3 (copied: 3 sets) → hold 60 kg, beat [8, 8]', () => {
    const last = rec('2026-10-01', 'press-banca', [
      [60, 8, 3],
      [60, 8, 3],
    ])
    expect(suggest(input(BENCH, [last]))).toEqual({ kind: 'hold', loadKg: 60, beat: [8, 8] })
  })

  it('6 · 60 kg: 8, 8, 8 · RIR 3, 3, none → hold 60 kg, beat [8, 8, 8]', () => {
    const last = rec('2026-10-01', 'press-banca', set3(60, [8, 8, 8], [3, 3, null]))
    expect(suggest(input(BENCH, [last]))).toEqual({ kind: 'hold', loadKg: 60, beat: [8, 8, 8] })
  })

  it('7 · 62,5 kg: 6, 5, 5 after 60 kg: 8, 8, 8 → revert 60 kg', () => {
    const prev = rec('2026-09-28', 'press-banca', set3(60, [8, 8, 8], [3, 3, 3]))
    const last = rec('2026-10-01', 'press-banca', set3(62.5, [6, 5, 5], [2, 1, 1]))
    expect(suggest(input(BENCH, [prev, last]))).toEqual({ kind: 'revert', loadKg: 60 })
  })

  it('8 · 62,5 kg: 6, 6, 6 after 60 kg: 8, 8, 8 → hold 62,5 kg, beat [6, 6, 6]', () => {
    const prev = rec('2026-09-28', 'press-banca', set3(60, [8, 8, 8], [3, 3, 3]))
    const last = rec('2026-10-01', 'press-banca', set3(62.5, [6, 6, 6], [3, 3, 3]))
    expect(suggest(input(BENCH, [prev, last]))).toEqual({ kind: 'hold', loadKg: 62.5, beat: [6, 6, 6] })
  })

  const kneeRecord = () =>
    rec('2026-10-01', 'press-banca', [
      [60, 8, 3],
      [60, 8, 3],
      [60, 8, 3, { kneePain: 2 }],
    ])

  it('9 · 60 kg: 8, 8, 8 with knee 2/10 on the third → knee_hold 60 kg', () => {
    expect(suggest(input(BENCH, [kneeRecord()]))).toEqual({ kind: 'knee_hold', loadKg: 60, alternativeIds: [] })
  })

  it('10 · back squat: lastAny done as box squat, last 70 kg: 8, 8, 8 → knee_hold 70 kg with knee alternatives', () => {
    const last = rec('2026-09-28', 'sentadilla-trasera', set3(70, [8, 8, 8], [3, 3, 3]))
    const lastAny = rec('2026-10-01', 'sentadilla-trasera', set3(60, [8, 8, 8], [3, 3, 3]))
    lastAny.sets.forEach((s) => (s.exerciseId = 'sentadilla-cajon'))
    expect(suggest(input(SQUAT, [last, lastAny]))).toEqual({
      kind: 'knee_hold',
      loadKg: 70,
      alternativeIds: ['sentadilla-cajon', 'prensa'],
    })
  })

  it('11 · 60 kg: 8, 8, 8 and bad sleep → sleep_hold 60 kg, [8, 8, 8]', () => {
    const last = rec('2026-10-01', 'press-banca', set3(60, [8, 8, 8], [3, 3, 3]))
    expect(suggest(input(BENCH, [last], { sleep: 'bad' }))).toEqual({ kind: 'sleep_hold', loadKg: 60, values: [8, 8, 8] })
  })

  it('12 · like 9 with bad sleep → knee_hold 60 kg (knee comes first)', () => {
    expect(suggest(input(BENCH, [kneeRecord()], { sleep: 'bad' }))).toEqual({ kind: 'knee_hold', loadKg: 60, alternativeIds: [] })
  })

  it('13 · week 1 (copied 2 sets, RIR ≥ 3): 50×8 RIR 5; 60×8 RIR 4; 60×8 RIR 4 → increase 62,5 kg, target 6', () => {
    const last = rec(
      '2026-09-25',
      'press-banca',
      [
        [50, 8, 5],
        [60, 8, 4],
        [60, 8, 4],
      ],
      { sets: 2, min: 6, max: 8, rirMin: 3 },
    )
    expect(suggest(input(BENCH, [last]))).toEqual({ kind: 'increase', loadKg: 62.5, target: 6 })
  })

  it('14 · dumbbell row (increment 2; 8-12; RIR ≥ 2): 22 kg: 12, 12, 12 · RIR 2, 2, 3 → increase 24 kg, target 8', () => {
    const t = { sets: 3, min: 8, max: 12, rirMin: 2 }
    const last = rec('2026-10-01', ROW.id, set3(22, [12, 12, 12], [2, 2, 3]), t)
    expect(suggest(input(ROW, [last], { today: t }))).toEqual({ kind: 'increase', loadKg: 24, target: 8 })
  })

  const PULLUP_TARGET = { sets: 3, min: 6, max: 10, rirMin: 2 }

  it('15 · pull-ups (bodyweight; increment 2,5; 6-10; RIR ≥ 2): 0 kg: 10, 10, 10 → increase 2,5 kg, target 6', () => {
    const last = rec('2026-10-01', PULLUP.id, set3(0, [10, 10, 10], [2, 2, 2]), PULLUP_TARGET)
    expect(suggest(input(PULLUP, [last], { today: PULLUP_TARGET }))).toEqual({ kind: 'increase', loadKg: 2.5, target: 6 })
  })

  it('16 · dead bug (no RIR target) → manual', () => {
    const t = { sets: 2, min: 8, max: 8, rirMin: null }
    const last = rec('2026-10-01', DEADBUG.id, set3(0, [8, 8, 8], [null, null, null]), t)
    expect(suggest(input(DEADBUG, [last], { today: t }))).toEqual({ kind: 'manual' })
  })

  it('17 · pull-ups: lastAny done as lat pulldown (easier), last 0 kg: 8, 7, 6 → hold 0 kg, beat [8, 7, 6]', () => {
    const last = rec('2026-09-28', PULLUP.id, set3(0, [8, 7, 6], [2, 2, 2]), PULLUP_TARGET)
    const lastAny = rec('2026-10-01', PULLUP.id, set3(45, [10, 10, 10], [2, 2, 2]), PULLUP_TARGET)
    lastAny.sets.forEach((s) => (s.exerciseId = 'jalon-al-pecho'))
    expect(suggest(input(PULLUP, [last, lastAny], { today: PULLUP_TARGET }))).toEqual({ kind: 'hold', loadKg: 0, beat: [8, 7, 6] })
  })
})

describe('suggest · details', () => {
  it('warm-up sets are not working sets', () => {
    const last = rec('2026-10-01', 'press-banca', [[40, 10, null, { isWarmup: true }], ...set3(60, [8, 8, 8], [3, 3, 3])])
    expect(suggest(input(BENCH, [last]))).toEqual({ kind: 'increase', loadKg: 62.5, target: 6 })
  })
  it('a first time with knee trouble still holds and has no load', () => {
    const lastAny = rec('2026-10-01', 'sentadilla-trasera', set3(60, [8, 8, 8], [3, 3, 3]))
    lastAny.sets.forEach((s) => (s.exerciseId = 'prensa'))
    expect(suggest(input(SQUAT, [lastAny]))).toEqual({ kind: 'knee_hold', loadKg: null, alternativeIds: ['sentadilla-cajon', 'prensa'] })
  })
  it('deleted sets do not count', () => {
    const last = rec('2026-10-01', 'press-banca', [...set3(60, [8, 8, 8], [3, 3, 3]), [60, 5, 1, { deletedAt: 'X', kneePain: 5 }]])
    expect(suggest(input(BENCH, [last]))).toEqual({ kind: 'increase', loadKg: 62.5, target: 6 })
  })
})

describe('suggestionText', () => {
  const names = new Map([
    ['sentadilla-cajon', 'Sentadilla a cajón'],
    ['prensa', 'Prensa de piernas'],
  ])
  it.each<[Suggestion, Exercise, string]>([
    [{ kind: 'first_time', rirMin: 3, rirMax: 3 }, BENCH, 'Busca una carga que te deje en RIR 3.'],
    [{ kind: 'first_time', rirMin: 3, rirMax: 4 }, BENCH, 'Busca una carga que te deje en RIR 3-4.'],
    [{ kind: 'increase', loadKg: 62.5, target: 6 }, BENCH, 'Toca subir: 62,5 kg y a por 6.'],
    [{ kind: 'increase', loadKg: 2.5, target: 6 }, PULLUP, 'Toca subir: 2,5 kg de lastre y a por 6.'],
    [{ kind: 'hold', loadKg: 60, beat: [8, 8, 7] }, BENCH, 'Misma carga (60 kg). Intenta superar: 8, 8, 7.'],
    [{ kind: 'hold', loadKg: 0, beat: [8, 7, 6] }, PULLUP, 'Misma carga (sin lastre). Intenta superar: 8, 7, 6.'],
    [{ kind: 'revert', loadKg: 60 }, BENCH, 'La subida no salió: vuelve a 60 kg y sigue sumando reps.'],
    [{ kind: 'sleep_hold', loadKg: 60, values: [8, 8, 8] }, BENCH, 'Has dormido mal: repite 60 kg y 8, 8, 8.'],
    [
      { kind: 'knee_hold', loadKg: 70, alternativeIds: ['sentadilla-cajon', 'prensa'] } as const,
      SQUAT,
      'Molestó la rodilla: no subas. Misma carga o menos recorrido; si vuelve, cambia a sentadilla a cajón o prensa de piernas.',
    ],
    [{ kind: 'knee_hold', loadKg: 60, alternativeIds: [] }, BENCH, 'Molestó la rodilla: no subas. Misma carga o menos recorrido.'],
  ])('%o', (s, exercise, text) => {
    expect(suggestionText(s, exercise, names)).toBe(text)
  })

  it('manual has no text and no load', () => {
    expect(suggestionText({ kind: 'manual' }, DEADBUG)).toBeNull()
    expect(suggestedLoad({ kind: 'manual' })).toBeNull()
    expect(suggestedLoad({ kind: 'increase', loadKg: 62.5, target: 6 })).toBe(62.5)
  })
})
