import { describe, expect, it } from 'vitest'
import { DEFAULT_PLATES, platesPerSide, platesText } from './plates'

describe('platesPerSide', () => {
  it.each([
    [62.5, [20, 1.25], 'Por lado: 20 + 1,25'],
    [60, [20], 'Por lado: 20'],
    [100, [25, 15], 'Por lado: 25 + 15'],
    [72.5, [25, 1.25], 'Por lado: 25 + 1,25'],
    [20, [], 'Solo la barra'],
  ])('%d kg with a 20 kg bar → %o', (total, perSide, text) => {
    const load = platesPerSide(total, 20, DEFAULT_PLATES)
    expect(load).toEqual({ perSide, missingKg: 0 })
    expect(platesText(load, 20)).toBe(text)
  })

  it('reports what the available plates cannot make', () => {
    const load = platesPerSide(61, 20, DEFAULT_PLATES) // 20,5 per side
    expect(load).toEqual({ perSide: [20], missingKg: 1 })
    expect(platesText(load, 20)).toBe('Por lado: 20 (faltan 1 kg)')
  })

  it('uses the plates of the gym and repeats sizes as needed', () => {
    expect(platesPerSide(100, 20, [10, 5])).toEqual({ perSide: [10, 10, 10, 10], missingKg: 0 })
    expect(platesPerSide(60, 15, [20, 2.5])).toEqual({ perSide: [20, 2.5], missingKg: 0 })
  })

  it('below the bar there is no split', () => {
    expect(platesPerSide(15, 20, DEFAULT_PLATES)).toBeNull()
    expect(platesText(null, 20)).toBe('Menos que la barra (20 kg)')
  })
})
