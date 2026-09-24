// Data model from docs/SPEC.md §4. Every table extends Base; deletes are always logical.

export interface Base {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type Measure = 'reps' | 'meters' | 'seconds'
export type AltReason = 'knee' | 'easier' | 'equipment'

export interface Alternative {
  exerciseId: string
  reason: AltReason
}

export interface Exercise extends Base {
  name: string
  measure: Measure
  perSide: boolean
  bodyweight: boolean
  loadIncrementKg: number | null
  alternatives: Alternative[]
}

export interface WeekOverride {
  weeks: number[]
  sets?: number
  rirMin?: number
  rirMax?: number
  label?: string
}

export interface Routine extends Base {
  name: string
  shortName: string
  startDate: string
  active: boolean
  notes: string
  warmup: string[]
  weekOverrides: WeekOverride[]
}

export interface RoutineDay extends Base {
  routineId: string
  key: string
  name: string
  order: number
}

export interface RoutineExercise extends Base {
  routineDayId: string
  exerciseId: string
  order: number
  sets: number
  targetMin: number
  targetMax: number
  rirMin: number | null
  rirMax: number | null
  restSecMin: number
  restSecMax: number
  notes: string
  supersetGroup: string | null
}

export interface Workout extends Base {
  date: string
  startedAt: string
  finishedAt: string | null
  routineId: string
  routineDayId: string
  dayKey: string
  weekNumber: number
  notes: string
}

export interface WorkoutExercise extends Base {
  workoutId: string
  plannedExerciseId: string
  order: number
  targetSets: number
  targetMin: number
  targetMax: number
  rirMin: number | null
  rirMax: number | null
  supersetGroup: string | null
  notes: string
}

export interface SetLog extends Base {
  workoutExerciseId: string
  exerciseId: string
  setNumber: number
  isWarmup: boolean
  loadKg: number | null
  reps: number | null
  distanceM: number | null
  durationS: number | null
  rir: number | null
  kneePain: number | null
  note: string
}

export type SleepQuality = 'good' | 'ok' | 'bad'
export type Shift = 'morning' | 'afternoon' | 'off'

export interface DailyLog extends Base {
  date: string
  sleepHours: number | null
  sleepQuality: SleepQuality | null
  kneePain: number | null
  kneeRedFlag: boolean
  shift: Shift | null
  note: string
}

export interface Measurement extends Base {
  date: string
  weightKg: number | null
  waistCm: number | null
  note: string
}

export const isAlive = <T extends Base>(r: T): boolean => r.deletedAt === null
