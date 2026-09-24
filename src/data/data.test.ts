import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import rutina from '../../data/rutina-fase1.json'
import { backupFileName, exportBackup, restoreBackup, validateBackup } from './backup'
import { EntrenoDB, TABLE_NAMES } from './db'
import { importRoutine } from './importRoutine'
import { addSet, deleteSet, finishWorkout, startWorkout } from './session'

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
