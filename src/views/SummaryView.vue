<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { downloadBackup } from '../data/backup'
import { db } from '../data/instance'
import { useLiveWith } from '../data/live'
import { loadWeekSummary } from '../data/queries'
import { readLocal, writeLocal } from '../data/storage'
import { addDays, localDate, mondayOf, monthShort } from '../domain/dates'

const thisWeek = mondayOf(localDate())
const weekStart = ref(thisWeek)
const { data: model } = useLiveWith(weekStart, (w) => loadWeekSummary(db, w))

const range = computed(() => {
  const from = weekStart.value
  const to = addDays(from, 6)
  const dm = (d: string) => `${Number(d.slice(8, 10))} ${monthShort(d)}`
  return `${dm(from)} – ${dm(to)}`
})
const canGoBack = computed(() => (model.value?.week ?? 0) > 1)
const canGoForward = computed(() => weekStart.value < thisWeek)
function move(weeks: number) {
  weekStart.value = addDays(weekStart.value, weeks * 7)
}

// The text follows the data until you edit it; edits are kept on this device, per week.
const editKey = computed(() => `entreno:summary:${weekStart.value}`)
const edited = ref<string | null>(null)
watch(editKey, (k) => (edited.value = readLocal(k)), { immediate: true })
const text = computed(() => edited.value ?? model.value?.text ?? '')
function onInput(e: Event) {
  edited.value = (e.target as HTMLTextAreaElement).value
  writeLocal(editKey.value, edited.value)
}
function restore() {
  edited.value = null
  writeLocal(editKey.value, null)
}

const status = ref<string | null>(null)
const textarea = ref<HTMLTextAreaElement | null>(null)
async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
  } catch {
    // Older browsers or no permission: select the text and use the legacy command.
    textarea.value?.select()
    if (!document.execCommand('copy')) {
      status.value = 'No se pudo copiar. Mantén pulsado el texto y cópialo a mano.'
      return
    }
  }
  status.value = 'Copiado. Pégalo en el chat con tu entrenador.'
}

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
async function share() {
  try {
    await navigator.share({ text: text.value })
    status.value = null
  } catch (e) {
    if ((e as DOMException)?.name !== 'AbortError') status.value = 'No se pudo compartir. Usa «Copiar resumen».'
  }
}

const exportMsg = ref<string | null>(null)
async function exportBackup() {
  exportMsg.value = `Copia descargada: ${await downloadBackup(db)}`
}
</script>

<template>
  <div class="stack">
    <header class="head"><h1>Resumen</h1></header>

    <div v-if="model && model.text === null" class="card stack">
      <h2>Importa una rutina para empezar</h2>
      <p class="muted">El resumen se hace con la rutina activa.</p>
      <RouterLink to="/datos" class="btn btn-primary">Ir a Datos</RouterLink>
    </div>

    <template v-else>
      <nav class="week card" aria-label="Elegir semana">
        <button type="button" class="chip" :disabled="!canGoBack" aria-label="Semana anterior" @click="move(-1)">‹</button>
        <div class="week-label">
          <strong>Semana {{ model?.week ?? '…' }}</strong>
          <span class="muted small">{{ range }}</span>
        </div>
        <button type="button" class="chip" :disabled="!canGoForward" aria-label="Semana siguiente" @click="move(1)">›</button>
      </nav>

      <section class="card stack">
        <label class="field-label" for="summary-text">Añade cómo te has sentido antes de enviarlo</label>
        <textarea id="summary-text" ref="textarea" class="summary" :value="text" rows="16" spellcheck="false" @input="onInput" />
        <button v-if="edited !== null" type="button" class="btn btn-quiet" @click="restore">Volver al texto generado</button>
        <button type="button" class="btn btn-primary" :disabled="!text" @click="copy">Copiar resumen</button>
        <button v-if="canShare" type="button" class="btn" :disabled="!text" @click="share">Compartir</button>
        <p v-if="status" class="notice notice-info" role="status">{{ status }}</p>
      </section>

      <section class="card stack">
        <p class="muted small">Aprovecha para guardar una copia de tus datos fuera del móvil.</p>
        <button type="button" class="btn" @click="exportBackup">Exportar copia</button>
        <p v-if="exportMsg" class="notice notice-info" role="status">{{ exportMsg }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.head {
  padding: 8px 0 4px;
}
.week {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
}
.week .chip {
  font-size: 26px;
  line-height: 1;
}
.week .chip:disabled {
  opacity: 0.35;
}
.week-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.summary {
  font-family: var(--font-text);
  font-size: 15px;
  line-height: 1.5;
  resize: vertical;
}
</style>
