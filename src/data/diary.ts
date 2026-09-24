// Daily log (one per date) and body measurements.
import { newId } from '../domain/ids'
import type { DailyLog, Measurement } from '../domain/types'
import type { EntrenoDB } from './db'

const nowIso = () => new Date().toISOString()

export type DailyLogPatch = Partial<Pick<DailyLog, 'sleepHours' | 'sleepQuality' | 'kneePain' | 'kneeRedFlag' | 'shift' | 'note'>>

export function emptyDailyLog(date: string, now: string): DailyLog {
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    date,
    sleepHours: null,
    sleepQuality: null,
    kneePain: null,
    kneeRedFlag: false,
    shift: null,
    note: '',
  }
}

/** Creates the day's log on first change; `date` is unique, so later changes update it. */
export async function saveDailyLog(db: EntrenoDB, date: string, patch: DailyLogPatch, now = nowIso()): Promise<void> {
  await db.transaction('rw', db.dailyLogs, async () => {
    const existing = await db.dailyLogs.where('date').equals(date).first()
    if (existing) await db.dailyLogs.put({ ...existing, ...patch, deletedAt: null, updatedAt: now })
    else await db.dailyLogs.add({ ...emptyDailyLog(date, now), ...patch })
  })
}

export type MeasurementInput = Pick<Measurement, 'date' | 'weightKg' | 'waistCm' | 'note'>

export async function addMeasurement(db: EntrenoDB, input: MeasurementInput, now = nowIso()): Promise<string> {
  const id = newId()
  await db.measurements.add({ id, createdAt: now, updatedAt: now, deletedAt: null, ...input })
  return id
}

export async function updateMeasurement(db: EntrenoDB, id: string, input: MeasurementInput, now = nowIso()): Promise<void> {
  await db.measurements.update(id, { ...input, updatedAt: now })
}

export async function deleteMeasurement(db: EntrenoDB, id: string, now = nowIso()): Promise<void> {
  await db.measurements.update(id, { deletedAt: now, updatedAt: now })
}
