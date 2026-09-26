// Weekly summary for the coach (SPEC §12): week data → plain text.
import { addDays, monthShort, weekdayShort } from './dates'
import { formatNumber, formatWorkoutExerciseLines } from './format'
import { isAlive, type DailyLog, type Exercise, type Measurement, type SetLog, type Workout, type WorkoutExercise } from './types'
import { weekNumber } from './weeks'

export interface WeekSummaryInput {
  /** Active routine. */
  shortName: string
  startDate: string
  /** Monday of the week. */
  weekStart: string
  dailyLogs: DailyLog[]
  measurements: Measurement[]
  workouts: Workout[]
  workoutExercises: WorkoutExercise[]
  sets: SetLog[]
  exercises: ReadonlyMap<string, Exercise>
}

const dayMonth = (date: string) => `${Number(date.slice(8, 10))} ${monthShort(date)}`
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function weeklySummary(input: WeekSummaryInput): string {
  const from = input.weekStart
  const to = addDays(from, 6)
  const inWeek = (date: string) => date >= from && date <= to

  const logs = input.dailyLogs.filter((d) => isAlive(d) && inWeek(d.date)).sort((a, b) => a.date.localeCompare(b.date))
  const workouts = input.workouts
    .filter((w) => isAlive(w) && inWeek(w.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt))
  const wesOf = (workoutId: string) =>
    input.workoutExercises.filter((we) => isAlive(we) && we.workoutId === workoutId).sort((a, b) => a.order - b.order)
  const setsOf = (weId: string) =>
    input.sets.filter((s) => isAlive(s) && s.workoutExerciseId === weId).sort((a, b) => a.setNumber - b.setNumber)
  const name = (id: string) => input.exercises.get(id)?.name ?? id

  // Header
  const header = [`Semana ${weekNumber(input.startDate, from)} · ${input.shortName} (${dayMonth(from)} – ${dayMonth(to)})`]

  const slept = logs.filter((d) => d.sleepHours !== null)
  if (slept.length === 0) {
    header.push('Sueño: sin registros')
  } else {
    const avg = slept.reduce((sum, d) => sum + d.sleepHours!, 0) / slept.length
    const bad = logs.filter((d) => d.sleepQuality === 'bad').map((d) => weekdayShort(d.date))
    header.push(
      `Sueño: ${avg.toFixed(1).replace('.', ',')} h de media (${slept.length} ${slept.length === 1 ? 'noche' : 'noches'})` +
        ` · noches malas: ${bad.length ? bad.join(', ') : 'ninguna'}`,
    )
  }

  // Knee, in chronological order: per exercise, per day (only without set discomfort), red flags.
  const knee: string[] = []
  const dates = [...new Set([...logs.map((d) => d.date), ...workouts.map((w) => w.date)])].sort()
  for (const date of dates) {
    const maxByExercise = new Map<string, number>()
    for (const w of workouts.filter((x) => x.date === date)) {
      for (const we of wesOf(w.id)) {
        for (const s of setsOf(we.id)) {
          if ((s.kneePain ?? 0) > 0) maxByExercise.set(s.exerciseId, Math.max(maxByExercise.get(s.exerciseId) ?? 0, s.kneePain!))
        }
      }
    }
    const day = weekdayShort(date)
    for (const [exerciseId, max] of maxByExercise) knee.push(`${name(exerciseId).toLowerCase()} (${day}) ${max}/10`)
    const log = logs.find((d) => d.date === date)
    if (maxByExercise.size === 0 && (log?.kneePain ?? 0) > 0) knee.push(`${day} ${log!.kneePain}/10`)
    if (log?.kneeRedFlag) knee.push(`AVISO hinchazón, bloqueo o fallo (${day})`)
  }
  header.push(knee.length ? `Rodilla: ${knee.join('; ')}` : 'Rodilla: sin molestias')

  const lastMeasure = input.measurements
    .filter((m) => isAlive(m) && inWeek(m.date))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
  if (lastMeasure) {
    const parts: string[] = []
    if (lastMeasure.weightKg !== null) parts.push(`${formatNumber(lastMeasure.weightKg)} kg`)
    if (lastMeasure.waistCm !== null) parts.push(`cintura ${formatNumber(lastMeasure.waistCm)} cm`)
    if (parts.length) header.push(`Medidas: ${parts.join(' · ')}`)
  }

  const blocks = [header.join('\n')]

  // One block per session
  for (const w of workouts) {
    const lines = [`${capitalize(weekdayShort(w.date))} ${Number(w.date.slice(8, 10))} · Sesión ${w.dayKey}`]
    for (const we of wesOf(w.id)) {
      const planned = input.exercises.get(we.plannedExerciseId)
      if (!planned) continue
      lines.push(...formatWorkoutExerciseLines(planned, input.exercises, setsOf(we.id), we.notes))
    }
    blocks.push(lines.join('\n'))
  }

  // Notes from the diary and the sessions, by date
  const notes: string[] = []
  for (const date of dates) {
    const day = weekdayShort(date)
    const log = logs.find((d) => d.date === date)
    if (log?.note.trim()) notes.push(`${day}: ${log.note.trim()}`)
    for (const w of workouts.filter((x) => x.date === date)) if (w.notes.trim()) notes.push(`${day}: ${w.notes.trim()}`)
  }
  if (notes.length) blocks.push(`Notas: ${notes.join('; ')}`)

  return blocks.join('\n\n')
}
