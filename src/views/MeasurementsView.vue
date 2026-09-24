<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import NumberStepper from '../components/NumberStepper.vue'
import { addMeasurement, deleteMeasurement, updateMeasurement } from '../data/diary'
import { db } from '../data/instance'
import { useLive } from '../data/live'
import { loadMeasurements } from '../data/queries'
import { formatShortDate, isDateString, localDate } from '../domain/dates'
import { formatNumber } from '../domain/format'
import { stepValue } from '../domain/setDraft'
import type { Measurement } from '../domain/types'

const { data: rows } = useLive(() => loadMeasurements(db))

const form = reactive({ date: localDate(), weightKg: null as number | null, waistCm: null as number | null, note: '' })
const editingId = ref<string | null>(null)
const error = ref<string | null>(null)
const saved = ref<string | null>(null)

// A new measurement starts from the latest one, so the +/− buttons only nudge it.
function resetForm() {
  const last = rows.value?.[0]
  Object.assign(form, { date: localDate(), weightKg: last?.weightKg ?? null, waistCm: last?.waistCm ?? null, note: '' })
  editingId.value = null
  error.value = null
}
// Reset once the list has loaded, and again after each save once the list reflects it.
let resetPending = true
watch(
  rows,
  (r) => {
    if (r && resetPending) {
      resetPending = false
      resetForm()
    }
  },
  { immediate: true },
)

function edit(m: Measurement) {
  Object.assign(form, { date: m.date, weightKg: m.weightKg, waistCm: m.waistCm, note: m.note })
  editingId.value = m.id
  error.value = null
  saved.value = null
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function step(field: 'weightKg' | 'waistCm', delta: number) {
  form[field] = stepValue(form[field], delta)
}

async function save() {
  if (!isDateString(form.date)) return (error.value = 'Elige una fecha.')
  if (form.weightKg === null && form.waistCm === null) return (error.value = 'Anota el peso, la cintura o las dos.')
  const input = { date: form.date, weightKg: form.weightKg, waistCm: form.waistCm, note: form.note.trim() }
  const id = editingId.value
  // Set before writing: the list may refresh before this function resumes.
  resetPending = true
  if (id) await updateMeasurement(db, id, input)
  else await addMeasurement(db, input)
  saved.value = id ? 'Cambios guardados.' : 'Medida guardada.'
}

const confirmingDelete = ref(false)
async function remove() {
  if (!editingId.value) return
  if (!confirmingDelete.value) return void (confirmingDelete.value = true)
  const id = editingId.value
  resetPending = true
  await deleteMeasurement(db, id)
  confirmingDelete.value = false
  saved.value = 'Medida borrada.'
}

const title = computed(() => (editingId.value ? `Editar medida · ${formatShortDate(form.date)}` : 'Nueva medida'))

function describe(m: Measurement): string {
  const parts: string[] = []
  if (m.weightKg !== null) parts.push(`${formatNumber(m.weightKg)} kg`)
  if (m.waistCm !== null) parts.push(`cintura ${formatNumber(m.waistCm)} cm`)
  return parts.join(' · ')
}
</script>

<template>
  <div class="stack">
    <header class="head"><h1>Medidas</h1></header>

    <form class="card stack" @submit.prevent="save">
      <h2>{{ title }}</h2>
      <div>
        <label class="field-label" for="m-date">Fecha</label>
        <input id="m-date" v-model="form.date" type="date" class="date" :max="localDate()" />
      </div>
      <NumberStepper
        :value="form.weightKg"
        :step="0.1"
        label="Peso kg"
        type-when-empty
        @step="(d) => step('weightKg', d)"
        @change="(v) => (form.weightKg = v)"
      />
      <NumberStepper
        :value="form.waistCm"
        :step="0.5"
        label="Cintura cm"
        type-when-empty
        @step="(d) => step('waistCm', d)"
        @change="(v) => (form.waistCm = v)"
      />
      <div>
        <label class="field-label" for="m-note">Nota</label>
        <input id="m-note" v-model="form.note" type="text" placeholder="En ayunas, tras el baño…" />
      </div>
      <p v-if="error" class="notice notice-alarm" role="alert">{{ error }}</p>
      <button type="submit" class="btn btn-primary">{{ editingId ? 'Guardar cambios' : 'Guardar medida' }}</button>
      <template v-if="editingId">
        <button type="button" class="btn btn-quiet" @click="resetForm">Cancelar</button>
        <button type="button" class="btn btn-danger" @click="remove">{{ confirmingDelete ? 'Toca otra vez para borrar' : 'Borrar medida' }}</button>
      </template>
      <p v-if="saved && !editingId" class="notice notice-info" role="status">{{ saved }}</p>
    </form>

    <div v-if="rows && rows.length === 0" class="card">
      <p class="muted">Aún no hay medidas. Apunta tu peso y tu cintura arriba.</p>
    </div>

    <ul v-else-if="rows" class="list" aria-label="Medidas anteriores">
      <li v-for="m in rows" :key="m.id">
        <button type="button" class="row" :aria-current="m.id === editingId" @click="edit(m)">
          <span class="date-col">{{ formatShortDate(m.date) }}</span>
          <span class="what">
            <strong>{{ describe(m) }}</strong>
            <span v-if="m.note" class="muted small">{{ m.note }}</span>
          </span>
          <span class="muted small">Editar</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.head {
  padding: 8px 0 4px;
}
.date {
  width: 100%;
  min-height: var(--tap);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  padding: 0 12px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.list li + li {
  border-top: 1px solid var(--line);
}
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  text-align: left;
}
.row[aria-current='true'] {
  background: var(--action-soft);
}
.date-col {
  font-family: var(--font-num);
  font-weight: 600;
  font-size: 20px;
  width: 92px;
  flex: none;
}
.what {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
