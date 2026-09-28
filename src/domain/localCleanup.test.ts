import { describe, expect, it } from 'vitest'
import { staleLocalKeys } from './localCleanup'
import type { Workout, WorkoutExercise } from './types'

const base = { createdAt: 'T', updatedAt: 'T', deletedAt: null }
const workout = (id: string, finishedAt: string | null, deletedAt: string | null = null): Workout => ({
  ...base,
  deletedAt,
  id,
  date: '2026-09-01',
  startedAt: 'S',
  finishedAt,
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
  rirMin: 3,
  rirMax: 3,
  supersetGroup: null,
  notes: '',
})

describe('staleLocalKeys', () => {
  const today = '2026-10-20'
  const workouts = [
    workout('old', '2026-10-01T18:00:00.000Z'), // finished 19 days ago
    workout('recent', '2026-10-15T18:00:00.000Z'), // finished 5 days ago
    workout('open', null), // still open, however old
    workout('gone', '2026-10-02T18:00:00.000Z', '2026-10-05T10:00:00.000Z'), // deleted 15 days ago
  ]
  const wes = [we('we-old', 'old'), we('we-recent', 'recent'), we('we-open', 'open')]

  it('removes screen notes of sessions closed more than 7 days ago, and of unknown ones', () => {
    const keys = [
      'entreno:warmup:old',
      'entreno:rest:old',
      'entreno:focus:old',
      'entreno:alt:we-old',
      'entreno:warmup:gone',
      'entreno:warmup:missing',
      'entreno:alt:we-missing',
      'entreno:warmup:recent',
      'entreno:focus:open',
      'entreno:alt:we-open',
      'entreno:alt:we-recent',
    ]
    expect(staleLocalKeys(keys, workouts, wes, today)).toEqual([
      'entreno:warmup:old',
      'entreno:rest:old',
      'entreno:focus:old',
      'entreno:alt:we-old',
      'entreno:warmup:gone',
      'entreno:warmup:missing',
      'entreno:alt:we-missing',
    ])
  })

  it('keeps summary drafts of the last 12 weeks', () => {
    // 12 weeks before 20 Oct is 28 Jul: the week of 27 Jul is the first one dropped.
    expect(
      staleLocalKeys(['entreno:summary:2026-07-20', 'entreno:summary:2026-07-27', 'entreno:summary:2026-08-03', 'entreno:summary:2026-10-19'], [], [], today),
    ).toEqual(['entreno:summary:2026-07-20', 'entreno:summary:2026-07-27'])
  })

  it('never touches settings or anything else', () => {
    const keys = ['entreno:plates', 'entreno:last-backup', 'entreno:focus-mode', 'entreno:progress-range', 'entreno:plates-on:press-banca', 'other']
    expect(staleLocalKeys(keys, workouts, wes, today)).toEqual([])
  })
})
