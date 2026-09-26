import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import rutina from '../../data/rutina-fase1.json'
import { backupFileName, exportBackup, restoreBackup, validateBackup } from './backup'
import { EntrenoDB, TABLE_NAMES } from './db'
import { addMeasurement, deleteMeasurement, restoreMeasurement, saveDailyLog, updateMeasurement } from './diary'
import { importRoutine } from './importRoutine'
import { loadWeekSummary } from './queries'
import {
  addSet,
  deleteSet,
  deleteWorkout,
  finishForgottenWorkout,
  finishWorkout,
  restoreSet,
  restoreWorkout,
  startWorkout,
} from './session'

let db: EntrenoDB
let n = 0
beforeEach(() => {
  db = new EntrenoDB(`test-${++n}`)
})
afterEach(async () => {
  await db.delete()
})

const alive = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => r.deletedAt === null)

async function snapshot() {
  const out: Record<string, unknown[]> = {}
  for (const name of TABLE_NAMES) out[name] = await db.table(name).orderBy('id').toArray()
  return out
}

describe('importRoutine (SPEC §5)', () => {
  it('creates days A, B and C with 6, 5 and 6 exercises in file order', async () => {
    const r = await importRoutine(db, rutina)
    expect(r.ok).toBe(true)
    const days = alive(await db.routineDays.where('routineId').equals('fase1-fullbody').sortBy('order'))
    expect(days.map((d) => d.key)).toEqual(['A', 'B', 'C'])
    const fileDays = rutina.routine.days
    for (const [i, d] of days.entries()) {
      const res = alive(await db.routineExercises.where('routineDayId').equals(d.id).sortBy('order'))
      expect(res.map((x) => x.id)).toEqual(fileDays[i]!.exercises.map((x) => x.id))
    }
    const counts = await Promise.all(days.map((d) => db.routineExercises.where('routineDayId').equals(d.id).count()))
    expect(counts).toEqual([6, 5, 6])
    const routine = await db.routines.get('fase1-fullbody')
    expect(routine?.active).toBe(true)
    expect(await db.exercises.count()).toBe(rutina.exercises.length)
  })

  it('importing twice leaves identical records', async () => {
    await importRoutine(db, rutina, '2026-09-24T08:00:00.000Z')
    const first = await snapshot()
    const r = await importRoutine(db, rutina, '2026-09-25T08:00:00.000Z')
    expect(r.ok && r.plan).toEqual({ exercises: [], routines: [], routineDays: [], routineExercises: [] })
    expect(await snapshot()).toEqual(first)
  })

  it('soft-deletes days and exercises no longer in the file and updates changed values', async () => {
    await importRoutine(db, rutina, 'T1')
    const next = structuredClone(rutina)
    next.routine.days = next.routine.days.filter((d) => d.key !== 'C')
    next.routine.days[0]!.exercises[0]!.sets = 4
    await importRoutine(db, next, 'T2')
    const c = await db.routineDays.get('fase1-c')
    expect(c?.deletedAt).toBe('T2')
    const cExercises = await db.routineExercises.where('routineDayId').equals('fase1-c').toArray()
    expect(cExercises.every((x) => x.deletedAt === 'T2')).toBe(true)
    const squat = await db.routineExercises.get('fase1-a-01')
    expect(squat).toMatchObject({ sets: 4, createdAt: 'T1', updatedAt: 'T2', deletedAt: null })

    await importRoutine(db, rutina, 'T3')
    expect((await db.routineDays.get('fase1-c'))?.deletedAt).toBeNull()
  })

  it('activates the imported routine and deactivates the rest', async () => {
    await importRoutine(db, rutina, 'T1')
    const other = structuredClone(rutina)
    other.routine.id = 'fase2'
    ;(other.routine as { days: unknown }).days = other.routine.days.map((d) => ({
      ...d,
      id: `f2-${d.id}`,
      exercises: d.exercises.map((x) => ({ ...x, id: `f2-${x.id}` })),
    }))
    await importRoutine(db, other, 'T2')
    expect((await db.routines.get('fase1-fullbody'))?.active).toBe(false)
    expect((await db.routines.get('fase2'))?.active).toBe(true)
  })

  it('does not touch anything when the file is invalid', async () => {
    const r = await importRoutine(db, { format: 'entreno-rutina', formatVersion: 1, exercises: [], routine: {} })
    expect(r.ok).toBe(false)
    expect(await db.routines.count()).toBe(0)
    expect(await db.exercises.count()).toBe(0)
  })

  it('does not touch history', async () => {
    await db.workouts.add({
      id: 'w1',
      createdAt: 'T',
      updatedAt: 'T',
      deletedAt: null,
      date: '2026-09-24',
      startedAt: 'T',
      finishedAt: null,
      routineId: 'fase1-fullbody',
      routineDayId: 'fase1-a',
      dayKey: 'A',
      weekNumber: 1,
      notes: '',
    })
    await importRoutine(db, rutina)
    expect(await db.workouts.get('w1')).toMatchObject({ updatedAt: 'T', deletedAt: null })
  })
})

describe('session writes', () => {
  it('starts a week-1 session, numbers sets and deletes them logically', async () => {
    await importRoutine(db, rutina, 'T1')
    const id = await startWorkout(db, 'fase1-a', '2026-09-25', '2026-09-25T17:00:00.000Z')
    const wes = await db.workoutExercises.where('workoutId').equals(id).sortBy('order')
    expect(wes).toHaveLength(6)
    expect(wes[1]).toMatchObject({ plannedExerciseId: 'press-banca', targetSets: 2, rirMin: 3, rirMax: 4 })

    const values = { loadKg: 60, reps: 8, distanceM: null, durationS: null, rir: 4 }
    const s1 = await addSet(db, wes[1]!.id, 'press-banca', values)
    const s2 = await addSet(db, wes[1]!.id, 'press-banca', values)
    expect([s1.setNumber, s2.setNumber]).toEqual([1, 2])

    await deleteSet(db, s2.id)
    expect((await db.sets.get(s2.id))?.deletedAt).not.toBeNull()
    const s3 = await addSet(db, wes[1]!.id, 'press-banca', values)
    expect(s3.setNumber).toBe(3)

    await finishWorkout(db, id, '2026-09-25T18:00:00.000Z')
    expect((await db.workouts.get(id))?.finishedAt).toBe('2026-09-25T18:00:00.000Z')
  })
})

describe('discarding and restoring', () => {
  const values = { loadKg: 60, reps: 8, distanceM: null, durationS: null, rir: 3 }

  it('deletes a session with its exercises and sets, and undo restores exactly those', async () => {
    await importRoutine(db, rutina, 'T1')
    const id = await startWorkout(db, 'fase1-a', '2026-09-25', 'T2')
    const [we1] = await db.workoutExercises.where('workoutId').equals(id).sortBy('order')
    const kept = await addSet(db, we1!.id, 'sentadilla-trasera', values, 'T3')
    const older = await addSet(db, we1!.id, 'sentadilla-trasera', values, 'T3')
    await deleteSet(db, older.id, 'T4') // deleted before: must stay deleted after undo

    const ts = await deleteWorkout(db, id, 'T5')
    expect((await db.workouts.get(id))?.deletedAt).toBe('T5')
    expect((await db.workoutExercises.where('workoutId').equals(id).toArray()).every((w) => w.deletedAt === 'T5')).toBe(true)
    expect((await db.sets.get(kept.id))?.deletedAt).toBe('T5')

    await restoreWorkout(db, id, ts, 'T6')
    expect((await db.workouts.get(id))?.deletedAt).toBeNull()
    expect((await db.workoutExercises.where('workoutId').equals(id).toArray()).every((w) => w.deletedAt === null)).toBe(true)
    expect((await db.sets.get(kept.id))?.deletedAt).toBeNull()
    expect((await db.sets.get(older.id))?.deletedAt).toBe('T4')
  })

  it('finishes a forgotten session at its last change', async () => {
    await importRoutine(db, rutina, 'T1')
    const id = await startWorkout(db, 'fase1-a', '2026-09-25', '2026-09-25T17:00:00.000Z')
    const [we1] = await db.workoutExercises.where('workoutId').equals(id).sortBy('order')
    await addSet(db, we1!.id, 'sentadilla-trasera', values, '2026-09-25T17:20:00.000Z')
    await addSet(db, we1!.id, 'sentadilla-trasera', values, '2026-09-25T17:30:00.000Z')
    await finishForgottenWorkout(db, id, '2026-09-28T08:00:00.000Z')
    expect((await db.workouts.get(id))?.finishedAt).toBe('2026-09-25T17:30:00.000Z')

    const empty = await startWorkout(db, 'fase1-b', '2026-09-26', '2026-09-26T09:00:00.000Z')
    await finishForgottenWorkout(db, empty, '2026-09-28T08:00:00.000Z')
    expect((await db.workouts.get(empty))?.finishedAt).toBe('2026-09-26T09:00:00.000Z')
  })

  it('restores a deleted set and measurement', async () => {
    await importRoutine(db, rutina, 'T1')
    const id = await startWorkout(db, 'fase1-a', '2026-09-25', 'T2')
    const [we1] = await db.workoutExercises.where('workoutId').equals(id).sortBy('order')
    const s = await addSet(db, we1!.id, 'sentadilla-trasera', values, 'T3')
    await deleteSet(db, s.id, 'T4')
    await restoreSet(db, s.id, 'T5')
    expect(await db.sets.get(s.id)).toMatchObject({ deletedAt: null, updatedAt: 'T5' })

    const m = await addMeasurement(db, { date: '2026-09-25', weightKg: 80, waistCm: null, note: '' }, 'T1')
    await deleteMeasurement(db, m, 'T2')
    await restoreMeasurement(db, m, 'T3')
    expect((await db.measurements.get(m))?.deletedAt).toBeNull()
  })
})

describe('daily log and measurements', () => {
  it('keeps one log per date, even with concurrent first writes', async () => {
    await Promise.all([
      saveDailyLog(db, '2026-10-20', { sleepHours: 7 }, 'T1'),
      saveDailyLog(db, '2026-10-20', { kneePain: 3 }, 'T2'),
      saveDailyLog(db, '2026-10-21', { kneeRedFlag: true }, 'T3'),
    ])
    const logs = await db.dailyLogs.orderBy('date').toArray()
    expect(logs).toHaveLength(2)
    expect(logs[0]).toMatchObject({ date: '2026-10-20', sleepHours: 7, kneePain: 3, createdAt: 'T1', updatedAt: 'T2' })
    expect(logs[1]).toMatchObject({ kneeRedFlag: true, sleepHours: null, shift: null })
  })

  it('adds, edits and logically deletes measurements', async () => {
    const id = await addMeasurement(db, { date: '2026-10-04', weightKg: 80.5, waistCm: 90, note: '' }, 'T1')
    await updateMeasurement(db, id, { date: '2026-10-04', weightKg: 80, waistCm: 89.5, note: 'en ayunas' }, 'T2')
    expect(await db.measurements.get(id)).toMatchObject({ weightKg: 80, waistCm: 89.5, createdAt: 'T1', updatedAt: 'T2' })
    await deleteMeasurement(db, id, 'T3')
    expect((await db.measurements.get(id))?.deletedAt).toBe('T3')
  })
})

describe('loadWeekSummary', () => {
  it('reads the week from the database and formats it', async () => {
    await importRoutine(db, rutina, 'T1')
    const id = await startWorkout(db, 'fase1-a', '2026-09-30', '2026-09-30T17:00:00.000Z')
    const bench = (await db.workoutExercises.where('workoutId').equals(id).toArray()).find((w) => w.plannedExerciseId === 'press-banca')!
    await addSet(db, bench.id, 'press-banca', { loadKg: 60, reps: 8, distanceM: null, durationS: null, rir: 3 })
    await saveDailyLog(db, '2026-09-28', { sleepHours: 7 })
    await saveDailyLog(db, '2026-10-05', { sleepHours: 3, sleepQuality: 'bad' }) // next week: ignored
    const { text, week } = await loadWeekSummary(db, '2026-09-28')
    expect(week).toBe(2)
    expect(text).toContain('Semana 2 · Fase 1 (28 sep – 4 oct)\nSueño: 7,0 h de media (1 noche) · noches malas: ninguna')
    expect(text).toContain('Mié 30 · Sesión A\nSentadilla trasera: no hecho\nPress banca 60 kg: 8 · RIR 3')
  })

  it('has no text without an active routine', async () => {
    expect(await loadWeekSummary(db, '2026-09-28')).toEqual({ text: null, week: null })
  })
})

describe('backup (SPEC §13)', () => {
  it('export, wipe, import leaves every table identical', async () => {
    await importRoutine(db, rutina, 'T1')
    await db.workouts.add({
      id: 'w1',
      createdAt: 'T',
      updatedAt: 'T',
      deletedAt: null,
      date: '2026-09-25',
      startedAt: 'T',
      finishedAt: null,
      routineId: 'fase1-fullbody',
      routineDayId: 'fase1-a',
      dayKey: 'A',
      weekNumber: 1,
      notes: '',
    })
    await db.sets.add({
      id: 's1',
      createdAt: 'T',
      updatedAt: 'T',
      deletedAt: 'T2',
      workoutExerciseId: 'we1',
      exerciseId: 'press-banca',
      setNumber: 1,
      isWarmup: false,
      loadKg: 60,
      reps: 8,
      distanceM: null,
      durationS: null,
      rir: 3,
      kneePain: null,
      note: '',
    })
    await db.dailyLogs.add({
      id: 'd1',
      createdAt: 'T',
      updatedAt: 'T',
      deletedAt: null,
      date: '2026-09-25',
      sleepHours: 7.5,
      sleepQuality: 'good',
      kneePain: 0,
      kneeRedFlag: false,
      shift: 'off',
      note: '',
    })
    const before = await snapshot()

    // Round-trip through JSON text like the real file download.
    const text = JSON.stringify(await exportBackup(db))
    await Promise.all(TABLE_NAMES.map((t) => db.table(t).clear()))
    expect(await db.routines.count()).toBe(0)

    const valid = validateBackup(JSON.parse(text))
    if (!valid.ok) throw new Error(valid.errors.join('\n'))
    await restoreBackup(db, valid.value)
    expect(await snapshot()).toEqual(before)
  })

  it('rejects files that are not backups', () => {
    expect(validateBackup(rutina).ok).toBe(false)
    expect(validateBackup({ format: 'entreno-backup', formatVersion: 1, tables: {} }).ok).toBe(false)
  })

  it('names the file by local date', () => {
    expect(backupFileName(new Date(2026, 8, 28, 23, 30))).toBe('entreno-backup-2026-09-28.json')
  })
})
