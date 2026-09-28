import { describe, expect, it } from 'vitest'
import { afterSet, finishedSets, firstPending, groupOf, nextPendingAfter, type FocusItem } from './focus'

// Session A of phase 1 in week 2: four single exercises, then face pull + dead bug as a superset.
const session = (done: Partial<Record<string, number>> = {}): FocusItem[] =>
  (
    [
      ['squat', null, 3],
      ['bench', null, 3],
      ['row', null, 3],
      ['hip', null, 3],
      ['facepull', 'a-ss1', 3],
      ['deadbug', 'a-ss1', 2],
    ] as const
  ).map(([id, supersetGroup, targetSets]) => ({ id, supersetGroup, targetSets, doneSets: done[id] ?? 0 }))

describe('finishedSets', () => {
  const sets = [
    { isWarmup: true, rir: 4 },
    { isWarmup: false, rir: 3 },
    { isWarmup: false, rir: null },
  ]
  it('with an RIR target, only working sets with RIR count', () => expect(finishedSets(sets, true)).toBe(1))
  it('without one, every working set counts', () => expect(finishedSets(sets, false)).toBe(2))
})

describe('groupOf', () => {
  it('finds the superset partners', () => {
    expect(groupOf(session(), 'deadbug').map((x) => x.id)).toEqual(['facepull', 'deadbug'])
    expect(groupOf(session(), 'bench').map((x) => x.id)).toEqual(['bench'])
  })
})

describe('firstPending and nextPendingAfter', () => {
  it('opens the first exercise with sets left', () => {
    expect(firstPending(session())).toBe('squat')
    expect(firstPending(session({ squat: 3, bench: 3 }))).toBe('row')
    expect(firstPending(session({ squat: 3, bench: 3, row: 3, hip: 3, facepull: 3, deadbug: 2 }))).toBeNull()
  })
  it('moves on past the current exercise and wraps to skipped ones', () => {
    expect(nextPendingAfter(session(), 'bench')).toBe('row')
    expect(nextPendingAfter(session({ squat: 3 }), 'deadbug')).toBe('bench')
    expect(nextPendingAfter(session({ squat: 3, bench: 3, row: 3, hip: 3 }), 'hip')).toBe('facepull')
  })
})

describe('afterSet: single exercises', () => {
  it('rests and stays while sets are left', () => {
    expect(afterSet(session({ squat: 1 }), 'squat')).toEqual({ focus: 'squat', rest: true })
  })
  it('rests and moves on when the exercise is done', () => {
    expect(afterSet(session({ squat: 3 }), 'squat')).toEqual({ focus: 'bench', rest: true })
  })
  it('goes back to a skipped exercise at the end', () => {
    expect(afterSet(session({ squat: 3, bench: 3, hip: 3, facepull: 3, deadbug: 2, row: 0 }), 'hip')).toEqual({
      focus: 'row',
      rest: true,
    })
  })
})

describe('afterSet: supersets alternate and rest after the pair', () => {
  const base = { squat: 3, bench: 3, row: 3, hip: 3 }
  it('face pull → dead bug without rest', () => {
    expect(afterSet(session({ ...base, facepull: 1 }), 'facepull')).toEqual({ focus: 'deadbug', rest: false })
  })
  it('dead bug → rest, back to face pull', () => {
    expect(afterSet(session({ ...base, facepull: 1, deadbug: 1 }), 'deadbug')).toEqual({ focus: 'facepull', rest: true })
  })
  it('when the partner has no sets left, the set closes the round: rest', () => {
    // Dead bug has 2 sets, face pull 3: the third face pull has no partner left.
    expect(afterSet(session({ ...base, facepull: 3, deadbug: 2 }), 'facepull')).toEqual({ focus: null, rest: true })
  })
  it('after the whole superset, moves on to what is left', () => {
    expect(afterSet(session({ squat: 3, bench: 3, row: 1, hip: 3, facepull: 3, deadbug: 2 }), 'deadbug')).toEqual({
      focus: 'row',
      rest: true,
    })
  })
  it('a superset done out of order still alternates', () => {
    expect(afterSet(session({ ...base, facepull: 1, deadbug: 2 }), 'deadbug')).toEqual({ focus: 'facepull', rest: true })
  })
})
