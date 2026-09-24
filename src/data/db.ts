import Dexie, { type EntityTable } from 'dexie'
import type {
  DailyLog,
  Exercise,
  Measurement,
  Routine,
  RoutineDay,
  RoutineExercise,
  SetLog,
  Workout,
  WorkoutExercise,
} from '../domain/types'

export class EntrenoDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  routineDays!: EntityTable<RoutineDay, 'id'>
  routineExercises!: EntityTable<RoutineExercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>
  sets!: EntityTable<SetLog, 'id'>
  dailyLogs!: EntityTable<DailyLog, 'id'>
  measurements!: EntityTable<Measurement, 'id'>

  constructor(name = 'entreno') {
    super(name)
    this.version(1).stores({
      exercises: 'id',
      routines: 'id',
      routineDays: 'id, routineId',
      routineExercises: 'id, routineDayId',
      workouts: 'id, date, routineId',
      workoutExercises: 'id, workoutId, plannedExerciseId',
      sets: 'id, workoutExerciseId, exerciseId',
      dailyLogs: 'id, &date',
      measurements: 'id, date',
    })
  }
}

export const TABLE_NAMES = [
  'exercises',
  'routines',
  'routineDays',
  'routineExercises',
  'workouts',
  'workoutExercises',
  'sets',
  'dailyLogs',
  'measurements',
] as const

export type TableName = (typeof TABLE_NAMES)[number]
