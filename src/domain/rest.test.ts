import { describe, expect, it } from 'vitest'
import { formatClock, restState } from './rest'

describe('restState', () => {
  const t0 = 1_000_000
  it('counts down to the minimum', () => {
    expect(restState(t0, t0 + 18_400, 120, 180)).toEqual({ phase: 'resting', elapsedSec: 18, remainingSec: 102 })
  })
  it('is ready between minimum and maximum', () => {
    expect(restState(t0, t0 + 120_000, 120, 180)).toEqual({ phase: 'ready', elapsedSec: 120, remainingSec: 0 })
    expect(restState(t0, t0 + 179_999, 120, 180).phase).toBe('ready')
  })
  it('is over past the maximum', () => {
    expect(restState(t0, t0 + 180_000, 120, 180).phase).toBe('over')
  })
  it('a single value (min = max) goes straight from resting to over', () => {
    expect(restState(t0, t0 + 59_000, 60, 60).phase).toBe('resting')
    expect(restState(t0, t0 + 60_000, 60, 60).phase).toBe('over')
  })
  it('never goes negative if the clock moves back', () => {
    expect(restState(t0, t0 - 5000, 90, 90)).toEqual({ phase: 'resting', elapsedSec: 0, remainingSec: 90 })
  })
})

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [65, '1:05'],
    [180, '3:00'],
  ])('%i → %s', (s, text) => expect(formatClock(s)).toBe(text))
})
