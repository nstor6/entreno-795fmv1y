// When to remind about exporting a backup: the data only lives on this phone.
import { daysBetween } from './dates'

export const BACKUP_REMINDER_DAYS = 7

export interface BackupReminder {
  due: boolean
  /** Days since the last backup, or null if there has never been one. */
  daysSince: number | null
}

/**
 * Due when there is something to lose (at least one session) and either there has
 * never been a backup or the last one is more than BACKUP_REMINDER_DAYS old.
 */
export function backupReminder(lastBackupDate: string | null, today: string, hasSessions: boolean): BackupReminder {
  const daysSince = lastBackupDate ? daysBetween(lastBackupDate, today) : null
  const due = hasSessions && (daysSince === null || daysSince > BACKUP_REMINDER_DAYS)
  return { due, daysSince }
}

export function backupReminderText(r: BackupReminder): string {
  if (r.daysSince === null) return 'Aún no has guardado ninguna copia. Tus datos solo están en este móvil.'
  return `Tu última copia es de hace ${r.daysSince} días. Tus datos solo están en este móvil.`
}
