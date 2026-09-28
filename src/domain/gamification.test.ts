import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { gameSummary, levelFor, levelThreshold, POINTS, type GameInput } from './gamification'
import type { DailyLog, Exercise, Measurement, SetLog, Workout, WorkoutExercise } from './types'

const base = { createdAt: 'T', updatedAt: 'T', deletedAt: null }
let n = 0

interface ExSpec {
  /** Planned sets. */
  target: number
  /** Working sets logged (with RIR). */
  done: number
  exerciseId?: string
  load?: number
}

/** A session on `date` with one WorkoutExercise per spec. */
function session(date: string, specs: ExSpec[], over: Partial<Workout> = {}) {
  const workout: Workout = {
    ...base,
    id: `w${++n}`,
    date,
    startedAt: `${date}T17:00:00.000Z`,
    finishedAt: `${date}T18:00:00.000Z`,
    routineId: 'r',
    routineDayId: 'd',
    dayKey: 'A',
    weekNumber: 1,
    notes: '',
    ...over,
  }
  const wes: WorkoutExercise[] = []
  const sets: SetLog[] = []
  specs.forEach((spec, i) => {
    const exerciseId = spec.exerciseId ?? `x${i}`
    const we: WorkoutExercise = {
      ...base,
      id: `we${++n}`,
      workoutId: workout.id,
      plannedExerciseId: exerciseId,
      order: i + 1,
      targetSets: spec.target,
      targetMin: 6,
      targetMax: 8,
      rirMin: 3,
      rirMax: 3,
      supersetGroup: null,
      notes: '',
    }
    wes.push(we)
    for (let k = 0; k < spec.done; k++) {
      sets.push({
        ...base,
        id: `s${++n}`,
        workoutExerciseId: we.id,
        exerciseId,
        setNumber: k + 1,
        isWarmup: false,
        loadKg: spec.load ?? 60,
        reps: 8,
        distanceM: null,
        durationS: null,
        rir: 3,
        kneePain: null,
        note: '',
      })
    }
  })
  return { workout, wes, sets }
}

function input(parts: ReturnType<typeof session>[], extra: Partial<GameInput> = {}): GameInput {
  return {
    weeklyTarget: 3,
    routineStartDate: '2026-09-24', // a Thursday
    workouts: parts.map((p) => p.workout),
    workoutExercises: parts.flatMap((p) => p.wes),
    sets: parts.flatMap((p) => p.sets),
    exercises: [],
    measurements: [],
    dailyLogs: [],
    ...extra,
  }
}

const one = [{ target: 3, done: 3 }]
/** Monday, Wednesday and Friday of the week starting on `monday`. */
const week = (monday: string) => [0, 2, 4].map((d) => session(addDays(monday, d), one))

describe('weekly streak', () => {
  // Start week (21 Sep, starts Thursday): 2 sessions. Then 28 Sep and 5 Oct: 3 each.
  const start = [session('2026-09-24', one), session('2026-09-26', one)]

  it('the partial first week of the routine never breaks it; this week in progress counts once done', () => {
    const g = gameSummary(input([...start, ...week('2026-09-28'), ...week('2026-10-05'), session('2026-10-12', one)]), '2026-10-13')
    expect(g.streak.current).toBe(2)
    expect(g.streak.best).toBe(2)
    expect(g.streak.thisWeek).toEqual({ weekStart: '2026-10-12', sessions: 1, target: 3, done: false })
  })

  it('a week short of sessions breaks it', () => {
    const g = gameSummary(input([...start, ...week('2026-09-28'), session('2026-10-05', one), session('2026-10-07', one)]), '2026-10-13')
    expect(g.streak.current).toBe(0)
    expect(g.streak.best).toBe(1)
  })

  it('this week counts as soon as its target is reached', () => {
    const g = gameSummary(input([...week('2026-09-28'), ...week('2026-10-05')]), '2026-10-09')
    expect(g.streak.current).toBe(2)
    expect(g.streak.thisWeek.done).toBe(true)
  })

  it('sessions without working sets or deleted do not count', () => {
    const empty = session('2026-09-30', [{ target: 3, done: 0 }])
    const deleted = session('2026-10-02', one, { deletedAt: 'X' })
    const g = gameSummary(input([session('2026-09-28', one), empty, deleted]), '2026-10-04')
    expect(g.streak.thisWeek.sessions).toBe(1)
  })
})

describe('points and levels', () => {
  it('rewards planned sets, not extra ones, plus diary, a weekly measurement and done weeks', () => {
    const full = session('2026-09-28', [
      { target: 3, done: 3 },
      { target: 2, done: 5 }, // extra sets earn nothing more
    ])
    const partial = session('2026-09-30', [
      { target: 3, done: 3 },
      { target: 3, done: 1 },
    ])
    const third = session('2026-10-02', [{ target: 3, done: 1 }])
    const log = (date: string): DailyLog => ({
      ...base,
      id: `d${date}`,
      date,
      sleepHours: 7,
      sleepQuality: null,
      kneePain: null,
      kneeRedFlag: false,
      shift: null,
      note: '',
    })
    const m = (id: string, date: string): Measurement => ({ ...base, id, date, weightKg: 80, waistCm: null, note: '' })
    const g = gameSummary(
      input([full, partial, third], {
        dailyLogs: [log('2026-09-28'), log('2026-09-29')],
        measurements: [m('m1', '2026-09-28'), m('m2', '2026-10-01')],
      }),
      '2026-10-04',
    )
    const expected =
      POINTS.session + 2 * POINTS.exerciseDone + POINTS.fullSession + // full: 30
      POINTS.session + POINTS.exerciseDone + // partial: 15
      POINTS.session + // third: 10
      2 * POINTS.diaryDay + // 10
      POINTS.measurementWeek + // one per week: 5
      POINTS.weekDone // 3 sessions this week: 30
    expect(g.points).toEqual({ total: expected, thisWeek: expected })
  })

  it('levels need a bit more each time', () => {
    expect([1, 2, 3, 4, 5].map(levelThreshold)).toEqual([0, 100, 300, 600, 1000])
    expect(levelFor(0)).toEqual({ level: 1, from: 0, to: 100 })
    expect(levelFor(299)).toEqual({ level: 2, from: 100, to: 300 })
    expect(levelFor(300).level).toBe(3)
  })
})

describe('badges', () => {
  const bench: Exercise = {
    ...base,
    id: 'press-banca',
    name: 'Press banca',
    measure: 'reps',
    perSide: false,
    bodyweight: false,
    loadIncrementKg: 2.5,
    alternatives: [],
  }

  it('earned on the day each milestone is reached; the rest stay locked', () => {
    const weeks = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'].flatMap(week)
    const first = session('2026-09-24', [{ target: 3, done: 3, exerciseId: 'press-banca', load: 60 }])
    const pr = session('2026-09-26', [{ target: 3, done: 3, exerciseId: 'press-banca', load: 62.5 }])
    const logs: DailyLog[] = Array.from({ length: 7 }, (_, i) => ({
      ...base,
      id: `l${i}`,
      date: `2026-10-0${i + 1}`,
      sleepHours: null,
      sleepQuality: 'good' as const,
      kneePain: null,
      kneeRedFlag: false,
      shift: null,
      note: '',
    }))
    const g = gameSummary(
      input([first, pr, ...weeks], {
        exercises: [bench],
        dailyLogs: logs,
        measurements: [{ ...base, id: 'm', date: '2026-10-03', weightKg: null, waistCm: 90, note: '' }],
      }),
      '2026-10-25',
    )
    const earned = Object.fromEntries(g.badges.map((b) => [b.id, b.earnedOn]))
    expect(earned).toEqual({
      'session-1': '2026-09-24',
      'session-10': '2026-10-14', // 2 + 3 + 3, then the 2nd of the week of 12 Oct
      'session-25': null,
      'session-50': null,
      'session-100': null,
      'full-1': '2026-09-24',
      'week-1': '2026-10-02', // third session of the week of 28 Sep
      'streak-4': '2026-10-23',
      'streak-8': null,
      'streak-12': null,
      'record-1': '2026-09-26', // 62,5 kg beats 60 kg
      'diary-7': '2026-10-07',
      'measure-1': '2026-10-03',
    })
    expect(g.streak.current).toBe(4)
  })
})
