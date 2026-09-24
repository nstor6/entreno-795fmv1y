// Routine JSON import (SPEC §5): validation and a pure upsert plan.
// Applying the plan inside a Dexie transaction lives in src/data/.
import { isDateString } from './dates'
import type {
  AltReason,
  Alternative,
  Base,
  Exercise,
  Measure,
  Routine,
  RoutineDay,
  RoutineExercise,
  WeekOverride,
} from './types'

export const ROUTINE_FORMAT = 'entreno-rutina'
export const ROUTINE_FORMAT_VERSION = 1

type Content<T extends Base> = Omit<T, keyof Base>

export interface ExerciseInput extends Content<Exercise> {
  id: string
}
export interface RoutineExerciseInput extends Omit<Content<RoutineExercise>, 'routineDayId'> {
  id: string
}
export interface RoutineDayInput extends Omit<Content<RoutineDay>, 'routineId'> {
  id: string
  exercises: RoutineExerciseInput[]
}
export interface RoutineInput extends Omit<Content<Routine>, 'active'> {
  id: string
  days: RoutineDayInput[]
}
export interface RoutineFile {
  format: typeof ROUTINE_FORMAT
  formatVersion: typeof ROUTINE_FORMAT_VERSION
  exercises: ExerciseInput[]
  routine: RoutineInput
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const MEASURES: Measure[] = ['reps', 'meters', 'seconds']
const REASONS: AltReason[] = ['knee', 'easier', 'equipment']

type Obj = Record<string, unknown>

class Checker {
  errors: string[] = []
  fail(path: string, msg: string): void {
    this.errors.push(`${path}: ${msg}`)
  }
  obj(v: unknown, path: string): v is Obj {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) return true
    this.fail(path, 'tiene que ser un objeto')
    return false
  }
  arr(v: unknown, path: string): v is unknown[] {
    if (Array.isArray(v)) return true
    this.fail(path, 'tiene que ser una lista')
    return false
  }
  str(o: Obj, k: string, path: string, nonEmpty = false): string {
    const v = o[k]
    if (typeof v !== 'string' || (nonEmpty && v.trim() === '')) {
      this.fail(`${path}.${k}`, nonEmpty ? 'falta o está vacío' : 'tiene que ser un texto')
      return ''
    }
    return v
  }
  num(o: Obj, k: string, path: string, opts: { int?: boolean; min?: number; nullable?: boolean } = {}): number | null {
    const v = o[k]
    if (v === null && opts.nullable) return null
    const ok =
      typeof v === 'number' &&
      Number.isFinite(v) &&
      (!opts.int || Number.isInteger(v)) &&
      (opts.min === undefined || v >= opts.min)
    if (!ok) {
      const kind = opts.int ? 'un número entero' : 'un número'
      const min = opts.min !== undefined ? ` mayor o igual que ${opts.min}` : ''
      this.fail(`${path}.${k}`, `tiene que ser ${kind}${min}${opts.nullable ? ' o null' : ''}`)
      return opts.nullable ? null : 0
    }
    return v as number
  }
  bool(o: Obj, k: string, path: string): boolean {
    const v = o[k]
    if (typeof v !== 'boolean') {
      this.fail(`${path}.${k}`, 'tiene que ser true o false')
      return false
    }
    return v
  }
  nullableStr(o: Obj, k: string, path: string): string | null {
    const v = o[k]
    if (v === null) return null
    if (typeof v !== 'string') {
      this.fail(`${path}.${k}`, 'tiene que ser un texto o null')
      return null
    }
    return v
  }
  unique(ids: string[], path: string): void {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) this.fail(path, `el id «${id}» está repetido`)
      seen.add(id)
    }
  }
}

/**
 * Validates the file shape. `knownExerciseIds` are catalog ids already in the
 * database, so a routine may reference exercises imported earlier.
 */
export function validateRoutineFile(raw: unknown, knownExerciseIds: Iterable<string> = []): ValidationResult<RoutineFile> {
  const c = new Checker()
  if (!c.obj(raw, 'archivo')) return { ok: false, errors: c.errors }
  if (raw.format !== ROUTINE_FORMAT) {
    c.fail('format', `tiene que ser «${ROUTINE_FORMAT}». ¿Seguro que es un archivo de rutina?`)
    return { ok: false, errors: c.errors }
  }
  if (raw.formatVersion !== ROUTINE_FORMAT_VERSION) {
    c.fail('formatVersion', `esta app solo lee la versión ${ROUTINE_FORMAT_VERSION}`)
    return { ok: false, errors: c.errors }
  }

  const exercises: ExerciseInput[] = []
  if (c.arr(raw.exercises, 'exercises')) {
    raw.exercises.forEach((e, i) => {
      const p = `exercises[${i}]`
      if (!c.obj(e, p)) return
      const measure = e.measure as Measure
      if (!MEASURES.includes(measure)) c.fail(`${p}.measure`, 'tiene que ser reps, meters o seconds')
      const alternatives: Alternative[] = []
      if (c.arr(e.alternatives, `${p}.alternatives`)) {
        e.alternatives.forEach((a, j) => {
          const ap = `${p}.alternatives[${j}]`
          if (!c.obj(a, ap)) return
          const reason = a.reason as AltReason
          if (!REASONS.includes(reason)) c.fail(`${ap}.reason`, 'tiene que ser knee, easier o equipment')
          alternatives.push({ exerciseId: c.str(a, 'exerciseId', ap, true), reason })
        })
      }
      exercises.push({
        id: c.str(e, 'id', p, true),
        name: c.str(e, 'name', p, true),
        measure,
        perSide: c.bool(e, 'perSide', p),
        bodyweight: c.bool(e, 'bodyweight', p),
        loadIncrementKg: c.num(e, 'loadIncrementKg', p, { min: 0, nullable: true }),
        alternatives,
      })
    })
    c.unique(
      exercises.map((e) => e.id),
      'exercises',
    )
  }

  let routine: RoutineInput | null = null
  if (c.obj(raw.routine, 'routine')) {
    const r = raw.routine
    const startDate = c.str(r, 'startDate', 'routine', true)
    if (startDate && !isDateString(startDate)) c.fail('routine.startDate', 'tiene que ser una fecha AAAA-MM-DD')

    const warmup: string[] = []
    if (c.arr(r.warmup, 'routine.warmup')) {
      r.warmup.forEach((w, i) => {
        if (typeof w === 'string') warmup.push(w)
        else c.fail(`routine.warmup[${i}]`, 'tiene que ser un texto')
      })
    }

    const weekOverrides: WeekOverride[] = []
    if (c.arr(r.weekOverrides, 'routine.weekOverrides')) {
      r.weekOverrides.forEach((o, i) => {
        const p = `routine.weekOverrides[${i}]`
        if (!c.obj(o, p)) return
        const weeks: number[] = []
        if (c.arr(o.weeks, `${p}.weeks`)) {
          o.weeks.forEach((w, j) => {
            if (typeof w === 'number' && Number.isInteger(w) && w >= 1) weeks.push(w)
            else c.fail(`${p}.weeks[${j}]`, 'tiene que ser un número de semana (1, 2…)')
          })
        }
        const wo: WeekOverride = { weeks }
        if (o.sets !== undefined) wo.sets = c.num(o, 'sets', p, { int: true, min: 1 }) ?? 0
        if (o.rirMin !== undefined) wo.rirMin = c.num(o, 'rirMin', p, { min: 0 }) ?? 0
        if (o.rirMax !== undefined) wo.rirMax = c.num(o, 'rirMax', p, { min: 0 }) ?? 0
        if (o.label !== undefined) wo.label = c.str(o, 'label', p)
        weekOverrides.push(wo)
      })
    }

    const days: RoutineDayInput[] = []
    if (c.arr(r.days, 'routine.days')) {
      if (r.days.length === 0) c.fail('routine.days', 'la rutina no tiene días')
      r.days.forEach((d, i) => {
        const p = `routine.days[${i}]`
        if (!c.obj(d, p)) return
        const dayExercises: RoutineExerciseInput[] = []
        if (c.arr(d.exercises, `${p}.exercises`)) {
          d.exercises.forEach((x, j) => {
            const xp = `${p}.exercises[${j}]`
            if (!c.obj(x, xp)) return
            const re: RoutineExerciseInput = {
              id: c.str(x, 'id', xp, true),
              exerciseId: c.str(x, 'exerciseId', xp, true),
              order: c.num(x, 'order', xp, { int: true }) ?? 0,
              sets: c.num(x, 'sets', xp, { int: true, min: 1 }) ?? 0,
              targetMin: c.num(x, 'targetMin', xp, { min: 0 }) ?? 0,
              targetMax: c.num(x, 'targetMax', xp, { min: 0 }) ?? 0,
              rirMin: c.num(x, 'rirMin', xp, { min: 0, nullable: true }),
              rirMax: c.num(x, 'rirMax', xp, { min: 0, nullable: true }),
              restSecMin: c.num(x, 'restSecMin', xp, { int: true, min: 0 }) ?? 0,
              restSecMax: c.num(x, 'restSecMax', xp, { int: true, min: 0 }) ?? 0,
              notes: c.str(x, 'notes', xp),
              supersetGroup: c.nullableStr(x, 'supersetGroup', xp),
            }
            if (re.targetMin > re.targetMax) c.fail(xp, 'targetMin es mayor que targetMax')
            if ((re.rirMin === null) !== (re.rirMax === null)) c.fail(xp, 'rirMin y rirMax tienen que ser los dos null o los dos números')
            else if (re.rirMin !== null && re.rirMax !== null && re.rirMin > re.rirMax) c.fail(xp, 'rirMin es mayor que rirMax')
            dayExercises.push(re)
          })
        }
        days.push({
          id: c.str(d, 'id', p, true),
          key: c.str(d, 'key', p, true),
          name: c.str(d, 'name', p, true),
          order: c.num(d, 'order', p, { int: true }) ?? 0,
          exercises: dayExercises,
        })
      })
      c.unique(
        days.map((d) => d.id),
        'routine.days',
      )
      c.unique(
        days.flatMap((d) => d.exercises.map((x) => x.id)),
        'routine.days[].exercises',
      )
    }

    routine = {
      id: c.str(r, 'id', 'routine', true),
      name: c.str(r, 'name', 'routine', true),
      shortName: c.str(r, 'shortName', 'routine', true),
      startDate,
      notes: c.str(r, 'notes', 'routine'),
      warmup,
      weekOverrides,
      days,
    }
  }

  // Every referenced exercise must exist in this file or already be in the database.
  const known = new Set([...knownExerciseIds, ...exercises.map((e) => e.id)])
  exercises.forEach((e, i) =>
    e.alternatives.forEach((a, j) => {
      if (a.exerciseId && !known.has(a.exerciseId))
        c.fail(`exercises[${i}].alternatives[${j}]`, `el ejercicio «${a.exerciseId}» no está en el catálogo`)
    }),
  )
  routine?.days.forEach((d, i) =>
    d.exercises.forEach((x, j) => {
      if (x.exerciseId && !known.has(x.exerciseId))
        c.fail(`routine.days[${i}].exercises[${j}]`, `el ejercicio «${x.exerciseId}» no está en el catálogo`)
    }),
  )

  if (c.errors.length > 0 || !routine) return { ok: false, errors: c.errors }
  return {
    ok: true,
    value: { format: ROUTINE_FORMAT, formatVersion: ROUTINE_FORMAT_VERSION, exercises, routine },
  }
}

/** What is currently stored and may be touched by an import. */
export interface ImportExisting {
  exercises: Exercise[]
  routines: Routine[]
  /** Days of the imported routine (by routineId) plus any with the same ids. */
  routineDays: RoutineDay[]
  /** Exercises of those days plus any with the same ids. */
  routineExercises: RoutineExercise[]
}

/** Records to write. Only changed records are included, so re-importing is a no-op. */
export interface ImportPlan {
  exercises: Exercise[]
  routines: Routine[]
  routineDays: RoutineDay[]
  routineExercises: RoutineExercise[]
}

function sameContent(a: object, b: object): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Keys of `content` in a fixed order so comparisons don't depend on key order. */
function pick<T extends Base>(prev: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = (prev as unknown as Record<string, unknown>)[k]
  return out
}

function upsert<T extends Base>(prev: T | undefined, id: string, content: Content<T>, now: string): T | null {
  if (prev && prev.deletedAt === null) {
    const keys = Object.keys(content)
    if (sameContent(pick(prev, keys), content)) return null
    return { ...prev, ...content, updatedAt: now }
  }
  if (prev) return { ...prev, ...content, updatedAt: now, deletedAt: null }
  return { id, createdAt: now, updatedAt: now, deletedAt: null, ...content } as T
}

export function planRoutineImport(file: RoutineFile, existing: ImportExisting, now: string): ImportPlan {
  const plan: ImportPlan = { exercises: [], routines: [], routineDays: [], routineExercises: [] }
  const byId = <T extends Base>(rows: T[]) => new Map(rows.map((r) => [r.id, r]))

  const exMap = byId(existing.exercises)
  for (const { id, ...content } of file.exercises) {
    const rec = upsert<Exercise>(exMap.get(id), id, content, now)
    if (rec) plan.exercises.push(rec)
  }

  const { days, id: routineId, ...routineContent } = file.routine
  const routineMap = byId(existing.routines)
  const rec = upsert<Routine>(routineMap.get(routineId), routineId, { ...routineContent, active: true }, now)
  if (rec) plan.routines.push(rec)
  for (const r of existing.routines) {
    if (r.id !== routineId && r.active) plan.routines.push({ ...r, active: false, updatedAt: now })
  }

  const dayMap = byId(existing.routineDays)
  const reMap = byId(existing.routineExercises)
  const seenDays = new Set<string>()
  const seenRes = new Set<string>()
  for (const { exercises, id: dayId, ...dayContent } of days) {
    seenDays.add(dayId)
    const d = upsert<RoutineDay>(dayMap.get(dayId), dayId, { routineId, ...dayContent }, now)
    if (d) plan.routineDays.push(d)
    for (const { id: reId, ...reContent } of exercises) {
      seenRes.add(reId)
      const re = upsert<RoutineExercise>(reMap.get(reId), reId, { routineDayId: dayId, ...reContent }, now)
      if (re) plan.routineExercises.push(re)
    }
  }

  // Days and exercises of this routine that are no longer in the file are soft-deleted.
  const routineDayIds = new Set(existing.routineDays.filter((d) => d.routineId === routineId).map((d) => d.id))
  for (const d of existing.routineDays) {
    if (routineDayIds.has(d.id) && !seenDays.has(d.id) && d.deletedAt === null)
      plan.routineDays.push({ ...d, deletedAt: now, updatedAt: now })
  }
  for (const re of existing.routineExercises) {
    if (routineDayIds.has(re.routineDayId) && !seenRes.has(re.id) && re.deletedAt === null)
      plan.routineExercises.push({ ...re, deletedAt: now, updatedAt: now })
  }

  return plan
}
