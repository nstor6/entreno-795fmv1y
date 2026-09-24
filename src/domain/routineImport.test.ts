import { describe, expect, it } from 'vitest'
import rutina from '../../data/rutina-fase1.json'
import { validateRoutineFile } from './routineImport'

const clone = (): Record<string, unknown> => structuredClone(rutina) as Record<string, unknown>

describe('validateRoutineFile', () => {
  it('accepts rutina-fase1.json', () => {
    const r = validateRoutineFile(rutina)
    expect(r.ok ? [] : r.errors).toEqual([])
  })

  it('rejects another format', () => {
    const r = validateRoutineFile({ ...clone(), format: 'otra-cosa' })
    expect(r.ok).toBe(false)
  })

  it('rejects another version', () => {
    const r = validateRoutineFile({ ...clone(), formatVersion: 2 })
    expect(!r.ok && r.errors[0]).toMatch(/formatVersion/)
  })

  it('reports the path of a bad field', () => {
    const f = clone() as { routine: { days: { exercises: { sets: unknown }[] }[] } }
    f.routine.days[0]!.exercises[0]!.sets = 'tres'
    const r = validateRoutineFile(f)
    expect(!r.ok && r.errors).toEqual(['routine.days[0].exercises[0].sets: tiene que ser un número entero mayor o igual que 1'])
  })

  it('rejects references to unknown exercises unless already stored', () => {
    const f = clone() as { exercises: { id: string }[] }
    f.exercises = f.exercises.filter((e) => e.id !== 'prensa')
    expect(validateRoutineFile(f).ok).toBe(false)
    expect(validateRoutineFile(f, ['prensa']).ok).toBe(true)
  })

  it('rejects duplicated ids', () => {
    const f = clone() as { routine: { days: { id: string }[] } }
    f.routine.days[1]!.id = f.routine.days[0]!.id
    const r = validateRoutineFile(f)
    expect(!r.ok && r.errors).toContain('routine.days: el id «fase1-a» está repetido')
  })
})
