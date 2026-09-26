// Backups (SPEC §13): every table, deleted records included.
import { localDate } from '../domain/dates'
import { TABLE_NAMES, type EntrenoDB, type TableName } from './db'

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

/** Exports and downloads the backup file. Returns its file name. */
export async function downloadBackup(db: EntrenoDB): Promise<string> {
  const backup = await exportBackup(db)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName()
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return a.download
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
