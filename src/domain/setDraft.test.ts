import { describe, expect, it } from 'vitest'
import { draftSet, loadStep, stepValue } from './setDraft'
import type { SetLog } from './types'

const set = (over: Partial<SetLog>): SetLog => ({
  id: 's',
  createdAt: 'T',
  updatedAt: 'T',
  deletedAt: null,
  workoutExerciseId: 'we',
  exerciseId: 'press-banca',
  setNumber: 1,
  isWarmup: false,
  loadKg: 60,
  reps: 8,
  distanceM: null,
  durationS: null,
  rir: 3,
  kneePain: 2,
  note: 'x',
  ...over,
})
const reps = { measure: 'reps' as const, bodyweight: false }

describe('draftSet', () => {
  it('copies load, value and RIR of the previous set, not knee or note', () => {
    expect(draftSet(reps, 6, set({ loadKg: 62.5, reps: 7, rir: 2 }), null)).toEqual({
      loadKg: 62.5,
      reps: 7,
      distanceM: null,
      durationS: null,
      rir: 2,
    })
  })
  it('first set takes the load from last time and the minimum target', () => {
    expect(draftSet(reps, 6, null, set({ loadKg: 57.5 }))).toEqual({
      loadKg: 57.5,
      reps: 6,
      distanceM: null,
      durationS: null,
      rir: null,
    })
  })
  it('a suggested load wins over last time', () => {
    expect(draftSet(reps, 6, null, set({ loadKg: 57.5 }), 60).loadKg).toBe(60)
  })
  it('first time ever: no load, or 0 kg of ballast for bodyweight', () => {
    expect(draftSet(reps, 6, null, null).loadKg).toBeNull()
    expect(draftSet({ measure: 'reps', bodyweight: true }, 6, null, null).loadKg).toBe(0)
  })
  it('meters go to distanceM', () => {
    expect(draftSet({ measure: 'meters', bodyweight: false }, 30, null, null)).toMatchObject({ reps: null, distanceM: 30 })
  })
})

describe('steps', () => {
  it('uses 2.5 kg when the exercise has no increment', () => {
    expect(loadStep({ loadIncrementKg: null })).toBe(2.5)
    expect(loadStep({ loadIncrementKg: 2 })).toBe(2)
  })
  it('adds without float noise and clamps at 0', () => {
    expect(stepValue(0.1, 0.2)).toBe(0.3)
    expect(stepValue(null, 2.5)).toBe(2.5)
    expect(stepValue(1, -2.5)).toBe(0)
  })
})
