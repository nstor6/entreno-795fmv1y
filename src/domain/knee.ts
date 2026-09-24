// Knee warnings (SPEC §10).
import { addDays, daysBetween } from './dates'
import { isAlive, type DailyLog, type SetLog, type Workout, type WorkoutExercise } from './types'

/** Days with discomfort may be at most this far apart to belong to the same episode. */
const EPISODE_MAX_GAP = 3
/** An episode is ongoing when its last day is at most this many days before today. */
const ONGOING_MAX_AGE = 3
const RED_FLAG_WINDOW = 3
const SOFT_DAYS = 7
const STRONG_DAYS = 14

export const KNEE_RED_FLAG_TEXT = 'Hinchazón, bloqueo o sensación de fallo: consúltalo con un fisio o médico.'
export const KNEE_STRONG_TEXT = 'La rodilla lleva más de dos semanas molestando: pide cita con un fisio o médico.'
export const kneeSoftText = (days: number) =>
  `La rodilla lleva ${days} días dando guerra. Si pasa de 1-2 semanas o empeora, toca fisio o médico.`

export interface KneeStatus {
  /** Duration in days of the ongoing episode, or null if there is none. */
  ongoingDays: number | null
  level: 'none' | 'soft' | 'strong'
  redFlag: boolean
}

/**
 * Dates with discomfort: a daily log with kneePain > 0, or any set that day
 * (by its workout's date) with kneePain > 0. Sorted, unique.
 */
export function kneePainDates(
  dailyLogs: DailyLog[],
  sets: SetLog[],
  workoutExercises: WorkoutExercise[],
  workouts: Workout[],
): string[] {
  const dates = new Set<string>()
  for (const d of dailyLogs) if (isAlive(d) && (d.kneePain ?? 0) > 0) dates.add(d.date)

  const workoutDate = new Map(workouts.filter(isAlive).map((w) => [w.id, w.date]))
  const weDate = new Map<string, string>()
  for (const we of workoutExercises) {
    const date = isAlive(we) ? workoutDate.get(we.workoutId) : undefined
    if (date) weDate.set(we.id, date)
  }
  for (const s of sets) {
    if (!isAlive(s) || (s.kneePain ?? 0) <= 0) continue
    const date = weDate.get(s.workoutExerciseId)
    if (date) dates.add(date)
  }
  return [...dates].sort()
}

/** Last episode of the given pain dates (up to today), as [first, last]. */
function lastEpisode(painDates: string[], today: string): [string, string] | null {
  const past = [...new Set(painDates)].filter((d) => d <= today).sort()
  const last = past[past.length - 1]
  if (!last) return null
  let first = last
  for (let i = past.length - 2; i >= 0; i--) {
    const d = past[i]!
    if (daysBetween(d, first) > EPISODE_MAX_GAP) break
    first = d
  }
  return [first, last]
}

export function kneeStatus(painDates: string[], redFlagDates: string[], today: string): KneeStatus {
  const windowStart = addDays(today, -RED_FLAG_WINDOW)
  const redFlag = redFlagDates.some((d) => d >= windowStart && d <= today)

  const episode = lastEpisode(painDates, today)
  if (!episode || daysBetween(episode[1], today) > ONGOING_MAX_AGE) return { ongoingDays: null, level: 'none', redFlag }

  const days = daysBetween(episode[0], episode[1]) + 1
  const level = days >= STRONG_DAYS ? 'strong' : days >= SOFT_DAYS ? 'soft' : 'none'
  return { ongoingDays: days, level, redFlag }
}

/** Warning texts to show, most serious first. */
export function kneeMessages(status: KneeStatus): { level: 'alarm' | 'warn'; text: string }[] {
  const out: { level: 'alarm' | 'warn'; text: string }[] = []
  if (status.redFlag) out.push({ level: 'alarm', text: KNEE_RED_FLAG_TEXT })
  if (status.level === 'strong') out.push({ level: 'alarm', text: KNEE_STRONG_TEXT })
  if (status.level === 'soft' && status.ongoingDays !== null) out.push({ level: 'warn', text: kneeSoftText(status.ongoingDays) })
  return out
}
