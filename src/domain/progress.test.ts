import { describe, expect, it } from 'vitest'
import { bodyweightOn, e1rm, e1rmSeries, exercisesWithSets, measurementSeries, sessionRecords, sleepKneeByDay } from './progress'
import type { DailyLog, Exercise, Measurement, SetLog, Workout, WorkoutExercise } from './types'

describe('e1rm (SPEC §11)', () => {
  it('60 kg × 8 with RIR 2 → 80', () => expect(e1rm(60, 8, 2)).toBe(80))
  it('100 kg × 12 with RIR 3 → 150', () => expect(e1rm(100, 12, 3)).toBe(150))
  it('60 kg × 8 without RIR → 76', () => expect(e1rm(60, 8, null)).toBe(76))
  // The bodyweight case from the spec lives in progress.private.test.ts.
  it('rounds to two decimals', () => expect(e1rm(70, 8, 2)).toBe(93.33))
})

const base = { createdAt: 'T', updatedAt: 'T', deletedAt: null }
const measure = (id: string, date: string, weightKg: number | null, waistCm: number | null = null, over: Partial<Measurement> = {}): Measurement => ({
  ...base,
  id,
  date,
  weightKg,
  waistCm,
  note: '',
  ...over,
})
const workout = (id: string, date: string, startedAt = `${date}T10:00`, deletedAt: string | null = null): Workout => ({
  ...base,
  deletedAt,
  id,
  date,
  startedAt,
  finishedAt: null,
  routineId: 'r',
  routineDayId: 'd',
  dayKey: 'A',
  weekNumber: 1,
  notes: '',
})
const we = (id: string, workoutId: string, plannedExerciseId: string): WorkoutExercise => ({
  ...base,
  id,
  workoutId,
  plannedExerciseId,
  order: 1,
  targetSets: 3,
  targetMin: 6,
  targetMax: 8,
  rirMin: 3,
  rirMax: 3,
  supersetGroup: null,
  notes: '',
})
let n = 0
const set = (weId: string, exerciseId: string, loadKg: number | null, reps: number | null, rir: number | null, over: Partial<SetLog> = {}): SetLog => ({
  ...base,
  id: `s${++n}`,
  workoutExerciseId: weId,
  exerciseId,
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
const ex = (id: string, over: Partial<Exercise> = {}): Exercise => ({
  ...base,
  id,
  name: id,
  measure: 'reps',
  perSide: false,
  bodyweight: false,
  loadIncrementKg: 2.5,
  alternatives: [],
  ...over,
})

describe('bodyweightOn', () => {
  const ms = [measure('a', '2026-09-20', 80), measure('b', '2026-09-27', 79.5), measure('c', '2026-09-25', null, 90), measure('d', '2026-09-26', 70, null, { deletedAt: 'X' })]
  it('uses the latest weight on or before the date', () => {
    expect(bodyweightOn('2026-09-26', ms)).toBe(80)
    expect(bodyweightOn('2026-09-27', ms)).toBe(79.5)
  })
  it('is null before any weight', () => expect(bodyweightOn('2026-09-19', ms)).toBeNull())
})

describe('e1rmSeries', () => {
  const workouts = [workout('w1', '2026-09-24'), workout('w2', '2026-09-28'), workout('w3', '2026-10-01', undefined, 'X'), workout('w0', '2026-09-20')]
  const wes = [we('e1', 'w1', 'press-banca'), we('e2', 'w2', 'press-banca'), we('e3', 'w3', 'press-banca'), we('p1', 'w1', 'dominadas'), we('p0', 'w0', 'dominadas')]
  const sets = [
    set('e1', 'press-banca', 40, 10, null, { isWarmup: true }),
    set('e1', 'press-banca', 60, 8, 2), // 80
    set('e1', 'press-banca', 60, 6, 1), // 74
    set('e2', 'press-banca', 62.5, 6, 2), // 79.17
    set('e2', 'press-banca', 60, 8, 3), // 82
    set('e2', 'press-banca', 70, 5, 0, { deletedAt: 'X' }),
    set('e3', 'press-banca', 100, 5, 0), // deleted workout
    set('p1', 'dominadas', 2.5, 8, 2), // (80 + 2,5) × 40/30 = 110
    set('p1', 'jalon-al-pecho', 50, 10, 2), // alternative: not counted
    set('p0', 'dominadas', 0, 8, 2), // no body weight yet → skipped
  ]
  const measurements = [measure('m', '2026-09-22', 80)]

  it('keeps the best working set per session, oldest first', () => {
    const pts = e1rmSeries(ex('press-banca'), workouts, wes, sets, measurements)
    expect(pts.map((p) => [p.date, p.value])).toEqual([
      ['2026-09-24', 80],
      ['2026-09-28', 82],
    ])
    expect(pts[1]!.set.reps).toBe(8)
  })

  it('bodyweight: body weight + ballast; sessions without a weight are skipped', () => {
    const pts = e1rmSeries(ex('dominadas', { bodyweight: true }), workouts, wes, sets, measurements)
    expect(pts.map((p) => [p.date, p.value, p.loadKg])).toEqual([['2026-09-24', 110, 82.5]])
  })

  it('only exercises measured in reps', () => {
    expect(e1rmSeries(ex('paseo', { measure: 'meters' }), workouts, wes, sets, measurements)).toEqual([])
  })

  it('lists exercises with working sets, in catalog order', () => {
    const list = exercisesWithSets([ex('sentadilla'), ex('press-banca'), ex('dominadas'), ex('paseo', { measure: 'meters' })], sets)
    expect(list.map((e) => e.id)).toEqual(['press-banca', 'dominadas'])
  })
})

describe('sessionRecords', () => {
  const ws = [workout('w1', '2026-09-20'), workout('w2', '2026-09-24'), workout('w3', '2026-09-27')]
  const wes = [
    we('a1', 'w1', 'press-banca'),
    we('a2', 'w2', 'press-banca'),
    we('a3', 'w3', 'press-banca'),
    { ...we('s3', 'w3', 'sentadilla'), order: 0 },
    we('r3', 'w3', 'remo'),
  ]
  const exercises = [ex('press-banca'), ex('sentadilla'), ex('remo')]
  const sets = [
    set('a1', 'press-banca', 60, 8, 2), // 80
    set('a2', 'press-banca', 60, 8, 3), // 82
    set('a3', 'press-banca', 62.5, 8, 2), // 83,33 → record over 82
    set('a3', 'press-banca', 70, 3, 0, { isWarmup: true }), // warm-up: ignored
    set('s3', 'sentadilla', 80, 8, 2), // first time: not a record
    set('r3', 'remo', 50, 8, 2), // done before? no → first time
  ]

  it('beats every earlier session; first times are not records', () => {
    expect(sessionRecords('w3', exercises, ws, wes, sets, [])).toEqual([{ exerciseId: 'press-banca', value: 83.33, previous: 82 }])
  })

  it('only earlier sessions count: editing an old one does not compare with the future', () => {
    expect(sessionRecords('w2', exercises, ws, wes, sets, [])).toEqual([{ exerciseId: 'press-banca', value: 82, previous: 80 }])
    expect(sessionRecords('w1', exercises, ws, wes, sets, [])).toEqual([])
  })

  it('a tie is not a record', () => {
    const tie = [...sets.filter((s) => s.workoutExerciseId !== 'a3'), set('a3', 'press-banca', 60, 8, 3)]
    expect(sessionRecords('w3', exercises, ws, wes, tie, [])).toEqual([])
  })
})

describe('measurementSeries', () => {
  it('splits weight and waist, one point per date', () => {
    const s = measurementSeries([
      measure('a', '2026-09-27', 79.5, 89),
      measure('b', '2026-09-20', 80, null),
      measure('c', '2026-09-27', 79, null, { createdAt: 'U' }),
      measure('d', '2026-09-24', null, 90),
    ])
    expect(s.weight).toEqual([
      { date: '2026-09-20', value: 80 },
      { date: '2026-09-27', value: 79 },
    ])
    expect(s.waist).toEqual([{ date: '2026-09-24', value: 90 }])
  })
})

describe('sleepKneeByDay', () => {
  const log = (date: string, sleepHours: number | null, kneePain: number | null): DailyLog => ({
    ...base,
    id: `d-${date}`,
    date,
    sleepHours,
    sleepQuality: null,
    kneePain,
    kneeRedFlag: false,
    shift: null,
    note: '',
  })
  it('one point per day, knee as the highest of diary and sets', () => {
    const days = sleepKneeByDay(
      '2026-09-28',
      '2026-10-01',
      [log('2026-09-28', 7.5, 0), log('2026-09-30', 6, 2)],
      [workout('w', '2026-09-30'), workout('v', '2026-10-01')],
      [we('a', 'w', 'x'), we('b', 'v', 'x')],
      [set('a', 'x', 60, 8, 2, { kneePain: 4 }), set('b', 'x', 60, 8, 2, { kneePain: 1 })],
    )
    expect(days).toEqual([
      { date: '2026-09-28', sleepHours: 7.5, knee: 0 },
      { date: '2026-09-29', sleepHours: null, knee: null },
      { date: '2026-09-30', sleepHours: 6, knee: 4 },
      { date: '2026-10-01', sleepHours: null, knee: 1 },
    ])
  })
})
