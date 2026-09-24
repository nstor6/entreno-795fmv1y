import { describe, expect, it } from 'vitest'
import { nextDay, trainedYesterday } from './nextSession'
import type { RoutineDay, Workout } from './types'

const base = { createdAt: 'T', updatedAt: 'T', deletedAt: null }
const day = (key: string, order: number): RoutineDay => ({ ...base, id: `r1-${key}`, routineId: 'r1', key, name: `Sesión ${key}`, order })
const days = [day('C', 3), day('A', 1), day('B', 2)]

let n = 0
const workout = (routineId: string, dayKey: string, date: string, deletedAt: string | null = null): Workout => ({
  ...base,
  deletedAt,
  id: `w${++n}`,
  date,
  startedAt: `${date}T10:00:00.000Z`,
  finishedAt: null,
  routineId,
  routineDayId: `${routineId}-${dayKey}`,
  dayKey,
  weekNumber: 1,
  notes: '',
})

describe('nextDay (SPEC §7)', () => {
  it('no sessions → A', () => {
    expect(nextDay('r1', days, [])?.key).toBe('A')
  })
  it('last A → B', () => {
    expect(nextDay('r1', days, [workout('r1', 'C', '2026-09-20'), workout('r1', 'A', '2026-09-22')])?.key).toBe('B')
  })
  it('last C → A', () => {
    expect(nextDay('r1', days, [workout('r1', 'B', '2026-09-20'), workout('r1', 'C', '2026-09-22')])?.key).toBe('A')
  })
  it('last session from another routine → A', () => {
    expect(nextDay('r1', days, [workout('r0', 'B', '2026-09-22')])?.key).toBe('A')
  })
  it('ignores deleted sessions', () => {
    expect(nextDay('r1', days, [workout('r1', 'A', '2026-09-22'), workout('r1', 'B', '2026-09-24', 'X')])?.key).toBe('B')
  })
})

describe('trainedYesterday', () => {
  it('warns when the last session was yesterday', () => {
    expect(trainedYesterday([workout('r1', 'A', '2026-09-24')], '2026-09-25')).toBe(true)
  })
  it('does not warn after a rest day', () => {
    expect(trainedYesterday([workout('r1', 'A', '2026-09-23')], '2026-09-25')).toBe(false)
  })
})
