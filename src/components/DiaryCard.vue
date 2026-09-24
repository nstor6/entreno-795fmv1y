<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { emptyDailyLog, saveDailyLog, type DailyLogPatch } from '../data/diary'
import { db } from '../data/instance'
import { stepValue } from '../domain/setDraft'
import type { DailyLog, Shift, SleepQuality } from '../domain/types'
import NumberStepper from './NumberStepper.vue'

const props = defineProps<{ date: string; log: DailyLog | null; lastSleepHours: number | null }>()

const QUALITY: { value: SleepQuality; label: string }[] = [
  { value: 'good', label: 'Bien' },
  { value: 'ok', label: 'Regular' },
  { value: 'bad', label: 'Mal' },
]
const SHIFT: { value: Shift; label: string }[] = [
  { value: 'morning', label: 'Mañana' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'off', label: 'Libre' },
]
const KNEE = Array.from({ length: 11 }, (_, i) => i)

// Local copy so taps respond at once; it follows the database when no write of ours is pending.
let noteFocused = false
const d = reactive<DailyLog>(props.log ? { ...props.log } : emptyDailyLog(props.date, ''))
let inFlight = 0
watch(
  () => props.log,
  (fresh) => {
    if (fresh && inFlight === 0) Object.assign(d, { ...fresh, note: noteFocused ? d.note : fresh.note })
  },
)

function patch(p: DailyLogPatch) {
  Object.assign(d, p)
  inFlight++
  void saveDailyLog(db, props.date, p).finally(() => inFlight--)
}

// Sleep: the first tap starts from the last logged night (or 7 h) instead of from 0.
function stepSleep(delta: number) {
  patch({ sleepHours: d.sleepHours === null ? (props.lastSleepHours ?? 7) : Math.min(24, stepValue(d.sleepHours, delta)) })
}
function typeSleep(v: number | null) {
  patch({ sleepHours: v === null ? null : Math.min(24, Math.round(v * 2) / 2) })
}

// Note: saved while typing (debounced) and on blur.
const note = ref(d.note)
watch(
  () => props.log?.note,
  (v) => {
    if (!noteFocused && v !== undefined) note.value = v
  },
)
let noteTimer: ReturnType<typeof setTimeout> | undefined
function saveNoteSoon() {
  clearTimeout(noteTimer)
  noteTimer = setTimeout(saveNote, 500)
}
function saveNote() {
  clearTimeout(noteTimer)
  if (note.value !== d.note) patch({ note: note.value })
}
function onNoteFocus() {
  noteFocused = true
}
function onNoteBlur() {
  noteFocused = false
  saveNote()
}
onBeforeUnmount(saveNote)
</script>

<template>
  <section class="card diary" aria-labelledby="diary-title">
    <h2 id="diary-title">Tu día</h2>

    <NumberStepper :value="d.sleepHours" :step="0.5" label="Sueño h" placeholder="—" @step="stepSleep" @change="typeSleep" />

    <div class="field-row">
      <span class="label">Calidad</span>
      <div class="chips-fill" role="group" aria-label="Calidad del sueño">
        <button
          v-for="q in QUALITY"
          :key="q.value"
          type="button"
          class="chip"
          :aria-pressed="d.sleepQuality === q.value"
          @click="patch({ sleepQuality: d.sleepQuality === q.value ? null : q.value })"
        >
          {{ q.label }}
        </button>
      </div>
    </div>

    <div class="field-row">
      <span class="label">Rodilla</span>
      <div class="grid-6" role="group" aria-label="Rodilla de 0 a 10">
        <button
          v-for="k in KNEE"
          :key="k"
          type="button"
          class="chip num-chip"
          :class="{ hurt: k > 0 }"
          :aria-pressed="d.kneePain === k"
          @click="patch({ kneePain: d.kneePain === k ? null : k })"
        >
          {{ k }}
        </button>
      </div>
    </div>

    <label class="flag" :class="{ on: d.kneeRedFlag }">
      <input type="checkbox" :checked="d.kneeRedFlag" @change="patch({ kneeRedFlag: !d.kneeRedFlag })" />
      <span>Hinchazón, bloqueo o fallo</span>
    </label>

    <div class="field-row">
      <span class="label">Turno</span>
      <div class="chips-fill" role="group" aria-label="Turno">
        <button
          v-for="s in SHIFT"
          :key="s.value"
          type="button"
          class="chip"
          :aria-pressed="d.shift === s.value"
          @click="patch({ shift: d.shift === s.value ? null : s.value })"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <div>
      <label class="field-label" for="diary-note">Nota del día</label>
      <textarea
        id="diary-note"
        v-model="note"
        rows="2"
        @focus="onNoteFocus"
        @input="saveNoteSoon"
        @blur="onNoteBlur"
      />
    </div>
  </section>
</template>

<style scoped>
.diary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.flag {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--tap);
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  font-weight: 700;
  cursor: pointer;
}
.flag input {
  width: 24px;
  height: 24px;
  flex: none;
  accent-color: var(--alarm);
}
.flag.on {
  border-color: var(--alarm);
  background: var(--alarm-soft);
  color: var(--alarm-ink);
}
</style>
