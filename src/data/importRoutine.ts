import { planRoutineImport, validateRoutineFile, type ImportPlan } from '../domain/routineImport'
import type { EntrenoDB } from './db'

export type ImportRoutineResult = { ok: true; plan: ImportPlan } | { ok: false; errors: string[] }

/** Validates and upserts a routine file in one transaction (SPEC §5). History is never touched. */
export async function importRoutine(db: EntrenoDB, raw: unknown, now = new Date().toISOString()): Promise<ImportRoutineResult> {
  const tables = [db.exercises, db.routines, db.routineDays, db.routineExercises]
  return db.transaction('rw', tables, async () => {
    const exercises = await db.exercises.toArray()
    const known = exercises.filter((e) => e.deletedAt === null).map((e) => e.id)
    const valid = validateRoutineFile(raw, known)
    if (!valid.ok) return valid

    const file = valid.value
    const dayIds = file.routine.days.map((d) => d.id)
    const reIds = file.routine.days.flatMap((d) => d.exercises.map((x) => x.id))
    const routineDays = await db.routineDays.where('routineId').equals(file.routine.id).toArray()
    const sameIdDays = await db.routineDays.bulkGet(dayIds)
    const allDays = dedupe([...routineDays, ...sameIdDays.filter((d) => d !== undefined)])
    const byDay = await db.routineExercises
      .where('routineDayId')
      .anyOf(allDays.map((d) => d.id))
      .toArray()
    const sameIdRes = await db.routineExercises.bulkGet(reIds)

    const plan = planRoutineImport(
      file,
      {
        exercises,
        routines: await db.routines.toArray(),
        routineDays: allDays,
        routineExercises: dedupe([...byDay, ...sameIdRes.filter((r) => r !== undefined)]),
      },
      now,
    )
    await db.exercises.bulkPut(plan.exercises)
    await db.routines.bulkPut(plan.routines)
    await db.routineDays.bulkPut(plan.routineDays)
    await db.routineExercises.bulkPut(plan.routineExercises)
    return { ok: true as const, plan }
  })
}

function dedupe<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((r) => [r.id, r])).values()]
}
