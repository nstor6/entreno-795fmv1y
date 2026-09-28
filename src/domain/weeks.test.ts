import { describe, expect, it } from 'vitest'
import { rutina } from '../test/routineFixture'
import { planRoutineImport, validateRoutineFile } from './routineImport'
import { dayTarget, weekLabel, weekNumber } from './weeks'

describe('weekNumber (SPEC §6)', () => {
  it.each([
    ['2026-09-24', 1],
    ['2026-09-27', 1],
    ['2026-09-28', 2],
    ['2026-10-04', 2],
    ['2026-10-05', 3],
  ])('%s → week %i', (date, week) => {
    expect(weekNumber('2026-09-24', date)).toBe(week)
  })

  it('crosses the October DST change without drifting', () => {
    expect(weekNumber('2026-09-24', '2026-10-26')).toBe(6)
  })
})

describe('dayTarget in week 1 of phase 1', () => {
  const valid = validateRoutineFile(rutina)
  if (!valid.ok) throw new Error(valid.errors.join('\n'))
  const plan = planRoutineImport(valid.value, { exercises: [], routines: [], routineDays: [], routineExercises: [] }, 'T')
  const routine = plan.routines[0]!
  const find = (exerciseId: string) => plan.routineExercises.find((r) => r.exerciseId === exerciseId)!

  it('bench press: 2 sets at RIR 3-4', () => {
    expect(dayTarget(find('press-banca'), routine.weekOverrides, 1)).toEqual({
      sets: 2,
      targetMin: 6,
      targetMax: 8,
      rirMin: 3,
      rirMax: 4,
    })
  })

  it('dead bug: 2 sets, no RIR', () => {
    expect(dayTarget(find('dead-bug'), routine.weekOverrides, 1)).toEqual({
      sets: 2,
      targetMin: 8,
      targetMax: 8,
      rirMin: null,
      rirMax: null,
    })
  })

  it('week 2 keeps the plan values and shows its label', () => {
    expect(dayTarget(find('press-banca'), routine.weekOverrides, 2)).toMatchObject({ sets: 3, rirMin: 3, rirMax: 3 })
    expect(weekLabel(routine.weekOverrides, 2)).toMatch(/^Semana 2: confirmar cargas/)
    expect(weekLabel(routine.weekOverrides, 3)).toBeNull()
  })
})
