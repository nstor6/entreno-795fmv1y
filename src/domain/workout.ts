// Starting a session (SPEC §8 «Sesión»): the Workout plus a frozen copy of the day's target.
import { newId } from './ids'
import { isAlive, type Routine, type RoutineDay, type RoutineExercise, type Workout, type WorkoutExercise } from './types'
import { dayTarget, weekNumber } from './weeks'

export function buildWorkout(
  routine: Routine,
  day: RoutineDay,
  routineExercises: RoutineExercise[],
  date: string,
  now: string,
  makeId: () => string = newId,
): { workout: Workout; workoutExercises: WorkoutExercise[] } {
  const week = weekNumber(routine.startDate, date)
  const base = { createdAt: now, updatedAt: now, deletedAt: null }
  const workout: Workout = {
    id: makeId(),
    ...base,
    date,
    startedAt: now,
    finishedAt: null,
    routineId: routine.id,
    routineDayId: day.id,
    dayKey: day.key,
    weekNumber: week,
    notes: '',
  }
  const workoutExercises = routineExercises
    .filter((re) => isAlive(re) && re.routineDayId === day.id)
    .sort((a, b) => a.order - b.order)
    .map((re): WorkoutExercise => {
      const t = dayTarget(re, routine.weekOverrides, week)
      return {
        id: makeId(),
        ...base,
        workoutId: workout.id,
        plannedExerciseId: re.exerciseId,
        order: re.order,
        targetSets: t.sets,
        targetMin: t.targetMin,
        targetMax: t.targetMax,
        rirMin: t.rirMin,
        rirMax: t.rirMax,
        supersetGroup: re.supersetGroup,
        notes: '',
      }
    })
  return { workout, workoutExercises }
}
