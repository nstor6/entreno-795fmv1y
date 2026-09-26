<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { canShareFiles, downloadBackup, lastBackupDate, restoreBackup, shareBackup, validateBackup, type Backup } from '../data/backup'
import { importRoutine } from '../data/importRoutine'
import { db } from '../data/instance'
import { useLive } from '../data/live'
import { requestPersistence, storageStatus, type StorageStatus } from '../data/storage'
import PlateSettingsCard from '../components/PlateSettingsCard.vue'
import { formatShortDate } from '../domain/dates'
import { parsePastedJson } from '../domain/pastedJson'
import { isAlive } from '../domain/types'

const { data: active } = useLive(async () => {
  const routine = (await db.routines.toArray()).find((r) => r.active && isAlive(r))
  if (!routine) return null
  const days = (await db.routineDays.where('routineId').equals(routine.id).toArray()).filter(isAlive)
  return { routine, days: days.length }
})

async function readJson(file: File): Promise<unknown> {
  const text = await file.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido. Revisa que sea el archivo correcto.')
  }
}

function pickFile(e: Event): File | null {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  return file
}

// Routine import, from a file or from text pasted from the chat with the coach
const routineMsg = ref<string | null>(null)
const routineErrors = ref<string[]>([])
async function runRoutineImport(read: () => Promise<unknown>) {
  routineMsg.value = null
  routineErrors.value = []
  try {
    const result = await importRoutine(db, await read())
    if (!result.ok) {
      routineErrors.value = result.errors
      return false
    }
    const r = await db.routines.toArray()
    const activeRoutine = r.find((x) => x.active)
    routineMsg.value = `Rutina importada: ${activeRoutine?.name ?? ''}.`
    return true
  } catch (err) {
    routineErrors.value = [err instanceof Error ? err.message : 'No se pudo importar la rutina.']
    return false
  }
}
async function onRoutineFile(e: Event) {
  const file = pickFile(e)
  if (file) await runRoutineImport(() => readJson(file))
}
const pasted = ref('')
async function onRoutinePaste() {
  const ok = await runRoutineImport(async () => parsePastedJson(pasted.value))
  if (ok) pasted.value = ''
}

// Backup export
const exportMsg = ref<string | null>(null)
const lastBackup = ref(lastBackupDate())
const shareFiles = canShareFiles()
async function onExport() {
  exportMsg.value = `Copia descargada: ${await downloadBackup(db)}`
  lastBackup.value = lastBackupDate()
}
async function onShare() {
  const result = await shareBackup(db)
  if (result === 'cancelled') return
  exportMsg.value = result === 'shared' ? 'Copia enviada.' : 'Copia descargada.'
  lastBackup.value = lastBackupDate()
}

// Backup import: validate, confirm, replace
const pending = ref<Backup | null>(null)
const backupErrors = ref<string[]>([])
const backupMsg = ref<string | null>(null)
async function onBackupFile(e: Event) {
  const file = pickFile(e)
  if (!file) return
  pending.value = null
  backupErrors.value = []
  backupMsg.value = null
  try {
    const v = validateBackup(await readJson(file))
    if (!v.ok) backupErrors.value = v.errors
    else pending.value = v.value
  } catch (err) {
    backupErrors.value = [err instanceof Error ? err.message : 'No se pudo leer la copia.']
  }
}
function countRows(b: Backup): { workouts: number; sets: number } {
  return { workouts: b.tables.workouts.length, sets: b.tables.sets.length }
}
async function confirmRestore() {
  if (!pending.value) return
  try {
    await restoreBackup(db, pending.value)
    backupMsg.value = 'Copia importada. Tus datos son ahora los de la copia.'
  } catch {
    backupErrors.value = ['No se pudo importar la copia. Tus datos no han cambiado.']
  }
  pending.value = null
}

// Persistent storage
const storage = ref<StorageStatus | null>(null)
async function refreshStorage() {
  storage.value = await storageStatus()
}
async function askPersistence() {
  await requestPersistence()
  await refreshStorage()
}
onMounted(refreshStorage)

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
function formatExportDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="stack">
    <header class="head"><h1>Datos</h1></header>

    <section class="card stack">
      <h2>Rutina</h2>
      <p v-if="active" class="muted">Activa: {{ active.routine.name }} · {{ active.days }} días</p>
      <p v-else-if="active === null" class="muted">Aún no hay rutina. Importa el archivo JSON que te pase tu entrenador.</p>
      <label class="btn btn-primary file">
        Importar rutina
        <input type="file" accept=".json,application/json" class="visually-hidden" @change="onRoutineFile" />
      </label>
      <details class="paste">
        <summary class="paste-title">Pegar la rutina desde el chat</summary>
        <div class="stack paste-body">
          <label class="field-label" for="routine-text">Copia el mensaje con la rutina y pégalo aquí</label>
          <textarea id="routine-text" v-model="pasted" rows="5" spellcheck="false" placeholder="{ &quot;format&quot;: &quot;entreno-rutina&quot;, … }" />
          <button type="button" class="btn" :disabled="!pasted.trim()" @click="onRoutinePaste">Importar texto pegado</button>
        </div>
      </details>
      <p v-if="routineMsg" class="notice notice-info" role="status">{{ routineMsg }}</p>
      <div v-if="routineErrors.length" class="notice notice-alarm" role="alert">
        <p>No se ha importado nada: el archivo tiene errores.</p>
        <ul class="errors">
          <li v-for="(e, i) in routineErrors" :key="i">{{ e }}</li>
        </ul>
      </div>
    </section>

    <section class="card stack">
      <h2>Copia de seguridad</h2>
      <p class="muted small">Guarda todos tus datos en un archivo. Hazla cada semana y guárdala fuera del móvil.</p>
      <p class="small">
        Última copia desde este móvil: <strong>{{ lastBackup ? formatShortDate(lastBackup) : 'ninguna' }}</strong>
      </p>
      <button v-if="shareFiles" type="button" class="btn btn-primary" @click="onShare">Compartir copia</button>
      <button type="button" class="btn" @click="onExport">Exportar copia</button>
      <p v-if="exportMsg" class="notice notice-info" role="status">{{ exportMsg }}</p>

      <label class="btn file">
        Importar copia
        <input type="file" accept=".json,application/json" class="visually-hidden" @change="onBackupFile" />
      </label>

      <div v-if="pending" class="notice notice-warn stack" role="alertdialog" aria-label="Confirmar importación">
        <p>
          Esta copia es del {{ formatExportDate(pending.exportedAt) }} y tiene {{ countRows(pending).workouts }} sesiones.
          Va a reemplazar todos tus datos actuales.
        </p>
        <button type="button" class="btn btn-danger" @click="confirmRestore">Reemplazar mis datos</button>
        <button type="button" class="btn btn-quiet" @click="pending = null">Cancelar</button>
      </div>
      <p v-if="backupMsg" class="notice notice-info" role="status">{{ backupMsg }}</p>
      <div v-if="backupErrors.length" class="notice notice-alarm" role="alert">
        <ul class="errors">
          <li v-for="(e, i) in backupErrors" :key="i">{{ e }}</li>
        </ul>
      </div>
    </section>

    <PlateSettingsCard />

    <section class="card stack">
      <h2>Almacenamiento</h2>
      <template v-if="storage">
        <p v-if="!storage.supported" class="muted">Este navegador no informa del almacenamiento.</p>
        <p v-else-if="storage.persisted">Persistente: el navegador no borrará tus datos para liberar espacio.</p>
        <template v-else>
          <p class="notice notice-warn">
            No persistente: si el móvil se queda sin espacio, el navegador podría borrar tus datos. Instala la app y haz copias.
          </p>
          <button type="button" class="btn" @click="askPersistence">Pedir almacenamiento persistente</button>
        </template>
        <p v-if="storage.usageBytes !== null" class="muted small">En uso: {{ formatBytes(storage.usageBytes) }}</p>
      </template>
    </section>
  </div>
</template>

<style scoped>
.head {
  padding: 8px 0 4px;
}
.file {
  cursor: pointer;
}
.errors {
  margin: 6px 0 0;
  padding-left: 18px;
}
.paste-title {
  font-weight: 700;
  min-height: var(--tap);
  display: flex;
  align-items: center;
  cursor: pointer;
  color: var(--action-ink);
}
.paste-body {
  padding-top: 4px;
}
#routine-text {
  font-family: ui-monospace, monospace;
  font-size: 14px;
}
</style>
