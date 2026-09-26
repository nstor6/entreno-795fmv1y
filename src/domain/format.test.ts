import { describe, expect, it } from 'vitest'
import { formatExerciseLine, formatNumber, formatRest, formatTarget, formatWorkoutExerciseLines } from './format'
import type { Exercise, SetLog } from './types'

const ex = (over: Partial<Exercise> = {}) => ({ measure: 'reps' as const, perSide: false, bodyweight: false, ...over })
let n = 0
const set = (loadKg: number | null, reps: number, rir: number | null, over: Partial<SetLog> = {}): SetLog => ({
  id: `s${++n}`,
  createdAt: 'T',
  updatedAt: 'T',
  deletedAt: null,
  workoutExerciseId: 'we',
  exerciseId: 'x',
  setNumber: n,
  isWarmup: false,
  loadKg,
  reps,
  distanceM: null,
  durationS: null,
  rir,
  kneePain: null,
  note: '',
  ...over,
})

describe('formatNumber', () => {
  it.each([
    [62.5, '62,5'],
    [60, '60'],
    [71.3, '71,3'],
    [1000, '1000'],
    [126.666, '126,67'],
  ])('%d → %s', (n, s) => expect(formatNumber(n)).toBe(s))
})

describe('formatTarget', () => {
  it('bench press', () => {
    expect(
      formatTarget({ sets: 3, targetMin: 6, targetMax: 8, rirMin: 3, rirMax: 3 }, ex(), { minSec: 120, maxSec: 180 }),
    ).toBe('3 × 6-8 · RIR 3 · 2-3 min')
  })
  it('per side, no RIR', () => {
    expect(
      formatTarget({ sets: 2, targetMin: 8, targetMax: 8, rirMin: null, rirMax: null }, ex({ perSide: true }), {
        minSec: 60,
        maxSec: 60,
      }),
    ).toBe('2 × 8 por lado · 1 min')
  })
  it('meters and seconds of rest', () => {
    expect(
      formatTarget({ sets: 3, targetMin: 30, targetMax: 40, rirMin: null, rirMax: null }, ex({ measure: 'meters' }), {
        minSec: 90,
        maxSec: 90,
      }),
    ).toBe('3 × 30-40 m · 90 s')
    expect(formatRest(45, 60)).toBe('45-60 s')
  })
})

describe('formatExerciseLine (SPEC §12 lines)', () => {
  it('same load', () => {
    expect(formatExerciseLine('Prensa de piernas', ex(), [set(100, 12, 3), set(100, 11, 3), set(100, 10, 2)])).toBe(
      'Prensa de piernas 100 kg: 12, 11, 10 · RIR 3, 3, 2',
    )
  })
  it('per side with knee', () => {
    expect(
      formatExerciseLine('Zancada inversa con mancuernas', ex({ perSide: true }), [
        set(16, 10, 3),
        set(16, 10, 3),
        set(16, 9, 3, { kneePain: 3 }),
      ]),
    ).toBe('Zancada inversa con mancuernas 16 kg: 10, 10, 9 por lado · RIR 3, 3, 3 · rodilla 3/10')
  })
  it('bodyweight without and with ballast', () => {
    expect(formatExerciseLine('Dominadas', ex({ bodyweight: true }), [set(0, 7, 2), set(0, 6, 2), set(0, 6, 1)])).toBe(
      'Dominadas: 7, 6, 6 · RIR 2, 2, 1',
    )
    expect(formatExerciseLine('Dominadas', ex({ bodyweight: true }), [set(2.5, 6, 2), set(2.5, 6, 2)])).toBe(
      'Dominadas +2,5 kg: 6, 6 · RIR 2, 2',
    )
  })
  it('different loads and missing RIR', () => {
    expect(formatExerciseLine('Press banca', ex(), [set(60, 8, 3), set(62.5, 6, null)])).toBe(
      'Press banca: 60 kg × 8, 62,5 kg × 6 · RIR 3, –',
    )
  })
  it('alternative, not done and note', () => {
    const squat = { id: 'sentadilla-trasera', name: 'Sentadilla trasera', ...ex() }
    const box = { id: 'sentadilla-cajon', name: 'Sentadilla a cajón', ...ex() }
    const map = new Map([[box.id, box]])
    expect(
      formatWorkoutExerciseLines(
        squat,
        map,
        [
          set(70, 8, 3, { exerciseId: 'sentadilla-trasera' }),
          set(60, 8, 3, { exerciseId: 'sentadilla-cajon', kneePain: 2 }),
          set(60, 10, null, { exerciseId: 'sentadilla-cajon', isWarmup: true }),
        ],
        ' molestó al bajar ',
      ),
    ).toEqual([
      'Sentadilla trasera 70 kg: 8 · RIR 3',
      'Sentadilla a cajón (en lugar de Sentadilla trasera) 60 kg: 8 · RIR 3 · rodilla 2/10 · nota: molestó al bajar',
    ])
    expect(formatWorkoutExerciseLines(squat, map, [set(60, 10, null, { isWarmup: true })])).toEqual([
      'Sentadilla trasera: no hecho',
    ])
  })
  it('no load and no RIR', () => {
    expect(formatExerciseLine('Dead bug', ex({ perSide: true }), [set(null, 8, null), set(null, 8, null)])).toBe(
      'Dead bug: 8, 8 por lado',
    )
  })
})
