import { describe, expect, it } from 'vitest'
import { rutina } from '../test/routineFixture'
import { planRoutineImport, validateRoutineFile } from './routineImport'
import { buildWorkout } from './workout'

describe('buildWorkout', () => {
  const valid = validateRoutineFile(rutina)
  if (!valid.ok) throw new Error(valid.errors.join('\n'))
  const plan = planRoutineImport(valid.value, { exercises: [], routines: [], routineDays: [], routineExercises: [] }, 'T')
  const routine = plan.routines[0]!
  const dayA = plan.routineDays.find((d) => d.key === 'A')!
  let n = 0
  const ids = () => `id${++n}`

  it('copies the week-1 target of day A in plan order', () => {
    const { workout, workoutExercises } = buildWorkout(routine, dayA, plan.routineExercises, '2026-09-25', 'NOW', ids)
    expect(workout).toMatchObject({ date: '2026-09-25', dayKey: 'A', weekNumber: 1, finishedAt: null, startedAt: 'NOW' })
    expect(workoutExercises.map((w) => w.plannedExerciseId)).toEqual([
      'sentadilla-trasera',
      'press-banca',
      'remo-mancuernas-inclinado',
      'hip-thrust',
      'face-pull',
      'dead-bug',
    ])
    expect(workoutExercises.every((w) => w.workoutId === workout.id && w.targetSets === 2)).toBe(true)
    expect(workoutExercises[1]).toMatchObject({ rirMin: 3, rirMax: 4 })
    expect(workoutExercises[5]).toMatchObject({ rirMin: null, rirMax: null, supersetGroup: 'a-ss1' })
  })
})
