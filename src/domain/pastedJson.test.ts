import { describe, expect, it } from 'vitest'
import { parsePastedJson } from './pastedJson'

describe('parsePastedJson', () => {
  it('reads plain JSON', () => {
    expect(parsePastedJson('{"a": 1}')).toEqual({ a: 1 })
  })
  it('ignores text and code fences around it', () => {
    expect(parsePastedJson('Aquí va la rutina nueva:\n```json\n{"a": {"b": [1, 2]}}\n```\n¡Suerte!')).toEqual({ a: { b: [1, 2] } })
  })
  it('fixes curly quotes', () => {
    expect(parsePastedJson('{“name”: “Fase 2”}')).toEqual({ name: 'Fase 2' })
  })
  it('keeps curly quotes inside valid strings', () => {
    expect(parsePastedJson('{"notes": "Dice “despacio”"}')).toEqual({ notes: 'Dice “despacio”' })
  })
  it('explains what is wrong', () => {
    expect(() => parsePastedJson('hola')).toThrow(/No encuentro la rutina/)
    expect(() => parsePastedJson('{"a": 1,')).toThrow(/No encuentro la rutina/)
    expect(() => parsePastedJson('{"a": }')).toThrow(/no es un JSON válido/)
  })
})
