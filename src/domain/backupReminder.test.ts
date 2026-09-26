import { describe, expect, it } from 'vitest'
import { backupReminder, backupReminderText } from './backupReminder'

describe('backupReminder', () => {
  it('nothing to lose → no reminder', () => {
    expect(backupReminder(null, '2026-10-01', false)).toEqual({ due: false, daysSince: null })
  })
  it('sessions but never a backup → reminder', () => {
    const r = backupReminder(null, '2026-10-01', true)
    expect(r).toEqual({ due: true, daysSince: null })
    expect(backupReminderText(r)).toBe('Aún no has guardado ninguna copia. Tus datos solo están en este móvil.')
  })
  it('7 days is still fine, 8 is due', () => {
    expect(backupReminder('2026-09-24', '2026-10-01', true).due).toBe(false)
    const r = backupReminder('2026-09-23', '2026-10-01', true)
    expect(r).toEqual({ due: true, daysSince: 8 })
    expect(backupReminderText(r)).toBe('Tu última copia es de hace 8 días. Tus datos solo están en este móvil.')
  })
})
