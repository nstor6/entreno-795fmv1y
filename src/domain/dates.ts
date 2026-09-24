// Calendar dates are 'YYYY-MM-DD' strings in local time (SPEC §4, §15).
// Arithmetic goes through a day number built with Date.UTC so neither the
// runtime timezone nor DST changes can shift a date.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

export function isDateString(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = DATE_RE.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

function dayNumber(date: string): number {
  if (!isDateString(date)) throw new Error(`Invalid date: ${date}`)
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

function fromDayNumber(n: number): string {
  const dt = new Date(n * MS_PER_DAY)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(dayNumber(date) + days)
}

/** b − a, in days. */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a)
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(date: string): number {
  // 1970-01-01 (day 0) was a Thursday.
  return (((dayNumber(date) + 3) % 7) + 7) % 7
}

export function mondayOf(date: string): string {
  return addDays(date, -weekday(date))
}

/** Local calendar date of an instant (defaults to now). */
export function localDate(at: Date = new Date()): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

export function weekdayShort(date: string): string {
  return WEEKDAYS[weekday(date)]!
}

export function monthShort(date: string): string {
  return MONTHS[Number(date.slice(5, 7)) - 1]!
}

/** «lun 28 sep» */
export function formatShortDate(date: string): string {
  return `${weekdayShort(date)} ${Number(date.slice(8, 10))} ${monthShort(date)}`
}
