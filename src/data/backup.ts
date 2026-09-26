// Backups (SPEC §13): every table, deleted records included.
import { localDate } from '../domain/dates'
import { TABLE_NAMES, type EntrenoDB, type TableName } from './db'
import { readLocal, writeLocal } from './storage'

export const BACKUP_FORMAT = 'entreno-backup'
export const BACKUP_FORMAT_VERSION = 1

export interface Backup {
  format: typeof BACKUP_FORMAT
  formatVersion: typeof BACKUP_FORMAT_VERSION
  exportedAt: string
  tables: Record<TableName, unknown[]>
}

export async function exportBackup(db: EntrenoDB, at = new Date()): Promise<Backup> {
  return db.transaction('r', TABLE_NAMES, async () => {
    const tables = {} as Record<TableName, unknown[]>
    for (const name of TABLE_NAMES) tables[name] = await db.table(name).toArray()
    return { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: at.toISOString(), tables }
  })
}

export function backupFileName(at = new Date()): string {
  return `entreno-backup-${localDate(at)}.json`
}

// Date of the last backup saved from this device, for the reminder in Today.
const LAST_BACKUP_KEY = 'entreno:last-backup'

export function lastBackupDate(): string | null {
  return readLocal(LAST_BACKUP_KEY)
}

function markBackedUp(): void {
  writeLocal(LAST_BACKUP_KEY, localDate())
}

async function backupFile(db: EntrenoDB): Promise<File> {
  const backup = await exportBackup(db)
  return new File([JSON.stringify(backup, null, 2)], backupFileName(), { type: 'application/json' })
}

/** Exports and downloads the backup file. Returns its file name. */
export async function downloadBackup(db: EntrenoDB): Promise<string> {
  const file = await backupFile(db)
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  markBackedUp()
  return file.name
}

/** Whether this browser can hand a file to other apps (Drive, WhatsApp…) through the share menu. */
export function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' })
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** Sends the backup through the share menu; falls back to a download where that isn't possible. */
export async function shareBackup(db: EntrenoDB): Promise<ShareResult> {
  if (!canShareFiles()) {
    await downloadBackup(db)
    return 'downloaded'
  }
  const file = await backupFile(db)
  try {
    await navigator.share({ files: [file], title: 'Copia de Entreno' })
    markBackedUp()
    return 'shared'
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
    await downloadBackup(db)
    return 'downloaded'
  }
}

export type BackupValidation = { ok: true; value: Backup } | { ok: false; errors: string[] }

export function validateBackup(raw: unknown): BackupValidation {
  const errors: string[] = []
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: ['El archivo no es una copia de Entreno.'] }
  const b = raw as Record<string, unknown>
  if (b.format !== BACKUP_FORMAT) return { ok: false, errors: ['El archivo no es una copia de Entreno.'] }
  if (b.formatVersion !== BACKUP_FORMAT_VERSION)
    return { ok: false, errors: [`Esta app solo lee copias de la versión ${BACKUP_FORMAT_VERSION}.`] }
  const tables = b.tables
  if (typeof tables !== 'object' || tables === null) return { ok: false, errors: ['Faltan las tablas de la copia.'] }
  const t = tables as Record<string, unknown>
  for (const name of TABLE_NAMES) {
    const rows = t[name]
    if (!Array.isArray(rows)) {
      errors.push(`Falta la tabla «${name}».`)
      continue
    }
    rows.forEach((r, i) => {
      if (typeof r !== 'object' || r === null || typeof (r as { id?: unknown }).id !== 'string')
        errors.push(`${name}[${i}]: registro sin id.`)
    })
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: raw as Backup }
}

/** Replaces the whole database with the backup, in one transaction. */
export async function restoreBackup(db: EntrenoDB, backup: Backup): Promise<void> {
  await db.transaction('rw', TABLE_NAMES, async () => {
    for (const name of TABLE_NAMES) {
      const table = db.table(name)
      await table.clear()
      await table.bulkAdd(backup.tables[name])
    }
  })
}
