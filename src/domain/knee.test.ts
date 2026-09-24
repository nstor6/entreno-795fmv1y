import { describe, expect, it } from 'vitest'
import { KNEE_RED_FLAG_TEXT, KNEE_STRONG_TEXT, kneeMessages, kneePainDates, kneeSoftText, kneeStatus } from './knee'
import type { DailyLog, SetLog, Workout, WorkoutExercise } from './types'

const TODAY = '2026-10-20'
const oct = (...days: number[]) => days.map((d) => `2026-10-${String(d).padStart(2, '0')}`)
const range = (from: number, to: number) => oct(...Array.from({ length: to - from + 1 }, (_, i) => from + i))

describe('kneeStatus (SPEC §10, today = 2026-10-20)', () => {
  it('1 · only 20 Oct → no warning', () => {
    expect(kneeStatus(oct(20), [], TODAY)).toEqual({ ongoingDays: 1, level: 'none', redFlag: false })
  })
  it('2 · 12, 14, 17 and 20 Oct → soft warning (9 days)', () => {
    const s = kneeStatus(oct(12, 14, 17, 20), [], TODAY)
    expect(s).toEqual({ ongoingDays: 9, level: 'soft', redFlag: false })
    expect(kneeMessages(s)).toEqual([{ level: 'warn', text: kneeSoftText(9) }])
    expect(kneeSoftText(9)).toBe('La rodilla lleva 9 días dando guerra. Si pasa de 1-2 semanas o empeora, toca fisio o médico.')
  })
  it('3 · 5, 8, 11, 14, 17 and 20 Oct → strong warning (16 days)', () => {
    const s = kneeStatus(oct(5, 8, 11, 14, 17, 20), [], TODAY)
    expect(s).toEqual({ ongoingDays: 16, level: 'strong', redFlag: false })
    expect(kneeMessages(s)).toEqual([{ level: 'alarm', text: KNEE_STRONG_TEXT }])
  })
  it('4 · 10 and 20 Oct → no warning (the ongoing episode lasts 1 day)', () => {
    expect(kneeStatus(oct(10, 20), [], TODAY)).toEqual({ ongoingDays: 1, level: 'none', redFlag: false })
  })
  it('5 · every day 8–15 Oct → no warning (ended more than 3 days ago)', () => {
    expect(kneeStatus(range(8, 15), [], TODAY)).toEqual({ ongoingDays: null, level: 'none', redFlag: false })
  })
  it('6 · no discomfort but red flag on 20 Oct → alarm', () => {
    const s = kneeStatus([], oct(20), TODAY)
    expect(s).toEqual({ ongoingDays: null, level: 'none', redFlag: true })
    expect(kneeMessages(s)).toEqual([{ level: 'alarm', text: KNEE_RED_FLAG_TEXT }])
  })

  it('an episode ending exactly 3 days ago is still ongoing', () => {
    expect(kneeStatus(range(11, 17), [], TODAY)).toEqual({ ongoingDays: 7, level: 'soft', redFlag: false })
  })
  it('red flag counts today and the 3 previous days only', () => {
    expect(kneeStatus([], oct(17), TODAY).redFlag).toBe(true)
    expect(kneeStatus([], oct(16), TODAY).redFlag).toBe(false)
  })
  it('ignores future dates', () => {
    expect(kneeStatus(oct(20, 21), [], TODAY).ongoingDays).toBe(1)
  })
})

describe('kneePainDates', () => {
  const base = { createdAt: 'T', updatedAt: 'T', deletedAt: null }
  const log = (date: string, kneePain: number | null, deletedAt: string | null = null): DailyLog => ({
    ...base,
    deletedAt,
    id: `d-${date}`,
    date,
    sleepHours: null,
    sleepQuality: null,
    kneePain,
    kneeRedFlag: false,
    shift: null,
    note: '',
  })
  const workout = (id: string, date: string): Workout => ({
    ...base,
    id,
    date,
    startedAt: `${date}T10:00`,
    finishedAt: null,
    routineId: 'r',
    routineDayId: 'd',
    dayKey: 'A',
    weekNumber: 1,
    notes: '',
  })
  const we = (id: string, workoutId: string): WorkoutExercise => ({
    ...base,
    id,
    workoutId,
    plannedExerciseId: 'x',
    order: 1,
    targetSets: 3,
    targetMin: 6,
    targetMax: 8,
    rirMin: null,
    rirMax: null,
    supersetGroup: null,
    notes: '',
  })
  const set = (id: string, weId: string, kneePain: number | null, deletedAt: string | null = null): SetLog => ({
    ...base,
    deletedAt,
    id,
    workoutExerciseId: weId,
    exerciseId: 'x',
    setNumber: 1,
    isWarmup: false,
    loadKg: 60,
    reps: 8,
    distanceM: null,
    durationS: null,
    rir: 3,
    kneePain,
    note: '',
  })

  it('joins diary days and set days, ignoring zeros and deleted records', () => {
    const dates = kneePainDates(
      [log('2026-10-02', 3), log('2026-10-01', 0), log('2026-10-03', 2, 'X'), log('2026-10-05', null)],
      [set('s1', 'e1', 2), set('s2', 'e2', 0), set('s3', 'e3', 4, 'X'), set('s4', 'e1', 1)],
      [we('e1', 'w1'), we('e2', 'w2'), we('e3', 'w3')],
      [workout('w1', '2026-09-30'), workout('w2', '2026-10-06'), workout('w3', '2026-10-07')],
    )
    expect(dates).toEqual(['2026-09-30', '2026-10-02'])
  })
})
