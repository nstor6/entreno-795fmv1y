import { describe, expect, it } from 'vitest'
import { lastAny, lastWorkingSetAs, recordsOf, workingSetsByExercise } from './history'
import type { SetLog, Workout, WorkoutExercise } from './types'

const base = { createdAt: 'T', updatedAt: 'T', deletedAt: null }
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
const we = (id: string, workoutId: string, plannedExerciseId = 'press-banca'): WorkoutExercise => ({
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
const set = (id: string, weId: string, setNumber: number, over: Partial<SetLog> = {}): SetLog => ({
  ...base,
  id,
  workoutExerciseId: weId,
  exerciseId: 'press-banca',
  setNumber,
  isWarmup: false,
  loadKg: 60,
  reps: 8,
  distanceM: null,
  durationS: null,
  rir: 3,
  kneePain: null,
  note: '',
  ...over,
})

const workouts = [
  workout('w3', '2026-10-02'),
  workout('w1', '2026-09-28'),
  workout('w2', '2026-09-30'),
  workout('wDel', '2026-10-01', undefined, 'X'),
  workout('now', '2026-10-05'),
]
const wes = [we('e1', 'w1'), we('e2', 'w2'), we('e3', 'w3'), we('eDel', 'wDel'), we('eNow', 'now'), we('other', 'w3', 'dominadas')]
const sets = [
  set('a', 'e1', 1, { loadKg: 55 }),
  set('c', 'e2', 2, { loadKg: 60, isWarmup: false }),
  set('b', 'e2', 1, { loadKg: 40, isWarmup: true }),
  set('d', 'e2', 3, { deletedAt: 'X' }),
  set('z', 'eNow', 1),
]

describe('recordsOf', () => {
  const current = workouts[4]!
  const records = recordsOf('press-banca', current, workouts, wes, sets)

  it('keeps earlier records of the planned exercise, oldest first, skipping deleted workouts', () => {
    expect(records.map((r) => r.workout.id)).toEqual(['w1', 'w2', 'w3'])
  })
  it('keeps alive sets ordered by setNumber', () => {
    expect(records[1]!.sets.map((s) => s.id)).toEqual(['b', 'c'])
  })
  it('lastAny is the most recent record even without sets', () => {
    expect(lastAny(records)?.workout.id).toBe('w3')
    expect(lastAny(records)?.sets).toEqual([])
  })
  it('lastWorkingSetAs skips warmups and empty records', () => {
    expect(lastWorkingSetAs(records, 'press-banca')?.id).toBe('c')
    expect(lastWorkingSetAs(records, 'jalon-al-pecho')).toBeNull()
  })
  it('same-day sessions are ordered by start time', () => {
    const early = workout('early', '2026-10-05', '2026-10-05T08:00')
    const r = recordsOf('press-banca', current, [...workouts, early], [...wes, we('eEarly', 'early')], sets)
    expect(r.map((x) => x.workout.id)).toEqual(['w1', 'w2', 'w3', 'early'])
  })
})

describe('workingSetsByExercise', () => {
  it('groups non-warmup sets by the exercise done', () => {
    const g = workingSetsByExercise([
      set('1', 'e', 1, { isWarmup: true }),
      set('2', 'e', 2, { exerciseId: 'sentadilla-cajon' }),
      set('3', 'e', 3),
      set('4', 'e', 4, { exerciseId: 'sentadilla-cajon' }),
    ])
    expect(g.map((x) => [x.exerciseId, x.sets.map((s) => s.id)])).toEqual([
      ['sentadilla-cajon', ['2', '4']],
      ['press-banca', ['3']],
    ])
  })
})
